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

    link.addEventListener('click', (event) => {
      const destination = getCheckoutUrl();
      link.href = destination;

      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', {
          content_name: '200 Receitas para Air Fryer',
          value: 19.90,
          currency: 'BRL'
        });
      }

      const opensSeparately = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === '_blank';
      if (opensSeparately) return;

      event.preventDefault();
      window.setTimeout(() => window.location.assign(destination), 180);
    });
  });
})();
