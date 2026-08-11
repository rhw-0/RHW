/* ==========================================================================
   RHW WEB APP · V4.0 FINAL RELEASE POLISH
   - makes duplicate recipe display names globally distinguishable
   - clarifies batch build cost vs cost per unit
   - moves the system clock out of the uplink stat grid into the uplink header
   ========================================================================== */
(function initRhwV4FinalReleasePolish() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.releasePolish) return;

  const STYLE_ID = 'rhwV40FinalReleasePolishStyle';
  let operationsObserver = null;
  let polishQueued = false;

  const normalize = value => app.util.normalize(String(value || ''));
  const humanize = value => String(value || '')
    .replace(/^recipe_/, '')
    .replace(/^module_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

  function aliasFor(recipe) {
    const aliases = app.operations?.recipeAliases || {};
    if (aliases[recipe?.id]) return aliases[recipe.id];
    const outputId = recipe?.outputs?.[0]?.id;
    return Object.values(aliases).find(alias => alias.outputId === outputId) || null;
  }

  function baseRecipeName(recipe) {
    const alias = aliasFor(recipe);
    if (alias?.name) return alias.name;
    const output = recipe?.outputs?.[0];
    const product = output ? core.product(output.id) : null;
    return product?.name || output?.name || recipe?.name || recipe?.id || 'UNKNOWN RECIPE';
  }

  function variantName(recipe, baseName = baseRecipeName(recipe)) {
    const id = String(recipe?.id || '').toLowerCase();
    const patterns = [
      [/(?:^|_)basic(?:$|_)/, 'BASIC'],
      [/(?:^|_)(?:advanced|adv)(?:$|_)/, 'ADVANCED'],
      [/(?:^|_)bulk(?:$|_)/, 'BULK'],
      [/(?:^|_)standard(?:$|_)/, 'STANDARD'],
      [/(?:^|_)prototype(?:$|_)/, 'PROTOTYPE'],
      [/(?:^|_)heavy(?:$|_)/, 'HEAVY'],
      [/(?:^|_)light(?:$|_)/, 'LIGHT'],
      [/(?:^|_)large(?:$|_)/, 'LARGE'],
      [/(?:^|_)medium(?:$|_)/, 'MEDIUM'],
      [/(?:^|_)small(?:$|_)/, 'SMALL']
    ];
    for (const [pattern, label] of patterns) if (pattern.test(id)) return label;
    const tier = id.match(/(?:^|_)(?:tier|mk)(\d+)(?:$|_)/);
    if (tier) return `MK ${tier[1]}`;

    const craft = String(recipe?.craftType || '').trim();
    if (craft && normalize(craft) !== normalize(baseName)) return humanize(craft).toUpperCase();
    const rawName = String(recipe?.name || '').trim();
    if (rawName && normalize(rawName) !== normalize(baseName)) return rawName.toUpperCase();
    return humanize(recipe?.id || 'VARIANT').toUpperCase();
  }

  function cycleOutput(recipe) {
    const corrected = app.recipeCorrections?.outputFor?.(recipe, app.config.operations.defaultAffiliation);
    return Math.max(0, Number(corrected?.qty ?? recipe?.outputs?.[0]?.qty) || 0);
  }

  function recipeLabelMap() {
    const recipes = [...(core.state.catalog?.recipes || [])];
    const groups = new Map();
    recipes.forEach(recipe => {
      const name = baseRecipeName(recipe);
      const key = normalize(name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(recipe);
    });

    const labels = new Map();
    for (const recipesInGroup of groups.values()) {
      if (recipesInGroup.length === 1) {
        labels.set(recipesInGroup[0].id, baseRecipeName(recipesInGroup[0]));
        continue;
      }
      const used = new Set();
      recipesInGroup.forEach(recipe => {
        const base = baseRecipeName(recipe);
        const variant = variantName(recipe, base);
        const output = cycleOutput(recipe);
        let label = `${base} · ${variant}${output > 0 ? ` · ${output.toLocaleString('en-US')}/CYCLE` : ''}`;
        if (used.has(normalize(label))) label = `${label} · ${humanize(recipe.id).toUpperCase()}`;
        used.add(normalize(label));
        labels.set(recipe.id, label);
      });
    }
    return labels;
  }

  function duplicateAudit() {
    const labels = recipeLabelMap();
    const collisions = [];
    const seen = new Map();
    for (const [id, label] of labels) {
      const key = normalize(label);
      if (seen.has(key)) collisions.push([seen.get(key), id, label]);
      else seen.set(key, id);
    }
    return { labels, collisions };
  }

  function polishRecipeOptions() {
    const select = document.getElementById('opsRecipe');
    if (!select || !core.state.catalog) return;
    const { labels } = duplicateAudit();
    [...select.options].forEach(option => {
      const label = labels.get(option.value);
      if (label && option.textContent !== label) option.textContent = label;
    });
  }

  function polishCostCard() {
    const card = document.querySelector('#workspaceOperations .ops-flow-cost');
    if (!card) return;
    const kicker = card.querySelector(':scope > small');
    const totalLabel = card.querySelector(':scope > span');
    const unitLabel = card.querySelector(':scope > div em');
    if (kicker && kicker.textContent !== '01 · BATCH BUILD COST') kicker.textContent = '01 · BATCH BUILD COST';
    if (totalLabel && totalLabel.textContent !== 'TOTAL FOR THIS BATCH') totalLabel.textContent = 'TOTAL FOR THIS BATCH';
    if (unitLabel && unitLabel.textContent !== 'COST / UNIT') unitLabel.textContent = 'COST / UNIT';
    card.querySelector(':scope > div')?.classList.add('ops-cost-unit-highlight');
  }

  function moveHeaderClock() {
    const clock = document.getElementById('headerClock');
    const header = document.querySelector('.uplink-header');
    const stat = clock?.closest('.uplink-stat');
    if (!clock || !header || !stat) return false;
    stat.classList.add('v40-header-clock-stat');
    if (stat.parentElement !== header) header.appendChild(stat);
    return true;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ops-flow-cost .ops-cost-unit-highlight{
        margin-top:11px!important;padding-top:10px!important;border-top:1px solid rgba(212,175,55,.18)!important
      }
      .ops-flow-cost .ops-cost-unit-highlight em{
        font-size:8.5px!important;letter-spacing:.09em!important;color:rgba(224,224,224,.58)!important
      }
      .ops-flow-cost .ops-cost-unit-highlight b{
        display:block!important;margin-top:2px!important;font-family:var(--font-display)!important;
        font-size:22px!important;line-height:1!important;color:#f0d06b!important;letter-spacing:.03em!important
      }
      .uplink-header{flex-wrap:wrap!important}
      .v40-header-clock-stat{
        margin-left:auto!important;padding-left:14px!important;border-left:1px solid rgba(212,175,55,.18)!important;
        text-align:right!important;align-items:flex-end!important;min-width:118px!important
      }
      .v40-header-clock-stat .uplink-label{margin-bottom:2px!important}
      .v40-header-clock-stat #headerClock{font-size:15px!important;color:var(--gold)!important}
      @media(max-width:560px){
        .v40-header-clock-stat{
          width:100%!important;margin-left:22px!important;padding:9px 0 0!important;border-left:0!important;
          border-top:1px dashed rgba(255,255,255,.08)!important;align-items:flex-start!important;text-align:left!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  function polishOperations() {
    polishRecipeOptions();
    polishCostCard();
  }

  function queuePolish() {
    if (polishQueued) return;
    polishQueued = true;
    queueMicrotask(() => {
      polishQueued = false;
      polishOperations();
    });
  }

  function installOperationsObserver() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace || workspace.dataset.v40FinalPolishObserver === 'true') return;
    workspace.dataset.v40FinalPolishObserver = 'true';
    operationsObserver = new MutationObserver(queuePolish);
    operationsObserver.observe(workspace, { childList: true, subtree: true });
    queuePolish();
  }

  function install() {
    installStyles();
    moveHeaderClock();
    installOperationsObserver();
    polishOperations();
  }

  const baseInit = app.operations?.init;
  if (typeof baseInit === 'function') {
    app.operations.init = async function finalReleasePolishAwareInit(...args) {
      const result = await baseInit.apply(this, args);
      install();
      return result;
    };
  }

  function selfTest() {
    const failures = [];
    const audit = duplicateAudit();
    if (audit.collisions.length) failures.push(`recipe-label-collisions:${audit.collisions.length}`);
    const gold = [...(core.state.catalog?.recipes || [])].filter(recipe => /recipe_gold/i.test(recipe.id || ''));
    if (gold.length > 1) {
      const labels = gold.map(recipe => audit.labels.get(recipe.id));
      if (new Set(labels).size !== labels.length) failures.push('gold-labels');
    }
    if (!document.querySelector('.v40-header-clock-stat #headerClock')) failures.push('header-clock-placement');
    return failures;
  }

  install();
  app.releasePolish = { install, baseRecipeName, variantName, recipeLabelMap, duplicateAudit, selfTest };
})();