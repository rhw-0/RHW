/* ==========================================================================
   RHW WEB APP · V4.0 PRODUCTION → CALCULATOR + LIVE RHW PRICING BRIDGE
   Adds production costing shortcuts and uses current RHW buy offers as a
   non-persistent calculator fallback. Manual prices always win.
   ========================================================================== */
(function initRhwV4ProductionPricingBridge() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || !app.operations) return;
  if (app.productionPricing) return;

  const STYLE_ID = 'rhwV40ProductionPricingStyle';
  let operationsObserver = null;
  let productionObserver = null;
  let refreshQueued = false;
  let installed = false;

  const normalize = value => app.util.normalize(String(value || ''));
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const money = value => {
    const parsed = number(value);
    return parsed === null ? '—' : `$${Math.round(parsed).toLocaleString('en-US')}`;
  };
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const manualPrices = () => app.state.calculator?.materialPrices && typeof app.state.calculator.materialPrices === 'object'
    ? app.state.calculator.materialPrices
    : {};

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
      .ops-price-source{display:block;margin-top:4px;font-family:var(--font-tech);font-size:8px!important;font-weight:700;letter-spacing:.055em;line-height:1.3;white-space:normal}
      .ops-price-source.live{color:var(--good)}
      .ops-price-source.manual{color:var(--gold)}
      .ops-price-source.missing{color:var(--warn)}
      @media (min-width:1200px){.production-calc-button{font-size:9.5px}.ops-price-source{font-size:8.5px!important}}
      @media (max-width:700px){.production-calc-button{width:100%;margin-top:7px}.ops-price-source{font-size:7.5px!important}}
    `;
    document.head.appendChild(style);
  }

  function liveBuyPriceFor(name, id = '') {
    try {
      const finder = typeof findCommodity === 'function' ? findCommodity : window.findCommodity;
      const getter = typeof priceSell === 'function' ? priceSell : window.priceSell;
      if (typeof finder !== 'function' || typeof getter !== 'function') return null;
      const item = finder(name) || (id && normalize(id) !== normalize(name) ? finder(id) : null);
      if (!item || item.missing) return null;
      const value = number(getter(item));
      // A zero/non-positive shop value is not treated as an active RHW buy offer.
      return value !== null && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function resolvePrice(row, prices = manualPrices(), liveResolver = liveBuyPriceFor) {
    if (hasOwn(prices, row.id)) {
      const manual = number(prices[row.id]);
      if (manual !== null && manual >= 0) return { value: manual, source: 'manual' };
    }
    const live = number(liveResolver(row.name, row.id));
    if (live !== null && live > 0) return { value: live, source: 'live' };
    return { value: null, source: 'missing' };
  }

  function sourceText(source) {
    if (source === 'manual') return 'SOURCE // MANUAL';
    if (source === 'live') return 'SOURCE // RHW LIVE BUY PRICE';
    return 'SOURCE // ENTER MANUAL PRICE';
  }

  function parseUiNumber(value, fallback = 0) {
    const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function materialInfo(rowElement) {
    return {
      id: rowElement?.dataset?.materialId || '',
      name: rowElement?.querySelector('td strong')?.textContent?.trim() || rowElement?.dataset?.materialId || '',
      required: Math.max(0, Number(rowElement?.dataset?.required) || 0)
    };
  }

  function writeText(target, value) {
    if (target && target.textContent !== value) target.textContent = value;
  }

  function ensureSourceNode(rowElement, source) {
    const wrap = rowElement.querySelector('.ops-price-input-wrap');
    if (!wrap) return null;
    let node = rowElement.querySelector('.ops-price-source');
    if (!node) {
      node = document.createElement('small');
      node.className = 'ops-price-source missing';
      wrap.insertAdjacentElement('afterend', node);
    }
    const className = `ops-price-source ${source}`;
    if (node.className !== className) node.className = className;
    writeText(node, sourceText(source));
    return node;
  }

  function actualOutput() {
    const block = [...document.querySelectorAll('#workspaceOperations .ops-recipe-meta > div')]
      .find(entry => entry.querySelector('small')?.textContent?.trim() === 'ACTUAL OUTPUT');
    return Math.max(1, parseUiNumber(block?.querySelector('strong')?.textContent, 1));
  }

  function currentMargin() {
    const value = number(document.getElementById('opsMargin')?.value ?? app.state.calculator?.marginPercent);
    return Math.max(0, Math.min(95, value === null ? 20 : value));
  }

  function refreshPricing() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace) return;
    const rows = [...workspace.querySelectorAll('.ops-material-row')];
    if (!rows.length) return;

    const prices = manualPrices();
    let knownCost = 0;
    let pricedCount = 0;

    rows.forEach(rowElement => {
      const row = materialInfo(rowElement);
      const resolved = resolvePrice(row, prices);
      const input = rowElement.querySelector('[data-material-price]');
      const suffix = rowElement.querySelector('.ops-price-input-wrap > span');
      const lineCost = rowElement.querySelector('[data-line-cost]');
      if (suffix) writeText(suffix, '$');
      ensureSourceNode(rowElement, resolved.source);

      if (input) {
        input.dataset.priceSource = resolved.source;
        if (resolved.source === 'manual') {
          const desired = String(resolved.value);
          if (document.activeElement !== input && input.value !== desired) input.value = desired;
        } else if (resolved.source === 'live') {
          const desired = String(resolved.value);
          if (document.activeElement !== input && input.value !== desired) input.value = desired;
        } else if (document.activeElement !== input && !hasOwn(prices, row.id) && input.value) {
          input.value = '';
        }
      }

      if (resolved.value !== null) {
        pricedCount += 1;
        knownCost += row.required * resolved.value;
        writeText(lineCost, money(row.required * resolved.value));
      } else {
        writeText(lineCost, '—');
      }
    });

    const output = actualOutput();
    const missingCount = rows.length - pricedCount;
    const complete = missingCount === 0;
    const totalCost = complete ? knownCost : null;
    const unitCost = complete && output > 0 ? totalCost / output : null;
    const marginRatio = currentMargin() / 100;
    const sellPerUnit = unitCost === null ? null : Math.ceil(unitCost / Math.max(0.05, 1 - marginRatio));
    const profitUnit = sellPerUnit === null || unitCost === null ? null : sellPerUnit - unitCost;
    const revenue = sellPerUnit === null ? null : sellPerUnit * output;
    const profit = revenue === null || totalCost === null ? null : revenue - totalCost;

    const coverage = document.getElementById('opsPriceCoverage');
    writeText(coverage, `${pricedCount} / ${rows.length} MATERIALS`);
    if (coverage) coverage.className = complete ? 'good' : 'warn';
    writeText(document.getElementById('opsTotalCost'), complete ? money(totalCost) : `${money(knownCost)} PARTIAL`);
    writeText(document.getElementById('opsUnitCost'), money(unitCost));
    writeText(document.getElementById('opsSellUnit'), money(sellPerUnit));
    writeText(document.getElementById('opsProfitUnit'), money(profitUnit));
    writeText(document.getElementById('opsProfit'), money(profit));
    writeText(document.getElementById('opsRevenue'), money(revenue));

    const warning = document.getElementById('opsPricingWarning');
    if (warning) {
      warning.className = `ops-cost-note ${complete ? 'good' : 'warn'}`;
      writeText(warning, complete
        ? 'ALL MATERIALS PRICED // RHW LIVE + MANUAL SOURCES READY'
        : `${missingCount} MATERIAL PRICE${missingCount === 1 ? '' : 'S'} STILL MISSING // ADD A MANUAL PRICE OR RHW BUY OFFER`);
    }

    const memory = workspace.querySelector('.ops-price-memory');
    writeText(memory, 'MANUAL MATERIAL PRICES ARE SAVED LOCALLY AND ALWAYS OVERRIDE RHW LIVE BUY PRICES. UNSAVED MATERIALS USE THE CURRENT RHW BUY OFFER WHEN AVAILABLE.');
    const costHead = workspace.querySelector('.ops-cost-panel .ops-panel-head small');
    writeText(costHead, 'RHW LIVE BUY + MANUAL OVERRIDES');
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refreshPricing();
    });
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
      const names = [recipeDisplayName(recipe), product?.name, output?.name, recipe.name, recipe.id].filter(Boolean).map(normalize);
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
    queueRefresh();
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

  function installOperationsObserver() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace) return;
    refreshPricing();
    if (workspace.dataset.v40LivePricingBridge === 'true') return;
    workspace.dataset.v40LivePricingBridge = 'true';
    workspace.addEventListener('input', event => {
      if (event.target?.matches?.('[data-material-price], #opsMargin')) queueRefresh();
    });
    workspace.addEventListener('change', event => {
      if (event.target?.matches?.('[data-material-price], #opsRecipe, #opsQuantity, #opsAffiliation')) queueRefresh();
    });
    operationsObserver = new MutationObserver(queueRefresh);
    operationsObserver.observe(workspace, { childList: true, subtree: true });
  }

  function install() {
    installStyles();
    installProductionObserver();
    installOperationsObserver();
    if (installed) return;
    installed = true;
    window.setInterval(() => {
      if (document.body?.dataset?.workspace === 'operations') refreshPricing();
    }, 5000);
  }

  function selfTest() {
    const failures = [];
    const manual = resolvePrice({ id: 'test', name: 'TEST' }, { test: 123 }, () => 456);
    const live = resolvePrice({ id: 'test', name: 'TEST' }, {}, () => 456);
    const missing = resolvePrice({ id: 'test', name: 'TEST' }, {}, () => null);
    if (manual.value !== 123 || manual.source !== 'manual') failures.push('manual-precedence');
    if (live.value !== 456 || live.source !== 'live') failures.push('live-fallback');
    if (missing.value !== null || missing.source !== 'missing') failures.push('missing-price');
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
  app.operations.init = async function productionPricingAwareInit(...args) {
    const result = await originalInit.apply(this, args);
    install();
    return result;
  };

  app.productionPricing = {
    install,
    refreshPricing,
    enhanceProduction,
    openProductionTarget,
    findRecipeForLabel,
    liveBuyPriceFor,
    resolvePrice,
    selfTest
  };
})();