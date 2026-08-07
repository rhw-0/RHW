/* ==========================================================================
   RHW WEB APP · V4.0 OPERATIONS UI
   Item Calculator / Fabrication Planner + Shipyard planning bridge.
   ========================================================================== */
(function initRhwV4OperationsUi() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core) return;

  const NODES = Object.freeze([['calculator', 'ITEM CALCULATOR', 'FABRICATION PLANNER']]);
  let rerenderTimer = null;

  function esc(value) { return app.util.escape(value); }
  function fmt(value) { return app.util.number(Math.max(0, Number(value) || 0)); }
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
      recipeId: base.recipeId || '', quantity: Math.max(1, Number(base.quantity) || 1),
      affiliationId: base.affiliationId || app.config.operations.defaultAffiliation,
      useInventory: base.useInventory !== false, recursive: base.recursive !== false,
      routingPolicy: base.routingPolicy === 'first' ? 'first' : 'stock', activeView: base.activeView || 'requirements',
      search: base.search || '', altSelections: { ...(base.altSelections || {}) }
    };
  }

  function saveState(next) {
    app.state.calculator = { ...currentState(), ...next };
    app.store.set(app.config.storageKeys.calculatorState, app.state.calculator);
  }

  function workspaceMarkup() {
    return `<div class="operations-frame">
      <header class="workspace-heading operations-heading">
        <div><div class="workspace-kicker"><span>OPERATIONS</span> RHW INDUSTRIAL PLANNING NETWORK</div><h2>ITEM CALCULATOR</h2><p>DISCOVERY RECIPE DATABASE // IFF-AWARE FABRICATION PLANNING</p></div>
        <div class="workspace-status" id="operationsStatus" data-tone="muted">LOADING RECIPE DATABASE</div>
      </header>
      <nav id="operationsNodeNav" class="workspace-subnav operations-subnav" aria-label="Operations tools"><div class="workspace-subnav-label">OPERATIONS NODES</div><div class="workspace-subnav-tabs"><button type="button" data-operations-node="calculator" class="active"><span>ITEM CALCULATOR</span><small>FABRICATION PLANNER</small></button></div></nav>
      <div id="operationsNodeHost" class="operations-node-host"><section data-operations-panel="calculator" class="operations-node-panel"><div id="operationsCalculatorMount" class="ops-loading">LOADING DISCOVERY RECIPE DATABASE…</div></section></div>
    </div>`;
  }

  function productOptions(catalog, calc) {
    const q = app.util.normalize(calc.search);
    const products = (catalog.products || []).filter(product => !q || app.util.normalize(`${product.name} ${product.id}`).includes(q));
    return products.slice(0, 250).map(product => `<option value="${esc(product.id)}"${product.id === calc.productId ? ' selected' : ''}>${esc(product.name)}${product.recipeIds?.length > 1 ? ` · ${product.recipeIds.length} RECIPES` : ''}</option>`).join('');
  }

  function factionOptions(catalog, calc) {
    const factions = [{ id: '__none__', name: 'NO AFFILIATION BONUS' }, ...(catalog.factions || [])];
    return factions.map(faction => `<option value="${esc(faction.id)}"${faction.id === calc.affiliationId ? ' selected' : ''}>${esc(faction.name)}${faction.id === 'br_m_grp' ? ' · RHW / BMM' : ''}</option>`).join('');
  }

  function recipeOptions(productId, calc) {
    const recipes = core.recipesFor(productId);
    return recipes.map((recipe, index) => `<option value="${esc(recipe.id)}"${recipe.id === calc.recipeId || (!calc.recipeId && index === 0) ? ' selected' : ''}>${esc(recipe.name)}${recipe.craftType ? ` · ${esc(recipe.craftType)}` : ''}</option>`).join('');
  }

  function alternativeControls(plan, calc) {
    const groups = (plan.rootRecipe.inputs || []).map((group, index) => ({ group, index })).filter(entry => (entry.group.options || []).length > 1);
    if (!groups.length) return '';
    return `<section class="ops-alt-controls"><div class="ops-subhead"><small>INPUT ROUTING</small><strong>ALTERNATIVE MATERIALS</strong></div>${groups.map(({ group, index }) => {
      const key = `${plan.rootRecipe.id}:${index}`; const current = calc.altSelections[key] || '__auto__';
      return `<label class="comms-field"><span>${esc((group.options || []).map(option => option.name).join(' / '))}</span><select data-alt-group="${esc(key)}"><option value="__auto__"${current === '__auto__' ? ' selected' : ''}>AUTO · ${calc.routingPolicy === 'stock' ? 'BEST STOCK / CRAFTABLE' : 'FIRST MASTER OPTION'}</option>${group.options.map(option => `<option value="${esc(option.id)}"${current === option.id ? ' selected' : ''}>${esc(option.name)} · ${fmt(option.qty)} / CYCLE</option>`).join('')}</select></label>`;
    }).join('')}</section>`;
  }

  function summaryMarkup(plan) {
    const iffName = plan.affiliationId === '__none__' ? 'NONE' : (core.state.catalog.factions.find(f => f.id === plan.affiliationId)?.name || plan.affiliationId);
    const externalQty = plan.external.reduce((sum, entry) => sum + entry.qty, 0);
    return `<div class="ops-summary">
      <div class="ops-target-name"><small>ACTIVE PRODUCTION TARGET</small><strong>${esc(plan.product.name)}</strong><span>${esc(plan.rootRecipe.name)} // ${esc(plan.rootRecipe.craftType || 'GENERAL FABRICATION')}</span></div>
      <div class="ops-summary-grid"><div><small>TARGET</small><strong>${fmt(plan.targetQty)}</strong></div><div><small>CYCLES</small><strong>${fmt(plan.cycles)}</strong></div><div><small>ACTUAL OUTPUT</small><strong>${fmt(plan.actualOutput)}</strong></div><div><small>SURPLUS</small><strong>${fmt(plan.surplus)}</strong></div><div><small>IFF FACTOR</small><strong>${plan.rootFactor.toFixed(2)}×</strong></div><div><small>PROCESS TIME</small><strong>${timeLabel(plan.totalTime)}</strong></div></div>
      <div class="ops-readiness"><div><span>DIRECT STOCK COVERAGE</span><strong>${plan.useInventory ? `${plan.directCoverage}%` : 'RECIPE MODE'}</strong></div><div class="ops-readiness-bar"><i style="width:${plan.useInventory ? plan.directCoverage : 100}%"></i></div></div>
      <div class="ops-summary-flags"><span class="${plan.external.length ? 'warn' : 'good'}">${plan.external.length ? `${plan.external.length} EXTERNAL LINES // ${fmt(externalQty)} UNITS` : 'NO EXTERNAL MATERIAL DEFICIT'}</span><span>${fmt(plan.processCount)} PRODUCTION PROCESSES</span><span>${esc(iffName)}</span><span>${plan.telemetryReady ? 'LIVE RHW INVENTORY' : 'RECIPE DATABASE ONLY'}</span></div>
    </div>`;
  }

  function requirementsMarkup(plan) {
    if (!plan.directRequirements.length) return '<div class="ops-empty good">NO CONSUMED INPUTS FOR THIS RECIPE</div>';
    return `<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>MATERIAL</th><th>REQUIRED</th><th>RHW STOCK</th><th>DIRECT GAP</th></tr></thead><tbody>${plan.directRequirements.map(row => `<tr><td><strong>${esc(row.item.name)}</strong><small>${row.groupKind.includes('alternative') ? 'ALTERNATIVE INPUT' : 'DIRECT INPUT'}</small></td><td>${fmt(row.required)}</td><td>${plan.useInventory ? fmt(row.stockAvailable) : '—'}</td><td class="${row.gapBeforeCrafting ? 'ops-gap' : 'ops-covered'}">${fmt(row.gapBeforeCrafting)}</td></tr>`).join('')}</tbody></table></div><div class="ops-result-note">DIRECT GAP IS BEFORE RECURSIVE CRAFTING. OPEN PRODUCTION TREE OR RAW / EXTERNAL TO SEE THE COMPLETE PLAN.</div>`;
  }

  function treeNode(node, depth = 0) {
    const itemName = node.item?.name || node.item?.id || 'ITEM';
    const meta = node.type === 'recipe' ? `${fmt(node.required)} TARGET // ${fmt(node.cycles)} CYCLES // ${fmt(node.actualOutput)} OUTPUT` : `${fmt(node.required)} REQUIRED // ${fmt(node.usedStock || 0)} STOCK // ${fmt(node.missing || 0)} GAP`;
    return `<div class="ops-tree-node status-${node.type}" style="--ops-depth:${depth}"><div class="ops-tree-line"><span>${esc(node.type.toUpperCase())}</span><div><strong>${esc(itemName)}</strong><small>${esc(meta)}</small></div></div>${(node.children || []).length ? `<div class="ops-tree-children">${node.children.map(child => treeNode(child, depth + 1)).join('')}</div>` : ''}</div>`;
  }

  function rawMarkup(plan) {
    if (!plan.external.length) return '<div class="ops-empty good">ALL CONSUMED INPUTS ARE COVERED BY RHW STOCK AND/OR CRAFTABLE INTERMEDIATES<small>NO EXTERNAL PROCUREMENT REQUIRED</small></div>';
    return `<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>EXTERNAL MATERIAL</th><th>DEFICIT</th></tr></thead><tbody>${plan.external.map(row => `<tr><td><strong>${esc(row.name)}</strong><small>${esc(row.id)}</small></td><td class="ops-gap">${fmt(row.qty)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function outputsMarkup(plan) {
    const outputRows = [{ name: plan.product.name, qty: plan.actualOutput, label: plan.surplus ? `TARGET ${fmt(plan.targetQty)} // SURPLUS +${fmt(plan.surplus)}` : 'TARGET OUTPUT' }, ...plan.byproducts.map(row => ({ name: row.name, qty: row.qty, label: 'BYPRODUCT' }))];
    return `<div class="ops-output-grid"><section><div class="ops-subhead"><small>OUTPUT LEDGER</small><strong>PRODUCTS / BYPRODUCTS</strong></div><div class="ops-output-list">${outputRows.map(row => `<div><span>${esc(row.name)}<small>${esc(row.label)}</small></span><strong>${fmt(row.qty)}</strong></div>`).join('')}</div></section><section><div class="ops-subhead"><small>RETAINED AVAILABILITY</small><strong>CATALYSTS / PERSONNEL</strong></div><div class="ops-output-list">${plan.catalysts.length ? plan.catalysts.map(row => `<div><span>${esc(row.name)}<small>${plan.useInventory ? `RHW STOCK ${fmt(row.stock)}` : 'NOT CONSUMED PER CYCLE'}</small></span><strong class="${plan.useInventory && row.stock < row.qty ? 'ops-gap' : ''}">${fmt(row.qty)}</strong></div>`).join('') : '<div><span>NO CATALYST REQUIREMENT</span><strong>—</strong></div>'}</div><div class="ops-result-note">CATALYSTS / PERSONNEL ARE TREATED AS RETAINED AVAILABILITY, NOT CONSUMED ONCE PER PRODUCTION CYCLE.</div></section></div>`;
  }

  function resultMarkup(plan, calc) {
    const view = calc.activeView;
    const body = view === 'tree' ? `<div class="ops-tree">${treeNode(plan.tree)}</div>` : view === 'raw' ? rawMarkup(plan) : view === 'outputs' ? outputsMarkup(plan) : requirementsMarkup(plan);
    return `<section class="ops-panel ops-results-panel"><div class="ops-panel-head"><div><span>03</span><strong>FABRICATION ANALYSIS</strong></div><small>${plan.telemetryReady ? 'LIVE INVENTORY LINKED' : 'DATABASE MODE'}</small></div><div class="ops-result-tabs" role="tablist">${[['requirements','REQUIREMENTS'],['tree','PRODUCTION TREE'],['raw','RAW / EXTERNAL'],['outputs','OUTPUTS']].map(([key,label]) => `<button type="button" data-result-view="${key}" class="${view === key ? 'active' : ''}">${label}</button>`).join('')}</div><div class="ops-results">${body}</div></section>`;
  }

  function procurementText(plan) {
    if (!plan.external.length) return `RHW FABRICATION PLAN // ${plan.product.name}\nNo external procurement deficit detected.`;
    return [`RHW PROCUREMENT DEFICIT`, `TARGET: ${plan.targetQty} × ${plan.product.name}`, `IFF: ${plan.affiliationId}`, '', ...plan.external.map(row => `- ${row.name}: ${Math.ceil(row.qty)} units`)].join('\n');
  }

  function renderCalculator() {
    const mount = document.getElementById('operationsCalculatorMount'); const catalog = core.state.catalog;
    if (!mount || !catalog) return;
    let calc = currentState();
    if (!core.recipesFor(calc.productId).length) calc.productId = catalog.products.find(product => product.recipeIds?.length)?.id || catalog.products[0]?.id;
    const recipes = core.recipesFor(calc.productId); if (!recipes.some(recipe => recipe.id === calc.recipeId)) calc.recipeId = recipes[0]?.id || ''; saveState(calc);
    let plan; try { plan = core.buildPlan(calc); } catch (error) { mount.innerHTML = `<div class="ops-empty danger">CALCULATION FAILED<small>${esc(error.message)}</small></div>`; return; }
    core.state.currentPlan = plan;
    mount.className = 'operations-calculator';
    mount.innerHTML = `<div class="operations-layout"><section class="ops-panel"><div class="ops-panel-head"><div><span>01</span><strong>PRODUCTION TARGET</strong></div><small>${fmt(catalog.meta.recipeCount)} MASTER RECIPES</small></div><div class="ops-form-grid">
      <label class="comms-field ops-wide"><span>SEARCH CATALOG</span><input id="opsSearch" type="search" value="${esc(calc.search)}" placeholder="Dunkirk, reactor, gold, module…" /></label>
      <label class="comms-field ops-wide"><span>ITEM / MODULE / CAPITAL HULL</span><select id="opsProduct">${productOptions(catalog, calc)}</select><small>${fmt(catalog.meta.productCount)} BUILD TARGETS // SOURCE: DISCOVERY PUBLIC GAME CONFIG</small></label>
      <label class="comms-field"><span>QUANTITY</span><input id="opsQuantity" type="number" min="1" step="1" value="${fmt(calc.quantity).replace(/,/g,'')}" /></label>
      <label class="comms-field"><span>RECIPE VARIANT</span><select id="opsRecipe">${recipeOptions(calc.productId, calc)}</select><small>${recipes.length > 1 ? `${recipes.length} VARIANTS AVAILABLE` : 'MASTER RECIPE'}</small></label>
      <label class="comms-field ops-wide"><span>AFFILIATION / IFF PROFILE</span><select id="opsAffiliation">${factionOptions(catalog, calc)}</select><small>BMM IS THE RHW DEFAULT // FACTOR APPLIES TO CONSUMED INPUTS + PROCESS TIME</small></label>
      <label class="ops-toggle"><input id="opsUseInventory" type="checkbox"${calc.useInventory ? ' checked' : ''}${core.telemetryReady() ? '' : ' disabled'} /><span><strong>USE RHW LOCAL INVENTORY</strong><small>${core.telemetryReady() ? 'VERIFIED TELEMETRY WILL BE DEDUCTED ACROSS THE FULL PRODUCTION TREE' : 'UNAVAILABLE UNTIL A VERIFIED RHW UPLINK EXISTS'}</small></span></label>
      <label class="ops-toggle"><input id="opsRecursive" type="checkbox"${calc.recursive ? ' checked' : ''} /><span><strong>CRAFT INTERMEDIATE PRODUCTS</strong><small>RECURSIVELY RESOLVE CRAFTABLE INPUTS BEFORE DECLARING EXTERNAL DEFICIT</small></span></label>
      <label class="comms-field ops-wide"><span>ALTERNATIVE INPUT POLICY</span><select id="opsRouting"><option value="stock"${calc.routingPolicy === 'stock' ? ' selected' : ''}>AUTO · BEST LOCAL STOCK / CRAFTABLE</option><option value="first"${calc.routingPolicy === 'first' ? ' selected' : ''}>MASTER FILE · FIRST LISTED OPTION</option></select></label>
    </div>${alternativeControls(plan, calc)}<div class="ops-data-note"><strong>RECIPE DATABASE</strong><span>${fmt(catalog.meta.recipeCount)} RECIPES // ${fmt(catalog.meta.factionCount)} IFF PROFILES // PUBLIC SOURCE: DISCOVERYGC GAMECONFIGPUBLIC</span></div><a class="ops-catalog-source" href="${esc(catalog.meta.sourceUrl)}" target="_blank" rel="noopener">OPEN PUBLIC DISCOVERY CONFIG SOURCE ↗</a></section>
    <section class="ops-panel"><div class="ops-panel-head"><div><span>02</span><strong>BUILD SUMMARY</strong></div><small>AUTO-RECALCULATED</small></div>${summaryMarkup(plan)}<div class="ops-actions"><button type="button" id="opsCopyProcurement" class="ops-primary">COPY PROCUREMENT LIST</button><button type="button" id="opsCreateComms"${plan.external.length ? '' : ' disabled'}>CREATE PROCUREMENT TRANSMISSION</button></div></section></div>${resultMarkup(plan, calc)}`;
    bindCalculatorControls(plan);
  }

  function scheduleRender(patch = {}) { saveState(patch); clearTimeout(rerenderTimer); rerenderTimer = setTimeout(renderCalculator, 30); }

  function bindCalculatorControls(plan) {
    document.getElementById('opsSearch')?.addEventListener('input', event => { const search = event.target.value; saveState({ search }); const select = document.getElementById('opsProduct'); if (select) select.innerHTML = productOptions(core.state.catalog, { ...currentState(), search }); });
    document.getElementById('opsProduct')?.addEventListener('change', event => scheduleRender({ productId: event.target.value, recipeId: '', altSelections: {} }));
    document.getElementById('opsQuantity')?.addEventListener('change', event => scheduleRender({ quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) }));
    document.getElementById('opsRecipe')?.addEventListener('change', event => scheduleRender({ recipeId: event.target.value, altSelections: {} }));
    document.getElementById('opsAffiliation')?.addEventListener('change', event => scheduleRender({ affiliationId: event.target.value }));
    document.getElementById('opsUseInventory')?.addEventListener('change', event => scheduleRender({ useInventory: event.target.checked }));
    document.getElementById('opsRecursive')?.addEventListener('change', event => scheduleRender({ recursive: event.target.checked }));
    document.getElementById('opsRouting')?.addEventListener('change', event => scheduleRender({ routingPolicy: event.target.value, altSelections: {} }));
    document.querySelectorAll('[data-alt-group]').forEach(select => select.addEventListener('change', event => { const calc = currentState(); const selections = { ...calc.altSelections }; if (event.target.value === '__auto__') delete selections[event.target.dataset.altGroup]; else selections[event.target.dataset.altGroup] = event.target.value; scheduleRender({ altSelections: selections }); }));
    document.querySelectorAll('[data-result-view]').forEach(button => button.addEventListener('click', () => scheduleRender({ activeView: button.dataset.resultView })));
    document.getElementById('opsCopyProcurement')?.addEventListener('click', async () => { const copied = await app.util.copy(procurementText(plan)); app.notify(copied ? 'PROCUREMENT LIST COPIED' : 'COPY FAILED', copied ? 'good' : 'warn'); });
    document.getElementById('opsCreateComms')?.addEventListener('click', () => createProcurementTransmission(plan));
  }

  function createProcurementTransmission(plan) {
    if (!plan.external.length || !app.storage) return;
    const template = app.template('procurement'); const current = app.storage.defaultState();
    current.templateKey = 'procurement'; current.recipient = template.recipient || ''; current.encryption = template.encryption || current.encryption; current.classification = template.classification || current.classification; current.salutation = template.salutation || current.salutation; current.closing = template.closing || current.closing;
    current.subject = `Material Procurement Request — ${plan.product.name}`;
    current.message = [`## Production Requirement`, '', `Resolution Heavy Works is preparing production of ${plan.targetQty} × ${plan.product.name}.`, '', `!status IFF PROFILE: ${plan.affiliationId}`, '', `## External Procurement Deficit`, '', ...plan.external.map(row => `- ${row.name} — ${Math.ceil(row.qty)} units`), '', `Please advise availability, lead time and commercial terms.`].join('\n');
    current.draftName = `Procurement — ${plan.product.name}`;
    app.state.comms = app.storage.snapshotSender(app.storage.normalizeState(current)); app.storage.saveCurrent(); app.navigate('comms', 'forum'); app.comms?.renderForm?.(); app.notify('PROCUREMENT TRANSMISSION PREFILLED');
  }

  function installShipyardBridge() {
    const mount = document.getElementById('shipyardControl'); if (!mount || mount.dataset.v40PlannerBridge === 'true') return; mount.dataset.v40PlannerBridge = 'true';
    const enhance = () => {
      mount.querySelectorAll('.hull-registry-row').forEach(row => {
        if (row.querySelector('.shipyard-plan-button')) return; const label = row.querySelector('.hull-registry-name'); if (!label) return; const text = app.util.normalize(label.textContent);
        const target = text.includes('dunkirk') ? app.config.operations.shipyardTargets.dunkirk : text.includes('invincible') ? app.config.operations.shipyardTargets.invincible : null; if (!target) return;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'shipyard-plan-button'; button.textContent = 'PLAN 1 HULL'; button.addEventListener('click', event => { event.stopPropagation(); openTarget(target, 1); }); label.appendChild(button);
      });
    };
    enhance(); new MutationObserver(enhance).observe(mount, { childList: true, subtree: true });
  }

  function openTarget(productId, quantity = 1) { saveState({ productId, quantity, recipeId: '', search: '', activeView: 'requirements', altSelections: {} }); app.navigate('operations', 'calculator'); renderCalculator(); }

  function activate(node, { updateRoute = true } = {}) {
    const valid = node === 'calculator' ? 'calculator' : 'calculator'; app.state.operationsNode = valid; app.store.set(app.config.storageKeys.operationsNode, valid); document.body.dataset.operationsNode = valid; app.setActiveNode('OPERATIONS / ITEM CALCULATOR'); document.title = `RHW OPERATIONS CALCULATOR · ${app.version}`;
    if (updateRoute && app.state.activeWorkspace === 'operations') app.route.write('operations', valid); if (core.state.catalog) renderCalculator();
  }

  async function init() {
    const workspace = document.getElementById('workspaceOperations'); if (!workspace || document.getElementById('operationsNodeNav')) return;
    workspace.innerHTML = workspaceMarkup(); app.state.calculator = { ...currentState(), ...(app.store.get(app.config.storageKeys.calculatorState, {}) || {}) };
    try {
      const catalog = await core.loadCatalog(); const status = document.getElementById('operationsStatus'); if (status) { status.textContent = `${fmt(catalog.meta.recipeCount)} RECIPES // DATABASE READY`; status.dataset.tone = 'good'; } renderCalculator();
    } catch (error) {
      const mount = document.getElementById('operationsCalculatorMount'); if (mount) mount.innerHTML = `<div class="ops-empty danger">RECIPE DATABASE FAILED TO LOAD<small>${esc(error.message)}</small></div>`; const status = document.getElementById('operationsStatus'); if (status) { status.textContent = 'RECIPE DATABASE ERROR'; status.dataset.tone = 'danger'; } throw error;
    }
    installShipyardBridge();
  }

  app.operations = { init, activate, openTarget, renderCalculator, nodes: NODES };
})();
