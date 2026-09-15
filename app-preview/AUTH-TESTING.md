# Autenticação do preview

Escopo: somente `/app-preview/`. O index continua público; os links desktop
“Entrar / Minha conta” e mobile “Acessar” apontam para `./acesso.html`.
Nenhuma configuração, tabela, policy, RPC ou secret do projeto Supabase foi alterada.

## Fluxo

1. O cliente carrega Supabase JS **2.116.0**, com a publishable key pública,
   persistência de sessão, refresh automático e detecção de sessão na URL.
   O fluxo permanece **implicit**, compatível com o Magic Link existente.
   A chave de armazenamento padrão foi mantida para reconhecer sessões anteriores.
2. Sem sessão: e-mail → `signInWithOtp` com `shouldCreateUser: true` e
   `emailRedirectTo: https://mundopraticodigital.com.br/app-preview/acesso.html`.
   A tela confirma o envio, permite reenviar e usar outro e-mail. Não redireciona.
3. Com sessão: `getSession` → `getUser` → `mp_claim_entitlements()` →
   `mp_has_active_access()`. A decisão usa apenas o booleano do segundo RPC;
   claim retornando zero não impede o acesso.
4. Com acesso: insert de `mp_profiles` com `ignoreDuplicates: true`, sem
   sobrescrever nome, preferências ou timestamps existentes; botão
   “Entrar no Mundo Prático” para `./`.
5. Sem acesso: mensagem de compra ausente, e-mail autenticado, “Usar outro e-mail”
   e “Sair”. Não há consulta direta a compras/entitlements no frontend.
6. Logout: `signOut({ scope: 'local' })`, verificando o erro retornado, seguido
   do estado inicial. Nenhum `localStorage.clear()` ou limpeza de preferências.
   O escopo local evita revogar outras sessões/dispositivos.

Callbacks Auth são síncronos e agendam a verificação fora do callback. Há deduplicação
por usuário, controle de concorrência e descarte de respostas anteriores ao logout
ou à troca de usuário. Ações manuais e retorno por bfcache permitem revalidar.
Erros de SDK, sessão, vínculo, acesso, perfil, envio e logout possuem mensagens
amigáveis; operações têm timeout de 20 segundos. Não há logs de tokens ou sessões.
Se o SDK não carregar, “Tentar novamente” recarrega a página, permitindo baixar o
módulo novamente; tokens ainda não processados ficam disponíveis para essa tentativa.
Após o processamento da sessão, os parâmetros temporários são removidos da URL.

## Configuração manual a conferir

No [Dashboard do projeto — URL Configuration](https://supabase.com/dashboard/project/uajdfknjuqhntopkbral/auth/url-configuration),
confira se **Redirect URLs** já contém exatamente:

`https://mundopraticodigital.com.br/app-preview/acesso.html`

Se estiver ausente, acrescente apenas essa entrada, preservando todas as URLs do CRM.
**Não mude Site URL, SMTP, providers, secrets, policies nem outros valores.**
Esta allowlist não foi consultada nem alterada por API nesta tarefa.

Confirme com o responsável pelo projeto que o template de e-mail atual já envia
um Magic Link compatível com `{{ .ConfirmationURL }}`. Um template compartilhado
adaptado a OTP numérico ou a callback próprio do CRM pode impedir este retorno.
Não altere o template global para realizar este teste; documente a incompatibilidade.
Consulte também o responsável caso o SMTP padrão restrinja os destinatários de teste
ou o serviço de e-mail limite o envio. Nenhuma alteração de SMTP é proposta aqui.

São necessários dois e-mails controlados por você: um com entitlement já cadastrado,
ativo e não expirado de `mundo_pratico`, e outro sem compra. O teste não cria compras.

## Teste real, depois de publicar este commit

1. Abra `https://mundopraticodigital.com.br/app-preview/acesso.html` em desktop
   e no celular, com internet. Se já estiver autenticado, clique em “Sair desta conta”.
2. Informe o e-mail da compra e clique em “Enviar link de acesso”. Verifique a
   confirmação. Aguarde o intervalo permitido pelo servidor antes de testar reenvio.
3. Abra o Magic Link **mais recente** no mesmo navegador/aparelho. Confirme a URL
   limpa, seu e-mail, o estado de acesso liberado e o botão “Entrar no Mundo Prático”.
4. Clique no botão e confirme o preview. Volte a `acesso.html`: a sessão existente
   deve verificar o acesso sem solicitar novamente o e-mail.
5. Saia e entre novamente com o mesmo e-mail: o acesso deve permanecer válido mesmo
   quando a compra já estiver vinculada e o claim retornar zero.
6. Saia, entre com o segundo e-mail e confirme a mensagem de compra ausente. Teste
   “Usar outro e-mail” e “Sair”. As preferências do preview devem permanecer.
7. Use um link já consumido/expirado e confira a mensagem de sessão inválida,
   sem loading permanente. Solicite outro link.
8. No PWA instalado, abra o preview online para atualizar o worker para **v7**.
   O preview e suas fotos continuam disponíveis offline; a autenticação requer rede
   e retorna instrução de reconexão em vez de servir arquivos de acesso antigos.

O commit desta tarefa é local até ser publicado. O teste real de entrega de e-mail
e de uma compra verdadeira deve ser realizado após a publicação; não foi simulado
como sucesso de integração em produção.

## Verificações executadas

- Testes de navegador usando o SDK real, sessões sintéticas e APIs interceptadas;
  nenhum e-mail enviado e nenhuma compra/perfil real modificado.
- Estados de login, Magic Link, sessão existente, claim zero, acesso negado,
  perfil sem overwrite, logout, retorno de sessão, deduplicação e resposta antiga
  após logout. Falhas por etapa, callback expirado, rate limit e timeouts.
- Layouts de 1440, 390 e 320 px; links desktop/mobile e caminhos locais conferidos.
- Atualização real do service worker local de v6 para v7: cache alheio preservado,
  seis imagens precacheadas, arquivos de acesso/respostas externas fora do cache,
  autenticação offline com HTTP 503 e preview offline com HTTP 200.
- Auditoria SQL somente de leitura: RLS de `mp_profiles` e `mp_entitlements`,
  policies por usuário e RPCs sem permissão de execução para `anon`.
- API pública: autenticação de e-mail habilitada e signup permitido; ambos RPCs
  retornaram HTTP 401 sem sessão. Isso não comprova a entrega do Magic Link.

Para repetir os testes, tenha Node.js, Playwright e Microsoft Edge instalados:

```powershell
node app-preview/tests/auth.cjs
```

O runner inicia seu próprio servidor local e intercepta todas as chamadas ao projeto
Supabase. O download do SDK fixado pelo CDN requer internet. Se Playwright estiver
fora dos módulos locais, configure `MP_PLAYWRIGHT_MODULE` com o caminho do pacote.
`MP_BROWSER_CHANNEL` permite selecionar outro canal Chromium instalado.

Referências: [Magic Link](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[callbacks Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
