(() => {
  'use strict';

  const CHECKOUT_URL = 'https://pay.hotmart.com/A107329562M?checkoutMode=10';
  const CAMPAIGN_PARAMS = [
    'fbclid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term'
  ];

  function addPreconnect(href) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  // Antecipa DNS/TLS com a infraestrutura da Hotmart enquanto o visitante ainda lê a página.
  addPreconnect('https://pay.hotmart.com');
  addPreconnect('https://checkout.hotmart.com');

  function getCheckoutUrl() {
    const destination = new URL(CHECKOUT_URL);
    const currentParams = new URLSearchParams(window.location.search);

    CAMPAIGN_PARAMS.forEach((key) => {
      const values = currentParams.getAll(key);
      if (!values.length) return;
      destination.searchParams.delete(key);
      values.forEach((value) => destination.searchParams.append(key, value));
    });

    return destination.toString();
  }

  const checkoutLinks = document.querySelectorAll('[data-checkout]');
  checkoutLinks.forEach((link) => {
    link.href = getCheckoutUrl();

    link.addEventListener('click', () => {
      // Não bloqueia a navegação: o navegador segue o href imediatamente.
      link.href = getCheckoutUrl();

      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          content_name: '200 Receitas para Air Fryer',
          value: 19.90,
          currency: 'BRL'
        });
      }
    });
  });
})();
