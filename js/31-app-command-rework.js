/* ==========================================================================
   RHW COMMAND REWORK
   Removes Overview from the visible command flow, promotes the four operational
   areas, keeps legacy overview analysis as an internal status sensor, and moves
   priority actions into a persistent command alert strip.
   ========================================================================== */
(function initRhwCommandRework() {
  'use strict';
  const app = window.RHWV4;
  if (!app?.command || app.commandRework) return;

  const MODULES = Object.freeze([
    Object.freeze({ key: 'inventory', label: 'INVENTORY', sub: 'STATUS + MANIFEST', index: '01' }),
    Object.freeze({ key: 'shipyard', label: 'SHIPYARD', sub: 'HULLS + COMPONENTS + PLANNER', index: '02' }),
    Object.freeze({ key: 'production', label: 'PRODUCTION', sub: 'MODULES + CAPACITY + BOTTLENECKS', index: '03' }),
    Object.freeze({ key: 'logistics', label: 'LOGISTICS', sub: 'REMOTE BASES + MARKET + SUPPLY', index: '04' })
  ]);
  const MODULE_KEYS = new Set(MODULES.map(module => module.key));
  const baseInit = app.command.init;
  const baseActivate = app.command.activate;
  const baseStoredNode = app.workspaceStoredNode;
  let statusTimer = null;

  function installStyles() {
    if (document.getElementById('rhwCommandReworkStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwCommandReworkStyle';
    style.textContent = `
      .command-overview-sensor{display:none!important}

      .app-context-nav-slot>.command-module-nav,
      .command-module-nav{
        width:100%;max-width:none;margin:0;border:0;background:transparent;box-shadow:none;overflow:visible
      }
      .command-module-nav .workspace-subnav-tabs,
      .command-module-grid{
        display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;min-width:0
      }
      .app-context-nav-slot .command-module-nav button,
      .command-module-nav button{
        --module-state:var(--muted);
        position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"index copy state";
        align-items:center;gap:12px;min-width:0;min-height:78px;padding:12px 14px;
        border:0;border-right:1px solid rgba(255,255,255,.065);background:rgba(0,0,0,.12);
        color:rgba(224,224,224,.7);text-align:left;box-shadow:none;clip-path:none;overflow:hidden
      }
      .command-module-nav button:last-child{border-right:0}
      .command-module-nav button[data-state="critical"]{--module-state:var(--danger)}
      .command-module-nav button[data-state="low"]{--module-state:var(--warn)}
      .command-module-nav button[data-state="ok"]{--module-state:var(--good)}
      .command-module-nav button[data-state="waiting"]{--module-state:var(--muted)}
      .command-module-nav button::before{
        content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--module-state);
        box-shadow:0 0 14px color-mix(in srgb,var(--module-state) 55%,transparent);opacity:.82
      }
      .command-module-nav button::after{
        content:"";position:absolute;left:12px;right:12px;bottom:0;height:2px;background:transparent;box-shadow:none
      }
      .command-module-nav button:hover,.command-module-nav button:focus-visible{
        background:linear-gradient(180deg,rgba(212,175,55,.08),rgba(212,175,55,.02));color:#f0e5bf
      }
      .command-module-nav button.active{
        background:linear-gradient(180deg,rgba(212,175,55,.16),rgba(212,175,55,.035));
        color:#f2d675;box-shadow:inset 0 0 26px rgba(212,175,55,.035)
      }
      .command-module-nav button.active::after{background:var(--gold);box-shadow:0 0 12px rgba(212,175,55,.48)}
      .command-module-index{
        grid-area:index;display:grid!important;place-items:center;width:28px;height:28px;border:1px solid rgba(212,175,55,.18);
        color:rgba(212,175,55,.62)!important;background:rgba(212,175,55,.035);font-family:var(--font-tech)!important;
        font-size:8px!important;font-weight:700;letter-spacing:.08em!important
      }
      .command-module-copy{grid-area:copy;display:grid!important;gap:4px;min-width:0}
      .command-module-copy strong{
        color:inherit;font-family:var(--font-title);font-size:clamp(20px,1.65vw,27px);font-weight:700;letter-spacing:.055em;line-height:.95
      }
      .command-module-copy small{
        margin:0!important;color:rgba(165,171,178,.58)!important;font-family:var(--font-tech)!important;
        font-size:7px!important;letter-spacing:.075em!important;line-height:1.35
      }
      .command-module-state{
        grid-area:state;align-self:center;max-width:128px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--module-state) 32%,transparent);
        background:color-mix(in srgb,var(--module-state) 7%,transparent);color:color-mix(in srgb,var(--module-state) 78%,white);
        font-family:var(--font-tech);font-size:7px;font-weight:700;letter-spacing:.065em;line-height:1.25;text-align:right;overflow-wrap:anywhere
      }
      .command-module-nav button.active .command-module-copy small{color:rgba(224,202,126,.7)!important}

      .command-global-alerts{
        --alert-state:var(--good);margin:0 0 14px;border:1px solid color-mix(in srgb,var(--alert-state) 25%,transparent);
        background:linear-gradient(90deg,color-mix(in srgb,var(--alert-state) 7%,transparent),rgba(5,7,9,.94) 50%);
        box-shadow:0 10px 24px rgba(0,0,0,.2);overflow:hidden
      }
      .command-global-alerts[data-alert-state="critical"]{--alert-state:var(--danger)}
      .command-global-alerts[data-alert-state="low"]{--alert-state:var(--warn)}
      .command-global-alerts[data-alert-state="clear"]{--alert-state:var(--good)}
      .command-global-alerts .command-priority-head{display:block;padding:0;border:0;background:transparent}
      .command-alert-toggle{
        width:100%;min-height:52px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;
        padding:8px 12px;border:0;background:transparent;color:#e5e3db;text-align:left;clip-path:none;box-shadow:none
      }
      .command-alert-toggle:hover,.command-alert-toggle:focus-visible{background:color-mix(in srgb,var(--alert-state) 7%,transparent)}
      .command-alert-signal{width:9px;height:9px;border-radius:50%;background:var(--alert-state);box-shadow:0 0 12px color-mix(in srgb,var(--alert-state) 65%,transparent)}
      .command-alert-copy{display:grid;gap:2px;min-width:0}
      .command-alert-copy strong{font-family:var(--font-tech);font-size:10px;letter-spacing:.085em;color:color-mix(in srgb,var(--alert-state) 75%,white)}
      .command-alert-copy small{font-family:var(--font-tech);font-size:7px;letter-spacing:.065em;color:rgba(224,224,224,.5)}
      .command-alert-meta{display:flex;align-items:center;gap:9px}
      #v40PriorityCount{font-family:var(--font-tech);font-size:8px;font-weight:700;letter-spacing:.08em;color:color-mix(in srgb,var(--alert-state) 75%,white)}
      .command-alert-chevron{font-family:var(--font-tech);font-size:10px;color:rgba(224,224,224,.48);transition:transform .16s ease}
      .command-global-alerts.expanded .command-alert-chevron{transform:rotate(180deg)}
      .command-global-alerts .command-priority-list{gap:6px;padding:0 8px 8px}
      .command-global-alerts:not(.expanded) .command-priority-item:not(:first-child){display:none}
      .command-global-alerts .command-priority-item{min-height:48px;border-radius:5px}
      .command-global-alerts[data-alert-count="0"] .command-alert-copy small{color:rgba(120,173,138,.65)}

      .inventory-view-nav{
        display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;margin:0 0 12px;padding:7px;
        border:1px solid rgba(212,175,55,.2);background:linear-gradient(90deg,rgba(212,175,55,.055),rgba(5,7,9,.94) 48%);
        overflow:visible
      }
      .inventory-view-nav button{
        position:relative;min-width:0!important;min-height:64px!important;padding:10px 14px!important;border:1px solid rgba(255,255,255,.07)!important;
        border-radius:5px;background:rgba(0,0,0,.16)!important;text-align:left!important;clip-path:none!important
      }
      .inventory-view-nav button span{font-family:var(--font-title)!important;font-size:20px!important;letter-spacing:.055em!important;color:#dddcd5}
      .inventory-view-nav button small{display:block;margin-top:3px!important;font-size:7px!important;color:rgba(157,163,169,.56)!important;letter-spacing:.07em!important}
      .inventory-view-nav button::after{content:"OPEN VIEW";position:absolute;top:10px;right:11px;font-family:var(--font-tech);font-size:6px;letter-spacing:.1em;color:rgba(212,175,55,.38)}
      .inventory-view-nav button.active{
        border-color:rgba(212,175,55,.34)!important;background:linear-gradient(180deg,rgba(212,175,55,.14),rgba(212,175,55,.035))!important;
        box-shadow:inset 0 -2px 0 var(--gold),inset 0 0 22px rgba(212,175,55,.03)!important
      }
      .inventory-view-nav button.active::after{content:"ACTIVE VIEW";color:#e7c963}
      .inventory-view-nav button.active span{color:#f0d16c!important}

      @media(max-width:980px){
        .app-context-nav-slot .command-module-nav button,.command-module-nav button{grid-template-columns:auto minmax(0,1fr);grid-template-areas:"index copy" "state state";gap:7px 10px;min-height:84px;padding:10px 11px}
        .command-module-state{justify-self:start;max-width:none;text-align:left}
        .command-module-copy strong{font-size:21px}
      }
      @media(max-width:760px){
        .app-context-nav-slot{min-height:0}
        .app-context-nav-slot .command-module-nav{overflow:visible!important;scroll-snap-type:none!important}
        .app-context-nav-slot .command-module-nav .workspace-subnav-tabs{min-width:0!important}
        .command-module-nav .workspace-subnav-tabs,.command-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .app-context-nav-slot .command-module-nav button,.command-module-nav button{
          grid-template-columns:auto minmax(0,1fr);grid-template-areas:"index copy" "state state";min-width:0!important;min-height:74px!important;
          padding:9px 10px!important;border-right:1px solid rgba(255,255,255,.055);border-bottom:1px solid rgba(255,255,255,.055)
        }
        .command-module-nav button:nth-child(2n){border-right:0}
        .command-module-nav button:nth-last-child(-n+2){border-bottom:0}
        .command-module-index{width:24px;height:24px}
        .command-module-copy strong{font-size:18px}
        .command-module-copy small{font-size:6px!important;line-height:1.25}
        .command-module-state{padding:4px 6px;font-size:6px}
        .command-global-alerts{margin:0 9px 10px;border-radius:7px}
        .command-alert-toggle{min-height:48px;padding:7px 9px}
        .command-alert-copy strong{font-size:9px}.command-alert-copy small{font-size:6px}
        .command-global-alerts .command-priority-list{padding:0 6px 6px}
        .inventory-view-nav{position:sticky;top:var(--rhw-sticky-nav-offset,160px);z-index:72;width:calc(100% - 18px);margin:0 9px 10px;padding:5px;gap:5px;border-radius:8px;background:rgba(4,6,8,.97);box-shadow:0 10px 24px rgba(0,0,0,.36)}
        .inventory-view-nav button{min-height:54px!important;padding:8px 9px!important;text-align:center!important}
        .inventory-view-nav button span{font-size:16px!important}.inventory-view-nav button small{font-size:6px!important}
        .inventory-view-nav button::after{display:none}
      }
      @media(max-width:390px){
        .command-module-copy strong{font-size:16px}.command-module-copy small{display:none}
        .command-module-state{white-space:normal;line-height:1.2}
        .command-alert-meta{gap:6px}
        .inventory-view-nav button span{font-size:15px!important}
      }
      @media(prefers-reduced-motion:reduce){.command-alert-chevron{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function navMarkup() {
    return `<div class="workspace-subnav-tabs command-module-grid">${MODULES.map(module => `
      <button type="button" data-command-node="${module.key}" data-state="waiting" aria-label="${module.label}: ${module.sub}">
        <span class="command-module-index" aria-hidden="true">${module.index}</span>
        <span class="command-module-copy"><strong>${module.label}</strong><small>${module.sub}</small></span>
        <b class="command-module-state" data-command-status="${module.key}">AWAITING DATA</b>
      </button>`).join('')}</div>`;
  }

  function buildNavigation() {
    const nav = document.getElementById('commandNodeNav');
    if (!nav) return false;
    nav.classList.add('command-module-nav');
    nav.setAttribute('aria-label', 'Command operational areas');
    nav.innerHTML = navMarkup();
    if (nav.dataset.commandReworkKeys !== 'true') {
      nav.dataset.commandReworkKeys = 'true';
      nav.addEventListener('keydown', event => {
        const button = event.target.closest('[data-command-node]');
        if (!button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...nav.querySelectorAll('[data-command-node]')];
        const current = buttons.indexOf(button);
        if (current < 0) return;
        event.preventDefault();
        let nextIndex = current;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = buttons.length - 1;
        else if (event.key === 'ArrowLeft') nextIndex = (current - 1 + buttons.length) % buttons.length;
        else if (event.key === 'ArrowRight') nextIndex = (current + 1) % buttons.length;
        else if (event.key === 'ArrowUp') nextIndex = (current - 2 + buttons.length) % buttons.length;
        else if (event.key === 'ArrowDown') nextIndex = (current + 2) % buttons.length;
        buttons[nextIndex]?.focus();
      });
    }
    return true;
  }

  function movePriorityActions() {
    const host = document.getElementById('commandNodeHost');
    const overview = document.querySelector('[data-command-panel="overview"]');
    if (!host || !overview) return false;
    overview.classList.add('command-overview-sensor');
    overview.setAttribute('aria-hidden', 'true');

    let panel = document.getElementById('commandGlobalAlerts');
    if (!panel) {
      panel = overview.querySelector('.command-priority-panel');
      if (!panel) return false;
      panel.id = 'commandGlobalAlerts';
      panel.classList.add('command-global-alerts');
      panel.dataset.alertState = 'clear';
      panel.dataset.alertCount = '0';
      const head = panel.querySelector('.command-priority-head');
      if (head) head.innerHTML = `<button type="button" class="command-alert-toggle" id="commandAlertToggle" aria-expanded="false" aria-controls="v40PriorityList">
        <i class="command-alert-signal" aria-hidden="true"></i>
        <span class="command-alert-copy"><strong>COMMAND ALERTS</strong><small>PRIORITY ACTIONS FROM CURRENT VERIFIED STATUS</small></span>
        <span class="command-alert-meta"><b id="v40PriorityCount">0 ACTIVE</b><i class="command-alert-chevron" aria-hidden="true">⌄</i></span>
      </button>`;
      host.insertAdjacentElement('beforebegin', panel);
      document.getElementById('commandAlertToggle')?.addEventListener('click', () => {
        const expanded = panel.classList.toggle('expanded');
        document.getElementById('commandAlertToggle')?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
      panel.addEventListener('click', event => {
        const target = event.target.closest('[data-priority-jump]');
        if (target?.dataset.priorityJump) app.navigate('command', target.dataset.priorityJump);
      });
    }
    return true;
  }

  function syncAlertState() {
    const panel = document.getElementById('commandGlobalAlerts');
    const list = document.getElementById('v40PriorityList');
    if (!panel || !list) return;
    const items = [...list.querySelectorAll('.command-priority-item')];
    const state = items.some(item => item.classList.contains('state-critical')) ? 'critical'
      : items.some(item => item.classList.contains('state-low')) ? 'low' : 'clear';
    panel.dataset.alertState = state;
    panel.dataset.alertCount = String(items.length);
    const hint = panel.querySelector('.command-alert-copy small');
    if (hint) hint.textContent = items.length
      ? (items.length === 1 ? '1 PRIORITY ACTION // OPEN BELOW' : `${items.length} PRIORITY ACTIONS // FIRST SHOWN BELOW`)
      : 'NO PRIORITY ACTIONS // MONITORED THRESHOLDS NOMINAL';
    if (items.length <= 1) {
      panel.classList.remove('expanded');
      document.getElementById('commandAlertToggle')?.setAttribute('aria-expanded', 'false');
    }
  }

  function syncModuleStatuses() {
    try { app.command.updateOverview?.(); } catch {}
    MODULES.forEach(module => {
      const source = document.querySelector(`.command-overview-card[data-command-jump="${module.key}"]`);
      const button = document.querySelector(`#commandNodeNav [data-command-node="${module.key}"]`);
      const status = button?.querySelector(`[data-command-status="${module.key}"]`);
      if (!button || !status) return;
      const state = source?.dataset.state || 'waiting';
      const summary = source?.querySelector('strong')?.textContent?.trim() || 'AWAITING DATA';
      button.dataset.state = ['critical', 'low', 'ok', 'waiting'].includes(state) ? state : 'waiting';
      status.textContent = summary;
    });
    syncAlertState();
  }

  function selfTest() {
    const failures = [];
    const visibleButtons = [...document.querySelectorAll('#commandNodeNav [data-command-node]')];
    if (visibleButtons.length !== 4) failures.push('command-nav-count');
    if (visibleButtons.some(button => button.dataset.commandNode === 'overview')) failures.push('overview-visible');
    if (!document.getElementById('commandGlobalAlerts')) failures.push('alert-strip');
    if (!document.querySelector('[data-command-panel="overview"].command-overview-sensor')) failures.push('overview-sensor');
    if (!document.querySelector('.inventory-view-nav')) failures.push('inventory-view-switch');
    return failures;
  }

  function install() {
    installStyles();
    buildNavigation();
    movePriorityActions();
    clearInterval(app.commandOverviewTimer);
    clearInterval(statusTimer);
    syncModuleStatuses();
    statusTimer = window.setInterval(() => {
      if (app.state.activeWorkspace === 'command') syncModuleStatuses();
    }, 2500);
    app.command.nodes = MODULES.map(module => [module.key, module.label, module.sub]);
    const failures = selfTest();
    if (failures.length) throw new Error(`COMMAND REWORK SELF TEST FAILED: ${failures.join(', ')}`);
    return true;
  }

  app.workspaceStoredNode = function commandReworkStoredNode(workspace) {
    const stored = baseStoredNode.call(this, workspace);
    if (workspace === 'command' && !MODULE_KEYS.has(stored)) return 'inventory';
    return stored;
  };

  app.command.init = function commandReworkInit(...args) {
    const result = baseInit.apply(this, args);
    install();
    return result;
  };

  app.command.activate = function commandReworkActivate(node, options) {
    const legacySmokeOverview = Boolean(window.__RHW_SMOKE_INLINE__ && node === 'overview');
    const next = legacySmokeOverview ? 'overview' : (MODULE_KEYS.has(node) ? node : 'inventory');
    const result = baseActivate.call(this, next, options);
    requestAnimationFrame(syncModuleStatuses);
    return result;
  };

  app.commandRework = {
    modules: MODULES,
    install,
    syncModuleStatuses,
    syncAlertState,
    selfTest
  };
})();
