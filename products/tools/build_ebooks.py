from __future__ import annotations

import json
import shutil
from collections import Counter
from dataclasses import asdict
from pathlib import Path

from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A5
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from catalog import (
    FIT_CATEGORIES,
    FIT_RECIPES,
    SPECIAL_CATEGORIES,
    SPECIAL_RECIPES,
    Recipe,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUTS = ROOT / "outputs"
W, H = A5


def register_fonts() -> None:
    fonts = Path(r"C:\Windows\Fonts")
    registrations = {
        "MPSerif": fonts / "georgia.ttf",
        "MPSerif-Bold": fonts / "georgiab.ttf",
        "MPSerif-Italic": fonts / "georgiai.ttf",
        "MPSans": fonts / "arial.ttf",
        "MPSans-Bold": fonts / "arialbd.ttf",
    }
    for name, path in registrations.items():
        pdfmetrics.registerFont(TTFont(name, str(path)))


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if line and pdfmetrics.stringWidth(candidate, font, size) > width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def draw_lines(c: canvas.Canvas, lines: list[str], x: float, y: float, font: str, size: float,
               leading: float, color: Color, max_lines: int | None = None) -> float:
    c.setFont(font, size)
    c.setFillColor(color)
    for line in lines[:max_lines]:
        c.drawString(x, y, line)
        y -= leading
    return y


def paragraph(c: canvas.Canvas, text: str, x: float, y: float, width: float, font: str = "MPSans",
              size: float = 9, leading: float = 12, color: Color = HexColor("#34322F"),
              max_lines: int | None = None) -> float:
    return draw_lines(c, wrap(text, font, size, width), x, y, font, size, leading, color, max_lines)


def shadow_card(c: canvas.Canvas, x: float, y: float, width: float, height: float,
                fill: Color, radius: float = 10) -> None:
    c.setFillColor(Color(0, 0, 0, alpha=0.08))
    c.roundRect(x + 2, y - 3, width, height, radius, fill=1, stroke=0)
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, radius, fill=1, stroke=0)


def footer(c: canvas.Canvas, page_no: int, accent: Color, section: str = "") -> None:
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.35))
    c.line(28, 25, W - 28, 25)
    c.setFillColor(HexColor("#6C6862"))
    c.setFont("MPSans", 6.7)
    c.drawString(28, 14, "MUNDO PRÁTICO")
    if section:
        c.drawCentredString(W / 2, 14, section.upper())
    c.drawRightString(W - 28, 14, str(page_no))


def airfryer_icon(c: canvas.Canvas, x: float, y: float, scale: float, color: Color) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(2.3 * scale)
    c.roundRect(x, y, 84 * scale, 104 * scale, 15 * scale, fill=0, stroke=1)
    c.roundRect(x + 13 * scale, y + 46 * scale, 58 * scale, 40 * scale, 8 * scale, fill=0, stroke=1)
    c.circle(x + 30 * scale, y + 91 * scale, 2.5 * scale, fill=0, stroke=1)
    c.circle(x + 43 * scale, y + 91 * scale, 2.5 * scale, fill=0, stroke=1)
    c.line(x + 34 * scale, y + 38 * scale, x + 50 * scale, y + 38 * scale)
    c.line(x + 38 * scale, y + 38 * scale, x + 38 * scale, y + 29 * scale)
    c.line(x + 46 * scale, y + 38 * scale, x + 46 * scale, y + 29 * scale)


def cover(c: canvas.Canvas, cfg: dict) -> None:
    bg, ink, accent, metallic = cfg["bg"], cfg["ink"], cfg["accent"], cfg["metallic"]
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(Color(accent.red, accent.green, accent.blue, alpha=0.12))
    c.circle(W + 30, H - 65, 145, fill=1, stroke=0)
    c.setFillColor(Color(metallic.red, metallic.green, metallic.blue, alpha=0.16))
    c.circle(-35, 45, 120, fill=1, stroke=0)
    c.setFillColor(accent)
    c.roundRect(28, H - 61, 110, 22, 11, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("MPSans-Bold", 8.5)
    c.drawCentredString(83, H - 53, cfg["eyebrow"])
    c.setFillColor(ink)
    c.setFont("MPSerif-Bold", 68)
    c.drawString(28, H - 145, cfg["number"])
    y = H - 180
    for line in cfg["title_lines"]:
        c.setFont("MPSerif-Bold", 27)
        c.drawString(30, y, line)
        y -= 33
    c.setFillColor(accent)
    c.setFont("MPSerif-Italic", 21)
    c.drawString(30, y - 2, cfg["airfryer_line"])
    c.setStrokeColor(metallic)
    c.setLineWidth(1)
    c.line(30, y - 18, W - 30, y - 18)
    c.setFillColor(ink)
    paragraph(c, cfg["subtitle"], 30, y - 42, 230, "MPSans", 10.2, 14, ink, 3)
    airfryer_icon(c, W - 133, 94, 1.03, accent)
    c.setFillColor(accent)
    c.circle(73, 103, 28, fill=1, stroke=0)
    c.setFillColor(bg)
    c.setFont("MPSans-Bold", 7.5)
    c.drawCentredString(73, 105, cfg["badge_a"])
    c.drawCentredString(73, 95, cfg["badge_b"])
    c.setFillColor(ink)
    c.setFont("MPSerif-Bold", 12)
    c.drawString(30, 41, "Mundo Prático")
    c.setFont("MPSans", 6.8)
    c.drawRightString(W - 28, 41, "E-BOOK DIGITAL • EDIÇÃO 2026")
    c.showPage()


def title_block(c: canvas.Canvas, page_no: int, title: str, kicker: str, cfg: dict) -> float:
    bg, ink, accent = cfg["bg"], cfg["ink"], cfg["accent"]
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(accent)
    c.setFont("MPSans-Bold", 7.2)
    c.drawString(28, H - 36, kicker.upper())
    c.setFillColor(ink)
    lines = wrap(title, "MPSerif-Bold", 25, W - 56)
    y = H - 68
    y = draw_lines(c, lines, 28, y, "MPSerif-Bold", 25, 29, ink)
    c.setStrokeColor(accent)
    c.setLineWidth(1.4)
    c.line(28, y - 4, 100, y - 4)
    footer(c, page_no, accent)
    return y - 28


def legal_page(c: canvas.Canvas, page_no: int, cfg: dict, title: str) -> None:
    y = title_block(c, page_no, "Informações editoriais", "Mundo Prático", cfg)
    paragraph(c, title, 28, y, W - 56, "MPSerif-Bold", 15, 19, cfg["ink"])
    y -= 48
    texts = [
        "Autoria e produção editorial: Mundo Prático • Edição digital 2026.",
        "Este material tem finalidade culinária e informativa. Não substitui orientação profissional nem apresenta promessas médicas, nutricionais ou de resultado corporal.",
        "Tempos e temperaturas são referências práticas. O desempenho varia conforme capacidade, potência, circulação de ar e quantidade preparada.",
        "Todos os direitos reservados. É proibida a reprodução, distribuição ou revenda sem autorização.",
    ]
    for text in texts:
        shadow_card(c, 28, y - 50, W - 56, 48, HexColor("#FFFDF9"), 8)
        paragraph(c, text, 40, y - 18, W - 80, "MPSans", 8.2, 11, cfg["ink"], 3)
        y -= 62
    c.showPage()


def info_page(c: canvas.Canvas, page_no: int, title: str, kicker: str, intro: str,
              cards: list[tuple[str, str]], cfg: dict) -> None:
    y = title_block(c, page_no, title, kicker, cfg)
    y = paragraph(c, intro, 28, y, W - 56, "MPSans", 9.3, 13, cfg["ink"], 5) - 14
    card_h = min(76, (y - 45) / max(1, len(cards)) - 5)
    for card_title, body in cards:
        shadow_card(c, 28, y - card_h, W - 56, card_h, HexColor("#FFFDF9"), 9)
        c.setFillColor(cfg["accent"])
        c.circle(47, y - 22, 9, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("MPSans-Bold", 8)
        c.drawCentredString(47, y - 25, "•")
        c.setFillColor(cfg["ink"])
        c.setFont("MPSerif-Bold", 11.5)
        c.drawString(63, y - 18, card_title)
        paragraph(c, body, 63, y - 34, W - 103, "MPSans", 7.9, 10.2, cfg["ink"], 4)
        y -= card_h + 7
    c.showPage()


def summary_page(c: canvas.Canvas, page_no: int, categories: list[str], counts: list[int],
                 first_category_page: int, cfg: dict) -> None:
    y = title_block(c, page_no, "Sumário", "Organização", cfg)
    paragraph(c, "As receitas estão agrupadas por ocasião e tipo de preparo para facilitar a consulta.",
              28, y, W - 56, "MPSans", 9.2, 13, cfg["ink"], 3)
    y -= 50
    running = first_category_page
    for i, (category, count) in enumerate(zip(categories, counts), 1):
        shadow_card(c, 28, y - 62, W - 56, 57, HexColor("#FFFDF9"), 9)
        c.setFillColor(cfg["accent"])
        c.setFont("MPSerif-Bold", 22)
        c.drawString(42, y - 37, f"{i:02d}")
        c.setFillColor(cfg["ink"])
        c.setFont("MPSerif-Bold", 11.5)
        lines = wrap(category, "MPSerif-Bold", 11.5, 210)
        draw_lines(c, lines, 88, y - 22, "MPSerif-Bold", 11.5, 14, cfg["ink"], 2)
        c.setFont("MPSans", 7.2)
        c.setFillColor(HexColor("#6B6862"))
        c.drawString(88, y - 49, f"{count} receitas")
        c.setFont("MPSans-Bold", 8)
        c.drawRightString(W - 42, y - 35, f"p. {running}")
        running += count + 1
        y -= 70
    c.showPage()


def category_page(c: canvas.Canvas, page_no: int, number: int, name: str,
                  recipes: list[Recipe], cfg: dict) -> None:
    bg, ink, accent, metallic = cfg["bg"], cfg["ink"], cfg["accent"], cfg["metallic"]
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(accent)
    c.rect(0, H - 95, W, 95, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("MPSans-Bold", 8)
    c.drawString(28, H - 34, f"CATEGORIA {number:02d}")
    c.setFont("MPSerif-Bold", 25)
    title_lines = wrap(name, "MPSerif-Bold", 25, W - 56)
    draw_lines(c, title_lines, 28, H - 61, "MPSerif-Bold", 25, 28, white, 2)
    shadow_card(c, 28, 63, W - 56, H - 183, HexColor("#FFFDF9"), 12)
    c.setFillColor(metallic)
    c.circle(W - 66, H - 136, 27, fill=1, stroke=0)
    c.setFillColor(ink)
    c.setFont("MPSerif-Bold", 21)
    c.drawCentredString(W - 66, H - 131, str(len(recipes)))
    c.setFont("MPSans", 6.7)
    c.drawCentredString(W - 66, H - 143, "RECEITAS")
    y = H - 132
    c.setFillColor(ink)
    c.setFont("MPSerif-Bold", 13)
    c.drawString(43, y, "O que você encontra aqui")
    y -= 24
    columns = 2 if len(recipes) > 12 else 1
    per_col = (len(recipes) + columns - 1) // columns
    col_width = (W - 98) / columns
    for idx, recipe in enumerate(recipes):
        col = idx // per_col
        row = idx % per_col
        x = 43 + col * col_width
        ry = y - row * (22 if columns == 2 else 25)
        c.setFillColor(accent)
        c.circle(x + 3, ry + 2, 2.3, fill=1, stroke=0)
        c.setFillColor(ink)
        size = 7.4 if columns == 2 else 8.2
        lines = wrap(recipe.title, "MPSans", size, col_width - 18)
        draw_lines(c, lines, x + 11, ry + 5, "MPSans", size, size + 2, ink, 2)
    footer(c, page_no, accent, name)
    c.showPage()


def stat_chip(c: canvas.Canvas, x: float, y: float, width: float, label: str, value: str, cfg: dict) -> None:
    c.setFillColor(Color(cfg["accent"].red, cfg["accent"].green, cfg["accent"].blue, alpha=0.11))
    c.roundRect(x, y, width, 34, 8, fill=1, stroke=0)
    c.setFillColor(HexColor("#6B6862"))
    c.setFont("MPSans", 6.4)
    c.drawString(x + 9, y + 21, label.upper())
    c.setFillColor(cfg["ink"])
    c.setFont("MPSans-Bold", 8.7)
    c.drawString(x + 9, y + 9, value)


def recipe_page(c: canvas.Canvas, page_no: int, recipe_no: int, recipe: Recipe, cfg: dict) -> None:
    bg, ink, accent = cfg["bg"], cfg["ink"], cfg["accent"]
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(accent)
    c.rect(0, H - 48, W, 48, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("MPSans-Bold", 7)
    c.drawString(28, H - 30, recipe.category.upper())
    c.drawRightString(W - 28, H - 30, f"RECEITA {recipe_no:03d}")
    y = H - 76
    title_size = 20 if len(recipe.title) < 44 else 18
    title_lines = wrap(recipe.title, "MPSerif-Bold", title_size, W - 56)
    y = draw_lines(c, title_lines, 28, y, "MPSerif-Bold", title_size, title_size + 3, ink, 3)
    y -= 3
    y = paragraph(c, recipe.description, 28, y, W - 56, "MPSans", 8.8, 11.2, HexColor("#5A5752"), 3)
    y -= 10
    chip_w = (W - 68) / 3
    stat_chip(c, 28, y - 34, chip_w, "Rendimento", recipe.yield_text, cfg)
    stat_chip(c, 34 + chip_w, y - 34, chip_w, "Tempo", f"{recipe.minutes} min", cfg)
    stat_chip(c, 40 + 2 * chip_w, y - 34, chip_w, "Temperatura", f"{recipe.temperature} °C", cfg)
    y -= 53
    c.setFillColor(accent)
    c.setFont("MPSerif-Bold", 12)
    c.drawString(28, y, "Ingredientes")
    y -= 14
    c.setFillColor(ink)
    for item in recipe.ingredients:
        lines = wrap(item, "MPSans", 8.4, W - 78)
        c.setFillColor(accent)
        c.circle(34, y + 2, 1.8, fill=1, stroke=0)
        y = draw_lines(c, lines, 43, y + 5, "MPSans", 8.4, 10.7, ink)
        y -= 1.5
    y -= 5
    c.setFillColor(accent)
    c.setFont("MPSerif-Bold", 12)
    c.drawString(28, y, "Modo de preparo")
    y -= 14
    for idx, step in enumerate(recipe.steps, 1):
        c.setFillColor(accent)
        c.circle(36, y + 1, 7, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("MPSans-Bold", 6.8)
        c.drawCentredString(36, y - 1.4, str(idx))
        lines = wrap(step, "MPSans", 8.2, W - 82)
        y = draw_lines(c, lines, 50, y + 4, "MPSans", 8.2, 10.5, ink)
        y -= 2
    tip_h = 47
    tip_y = 36
    if y < tip_y + tip_h + 5:
        raise ValueError(f"Recipe page overflow: {recipe.title} ended at {y:.1f}")
    shadow_card(c, 28, tip_y, W - 56, tip_h, Color(accent.red, accent.green, accent.blue, alpha=0.10), 9)
    c.setFillColor(accent)
    c.setFont("MPSerif-Bold", 9.5)
    c.drawString(39, tip_y + 27, "Dica prática")
    paragraph(c, recipe.tip, 112, tip_y + 31, W - 153, "MPSans", 7.2, 8.8, ink, 4)
    footer(c, page_no, accent, recipe.category)
    c.showPage()


def final_page(c: canvas.Canvas, page_no: int, cfg: dict, message: str) -> None:
    c.setFillColor(cfg["ink"])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(cfg["accent"])
    c.circle(W / 2, H - 130, 52, fill=1, stroke=0)
    airfryer_icon(c, W / 2 - 29, H - 165, 0.7, cfg["bg"])
    c.setFillColor(cfg["bg"])
    c.setFont("MPSerif-Bold", 30)
    c.drawCentredString(W / 2, H - 245, "Cozinhe. Teste.")
    c.setFillColor(cfg["metallic"])
    c.drawCentredString(W / 2, H - 281, "Adapte. Repita.")
    paragraph(c, message, 55, H - 330, W - 110, "MPSans", 9.4, 13, cfg["bg"], 6)
    c.setFont("MPSerif-Bold", 15)
    c.setFillColor(cfg["bg"])
    c.drawCentredString(W / 2, 72, "Mundo Prático")
    c.setFont("MPSans", 7)
    c.drawCentredString(W / 2, 55, "MAIS SABOR, MENOS COMPLICAÇÃO.")
    c.showPage()


def export_source(path: Path, recipes: list[Recipe], categories: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "brand": "Mundo Prático",
        "categories": categories,
        "recipe_count": len(recipes),
        "recipes": [asdict(recipe) for recipe in recipes],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def fit_pdf(path: Path) -> int:
    cfg = {
        "bg": HexColor("#F5F0E7"), "ink": HexColor("#173A32"),
        "accent": HexColor("#2F755B"), "metallic": HexColor("#D88A35"),
        "eyebrow": "COLEÇÃO AIR FRYER", "number": "50",
        "title_lines": ["RECEITAS FIT", "& LOW CARB"], "airfryer_line": "PARA AIR FRYER",
        "subtitle": "Práticas, leves e deliciosas para variar o dia a dia",
        "badge_a": "5 CATEGORIAS", "badge_b": "10 RECEITAS CADA",
    }
    c = canvas.Canvas(str(path), pagesize=A5, pageCompression=1)
    c.setTitle("50 Receitas Fit e Low Carb para Air Fryer")
    c.setAuthor("Mundo Prático")
    page = 1
    cover(c, cfg); page += 1
    legal_page(c, page, cfg, "50 Receitas Fit e Low Carb para Air Fryer"); page += 1
    info_page(c, page, "Bem-vindo a uma cozinha mais leve", "Apresentação",
              "Este e-book reúne ideias culinárias práticas para variar o cardápio na Air Fryer. O foco é sabor, organização e ingredientes acessíveis, sem promessas médicas ou nutricionais.",
              [("Receitas do dia a dia", "Porções objetivas, ingredientes encontrados no Brasil e preparos pensados para a rotina."),
               ("Leve é um estilo culinário", "As escolhas são variadas; adapte ingredientes às suas preferências e necessidades pessoais."),
               ("Consulte durante o preparo", "Cada receita ocupa uma página, com rendimento, tempo e temperatura em destaque.")], cfg); page += 1
    info_page(c, page, "Antes de começar", "Introdução",
              "Separe ingredientes, confira o tamanho da cesta e leia a receita inteira. A organização reduz interrupções e ajuda a obter resultados consistentes.",
              [("Primeiro teste", "Na primeira execução, verifique o alimento alguns minutos antes do tempo indicado."),
               ("Pouco óleo", "Uma camada fina costuma bastar; use pincel ou borrifador quando indicado."),
               ("Ajuste à sua rotina", "Troque ervas e acompanhamentos sem alterar a técnica principal da receita.")], cfg); page += 1
    info_page(c, page, "Guia rápido da Air Fryer", "Uso seguro e prático",
              "Tempo e temperatura são pontos de partida. O comportamento varia conforme o modelo, a potência e a quantidade colocada na cesta.",
              [("Pré-aquecimento", "Quando indicado, aqueça por 3 minutos. Isso favorece o dourado e deixa o início do cozimento mais previsível."),
               ("Espaço na cesta", "Não compacte alimentos. Prepare em duas levas quando não houver espaço para o ar circular."),
               ("Virar ou mexer", "Cubos, legumes, petiscos e empanados douram de modo mais uniforme quando virados na metade."),
               ("Ajuste de tempo", "O tempo pode variar conforme o modelo e a potência da sua Air Fryer. Observe textura e ponto.")], cfg); page += 1
    summary_page(c, page, FIT_CATEGORIES, [10] * 5, page + 1, cfg); page += 1
    global_no = 1
    for cat_no, category in enumerate(FIT_CATEGORIES, 1):
        items = [r for r in FIT_RECIPES if r.category == category]
        category_page(c, page, cat_no, category, items, cfg); page += 1
        for recipe in items:
            recipe_page(c, page, global_no, recipe, cfg); page += 1; global_no += 1
    info_page(c, page, "Checklist de ingredientes", "Organize a despensa",
              "Use esta lista como referência para montar uma base versátil. Compre os itens frescos conforme as receitas escolhidas.",
              [("Temperos", "Sal, pimenta, páprica, cúrcuma, cominho, canela, orégano, alecrim e ervas frescas."),
               ("Bases", "Ovos, azeite, iogurte natural, creme de ricota, queijos, aveia, linhaça, chia e castanhas."),
               ("Hortifruti", "Cebola, alho, limão, tomate, abobrinha, brócolis, couve-flor, folhas e frutas da estação."),
               ("Proteínas", "Frango, cortes suínos, carne moída magra, atum, tofu e opções de sua preferência.")], cfg); page += 1
    final_page(c, page, cfg, "Use as receitas como ponto de partida, respeite o tamanho do seu aparelho e registre os ajustes que funcionarem melhor na sua cozinha.")
    c.save()
    return page


def special_pdf(path: Path) -> int:
    cfg = {
        "bg": HexColor("#F4EDE2"), "ink": HexColor("#1E1E1E"),
        "accent": HexColor("#D85B1E"), "metallic": HexColor("#C69A47"),
        "eyebrow": "EDIÇÃO ESPECIAL", "number": "100",
        "title_lines": ["RECEITAS EXTRAS"], "airfryer_line": "PARA AIR FRYER",
        "subtitle": "Mais variedade, mais sabor e novas ideias para sua Air Fryer",
        "badge_a": "4 CATEGORIAS", "badge_b": "25 RECEITAS CADA",
    }
    c = canvas.Canvas(str(path), pagesize=A5, pageCompression=1)
    c.setTitle("100 Receitas Extras para Air Fryer - Edição Especial")
    c.setAuthor("Mundo Prático")
    page = 1
    cover(c, cfg); page += 1
    legal_page(c, page, cfg, "100 Receitas Extras para Air Fryer - Edição Especial"); page += 1
    info_page(c, page, "Uma edição para ampliar possibilidades", "Apresentação",
              "Receitas recheadas, gratinadas, empanadas e completas dão nova vida à Air Fryer sem transformar a cozinha em um projeto complicado.",
              [("Mais variedade", "Quatro capítulos equilibram petiscos, proteínas, refeições completas e sobremesas especiais."),
               ("Ingredientes possíveis", "As combinações têm apresentação caprichada, mas usam técnicas e compras acessíveis."),
               ("Uma receita por página", "Consulta rápida, bom contraste e leitura confortável em tela pequena.")], cfg); page += 1
    info_page(c, page, "Como aproveitar esta edição", "Introdução",
              "Escolha uma receita principal, organize os acompanhamentos e confirme se a forma ou refratário cabe com folga na cesta.",
              [("Leia antes", "Algumas receitas partem de arroz, massa, carne ou legumes previamente cozidos; prepare essa etapa primeiro."),
               ("Trabalhe em levas", "Petiscos ficam melhores quando não estão amontoados. Mantenha os primeiros aquecidos enquanto finaliza."),
               ("Registre ajustes", "Anote o tempo que funciona no seu modelo para repetir o ponto desejado.")], cfg); page += 1
    info_page(c, page, "Guia geral de tempos e temperaturas", "Referência rápida",
              "Use as faixas abaixo como ponto de partida e sempre confira espessura, quantidade e ponto do alimento.",
              [("160-170 °C", "Bolos, cheesecakes, massas delicadas e preparos com bastante açúcar."),
               ("180 °C", "Gratinados, tortas, ramequins, recheados e massas folhadas."),
               ("190 °C", "Empanados, frango, carne suína, salgados e petiscos."),
               ("200 °C", "Selar carnes, criar crosta e finalizar preparos já cozidos.")], cfg); page += 1
    info_page(c, page, "Crocância, empanados e gratinados", "Técnicas",
              "Pequenos cuidados fazem diferença entre uma cobertura úmida e uma superfície realmente dourada.",
              [("Crocância", "Seque o alimento, use pouca gordura e deixe espaço. Vire ou mexa quando houver contato com a cesta."),
               ("Empanados", "Pressione a cobertura, resfrie peças delicadas e borrife uma camada fina de azeite."),
               ("Gratinados", "Use ingredientes já quentes quando possível e refratários baixos para o calor chegar ao centro."),
               ("Massa folhada", "Mantenha gelada até assar e evite recheios quentes ou com líquido solto.")], cfg); page += 1
    info_page(c, page, "Receber sem correria", "Para compartilhar",
              "Monte um cardápio curto: um petisco, uma proteína ou prato gratinado e uma sobremesa que possa ser preparada antes.",
              [("Antes da visita", "Modele salgados, prepare molhos e deixe recheios frios. Asse perto do horário de servir."),
               ("Sirva em etapas", "Faça porções menores em levas. Assim os petiscos chegam quentes e a cesta não fica lotada."),
               ("Equilibre o menu", "Combine algo crocante, um preparo cremoso e uma opção fresca servida à parte.")], cfg); page += 1
    info_page(c, page, "5 combinações da Edição Especial", "Menus sugeridos",
              "Todas as combinações abaixo usam receitas deste próprio e-book.",
              [("Noite de petiscos", "Cestinha de brie + camarão empanado com tapioca + fondant de chocolate."),
               ("Almoço caprichado", "Maminha com crosta + caçarola de batata e frango + torta de maçã."),
               ("Jantar aconchegante", "Bruschetta de cogumelos + ravióli assado + cheesecake de banana."),
               ("Mesa brasileira", "Bolinho de mandioca + lombo com barbecue de goiabada + brigadeirão de café."),
               ("Fim de semana", "Roseta de calabresa + frango hasselback caprese + brownie cheesecake de framboesa.")], cfg); page += 1
    summary_page(c, page, SPECIAL_CATEGORIES, [25] * 4, page + 1, cfg); page += 1
    global_no = 1
    for cat_no, category in enumerate(SPECIAL_CATEGORIES, 1):
        items = [r for r in SPECIAL_RECIPES if r.category == category]
        category_page(c, page, cat_no, category, items, cfg); page += 1
        for recipe in items:
            recipe_page(c, page, global_no, recipe, cfg); page += 1; global_no += 1
    final_page(c, page, cfg, "Varie recheios, acompanhamentos e finalizações, mas mantenha a técnica central. Sua Air Fryer e seus ingredientes indicam os ajustes finais.")
    c.save()
    return page


def main() -> None:
    register_fonts()
    fit_root = ROOT / "products" / "50-fit-low-carb"
    special_root = ROOT / "products" / "100-receitas-extras"
    for product_root in (fit_root, special_root):
        (product_root / "source").mkdir(parents=True, exist_ok=True)
        (product_root / "assets").mkdir(parents=True, exist_ok=True)
        (product_root / "dist").mkdir(parents=True, exist_ok=True)
    export_source(fit_root / "source" / "receitas.json", FIT_RECIPES, FIT_CATEGORIES)
    export_source(special_root / "source" / "receitas.json", SPECIAL_RECIPES, SPECIAL_CATEGORIES)
    (fit_root / "assets" / "README.md").write_text("Design vetorial original, sem fotografias ou ativos de terceiros.\n", encoding="utf-8")
    (special_root / "assets" / "README.md").write_text("Design vetorial original, sem fotografias ou ativos de terceiros.\n", encoding="utf-8")
    fit_path = fit_root / "dist" / "50-receitas-fit-low-carb-airfryer.pdf"
    special_path = special_root / "dist" / "100-receitas-extras-airfryer.pdf"
    fit_pages = fit_pdf(fit_path)
    special_pages = special_pdf(special_path)
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    shutil.copy2(fit_path, OUTPUTS / fit_path.name)
    shutil.copy2(special_path, OUTPUTS / special_path.name)
    print(json.dumps({
        "fit": {"path": str(fit_path), "recipes": len(FIT_RECIPES), "pages": fit_pages},
        "special": {"path": str(special_path), "recipes": len(SPECIAL_RECIPES), "pages": special_pages},
        "counts": {
            "fit": Counter(r.category for r in FIT_RECIPES),
            "special": Counter(r.category for r in SPECIAL_RECIPES),
        },
    }, ensure_ascii=False, indent=2, default=dict))


if __name__ == "__main__":
    main()
