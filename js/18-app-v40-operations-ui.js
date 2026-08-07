/* ==========================================================================
   RHW WEB APP · V4.0 OPERATIONS UI
   Recipe lookup, IFF-aware material costing and sale-price calculator.
   ========================================================================== */
(function initRhwV4OperationsUi() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core) return;

  const NODES = Object.freeze([['calculator', 'ITEM CALCULATOR', 'RECIPE + COSTING']]);
  let rerenderTimer = null;

  function esc(value) { return app.util.escape(value); }
  function fmt(value) { return app.util.number(Math.max(0, Number(value) || 0)); }
  function numberValue(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function clampMargin(value) { return Math.max(0, Math.min(95, numberValue(value, 20))); }
  function money(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return `${Math.round(Number(value)).toLocaleString('en-US')} CR`;
  }
  function timeLabel(seconds) {
    let total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600); total %= 3600;
    const minutes = Math.floor(total / 60); const secs = total % 60;
    if (hours) return `${hours}H ${String(minutes).padStart(2, '0')}M ${String(secs).padStart(2, '0')}S`;
    if (minutes) return `${minutes}M ${String(secs).padStart(2, '0')}S`;
    return `${secs}S`;
  }

  function currentState() {
    const base = app.state.calculator || {};
    return {
      productId: base.productId || app.config.operations.defaultProduct,
      recipeId: base.recipeId || '',
      quantity: Math.max(1, Math.floor(numberValue(base.quantity, 1))),
      affiliationId: base.affiliationId || app.config.operations.defaultAffiliation,
      search: typeof base.search === 'string' ? base.search : '',
      marginPercent: clampMargin(base.marginPercent),
      materialPrices: base.materialPrices && typeof base.materialPrices === 'object' ? { ...base.materialPrices } : {},
      altSelections: base.altSelections && typeof base.altSelections === 'object' ? { ...base.altSelections } : {}
    };
  }

  function saveState(next) {
    app.state.calculator = { ...currentState(), ...next };
    app.store.set(app.config.storageKeys.calculatorState, app.state.calculator);
  }

  function workspaceMarkup() {
    return `<div class="operations-frame">
      <header class="workspace-heading operations-heading">
        <div><div class="workspace-kicker"><span>OPERATIONS</span> RHW INDUSTRIAL COSTING NETWORK</div><h2>ITEM CALCULATOR</h2><p>RECIPE LOOKUP // IFF MATERIAL REQUIREMENTS // BUILD COST // SALE PRICE</p></div>
        <div class="workspace-status" id="operationsStatus" data-tone="muted">LOADING RECIPE DATABASE</div>
      </header>
      <nav id="operationsNodeNav" class="workspace-subnav operations-subnav" aria-label="Operations tools"><div class="workspace-subnav-label">OPERATIONS NODES</div><div class="workspace-subnav-tabs"><button type="button" data-operations-node="calculator" class="active"><span>ITEM CALCULATOR</span><small>RECIPE + COSTING</small></button></div></nav>
      <div id="operationsNodeHost" class="operations-node-host"><section data-operations-panel="calculator" class="operations-node-panel"><div id="operationsCalculatorMount" class="ops-loading">LOADING DISCOVERY RECIPE DATABASE…</div></section></div>
    </div>`;
  }

  function primaryOutput(recipe) {
    return recipe?.outputs?.[0] || null;
  }

  function recipeProduct(recipe) {
    const output = primaryOutput(recipe);
    return output ? core.product(output.id) : null;
  }

  function recipeSearchText(recipe) {
    const product = recipeProduct(recipe);
    return app.util.normalize([
      product?.name, product?.id, recipe?.name, recipe?.id, recipe?.craftType,
      ...(recipe?.outputs || []).map(output => output.name || output.id)
    ].filter(Boolean).join(' '));
  }

  function matchingRecipes(search = '') {
    const q = app.util.normalize(search);
    return [...(core.state.catalog?.recipes || [])]
      .filter(recipe => !q || recipeSearchText(recipe).includes(q))
      .sort((a, b) => {
        const aName = recipeProduct(a)?.name || a.name || a.id;
        const bName = recipeProduct(b)?.name || b.name || b.id;
        return aName.localeCompare(bName) || a.id.localeCompare(b.id);
      });
  }

  function recipeLabel(recipe) {
    const product = recipeProduct(recipe);
    const productName = product?.name || recipe?.name || recipe?.id || 'UNKNOWN RECIPE';
    const variants = product ? core.recipesFor(product.id) : [];
    if (variants.length <= 1) return productName;
    const qualifier = recipe.craftType || recipe.name || recipe.id;
    const same = app.util.normalize(qualifier) === app.util.normalize(productName);
    return `${productName} · ${same ? recipe.id : qualifier}`;
  }

  function recipeOptions(recipes, selectedId) {
    if (!recipes.length) return '<option value="">NO MATCHING RECIPES</option>';
    return recipes.map(recipe => `<option value="${esc(recipe.id)}"${recipe.id === selectedId ? ' selected' : ''}>${esc(recipeLabel(recipe))}</option>`).join('');
  }

  function iffEntries(recipe, selectedId) {
    const entries = [];
    const seen = new Set();
    const add = (id, name, factor) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      entries.push({ id, name, factor });
    };
    const bmmFactor = core.factorFor(recipe, 'br_m_grp');
    add('br_m_grp', bmmFactor !== 1 ? `BMM · RHW DEFAULT · ${bmmFactor.toFixed(2)}×` : 'BMM · RHW DEFAULT · NO BONUS', bmmFactor);
    add('__none__', 'NO IFF BONUS · 1.00×', 1);
    for (const bonus of recipe?.bonuses || []) {
      if (bonus.id === 'br_m_grp') continue;
      add(bonus.id, `${bonus.name || bonus.id} · ${Number(bonus.factor || 1).toFixed(2)}×`, Number(bonus.factor || 1));
    }
    if (selectedId && !seen.has(selectedId)) {
      const faction = core.state.catalog?.factions?.find(entry => entry.id === selectedId);
      add(selectedId, `${faction?.name || selectedId} · NO BONUS`, 1);
    }
    return entries;
  }

  function ensureState(raw) {
    const calc = { ...raw };
    const matches = matchingRecipes(calc.search);
    let selected = core.recipe(calc.recipeId);
    if (!selected || (calc.search && !matches.some(recipe => recipe.id === selected.id))) selected = matches[0] || null;
    if (!selected && calc.productId) selected = core.recipesFor(calc.productId)[0] || null;
    if (!selected) selected = core.state.catalog?.recipes?.[0] || null;
    if (!selected) return calc;
    const output = primaryOutput(selected);
    calc.recipeId = selected.id;
    calc.productId = output?.id || calc.productId;
    const allowedIff = new Set(iffEntries(selected, calc.affiliationId).map(entry => entry.id));
    if (!allowedIff.has(calc.affiliationId)) calc.affiliationId = app.config.operations.defaultAffiliation;
    return calc;
  }

  function alternativeControls(recipe, calc) {
    const groups = (recipe.inputs || []).map((group, index) => ({ group, index })).filter(entry => (entry.group.options || []).length > 1);
    if (!groups.length) return '';
    return `<div class="ops-alternatives"><div class="ops-mini-head"><span>ALTERNATIVE INPUTS</span><small>CHOOSE WHICH MATERIAL ROUTE YOU WANT TO PRICE</small></div>${groups.map(({ group, index }) => {
      const key = `${recipe.id}:${index}`;
      const selected = calc.altSelections[key] || group.options[0]?.id || '';
      return `<label class="comms-field"><span>${esc(group.options.map(option => option.name || option.id).join(' / '))}</span><select data-alt-group="${esc(key)}">${group.options.map(option => `<option value="${esc(option.id)}"${option.id === selected ? ' selected' : ''}>${esc(option.name || option.id)} · ${fmt(option.qty)} / CYCLE</option>`).join('')}</select></label>`;
    }).join('')}</div>`;
  }

  function buildQuote(calc) {
    return core.buildPlan({
      productId: calc.productId,
      recipeId: calc.recipeId,
      quantity: calc.quantity,
      affiliationId: calc.affiliationId,
      useInventory: false,
      recursive: false,
      routingPolicy: 'first',
      altSelections: calc.altSelections
    });
  }

  function materialRows(plan) {
    const byId = new Map();
    for (const row of plan.directRequirements || []) {
      const id = row.item?.id || row.item?.name || 'unknown';
      const current = byId.get(id) || { id, name: row.item?.name || id, required: 0 };
      current.required += Math.max(0, Number(row.required) || 0);
      byId.set(id, current);
    }
    return [...byId.values()];
  }

  function storedPrice(prices, id) {
    if (!Object.prototype.hasOwnProperty.call(prices, id)) return null;
    const raw = prices[id];
    if (raw === '' || raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function pricingFor(materials, calc, actualOutput) {
    let knownCost = 0;
    let pricedCount = 0;
    for (const row of materials) {
      const price = storedPrice(calc.materialPrices, row.id);
      if (price === null) continue;
      pricedCount += 1;
      knownCost += row.required * price;
    }
    const missingCount = materials.length - pricedCount;
    const complete = missingCount === 0;
    const totalCost = complete ? knownCost : null;
    const unitCost = complete && actualOutput > 0 ? totalCost / actualOutput : null;
    const margin = clampMargin(calc.marginPercent) / 100;
    const sellPerUnit = unitCost === null ? null : unitCost / Math.max(0.05, 1 - margin);
    const revenue = sellPerUnit === null ? null : sellPerUnit * actualOutput;
    const profit = revenue === null || totalCost === null ? null : revenue - totalCost;
    return { knownCost, pricedCount, missingCount, complete, totalCost, unitCost, sellPerUnit, revenue, profit };
  }

  function materialsMarkup(materials, calc) {
    if (!materials.length) return '<div class="ops-empty good">THIS RECIPE HAS NO CONSUMED MATERIAL INPUTS</div>';
    return `<div class="ops-material-table-wrap"><table class="ops-material-table"><thead><tr><th>MATERIAL</th><th>REQUIRED</th><th>PRICE / UNIT</th><th>LINE COST</th></tr></thead><tbody>${materials.map(row => {
      const price = storedPrice(calc.materialPrices, row.id);
      const line = price === null ? null : row.required * price;
      return `<tr class="ops-material-row" data-material-id="${esc(row.id)}" data-required="${row.required}"><td><strong>${esc(row.name)}</strong><small>${esc(row.id)}</small></td><td>${fmt(row.required)}</td><td><div class="ops-price-input-wrap"><input class="ops-price-input" data-material-price="${esc(row.id)}" type="number" inputmode="decimal" min="0" step="1" value="${price === null ? '' : esc(String(price))}" placeholder="0" /><span>CR</span></div></td><td data-line-cost>${money(line)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function catalystsMarkup(plan) {
    if (!plan.catalysts?.length && !plan.byproducts?.length) return '';
    const catalystText = plan.catalysts?.length ? plan.catalysts.map(row => `${row.name} × ${fmt(row.qty)}`).join(' · ') : 'NONE';
    const byproductText = plan.byproducts?.length ? plan.byproducts.map(row => `${row.name} × ${fmt(row.qty)}`).join(' · ') : 'NONE';
    return `<details class="ops-details"><summary>RECIPE NOTES</summary><div><strong>RETAINED / NOT CONSUMED</strong><span>${esc(catalystText)}</span><strong>BYPRODUCTS / NOT CREDITED AGAINST COST</strong><span>${esc(byproductText)}</span></div></details>`;
  }

  function pricingSummaryMarkup(pricing, calc, materials) {
    return `<div class="ops-pricing-summary">
      <div class="ops-priced-state"><span>PRICE COVERAGE</span><strong id="opsPriceCoverage" class="${pricing.complete ? 'good' : 'warn'}">${pricing.pricedCount} / ${materials.length} MATERIALS</strong></div>
      <div class="ops-quote-grid">
        <div><small>TOTAL BUILD COST</small><strong id="opsTotalCost">${pricing.complete ? money(pricing.totalCost) : `${money(pricing.knownCost)} PARTIAL`}</strong></div>
        <div><small>COST / OUTPUT</small><strong id="opsUnitCost">${money(pricing.unitCost)}</strong></div>
        <div class="accent"><small>SELL PRICE / OUTPUT</small><strong id="opsSellUnit">${money(pricing.sellPerUnit)}</strong></div>
        <div><small>EXPECTED REVENUE</small><strong id="opsRevenue">${money(pricing.revenue)}</strong></div>
        <div><small>EXPECTED PROFIT</small><strong id="opsProfit">${money(pricing.profit)}</strong></div>
      </div>
      <label class="comms-field ops-margin-field"><span>TARGET PROFIT MARGIN</span><div class="ops-margin-input"><input id="opsMargin" type="number" inputmode="decimal" min="0" max="95" step="1" value="${esc(String(calc.marginPercent))}" /><span>%</span></div><small>MARGIN = PROFIT AS A SHARE OF THE SELLING PRICE. RHW CALCULATES THE REQUIRED SALE PRICE.</small></label>
      <div id="opsPricingWarning" class="ops-cost-note ${pricing.complete ? 'good' : 'warn'}">${pricing.complete ? 'ALL MATERIALS PRICED // SALE QUOTE READY' : `${pricing.missingCount} MATERIAL PRICE${pricing.missingCount === 1 ? '' : 'S'} STILL MISSING // TOTALS ARE PARTIAL`}</div>
    </div>`;
  }

  function renderCalculator({ focusSearch = false } = {}) {
    const mount = document.getElementById('operationsCalculatorMount');
    const catalog = core.state.catalog;
    if (!mount || !catalog) return;

    const calc = ensureState(currentState());
    saveState(calc);
    const selectedRecipe = core.recipe(calc.recipeId);
    if (!selectedRecipe) {
      mount.innerHTML = '<div class="ops-empty danger">NO RECIPE AVAILABLE</div>';
      return;
    }
    const matches = matchingRecipes(calc.search);
    let plan;
    try { plan = buildQuote(calc); }
    catch (error) {
      mount.innerHTML = `<div class="ops-empty danger">CALCULATION FAILED<small>${esc(error.message)}</small></div>`;
      return;
    }
    core.state.currentPlan = plan;
    const materials = materialRows(plan);
    const pricing = pricingFor(materials, calc, plan.actualOutput);
    const product = recipeProduct(selectedRecipe) || plan.product;
    const iff = iffEntries(selectedRecipe, calc.affiliationId);

    mount.className = 'operations-calculator';
    mount.innerHTML = `<div class="operations-layout-simple">
      <section class="ops-panel ops-setup-panel"><div class="ops-panel-head"><div><span>01</span><strong>RECIPE</strong></div><small>${fmt(catalog.meta.recipeCount)} MASTER RECIPES</small></div>
        <div class="ops-form-grid">
          <label class="comms-field ops-wide"><span>SEARCH RECIPE</span><input id="opsRecipeSearch" type="search" value="${esc(calc.search)}" placeholder="Superstructure, Reactor, Gold, Docking Module…" autocomplete="off" /><small>TYPE A NAME OR RECIPE ID // FIRST MATCH IS SELECTED AUTOMATICALLY</small></label>
          <label class="comms-field ops-wide"><span>SELECTED RECIPE</span><select id="opsRecipe">${recipeOptions(matches.length ? matches : [selectedRecipe], calc.recipeId)}</select><small>${matches.length} MATCH${matches.length === 1 ? '' : 'ES'} // ${esc(selectedRecipe.craftType || selectedRecipe.sourceType || 'GENERAL')}</small></label>
          <label class="comms-field"><span>OUTPUT QUANTITY</span><input id="opsQuantity" type="number" inputmode="numeric" min="1" step="1" value="${calc.quantity}" /><small>EXAMPLE: 200 REACTORS</small></label>
          <label class="comms-field"><span>AFFILIATION / IFF</span><select id="opsAffiliation">${iff.map(entry => `<option value="${esc(entry.id)}"${entry.id === calc.affiliationId ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}</select><small>BMM IS PRESELECTED FOR RHW</small></label>
        </div>
        ${alternativeControls(selectedRecipe, calc)}
        <div class="ops-recipe-meta"><div><small>OUTPUT / CYCLE</small><strong>${fmt(plan.tree.outputPerCycle)}</strong></div><div><small>CYCLES</small><strong>${fmt(plan.cycles)}</strong></div><div><small>ACTUAL OUTPUT</small><strong>${fmt(plan.actualOutput)}</strong></div><div><small>SURPLUS</small><strong>${fmt(plan.surplus)}</strong></div><div><small>IFF FACTOR</small><strong>${plan.rootFactor.toFixed(2)}×</strong></div><div><small>PROCESS TIME</small><strong>${timeLabel(plan.totalTime)}</strong></div></div>
        <div class="ops-selected-target"><small>ACTIVE RECIPE</small><strong>${esc(product?.name || selectedRecipe.name)}</strong><span>${esc(selectedRecipe.id)}</span></div>
      </section>

      <section class="ops-panel ops-cost-panel"><div class="ops-panel-head"><div><span>02</span><strong>MATERIAL COST</strong></div><small>ENTER YOUR UNIT PRICES</small></div>
        ${materialsMarkup(materials, calc)}
        <div class="ops-price-memory">MATERIAL PRICES ARE SAVED LOCALLY IN THIS BROWSER AND REUSED IN OTHER RECIPES.</div>
        ${catalystsMarkup(plan)}
      </section>

      <section class="ops-panel ops-quote-panel"><div class="ops-panel-head"><div><span>03</span><strong>SALE QUOTE</strong></div><small>FROM MATERIAL COST + TARGET MARGIN</small></div>
        ${pricingSummaryMarkup(pricing, calc, materials)}
      </section>
    </div>`;

    bindCalculatorControls(plan, materials);
    if (focusSearch) {
      const search = document.getElementById('opsRecipeSearch');
      if (search) {
        search.focus();
        const end = search.value.length;
        try { search.setSelectionRange(end, end); } catch { /* non-text search implementation */ }
      }
    }
  }

  function scheduleRender(patch = {}, { focusSearch = false, delay = 45 } = {}) {
    saveState(patch);
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => renderCalculator({ focusSearch }), delay);
  }

  function updatePricingDisplay(plan, materials) {
    const calc = currentState();
    const pricing = pricingFor(materials, calc, plan.actualOutput);
    document.querySelectorAll('.ops-material-row').forEach(row => {
      const id = row.dataset.materialId || '';
      const required = numberValue(row.dataset.required, 0);
      const price = storedPrice(calc.materialPrices, id);
      const target = row.querySelector('[data-line-cost]');
      if (target) target.textContent = money(price === null ? null : required * price);
    });
    const write = (id, value) => { const target = document.getElementById(id); if (target) target.textContent = value; };
    write('opsPriceCoverage', `${pricing.pricedCount} / ${materials.length} MATERIALS`);
    const coverage = document.getElementById('opsPriceCoverage');
    if (coverage) coverage.className = pricing.complete ? 'good' : 'warn';
    write('opsTotalCost', pricing.complete ? money(pricing.totalCost) : `${money(pricing.knownCost)} PARTIAL`);
    write('opsUnitCost', money(pricing.unitCost));
    write('opsSellUnit', money(pricing.sellPerUnit));
    write('opsRevenue', money(pricing.revenue));
    write('opsProfit', money(pricing.profit));
    const warning = document.getElementById('opsPricingWarning');
    if (warning) {
      warning.className = `ops-cost-note ${pricing.complete ? 'good' : 'warn'}`;
      warning.textContent = pricing.complete ? 'ALL MATERIALS PRICED // SALE QUOTE READY' : `${pricing.missingCount} MATERIAL PRICE${pricing.missingCount === 1 ? '' : 'S'} STILL MISSING // TOTALS ARE PARTIAL`;
    }
  }

  function bindCalculatorControls(plan, materials) {
    document.getElementById('opsRecipeSearch')?.addEventListener('input', event => {
      const search = event.target.value;
      const matches = matchingRecipes(search);
      const select = document.getElementById('opsRecipe');
      if (select) select.innerHTML = recipeOptions(matches, matches[0]?.id || '');
      if (!matches.length) {
        saveState({ search });
        return;
      }
      const recipe = matches[0];
      const output = primaryOutput(recipe);
      scheduleRender({ search, recipeId: recipe.id, productId: output?.id || currentState().productId, altSelections: {} }, { focusSearch: true, delay: 140 });
    });

    document.getElementById('opsRecipe')?.addEventListener('change', event => {
      const recipe = core.recipe(event.target.value);
      if (!recipe) return;
      const output = primaryOutput(recipe);
      scheduleRender({ recipeId: recipe.id, productId: output?.id || currentState().productId, altSelections: {} });
    });
    document.getElementById('opsQuantity')?.addEventListener('change', event => scheduleRender({ quantity: Math.max(1, Math.floor(numberValue(event.target.value, 1))) }));
    document.getElementById('opsAffiliation')?.addEventListener('change', event => scheduleRender({ affiliationId: event.target.value }));
    document.querySelectorAll('[data-alt-group]').forEach(select => select.addEventListener('change', event => {
      const calc = currentState();
      const selections = { ...calc.altSelections, [event.target.dataset.altGroup]: event.target.value };
      scheduleRender({ altSelections: selections });
    }));

    document.querySelectorAll('[data-material-price]').forEach(input => input.addEventListener('input', event => {
      const calc = currentState();
      const prices = { ...calc.materialPrices };
      const key = event.target.dataset.materialPrice;
      if (event.target.value === '') delete prices[key];
      else prices[key] = Math.max(0, numberValue(event.target.value, 0));
      saveState({ materialPrices: prices });
      updatePricingDisplay(plan, materials);
    }));
    document.getElementById('opsMargin')?.addEventListener('input', event => {
      saveState({ marginPercent: clampMargin(event.target.value) });
      updatePricingDisplay(plan, materials);
    });
  }

  function installShipyardBridge() {
    const mount = document.getElementById('shipyardControl');
    if (!mount || mount.dataset.v40PlannerBridge === 'true') return;
    mount.dataset.v40PlannerBridge = 'true';
    const enhance = () => {
      mount.querySelectorAll('.hull-registry-row').forEach(row => {
        if (row.querySelector('.shipyard-plan-button')) return;
        const label = row.querySelector('.hull-registry-name');
        if (!label) return;
        const text = app.util.normalize(label.textContent);
        const target = text.includes('dunkirk') ? app.config.operations.shipyardTargets.dunkirk : text.includes('invincible') ? app.config.operations.shipyardTargets.invincible : null;
        if (!target) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'shipyard-plan-button';
        button.textContent = 'PRICE / PLAN 1 HULL';
        button.addEventListener('click', event => { event.stopPropagation(); openTarget(target, 1); });
        label.appendChild(button);
      });
    };
    enhance();
    new MutationObserver(enhance).observe(mount, { childList: true, subtree: true });
  }

  function openTarget(productId, quantity = 1) {
    const recipe = core.recipesFor(productId)[0];
    const product = core.product(productId);
    if (!recipe) return;
    saveState({ productId, recipeId: recipe.id, quantity, search: product?.name || '', altSelections: {} });
    app.navigate('operations', 'calculator');
    renderCalculator();
  }

  function activate(node, { updateRoute = true } = {}) {
    const valid = node === 'calculator' ? 'calculator' : 'calculator';
    app.state.operationsNode = valid;
    app.store.set(app.config.storageKeys.operationsNode, valid);
    document.body.dataset.operationsNode = valid;
    app.setActiveNode('OPERATIONS / ITEM CALCULATOR');
    document.title = `RHW ITEM CALCULATOR · ${app.version}`;
    if (updateRoute && app.state.activeWorkspace === 'operations') app.route.write('operations', valid);
    if (core.state.catalog) renderCalculator();
  }

  async function init() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || document.getElementById('operationsNodeNav')) return;
    workspace.innerHTML = workspaceMarkup();
    app.state.calculator = { ...currentState(), ...(app.store.get(app.config.storageKeys.calculatorState, {}) || {}) };
    try {
      const catalog = await core.loadCatalog();
      const status = document.getElementById('operationsStatus');
      if (status) { status.textContent = `${fmt(catalog.meta.recipeCount)} RECIPES // COSTING READY`; status.dataset.tone = 'good'; }
      renderCalculator();
    } catch (error) {
      const mount = document.getElementById('operationsCalculatorMount');
      if (mount) mount.innerHTML = `<div class="ops-empty danger">RECIPE DATABASE FAILED TO LOAD<small>${esc(error.message)}</small></div>`;
      const status = document.getElementById('operationsStatus');
      if (status) { status.textContent = 'RECIPE DATABASE ERROR'; status.dataset.tone = 'danger'; }
      throw error;
    }
    installShipyardBridge();
  }

  app.operations = { init, activate, openTarget, renderCalculator, nodes: NODES };
})();
