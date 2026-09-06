/* ========================================================================== */
/* RHW COMMAND COMPACT POLISH                                                 */
/* Tightens the mobile COMMAND hierarchy without changing telemetry/data.     */
/* ========================================================================== */
(function initRhwCommandCompactPolish() {
  'use strict';
  const app = window.RHWV4;
  if (!app?.command || !app?.unifiedUi || app.commandCompactPolish) return;

  const base = { commandInit: app.command.init, commandActivate: app.command.activate };
  let alertObserver = null;

  function installStyles() {
    if (document.getElementById('rhwCommandCompactPolishStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwCommandCompactPolishStyle';
    style.textContent = `
      body[data-workspace="command"] .rhw-command-compact-shell{
        position:relative;z-index:70;background:#05070a;isolation:isolate;
        border-bottom:1px solid rgba(212,175,55,.18);box-shadow:0 10px 28px rgba(0,0,0,.34)
      }
      body[data-workspace="command"] .rhw-command-compact-shell .command-module-nav{background:#05070a!important}

      .rhw-inventory-mode-nav{
        position:relative!important;top:auto!important;z-index:1!important;
        display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));
        width:100%!important;margin:0!important;padding:5px!important;gap:5px!important;
        border:0!important;border-top:1px solid rgba(212,175,55,.14)!important;border-radius:0!important;
        background:#05070a!important;box-shadow:none!important;overflow:hidden!important
      }
      body:not([data-workspace="command"]) .rhw-inventory-mode-nav,
      body:not([data-command-node="inventory"]) .rhw-inventory-mode-nav{display:none!important}
      .rhw-inventory-mode-nav button{
        display:grid!important;grid-template-columns:24px minmax(0,1fr)!important;grid-template-areas:"subindex subcopy"!important;
        align-items:center!important;gap:8px!important;min-width:0!important;min-height:50px!important;padding:7px 9px!important;
        border:1px solid rgba(255,255,255,.06)!important;border-radius:4px!important;background:rgba(0,0,0,.16)!important;
        text-align:left!important;clip-path:none!important;box-shadow:none!important
      }
      .rhw-inventory-mode-nav button.active{
        border-color:rgba(212,175,55,.32)!important;
        background:linear-gradient(180deg,rgba(212,175,55,.13),rgba(212,175,55,.035))!important;
        box-shadow:inset 0 -2px 0 var(--gold)!important
      }
      .rhw-inventory-mode-nav .rhw-subview-index{
        grid-area:subindex;display:grid;place-items:center;width:24px;height:24px;
        border:1px solid rgba(212,175,55,.2);background:rgba(212,175,55,.045);color:rgba(212,175,55,.72);
        font-family:var(--font-tech);font-style:normal;font-size:7px;font-weight:700;letter-spacing:.08em
      }
      .rhw-inventory-mode-nav button>span{grid-area:subcopy;font-size:16px!important;line-height:1!important;text-align:left!important}
      .rhw-inventory-mode-nav button>small{display:none!important}
      .rhw-inventory-mode-nav button::after{display:none!important}

      .command-global-alerts[data-alert-count="0"],.command-global-alerts[hidden]{display:none!important}
      .command-global-alerts:not(.expanded) .command-priority-list{display:none!important}
      .command-global-alerts{margin:0 0 7px!important;border-radius:5px!important}
      .command-global-alerts .command-alert-toggle{min-height:44px!important;padding:5px 9px!important;gap:8px!important}
      .command-global-alerts .command-alert-copy strong{font-size:8px!important}
      .command-global-alerts .command-alert-copy small{font-size:10px!important}
      .command-global-alerts .command-alert-signal{width:7px!important;height:7px!important}
      .command-global-alerts .command-priority-list{padding:0 6px 6px!important}

      .command-focus-modes.rhw-attention-only{grid-template-columns:1fr!important}
      .command-focus-modes.rhw-attention-only [data-command-focus-mode="all"]{display:none!important}
      .command-focus-modes.rhw-attention-empty{display:none!important}

      @media(max-width:980px){
        body[data-workspace="command"] #commandNodeNav.command-module-nav button[data-command-node]{
          height:60px!important;min-height:60px!important;max-height:60px!important;
          grid-template-columns:22px minmax(0,1fr) minmax(0,100px)!important;grid-template-areas:"index copy state"!important;
          align-items:center!important;gap:6px!important;padding:6px 7px!important;overflow:hidden!important
        }
        body[data-workspace="command"] #commandNodeNav .command-module-index{width:22px!important;height:22px!important;font-size:7px!important}
        body[data-workspace="command"] #commandNodeNav .command-module-copy{gap:0!important}
        body[data-workspace="command"] #commandNodeNav .command-module-copy strong{font-size:15px!important;line-height:.95!important}
        body[data-workspace="command"] #commandNodeNav .command-module-copy small{display:none!important}
        body[data-workspace="command"] #commandNodeNav .command-module-state{
          justify-self:stretch!important;max-width:none!important;min-width:0!important;padding:3px 4px!important;
          gap:3px!important;font-size:10px!important;color:#d0cabc!important;white-space:normal!important;line-height:1.3!important;text-align:center!important;overflow:hidden!important
        }
        body[data-workspace="command"] #commandNodeNav .command-module-state::after{
          min-width:16px!important;height:16px!important;padding:0 3px!important;font-size:10px!important
        }
      }
      @media(max-width:760px){
        body[data-workspace="command"] .app-context-nav-slot.rhw-command-compact-shell,
        body[data-workspace="command"] #appContextNavSlot.rhw-command-compact-shell{background:#05070a!important}
        body[data-workspace="command"] #commandNodeNav.command-module-nav button[data-command-node]{
          height:58px!important;min-height:58px!important;max-height:58px!important
        }
        .command-control-deck{grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important;margin:0 9px 7px!important;padding:5px!important}
        .command-control-deck .command-finder-label{min-height:44px!important;padding:0 7px!important}
        .command-control-deck .command-finder-label>span:first-child{display:none!important}
        #commandGlobalSearch{min-height:44px!important;font-size:16px!important}
        .command-focus-modes button,.command-context-action{min-height:44px!important;padding:6px 8px!important;font-size:11px!important}
        .command-context-action:not([hidden]){grid-column:1/-1!important}
        .command-global-alerts{margin:0 9px 6px!important}
        .command-global-alerts .command-alert-copy small{display:none!important}
        .rhw-inventory-mode-nav button{min-height:48px!important}
        .inventory-view-heading{margin-top:8px!important}
      }
      @media(max-width:390px){
        body[data-workspace="command"] #commandNodeNav.command-module-nav button[data-command-node]{
          height:56px!important;min-height:56px!important;max-height:56px!important;
          grid-template-columns:20px minmax(0,1fr) minmax(0,92px)!important;padding:5px 6px!important
        }
        body[data-workspace="command"] #commandNodeNav .command-module-index{width:20px!important;height:20px!important}
        body[data-workspace="command"] #commandNodeNav .command-module-copy strong{font-size:14px!important}
        body[data-workspace="command"] #commandNodeNav .command-module-state{font-size:10px!important}
        .rhw-inventory-mode-nav button>span{font-size:14px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installInventoryInteraction(nav) {
    if (!nav || nav.dataset.rhwCompactInteraction === 'true') return;
    nav.dataset.rhwCompactInteraction = 'true';

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-inventory-view]');
      if (!button || !nav.contains(button)) return;
      app.command.activateInventoryView?.(button.dataset.inventoryView);
    });

    nav.addEventListener('keydown', event => {
      const button = event.target.closest('[data-inventory-view]');
      if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...nav.querySelectorAll('[data-inventory-view]')];
      const current = buttons.indexOf(button);
      if (current < 0) return;
      event.preventDefault();
      event.stopPropagation();
      let next = current;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      const target = buttons[next];
      if (!target) return;
      app.command.activateInventoryView?.(target.dataset.inventoryView);
      target.focus();
    });
  }

  function decorateInventoryNav() {
    const nav = document.querySelector('.inventory-view-nav');
    if (!nav) return null;
    nav.classList.add('rhw-inventory-mode-nav');
    [...nav.querySelectorAll('[data-inventory-view]')].forEach((button, index) => {
      if (button.querySelector('.rhw-subview-index')) return;
      const marker = document.createElement('i');
      marker.className = 'rhw-subview-index';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = String(index + 1).padStart(2, '0');
      button.prepend(marker);
    });
    installInventoryInteraction(nav);
    return nav;
  }

  function mountInventoryNav() {
    const commandNav = document.getElementById('commandNodeNav');
    const nav = decorateInventoryNav();
    const shell = document.getElementById('appContextNavSlot') || commandNav?.parentElement;
    if (!commandNav || !nav || !shell) return false;
    shell.classList.add('rhw-command-compact-shell');
    if (commandNav.parentElement !== shell) shell.appendChild(commandNav);
    if (commandNav.nextElementSibling !== nav) commandNav.insertAdjacentElement('afterend', nav);
    return true;
  }

  function installAttentionToggle() {
    const group = document.querySelector('.command-focus-modes');
    const all = group?.querySelector('[data-command-focus-mode="all"]');
    const attention = group?.querySelector('[data-command-focus-mode="attention"]');
    if (!group || !all || !attention) return false;
    group.classList.add('rhw-attention-only');
    all.hidden = true;
    all.tabIndex = -1;
    all.setAttribute('aria-hidden', 'true');
    if (attention.dataset.rhwAttentionToggle !== 'true') {
      attention.dataset.rhwAttentionToggle = 'true';
      attention.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const next = document.body.dataset.commandFocus === 'attention' ? 'all' : 'attention';
        app.unifiedUi.applyCommandFocus(next, { navigate: next === 'attention' });
        syncAttentionState();
      }, true);
    }
    return true;
  }

  function syncAttentionState() {
    const group = document.querySelector('.command-focus-modes');
    if (!group) return;
    const result = app.unifiedUi.syncCommandAttention?.() || { total: 0 };
    const total = Number(result.total) || 0;
    group.classList.toggle('rhw-attention-empty', total === 0);
    if (total === 0 && document.body.dataset.commandFocus === 'attention') app.unifiedUi.applyCommandFocus('all');
  }

  function syncAlerts() {
    app.commandRework?.syncAlertState?.();
    const panel = document.getElementById('commandGlobalAlerts');
    if (!panel) return;
    const count = Number(panel.dataset.alertCount) || panel.querySelectorAll('.command-priority-item').length;
    panel.hidden = count <= 0;
    panel.setAttribute('aria-hidden', count <= 0 ? 'true' : 'false');
    if (count <= 0) {
      panel.classList.remove('expanded');
      document.getElementById('commandAlertToggle')?.setAttribute('aria-expanded', 'false');
    }
    syncAttentionState();
  }

  function watchAlerts() {
    const list = document.getElementById('v40PriorityList');
    if (!list || alertObserver) return;
    alertObserver = new MutationObserver(() => requestAnimationFrame(syncAlerts));
    alertObserver.observe(list, { childList: true, subtree: true, characterData: true });
  }

  function sync() {
    installStyles();
    mountInventoryNav();
    installAttentionToggle();
    syncAlerts();
    watchAlerts();
  }

  function selfTest() {
    const failures = [];
    const commandNav = document.getElementById('commandNodeNav');
    const inventoryNav = document.querySelector('.rhw-inventory-mode-nav');
    const shell = document.querySelector('.rhw-command-compact-shell');
    const all = document.querySelector('[data-command-focus-mode="all"]');
    const attention = document.querySelector('[data-command-focus-mode="attention"]');
    if (!document.getElementById('rhwCommandCompactPolishStyle')) failures.push('style');
    if (!shell || !commandNav || !inventoryNav || commandNav.nextElementSibling !== inventoryNav) failures.push('inventory-nav-stack');
    if (inventoryNav?.querySelectorAll('.rhw-subview-index').length !== 2) failures.push('inventory-mode-indexes');
    if (inventoryNav?.dataset.rhwCompactInteraction !== 'true') failures.push('inventory-interaction');
    if (!all?.hidden) failures.push('all-areas-visible');
    if (attention?.dataset.rhwAttentionToggle !== 'true') failures.push('attention-toggle');
    return failures;
  }

  installStyles();
  if (typeof base.commandInit === 'function') {
    app.command.init = function compactCommandInit(...args) {
      const result = base.commandInit.apply(this, args);
      sync();
      const failures = selfTest();
      if (failures.length) throw new Error(`RHW COMMAND COMPACT SELF TEST FAILED: ${failures.join(', ')}`);
      return result;
    };
  }
  if (typeof base.commandActivate === 'function') {
    app.command.activate = function compactCommandActivate(node, options) {
      const result = base.commandActivate.call(this, node, options);
      requestAnimationFrame(sync);
      return result;
    };
  }

  app.commandCompactPolish = {
    installStyles,
    mountInventoryNav,
    installAttentionToggle,
    syncAlerts,
    syncAttentionState,
    selfTest
  };
})();
