/* ==========================================================================
   RHW WEB APP · V4.0 FINAL DISPLAY POLISH
   Makes duplicate recipe variants unambiguous, aligns the costing flow on a
   per-unit basis, and gives the system clock the primary top-left uplink slot.
   ========================================================================== */
(function initRhwV4FinalDisplayPolish() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.finalDisplayPolish) return;

  const STYLE_ID = 'rhwV40FinalDisplayPolishStyle';
  let observer = null;
  let queued = false;
  let labelMap = new Map();
  let duplicateGroups = [];

  const normalize = value => app.util.normalize(String(value || ''));
  const formatQty = value => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '1';
    return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
  };

  function aliasFor(recipe) {
    return app.operations?.recipeAliases?.[recipe?.id] || null;
  }

  function baseRecipeName(recipe) {
    const alias = aliasFor(recipe);
    if (alias?.name) return alias.name;
    const output = recipe?.outputs?.[0];
    const product = output?.id ? core.product(output.id) : null;
    return product?.name || output?.name || recipe?.name || recipe?.id || 'UNKNOWN RECIPE';
  }

  function keywordVariant(recipe) {
    const id = String(recipe?.id || '').toLowerCase();
    const rules = [
      [/(?:^|_)bulk(?:_|$)/, 'BULK'],
      [/(?:^|_)(?:advanced|adv)(?:_|$)/, 'ADVANCED'],
      [/(?:^|_)basic(?:_|$)/, 'BASIC'],
      [/(?:^|_)standard(?:_|$)/, 'STANDARD'],
      [/(?:^|_)prototype(?:_|$)/, 'PROTOTYPE'],
      [/(?:^|_)improved(?:_|$)/, 'IMPROVED'],
      [/(?:^|_)heavy(?:_|$)/, 'HEAVY'],
      [/(?:^|_)light(?:_|$)/, 'LIGHT'],
      [/(?:^|_)large(?:_|$)/, 'LARGE'],
      [/(?:^|_)medium(?:_|$)/, 'MEDIUM'],
      [/(?:^|_)small(?:_|$)/, 'SMALL'],
      [/(?:^|_)master(?:_|$)/, 'MASTER']
    ];
    for (const [pattern, label] of rules) if (pattern.test(id)) return label;
    const mark = id.match(/(?:^|_)(?:mk|mark)_?(\d+)(?:_|$)/);
    if (mark) return `MK ${mark[1]}`;
    return '';
  }

  function fallbackVariant(recipe, base) {
    const craft = String(recipe?.craftType || '').trim();
    if (craft && normalize(craft) !== normalize(base)) return craft.toUpperCase();
    const recipeName = String(recipe?.name || '').trim();
    if (recipeName && normalize(recipeName) !== normalize(base)) return recipeName.toUpperCase();
    const tokens = String(recipe?.id || '').split('_').filter(Boolean);
    return (tokens[tokens.length - 1] || recipe?.id || 'VARIANT').toUpperCase();
  }

  function buildRecipeLabels() {
    const recipes = [...(core.state.catalog?.recipes || [])];
    const groups = new Map();
    for (const recipe of recipes) {
      const base = baseRecipeName(recipe);
      const key = normalize(base);
      if (!groups.has(key)) groups.set(key, { base, recipes: [] });
      groups.get(key).recipes.push(recipe);
    }

    const next = new Map();
    const duplicates = [];
    for (const group of groups.values()) {
      if (group.recipes.length === 1) {
        next.set(group.recipes[0].id, group.base);
        continue;
      }
      duplicates.push({ name: group.base, recipeIds: group.recipes.map(recipe => recipe.id) });
      const provisional = group.recipes.map(recipe => {
        const variant = keywordVariant(recipe) || fallbackVariant(recipe, group.base);
        const qty = recipe?.outputs?.[0]?.qty;
        return { recipe, label: `${group.base} · ${variant}${qty !== undefined ? ` · ${formatQty(qty)}/CYCLE` : ''}` };
      });
      const counts = new Map();
      provisional.forEach(item => counts.set(normalize(item.label), (counts.get(normalize(item.label)) || 0) + 1));
      provisional.forEach(item => {
        const label = counts.get(normalize(item.label)) > 1 ? `${item.label} · ${item.recipe.id}` : item.label;
        next.set(item.recipe.id, label);
      });
    }
    labelMap = next;
    duplicateGroups = duplicates;
    return next;
  }

  function patchRecipeOptions() {
    const select = document.getElementById('opsRecipe');
    if (!select || !core.state.catalog) return;
    if (!labelMap.size) buildRecipeLabels();
    [...select.options].forEach(option => {
      const label = labelMap.get(option.value);
      if (label && option.textContent !== label) option.textContent = label;
    });
  }

  function actualOutputText() {
    const block = [...document.querySelectorAll('#workspaceOperations .ops-recipe-meta > div')]
      .find(entry => entry.querySelector('small')?.textContent?.trim() === 'ACTUAL OUTPUT');
    return block?.querySelector('strong')?.textContent?.trim() || '1';
  }

  function patchCostFlow() {
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (!card) return;
    if (card.dataset.rhwUnitFirst !== 'true') {
      const batchNode = card.querySelector('#opsTotalCost');
      const unitNode = card.querySelector('#opsUnitCost');
      if (batchNode && unitNode) {
        const batchText = batchNode.textContent;
        const unitText = unitNode.textContent;
        batchNode.id = 'opsUnitCost';
        unitNode.id = 'opsTotalCost';
        batchNode.textContent = unitText;
        unitNode.textContent = batchText;
      }
      card.dataset.rhwUnitFirst = 'true';
    }

    const topLabel = card.querySelector(':scope > small');
    const topCaption = card.querySelector(':scope > span');
    const detailLabel = card.querySelector(':scope > div em');
    if (topLabel && topLabel.textContent !== '01 · COST / UNIT') topLabel.textContent = '01 · COST / UNIT';
    if (topCaption && topCaption.textContent !== 'MANUFACTURING COST / UNIT') topCaption.textContent = 'MANUFACTURING COST / UNIT';
    const batchLabel = `BATCH COST // ${actualOutputText()} PRODUCED`;
    if (detailLabel && detailLabel.textContent !== batchLabel) detailLabel.textContent = batchLabel;

    const marginCard = document.querySelector('#workspaceOperations .ops-flow-margin');
    if (marginCard) {
      const marginSmall = marginCard.querySelector(':scope > small');
      const marginCopy = marginCard.querySelector(':scope > p');
      if (marginSmall && marginSmall.textContent !== '02 · TARGET PROFIT MARGIN') marginSmall.textContent = '02 · TARGET PROFIT MARGIN';
      const text = 'APPLIED TO COST / UNIT // PROFIT AS SHARE OF SELL PRICE';
      if (marginCopy && marginCopy.textContent !== text) marginCopy.textContent = text;
    }

    const sellCard = document.querySelector('#workspaceOperations .ops-flow-sell');
    if (sellCard) {
      const sellSmall = sellCard.querySelector(':scope > small');
      const sellCaption = sellCard.querySelector(':scope > span');
      if (sellSmall && sellSmall.textContent !== '03 · SALE PRICE / UNIT') sellSmall.textContent = '03 · SALE PRICE / UNIT';
      if (sellCaption && sellCaption.textContent !== 'RECOMMENDED SELL / UNIT') sellCaption.textContent = 'RECOMMENDED SELL / UNIT';
    }

    const panelMeta = document.querySelector('#workspaceOperations .ops-quote-panel .ops-panel-head > small');
    if (panelMeta && panelMeta.textContent !== 'UNIT COST → MARGIN → SELL / UNIT') panelMeta.textContent = 'UNIT COST → MARGIN → SELL / UNIT';
  }

  function headerStatByLabel(label) {
    return [...document.querySelectorAll('.uplink-grid > .uplink-stat')]
      .find(card => card.querySelector('.uplink-label')?.textContent?.trim() === label) || null;
  }

  function patchHeaderClockLayout() {
    const grid = document.querySelector('.uplink-grid');
    if (!grid) return;
    const cards = [
      headerStatByLabel('SYSTEM CLOCK'),
      headerStatByLabel('LATEST SYNC'),
      headerStatByLabel('NEXT SYNC'),
      headerStatByLabel('REFRESH CYCLE')
    ];
    if (cards.some(card => !card)) return;
    const actions = grid.querySelector(':scope > .uplink-actions');
    if (!actions) return;
    cards.forEach(card => grid.insertBefore(card, actions));
    cards.forEach((card, index) => {
      const className = index === 0 ? 'rhw-uplink-clock-primary' : 'rhw-uplink-secondary-stat';
      if (!card.classList.contains(className)) card.classList.add(className);
    });
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .rhw-uplink-clock-primary{padding-left:8px;border-left:2px solid rgba(212,175,55,.45)}
      .rhw-uplink-clock-primary .uplink-label{color:rgba(212,175,55,.72)}
      .rhw-uplink-clock-primary .uplink-value{color:var(--gold)!important}
      .ops-flow-cost[data-rhw-unit-first="true"]>strong{color:#f1f3f4}
      .ops-flow-cost[data-rhw-unit-first="true"]>div b{font-size:12px!important;color:rgba(224,224,224,.72)!important}
      .ops-flow-cost[data-rhw-unit-first="true"]>div em{font-size:7.5px!important}
      @media(max-width:700px){.rhw-uplink-clock-primary{padding-left:7px}}
    `;
    document.head.appendChild(style);
  }

  function patchOperations() {
    patchRecipeOptions();
    patchCostFlow();
  }

  function queuePatch() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      patchOperations();
    });
  }

  function installObserver() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || workspace.dataset.rhwFinalDisplayObserver === 'true') return;
    workspace.dataset.rhwFinalDisplayObserver = 'true';
    observer = new MutationObserver(queuePatch);
    observer.observe(workspace, { childList: true, subtree: true });
  }

  function selfTest() {
    const failures = [];
    if (core.state.catalog) {
      buildRecipeLabels();
      for (const group of duplicateGroups) {
        const labels = group.recipeIds.map(id => labelMap.get(id)).filter(Boolean);
        if (labels.length !== new Set(labels.map(normalize)).size) failures.push(`duplicate-label:${group.name}`);
      }
    }
    const headerOrder = [...document.querySelectorAll('.uplink-grid > .uplink-stat')]
      .slice(0, 4)
      .map(card => card.querySelector('.uplink-label')?.textContent?.trim());
    if (headerOrder.length === 4 && headerOrder.join('|') !== 'SYSTEM CLOCK|LATEST SYNC|NEXT SYNC|REFRESH CYCLE') failures.push('header-clock-order');
    const costCard = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (costCard && costCard.dataset.rhwUnitFirst !== 'true') failures.push('unit-cost-primary');
    return failures;
  }

  function install() {
    installStyles();
    patchHeaderClockLayout();
    installObserver();
    if (core.state.catalog) buildRecipeLabels();
    patchOperations();
  }

  const baseOperationsInit = app.operations?.init;
  if (typeof baseOperationsInit === 'function') {
    app.operations.init = async function finalDisplayPolishOperationsInit(...args) {
      const result = await baseOperationsInit.apply(this, args);
      buildRecipeLabels();
      install();
      return result;
    };
  }

  install();

  app.finalDisplayPolish = {
    install,
    buildRecipeLabels,
    patchRecipeOptions,
    patchCostFlow,
    patchHeaderClockLayout,
    selfTest,
    get duplicateGroups() { return duplicateGroups; },
    get labelMap() { return labelMap; }
  };
})();