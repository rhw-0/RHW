/* ==========================================================================
   RHW WEB APP · V4.0 RECIPE CORRECTNESS PATCH
   Corrects known Discovery CFG semantics without changing the generated source
   assets in-place: deprecated recipes, affiliation-dependent outputs and fixed
   per-cycle recipe credit costs.
   ========================================================================== */
(function initRhwV4RecipeCorrections() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.recipeCorrections) return;

  const DEPRECATED_RECIPE_IDS = new Set([
    'module_m_hyperspace_scanner',
    'module_m_cloakdisruptor'
  ]);
  const PRODUCT_NAMES = Object.freeze({
    commodity_gold: 'Gold',
    commodity_pirate_gold: 'Wildcat Gold',
    commodity_diamonds: 'Diamonds',
    commodity_bluediamonds: 'Hessian Tears'
  });
  const STYLE_ID = 'rhwV40RecipeCorrectionsStyle';
  let feeObserver = null;
  let feeQueued = false;

  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const money = value => `$${Math.round(Math.max(0, number(value))).toLocaleString('en-US')}`;
  const friendlyName = id => PRODUCT_NAMES[id] || String(id || '')
    .replace(/^commodity_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

  function affiliationCandidates(recipe) {
    const result = [];
    const seen = new Set();
    for (const group of recipe?.affiliationOutputs || []) {
      for (const output of [group?.base, group?.alternate]) {
        if (!output?.id || seen.has(output.id)) continue;
        seen.add(output.id);
        result.push({ ...output, name: PRODUCT_NAMES[output.id] || output.name || friendlyName(output.id) });
      }
    }
    return result;
  }

  function outputFor(recipe, affiliationId) {
    const groups = recipe?.affiliationOutputs || [];
    if (!groups.length) return recipe?.outputs?.[0] || null;
    const group = groups[0];
    const selected = affiliationId === group.factionId ? group.alternate : group.base;
    return selected ? { ...selected, name: PRODUCT_NAMES[selected.id] || selected.name || friendlyName(selected.id) } : null;
  }

  function normalizeCatalog(catalog) {
    if (!catalog || catalog.__rhwV40Corrected === true) return catalog;
    const recipes = (catalog.recipes || []).filter(recipe => !DEPRECATED_RECIPE_IDS.has(recipe.id));
    const validRecipeIds = new Set(recipes.map(recipe => recipe.id));
    const productMap = new Map();

    for (const product of catalog.products || []) {
      const recipeIds = (product.recipeIds || []).filter(id => validRecipeIds.has(id));
      if (!recipeIds.length) continue;
      productMap.set(product.id, { ...product, recipeIds: [...recipeIds] });
    }

    for (const recipe of recipes) {
      const candidates = affiliationCandidates(recipe);
      if (!candidates.length) continue;
      const byproducts = (recipe.outputs || []).map(output => ({ ...output }));
      recipe.__rhwUnconditionalOutputs = byproducts;
      recipe.__rhwAffiliationCandidates = candidates;
      const defaultOutput = outputFor(recipe, app.config.operations.defaultAffiliation) || candidates[0];
      recipe.outputs = [
        defaultOutput,
        ...candidates.filter(output => output.id !== defaultOutput.id),
        ...byproducts
      ];

      for (const output of candidates) {
        let product = productMap.get(output.id);
        if (!product) {
          product = { id: output.id, name: PRODUCT_NAMES[output.id] || output.name || friendlyName(output.id), recipeIds: [] };
          productMap.set(output.id, product);
        }
        if (!product.name || product.name === product.id) product.name = PRODUCT_NAMES[output.id] || output.name || friendlyName(output.id);
        if (!product.recipeIds.includes(recipe.id)) product.recipeIds.push(recipe.id);
      }
    }

    catalog.recipes = recipes;
    catalog.products = [...productMap.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id));
    catalog.meta = { ...catalog.meta, recipeCount: recipes.length, productCount: catalog.products.length };
    catalog.__rhwV40Corrected = true;

    core.state.catalog = catalog;
    core.state.productsById = new Map(catalog.products.map(product => [product.id, product]));
    core.state.recipesById = new Map(catalog.recipes.map(recipe => [recipe.id, recipe]));
    core.state.recipesByProduct = new Map();
    for (const product of catalog.products) {
      core.state.recipesByProduct.set(product.id, (product.recipeIds || []).map(id => core.state.recipesById.get(id)).filter(Boolean));
    }
    return catalog;
  }

  function prepareAffiliationOutputs(affiliationId) {
    const restorations = [];
    for (const recipe of core.state.catalog?.recipes || []) {
      if (!recipe?.__rhwAffiliationCandidates?.length) continue;
      const effective = outputFor(recipe, affiliationId);
      if (!effective) continue;
      restorations.push([recipe, recipe.outputs]);
      recipe.outputs = [effective, ...(recipe.__rhwUnconditionalOutputs || [])];
    }
    return () => restorations.forEach(([recipe, outputs]) => { recipe.outputs = outputs; });
  }

  const baseLoadCatalog = core.loadCatalog.bind(core);
  core.loadCatalog = async function correctedCatalogLoad(...args) {
    return normalizeCatalog(await baseLoadCatalog(...args));
  };

  const baseBuildPlan = core.buildPlan.bind(core);
  core.buildPlan = function correctedBuildPlan(options = {}) {
    const affiliationId = options.affiliationId || app.config.operations.defaultAffiliation;
    const chosenRecipe = core.recipe(options.recipeId) || core.recipesFor(options.productId)?.[0] || null;
    const effective = outputFor(chosenRecipe, affiliationId);
    const restore = prepareAffiliationOutputs(affiliationId);
    try {
      const plan = baseBuildPlan({ ...options, productId: effective?.id || options.productId });
      const feePerCycle = Math.max(0, number(plan.rootRecipe?.creditCost));
      plan.recipeFeePerCycle = feePerCycle;
      plan.recipeFeeTotal = feePerCycle * Math.max(0, number(plan.cycles));
      if (effective) plan.effectiveOutput = core.product(effective.id);
      return plan;
    } finally {
      restore();
    }
  };

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ops-recipe-fee{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0 0;padding:10px 12px;border:1px solid rgba(212,175,55,.20);background:rgba(212,175,55,.035)}
      .ops-recipe-fee>div{display:grid;gap:3px}.ops-recipe-fee small{font-family:var(--font-tech);font-size:8px;letter-spacing:.08em;color:rgba(224,224,224,.52)}
      .ops-recipe-fee strong{font-family:var(--font-tech);font-size:10px;letter-spacing:.055em;color:#dfc471}.ops-recipe-fee b{font-family:var(--font-display);font-size:20px;color:#f0d06b}
      @media(max-width:700px){.ops-recipe-fee{align-items:flex-start;flex-direction:column}.ops-recipe-fee b{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  function currentMaterialCost() {
    const rows = [...document.querySelectorAll('#workspaceOperations .ops-material-row')];
    let known = 0;
    let complete = true;
    for (const row of rows) {
      const required = Math.max(0, number(row.dataset.required));
      const input = row.querySelector('[data-material-price]');
      if (!input || input.value === '') { complete = false; continue; }
      known += required * Math.max(0, number(input.value));
    }
    return { known, complete, count: rows.length };
  }

  function actualOutput() {
    const block = [...document.querySelectorAll('#workspaceOperations .ops-recipe-meta > div')]
      .find(entry => entry.querySelector('small')?.textContent?.trim() === 'ACTUAL OUTPUT');
    return Math.max(1, number(block?.querySelector('strong')?.textContent?.replace(/[^0-9.-]/g, '')) || 1);
  }

  function marginPercent() {
    return Math.max(0, Math.min(95, number(document.getElementById('opsMargin')?.value || 20)));
  }

  function write(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function applyRecipeFee() {
    const plan = core.state.currentPlan;
    const panel = document.querySelector('#workspaceOperations .ops-cost-panel');
    if (!plan || !panel) return;
    const fee = Math.max(0, number(plan.recipeFeeTotal));
    let box = panel.querySelector('.ops-recipe-fee');
    if (!fee) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.className = 'ops-recipe-fee';
      const notes = panel.querySelector('.ops-price-memory, .ops-details');
      if (notes) notes.insertAdjacentElement('beforebegin', box); else panel.appendChild(box);
    }
    const feeText = `${money(plan.recipeFeePerCycle)} / CYCLE × ${Math.max(0, number(plan.cycles)).toLocaleString('en-US')}`;
    const feeTotal = money(fee);
    const markup = `<div><small>FIXED RECIPE FEE</small><strong>${feeText}</strong></div><b>${feeTotal}</b>`;
    if (box.innerHTML !== markup) box.innerHTML = markup;

    const materials = currentMaterialCost();
    const knownTotal = materials.known + fee;
    const total = materials.complete ? knownTotal : null;
    const output = actualOutput();
    const unitCost = total === null ? null : total / output;
    const margin = marginPercent() / 100;
    const sell = unitCost === null ? null : Math.ceil(unitCost / Math.max(.05, 1 - margin));
    const profitUnit = sell === null || unitCost === null ? null : sell - unitCost;
    const revenue = sell === null ? null : sell * output;
    const profit = revenue === null || total === null ? null : revenue - total;

    write('opsTotalCost', materials.complete ? money(total) : `${money(knownTotal)} PARTIAL`);
    write('opsUnitCost', unitCost === null ? '—' : money(unitCost));
    write('opsSellUnit', sell === null ? '—' : money(sell));
    write('opsProfitUnit', profitUnit === null ? '—' : money(profitUnit));
    write('opsProfit', profit === null ? '—' : money(profit));
    write('opsRevenue', revenue === null ? '—' : money(revenue));
    const warning = document.getElementById('opsPricingWarning');
    if (warning && materials.complete) {
      const text = 'ALL MATERIALS PRICED // FIXED RECIPE FEE INCLUDED // SALE QUOTE READY';
      if (warning.textContent !== text) warning.textContent = text;
    }
  }

  function queueFee() {
    if (feeQueued) return;
    feeQueued = true;
    queueMicrotask(() => { feeQueued = false; applyRecipeFee(); });
  }

  function installFeeObserver() {
    installStyles();
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || workspace.dataset.v40RecipeFeeObserver === 'true') return;
    workspace.dataset.v40RecipeFeeObserver = 'true';
    workspace.addEventListener('input', queueFee);
    workspace.addEventListener('change', queueFee);
    feeObserver = new MutationObserver(queueFee);
    feeObserver.observe(workspace, { childList: true, subtree: true });
    queueFee();
  }

  const baseOperationsInit = app.operations?.init;
  if (typeof baseOperationsInit === 'function') {
    app.operations.init = async function correctedOperationsInit(...args) {
      const result = await baseOperationsInit.apply(this, args);
      installFeeObserver();
      return result;
    };
  }

  function selfTest() {
    const failures = [];
    const catalog = core.state.catalog;
    if (catalog) {
      if (catalog.recipes.some(recipe => DEPRECATED_RECIPE_IDS.has(recipe.id))) failures.push('deprecated-recipes');
      const gold = core.recipe('recipe_gold_basic');
      const diamonds = core.recipe('recipe_diamonds_basic');
      if (gold && outputFor(gold, 'br_m_grp')?.id !== 'commodity_gold') failures.push('gold-bmm-output');
      if (gold && outputFor(gold, '__none__')?.id !== 'commodity_pirate_gold') failures.push('gold-default-output');
      if (diamonds && outputFor(diamonds, 'br_m_grp')?.id !== 'commodity_diamonds') failures.push('diamonds-bmm-output');
      if (core.recipe('module_coreupgrade') && number(core.recipe('module_coreupgrade').creditCost) !== 2500000) failures.push('core-upgrade-fee');
    }
    return failures;
  }

  app.recipeCorrections = {
    normalizeCatalog,
    outputFor,
    affiliationCandidates,
    applyRecipeFee,
    selfTest,
    deprecatedRecipeIds: DEPRECATED_RECIPE_IDS
  };
})();