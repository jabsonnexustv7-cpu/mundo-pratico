(() => {
  'use strict';

  const views = Array.from(document.querySelectorAll('[data-view]'));
  const navButtons = Array.from(document.querySelectorAll('[data-nav]'));
  const toast = document.getElementById('toast');
  const recipeModal = document.getElementById('recipeModal');

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
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
    ['SEG', 'Frango crocante', 'Batatas + salada', '32 min'],
    ['TER', 'Carne acebolada', 'Arroz + legumes', '30 min'],
    ['QUA', 'Macarrão cremoso', 'Tomate + queijo', '25 min'],
    ['QUI', 'Omelete completa', 'Salada fresca', '18 min'],
    ['SEX', 'Mini pizzas', 'Noite prática', '20 min'],
    ['SÁB', 'Frango barbecue', 'Batatas rústicas', '35 min'],
    ['DOM', 'Arroz de forno', 'Reaproveitamento', '28 min']
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
      subtitle.textContent = 'Foco em praticidade · orçamento e preferências considerados';
      header.append(eyebrow, title, subtitle);
      wrapper.append(header);

      samplePlan.forEach((day) => {
        const row = document.createElement('div');
        row.className = 'day-plan';
        const dayBadge = document.createElement('span');
        dayBadge.textContent = day[0];
        const meal = document.createElement('div');
        const mealTitle = document.createElement('strong');
        mealTitle.textContent = day[1];
        const mealSide = document.createElement('small');
        mealSide.textContent = day[2];
        meal.append(mealTitle, mealSide);
        const time = document.createElement('b');
        time.textContent = day[3];
        row.append(dayBadge, meal, time);
        wrapper.append(row);
      });

      const note = document.createElement('p');
      note.className = 'plan-note';
      note.textContent = 'No produto final, este plano poderá ser salvo, editado refeição por refeição e transformado em lista de compras automaticamente.';
      wrapper.append(note);
      plannerResult.append(wrapper);
      label.textContent = 'Gerar outro plano';
      button.disabled = false;
      showToast('Plano semanal gerado com dados simulados.');
    }, 650);
  });

  function bindRecipeButtons() {
    document.querySelectorAll('[data-open-recipe]').forEach((button) => {
      button.onclick = () => recipeModal?.showModal();
    });
  }
  bindRecipeButtons();

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => recipeModal?.close());
  });
  recipeModal?.addEventListener('click', (event) => {
    if (event.target === recipeModal) recipeModal.close();
  });

  const ingredientForm = document.getElementById('ingredientForm');
  ingredientForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('ingredientInput');
    if (!input.value.trim()) {
      showToast('Digite pelo menos um ingrediente para testar.');
      input.focus();
      return;
    }
    showToast('Simulação: no produto final, a IA gerará receitas com esses ingredientes.');
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
    checkedCount.textContent = String(checked);
    progressText.textContent = percent + '%';
    progressBar.style.width = percent + '%';
  }

  shoppingList?.addEventListener('change', updateShopping);
  updateShopping();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
