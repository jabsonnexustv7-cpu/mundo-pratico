from __future__ import annotations

import difflib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

from pypdf import PdfReader

from catalog import FIT_CATEGORIES, FIT_RECIPES, SPECIAL_CATEGORIES, SPECIAL_RECIPES, Recipe


ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / "products" / "qa"


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return " ".join(re.findall(r"[a-z0-9]+", text))


def title_score(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    seq = difflib.SequenceMatcher(None, na, nb).ratio()
    sa, sb = set(na.split()), set(nb.split())
    jaccard = len(sa & sb) / max(1, len(sa | sb))
    return max(seq, jaccard)


def validate_catalog(name: str, recipes: list[Recipe], categories: list[str], expected_each: int) -> dict:
    issues: list[str] = []
    counts = Counter(recipe.category for recipe in recipes)
    if any(counts[category] != expected_each for category in categories):
        issues.append(f"category counts: {dict(counts)}")
    titles = [norm(recipe.title) for recipe in recipes]
    duplicates = sorted(title for title, count in Counter(titles).items() if count > 1)
    if duplicates:
        issues.append(f"duplicate titles: {duplicates}")
    near = []
    for i, left in enumerate(recipes):
        for right in recipes[i + 1:]:
            score = title_score(left.title, right.title)
            if score >= 0.86:
                near.append({"left": left.title, "right": right.title, "score": round(score, 3)})
    if near:
        issues.append(f"near duplicate titles: {len(near)}")

    common_terms = {
        "azeite", "ovos", "ovo", "manteiga", "leite", "farinha", "acucar", "sal",
        "pimenta", "alho", "cebola", "tomate", "frango", "carne", "peixe", "queijo",
    }
    missing_references = []
    for index, recipe in enumerate(recipes, 1):
        required = {
            "title": recipe.title, "description": recipe.description, "yield": recipe.yield_text,
            "ingredients": recipe.ingredients, "steps": recipe.steps, "tip": recipe.tip,
        }
        for field, value in required.items():
            if not value:
                issues.append(f"recipe {index} missing {field}")
        if not 5 <= recipe.minutes <= 60:
            issues.append(f"recipe {index} implausible time: {recipe.minutes}")
        if not 145 <= recipe.temperature <= 205:
            issues.append(f"recipe {index} implausible temperature: {recipe.temperature}")
        if len(recipe.steps) < 3:
            issues.append(f"recipe {index} has fewer than 3 steps")
        ingredient_tokens = set(norm(" ".join(recipe.ingredients)).split())
        step_tokens = set(norm(" ".join(recipe.steps)).split())
        aliases = {
            "carne": {"coxao", "alcatra", "lagarto", "linguica", "patinho", "maminha", "bife"},
            "ovos": {"ovo"}, "ovo": {"ovos"}, "queijo": {"mucarela", "parmesao", "provolone", "cheddar"},
        }
        absent = sorted(
            term for term in common_terms
            if term in step_tokens
            and term not in ingredient_tokens
            and not (aliases.get(term, set()) & ingredient_tokens)
        )
        if absent:
            missing_references.append({"recipe": recipe.title, "terms": absent})
        encoded = json.dumps(required, ensure_ascii=False)
        if "�" in encoded or "TODO" in encoded or "placeholder" in encoded.lower():
            issues.append(f"recipe {index} has broken or placeholder text")

    return {
        "name": name,
        "recipe_count": len(recipes),
        "category_counts": dict(counts),
        "exact_duplicate_titles": duplicates,
        "near_duplicate_titles": near,
        "ingredient_reference_warnings": missing_references,
        "issues": issues,
    }


def validate_pdf(pdf_path: Path, recipes: list[Recipe], expected_pages: int) -> dict:
    reader = PdfReader(str(pdf_path))
    page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
    all_text = norm("\n".join(page_texts))
    missing_titles = [recipe.title for recipe in recipes if norm(recipe.title) not in all_text]
    blank_pages = [index + 1 for index, text in enumerate(page_texts) if len(text) < 3]
    boxes = [tuple(round(float(v), 2) for v in page.mediabox) for page in reader.pages]
    return {
        "path": str(pdf_path),
        "page_count": len(reader.pages),
        "expected_pages": expected_pages,
        "missing_recipe_titles": missing_titles,
        "blank_pages": blank_pages,
        "page_box_variants": sorted(set(boxes)),
        "valid": len(reader.pages) == expected_pages and not missing_titles and not blank_pages,
    }


def original_comparison(all_new: list[Recipe]) -> dict:
    source = QA / "original-titles-ocr.txt"
    if not source.exists():
        source = ROOT / "tmp" / "pdfs" / "original" / "original-titles.txt"
    lines = source.read_text(encoding="utf-8").splitlines()
    originals = [line.split("\t", 1)[-1] for line in lines if line.strip()]
    candidates = []
    for recipe in all_new:
        score, original = max((title_score(recipe.title, title), title) for title in originals)
        if score >= 0.76:
            candidates.append({"new": recipe.title, "original": original, "score": round(score, 3)})
    return {
        "original_title_count": len(originals),
        "new_title_count": len(all_new),
        "exact_matches": [x for x in candidates if x["score"] == 1],
        "manual_similarity_review": candidates,
    }


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    QA.mkdir(parents=True, exist_ok=True)
    original_source = ROOT / "tmp" / "pdfs" / "original" / "original-titles.txt"
    if original_source.exists():
        (QA / "original-titles-ocr.txt").write_text(original_source.read_text(encoding="utf-8"), encoding="utf-8")
    fit = validate_catalog("50 Receitas Fit e Low Carb", FIT_RECIPES, FIT_CATEGORIES, 10)
    special = validate_catalog("100 Receitas Extras - Edição Especial", SPECIAL_RECIPES, SPECIAL_CATEGORIES, 25)
    cross = []
    for left in FIT_RECIPES:
        for right in SPECIAL_RECIPES:
            score = title_score(left.title, right.title)
            if score >= 0.86:
                cross.append({"left": left.title, "right": right.title, "score": round(score, 3)})
    report = {
        "fit_catalog": fit,
        "special_catalog": special,
        "cross_product_near_duplicates": cross,
        "original_comparison": original_comparison(FIT_RECIPES + SPECIAL_RECIPES),
        "fit_pdf": validate_pdf(
            ROOT / "products" / "50-fit-low-carb" / "dist" / "50-receitas-fit-low-carb-airfryer.pdf",
            FIT_RECIPES, 63,
        ),
        "special_pdf": validate_pdf(
            ROOT / "products" / "100-receitas-extras" / "dist" / "100-receitas-extras-airfryer.pdf",
            SPECIAL_RECIPES, 114,
        ),
    }
    report["valid"] = not (
        fit["issues"] or special["issues"] or cross
        or report["original_comparison"]["exact_matches"]
        or not report["fit_pdf"]["valid"] or not report["special_pdf"]["valid"]
    )
    path = QA / "validation-report.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
