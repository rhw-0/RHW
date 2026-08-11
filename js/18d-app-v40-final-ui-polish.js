/* ==========================================================================
   RHW WEB APP · V4.0 FINAL UI POLISH
   Disambiguates duplicate recipe names, makes per-unit costing the primary
   quote metric, and places System Clock in the top-left uplink slot.
   ========================================================================== */
(function initRhwV4FinalUiPolish() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.finalUiPolish) return;

  const STYLE_ID = 'rhwV40FinalUiPolishStyle';
  const KNOWN_RECIPE_LABELS = Object.freeze({
    recipe_gold_basic: 'Gold Refining · Basic',
    recipe_gold_advanced: 'Gold Refining · Advanced',
    recipe_gold_bulk: 'Gold Refining · Bulk',
    recipe_gold_wildcat_conversion: 'Wildcat Gold Reprocessing',
    recipe_diamonds_basic: 'Diamond Refining · Basic',
    recipe_diamonds_advanced: 'Diamond Refining · Advanced',
    recipe_diamonds_bulk: 'Diamond Refining · Bulk'
  });

  let labelMap = new Map();
  let labelCatalogRef = null;
  let calculatorObserver = null;
  let polishQueued = false;

  const normalize = value => app.util.normalize(String(value || ''));

  function baseRecipeName(recipe) {
    if (!recipe) return 'UNKNOWN RECIPE';
    if (KNOWN_RECIPE_LABELS[recipe.id]) return KNOWN_RECIPE_LABELS[recipe.id];
    const alias = app.operations?.recipeAliases?.[recipe.id];
    const output = recipe.outputs?.[0];
    const product = output ? core.product(output.id) : null;
    return alias?.name || product?.name || output?.name || recipe.name || recipe.id || 'UNKNOWN RECIPE';
  }

  function prettyToken(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\badv\b/gi, 'advanced')
      .replace(/\bmk\s*(\d+)\b/gi, 'Mk $1')
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim();
  }

  function variantFromId(recipe, baseName) {
    const id = String(recipe?.id || '').toLowerCase();
    const suffixes = [
      [/(?:_|-)basic$/, 'basic'],
      [/(?:_|-)(?:advanced|adv)$/, 'advanced'],
      [/(?:_|-)bulk$/, 'bulk'],
      [/(?:_|-)conversion$/, 'conversion'],
      [/(?:_|-)reprocessing$/, 'reprocessing'],
      [/(?:_|-)standard$/, 'standard'],
      [/(?:_|-)small$/, 'small'],
      [/(?:_|-)medium$/, 'medium'],
      [/(?:_|-)large$/, 'large'],
      [/(?:_|-)heavy$/, 'heavy'],
      [/(?:_|-)light$/, 'light'],
      [/(?:_|-)(mk\d+)$/, '$1'],
      [/(?:_|-)(v\d+)$/, '$1']
    ];
    for (const [pattern, replacement] of suffixes) {
      if (pattern.test(id)) return prettyToken(id.match(pattern)?.[1] || replacement);
    }

    const craftType = String(recipe?.craftType || '').trim();
    if (craftType && normalize(craftType) !== normalize(baseName)) return prettyToken(craftType);

    const recipeName = String(recipe?.name || '').trim();
    if (recipeName && normalize(recipeName) !== normalize(baseName)) return recipeName;

    const cleaned = id
      .replace(/^(?:recipe|module|ship_assembly|assembly)_/, '')
      .split('_')
      .filter(Boolean);
    const baseWords = new Set(normalize(baseName).split(/\s+/).filter(Boolean));
    const remainder = cleaned.filter(token => !baseWords.has(normalize(token)));
    if (remainder.length) return prettyToken(remainder.join(' '));

    if (Number(recipe?.reqLevel) > 0) return `Level ${Number(recipe.reqLevel)}`;
    return String(recipe?.id || 'recipe');
  }

  function buildLabelMap() {
    const catalog = core.state.catalog;
    if (!catalog?.recipes) return new Map();
    if (labelCatalogRef === catalog && labelMap.size === catalog.recipes.length) return labelMap;

    const recipes = [...catalog.recipes];
    const provisional = new Map(recipes.map(recipe => [recipe.id, baseRecipeName(recipe)]));
    const grouped = new Map();
    recipes.forEach(recipe => {
      const key = normalize(provisional.get(recipe.id));
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(recipe);
    });

    const final = new Map();
    grouped.forEach(group => {
      if (group.length === 1) {
        const recipe = group[0];
        final.set(recipe.id, provisional.get(recipe.id));
        return;
      }
      group.forEach(recipe => {
        const base = provisional.get(recipe.id);
        final.set(recipe.id, `${base} · ${variantFromId(recipe, base)}`);
      });
    });

    // Absolute uniqueness guard across the entire catalog. Human-readable
    // variants win; the stable recipe id is used only if a collision remains.
    const collisions = new Map();
    recipes.forEach(recipe => {
      const key = normalize(final.get(recipe.id));
      if (!collisions.has(key)) collisions.set(key, []);
      collisions.get(key).push(recipe);
    });
    collisions.forEach(group => {
      if (group.length < 2) return;
      group.forEach(recipe => final.set(recipe.id, `${final.get(recipe.id)} · ${recipe.id}`));
    });

    labelCatalogRef = catalog;
    labelMap = final;
    return final;
  }

  function recipeLabel(recipe) {
    if (!recipe) return 'UNKNOWN RECIPE';
    return buildLabelMap().get(recipe.id) || baseRecipeName(recipe);
  }

  function duplicateFinalLabels() {
    const recipes = core.state.catalog?.recipes || [];
    const grouped = new Map();
    recipes.forEach(recipe => {
      const label = recipeLabel(recipe);
      const key = normalize(label);
      if (!grouped.has(key)) grouped.set(key, { label, ids: [] });
      grouped.get(key).ids.push(recipe.id);
    });
    return [...grouped.values()].filter(group => group.ids.length > 1).map(group => [group.label, group.ids]);
  }

  function polishRecipeOptions() {
    const select = document.getElementById('opsRecipe');
    if (!select || !core.state.catalog) return;
    [...select.options].forEach(option => {
      const recipe = core.recipe(option.value);
      if (!recipe) return;
      const label = recipeLabel(recipe);
      if (option.textContent !== label) option.textContent = label;
      const title = `${label} // ${recipe.id}`;
      if (option.title !== title) option.title = title;
    });
  }

  function actualOutputText() {
    const block = [...document.querySelectorAll('#workspaceOperations .ops-recipe-meta > div')]
      .find(entry => entry.querySelector('small')?.textContent?.trim() === 'ACTUAL OUTPUT');
    return block?.querySelector('strong')?.textContent?.trim() || '1';
  }

  function polishCostFlow() {
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (!card) return;
    const total = card.querySelector('#opsTotalCost');
    const unit = card.querySelector('#opsUnitCost');
    if (!total || !unit) return;

    const totalText = total.textContent || '—';
    const unitText = unit.textContent || '—';
    const actual = actualOutputText();
    const alreadyPolished = card.querySelector(':scope > strong#opsUnitCost') && card.querySelector(':scope > div b#opsTotalCost');

    if (!alreadyPolished) {
      card.innerHTML = `<small>01 · COST / UNIT</small><strong id="opsUnitCost">${app.util.escape(unitText)}</strong><span>MANUFACTURING COST / UNIT</span><div><em>TOTAL BATCH COST // ${app.util.escape(actual)} PRODUCED</em><b id="opsTotalCost">${app.util.escape(totalText)}</b></div>`;
    } else {
      const small = card.querySelector(':scope > small');
      const span = card.querySelector(':scope > span');
      const em = card.querySelector(':scope > div em');
      if (small && small.textContent !== '01 · COST / UNIT') small.textContent = '01 · COST / UNIT';
      if (span && span.textContent !== 'MANUFACTURING COST / UNIT') span.textContent = 'MANUFACTURING COST / UNIT';
      const batchLabel = `TOTAL BATCH COST // ${actual} PRODUCED`;
      if (em && em.textContent !== batchLabel) em.textContent = batchLabel;
    }

    const marginCard = document.querySelector('#workspaceOperations .ops-flow-margin');
    if (marginCard) {
      const small = marginCard.querySelector(':scope > small');
      const copy = marginCard.querySelector(':scope > p');
      if (small && small.textContent !== '02 · TARGET PROFIT MARGIN') small.textContent = '02 · TARGET PROFIT MARGIN';
      const text = 'APPLIED TO COST / UNIT // PROFIT AS SHARE OF SELL PRICE';
      if (copy && copy.textContent !== text) copy.textContent = text;
    }

    const sellCard = document.querySelector('#workspaceOperations .ops-flow-sell');
    if (sellCard) {
      const small = sellCard.querySelector(':scope > small');
      const span = sellCard.querySelector(':scope > span');
      if (small && small.textContent !== '03 · SALE PRICE / UNIT') small.textContent = '03 · SALE PRICE / UNIT';
      if (span && span.textContent !== 'RECOMMENDED SELL / UNIT') span.textContent = 'RECOMMENDED SELL / UNIT';
    }

    const flowMeta = document.querySelector('#workspaceOperations .ops-quote-panel .ops-panel-head > small');
    if (flowMeta && flowMeta.textContent !== 'UNIT COST → MARGIN → SELL / UNIT') flowMeta.textContent = 'UNIT COST → MARGIN → SELL / UNIT';
  }

  function fixHeaderClockLayout() {
    const grid = document.querySelector('.uplink-grid');
    if (!grid) return;
    const stats = [...grid.children].filter(node => node.classList.contains('uplink-stat'));
    const byLabel = new Map(stats.map(node => [node.querySelector('small')?.textContent?.trim() || '', node]));
    const order = ['SYSTEM CLOCK', 'LATEST SYNC', 'NEXT SYNC', 'REFRESH CYCLE'];
    const anchor = [...grid.children].find(node => node.classList.contains('uplink-actions')) || null;
    order.forEach(label => {
      const node = byLabel.get(label);
      if (node) grid.insertBefore(node, anchor);
    });
    const clock = byLabel.get('SYSTEM CLOCK');
    if (clock) clock.classList.add('uplink-clock-stat');
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .uplink-clock-stat{border-left:2px solid rgba(212,175,55,.34);padding-left:10px}
      .uplink-clock-stat .uplink-label{color:rgba(212,175,55,.72)}
      .uplink-clock-stat .uplink-value{color:var(--gold)!important}
      .ops-flow-cost>strong{color:#e8ece9}
      .ops-flow-cost>span{color:#9fb6a7;font-weight:700}
      .ops-flow-cost>div b{font-size:10px;color:rgba(226,231,228,.84)}
      .ops-flow-cost>div em{color:rgba(164,173,168,.66)}
      @media(max-width:760px){.uplink-clock-stat{padding-left:8px}}
    `;
    document.head.appendChild(style);
  }

  function queuePolish() {
    if (polishQueued) return;
    polishQueued = true;
    queueMicrotask(() => {
      polishQueued = false;
      polishRecipeOptions();
      polishCostFlow();
    });
  }

  function installCalculatorObserver() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || workspace.dataset.v40FinalUiPolish === 'true') return;
    workspace.dataset.v40FinalUiPolish = 'true';
    calculatorObserver = new MutationObserver(queuePolish);
    calculatorObserver.observe(workspace, { childList: true, subtree: true });
    queuePolish();
  }

  const baseLoadCatalog = core.loadCatalog.bind(core);
  core.loadCatalog = async function finalPolishCatalogLoad(...args) {
    const catalog = await baseLoadCatalog(...args);
    labelCatalogRef = null;
    buildLabelMap();
    return catalog;
  };

  const baseOperationsInit = app.operations?.init;
  if (typeof baseOperationsInit === 'function') {
    app.operations.init = async function finalUiPolishOperationsInit(...args) {
      const result = await baseOperationsInit.apply(this, args);
      installCalculatorObserver();
      queuePolish();
      return result;
    };
  }

  function selfTest() {
    const failures = [];
    if (core.state.catalog && duplicateFinalLabels().length) failures.push('duplicate-recipe-labels');
    const grid = document.querySelector('.uplink-grid');
    if (grid) {
      const labels = [...grid.children].filter(node => node.classList.contains('uplink-stat')).map(node => node.querySelector('small')?.textContent?.trim() || '');
      if (labels.slice(0, 4).join('|') !== 'SYSTEM CLOCK|LATEST SYNC|NEXT SYNC|REFRESH CYCLE') failures.push('header-clock-order');
    }
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (card) {
      if (!card.querySelector(':scope > strong#opsUnitCost')) failures.push('unit-cost-primary');
      if (!card.querySelector(':scope > div b#opsTotalCost')) failures.push('batch-cost-secondary');
      if (!card.textContent.includes('MANUFACTURING COST / UNIT') || !card.textContent.includes('TOTAL BATCH COST')) failures.push('cost-labels');
    }
    return failures;
  }

  installStyles();
  fixHeaderClockLayout();
  installCalculatorObserver();

  app.finalUiPolish = {
    recipeLabel,
    duplicateFinalLabels,
    polishRecipeOptions,
    polishCostFlow,
    fixHeaderClockLayout,
    selfTest
  };
})();