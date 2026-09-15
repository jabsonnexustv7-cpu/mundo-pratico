(() => {
  'use strict';

  const views = Array.from(document.querySelectorAll('[data-view]'));
  const navButtons = Array.from(document.querySelectorAll('[data-nav]'));
  const toast = document.getElementById('toast');
  const recipeModal = document.getElementById('recipeModal');
  const PROFILE_KEY = 'mp-preview-profile-v1';
  let flowStage = 0;
  let currentProfile = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function navigate(target, mode) {
    views.forEach((view) => view.classList.toggle('is-active', view.dataset.view === target));
    navButtons.forEach((button) => {
      const primaryNav = button.classList.contains('nav-item') || Boolean(button.closest('.bottom-nav'));
      button.classList.toggle('is-active', primaryNav && button.dataset.nav === target);
    });
    history.replaceState(null, '', '#' + target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (target === 'receitas' && mode === 'ingredients') {
      setTimeout(() => document.getElementById('ingredientInput')?.focus(), 250);
    }
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(button.dataset.nav, button.dataset.mode);
    });
  });

  const initialView = location.hash.slice(1);
  if (views.some((view) => view.dataset.view === initialView)) navigate(initialView);

  function injectExperienceStyles() {
    if (document.getElementById('mp-experience-styles')) return;
    const style = document.createElement('style');
    style.id = 'mp-experience-styles';
    style.textContent = `
      .mp-onboarding{position:fixed;inset:0;z-index:12000;background:rgba(32,28,25,.68);display:grid;place-items:center;padding:18px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;backdrop-filter:blur(8px)}
      .mp-onboarding__card{width:min(100%,650px);max-height:min(820px,calc(100vh - 36px));overflow:auto;background:#fffdf9;color:#28231f;border-radius:28px;padding:26px;box-shadow:0 28px 90px rgba(24,20,17,.30)}
      .mp-onboarding__brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}.mp-onboarding__brand .brand-mark{flex:0 0 auto}.mp-onboarding__brand strong{display:block}.mp-onboarding__brand small{display:block;color:#716961;margin-top:2px}
      .mp-onboarding__progress{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 0 28px}.mp-onboarding__progress i{height:5px;border-radius:999px;background:#e6ded4;transition:.2s}.mp-onboarding__progress i.is-active{background:#d95c0b}
      .mp-step{display:none}.mp-step.is-active{display:block}.mp-step .eyebrow{margin-bottom:10px}.mp-step h2{margin:0 0 10px;font:500 clamp(2rem,6vw,3.4rem)/.98 Georgia,'Times New Roman',serif;letter-spacing:-.04em}.mp-step>p{margin:0 0 24px;color:#716961;line-height:1.5}
      .mp-choice-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mp-choice{position:relative}.mp-choice input{position:absolute;opacity:0;pointer-events:none}.mp-choice label{min-height:64px;display:flex;align-items:center;gap:10px;padding:14px 15px;border:1px solid rgba(40,35,31,.14);border-radius:16px;background:#fff;cursor:pointer;font-weight:750}.mp-choice input:checked+label{border-color:#d95c0b;background:#fff5ed;box-shadow:inset 0 0 0 1px #d95c0b}.mp-choice label small{display:block;font-weight:500;color:#716961;margin-top:3px}
      .mp-onboarding__select{width:100%;border:1px solid rgba(40,35,31,.14);border-radius:15px;padding:14px 15px;background:#fff;color:#28231f;font:650 15px Inter,ui-sans-serif,sans-serif;margin-top:8px}
      .mp-onboarding__footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:26px;padding-top:18px;border-top:1px solid rgba(40,35,31,.10)}.mp-onboarding__footer button{border:0;border-radius:13px;padding:13px 18px;font-weight:800;cursor:pointer}.mp-back{background:#f1ece6;color:#514941}.mp-next{background:#28231f;color:#fff;margin-left:auto}.mp-next:disabled{opacity:.45;cursor:not-allowed}
      .mp-profile-note{margin:2px 0 22px;padding:13px 15px;border:1px solid rgba(217,92,11,.18);border-radius:15px;background:#fff8f2;color:#5a4a3f;font-size:13px;line-height:1.45}.mp-profile-note strong{color:#b94605}
      .mp-flow-strip{display:flex;align-items:center;gap:8px;overflow:auto;padding:10px 0 18px;scrollbar-width:none}.mp-flow-strip::-webkit-scrollbar{display:none}.mp-flow-step{white-space:nowrap;display:flex;align-items:center;gap:7px;border:1px solid rgba(40,35,31,.12);border-radius:999px;padding:8px 11px;background:#fff;color:#716961;font-size:12px;font-weight:750;cursor:pointer}.mp-flow-step b{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;background:#eee8e1;color:#716961;font-size:11px}.mp-flow-step.is-done{color:#53664a;border-color:rgba(113,132,102,.32);background:#f5f8f2}.mp-flow-step.is-done b{background:#718466;color:#fff}.mp-flow-step.is-current{color:#b94605;border-color:rgba(217,92,11,.32);background:#fff7f0}.mp-flow-step.is-current b{background:#d95c0b;color:#fff}.mp-flow-arrow{color:#aaa198;font-size:13px;flex:0 0 auto}
      .mp-result-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.mp-result-actions button{border:0;border-radius:12px;padding:12px 13px;font-weight:800;cursor:pointer}.mp-result-actions .primary{background:#28231f;color:#fff}.mp-result-actions .secondary{background:#f0e8de;color:#514941}
      .mp-connected-banner{display:flex;align-items:flex-start;gap:11px;margin:0 0 18px;padding:13px 14px;border-radius:15px;background:#f4f7f1;border:1px solid rgba(113,132,102,.22);color:#4c5946;font-size:13px;line-height:1.42}.mp-connected-banner span{width:27px;height:27px;flex:0 0 27px;border-radius:50%;display:grid;place-items:center;background:#718466;color:#fff;font-size:12px}.mp-connected-banner strong{display:block;color:#384332;margin-bottom:2px}
      .mp-recipe-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:18px 0 10px}.mp-recipe-actions button{border:1px solid rgba(40,35,31,.13);border-radius:12px;padding:12px 11px;background:#fff;font-weight:800;color:#28231f;cursor:pointer}.mp-recipe-actions button:first-child{grid-column:1/-1;background:#28231f;color:#fff;border-color:#28231f}.mp-recipe-actions button:hover{transform:translateY(-1px)}
      .mp-reset-profile{display:block;width:100%;margin:8px 0 0;border:0;background:transparent;color:#8b7d70;font-size:11px;text-decoration:underline;cursor:pointer}
      .mp-demo-note{font-size:12px;color:#8a7d71;margin-top:8px}
      @media(max-width:700px){.mp-onboarding{padding:0;align-items:end}.mp-onboarding__card{max-height:92vh;border-radius:28px 28px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom))}.mp-choice-list{grid-template-columns:1fr}.mp-result-actions,.mp-recipe-actions{grid-template-columns:1fr}.mp-recipe-actions button:first-child{grid-column:auto}.mp-flow-strip{padding-bottom:14px}}
    `;
    document.head.appendChild(style);
  }

  injectExperienceStyles();

  function loadProfile() {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  }

  function saveProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
    currentProfile = profile;
    flowStage = Math.max(flowStage, 1);
    applyProfile(profile);
    renderFlowStrips();
  }

  function profileSummary(profile) {
    if (!profile) return '';
    const equipment = profile.equipment.length ? profile.equipment.join(' + ') : 'equipamentos flexíveis';
    return `${profile.people} · ${profile.budget.toLowerCase()} · foco em ${profile.goal.toLowerCase()} · ${equipment}`;
  }

  function syncPlannerFromProfile(profile) {
    if (!profile) return;
    const people = document.getElementById('people');
    const budget = document.getElementById('budget');
    if (people) {
      const option = Array.from(people.options).find((item) => item.textContent === profile.people);
      if (option) people.value = option.value;
    }
    if (budget) {
      const option = Array.from(budget.options).find((item) => item.textContent === profile.budget);
      if (option) budget.value = option.value;
    }
    const goalMap = { 'Praticidade': 'g1', 'Economia': 'g2', 'Mais variedade': 'g3' };
    const goalInput = document.getElementById(goalMap[profile.goal]);
    if (goalInput) goalInput.checked = true;
    const equipmentMap = { 'Air Fryer': 'e1', 'Fogão': 'e2', 'Forno': 'e3' };
    Object.entries(equipmentMap).forEach(([name, id]) => {
      const input = document.getElementById(id);
      if (input) input.checked = profile.equipment.includes(name);
    });
    document.querySelectorAll('.tag').forEach((tag) => {
      const normalized = tag.textContent.replace('×', '').trim();
      tag.classList.toggle('is-selected', profile.avoid.includes(normalized));
    });
  }

  function applyProfile(profile) {
    if (!profile) return;
    syncPlannerFromProfile(profile);
    let note = document.querySelector('.mp-profile-note');
    const homeTop = document.querySelector('#view-inicio .top-row');
    if (!note && homeTop) {
      note = document.createElement('div');
      note.className = 'mp-profile-note';
      homeTop.insertAdjacentElement('afterend', note);
    }
    if (note) note.innerHTML = `<strong>Sugestões simuladas para você:</strong> ${profileSummary(profile)}. No produto final, o cardápio será gerado a partir dessas escolhas.`;

    const plannerSubtitle = document.querySelector('#view-planejar .page-heading > p:last-child');
    if (plannerSubtitle) plannerSubtitle.textContent = `Preferências carregadas: ${profileSummary(profile)}. Ajuste qualquer item antes de gerar a semana.`;
  }

  function showOnboarding(force = false) {
    if (document.querySelector('.mp-onboarding')) return;
    if (!force && loadProfile()) return;

    const overlay = document.createElement('div');
    overlay.className = 'mp-onboarding';
    overlay.innerHTML = `
      <div class="mp-onboarding__card" role="dialog" aria-modal="true" aria-label="Configuração inicial do Mundo Prático">
        <div class="mp-onboarding__brand"><span class="brand-mark">M</span><div><strong>Mundo Prático</strong><small>Vamos adaptar o app à sua rotina</small></div></div>
        <div class="mp-onboarding__progress"><i class="is-active"></i><i></i><i></i><i></i></div>
        <section class="mp-step is-active" data-step="0">
          <p class="eyebrow">1 de 4 · sua casa</p><h2>Para quantas pessoas você costuma cozinhar?</h2><p>Isso define as porções e as quantidades da lista de compras.</p>
          <div class="mp-choice-list">
            ${['1 pessoa','2 pessoas','4 pessoas','5 pessoas','6+ pessoas'].map((item, index) => `<div class="mp-choice"><input type="radio" name="obPeople" id="obp${index}" value="${item}" ${item === '4 pessoas' ? 'checked' : ''}><label for="obp${index}">${item}</label></div>`).join('')}
          </div>
        </section>
        <section class="mp-step" data-step="1">
          <p class="eyebrow">2 de 4 · prioridade</p><h2>O que mais importa na sua semana?</h2><p>O plano pode priorizar praticidade, economia ou variedade.</p>
          <div class="mp-choice-list">
            ${[['Praticidade','Menos tempo decidindo e preparando'],['Economia','Aproveitar melhor o orçamento'],['Mais variedade','Evitar repetir as mesmas refeições']].map((item, index) => `<div class="mp-choice"><input type="radio" name="obGoal" id="obg${index}" value="${item[0]}" ${index === 0 ? 'checked' : ''}><label for="obg${index}"><span>${item[0]}<small>${item[1]}</small></span></label></div>`).join('')}
          </div>
          <label style="display:block;margin-top:20px;font-weight:800;font-size:13px">Orçamento semanal aproximado<select class="mp-onboarding__select" id="obBudget"><option>Até R$ 150</option><option selected>Até R$ 250</option><option>Até R$ 350</option><option>Sem limite definido</option></select></label>
        </section>
        <section class="mp-step" data-step="2">
          <p class="eyebrow">3 de 4 · sua cozinha</p><h2>Quais equipamentos você quer usar?</h2><p>Marque um ou mais. As receitas serão compatíveis com sua rotina.</p>
          <div class="mp-choice-list">
            ${['Air Fryer','Fogão','Forno'].map((item, index) => `<div class="mp-choice"><input type="checkbox" name="obEquipment" id="obe${index}" value="${item}" ${index < 2 ? 'checked' : ''}><label for="obe${index}">${item}</label></div>`).join('')}
          </div>
        </section>
        <section class="mp-step" data-step="3">
          <p class="eyebrow">4 de 4 · preferências</p><h2>Tem algo que prefere evitar?</h2><p>Você pode alterar isso depois. No preview, usamos essas escolhas apenas para simular a personalização.</p>
          <div class="mp-choice-list">
            ${['Peixe','Carne suína','Leite','Glúten'].map((item, index) => `<div class="mp-choice"><input type="checkbox" name="obAvoid" id="oba${index}" value="${item}" ${item === 'Peixe' ? 'checked' : ''}><label for="oba${index}">${item}</label></div>`).join('')}
          </div>
          <p class="mp-demo-note">Nenhum dado é enviado ou salvo em servidor nesta versão.</p>
        </section>
        <div class="mp-onboarding__footer"><button class="mp-back" type="button" hidden>Voltar</button><button class="mp-next" type="button">Continuar →</button></div>
      </div>`;

    let step = 0;
    const steps = Array.from(overlay.querySelectorAll('.mp-step'));
    const indicators = Array.from(overlay.querySelectorAll('.mp-onboarding__progress i'));
    const back = overlay.querySelector('.mp-back');
    const next = overlay.querySelector('.mp-next');

    function updateStep() {
      steps.forEach((item, index) => item.classList.toggle('is-active', index === step));
      indicators.forEach((item, index) => item.classList.toggle('is-active', index <= step));
      back.hidden = step === 0;
      next.textContent = step === steps.length - 1 ? 'Criar meu Mundo Prático →' : 'Continuar →';
    }

    back.addEventListener('click', () => { step = Math.max(0, step - 1); updateStep(); });
    next.addEventListener('click', () => {
      if (step < steps.length - 1) {
        step += 1;
        updateStep();
        return;
      }
      const people = overlay.querySelector('input[name="obPeople"]:checked')?.value || '4 pessoas';
      const goal = overlay.querySelector('input[name="obGoal"]:checked')?.value || 'Praticidade';
      const budget = overlay.querySelector('#obBudget')?.value || 'Até R$ 250';
      const equipment = Array.from(overlay.querySelectorAll('input[name="obEquipment"]:checked')).map((item) => item.value);
      const avoid = Array.from(overlay.querySelectorAll('input[name="obAvoid"]:checked')).map((item) => item.value);
      const profile = { people, goal, budget, equipment: equipment.length ? equipment : ['Fogão'], avoid };
      saveProfile(profile);
      overlay.remove();
      showToast('Seu Mundo Prático foi configurado.');
      setTimeout(() => {
        if (isiOS && !isStandalone) showIOSInstallGuide();
      }, 800);
    });

    document.body.appendChild(overlay);
  }

  function addResetProfileButton() {
    const tag = document.querySelector('.prototype-tag');
    if (!tag || document.querySelector('.mp-reset-profile')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mp-reset-profile';
    button.textContent = 'Refazer preferências do preview';
    button.addEventListener('click', () => showOnboarding(true));
    tag.insertAdjacentElement('afterend', button);
  }

  const flowTargets = [
    { label: 'Preferências', target: 'inicio' },
    { label: 'Plano', target: 'planejar' },
    { label: 'Receitas', target: 'receitas' },
    { label: 'Compras', target: 'compras' }
  ];

  function createFlowStrip() {
    const strip = document.createElement('div');
    strip.className = 'mp-flow-strip';
    flowTargets.forEach((item, index) => {
      if (index) {
        const arrow = document.createElement('span');
        arrow.className = 'mp-flow-arrow';
        arrow.textContent = '→';
        strip.appendChild(arrow);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mp-flow-step';
      button.dataset.flowIndex = String(index + 1);
      button.innerHTML = `<b>${index + 1}</b>${item.label}`;
      button.addEventListener('click', () => navigate(item.target));
      strip.appendChild(button);
    });
    return strip;
  }

  function installFlowStrips() {
    const placements = [
      document.querySelector('#view-inicio .mp-profile-note') || document.querySelector('#view-inicio .top-row'),
      document.querySelector('#view-planejar .page-heading'),
      document.querySelector('#view-receitas .page-heading'),
      document.querySelector('#view-compras .page-heading')
    ];
    placements.forEach((anchor) => {
      if (!anchor || anchor.nextElementSibling?.classList.contains('mp-flow-strip')) return;
      anchor.insertAdjacentElement('afterend', createFlowStrip());
    });
    renderFlowStrips();
  }

  function renderFlowStrips() {
    document.querySelectorAll('.mp-flow-step').forEach((button) => {
      const index = Number(button.dataset.flowIndex);
      button.classList.toggle('is-done', index <= flowStage);
      button.classList.toggle('is-current', index === Math.min(flowStage + 1, 4));
      const badge = button.querySelector('b');
      if (badge) badge.textContent = index <= flowStage ? '✓' : String(index);
    });
  }

  function setFlowStage(stage) {
    flowStage = Math.max(flowStage, stage);
    renderFlowStrips();
  }

  function ensureConnectedBanners() {
    const recipeHeading = document.querySelector('#view-receitas .page-heading');
    const shoppingHeading = document.querySelector('#view-compras .page-heading');
    if (recipeHeading && !document.getElementById('mpRecipeConnection')) {
      const banner = document.createElement('div');
      banner.id = 'mpRecipeConnection';
      banner.className = 'mp-connected-banner';
      banner.innerHTML = '<span>✓</span><div><strong>Receitas conectadas ao seu plano</strong>Quando você gera a semana, as receitas do cardápio ficam disponíveis aqui para consulta e troca.</div>';
      recipeHeading.insertAdjacentElement('afterend', banner);
    }
    if (shoppingHeading && !document.getElementById('mpShoppingConnection')) {
      const banner = document.createElement('div');
      banner.id = 'mpShoppingConnection';
      banner.className = 'mp-connected-banner';
      banner.innerHTML = '<span>✓</span><div><strong>Lista gerada a partir do cardápio</strong>As quantidades abaixo representam os ingredientes consolidados das refeições da semana.</div>';
      shoppingHeading.insertAdjacentElement('afterend', banner);
    }
  }

  document.querySelectorAll('.tag').forEach((tag) => {
    tag.addEventListener('click', () => tag.classList.toggle('is-selected'));
  });

  document.querySelectorAll('.filter').forEach((filter) => {
    filter.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach((item) => item.classList.remove('is-active'));
      filter.classList.add('is-active');
      showToast('Filtro aplicado no preview.');
    });
  });

  const plannerForm = document.getElementById('plannerForm');
  const plannerResult = document.getElementById('plannerResult');
  const samplePlan = [
    { day: 'SEG', title: 'Frango crocante', side: 'Batatas + salada', time: '32 min', image: './assets/images/01-frango-crocante-batatas.png', alt: 'Frango crocante com batatas rústicas douradas' },
    { day: 'TER', title: 'Carne acebolada', side: 'Arroz + legumes', time: '30 min', image: './assets/images/02-carne-acebolada-arroz-legumes.png', alt: 'Carne acebolada com arroz e legumes coloridos' },
    { day: 'QUA', title: 'Macarrão cremoso', side: 'Tomate + queijo', time: '25 min', image: './assets/images/09-macarrao-cremoso-tomate-queijo.png', alt: 'Macarrão cremoso com tomate, queijo e manjericão' },
    { day: 'QUI', title: 'Omelete completa', side: 'Salada fresca', time: '18 min', image: './assets/images/10-omelete-completa-salada.png', alt: 'Omelete recheada com legumes acompanhada de salada fresca' },
    { day: 'SEX', title: 'Mini pizzas', side: 'Noite prática', time: '20 min', image: './assets/images/04-mini-pizzas-praticas.png', alt: 'Mini pizzas com queijo gratinado, tomate e ervas' },
    { day: 'SÁB', title: 'Frango barbecue', side: 'Batatas rústicas', time: '35 min', image: './assets/images/11-frango-barbecue-batatas-rusticas.png', alt: 'Frango ao molho barbecue servido com batatas rústicas' },
    { day: 'DOM', title: 'Arroz de forno', side: 'Reaproveitamento', time: '28 min', image: './assets/images/12-arroz-de-forno.png', alt: 'Arroz de forno com legumes e cobertura de queijo gratinado' }
  ];

  plannerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const button = plannerForm.querySelector('button[type="submit"]');
    const label = button.querySelector('.button-label');
    label.textContent = 'Montando sua semana…';
    button.disabled = true;

    setTimeout(() => {
      plannerResult.replaceChildren();
      const wrapper = document.createElement('div');
      wrapper.className = 'plan-result';

      const header = document.createElement('div');
      header.className = 'plan-result__header';
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = 'Plano pronto';
      const title = document.createElement('h3');
      title.textContent = 'Seu plano de 7 dias';
      const subtitle = document.createElement('p');
      subtitle.textContent = currentProfile ? `Gerado para ${profileSummary(currentProfile)}` : 'Foco em praticidade · orçamento e preferências considerados';
      header.append(eyebrow, title, subtitle);
      wrapper.append(header);

      samplePlan.forEach((day) => {
        const row = document.createElement('div');
        row.className = 'day-plan';
        const dayBadge = document.createElement('span');
        dayBadge.textContent = day.day;
        const thumbnail = document.createElement('div');
        thumbnail.className = 'day-plan__thumbnail';
        const image = document.createElement('img');
        image.src = day.image;
        image.alt = day.alt;
        image.width = 1448;
        image.height = 1086;
        image.loading = 'lazy';
        image.decoding = 'async';
        thumbnail.append(image);
        const meal = document.createElement('div');
        const mealTitle = document.createElement('strong');
        mealTitle.textContent = day.title;
        const mealSide = document.createElement('small');
        mealSide.textContent = day.side;
        meal.append(mealTitle, mealSide);
        const time = document.createElement('b');
        time.textContent = day.time;
        row.append(dayBadge, thumbnail, meal, time);
        wrapper.append(row);
      });

      const note = document.createElement('p');
      note.className = 'plan-note';
      note.textContent = '7 refeições selecionadas. O Mundo Prático já pode abrir as receitas e consolidar os ingredientes em uma lista única de compras.';
      wrapper.append(note);

      const actions = document.createElement('div');
      actions.className = 'mp-result-actions';
      const recipesButton = document.createElement('button');
      recipesButton.type = 'button';
      recipesButton.className = 'secondary';
      recipesButton.textContent = 'Ver receitas do plano';
      recipesButton.addEventListener('click', () => {
        setFlowStage(3);
        navigate('receitas');
        showToast('Receitas do plano carregadas.');
      });
      const shoppingButton = document.createElement('button');
      shoppingButton.type = 'button';
      shoppingButton.className = 'primary';
      shoppingButton.textContent = 'Abrir lista de compras →';
      shoppingButton.addEventListener('click', () => {
        setFlowStage(4);
        navigate('compras');
        showToast('Lista consolidada a partir das 7 refeições.');
      });
      actions.append(recipesButton, shoppingButton);
      wrapper.append(actions);

      plannerResult.append(wrapper);
      label.textContent = 'Gerar outro plano';
      button.disabled = false;
      setFlowStage(2);
      showToast('Plano semanal gerado e conectado às próximas etapas.');
    }, 650);
  });

  const recipeData = {
    'frango-crocante': {
      image: './assets/images/01-frango-crocante-batatas.png',
      alt: 'Frango crocante servido com batatas rústicas douradas',
      title: 'Frango crocante com batatas',
      meta: 'Air Fryer · 35 minutos',
      description: 'Exemplo de como a receita será apresentada no produto final.',
      ingredients: ['600 g de peito de frango', '700 g de batata', '2 colheres de azeite', 'Páprica, sal e alho'],
      steps: ['Tempere o frango e corte as batatas.', 'Preaqueça a Air Fryer a 200 °C.', 'Asse as batatas por 15 minutos.', 'Adicione o frango e finalize por 18–20 minutos.'],
    },
    'frango-cremoso': {
      image: './assets/images/07-frango-cremoso-gratinado.png',
      alt: 'Frango cremoso gratinado com muçarela dourada e ervas',
      title: 'Frango cremoso gratinado',
      meta: 'Air Fryer / forno · 28 minutos',
      description: 'Uma opção demonstrativa de frango com creme e queijo gratinado para almoço ou jantar.',
      ingredients: ['400 g de frango cozido e desfiado', '3 colheres de requeijão ou creme de leite', '100 g de muçarela', '1 dente de alho picado', 'Sal, pimenta e ervas a gosto'],
      steps: ['Misture o frango já cozido com o requeijão, o alho e os temperos.', 'Distribua em um recipiente próprio para o equipamento e cubra com a muçarela.', 'Gratine na Air Fryer a 180 °C por 10–12 minutos ou no forno preaquecido a 200 °C até dourar.', 'Sirva quando o recheio estiver bem aquecido e o queijo dourado.'],
    },
    'batatas-recheadas': {
      image: './assets/images/08-batatas-recheadas.png',
      alt: 'Batatas recheadas com creme, queijo dourado e ervas',
      title: 'Batatas recheadas',
      meta: 'Air Fryer / forno · 22 minutos',
      description: 'Batatas macias com recheio cremoso e queijo gratinado. Exemplo rápido usando batatas já cozidas.',
      ingredients: ['2 batatas grandes já cozidas', '2 colheres de requeijão', '80 g de queijo ralado', 'Azeite, sal e ervas a gosto'],
      steps: ['Corte as batatas cozidas ao meio e retire parte da polpa, mantendo a casca firme.', 'Amasse a polpa e misture com o requeijão, metade do queijo e as ervas.', 'Recheie as metades e cubra com o queijo restante.', 'Gratine na Air Fryer a 180 °C por 8–10 minutos ou no forno preaquecido a 200 °C até dourar.'],
    },
    'mini-pizza': {
      image: './assets/images/04-mini-pizzas-praticas.png',
      alt: 'Mini pizzas práticas com queijo gratinado, tomate e orégano',
      title: 'Mini pizza prática',
      meta: 'Lanche rápido · 18 minutos',
      description: 'Um lanche demonstrativo com bases prontas e ingredientes que já podem estar na geladeira.',
      ingredients: ['4 bases pequenas de pizza pré-assadas', '4 colheres de molho de tomate', '100 g de muçarela', '1 tomate em rodelas', 'Orégano a gosto'],
      steps: ['Distribua o molho de tomate sobre as bases pré-assadas.', 'Cubra com a muçarela, o tomate e o orégano.', 'Leve à Air Fryer a 180 °C por 6–8 minutos ou ao forno preaquecido a 200 °C até o queijo derreter.', 'Sirva assim que as bordas estiverem douradas.'],
    },
  };

  function openRecipe(recipeId) {
    const recipe = recipeData[recipeId];
    if (!recipe || !recipeModal) return;
    const image = recipeModal.querySelector('.modal-visual img');
    image.src = recipe.image;
    image.alt = recipe.alt;
    const copy = recipeModal.querySelector('.modal-copy');
    copy.querySelector('.eyebrow').textContent = recipe.meta;
    copy.querySelector('h2').textContent = recipe.title;
    copy.querySelector(':scope > p:not(.eyebrow)').textContent = recipe.description;
    const makeItems = (items) => items.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    });
    copy.querySelector('.modal-columns ul').replaceChildren(...makeItems(recipe.ingredients));
    copy.querySelector('.modal-columns ol').replaceChildren(...makeItems(recipe.steps));
    recipeModal.dataset.recipeId = recipeId;
    recipeModal.showModal();
    recipeModal.scrollTop = 0;
  }

  function bindRecipeButtons() {
    document.querySelectorAll('[data-open-recipe]').forEach((button) => {
      button.onclick = () => openRecipe(button.dataset.recipeId);
    });
  }
  bindRecipeButtons();

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => recipeModal?.close());
  });
  recipeModal?.addEventListener('click', (event) => {
    if (event.target === recipeModal) recipeModal.close();
  });

  function enhanceRecipeModal() {
    const copy = recipeModal?.querySelector('.modal-copy');
    if (!copy || copy.querySelector('.mp-recipe-actions')) return;
    const closeButton = copy.querySelector('[data-close-modal]');
    const actions = document.createElement('div');
    actions.className = 'mp-recipe-actions';
    actions.innerHTML = '<button type="button" data-recipe-action="plan">Adicionar ao meu cardápio</button><button type="button" data-recipe-action="shopping">Adicionar ingredientes à lista</button><button type="button" data-recipe-action="swap">Trocar esta refeição</button>';
    if (closeButton) closeButton.insertAdjacentElement('beforebegin', actions);
    else copy.appendChild(actions);

    actions.querySelector('[data-recipe-action="plan"]')?.addEventListener('click', () => {
      recipeModal.close();
      setFlowStage(3);
      navigate('planejar');
      showToast('Receita adicionada ao cardápio da semana.');
    });
    actions.querySelector('[data-recipe-action="shopping"]')?.addEventListener('click', () => {
      recipeModal.close();
      setFlowStage(4);
      navigate('compras');
      showToast('Ingredientes adicionados à lista de compras.');
    });
    actions.querySelector('[data-recipe-action="swap"]')?.addEventListener('click', () => {
      recipeModal.close();
      setFlowStage(3);
      navigate('receitas');
      showToast('Escolha outra receita para substituir esta refeição.');
    });
    if (closeButton) closeButton.textContent = 'Fechar receita';
  }
  enhanceRecipeModal();

  const ingredientForm = document.getElementById('ingredientForm');
  ingredientForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('ingredientInput');
    if (!input.value.trim()) {
      showToast('Digite pelo menos um ingrediente para testar.');
      input.focus();
      return;
    }
    setFlowStage(3);
    showToast(`Ideias simuladas usando: ${input.value.trim()}.`);
    document.querySelector('.recipe-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const shoppingList = document.getElementById('shoppingList');
  const checkedCount = document.getElementById('checkedCount');
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');

  function updateShopping() {
    const checkboxes = Array.from(shoppingList?.querySelectorAll('input[type="checkbox"]') || []);
    const checked = checkboxes.filter((input) => input.checked).length;
    const percent = checkboxes.length ? Math.round((checked / checkboxes.length) * 100) : 0;
    if (checkedCount) checkedCount.textContent = String(checked);
    if (progressText) progressText.textContent = percent + '%';
    if (progressBar) progressBar.style.width = percent + '%';
  }

  shoppingList?.addEventListener('change', () => {
    updateShopping();
    setFlowStage(4);
  });
  updateShopping();

  // Controle de instalação do PWA.
  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;

  function injectInstallStyles() {
    if (document.getElementById('mp-install-styles')) return;
    const style = document.createElement('style');
    style.id = 'mp-install-styles';
    style.textContent = `
      .mp-install-button{position:fixed;right:18px;top:18px;z-index:9998;border:0;border-radius:999px;padding:11px 16px;background:#28231f;color:#fff;font:700 13px/1.1 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 28px rgba(40,35,31,.22);cursor:pointer;display:flex;align-items:center;gap:8px}.mp-install-button:hover{transform:translateY(-1px)}.mp-install-button span{font-size:16px}
      .mp-ios-guide{position:fixed;inset:0;z-index:13000;background:rgba(31,27,24,.45);display:grid;align-items:end;padding:14px;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.mp-ios-guide__card{width:min(100%,520px);margin:0 auto;background:#fffdf9;border-radius:24px 24px 18px 18px;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -12px 50px rgba(40,35,31,.22);color:#28231f}.mp-ios-guide__top{display:flex;gap:14px;align-items:flex-start}.mp-ios-guide__icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px;background:#f6eee4;display:grid;place-items:center;font:700 22px Georgia,serif;border:1px solid rgba(40,35,31,.1)}.mp-ios-guide h3{margin:1px 0 6px;font:600 22px/1.05 Georgia,serif}.mp-ios-guide p{margin:0;color:#716961;font-size:14px;line-height:1.45}.mp-ios-steps{display:grid;gap:10px;margin:18px 0}.mp-ios-step{display:grid;grid-template-columns:32px 1fr;gap:11px;align-items:center;background:#f7f2ea;border-radius:14px;padding:11px 12px}.mp-ios-step b{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#d95c0b;color:#fff;font-size:13px}.mp-ios-step span{font-size:14px;line-height:1.3}.mp-ios-guide__actions{display:grid;grid-template-columns:1fr auto;gap:10px}.mp-ios-guide__actions button{border:0;border-radius:12px;padding:12px 16px;font-weight:750;cursor:pointer}.mp-ios-guide__ok{background:#28231f;color:#fff}.mp-ios-guide__later{background:#f0ece6;color:#514941}.mp-ios-arrow{text-align:center;font-size:13px;color:#716961;margin-top:11px!important}.mp-ios-arrow strong{color:#d95c0b}
      @media(max-width:760px){.mp-install-button{top:auto;right:14px;bottom:78px;padding:12px 15px}}
    `;
    document.head.appendChild(style);
  }

  function showIOSInstallGuide() {
    if (!isiOS || isStandalone || document.querySelector('.mp-ios-guide') || document.querySelector('.mp-onboarding')) return;
    injectInstallStyles();

    const overlay = document.createElement('div');
    overlay.className = 'mp-ios-guide';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Como instalar o Mundo Prático no iPhone');
    overlay.innerHTML = `
      <div class="mp-ios-guide__card">
        <div class="mp-ios-guide__top">
          <div class="mp-ios-guide__icon">M</div>
          <div><h3>Use como um app no iPhone</h3><p>Leva poucos segundos e depois o Mundo Prático abre em tela cheia, direto pela sua Tela de Início.</p></div>
        </div>
        <div class="mp-ios-steps">
          <div class="mp-ios-step"><b>1</b><span>Toque no botão <strong>Compartilhar</strong> do Safari.</span></div>
          <div class="mp-ios-step"><b>2</b><span>Escolha <strong>Adicionar à Tela de Início</strong>.</span></div>
          <div class="mp-ios-step"><b>3</b><span>Confirme em <strong>Adicionar</strong>.</span></div>
        </div>
        <div class="mp-ios-guide__actions"><button class="mp-ios-guide__ok" type="button">Entendi</button><button class="mp-ios-guide__later" type="button">Agora não</button></div>
        <p class="mp-ios-arrow">Depois, abra pelo ícone <strong>Mundo Prático</strong> na Tela de Início.</p>
      </div>`;

    const closeGuide = () => {
      overlay.remove();
      try { sessionStorage.setItem('mp-ios-guide-seen', '1'); } catch (_) {}
    };
    overlay.querySelector('.mp-ios-guide__ok')?.addEventListener('click', closeGuide);
    overlay.querySelector('.mp-ios-guide__later')?.addEventListener('click', closeGuide);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeGuide();
    });
    document.body.appendChild(overlay);
  }

  function createInstallButton() {
    if (isStandalone) return null;
    injectInstallStyles();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mp-install-button';
    button.setAttribute('aria-label', 'Instalar Mundo Prático');
    button.innerHTML = '<span>↓</span> Instalar app';
    document.body.appendChild(button);
    return button;
  }

  const installButton = createInstallButton();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.innerHTML = '<span>↓</span> Instalar app';
  });

  installButton?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      return;
    }

    if (isiOS) {
      showIOSInstallGuide();
    } else if (isEdge) {
      alert('No Microsoft Edge: abra o menu ⋯, escolha “Apps” e depois “Instalar Mundo Prático”.');
    } else if (isChrome) {
      alert('No Chrome: abra o menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.');
    } else {
      alert('Use o menu do navegador e procure “Instalar app” ou “Adicionar à tela inicial”.');
    }
  });

  window.addEventListener('appinstalled', () => {
    installButton?.remove();
    showToast('Mundo Prático instalado.');
  });

  currentProfile = loadProfile();
  if (currentProfile) {
    flowStage = 1;
    applyProfile(currentProfile);
  }
  addResetProfileButton();
  installFlowStrips();
  ensureConnectedBanners();

  if (!currentProfile) {
    setTimeout(() => showOnboarding(), 350);
  } else if (isiOS && !isStandalone) {
    let guideSeen = false;
    try { guideSeen = sessionStorage.getItem('mp-ios-guide-seen') === '1'; } catch (_) {}
    if (!guideSeen) setTimeout(showIOSInstallGuide, 1100);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
