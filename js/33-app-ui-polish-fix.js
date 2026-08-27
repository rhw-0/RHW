/* ==========================================================================
   RHW UI POLISH FIX
   Keeps the unified visual system while clarifying workspace hierarchy,
   moving maintenance data behind the actual tool, restoring Logistics scans,
   and removing the redundant mobile COMMAND return control.
   ========================================================================== */
(function initRhwUiPolishFix() {
  'use strict';
  const app = window.RHWV4;
  if (!app || app.uiPolish) return;

  const base = {
    installShell: app.installShell,
    setActiveNode: app.setActiveNode,
    commandInit: app.command?.init,
    commandActivate: app.command?.activate,
    operationsInit: app.operations?.init,
    operationsActivate: app.operations?.activate,
    discoveryInit: app.discoveryStatus?.init
  };
  let discoveryObserver = null;

  function installStyles() {
    if (document.getElementById('rhwUiPolishFixStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwUiPolishFixStyle';
    style.textContent = `
      /* The old floating return button adds no value while the real module nav is
         already sticky/reachable. Keep the element for legacy self-tests only. */
      #commandTopButton{display:none!important}

      /* Discovery provenance is a maintenance utility, not the first Calculator
         surface. It lives collapsed after the actual tool. */
      .rhw-data-status-utility{
        margin:14px 0 0;border:1px solid rgba(120,173,138,.20);border-radius:8px;
        background:linear-gradient(90deg,rgba(120,173,138,.055),rgba(5,8,10,.95) 48%);
        box-shadow:0 10px 24px rgba(0,0,0,.18);overflow:hidden
      }
      .rhw-data-status-utility>summary{
        min-height:54px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;
        padding:8px 12px;cursor:pointer;list-style:none;color:#d9e6de;font-family:var(--font-tech);user-select:none
      }
      .rhw-data-status-utility>summary::-webkit-details-marker{display:none}
      .rhw-data-status-utility>summary::before{
        content:'DATA';display:grid;place-items:center;min-width:38px;height:28px;border:1px solid rgba(120,173,138,.24);
        background:rgba(120,173,138,.06);color:#8db99a;font-size:7px;font-weight:700;letter-spacing:.09em
      }
      .rhw-data-status-copy{display:grid;gap:3px;min-width:0}
      .rhw-data-status-copy strong{font-size:10px;letter-spacing:.08em;color:#dce9e1}
      .rhw-data-status-copy small{font-size:7px;letter-spacing:.065em;color:rgba(177,194,185,.58);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .rhw-data-status-live{padding:5px 7px;border:1px solid rgba(120,173,138,.2);background:rgba(120,173,138,.045);color:#8db99a;font-size:7px;font-weight:700;letter-spacing:.07em;white-space:nowrap}
      .rhw-data-status-live[data-tone="danger"]{border-color:rgba(199,94,94,.28);background:rgba(199,94,94,.07);color:#d97979}
      .rhw-data-status-live[data-tone="warn"]{border-color:rgba(201,139,44,.28);background:rgba(201,139,44,.07);color:#d4a056}
      .rhw-data-status-utility[open]>summary{border-bottom:1px solid rgba(120,173,138,.14)}
      .rhw-data-status-utility #discoveryDataStatus{margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}

      /* Make the regional external-market scan impossible to lose inside the
         Logistics hierarchy. Known fixed links remain directly below it. */
      body[data-workspace="command"][data-command-node="logistics"] #marketScanSection,
      body[data-workspace="command"][data-command-node="logistics"] #fixedLogisticsSection{
        display:block!important;visibility:visible!important;opacity:1!important
      }
      body[data-workspace="command"][data-command-node="logistics"] #marketScanSection{
        margin-top:0!important;margin-bottom:14px!important
      }

      /* Global workspace navigation uses the same squared industrial language as
         the large module cards. On phones it is simply the compact/thumb version. */
      @media(max-width:760px){
        .rhw-unified-ui .app-tabs{
          padding:4px!important;gap:0!important;border-radius:9px!important;overflow:hidden;
          background:rgba(4,6,8,.97)!important
        }
        .rhw-unified-ui .app-tabs button{
          display:grid!important;grid-template-columns:24px minmax(0,1fr)!important;
          grid-template-areas:"workspace-index workspace-title"!important;align-items:center!important;
          justify-items:stretch!important;column-gap:7px!important;min-height:50px!important;padding:7px 8px!important;
          border-radius:0!important;background:rgba(0,0,0,.12)!important;text-align:left!important;
          box-shadow:none!important
        }
        .rhw-unified-ui .app-tabs button+button{border-left:1px solid rgba(255,255,255,.055)!important}
        .rhw-unified-ui .app-tabs button small{display:none!important}
        .rhw-unified-ui .app-tabs .rhw-workspace-index{
          grid-area:workspace-index!important;display:grid!important;width:22px!important;height:22px!important;
          font-size:6.5px!important
        }
        .rhw-unified-ui .app-tabs button span{
          grid-area:workspace-title!important;font-size:11px!important;letter-spacing:.055em!important;white-space:nowrap
        }
        .rhw-unified-ui .app-tabs button::before{display:none!important}
        .rhw-unified-ui .app-tabs button.active{
          background:linear-gradient(180deg,rgba(var(--tab-accent-rgb),.16),rgba(var(--tab-accent-rgb),.035))!important;
          box-shadow:inset 3px 0 0 var(--tab-accent),inset 0 0 20px rgba(var(--tab-accent-rgb),.04)!important
        }
        .rhw-data-status-utility{margin:12px 9px 0}
        .rhw-data-status-utility>summary{min-height:50px;padding:7px 9px;gap:8px}
        .rhw-data-status-copy strong{font-size:9px}.rhw-data-status-copy small{font-size:6px}
        .rhw-data-status-live{font-size:6px;padding:4px 5px}
      }
      @media(max-width:390px){
        .rhw-unified-ui .app-tabs button{grid-template-columns:20px minmax(0,1fr)!important;column-gap:5px!important;padding-inline:5px!important}
        .rhw-unified-ui .app-tabs .rhw-workspace-index{width:19px!important;height:19px!important;font-size:6px!important}
        .rhw-unified-ui .app-tabs button span{font-size:9.5px!important;letter-spacing:.035em!important}
      }
    `;
    document.head.appendChild(style);
  }

  function relabelFabrication() {
    const tab = document.querySelector('.app-tabs [data-workspace="operations"]');
    const label = tab?.querySelector(':scope > span');
    if (label) label.textContent = 'FABRICATION';
    const small = tab?.querySelector('small');
    if (small) small.textContent = 'CALCULATOR + ORDERS';
    tab?.setAttribute('aria-label', 'FABRICATION: CALCULATOR + ORDERS');

    const workspace = document.getElementById('workspaceOperations');
    workspace?.setAttribute('aria-label', 'Fabrication workspace');
    const nav = document.getElementById('operationsNodeNav');
    nav?.setAttribute('aria-label', 'Fabrication tools');
    const kicker = document.querySelector('.operations-heading .workspace-kicker span');
    if (kicker) kicker.textContent = 'FABRICATION';

    const active = document.getElementById('appActiveNode');
    if (active?.textContent?.includes('OPERATIONS /')) active.textContent = active.textContent.replace('OPERATIONS /', 'FABRICATION /');
  }

  function updateDiscoverySummary() {
    const summary = document.getElementById('rhwDataStatusSummary');
    if (!summary) return;
    const panel = document.getElementById('discoveryDataStatus');
    const catalog = panel?.querySelector('.discovery-data-grid article:first-child strong')?.textContent?.trim() || 'CATALOG READY';
    const catalogState = panel?.querySelector('.discovery-state')?.textContent?.trim() || 'READY';
    const live = document.getElementById('discoveryLiveState');
    const liveText = live?.textContent?.trim() || 'NOT CHECKED';
    const liveTone = live?.dataset.tone || 'muted';
    summary.innerHTML = `<span class="rhw-data-status-copy"><strong>CATALOG + SYNC STATUS</strong><small>${app.util.escape(catalogState)} · ${app.util.escape(catalog)} · DETAILS + MAINTENANCE</small></span><b class="rhw-data-status-live" data-tone="${app.util.escape(liveTone)}">${app.util.escape(liveText)}</b>`;
  }

  function relocateDiscoveryPanel() {
    const panel = document.getElementById('discoveryDataStatus');
    const calculatorPanel = document.querySelector('[data-operations-panel="calculator"]');
    if (!panel || !calculatorPanel) return false;

    let details = document.getElementById('rhwDataStatusUtility');
    if (!details) {
      details = document.createElement('details');
      details.id = 'rhwDataStatusUtility';
      details.className = 'rhw-data-status-utility';
      const summary = document.createElement('summary');
      summary.id = 'rhwDataStatusSummary';
      summary.setAttribute('aria-label', 'Open Discovery catalog and sync details');
      details.appendChild(summary);
      calculatorPanel.appendChild(details);
    }
    if (panel.parentElement !== details) details.appendChild(panel);
    details.open = false;
    updateDiscoverySummary();

    discoveryObserver?.disconnect();
    discoveryObserver = new MutationObserver(updateDiscoverySummary);
    discoveryObserver.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-tone'] });
    return true;
  }

  function restoreMarketScan() {
    const external = document.getElementById('externalLogisticsPanel');
    const fixed = document.getElementById('fixedLogisticsSection');
    const market = document.getElementById('marketScanSection');
    const grid = document.getElementById('marketScanGrid');
    if (!external || !market || !grid) return false;

    [market, fixed].filter(Boolean).forEach(section => {
      section.hidden = false;
      section.removeAttribute('hidden');
      section.style.removeProperty('display');
      section.style.removeProperty('visibility');
      section.style.removeProperty('opacity');
    });

    /* Regional scan is the broad "other POBs" view, so put it ahead of the two
       fixed RHW procurement links instead of burying it below them. */
    if (fixed?.parentElement === external && market.parentElement === external && market.nextElementSibling !== fixed) {
      fixed.insertAdjacentElement('beforebegin', market);
    } else if (market.parentElement !== external) {
      if (fixed?.parentElement === external) fixed.insertAdjacentElement('beforebegin', market);
      else external.appendChild(market);
    }

    try {
      if (typeof window.renderMarketScan === 'function') window.renderMarketScan();
    } catch {}
    return true;
  }

  function selfTest() {
    const failures = [];
    if (document.querySelector('.app-tabs [data-workspace="operations"] > span')?.textContent !== 'FABRICATION') failures.push('fabrication-label');
    if (!document.getElementById('rhwDataStatusUtility')?.contains(document.getElementById('discoveryDataStatus'))) failures.push('discovery-hierarchy');
    if (!document.getElementById('marketScanSection') || !document.getElementById('marketScanGrid')) failures.push('market-scan');
    if (!document.getElementById('commandTopButton')) failures.push('legacy-command-top-anchor');
    return failures;
  }

  installStyles();

  app.setActiveNode = function polishedActiveNode(value) {
    const next = String(value || '').replace(/^OPERATIONS\b/, 'FABRICATION');
    return base.setActiveNode.call(this, next);
  };

  app.installShell = function polishedInstallShell(...args) {
    const result = base.installShell.apply(this, args);
    relabelFabrication();
    return result;
  };

  if (typeof base.commandInit === 'function') {
    app.command.init = function polishedCommandInit(...args) {
      const result = base.commandInit.apply(this, args);
      relabelFabrication();
      restoreMarketScan();
      return result;
    };
  }

  if (typeof base.commandActivate === 'function') {
    app.command.activate = function polishedCommandActivate(node, options) {
      const result = base.commandActivate.call(this, node, options);
      if (node === 'logistics') requestAnimationFrame(restoreMarketScan);
      return result;
    };
  }

  if (typeof base.operationsInit === 'function') {
    app.operations.init = async function polishedOperationsInit(...args) {
      const result = await base.operationsInit.apply(this, args);
      relabelFabrication();
      return result;
    };
  }

  if (typeof base.operationsActivate === 'function') {
    app.operations.activate = function polishedOperationsActivate(node, options) {
      const result = base.operationsActivate.call(this, node, options);
      relabelFabrication();
      return result;
    };
  }

  if (typeof base.discoveryInit === 'function') {
    app.discoveryStatus.init = async function polishedDiscoveryInit(...args) {
      const result = await base.discoveryInit.apply(this, args);
      if (!relocateDiscoveryPanel()) throw new Error('UI POLISH COULD NOT RELOCATE DISCOVERY STATUS');
      const failures = selfTest();
      if (failures.length) throw new Error(`UI POLISH SELF TEST FAILED: ${failures.join(', ')}`);
      return result;
    };
  }

  app.uiPolish = {
    relabelFabrication,
    relocateDiscoveryPanel,
    restoreMarketScan,
    updateDiscoverySummary,
    selfTest
  };
})();
