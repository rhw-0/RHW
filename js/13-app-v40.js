/* ==========================================================================
   RHW WEB APP · V4.0 CORE
   One app shell, one route model, shared utilities. Feature modules register
   themselves on RHWV4 without replacing functions defined by other modules.
   ========================================================================== */
(function initRhwV4Core() {
  'use strict';

  const app = window.RHWV4 = {
    version: RHW_APP_VERSION,
    config: RHW_APP_CONFIG,
    state: {
      activeWorkspace: 'command',
      commandNode: 'overview',
      inventoryView: 'status',
      commsNode: 'forum',
      localSenders: [],
      drafts: [],
      comms: null,
      editingSenderKey: null
    },
    modules: {},
    ready: false
  };

  app.util = {
    escape(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
    },
    uid(prefix = 'rhw') {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },
    normalize(value) {
      return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    },
    pick(values = []) {
      return values.length ? values[Math.floor(Math.random() * values.length)] : '';
    },
    roman(value) {
      const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      return numerals[Math.max(1, Math.min(12, Number(value) || 1)) - 1];
    },
    number(value) {
      try { return typeof window.number === 'function' ? window.number(value) : Number(value || 0).toLocaleString('en-US'); }
      catch { return String(value ?? '0'); }
    },
    async copy(text) {
      const value = String(text ?? '');
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const result = document.execCommand?.('copy') !== false;
        area.remove();
        return result;
      }
    }
  };

  app.store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  };

  app.template = function template(key) {
    return app.config.templates.find(entry => entry.key === key) || app.config.templates[0];
  };

  app.classificationColor = function classificationColor(value) {
    return app.config.classificationColors[value] || app.config.forum.brandColor;
  };

  app.generateCipher = function generateCipher(templateKey = app.state.comms?.templateKey || 'formal') {
    const pool = app.config.cipher;
    const authorities = pool.authorities[templateKey] || pool.authorities.formal;
    const authority = app.util.pick(authorities);
    const family = app.util.pick(pool.families);
    const keyset = app.util.pick(pool.keysets);
    const mark = app.util.roman(2 + Math.floor(Math.random() * 9));
    const serial = String(1 + Math.floor(Math.random() * 98)).padStart(2, '0');
    return `${authority}-${family}/${mark} · KEY ${keyset}-${serial}`;
  };

  app.notify = function notify(message, tone = 'good') {
    const status = document.getElementById('commsStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    clearTimeout(app.notifyTimer);
    app.notifyTimer = setTimeout(() => {
      status.textContent = 'LOCAL COMMAND CACHE READY';
      status.dataset.tone = 'muted';
    }, 2600);
  };

  app.route = {
    parse() {
      const parts = location.hash.replace(/^#/, '').toLowerCase().split('/').filter(Boolean);
      const workspace = ['command', 'comms'].includes(parts[0]) ? parts[0] : null;
      let node = parts[1] || null;
      if (workspace === 'comms' && node === 'newswire') node = 'ticker';
      return { workspace, node };
    },
    write(workspace, node, { replace = false } = {}) {
      const next = `#${workspace}/${node}`;
      if (location.hash === next) return;
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({ rhwWorkspace: workspace, rhwNode: node }, '', next);
    }
  };

  app.setActiveNode = function setActiveNode(value) {
    const target = document.getElementById('appActiveNode');
    if (target) target.textContent = `ACTIVE NODE: ${value}`;
  };

  app.installShell = function installShell() {
    if (document.getElementById('rhwAppNav')) return true;
    const ticker = document.getElementById('newswirePanel');
    const strip = document.getElementById('commandStrip');
    const main = document.querySelector('main');
    if (!ticker || !strip || !main) return false;

    const nav = document.createElement('nav');
    nav.id = 'rhwAppNav';
    nav.className = 'rhw-app-nav';
    nav.setAttribute('aria-label', 'RHW application workspaces');
    nav.innerHTML = `
      <div class="app-nav-inner">
        <div class="app-nav-brand">
          <span class="app-nav-pulse" aria-hidden="true"></span>
          <div><strong>RHW WEB APP</strong><small>${app.util.escape(app.version)}</small><small id="appActiveNode" class="app-active-node">ACTIVE NODE: COMMAND / OVERVIEW</small></div>
        </div>
        <div class="app-tabs" role="tablist" aria-label="RHW workspaces">
          <button type="button" role="tab" data-workspace="command" aria-controls="workspaceCommand"><span>COMMAND</span><small>LIVE OPERATIONS</small></button>
          <button type="button" role="tab" data-workspace="comms" aria-controls="workspaceComms"><span>COMMS</span><small>TRANSMISSION STUDIO</small></button>
        </div>
      </div>`;
    ticker.insertAdjacentElement('afterend', nav);

    const root = document.createElement('div');
    root.id = 'rhwWorkspaceRoot';
    root.className = 'rhw-workspace-root';
    nav.insertAdjacentElement('afterend', root);

    const command = document.createElement('section');
    command.id = 'workspaceCommand';
    command.className = 'app-workspace command-workspace';
    command.setAttribute('role', 'tabpanel');
    command.setAttribute('aria-label', 'Command workspace');
    root.appendChild(command);
    command.appendChild(strip);
    command.appendChild(main);

    const comms = document.createElement('section');
    comms.id = 'workspaceComms';
    comms.className = 'app-workspace comms-workspace';
    comms.setAttribute('role', 'tabpanel');
    comms.setAttribute('aria-label', 'Communications workspace');
    comms.hidden = true;
    root.appendChild(comms);

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-workspace]');
      if (!button) return;
      const workspace = button.dataset.workspace;
      const key = workspace === 'command' ? app.config.storageKeys.commandNode : app.config.storageKeys.commsNode;
      const fallback = workspace === 'command' ? 'overview' : 'forum';
      const node = app.store.get(key, fallback);
      app.navigate(workspace, node);
    });

    nav.addEventListener('keydown', event => {
      const button = event.target.closest('[data-workspace]');
      if (!button || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const buttons = [...nav.querySelectorAll('[data-workspace]')];
      const current = buttons.indexOf(button);
      const next = buttons[(current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      next.focus();
      next.click();
    });
    return true;
  };

  app.activateWorkspace = function activateWorkspace(workspace) {
    const safe = ['command', 'comms'].includes(workspace) ? workspace : 'command';
    app.state.activeWorkspace = safe;
    app.store.set(app.config.storageKeys.activeWorkspace, safe);
    document.body.dataset.workspace = safe;

    document.querySelectorAll('.app-workspace').forEach(panel => {
      panel.hidden = panel.id !== `workspace${safe[0].toUpperCase()}${safe.slice(1)}`;
    });
    document.querySelectorAll('[data-workspace]').forEach(button => {
      const active = button.dataset.workspace === safe;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
  };

  app.applyRoute = function applyRoute({ replace = false } = {}) {
    const route = app.route.parse();
    const workspace = route.workspace || app.store.get(app.config.storageKeys.activeWorkspace, 'command');
    app.activateWorkspace(workspace);
    if (workspace === 'command') {
      const node = route.node || app.store.get(app.config.storageKeys.commandNode, 'overview');
      app.command?.activate(node, { updateRoute: false });
      if (!route.workspace) app.route.write('command', app.state.commandNode || 'overview', { replace: true });
    } else {
      const node = route.node || app.store.get(app.config.storageKeys.commsNode, 'forum');
      app.comms?.activate(node, { updateRoute: false });
      if (!route.workspace) app.route.write('comms', app.state.commsNode || 'forum', { replace: true });
    }
    if (replace && route.workspace) app.route.write(workspace, route.node || (workspace === 'command' ? 'overview' : 'forum'), { replace: true });
  };

  app.navigate = function navigate(workspace, node, { replace = false } = {}) {
    app.activateWorkspace(workspace);
    if (workspace === 'command') app.command?.activate(node, { updateRoute: false });
    else app.comms?.activate(node, { updateRoute: false });
    app.route.write(workspace, workspace === 'command' ? app.state.commandNode : app.state.commsNode, { replace });
  };

  window.addEventListener('popstate', () => app.applyRoute());
  window.addEventListener('hashchange', () => app.applyRoute());
})();
