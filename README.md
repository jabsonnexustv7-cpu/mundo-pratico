# Mundo Prático

Landing page estática do e-book **200 Receitas para Air Fryer**, construída com HTML, CSS e JavaScript vanilla e preparada para hospedagem no GitHub Pages.

## Estrutura

```text
/
├── index.html              # Entrada da marca
├── airfryer/index.html     # Landing page do produto
├── privacy.html            # Política de Privacidade
├── terms.html              # Termos de Uso
└── assets/
    ├── css/style.css
    ├── js/main.js
    └── images/             # Previews reais exportados do PDF
```

## Alterações comerciais

- **Preço exibido:** procure por `R$ 19,90` em `airfryer/index.html`. O valor enviado ao Pixel aparece como `19.90` no HTML e no JavaScript.
- **Checkout:** altere `CHECKOUT_URL` em `assets/js/main.js` e os `href` de fallback dos links com `data-checkout` em `airfryer/index.html`.
- **Meta Pixel:** altere `1347928517329520` no bloco comentado `Meta Pixel`, dentro de `airfryer/index.html`.
- **Microsoft Clarity:** insira o snippet oficial no bloco comentado `MICROSOFT CLARITY`, no `<head>` da landing page. Não use ID de exemplo.

## Imagens

Os arquivos em `assets/images/` foram exportados diretamente do PDF final do produto. Para substituí-los, mantenha os nomes, as proporções verticais e atualize `width` e `height` no HTML caso as dimensões mudem.

Arquivos principais:

- `ebook-cover.webp`
- `presentation-page.webp`
- `summary-page.webp`
- `category-frango.webp`
- `recipe-frango.webp`
- `recipe-vegetarian.webp`
- `recipe-dessert.webp`
- `bonus-7-days.webp`
- `bonus-sauces-checklist.webp`

## Teste local

Na raiz do projeto, inicie um servidor estático, por exemplo:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000/airfryer/`.

## Meta Pixel

1. Abra a landing com a extensão Meta Pixel Helper ou a ferramenta **Testar eventos** no Gerenciador de Eventos.
2. Confirme `PageView` e `ViewContent` ao carregar.
3. Clique em cada CTA e confirme `InitiateCheckout` antes do redirecionamento.
4. Teste uma URL como `/airfryer/?utm_source=teste&fbclid=abc123` e confirme que esses parâmetros chegam ao checkout sem remover `checkoutMode=10`.

## GitHub Pages

O projeto usa caminhos relativos e funciona em Pages, inclusive quando publicado sob uma rota de repositório. Depois de enviar os arquivos ao GitHub, habilite **Settings → Pages → Deploy from a branch**, selecione a branch principal e a pasta `/ (root)`.

## Domínio próprio

Quando houver domínio:

1. Configure o domínio em **Settings → Pages → Custom domain**.
2. Ajuste os registros DNS conforme o GitHub informar.
3. Ative HTTPS depois da propagação.
4. Em `airfryer/index.html`, transforme `og:image` em URL absoluta e adicione `og:url`.
5. Revise as páginas legais e acrescente dados oficiais de contato/controlador.
