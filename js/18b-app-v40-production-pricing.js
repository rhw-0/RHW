/* ==========================================================================
   RHW WEB APP · V4.0 PRODUCTION → CALCULATOR BRIDGE
   Adds production costing shortcuts without changing calculator price inputs.
   Material prices remain manual/local-only.
   ========================================================================== */
(function initRhwV4ProductionCalculatorBridge() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || !app.operations) return;
  if (app.productionPricing) return;

  const STYLE_ID = 'rhwV40ProductionPricingStyle';
  let productionObserver = null;

  const normalize = value => app.util.normalize(String(value || ''));

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .production-calc-button{
        display:inline-flex;align-items:center;justify-content:center;margin-top:8px;min-height:27px;padding:5px 9px;
        border:1px solid rgba(212,175,55,.30);background:rgba(212,175,55,.075);color:#e7c963;box-shadow:none;
        font-family:var(--font-tech);font-size:9px;font-weight:700;letter-spacing:.08em;line-height:1.2;cursor:pointer
      }
      .production-calc-button:hover,.production-calc-button:focus-visible{background:rgba(212,175,55,.14);color:#f3d77b;border-color:rgba(212,175,55,.52)}
      @media (min-width:1200px){.production-calc-button{font-size:9.5px}}
      @media (max-width:700px){.production-calc-button{width:100%;margin-top:7px}}
    `;
    document.head.appendChild(style);
  }

  function recipeDisplayName(recipe) {
    if (!recipe) return '';
    const alias = app.operations?.recipeAliases?.[recipe.id];
    const output = recipe.outputs?.[0];
    const product = output ? core.product(output.id) : null;
    return alias?.name || product?.name || output?.name || recipe.name || recipe.id || '';
  }

  function findRecipeForLabel(label) {
    const target = normalize(label);
    if (!target || !core.state.catalog) return null;
    const recipes = [...(core.state.catalog.recipes || [])];
    const scored = recipes.map(recipe => {
      const output = recipe.outputs?.[0];
      const product = output ? core.product(output.id) : null;
      const names = [recipeDisplayName(recipe), product?.name, output?.name, recipe.name, recipe.id]
        .filter(Boolean)
        .map(normalize);
      let score = 99;
      if (names.some(name => name === target)) score = 0;
      else if (names.some(name => name.startsWith(target) || target.startsWith(name))) score = 1;
      else if (names.some(name => name.includes(target) || target.includes(name))) score = 2;
      return { recipe, score };
    }).filter(entry => entry.score < 99);
    scored.sort((a, b) => a.score - b.score || recipeDisplayName(a.recipe).localeCompare(recipeDisplayName(b.recipe)) || a.recipe.id.localeCompare(b.recipe.id));
    return scored[0]?.recipe || null;
  }

  function saveCalculatorTarget(recipe, quantity = 1) {
    const output = recipe?.outputs?.[0];
    if (!recipe || !output) return false;
    const current = app.state.calculator || {};
    app.state.calculator = {
      ...current,
      productId: output.id,
      recipeId: recipe.id,
      quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
      search: recipeDisplayName(recipe)
    };
    app.store.set(app.config.storageKeys.calculatorState, app.state.calculator);
    return true;
  }

  function openProductionTarget(label, quantity = 1) {
    const recipe = findRecipeForLabel(label);
    if (!recipe || !saveCalculatorTarget(recipe, quantity)) {
      app.notify?.(`NO CALCULATOR RECIPE FOUND // ${String(label || 'UNKNOWN TARGET').toUpperCase()}`, 'warn');
      return false;
    }
    app.navigate('operations', 'calculator');
    app.operations.renderCalculator?.();
    return true;
  }

  function enhanceProduction() {
    const mount = document.getElementById('productionGrid');
    if (!mount) return;
    mount.querySelectorAll('.production-card').forEach(card => {
      if (card.querySelector('.production-calc-button')) return;
      const title = card.querySelector('.production-title');
      if (!title) return;
      const label = title.textContent.trim();
      if (!findRecipeForLabel(label)) return;
      const host = card.querySelector('.production-card-head > div') || title.parentElement;
      if (!host) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'production-calc-button';
      button.dataset.productionCostTarget = label;
      button.textContent = 'COST / CALCULATE';
      button.title = `Open ${label} in the RHW Item Calculator`;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openProductionTarget(label, 1);
      });
      host.appendChild(button);
    });
  }

  function installProductionObserver() {
    const mount = document.getElementById('productionGrid');
    if (!mount) return;
    enhanceProduction();
    if (mount.dataset.v40ProductionCalculatorBridge === 'true') return;
    mount.dataset.v40ProductionCalculatorBridge = 'true';
    productionObserver = new MutationObserver(enhanceProduction);
    productionObserver.observe(mount, { childList: true, subtree: true });
  }

  function install() {
    installStyles();
    installProductionObserver();
  }

  function selfTest() {
    const failures = [];
    try {
      if (typeof RECIPES !== 'undefined') {
        RECIPES.forEach(recipe => {
          if (!findRecipeForLabel(recipe.product)) failures.push(`production-recipe:${recipe.product}`);
        });
      }
    } catch {
      failures.push('production-recipe-scan');
    }
    return failures;
  }

  const originalInit = app.operations.init;
  app.operations.init = async function productionBridgeAwareInit(...args) {
    const result = await originalInit.apply(this, args);
    install();
    return result;
  };

  app.productionPricing = {
    install,
    enhanceProduction,
    openProductionTarget,
    findRecipeForLabel,
    selfTest
  };
})();