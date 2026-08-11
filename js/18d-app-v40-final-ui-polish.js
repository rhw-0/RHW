/* ==========================================================================
   RHW WEB APP · V4.0 FINAL UI POLISH
   Distinguishes recipe variants, makes batch-vs-unit costing explicit and
   moves the system clock beside Latest Sync instead of underneath it.
   ========================================================================== */
(function initRhwV4FinalUiPolish() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.finalUiPolish) return;

  const STYLE_ID = 'rhwV40FinalUiPolishStyle';
  let operationsObserver = null;
  let queued = false;

  const normalize = value => app.util.normalize(String(value || ''));
  const prettify = value => String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  function aliasFor(recipe) {
    return app.operations?.recipeAliases?.[recipe?.id] || null;
  }

  function recipeBaseName(recipe) {
    if (!recipe) return 'UNKNOWN RECIPE';
    const alias = aliasFor(recipe);
    if (alias?.name) return alias.name;
    if (String(recipe.name || '').trim()) return String(recipe.name).trim();
    const output = recipe.outputs?.[0];
    const product = output ? core.product(output.id) : null;
    return product?.name || output?.name || recipe.id || 'UNKNOWN RECIPE';
  }

  function duplicateBaseGroup(recipe) {
    const base = normalize(recipeBaseName(recipe));
    return (core.state.catalog?.recipes || []).filter(candidate => normalize(recipeBaseName(candidate)) === base);
  }

  function idQualifiers(recipe, baseName) {
    const base = normalize(baseName);
    const tokens = String(recipe?.id || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const rules = [
      ['restricted', 'RESTRICTED'], ['perk', 'PERK'], ['efficient', 'EFFICIENT'],
      ['conversion', 'CONVERSION'], ['advanced', 'ADVANCED'], ['adv', 'ADVANCED'],
      ['basic', 'BASIC'], ['bulk', 'BULK'], ['legit', 'LEGIT']
    ];
    const found = [];
    for (const [token, label] of rules) {
      if (!tokens.includes(token)) continue;
      if (base.includes(normalize(label))) continue;
      if (!found.includes(label)) found.push(label);
    }
    return found;
  }

  function variantQualifier(recipe, baseName) {
    const idLabels = idQualifiers(recipe, baseName);
    if (idLabels.length) return idLabels.join(' + ');

    const craft = prettify(recipe?.craftType || '');
    if (craft && !normalize(baseName).includes(normalize(craft))) return craft;

    const source = prettify(recipe?.sourceType || '');
    if (source && duplicateBaseGroup(recipe).filter(candidate => prettify(candidate.sourceType || '') === source).length === 1) return source;

    return prettify(recipe?.id || 'VARIANT');
  }

  function recipeLabel(recipe) {
    const baseName = recipeBaseName(recipe);
    if (duplicateBaseGroup(recipe).length <= 1) return baseName;
    return `${baseName} · ${variantQualifier(recipe, baseName)}`;
  }

  function relabelRecipeOptions() {
    const select = document.getElementById('opsRecipe');
    if (!select || !core.state.catalog) return;
    [...select.options].forEach(option => {
      const recipe = core.recipe(option.value);
      if (!recipe) return;
      const next = recipeLabel(recipe);
      if (option.textContent !== next) option.textContent = next;
      option.title = `${next} // ${recipe.id}`;
    });
  }

  function actualOutputText() {
    const block = [...document.querySelectorAll('#workspaceOperations .ops-recipe-meta > div')]
      .find(entry => entry.querySelector('small')?.textContent?.trim() === 'ACTUAL OUTPUT');
    return block?.querySelector('strong')?.textContent?.trim() || 'CURRENT OUTPUT';
  }

  function polishCostSummary() {
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (!card) return;
    const heading = card.querySelector(':scope > small');
    const totalLabel = card.querySelector(':scope > span');
    const unitLabel = card.querySelector(':scope > div:not(.ops-margin-input) em');
    if (heading && heading.textContent !== '01 · PRODUCTION COST') heading.textContent = '01 · PRODUCTION COST';
    const totalText = `BATCH COST // TOTAL FOR ${actualOutputText()} PRODUCED`;
    if (totalLabel && totalLabel.textContent !== totalText) totalLabel.textContent = totalText;
    if (unitLabel && unitLabel.textContent !== 'COST / UNIT') unitLabel.textContent = 'COST / UNIT';
    card.dataset.costSemantics = 'batch-total-and-unit';
  }

  function moveHeaderClock() {
    const grid = document.querySelector('.uplink-grid');
    const latest = document.getElementById('syncTimeVal')?.closest('.uplink-stat');
    const clock = document.getElementById('headerClock')?.closest('.uplink-stat');
    if (!grid || !latest || !clock || latest.parentElement !== grid || clock.parentElement !== grid) return;
    clock.classList.add('rhw-system-clock-stat');
    if (latest.nextElementSibling !== clock) grid.insertBefore(clock, latest.nextElementSibling);
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ops-flow-cost[data-cost-semantics="batch-total-and-unit"]{border-color:rgba(125,167,234,.18);background:linear-gradient(135deg,rgba(125,167,234,.055),rgba(0,0,0,.24))}
      .ops-flow-cost[data-cost-semantics="batch-total-and-unit"]>span{font-size:8.5px!important;color:rgba(178,194,217,.72)!important}
      .ops-flow-cost[data-cost-semantics="batch-total-and-unit"]>div:not(.ops-margin-input){align-items:center!important;padding:11px 10px 0!important}
      .ops-flow-cost[data-cost-semantics="batch-total-and-unit"]>div em{font-size:8px!important;color:#9fb6d9!important;font-weight:700}
      .ops-flow-cost[data-cost-semantics="batch-total-and-unit"] #opsUnitCost{font-family:var(--font-title)!important;font-size:23px!important;line-height:1!important;color:#dce8f8!important}
      .rhw-system-clock-stat{position:relative}
      .rhw-system-clock-stat::before{content:'';position:absolute;left:-10px;top:2px;bottom:2px;width:1px;background:rgba(212,175,55,.16)}
      @media(max-width:520px){.rhw-system-clock-stat::before{display:none}.ops-flow-cost[data-cost-semantics="batch-total-and-unit"] #opsUnitCost{font-size:21px!important}}
    `;
    document.head.appendChild(style);
  }

  function applyOperationsPolish() {
    relabelRecipeOptions();
    polishCostSummary();
  }

  function queueOperationsPolish() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      applyOperationsPolish();
    });
  }

  function installObserver() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || workspace.dataset.v40FinalUiPolish === 'true') return;
    workspace.dataset.v40FinalUiPolish = 'true';
    operationsObserver = new MutationObserver(queueOperationsPolish);
    operationsObserver.observe(workspace, { childList: true, subtree: true });
  }

  function duplicateFinalLabels() {
    const groups = new Map();
    for (const recipe of core.state.catalog?.recipes || []) {
      const label = normalize(recipeLabel(recipe));
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(recipe.id);
    }
    return [...groups.entries()].filter(([, ids]) => ids.length > 1);
  }

  function selfTest() {
    const failures = [];
    if (core.state.catalog) {
      const duplicates = duplicateFinalLabels();
      if (duplicates.length) failures.push(`duplicate-recipe-labels:${duplicates.slice(0, 3).map(([, ids]) => ids.join('+')).join(',')}`);
      const goldLabels = ['recipe_gold_basic', 'recipe_gold_advanced', 'recipe_gold_bulk', 'recipe_gold_wildcat_conversion']
        .map(id => core.recipe(id)).filter(Boolean).map(recipeLabel);
      if (new Set(goldLabels).size !== goldLabels.length) failures.push('gold-variant-labels');
    }
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (card) {
      if (!card.textContent.includes('BATCH COST')) failures.push('batch-cost-label');
      if (!card.textContent.includes('COST / UNIT')) failures.push('unit-cost-label');
    }
    const grid = document.querySelector('.uplink-grid');
    const latest = document.getElementById('syncTimeVal')?.closest('.uplink-stat');
    const clock = document.getElementById('headerClock')?.closest('.uplink-stat');
    if (grid && latest && clock && latest.nextElementSibling !== clock) failures.push('header-clock-order');
    return failures;
  }

  function install() {
    installStyles();
    moveHeaderClock();
    installObserver();
    applyOperationsPolish();
  }

  const baseOperationsInit = app.operations?.init;
  if (typeof baseOperationsInit === 'function') {
    app.operations.init = async function finalUiPolishAwareInit(...args) {
      const result = await baseOperationsInit.apply(this, args);
      install();
      return result;
    };
  }

  install();

  app.finalUiPolish = {
    install,
    recipeBaseName,
    recipeLabel,
    variantQualifier,
    duplicateFinalLabels,
    relabelRecipeOptions,
    polishCostSummary,
    moveHeaderClock,
    selfTest
  };
})();