/* ==========================================================================
   RHW WEB APP · V4.0 COMMAND
   COMMAND navigation, executive overview, priority actions and inventory views.
   ========================================================================== */
(function initRhwV4Command() {
  'use strict';
  const app = window.RHWV4;
  if (!app) return;

  const NODES = Object.freeze([
    ['overview', 'OVERVIEW', 'EXECUTIVE STATUS'],
    ['inventory', 'INVENTORY', 'STOCK + MANIFEST'],
    ['shipyard', 'SHIPYARD', 'CAPITAL HULLS'],
    ['production', 'PRODUCTION', 'RECIPE CONTROL'],
    ['logistics', 'LOGISTICS', 'REMOTE SUPPLY']
  ]);

  function nodeButtons() {
    return NODES.map(([key, label, sub]) => `<button type="button" data-command-node="${key}"><span>${label}</span><small>${sub}</small></button>`).join('');
  }

  function overviewMarkup() {
    return `<section class="command-overview-panel">
      <div class="command-overview-heading">
        <div><span>COMMAND / OVERVIEW</span><h2>EXECUTIVE STATUS BOARD</h2><p>FACILITY READINESS // BOTTLENECKS // PRIORITY ACTIONS</p></div>
        <div class="command-overview-live"><i></i> LIVE TELEMETRY</div>
      </div>
      <div class="command-overview-grid">
        <button type="button" class="command-overview-card" data-command-jump="inventory"><small>INVENTORY HEALTH</small><strong id="v40OverviewInventory">SCANNING</strong><span id="v40OverviewInventoryMeta">AWAITING STATUS</span></button>
        <button type="button" class="command-overview-card" data-command-jump="shipyard"><small>CAPITAL SHIPYARD</small><strong id="v40OverviewShipyard">SCANNING</strong><span id="v40OverviewShipyardMeta">AWAITING YARD CONTROL</span></button>
        <button type="button" class="command-overview-card" data-command-jump="production"><small>PRODUCTION FLOOR</small><strong id="v40OverviewProduction">SCANNING</strong><span id="v40OverviewProductionMeta">AWAITING MODULE DATA</span></button>
        <button type="button" class="command-overview-card" data-command-jump="logistics"><small>REMOTE LOGISTICS</small><strong id="v40OverviewLogistics">SCANNING</strong><span id="v40OverviewLogisticsMeta">AWAITING SAT-LINK</span></button>
      </div>
      <section class="command-priority-panel">
        <div class="command-priority-head"><div><small>COMMAND QUEUE</small><strong>PRIORITY ACTIONS</strong></div><span id="v40PriorityCount">0 ACTIVE</span></div>
        <div id="v40PriorityList" class="command-priority-list"></div>
      </section>
    </section>`;
  }

  function inventoryMarkup() {
    return `<div class="inventory-view-nav" role="tablist" aria-label="Inventory views">
      <button type="button" data-inventory-view="status"><span>STATUS BOARD</span><small>FACILITY + EXPORT + FEEDSTOCK</small></button>
      <button type="button" data-inventory-view="manifest"><span>FULL MANIFEST</span><small>SEARCH + FILTER + PRICES</small></button>
    </div>
    <section class="inventory-view-panel" data-inventory-panel="status"></section>
    <section class="inventory-view-panel" data-inventory-panel="manifest" hidden></section>`;
  }

  function safeOperationalItems() {
    try { return typeof window.operationalItems === 'function' ? window.operationalItems() : []; }
    catch { return []; }
  }

  function roleSeverity(item) {
    try {
      const roles = typeof window.assetRoles === 'function' ? window.assetRoles(item) : [];
      const states = roles.map(role => ({ role, state: window.stateForRole?.(item, role) || 'ok' }));
      const critical = states.find(entry => entry.state === 'critical');
      if (critical) return critical;
      const low = states.find(entry => entry.state === 'low');
      return low || states[0] || { role: 'other', state: 'ok' };
    } catch {
      return { role: 'other', state: 'ok' };
    }
  }

  function shipyardAnalysis() {
    try {
      if (!window.CAPITAL_SHIPYARD?.components?.length || typeof window.stockFor !== 'function') return null;
      const data = CAPITAL_SHIPYARD.components.map(component => {
        const required = Math.max(1, Number(component.required) || 1);
        const stock = Number(stockFor(component.name)) || 0;
        const coverage = Math.floor(stock / required);
        return { ...component, required, stock, coverage };
      });
      const buildable = Math.min(...data.map(component => component.coverage));
      const next = buildable + 1;
      data.forEach(component => {
        component.gap = Math.max(0, next * component.required - component.stock);
        component.ratio = component.required ? component.gap / component.required : 0;
      });
      const bottleneck = data.reduce((best, current) => {
        if (!best) return current;
        if (current.coverage !== best.coverage) return current.coverage < best.coverage ? current : best;
        if (current.ratio !== best.ratio) return current.ratio > best.ratio ? current : best;
        return current.gap > best.gap ? current : best;
      }, null);
      return { buildable, bottleneck };
    } catch {
      return null;
    }
  }

  function productionAnalysis() {
    try {
      if (!Array.isArray(window.RECIPES) || typeof window.analyzeRecipe !== 'function') return [];
      return RECIPES.map(analyzeRecipe).sort((a, b) => a.possibleCycles - b.possibleCycles);
    } catch {
      return [];
    }
  }

  function priorityActions() {
    const actions = [];
    const verified = typeof window.hasVerifiedTelemetry === 'function' ? window.hasVerifiedTelemetry() : false;
    if (!verified) {
      actions.push({ state: 'critical', node: 'inventory', title: 'RESTORE VERIFIED TELEMETRY', meta: 'LOCAL INVENTORY HAS NOT BEEN VERIFIED' });
      return actions;
    }

    const items = safeOperationalItems();
    items.forEach(item => {
      const severity = roleSeverity(item);
      if (!['critical', 'low'].includes(severity.state)) return;
      let name = item?.name || 'UNKNOWN ASSET';
      try { if (typeof window.displayName === 'function') name = displayName(item); } catch {}
      let deficit = 0;
      try { if (typeof window.needAmount === 'function') deficit = Number(needAmount(item)) || 0; } catch {}
      const node = severity.role === 'shipyard' ? 'shipyard' : 'inventory';
      const role = String(severity.role || 'asset').toUpperCase();
      actions.push({
        state: severity.state,
        node,
        title: `${role} // ${String(name).toUpperCase()}`,
        meta: deficit > 0 ? `DEFICIT ${app.util.number(deficit)} UNITS` : `${severity.state.toUpperCase()} THRESHOLD BREACH`
      });
    });

    const production = productionAnalysis();
    const constrained = production.find(entry => entry.cardState !== 'ok');
    if (constrained?.bottleneck) {
      actions.push({
        state: constrained.cardState,
        node: 'production',
        title: `PRODUCTION // ${String(constrained.recipe.product).toUpperCase()}`,
        meta: `BOTTLENECK ${String(constrained.bottleneck.displayName || constrained.bottleneck.name).toUpperCase()} // NEXT CYCLE +${app.util.number(constrained.nextCycleGap)}`
      });
    }

    const yard = shipyardAnalysis();
    if (yard && yard.buildable <= 1 && yard.bottleneck) {
      actions.push({
        state: yard.buildable <= 0 ? 'critical' : 'low',
        node: 'shipyard',
        title: `SHIPYARD // ${yard.buildable <= 0 ? 'NO HULL READY' : 'RESERVE THIN'}`,
        meta: `NEXT HULL NEEDS +${app.util.number(yard.bottleneck.gap)} ${String(yard.bottleneck.name).toUpperCase()}`
      });
    }

    const order = { critical: 0, low: 1, ok: 2 };
    return actions.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9)).slice(0, 6);
  }

  function renderPriorities() {
    const list = document.getElementById('v40PriorityList');
    const count = document.getElementById('v40PriorityCount');
    if (!list || !count) return;
    const actions = priorityActions();
    count.textContent = `${actions.length} ACTIVE`;
    if (!actions.length) {
      list.innerHTML = '<div class="command-priority-empty"><strong>NO PRIORITY ACTIONS</strong><span>ALL MONITORED COMMAND THRESHOLDS ARE NOMINAL</span></div>';
      return;
    }
    list.innerHTML = actions.map(action => `<button type="button" class="command-priority-item state-${action.state}" data-priority-jump="${action.node}"><span class="priority-state">${action.state.toUpperCase()}</span><span><strong>${app.util.escape(action.title)}</strong><small>${app.util.escape(action.meta)}</small></span><b>OPEN</b></button>`).join('');
  }

  function updateOverview() {
    if (!document.getElementById('v40OverviewInventory')) return;
    const verified = typeof window.hasVerifiedTelemetry === 'function' ? window.hasVerifiedTelemetry() : false;
    if (!verified) {
      document.getElementById('v40OverviewInventory').textContent = 'AWAITING TELEMETRY';
      document.getElementById('v40OverviewInventoryMeta').textContent = 'NO VERIFIED LOCAL INVENTORY';
      document.getElementById('v40OverviewShipyard').textContent = 'AWAITING UPLINK';
      document.getElementById('v40OverviewProduction').textContent = 'SCANNING';
      document.getElementById('v40OverviewLogistics').textContent = 'SAT-LINK SCANNING';
      renderPriorities();
      return;
    }

    const items = safeOperationalItems();
    const states = items.map(roleSeverity);
    const critical = states.filter(entry => entry.state === 'critical').length;
    const low = states.filter(entry => entry.state === 'low').length;
    const exports = items.filter(item => { try { return window.hasAssetRole?.(item, 'export'); } catch { return false; } }).length;
    document.getElementById('v40OverviewInventory').textContent = critical ? `${critical} CRITICAL` : (low ? `${low} LOW` : 'INVENTORY NOMINAL');
    document.getElementById('v40OverviewInventoryMeta').textContent = `${critical} CRITICAL // ${low} LOW // ${exports} EXPORT LINES`;

    const yard = shipyardAnalysis();
    document.getElementById('v40OverviewShipyard').textContent = yard ? `${app.util.number(yard.buildable)} HULL${yard.buildable === 1 ? '' : 'S'} READY` : 'YARD ONLINE';
    document.getElementById('v40OverviewShipyardMeta').textContent = yard?.bottleneck ? `NEXT HULL // ${String(yard.bottleneck.name).toUpperCase()} +${app.util.number(yard.bottleneck.gap)}` : 'CAPITAL CONTROL AVAILABLE';

    const production = productionAnalysis();
    const weakest = production[0];
    document.getElementById('v40OverviewProduction').textContent = weakest ? `MIN ${app.util.number(weakest.possibleCycles)} CYCLES` : 'MODULES ONLINE';
    document.getElementById('v40OverviewProductionMeta').textContent = weakest?.bottleneck ? `${String(weakest.recipe.product).toUpperCase()} // ${String(weakest.bottleneck.displayName || weakest.bottleneck.name).toUpperCase()}` : 'LIVE CAPACITY + BOTTLENECK CONTROL';

    const logisticsState = document.getElementById('supplierLinkText')?.textContent?.trim() || 'SAT-LINK ONLINE';
    const marketState = document.getElementById('marketScanMeta')?.textContent?.trim() || 'MARKET RADAR READY';
    document.getElementById('v40OverviewLogistics').textContent = logisticsState;
    document.getElementById('v40OverviewLogisticsMeta').textContent = marketState;
    renderPriorities();
  }

  function activateInventoryView(view) {
    const valid = ['status', 'manifest'].includes(view) ? view : 'status';
    app.state.inventoryView = valid;
    app.store.set(app.config.storageKeys.inventoryView, valid);
    document.querySelectorAll('[data-inventory-panel]').forEach(panel => { panel.hidden = panel.dataset.inventoryPanel !== valid; });
    document.querySelectorAll('[data-inventory-view]').forEach(button => {
      const active = button.dataset.inventoryView === valid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function activate(node, { updateRoute = true } = {}) {
    const valid = NODES.some(([key]) => key === node) ? node : 'overview';
    app.state.commandNode = valid;
    app.store.set(app.config.storageKeys.commandNode, valid);
    document.body.dataset.commandNode = valid;
    document.querySelectorAll('[data-command-panel]').forEach(panel => { panel.hidden = panel.dataset.commandPanel !== valid; });
    document.querySelectorAll('[data-command-node]').forEach(button => {
      const active = button.dataset.commandNode === valid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
      if (active) requestAnimationFrame(() => button.scrollIntoView?.({ block: 'nearest', inline: 'center' }));
    });
    if (app.state.activeWorkspace === 'command') {
      app.setActiveNode(`COMMAND / ${valid.toUpperCase()}`);
      document.title = `RHW ${valid.toUpperCase()} · ${app.version}`;
      if (updateRoute) app.route.write('command', valid);
    }
    if (valid === 'overview') updateOverview();
  }

  function init() {
    const workspace = document.getElementById('workspaceCommand');
    const strip = document.getElementById('commandStrip');
    const main = workspace?.querySelector('main');
    if (!workspace || !strip || !main || document.getElementById('commandNodeNav')) return;

    const nav = document.createElement('nav');
    nav.id = 'commandNodeNav';
    nav.className = 'workspace-subnav command-subnav';
    nav.setAttribute('aria-label', 'Command sections');
    nav.innerHTML = `<div class="workspace-subnav-label">COMMAND NODES</div><div class="workspace-subnav-tabs">${nodeButtons()}</div>`;
    strip.insertAdjacentElement('afterend', nav);

    const host = document.createElement('div');
    host.id = 'commandNodeHost';
    host.className = 'command-node-host';
    main.prepend(host);

    const panels = {};
    NODES.forEach(([key]) => {
      const panel = document.createElement('section');
      panel.className = 'command-node-panel';
      panel.dataset.commandPanel = key;
      panel.hidden = true;
      host.appendChild(panel);
      panels[key] = panel;
    });
    panels.overview.innerHTML = overviewMarkup();
    panels.inventory.innerHTML = inventoryMarkup();

    const summary = main.querySelector('.summary-grid');
    const manifest = main.querySelector('.manifest-panel');
    const shipyard = document.getElementById('shipyardControl');
    const production = document.getElementById('productionPanel');
    const logistics = document.getElementById('externalLogisticsPanel');
    if (summary) panels.inventory.querySelector('[data-inventory-panel="status"]')?.appendChild(summary);
    if (manifest) panels.inventory.querySelector('[data-inventory-panel="manifest"]')?.appendChild(manifest);
    if (shipyard) panels.shipyard.appendChild(shipyard);
    if (production) panels.production.appendChild(production);
    if (logistics) panels.logistics.appendChild(logistics);

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-command-node]');
      if (button) app.navigate('command', button.dataset.commandNode);
    });
    panels.overview.addEventListener('click', event => {
      const target = event.target.closest('[data-command-jump], [data-priority-jump]');
      const node = target?.dataset.commandJump || target?.dataset.priorityJump;
      if (node) app.navigate('command', node);
    });
    panels.inventory.addEventListener('click', event => {
      const button = event.target.closest('[data-inventory-view]');
      if (button) activateInventoryView(button.dataset.inventoryView);
    });

    activateInventoryView(app.store.get(app.config.storageKeys.inventoryView, 'status'));
    updateOverview();
    clearInterval(app.commandOverviewTimer);
    app.commandOverviewTimer = setInterval(() => {
      if (app.state.commandNode === 'overview') updateOverview();
    }, 2000);
  }

  app.command = { init, activate, updateOverview, activateInventoryView, nodes: NODES };
})();
