/* ========================================================================== */
/* RHW FOCUS PASS                                                             */
/* Keeps daily RHW focused on COMMAND, CALCULATOR and FORUM while preserving  */
/* advanced/admin tools behind one secondary TOOLS surface.                    */
/* ========================================================================== */
(function initRhwFocusPass() {
  'use strict';

  const app = window.RHWV4;
  if (!app || app.focusPass) return;

  const TOOL_META = Object.freeze({
    'build-queue': Object.freeze({ label: 'BUILD QUEUE', sub: 'PRODUCTION ORDERS', workspace: 'operations', node: 'orders' }),
    data: Object.freeze({ label: 'DATA STATUS', sub: 'DISCOVERY CATALOG + SYNC', workspace: 'operations', node: 'calculator' }),
    backup: Object.freeze({ label: 'BACKUP + DRAFTS', sub: 'DEVICE TRANSFER + LOCAL ARCHIVE', workspace: 'comms', node: 'drafts' }),
    newswire: Object.freeze({ label: 'NEWSWIRE', sub: 'EDITORIAL MANAGER', workspace: 'comms', node: 'ticker' }),
    senders: Object.freeze({ label: 'SENDERS', sub: 'PROFILE REGISTRY', workspace: 'comms', node: 'senders' }),
    system: Object.freeze({ label: 'SYSTEM + DATA', sub: 'APP HEALTH + CATALOG + SYNC', workspace: null, node: null })
  });

  const ROUTE_TOOL = Object.freeze({
    'operations/orders': 'build-queue',
    'comms/drafts': 'backup',
    'comms/ticker': 'newswire',
    'comms/senders': 'senders'
  });

  const base = {
    installShell: app.installShell,
    applyRoute: app.applyRoute,
    navigate: app.navigate,
    operationsInit: app.operations?.init,
    operationsActivate: app.operations?.activate,
    commsInit: app.comms?.init,
    commsActivate: app.comms?.activate
  };

  let toolOpenedBy = null;
  let syncTimer = 0;

  function installStyles() {
    if (document.getElementById('rhwFocusPassStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwFocusPassStyle';
    style.textContent = `
      html.rhw-focus-pass #operationsNodeNav,
      html.rhw-focus-pass #commsNodeNav{display:none!important}
      html.rhw-focus-pass body[data-workspace="operations"] #appContextNavSlot,
      html.rhw-focus-pass body[data-workspace="comms"] #appContextNavSlot{min-height:0!important;height:auto!important;padding-top:0!important;padding-bottom:0!important}
      html.rhw-focus-pass #rhwDiagnosticsBtn{display:none!important}

      .rhw-focus-tools-button{
        min-height:44px;padding:6px 10px;border:1px solid rgba(212,175,55,.24);border-radius:5px;
        background:rgba(212,175,55,.045);color:rgba(235,220,167,.78);font-family:var(--font-tech);
        font-size:11px;font-weight:700;letter-spacing:.08em;clip-path:none;box-shadow:none;white-space:nowrap
      }
      .rhw-focus-tools-button:hover,.rhw-focus-tools-button:focus-visible,.rhw-focus-tools-button[data-tool-open="true"]{
        border-color:rgba(212,175,55,.42);background:rgba(212,175,55,.11);color:#f0d470
      }
      .rhw-focus-tools-button span{display:block;font-size:11px}.rhw-focus-tools-button small{display:block;margin-top:2px;font-size:11px;color:rgba(190,190,184,.54)}

      .rhw-focus-tools-overlay{
        position:fixed;z-index:310;inset:0;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);
        backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)
      }
      .rhw-focus-tools-overlay[hidden]{display:none!important}
      .rhw-focus-tools-sheet{
        width:min(720px,100%);max-height:min(760px,calc(100vh - 36px));overflow:auto;border:1px solid rgba(212,175,55,.28);
        border-radius:9px;background:linear-gradient(180deg,rgba(13,15,18,.99),rgba(4,6,8,.99));box-shadow:0 28px 80px rgba(0,0,0,.7)
      }
      .rhw-focus-tools-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:15px 16px;border-bottom:1px solid rgba(212,175,55,.14)}
      .rhw-focus-tools-head div{display:grid;gap:3px}.rhw-focus-tools-head small{font-family:var(--font-tech);font-size:11px;letter-spacing:.09em;color:rgba(212,175,55,.58)}
      .rhw-focus-tools-head strong{font-family:var(--font-title);font-size:24px;letter-spacing:.055em;color:#e8d28a}.rhw-focus-tools-head span{font-family:var(--font-tech);font-size:11px;color:#bcbebf;letter-spacing:.055em}
      .rhw-focus-tools-head button{min-height:44px;padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:rgba(255,255,255,.025);color:#d8d8d2;font-family:var(--font-tech);font-size:11px;letter-spacing:.07em}
      .rhw-focus-tools-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:10px}
      .rhw-focus-tool-card{
        position:relative;display:grid;grid-template-columns:30px minmax(0,1fr) auto;grid-template-areas:"idx copy arrow";align-items:center;gap:10px;
        min-height:72px;padding:10px 11px;border:1px solid rgba(255,255,255,.065);border-radius:6px;background:rgba(255,255,255,.018);
        color:#dddcd5;text-align:left;clip-path:none;box-shadow:none
      }
      .rhw-focus-tool-card:hover,.rhw-focus-tool-card:focus-visible{border-color:rgba(212,175,55,.3);background:rgba(212,175,55,.07)}
      .rhw-focus-tool-index{grid-area:idx;display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(212,175,55,.2);background:rgba(212,175,55,.04);color:#cbb45f;font-family:var(--font-tech);font-size:11px}
      .rhw-focus-tool-copy{grid-area:copy;display:grid;gap:3px;min-width:0}.rhw-focus-tool-copy strong{font-family:var(--font-title);font-size:17px;letter-spacing:.045em;color:#e1dfd7}.rhw-focus-tool-copy small{font-family:var(--font-tech);font-size:11px;letter-spacing:.06em;color:#bcbebf}
      .rhw-focus-tool-arrow{grid-area:arrow;color:rgba(212,175,55,.5);font-size:15px}
      .rhw-focus-tools-note{margin:0 10px 10px;padding:8px 10px;border:1px solid rgba(120,173,138,.14);border-radius:5px;background:rgba(120,173,138,.035);font-family:var(--font-tech);font-size:11px;line-height:1.5;letter-spacing:.045em;color:rgba(178,196,184,.66)}

      body[data-rhw-focus-tool]:not([data-rhw-focus-tool=""]) .rhw-focus-tools-button::after{content:"";display:inline-block;width:6px;height:6px;margin-left:6px;border-radius:50%;background:#d6ba59;box-shadow:0 0 9px rgba(214,186,89,.55);vertical-align:middle}

      @media(max-width:760px){
        .rhw-focus-tools-button{min-width:54px;min-height:44px;padding:6px 8px}.rhw-focus-tools-button small{display:none}
        .rhw-focus-tools-overlay{align-items:end;padding:8px 8px calc(var(--rhw-mobile-dock-height,70px) + var(--rhw-mobile-safe-bottom,0px) + 8px)}
        .rhw-focus-tools-sheet{width:100%;max-height:min(680px,calc(100vh - var(--rhw-mobile-dock-height,70px) - 24px));border-radius:10px}
        .rhw-focus-tools-grid{grid-template-columns:1fr;gap:5px;padding:8px}
        .rhw-focus-tool-card{min-height:58px;padding:8px 9px}.rhw-focus-tool-copy strong{font-size:15px}
        .rhw-focus-tools-head{padding:12px}.rhw-focus-tools-head strong{font-size:21px}
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('rhw-focus-pass');
  }

  function tabTitle(button) {
    return [...(button?.children || [])].find(child => child.tagName === 'SPAN' && !child.classList.contains('rhw-workspace-index')) || button?.querySelector('span');
  }

  function relabelPrimaryTabs() {
    const command = document.querySelector('.app-tabs [data-workspace="command"]');
    const calculator = document.querySelector('.app-tabs [data-workspace="operations"]');
    const forum = document.querySelector('.app-tabs [data-workspace="comms"]');
    if (command) {
      const title = tabTitle(command); if (title) title.textContent = 'COMMAND';
      const sub = command.querySelector('small'); if (sub) sub.textContent = 'RHW STATUS';
      command.setAttribute('aria-label', 'Command');
    }
    if (calculator) {
      const title = tabTitle(calculator); if (title) title.textContent = 'CALCULATOR';
      const sub = calculator.querySelector('small'); if (sub) sub.textContent = 'ITEM COSTING';
      calculator.setAttribute('aria-label', 'Calculator');
    }
    if (forum) {
      const title = tabTitle(forum); if (title) title.textContent = 'FORUM';
      const sub = forum.querySelector('small'); if (sub) sub.textContent = 'TEMPLATE + BB CODE';
      forum.setAttribute('aria-label', 'Forum template');
    }
    document.getElementById('workspaceOperations')?.setAttribute('aria-label', 'Calculator workspace');
    document.getElementById('workspaceComms')?.setAttribute('aria-label', 'Forum workspace');
  }

  function toolsMarkup() {
    const cards = [
      ['build-queue', '01'], ['backup', '02'], ['newswire', '03'], ['senders', '04'], ['system', '05']
    ].map(([key, index]) => {
      const tool = TOOL_META[key];
      return `<button type="button" class="rhw-focus-tool-card" data-rhw-tool="${key}"><span class="rhw-focus-tool-index">${index}</span><span class="rhw-focus-tool-copy"><strong>${tool.label}</strong><small>${tool.sub}</small></span><span class="rhw-focus-tool-arrow" aria-hidden="true">›</span></button>`;
    }).join('');
    return `<aside class="rhw-focus-tools-overlay" id="rhwFocusToolsPanel" role="dialog" aria-modal="true" aria-labelledby="rhwFocusToolsTitle" data-focus-trap="true" hidden><section class="rhw-focus-tools-sheet"><header class="rhw-focus-tools-head"><div><strong id="rhwFocusToolsTitle">TOOLS</strong></div><button type="button" id="rhwFocusToolsClose">CLOSE</button></header><div class="rhw-focus-tools-grid">${cards}</div></section></aside>`;
  }

  function toolsFocusable(panel = document.getElementById('rhwFocusToolsPanel')) {
    if (!panel) return [];
    return [...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(element => {
      if (element.disabled || element.hidden || element.closest('[hidden]')) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
  }

  function trapToolsFocus(event) {
    const panel = document.getElementById('rhwFocusToolsPanel');
    if (!panel || panel.hidden || event.key !== 'Tab') return;
    const focusable = toolsFocusable(panel);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus?.();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (!panel.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    }
  }

  function mountTools() {
    if (!document.body) return false;
    let button = document.getElementById('rhwFocusToolsBtn');
    if (!button) {
      const brand = document.querySelector('.app-nav-brand');
      if (!brand) return false;
      button = document.createElement('button');
      button.id = 'rhwFocusToolsBtn';
      button.type = 'button';
      button.className = 'rhw-focus-tools-button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'rhwFocusToolsPanel');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span>TOOLS</span>';
      const install = document.getElementById('rhwPwaInstallBtn');
      if (install) brand.insertBefore(button, install);
      else brand.appendChild(button);
    }
    if (!document.getElementById('rhwFocusToolsPanel')) document.body.insertAdjacentHTML('beforeend', toolsMarkup());
    const panel = document.getElementById('rhwFocusToolsPanel');
    if (panel) panel.dataset.focusTrap = 'true';
    if (button.dataset.rhwFocusBound !== 'true') {
      button.dataset.rhwFocusBound = 'true';
      button.addEventListener('click', openTools);
      document.getElementById('rhwFocusToolsClose')?.addEventListener('click', closeTools);
      panel?.addEventListener('click', event => {
        if (event.target.id === 'rhwFocusToolsPanel') closeTools();
        const tool = event.target.closest('[data-rhw-tool]');
        if (tool) openTool(tool.dataset.rhwTool);
      });
      panel?.addEventListener('keydown', trapToolsFocus);
      window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !document.getElementById('rhwFocusToolsPanel')?.hidden) closeTools();
      });
    }
    return true;
  }

  function openTools() {
    const panel = document.getElementById('rhwFocusToolsPanel');
    if (!panel) return;
    toolOpenedBy = document.activeElement;
    panel.hidden = false;
    document.getElementById('rhwFocusToolsBtn')?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('rhw-focus-tools-open');
    document.getElementById('rhwFocusToolsClose')?.focus();
  }

  function closeTools() {
    const panel = document.getElementById('rhwFocusToolsPanel');
    if (panel) panel.hidden = true;
    document.getElementById('rhwFocusToolsBtn')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('rhw-focus-tools-open');
    toolOpenedBy?.focus?.();
    toolOpenedBy = null;
  }

  function routeTool() {
    return ROUTE_TOOL[`${app.state.activeWorkspace}/${app.state.activeWorkspace === 'operations' ? app.state.operationsNode : app.state.activeWorkspace === 'comms' ? app.state.commsNode : ''}`] || '';
  }

  function revealDataStatus() {
    const details = document.getElementById('rhwDataStatusUtility');
    if (!details) return;
    details.hidden = false;
    details.open = true;
    requestAnimationFrame(() => details.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  function syncHeadings(toolKey) {
    if (app.state.activeWorkspace === 'operations') {
      const kicker = document.querySelector('#workspaceOperations .workspace-kicker');
      if (kicker) kicker.innerHTML = toolKey === 'build-queue' ? '<span>TOOLS</span> RHW BUILD QUEUE' : '<span>CALCULATOR</span> RHW INDUSTRIAL COSTING';
    }
    if (app.state.activeWorkspace === 'comms') {
      const kicker = document.querySelector('#workspaceComms .workspace-kicker');
      if (kicker) kicker.innerHTML = toolKey ? '<span>TOOLS</span> RHW SECONDARY UTILITY' : '<span>FORUM</span> RHW FORUM TEMPLATE';
    }
    const active = document.getElementById('appActiveNode');
    if (!active || app.state.activeWorkspace === 'command') return;
    if (toolKey) active.textContent = `ACTIVE NODE: TOOLS / ${TOOL_META[toolKey]?.label || toolKey.toUpperCase()}`;
    else active.textContent = `ACTIVE NODE: ${app.state.activeWorkspace === 'operations' ? 'CALCULATOR' : 'FORUM'}`;
  }

  function sync() {
    installStyles();
    relabelPrimaryTabs();
    mountTools();
    const toolKey = routeTool();
    document.body.dataset.rhwFocusTool = toolKey;
    const toolsButton = document.getElementById('rhwFocusToolsBtn');
    if (toolsButton) toolsButton.dataset.toolOpen = toolKey ? 'true' : 'false';
    syncHeadings(toolKey);
  }

  function queueSync() {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(sync, 0);
    window.setTimeout(sync, 90);
    window.setTimeout(sync, 260);
  }

  function openTool(key) {
    const tool = TOOL_META[key];
    if (!tool) return;
    closeTools();
    if (key === 'system' || key === 'data') {
      app.diagnostics?.open?.();
      if (!app.diagnostics?.open) document.getElementById('rhwDiagnosticsBtn')?.click();
      if (key === 'data') revealDataStatus();
      return;
    }
    app.navigate(tool.workspace, tool.node);
    queueSync();
  }

  function bindPrimaryDefaults() {
    const nav = document.getElementById('rhwAppNav');
    if (!nav || nav.dataset.rhwFocusPrimaryBound === 'true') return;
    nav.dataset.rhwFocusPrimaryBound = 'true';
    nav.addEventListener('click', event => {
      const button = event.target.closest('.app-tabs [data-workspace]');
      if (!button) return;
      const workspace = button.dataset.workspace;
      if (workspace === 'operations' || workspace === 'comms') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        app.navigate(workspace, workspace === 'operations' ? 'calculator' : 'forum');
        queueSync();
      }
    }, true);
  }

  function selfTest() {
    const failures = [];
    const tabs = {
      command: tabTitle(document.querySelector('.app-tabs [data-workspace="command"]'))?.textContent?.trim(),
      calculator: tabTitle(document.querySelector('.app-tabs [data-workspace="operations"]'))?.textContent?.trim(),
      forum: tabTitle(document.querySelector('.app-tabs [data-workspace="comms"]'))?.textContent?.trim()
    };
    if (tabs.command !== 'COMMAND' || tabs.calculator !== 'CALCULATOR' || tabs.forum !== 'FORUM') failures.push('primary-tabs');
    if (!document.getElementById('rhwFocusToolsBtn') || !document.getElementById('rhwFocusToolsPanel')) failures.push('tools-surface');
    if (document.querySelectorAll('#rhwFocusToolsPanel [data-rhw-tool]').length !== 5) failures.push('tool-count');
    if (document.getElementById('rhwFocusToolsPanel')?.dataset.focusTrap !== 'true') failures.push('tools-focus-trap');
    if (!document.documentElement.classList.contains('rhw-focus-pass')) failures.push('focus-class');
    return failures;
  }

  installStyles();

  if (!location.hash) {
    app.store.set(app.config.storageKeys.operationsNode, 'calculator');
    app.store.set(app.config.storageKeys.commsNode, 'forum');
  }

  app.installShell = function focusedInstallShell(...args) {
    const result = base.installShell.apply(this, args);
    sync();
    bindPrimaryDefaults();
    return result;
  };

  app.applyRoute = function focusedApplyRoute(...args) {
    const result = base.applyRoute.apply(this, args);
    queueSync();
    return result;
  };

  app.navigate = function focusedNavigate(workspace, node, options) {
    const result = base.navigate.call(this, workspace, node, options);
    queueSync();
    return result;
  };

  if (typeof base.operationsInit === 'function') {
    app.operations.init = async function focusedOperationsInit(...args) {
      const result = await base.operationsInit.apply(this, args);
      queueSync();
      return result;
    };
  }
  if (typeof base.operationsActivate === 'function') {
    app.operations.activate = function focusedOperationsActivate(node, options) {
      const result = base.operationsActivate.call(this, node, options);
      queueSync();
      return result;
    };
  }
  if (typeof base.commsInit === 'function') {
    app.comms.init = function focusedCommsInit(...args) {
      const result = base.commsInit.apply(this, args);
      queueSync();
      return result;
    };
  }
  if (typeof base.commsActivate === 'function') {
    app.comms.activate = function focusedCommsActivate(node, options) {
      const result = base.commsActivate.call(this, node, options);
      queueSync();
      return result;
    };
  }

  app.focusPass = { installStyles, relabelPrimaryTabs, mountTools, openTools, closeTools, openTool, sync, selfTest, tools: TOOL_META };
})();