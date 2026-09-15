(() => {
  'use strict';

  const views = Array.from(document.querySelectorAll('[data-view]'));
  const navButtons = Array.from(document.querySelectorAll('[data-nav]'));
  const toast = document.getElementById('toast');
  const recipeModal = document.getElementById('recipeModal');
  const PROFILE_KEY = 'mp-preview-profile-v1';
  let flowStage = 0;
  let currentProfile = null;
  let dataModule = null;
  let realMode = false;
  let accountId = null;
  let realCatalog = [];
  let latestPlan = null;
  const realRecipes = new Map();
  const demoMarkup = Object.fromEntries(['recipeGrid', 'shoppingList'].map((id) => [id, document.getElementById(id)?.innerHTML]));
  const demoHero = document.querySelector('.hero-card')?.innerHTML;
  const demoMeals = document.querySelector('.meal-grid')?.innerHTML;
  const backendReady = initializeBackend();

  function budgetAmount(value) {
    if (value == null || value === '' || /sem limite/i.test(String(value))) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const digits = String(value).replace(/[^\d.,]/g, '');
    const normalized = digits.includes(',') ? digits.replace(/\./g, '').replace(',', '.') : digits;
    return normalized ? Number(normalized) : null;
  }

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100);
  }

  function request(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Mundo Prático request timed out')), 20000);
    })]).finally(() => clearTimeout(timer));
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function photo(path, title) {
    const image = document.createElement('img');
    image.src = path;
    image.alt = title;
    image.width = 1448;
    image.height = 1086;
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
  }

  function equipmentLabel(values = []) {
    const labels = { air_fryer: 'Air Fryer', fogao: 'Fogão', forno: 'Forno' };
    return values.map((value) => labels[value] || value).join(' / ');
  }

  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function mealDay(value) {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(value + 'T12:00:00')).replace('.', '').toUpperCase();
  }

  function setDataMode(session) {
    realMode = Boolean(session?.user && session.hasAccess === true);
    accountId = realMode ? session.user.id : null;
    document.body.dataset.dataMode = realMode ? 'real' : 'demo';
    let status = document.getElementById('mpDataMode');
    if (!status) {
      status = element('p', '', 'mp-data-mode');
      status.id = 'mpDataMode';
      status.setAttribute('role', 'status');
      document.querySelector('.main').prepend(status);
    }
    status.textContent = realMode ? 'Dados salvos na sua conta' : 'Modo demonstração';
    const tag = document.querySelector('.prototype-tag');
    if (tag) tag.textContent = realMode ? 'Sua conta · Mundo Prático' : 'Preview · Modo demonstração';
    const pill = document.querySelector('.prototype-pill');
    if (pill) pill.textContent = realMode ? 'Minha conta' : 'Demo';
    const description = document.querySelector('#view-compras .page-heading > p:last-child');
    if (description) description.textContent = realMode ? 'Lista consolidada do seu cardápio, salva na sua conta.' : 'Gerada a partir do cardápio. Neste preview, os dados ficam apenas no navegador.';
    const tip = document.querySelector('.tip-card > p:not(.eyebrow)');
    if (tip) tip.textContent = realMode ? 'Marque o que já possui antes de ir ao mercado. Os valores do cardápio são estimativas, não preços garantidos do supermercado.' : 'Marque o que já possui antes de ir ao mercado. No produto final, o valor estimado será recalculado automaticamente.';
    const refresh = document.getElementById('mpRefreshShopping');
    if (refresh) refresh.hidden = !realMode;
    if (currentProfile) applyProfile(currentProfile);
    else {
      const subtitle = document.querySelector('#view-planejar .page-heading > p:last-child');
      if (subtitle) subtitle.textContent = realMode ? 'Defina suas preferências para gerar e salvar seu cardápio.' : 'Experimente a geração do cardápio no modo demonstração.';
    }
  }

  function returnToDemo() {
    latestPlan = null;
    realCatalog = [];
    realRecipes.clear();
    setDataMode(null);
    recipeModal?.close();
    Object.entries(demoMarkup).forEach(([id, html]) => { document.getElementById(id).innerHTML = html; });
    document.querySelector('.hero-card').innerHTML = demoHero;
    document.querySelector('.hero-card').hidden = false;
    document.querySelector('.meal-grid').innerHTML = demoMeals;
    document.getElementById('shoppingEstimate').textContent = 'R$ 187';
    plannerResult.replaceChildren(element('p', 'Gere um plano para experimentar o preview.', 'plan-note'));
    bindRecipeButtons();
    document.querySelector('.hero-card [data-nav]').addEventListener('click', () => navigate('planejar'));
    updateShopping();
  }

  function reportBackendError(error, message) {
    console.error('Mundo Prático:', error);
    if (error.code === 'MP_ACCESS_LOST' || error.status === 401 || error.code === 'PGRST301') {
      returnToDemo();
      showToast('Sua sessão ou acesso não está ativo. Entre novamente para usar sua conta.');
    } else showToast(message);
  }

  async function requireRealSession() {
    const session = await request(dataModule.getMundoPraticoSession());
    if (!session.user || !session.hasAccess || session.user.id !== accountId) {
      const error = new Error('Session or entitlement unavailable');
      error.code = 'MP_ACCESS_LOST';
      throw error;
    }
    return session;
  }

  async function initializeBackend() {
    if (!navigator.onLine) { setDataMode(null); return; }
    try {
      dataModule = await request(import('./mp-data.js'));
      const session = await request(dataModule.getMundoPraticoSession());
      setDataMode(session);
      if (!realMode) return;
      document.getElementById('shoppingList').replaceChildren(element('p', 'Gere seu plano para criar a lista de compras.', 'plan-note'));
      document.getElementById('shoppingEstimate').textContent = '—';
      document.querySelector('.meal-grid').replaceChildren(element('p', 'Gere seu plano para ver as próximas refeições.', 'plan-note'));
      updateShopping();
      await loadRealCatalog();
    } catch (error) {
      console.error('Mundo Prático: inicialização', error);
      if (!realMode) setDataMode(null);
      else catalogError();
    }
  }

  function catalogError() {
    const grid = document.getElementById('recipeGrid');
    const retry = element('button', 'Tentar carregar receitas novamente', 'button button--secondary');
    retry.type = 'button';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      try { await requireRealSession(); await loadRealCatalog(); }
      catch (error) { reportBackendError(error, 'Não foi possível carregar as receitas. Tente novamente.'); }
      finally { retry.disabled = false; }
    });
    grid.replaceChildren(element('p', 'Não foi possível carregar o catálogo.', 'plan-note'), retry);
    showToast('Não foi possível carregar as receitas. Tente novamente.');
  }

  async function ensureCatalog() {
    if (!realCatalog.length) {
      realCatalog = await request(dataModule.loadRecipeCatalog());
      realCatalog.forEach((recipe) => realRecipes.set(recipe.id, recipe));
    }
    return realCatalog;
  }

  async function loadRealCatalog() {
    try {
      const catalog = await ensureCatalog();
      renderCatalog(catalog);
      if (catalog.length) renderHomeRecipe(catalog[0]);
      else document.querySelector('.hero-card').hidden = true;
    } catch (error) {
      console.error('Mundo Prático: catálogo', error);
      document.querySelector('.hero-card').hidden = true;
      catalogError();
    }
  }

  function filteredCatalog(label) {
    if (label === 'Até 30 min') return realCatalog.filter((recipe) => recipe.prep_minutes + recipe.cook_minutes <= 30);
    if (label === 'Air Fryer') return realCatalog.filter((recipe) => recipe.equipment.includes('air_fryer'));
    if (label === 'Econômicas') return [...realCatalog].sort((a, b) => a.estimated_cost_cents - b.estimated_cost_cents);
    return realCatalog;
  }

  function renderCatalog(recipes) {
    const grid = document.getElementById('recipeGrid');
    grid.replaceChildren();
    if (!recipes.length) grid.append(element('p', 'Nenhuma receita encontrada.', 'plan-note'));
    recipes.forEach((recipe) => {
      realRecipes.set(recipe.id, recipe);
      const card = element('article', null, 'recipe-card');
      const frame = element('div', null, 'recipe-photo');
      const minutes = Number(recipe.prep_minutes || 0) + Number(recipe.cook_minutes || 0);
      frame.append(photo(recipe.image_path, recipe.title), element('span', `${minutes} min`));
      const body = element('div', null, 'recipe-body');
      body.append(element('p', equipmentLabel(recipe.equipment), 'eyebrow'), element('h3', recipe.title), element('p', recipe.description));
      body.append(element('p', `Custo estimado: ${money(recipe.estimated_cost_cents)}`, 'mp-recipe-cost'));
      if (recipe.matched_ingredients != null) body.append(element('p', `${recipe.matched_ingredients} de ${recipe.total_required_ingredients} ingredientes encontrados`, 'mp-recipe-match'));
      const button = element('button', 'Ver receita →', 'text-button');
      button.type = 'button';
      button.dataset.openRecipe = '';
      button.dataset.recipeId = recipe.id;
      button.addEventListener('click', () => openRecipe(recipe.id));
      body.append(button);
      card.append(frame, body);
      grid.append(card);
    });
  }

  function modalRecipe(recipe) {
    return {
      image: recipe.image_path, alt: recipe.title, title: recipe.title,
      meta: `${equipmentLabel(recipe.equipment)} · ${Number(recipe.prep_minutes || 0) + Number(recipe.cook_minutes || 0)} minutos · ${recipe.servings} porções`,
      description: recipe.description,
      ingredients: (recipe.mp_recipe_ingredients || []).map((item) => `${new Intl.NumberFormat('pt-BR').format(item.quantity)} ${item.unit} de ${item.mp_ingredients.name}${item.is_optional ? ' (opcional)' : ''}`),
      steps: Array.isArray(recipe.instructions) ? recipe.instructions : String(recipe.instructions || '').split('\n').filter(Boolean),
    };
  }

  function renderHomeRecipe(recipe) {
    const hero = document.querySelector('.hero-card');
    hero.hidden = false;
    hero.querySelector('h2').textContent = recipe.title;
    hero.querySelector('.hero-card__copy > p').textContent = recipe.description;
    hero.querySelector('.chip').textContent = latestPlan ? 'Seu cardápio' : 'Do seu catálogo';
    const image = hero.querySelector('img');
    image.src = recipe.image_path;
    image.alt = recipe.title;
    hero.querySelector('.meal-meta').replaceChildren(element('span', `${Number(recipe.prep_minutes || 0) + Number(recipe.cook_minutes || 0)} min`), element('span', `${recipe.servings} porções`), element('span', equipmentLabel(recipe.equipment)));
    hero.querySelector('[data-open-recipe]').dataset.recipeId = recipe.id;
    bindRecipeButtons();
  }

  function readPlannerProfile() {
    const selected = (selector) => Array.from(plannerForm.querySelectorAll(selector)).map((input) => plannerForm.querySelector(`label[for="${input.id}"]`).textContent);
    return { people: document.getElementById('people').value, budget: budgetAmount(document.getElementById('budget').value), goal: selected('input[name="goal"]:checked')[0], equipment: selected('.choice-grid input[type="checkbox"]:checked'), avoid: Array.from(plannerForm.querySelectorAll('.tag.is-selected')).map((tag) => tag.textContent.replace('×', '').trim()) };
  }

  async function generateRealPlan() {
    plannerForm.querySelector('.button-label').textContent = 'Salvando seu plano…';
    await requireRealSession();
    const profile = readPlannerProfile();
    const result = await request(dataModule.generateWeekPlan({
      startDate: localDate(), householdSize: parseInt(profile.people, 10),
      budgetCents: profile.budget == null ? null : Math.round(profile.budget * 100),
      goal: { Praticidade: 'praticidade', Economia: 'economia', 'Mais variedade': 'variedade' }[profile.goal],
      equipment: profile.equipment, avoidItems: profile.avoid,
    }));
    if (!Array.isArray(result?.meals) || result.meals.length !== 7 || !Array.isArray(result.shopping_items)) throw new Error('Unexpected week plan response');
    latestPlan = result;
    saveProfile(profile);
    const wrapper = element('div', null, 'plan-result');
    const header = element('div', null, 'plan-result__header');
    header.append(element('p', 'Plano salvo', 'eyebrow'), element('h3', 'Seu plano de 7 dias'), element('p', `${result.household_size} pessoas · ${result.start_date} a ${result.end_date}`));
    header.append(element('p', `Orçamento informado: ${result.budget_cents == null ? 'Sem limite definido' : money(result.budget_cents)}`), element('p', `Custo estimado do cardápio: ${money(result.estimated_cost_cents)}`), element('p', `Margem restante: ${result.budget_cents == null ? 'Não definida' : money(result.budget_cents - result.estimated_cost_cents)}`));
    if (result.within_budget === false) header.append(element('p', 'Este cardápio ficou acima do orçamento.', 'mp-budget-warning'));
    wrapper.append(header);
    result.meals.forEach((meal) => {
      const row = element('div', null, 'day-plan');
      const frame = element('div', null, 'day-plan__thumbnail');
      frame.append(photo(meal.image_path, meal.title));
      const copy = element('div');
      const description = element('small', meal.description, 'day-plan__description');
      description.title = meal.description;
      copy.append(element('strong', meal.title), description, element('small', `${meal.servings} porções · custo estimado ${money(meal.estimated_cost_cents)}`, 'day-plan__details'));
      row.append(element('span', mealDay(meal.meal_date)), frame, copy, element('b', `${meal.total_minutes} min`));
      wrapper.append(row);
    });
    const actions = element('div', null, 'mp-result-actions');
    const recipes = element('button', 'Ver receitas do plano', 'secondary');
    recipes.type = 'button';
    recipes.addEventListener('click', async () => {
      recipes.disabled = true;
      try {
        await requireRealSession();
        await ensureCatalog();
        const selected = [...new Set(latestPlan.meals.map((meal) => meal.recipe_id))].map((id) => realRecipes.get(id)).filter(Boolean);
        renderCatalog(selected);
        setFlowStage(3);
        navigate('receitas');
      } catch (error) { reportBackendError(error, 'Não foi possível carregar as receitas do plano.'); }
      finally { recipes.disabled = false; }
    });
    const shopping = element('button', 'Abrir lista de compras →', 'primary');
    shopping.type = 'button';
    shopping.addEventListener('click', () => { setFlowStage(4); navigate('compras'); });
    actions.append(recipes, shopping);
    wrapper.append(actions, element('p', 'Custos estimados. Os preços podem variar no supermercado.', 'plan-note'));
    plannerResult.replaceChildren(wrapper);
    renderShopping(result.shopping_items);
    document.querySelector('.meal-grid').replaceChildren();
    result.meals.slice(1, 4).forEach((meal) => {
      const card = element('article', null, 'meal-card');
      const frame = element('div', null, 'meal-card__image');
      frame.append(photo(meal.image_path, meal.title));
      card.append(element('span', mealDay(meal.meal_date), 'day'), frame, element('h3', meal.title), element('p', meal.description), element('small', `${meal.total_minutes} min · ${meal.servings} porções`));
      document.querySelector('.meal-grid').append(card);
    });
    if (realRecipes.has(result.meals[0].recipe_id)) renderHomeRecipe({ ...realRecipes.get(result.meals[0].recipe_id), ...result.meals[0], id: result.meals[0].recipe_id });
    setFlowStage(2);
    showToast('Plano e lista de compras salvos na sua conta.');
  }

  function renderShopping(items) {
    shoppingList.replaceChildren();
    const groups = new Map();
    const categories = { hortifruti: 'Hortifruti', proteinas: 'Carnes e proteínas', carnes: 'Carnes e proteínas', laticinios: 'Laticínios', despensa: 'Despensa', temperos: 'Temperos' };
    items.forEach((item) => {
      const category = item.category || item.mp_ingredients?.category || 'Outros';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });
    groups.forEach((items, category) => {
      const group = element('div', null, 'list-group');
      const title = element('div', null, 'list-group__title');
      title.append(element('strong', categories[category] || category), element('small', `${items.length} itens`));
      group.append(title);
      items.forEach((item) => {
        const label = element('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(item.is_checked);
        input.dataset.itemId = item.id;
        label.append(input, element('span', item.item_name), element('b', `${new Intl.NumberFormat('pt-BR').format(item.quantity)} ${item.unit}`));
        group.append(label);
      });
      shoppingList.append(group);
    });
    if (!items.length) shoppingList.append(element('p', 'Sua lista está vazia.', 'plan-note'));
    document.getElementById('shoppingEstimate').textContent = latestPlan ? money(latestPlan.estimated_cost_cents) : '—';
    updateShopping();
  }

  async function refreshRealShopping() {
    if (!latestPlan) { showToast('Gere um plano para criar sua lista de compras.'); return; }
    try {
      await requireRealSession();
      latestPlan.shopping_items = await request(dataModule.loadShoppingList(latestPlan.shopping_list_id));
      renderShopping(latestPlan.shopping_items);
      showToast('Lista do último plano carregada. Para incluir outra receita, gere um novo cardápio.');
    } catch (error) { reportBackendError(error, 'Não foi possível carregar a lista. Tente novamente.'); }
  }

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
      const profile = saved ? JSON.parse(saved) : null;
      if (!profile || typeof profile !== 'object' || !Array.isArray(profile.equipment) || !Array.isArray(profile.avoid)) return null;
      return { ...profile, budget: budgetAmount(profile.budget) };
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
    return `${profile.people} · ${profile.budget == null ? 'sem limite definido' : money(Math.round(profile.budget * 100))} · foco em ${profile.goal.toLowerCase()} · ${equipment}`;
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
      budget.value = profile.budget == null ? '' : String(budgetAmount(profile.budget));
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
    if (note) note.textContent = `${realMode ? 'Suas preferências' : 'Sugestões simuladas para você'}: ${profileSummary(profile)}.${realMode ? '' : ' Modo demonstração.'}`;

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
          <label style="display:block;margin-top:20px;font-weight:800;font-size:13px">Quanto quer gastar com alimentação nesta semana?<div class="mp-money-field"><span aria-hidden="true">R$</span><input class="mp-onboarding__select" id="obBudget" type="number" min="0" max="21474836.47" step="0.01" inputmode="decimal" value="250" placeholder="250,00" aria-label="Orçamento semanal em reais"></div><small>Deixe vazio para não definir um limite.</small></label>
        </section>
        <section class="mp-step" data-step="2">
          <p class="eyebrow">3 de 4 · sua cozinha</p><h2>Quais equipamentos você quer usar?</h2><p>Marque um ou mais. As receitas serão compatíveis com sua rotina.</p>
          <div class="mp-choice-list">
            ${['Air Fryer','Fogão','Forno'].map((item, index) => `<div class="mp-choice"><input type="checkbox" name="obEquipment" id="obe${index}" value="${item}" ${index < 2 ? 'checked' : ''}><label for="obe${index}">${item}</label></div>`).join('')}
          </div>
        </section>
        <section class="mp-step" data-step="3">
          <p class="eyebrow">4 de 4 · preferências</p><h2>Tem algo que prefere evitar?</h2><p>Você pode alterar isso depois. Essas escolhas orientam a seleção das refeições.</p>
          <div class="mp-choice-list">
            ${['Peixe','Carne suína','Leite','Glúten'].map((item, index) => `<div class="mp-choice"><input type="checkbox" name="obAvoid" id="oba${index}" value="${item}" ${item === 'Peixe' ? 'checked' : ''}><label for="oba${index}">${item}</label></div>`).join('')}
          </div>
          <p class="mp-demo-note">As preferências ficam neste navegador. Ao gerar um plano com acesso ativo, os dados são salvos na sua conta.</p>
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
      if (step === 1 && !overlay.querySelector('#obBudget').reportValidity()) return;
      if (step < steps.length - 1) {
        step += 1;
        updateStep();
        return;
      }
      const people = overlay.querySelector('input[name="obPeople"]:checked')?.value || '4 pessoas';
      const goal = overlay.querySelector('input[name="obGoal"]:checked')?.value || 'Praticidade';
      const budget = budgetAmount(overlay.querySelector('#obBudget')?.value);
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
      const refresh = element('button', 'Atualizar lista', 'button button--secondary');
      refresh.id = 'mpRefreshShopping';
      refresh.type = 'button';
      refresh.hidden = !realMode;
      refresh.addEventListener('click', async () => {
        if (refresh.disabled) return;
        refresh.disabled = true;
        try { await refreshRealShopping(); }
        finally { refresh.disabled = false; }
      });
      banner.querySelector('div').append(refresh);
    }
  }

  document.querySelectorAll('.tag').forEach((tag) => {
    tag.addEventListener('click', () => tag.classList.toggle('is-selected'));
  });

  document.querySelectorAll('.filter').forEach((filter) => {
    filter.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach((item) => item.classList.remove('is-active'));
      filter.classList.add('is-active');
      if (realMode) renderCatalog(filteredCatalog(filter.textContent));
      else showToast('Filtro aplicado no preview.');
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

  plannerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = plannerForm.querySelector('button[type="submit"]');
    const label = button.querySelector('.button-label');
    if (button.disabled) return;
    const originalLabel = label.textContent;
    button.disabled = true;
    try {
      await backendReady;
      if (realMode) {
        await generateRealPlan();
        label.textContent = 'Gerar outro plano';
        return;
      }
    } catch (error) {
      reportBackendError(error, 'Não foi possível gerar o plano. Tente novamente.');
      label.textContent = originalLabel;
      return;
    } finally {
      button.disabled = false;
    }
    saveProfile(readPlannerProfile());
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
    const source = realMode ? realRecipes.get(recipeId) : null;
    const recipe = realMode ? (source ? modalRecipe(source) : null) : recipeData[recipeId];
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
      showToast(realMode ? 'Ajuste suas preferências e gere o cardápio para salvar na conta.' : 'Receita adicionada ao cardápio da semana.');
    });
    actions.querySelector('[data-recipe-action="shopping"]')?.addEventListener('click', async () => {
      recipeModal.close();
      setFlowStage(4);
      navigate('compras');
      if (realMode) await refreshRealShopping();
      else showToast('Ingredientes adicionados à lista de compras.');
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
  ingredientForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('ingredientInput');
    if (!input.value.trim()) {
      showToast('Digite pelo menos um ingrediente para testar.');
      input.focus();
      return;
    }
    const button = ingredientForm.querySelector('button');
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    try {
      await backendReady;
      if (realMode) {
        button.textContent = 'Buscando receitas…';
        await requireRealSession();
        const ingredients = input.value.split(',').map((value) => value.trim()).filter(Boolean);
        const matches = await request(dataModule.findRecipesByIngredients(ingredients));
        const catalog = await ensureCatalog();
        const recipes = matches.map((match) => ({ ...catalog.find((recipe) => recipe.id === match.recipe_id), ...match, id: match.recipe_id }));
        renderCatalog(recipes);
        setFlowStage(3);
        showToast(recipes.length ? `${recipes.length} receitas encontradas.` : 'Nenhuma receita encontrada com esses ingredientes.');
        return;
      }
    } catch (error) {
      reportBackendError(error, 'Não foi possível buscar receitas. Tente novamente.');
      return;
    } finally {
      button.disabled = false;
      button.textContent = label;
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
    document.getElementById('shoppingTotal').textContent = `de ${checkboxes.length} itens separados`;
    const shortcut = document.querySelector('.quick-card[data-nav="compras"] small');
    if (shortcut) shortcut.textContent = `${checked} de ${checkboxes.length} itens separados`;
  }

  shoppingList?.addEventListener('change', async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
    const checked = input.checked;
    updateShopping();
    setFlowStage(4);
    if (!realMode) return;
    input.disabled = true;
    try {
      await requireRealSession();
      const saved = await request(dataModule.setShoppingItemChecked(input.dataset.itemId, checked));
      input.checked = saved.is_checked;
      const item = latestPlan?.shopping_items.find((item) => item.id === input.dataset.itemId);
      if (item) item.is_checked = saved.is_checked;
    } catch (error) {
      input.checked = !checked;
      reportBackendError(error, 'Não foi possível salvar este item. Tente novamente.');
    } finally {
      input.disabled = false;
      updateShopping();
    }
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
