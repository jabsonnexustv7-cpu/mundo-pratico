# Integração do preview com o backend

O app usa exclusivamente as funções existentes de `mp-data.js`. Nenhuma mudança de banco, RLS, autenticação, Edge Function ou IA faz parte desta integração.

## Testes automatizados

Execute com Node.js e Playwright disponíveis:

```powershell
$env:MP_PLAYWRIGHT_MODULE = 'caminho/para/node_modules/playwright'
node app-preview/tests/backend.cjs
```

O teste carrega o módulo e o SDK Supabase reais no browser. Intercepta as respostas HTTP com uma sessão sintética e um snapshot das dez receitas existentes, sem enviar e-mails ou gravar dados de produção. Valida os dois modos, payloads, orçamento, catálogo, plano, compras, modais, busca, erros, layouts e PWA. Isso não comprova persistência no Supabase com uma sessão real.

Foram feitas também consultas somente de leitura no backend: catálogo ativo com dez receitas, permissões da RPC e busca `frango, batata, queijo` com nove resultados. A RPC existente filtra Peixe e compatibilidade com os equipamentos; a interface envia essas preferências sem recriar essa lógica.

## Validação manual após a publicação

Use o navegador onde a conta de teste já está autenticada. Não copie tokens.

1. Abra `https://mundopraticodigital.com.br/app-preview/` e confirme “Dados salvos na sua conta”. Se aparecer demonstração, entre por `acesso.html` e volte ao preview no mesmo navegador.
2. Abra Receitas e confirme dez cards. Abra pelo menos duas receitas e confira título, foto, tempo, porções, ingredientes com quantidades e preparo distintos.
3. No Planejador, informe quatro pessoas, orçamento R$ 250, Praticidade, Air Fryer/Fogão e Peixe selecionado para evitar. Gere o plano uma vez.
4. Confirme sete datas consecutivas a partir de hoje, ausência de tilápia e compatibilidade com pelo menos um equipamento selecionado. Confira orçamento informado, custo estimado e margem. Se o custo ultrapassar o orçamento, deve aparecer o aviso correspondente. Na requisição `mp_generate_week_plan`, o orçamento deve ser `p_budget_cents: 25000`.
5. Abra Compras: confira agrupamento por categoria, ingredientes consolidados, quantidade e unidade. Marque um item, aguarde a conclusão e clique “Atualizar lista”. O item deve continuar marcado; desmarque e atualize novamente. Confira também o progresso. A atualização consulta a lista salva na API, não apenas o estado do checkbox.
6. Em Receitas, busque `frango, batata, queijo`. Confira resultados na ordem retornada e abra uma receita encontrada. Confira o modal com os ingredientes e preparo daquela receita.
7. Teste com apenas Air Fryer e gere outro plano; as refeições devem ser compatíveis com Air Fryer. Teste orçamento decimal, como R$ 123,45, e confirme `12345` centavos na requisição.
8. Confira em mobile 320/390 px e desktop 1024/1440 px. No PWA, confirme o cache `mundo-pratico-preview-v9`; ao abrir offline, o modo demonstração continua disponível.

O ID do último plano e da lista fica em memória durante a página aberta, conforme o escopo. Recarregar a página não restaura automaticamente o último plano; para comprovar a persistência do checkbox, use “Atualizar lista” antes de recarregar.

As funções fornecidas não incluem inserção ou troca isolada de receita no plano. As ações do modal permanecem disponíveis: planejar orienta a geração do cardápio, compras consulta a lista do último plano e trocar abre o catálogo. A interface não declara que essas operações salvaram uma receita isolada.

Não é necessário chamar `askMundoPraticoAI()` nesta validação. O módulo e essa função foram preservados.
