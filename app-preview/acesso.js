const SDK_URL = 'https://esm.sh/@supabase/supabase-js@2.116.0?target=es2022';
const REQUEST_TIMEOUT = 20000;
const states = Object.fromEntries(['loading', 'login', 'sent', 'granted', 'denied', 'error']
  .map((name) => [name, document.getElementById('state' + name[0].toUpperCase() + name.slice(1))]));
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const formError = document.getElementById('formError');
const sendButton = document.getElementById('sendButton');
const sendButtonLabel = sendButton.querySelector('.button-label');
const resendButton = document.getElementById('resendButton');
const sentError = document.getElementById('sentError');
const fatalError = document.getElementById('fatalError');
const retryButton = document.getElementById('retryButton');
const signoutButtons = Array.from(document.querySelectorAll('[data-signout]'));

let supabase;
let redirectURL;
let bootRunning = false;
let accessCheckRunning = false;
let checkPending = false;
let sendRunning = false;
let signoutRunning = false;
let generation = 0;
let observedUserId;
let verifiedUserId = null;
let lastEmail = '';
let callback = readCallback();
let storedSessionExpected = false;
let sessionValidationExpected = false;

function showState(name) {
  Object.entries(states).forEach(([key, element]) => element.classList.toggle('is-active', key === name));
}

function showError(stage, error) {
  // Avoid logging callback tokens, sessions or raw request/response objects.
  console.error('Mundo Prático — ' + stage, { code: error?.code, status: error?.status, timeout: error?.name === 'TimeoutError' });
  const messages = {
    sdk: 'Não foi possível carregar o serviço de acesso. Verifique sua conexão e tente novamente.',
    session: 'Sua sessão é inválida ou expirou. Use outro e-mail ou solicite um novo link de acesso.',
    claim: 'Não foi possível vincular sua compra agora. Tente novamente.',
    access: 'Não foi possível verificar se sua compra está ativa. Tente novamente.',
    profile: 'Sua compra está ativa, mas não foi possível preparar seu perfil. Tente novamente.',
    signout: 'Não foi possível encerrar sua sessão. Verifique sua conexão e tente sair novamente.',
  };
  fatalError.textContent = messages[stage];
  document.querySelector('#stateError [data-signout]').disabled = !supabase;
  showState('error');
}

function readCallback() {
  const params = [new URLSearchParams(location.search), new URLSearchParams(location.hash.slice(1))];
  return {
    error: params.some((p) => p.has('error') || p.has('error_description') || p.has('error_code')),
    present: params.some((p) => ['access_token', 'refresh_token', 'code', 'token_hash'].some((key) => p.has(key))),
  };
}

function cleanCallbackURL() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const keys = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'provider_token',
    'provider_refresh_token', 'code', 'token_hash', 'type', 'error', 'error_code', 'error_description'];
  let hashChanged = false;
  for (const key of keys) {
    url.searchParams.delete(key);
    if (hash.has(key)) { hash.delete(key); hashChanged = true; }
  }
  if (hashChanged) url.hash = hash.toString();
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

// The UI always leaves loading, including a stalled SDK import or Auth request.
async function timed(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Request timed out'), { name: 'TimeoutError' })), REQUEST_TIMEOUT);
    })]);
  } finally { clearTimeout(timer); }
}

async function limitedFetch(input, init = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); }
}

function resetLogin() {
  verifiedUserId = null;
  lastEmail = '';
  emailInput.value = '';
  emailInput.removeAttribute('aria-invalid');
  formError.textContent = '';
  sentError.textContent = '';
  ['sentEmail', 'grantedEmail', 'deniedEmail'].forEach((id) => { document.getElementById(id).textContent = ''; });
  showState('login');
}

async function ensureProfile(userId) {
  // Insert missing profiles; DO NOTHING on conflict preserves names, preferences and timestamps.
  const result = await timed(supabase.from('mp_profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }));
  if (result.error) throw result.error;
}

async function evaluateAccess(force = false) {
  if (!supabase || signoutRunning) return;
  if (accessCheckRunning) { if (force) checkPending = true; return; }
  accessCheckRunning = true;
  const currentGeneration = generation;
  const stale = () => currentGeneration !== generation;
  let stage = 'session';
  try {
    const callbackResult = callback;
    const sessionExpected = storedSessionExpected;
    storedSessionExpected = false;
    sessionValidationExpected = callbackResult.present || sessionExpected;
    let result;
    try { result = await timed(supabase.auth.getSession()); }
    finally { cleanCallbackURL(); callback = { present: false, error: false }; sessionValidationExpected = false; }
    if (stale()) return;
    if (callbackResult.error || result.error) throw result.error || new Error('Invalid callback');
    if (!result.data?.session) {
      if (callbackResult.present || sessionExpected) throw new Error('Expected session is invalid');
      if (!sendRunning && !states.sent.classList.contains('is-active')) resetLogin();
      return;
    }
    const localUserId = result.data.session.user?.id;
    if (!force && verifiedUserId === localUserId) return;
    showState('loading');
    const { data, error } = await timed(supabase.auth.getUser());
    if (stale()) return;
    if (error || !data?.user?.id || !data.user.email || data.user.id !== localUserId) throw error || new Error('Invalid user');
    const user = data.user;
    observedUserId = user.id;
    stage = 'claim';
    const claim = await timed(supabase.rpc('mp_claim_entitlements'));
    if (stale()) return;
    if (claim.error) throw claim.error;
    stage = 'access';
    const access = await timed(supabase.rpc('mp_has_active_access'));
    if (stale()) return;
    if (access.error) throw access.error;
    if (typeof access.data !== 'boolean') throw new Error('Invalid access result');
    // Claim may return 0 for a previously linked purchase. Only the boolean RPC decides access.
    if (access.data === true) {
      stage = 'profile';
      await ensureProfile(user.id);
      if (stale()) return;
      document.getElementById('grantedEmail').textContent = user.email;
      showState('granted');
    } else {
      document.getElementById('deniedEmail').textContent = user.email;
      showState('denied');
    }
    verifiedUserId = user.id;
  } catch (error) {
    if (!stale()) { verifiedUserId = null; showError(stage, error); }
  } finally {
    accessCheckRunning = false;
    if (checkPending) {
      checkPending = false;
      setTimeout(() => evaluateAccess(true), 0);
    }
  }
}

function authChanged(event, session) {
  // Keep the callback synchronous: Auth holds its session lock while notifying listeners.
  if (event === 'SIGNED_OUT') {
    generation += 1;
    observedUserId = null;
    verifiedUserId = null;
    if (!signoutRunning) {
      cleanCallbackURL();
      if (sessionValidationExpected || storedSessionExpected) showError('session', new Error('Session removed by Auth'));
      else resetLogin();
    }
    return;
  }
  if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return;
  const userId = session?.user?.id || null;
  if (!userId || signoutRunning) return;
  if (observedUserId !== undefined && observedUserId !== userId) {
    generation += 1;
    verifiedUserId = null;
    checkPending = accessCheckRunning;
  }
  observedUserId = userId;
  if (verifiedUserId !== userId) setTimeout(() => evaluateAccess(), 0);
}

async function boot() {
  if (bootRunning) return;
  bootRunning = true;
  showState('loading');
  try {
    const [sdk, config] = await timed(Promise.all([import(SDK_URL), import('./supabase-config.js')]));
    if (!config.MP_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') ||
      config.MP_SUPABASE_URL !== 'https://uajdfknjuqhntopkbral.supabase.co' ||
      config.MP_AUTH_REDIRECT_URL !== 'https://mundopraticodigital.com.br/app-preview/acesso.html') {
      throw new Error('Invalid public configuration');
    }
    redirectURL = config.MP_AUTH_REDIRECT_URL;
    try { storedSessionExpected = Boolean(localStorage.getItem('sb-uajdfknjuqhntopkbral-auth-token')); }
    catch (_) { /* The SDK also supports browsers where persistent storage is unavailable. */ }
    supabase = sdk.createClient(config.MP_SUPABASE_URL, config.MP_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
        flowType: 'implicit',
      },
      global: { fetch: limitedFetch },
    });
    supabase.auth.onAuthStateChange(authChanged);
  } catch (error) {
    // Keep unprocessed callback tokens available for an explicit reload if the SDK did not load.
    showError('sdk', error);
  } finally { bootRunning = false; }
  if (supabase) await evaluateAccess(true);
}

function sendErrorMessage(error) {
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
  }
  if (['email_address_invalid', 'validation_failed'].includes(error?.code)) return 'Confira o endereço de e-mail informado.';
  return 'Não foi possível enviar seu link de acesso. Verifique sua conexão e tente novamente.';
}

async function sendLink(email, resend = false) {
  if (!supabase || sendRunning || signoutRunning) return;
  sendRunning = true;
  const currentGeneration = generation;
  const errorElement = resend ? sentError : formError;
  errorElement.textContent = '';
  sendButton.disabled = resendButton.disabled = true;
  sendButtonLabel.textContent = 'Enviando…';
  resendButton.textContent = 'Reenviando…';
  try {
    const { error } = await timed(supabase.auth.signInWithOtp({
      email, options: { shouldCreateUser: true, emailRedirectTo: redirectURL },
    }));
    if (currentGeneration !== generation) return;
    if (error) throw error;
    lastEmail = email;
    document.getElementById('sentEmail').textContent = email;
    showState('sent');
  } catch (error) {
    if (currentGeneration === generation) {
      console.error('Mundo Prático — envio do link', { code: error?.code, status: error?.status });
      errorElement.textContent = sendErrorMessage(error);
    }
  } finally {
    sendRunning = false;
    sendButton.disabled = resendButton.disabled = false;
    sendButtonLabel.textContent = 'Enviar link de acesso';
    resendButton.textContent = 'Reenviar link de acesso';
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (sendRunning) return;
  const email = emailInput.value.trim().toLowerCase();
  formError.textContent = '';
  emailInput.removeAttribute('aria-invalid');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.setAttribute('aria-invalid', 'true');
    formError.textContent = 'Informe um e-mail válido.';
    emailInput.focus();
    return;
  }
  void sendLink(email);
});
resendButton.addEventListener('click', () => { if (lastEmail) void sendLink(lastEmail, true); });
document.getElementById('changeEmailButton').addEventListener('click', () => {
  if (sendRunning) return;
  resetLogin();
  emailInput.focus();
});
retryButton.addEventListener('click', () => {
  if (signoutRunning) return;
  if (supabase) void evaluateAccess(true);
  else if (!bootRunning) location.reload();
});

signoutButtons.forEach((button) => button.addEventListener('click', async () => {
  if (!supabase || signoutRunning) return;
  signoutRunning = true;
  generation += 1;
  checkPending = false;
  verifiedUserId = null;
  signoutButtons.forEach((item) => { item.disabled = true; });
  retryButton.disabled = true;
  try {
    if (supabase) {
      // Local scope preserves other sessions/devices; the SDK removes only its Auth storage.
      const { error } = await timed(supabase.auth.signOut({ scope: 'local' }));
      if (error) throw error;
    }
    cleanCallbackURL();
    callback = { present: false, error: false };
    observedUserId = null;
    resetLogin();
    emailInput.focus();
  } catch (error) { showError('signout', error); }
  finally {
    signoutRunning = false;
    signoutButtons.forEach((item) => { item.disabled = false; });
    retryButton.disabled = false;
  }
}));

window.addEventListener('pageshow', (event) => {
  if (event.persisted && supabase) void evaluateAccess(true);
});
if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', register, { once: true });
}
void boot();
