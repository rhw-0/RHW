/* ==========================================================================
   RHW STABILITY POLISH
   Makes LOGISTICS immediately discoverable on phones and adds a durable
   MARKET SCAN / FIXED LINKS view switch without changing telemetry logic.
   ========================================================================== */
(function initRhwStabilityPolish() {
  'use strict';
  const app = window.RHWV4;
  if (!app?.command || app.stabilityPolish) return;

  const base = {
    commandInit: app.command.init,
    commandActivate: app.command.activate
  };

  function installStyles() {
    if (document.getElementById('rhwStabilityPolishStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwStabilityPolishStyle';
    style.textContent = `
      .rhw-logistics-view-nav{
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;
        width:100%;margin:0 0 10px;padding:6px;border:1px solid rgba(125,167,234,.24);
        border-radius:8px;background:linear-gradient(90deg,rgba(125,167,234,.075),rgba(5,8,12,.96) 48%);
        box-shadow:0 10px 24px rgba(0,0,0,.24)
      }
      .rhw-logistics-view-nav button{
        position:relative;min-width:0;min-height:52px;padding:8px 11px;border:1px solid rgba(125,167,234,.13);
        border-radius:5px;background:rgba(125,167,234,.025);color:rgba(190,208,235,.68);
        font-family:var(--font-tech);font-size:9px;font-weight:700;letter-spacing:.08em;text-align:center;
        clip-path:none;box-shadow:none
      }
      .rhw-logistics-view-nav button small{display:block;margin-top:2px;color:rgba(159,180,212,.48);font-size:6px;letter-spacing:.07em}
      .rhw-logistics-view-nav button:hover,.rhw-logistics-view-nav button:focus-visible{
        border-color:rgba(125,167,234,.38);background:rgba(125,167,234,.09);color:#dce8fb
      }
      .rhw-logistics-view-nav button[aria-selected="true"]{
        border-color:rgba(125,167,234,.48);background:linear-gradient(180deg,rgba(125,167,234,.17),rgba(125,167,234,.045));
        color:#dce8fb;box-shadow:inset 0 -2px 0 #7da7ea,inset 0 0 20px rgba(125,167,234,.045)
      }
      .rhw-logistics-view-nav button[aria-selected="true"] small{color:rgba(190,208,235,.72)}

      .rhw-fixed-logistics-surface{
        display:block!important;visibility:visible!important;opacity:1!important;width:100%;margin:0!important;
        border:1px solid rgba(125,167,234,.22);border-radius:9px;
        background:linear-gradient(145deg,rgba(125,167,234,.06),rgba(5,8,12,.96) 42%);
        box-shadow:0 14px 34px rgba(0,0,0,.25);overflow:hidden
      }
      .rhw-fixed-logistics-surface .logistics-subhead{
        margin:0;padding:14px 16px;border-bottom:1px solid rgba(125,167,234,.14);
        background:linear-gradient(90deg,rgba(125,167,234,.065),transparent 72%)
      }

      body[data-workspace="command"][data-command-node="logistics"] #commandContextAction{display:none!important}
      body[data-workspace="command"][data-command-node="logistics"] #commandControlDeck{grid-template-columns:minmax(260px,1.45fr) auto}

      body[data-workspace="command"][data-command-node="logistics"] #externalLogisticsPanel{display:none!important}
      body[data-workspace="command"][data-command-node="logistics"][data-logistics-view="market"] [data-command-panel="logistics"]>#fixedLogisticsSection{
        display:none!important
      }
      body[data-workspace="command"][data-command-node="logistics"][data-logistics-view="fixed"] [data-command-panel="logistics"]>#marketScanSection{
        display:none!important
      }

      @media(max-width:980px){
        body[data-workspace="command"][data-command-node="logistics"] #commandControlDeck{grid-template-columns:minmax(0,1fr) auto}
      }
      @media(max-width:760px){
        body[data-workspace="command"][data-command-node="logistics"] #commandControlDeck{grid-template-columns:1fr}
        .rhw-logistics-view-nav{
          position:relative;z-index:74;
          width:calc(100% - 18px);margin:0 9px 10px;padding:5px;background:rgba(5,8,12,.98);
          box-shadow:0 10px 28px rgba(0,0,0,.42)
        }
        .rhw-logistics-view-nav button{min-height:48px;padding:7px 6px;font-size:8px}
        .rhw-logistics-view-nav button small{font-size:5.5px}
        [data-command-panel="logistics"]{
          /* End-of-panel scroll reserve: invisible in normal use, but enough for
             the no-telemetry Market controls to clear the fixed bottom dock. */
          padding-bottom:180px!important
        }
        [data-command-panel="logistics"]>.rhw-fixed-logistics-surface{margin:0 9px 12px!important;width:calc(100% - 18px)}
        .rhw-fixed-logistics-surface .logistics-subhead{padding:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function setLogisticsView(view = 'market') {
    const safe = view === 'fixed' ? 'fixed' : 'market';
    document.body.dataset.logisticsView = safe;
    document.querySelectorAll('#rhwLogisticsViewNav [data-logistics-view]').forEach(button => {
      const active = button.dataset.logisticsView === safe;
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    document.getElementById('marketScanSection')?.setAttribute('aria-hidden', safe === 'market' ? 'false' : 'true');
    document.getElementById('fixedLogisticsSection')?.setAttribute('aria-hidden', safe === 'fixed' ? 'false' : 'true');
    return safe;
  }

  function disableLegacyCommandAutoScroll() {
    const nav = document.getElementById('commandNodeNav');
    if (!nav?.classList.contains('command-module-nav')) return false;
    nav.querySelectorAll('[data-command-node]').forEach(button => {
      if (button.dataset.rhwLegacyScrollDisabled === 'true') return;
      button.dataset.rhwLegacyScrollDisabled = 'true';
      /* The legacy V4 tab bar scrolled its active button into view. COMMAND is
         now a fully visible 2x2 grid on phones, so that scheduled scroll only
         moves the page and fights the real Logistics tool positioning. */
      button.scrollIntoView = () => {};
    });
    return true;
  }

  function ensureLogisticsSwitcher() {
    disableLegacyCommandAutoScroll();
    app.uiPolish?.restoreMarketScan?.();
    const panel = document.querySelector('[data-command-panel="logistics"]');
    const market = document.getElementById('marketScanSection');
    const fixed = document.getElementById('fixedLogisticsSection');
    const legacy = document.getElementById('externalLogisticsPanel');
    if (!panel || !market || !fixed || !legacy) return false;

    [market, fixed].forEach(surface => {
      surface.hidden = false;
      surface.removeAttribute('hidden');
      surface.style.removeProperty('display');
      surface.style.removeProperty('visibility');
      surface.style.removeProperty('opacity');
    });
    fixed.classList.add('rhw-fixed-logistics-surface');
    legacy.setAttribute('aria-hidden', 'true');

    let nav = document.getElementById('rhwLogisticsViewNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'rhwLogisticsViewNav';
      nav.className = 'rhw-logistics-view-nav';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', 'Logistics views');
      nav.innerHTML = `
        <button type="button" role="tab" data-logistics-view="market" aria-controls="marketScanSection">
          MARKET SCAN<small>GOODS + ALL KNOWN POBS</small>
        </button>
        <button type="button" role="tab" data-logistics-view="fixed" aria-controls="fixedLogisticsSection">
          FIXED LINKS<small>LISHEEN + SHELTON</small>
        </button>`;
      nav.addEventListener('click', event => {
        const button = event.target.closest('[data-logistics-view]');
        if (button) setLogisticsView(button.dataset.logisticsView);
      });
      nav.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...nav.querySelectorAll('[data-logistics-view]')];
        const current = buttons.indexOf(document.activeElement);
        if (current < 0) return;
        event.preventDefault();
        let next = current;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        buttons[next].click();
      });
    }

    panel.insertBefore(nav, market);
    if (market.nextElementSibling !== fixed) market.insertAdjacentElement('afterend', fixed);
    if (fixed.nextElementSibling !== legacy) fixed.insertAdjacentElement('afterend', legacy);

    setLogisticsView(document.body.dataset.logisticsView || 'market');
    return true;
  }

  function revealLogistics() {
    if (window.innerWidth > 760) return;
    const started = performance.now();
    const settleMs = 850;

    const align = now => {
      if (document.body.dataset.workspace !== 'command' || document.body.dataset.commandNode !== 'logistics') return;
      const dock = document.querySelector('.app-tabs');
      const price = document.querySelector('[data-market-sort="price"]');
      const stock = document.querySelector('[data-market-sort="stock"]');
      if (dock && price && stock) {
        const dockTop = dock.getBoundingClientRect().top;
        const sortBottom = Math.max(price.getBoundingClientRect().bottom, stock.getBoundingClientRect().bottom);
        const clearance = 12;
        const delta = sortBottom - (dockTop - clearance);
        if (delta > 2) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
      }
      /* Do not stop after a few apparently stable frames. Other RHW boot layers
         settle slightly later and may shift COMMAND down again. */
      if (now - started < settleMs) requestAnimationFrame(align);
    };

    requestAnimationFrame(align);
  }

  function selfTest() {
    const failures = [];
    const panel = document.querySelector('[data-command-panel="logistics"]');
    const nav = document.getElementById('rhwLogisticsViewNav');
    const market = document.getElementById('marketScanSection');
    const fixed = document.getElementById('fixedLogisticsSection');
    const legacy = document.getElementById('externalLogisticsPanel');
    const commandButtons = [...document.querySelectorAll('#commandNodeNav [data-command-node]')];
    if (!document.getElementById('rhwStabilityPolishStyle')) failures.push('style');
    if (!panel || !nav || nav.parentElement !== panel || nav.nextElementSibling !== market) failures.push('logistics-nav-order');
    if (market?.nextElementSibling !== fixed || fixed?.nextElementSibling !== legacy) failures.push('logistics-surface-order');
    if (nav?.querySelectorAll('[data-logistics-view]').length !== 2) failures.push('logistics-tabs');
    if (!market || !fixed || !fixed.classList.contains('rhw-fixed-logistics-surface')) failures.push('logistics-surfaces');
    if (!commandButtons.length || commandButtons.some(button => button.dataset.rhwLegacyScrollDisabled !== 'true')) failures.push('legacy-command-scroll');
    if (typeof setLogisticsView !== 'function') failures.push('logistics-view-api');
    return failures;
  }

  installStyles();

  if (typeof base.commandInit === 'function') {
    app.command.init = function stabilityCommandInit(...args) {
      const result = base.commandInit.apply(this, args);
      if (!ensureLogisticsSwitcher()) throw new Error('RHW STABILITY COULD NOT MOUNT LOGISTICS VIEWS');
      const failures = selfTest();
      if (failures.length) throw new Error(`RHW STABILITY SELF TEST FAILED: ${failures.join(', ')}`);
      return result;
    };
  }

  if (typeof base.commandActivate === 'function') {
    app.command.activate = function stabilityCommandActivate(node, options) {
      disableLegacyCommandAutoScroll();
      const previous = app.state.commandNode;
      const result = base.commandActivate.call(this, node, options);
      if (node === 'logistics') {
        requestAnimationFrame(() => {
          ensureLogisticsSwitcher();
          if (previous !== 'logistics') setLogisticsView('market');
          revealLogistics();
        });
      }
      return result;
    };
  }

  app.stabilityPolish = {
    ensureLogisticsSwitcher,
    setLogisticsView,
    revealLogistics,
    disableLegacyCommandAutoScroll,
    selfTest
  };
})();
