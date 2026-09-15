import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0?target=es2022';
import {
  MP_SUPABASE_URL,
  MP_SUPABASE_PUBLISHABLE_KEY,
  MP_AUTH_REDIRECT_URL,
} from './supabase-config.js';

const supabase = createClient(MP_SUPABASE_URL, MP_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

const states = {
  loading: document.getElementById('stateLoading'),
  login: document.getElementById('stateLogin'),
  sent: document.getElementById('stateSent'),
  granted: document.getElementById('stateGranted'),
  denied: document.getElementById('stateDenied'),
  error: document.getElementById('stateError'),
};

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const formError = document.getElementById('formError');
const sendButton = document.getElementById('sendButton');
const sendButtonLabel = sendButton?.querySelector('.button-label');
const sentEmail = document.getElementById('sentEmail');
const grantedEmail = document.getElementById('grantedEmail');
const deniedEmail = document.getElementById('deniedEmail');
const fatalError = document.getElementById('fatalError');

let accessCheckRunning = false;

function showState(name) {
  Object.entries(states).forEach(([key, element]) => {
    element?.classList.toggle('is-active', key === name);
  });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function friendlyError(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  if (raw.includes('rate limit')) return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
  if (raw.includes('email') && raw.includes('invalid')) return 'Confira o endereço de e-mail informado.';
  if (raw.includes('redirect')) return 'A URL de retorno do Mundo Prático ainda precisa ser autorizada no Supabase.';
  if (raw.includes('network') || raw.includes('fetch')) return 'Não foi possível conectar agora. Verifique sua internet e tente novamente.';
  return error?.message || 'Não foi possível concluir a operação. Tente novamente.';
}

function authErrorFromLocation() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error');
}

async function ensureProfile(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('mp_profiles')
    .upsert({ user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id', ignoreDuplicates: false });
  if (error) console.warn('Mundo Prático: perfil não pôde ser sincronizado.', error.message);
}

async function evaluateAccess() {
  if (accessCheckRunning) return;
  accessCheckRunning = true;
  showState('loading');

  try {
    const callbackError = authErrorFromLocation();
    if (callbackError) throw new Error(decodeURIComponent(callbackError.replace(/\+/g, ' ')));

    // No navegador, getSession é usado somente para descobrir se existe uma sessão local.
    // getUser valida a identidade com o Auth antes de qualquer decisão de acesso.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      showState('login');
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const user = userData.user;
    if (!user?.email) {
      await supabase.auth.signOut();
      showState('login');
      return;
    }

    // Se a Hotmart já tiver criado um entitlement com o mesmo e-mail,
    // esta chamada o vincula ao auth.uid() atual sob RLS.
    const { error: claimError } = await supabase.rpc('mp_claim_entitlements');
    if (claimError) throw claimError;

    const { data: hasAccess, error: accessError } = await supabase.rpc('mp_has_active_access');
    if (accessError) throw accessError;

    if (hasAccess === true) {
      await ensureProfile(user.id);
      grantedEmail.textContent = user.email;
      showState('granted');
    } else {
      deniedEmail.textContent = user.email;
      showState('denied');
    }
  } catch (error) {
    console.error('Mundo Prático auth:', error);
    fatalError.textContent = friendlyError(error);
    showState('error');
  } finally {
    accessCheckRunning = false;
  }
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  emailInput.removeAttribute('aria-invalid');

  const email = normalizeEmail(emailInput.value);
  if (!isValidEmail(email)) {
    emailInput.setAttribute('aria-invalid', 'true');
    formError.textContent = 'Informe um e-mail válido.';
    emailInput.focus();
    return;
  }

  sendButton.disabled = true;
  if (sendButtonLabel) sendButtonLabel.textContent = 'Enviando…';

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: MP_AUTH_REDIRECT_URL,
      },
    });

    if (error) throw error;

    sentEmail.textContent = email;
    showState('sent');
  } catch (error) {
    formError.textContent = friendlyError(error);
  } finally {
    sendButton.disabled = false;
    if (sendButtonLabel) sendButtonLabel.textContent = 'Enviar link de acesso';
  }
});

document.getElementById('changeEmailButton')?.addEventListener('click', () => {
  showState('login');
  emailInput.focus();
});

document.getElementById('retryButton')?.addEventListener('click', evaluateAccess);

document.querySelectorAll('[data-signout]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await supabase.auth.signOut();
      history.replaceState(null, '', './acesso.html');
      emailInput.value = '';
      showState('login');
      emailInput.focus();
    } finally {
      button.disabled = false;
    }
  });
});

window.addEventListener('pageshow', () => {
  evaluateAccess();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
