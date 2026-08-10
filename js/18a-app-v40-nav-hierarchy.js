/* ==========================================================================
   RHW WEB APP · V4.0 NAVIGATION HIERARCHY
   Mounts the active workspace's real sub-navigation directly below the global
   COMMAND / OPERATIONS / COMMS switcher without duplicating controls.
   ========================================================================== */
(function initRhwV4NavigationHierarchy() {
  'use strict';
  const app = window.RHWV4;
  if (!app) return;

  const SUBNAV_IDS = Object.freeze({
    command: 'commandNodeNav',
    operations: 'operationsNodeNav',
    comms: 'commsNodeNav'
  });
  let observer = null;

  function safeWorkspace(value) {
    return Object.prototype.hasOwnProperty.call(SUBNAV_IDS, value) ? value : 'command';
  }

  function ensureShell() {
    const rootNav = document.getElementById('rhwAppNav');
    const inner = rootNav?.querySelector('.app-nav-inner');
    const tabs = inner?.querySelector('.app-tabs');
    if (!rootNav || !inner || !tabs) return false;

    let cluster = document.getElementById('appNavigationCluster');
    if (!cluster) {
      cluster = document.createElement('div');
      cluster.id = 'appNavigationCluster';
      cluster.className = 'app-navigation-cluster';
      tabs.insertAdjacentElement('beforebegin', cluster);
      cluster.appendChild(tabs);

      const slot = document.createElement('div');
      slot.id = 'appContextNavSlot';
      slot.className = 'app-context-nav-slot';
      slot.setAttribute('aria-label', 'Active workspace navigation');
      cluster.appendChild(slot);
    }
    return true;
  }

  function ensureHome(nav, workspace) {
    let home = nav.dataset.navHomeId ? document.getElementById(nav.dataset.navHomeId) : null;
    if (home) return home;

    home = document.createElement('span');
    home.id = `${nav.id}Home`;
    home.className = 'workspace-subnav-home';
    home.hidden = true;
    nav.insertAdjacentElement('beforebegin', home);
    nav.dataset.navHomeId = home.id;
    nav.dataset.workspaceOwner = workspace;
    return home;
  }

  function restore(nav) {
    if (!nav) return;
    const home = nav.dataset.navHomeId ? document.getElementById(nav.dataset.navHomeId) : null;
    if (home) home.insertAdjacentElement('afterend', nav);
    nav.classList.remove('app-mounted-subnav');
  }

  function sync(workspace = app.state.activeWorkspace || document.body.dataset.workspace || 'command') {
    if (!ensureShell()) return false;
    const active = safeWorkspace(workspace);
    const slot = document.getElementById('appContextNavSlot');
    const target = document.getElementById(SUBNAV_IDS[active]);
    if (!slot) return false;

    [...slot.querySelectorAll(':scope > .workspace-subnav')].forEach(nav => {
      if (nav !== target) restore(nav);
    });

    /* data-workspace is reserved for the three actual workspace tabs. */
    slot.dataset.activeWorkspace = active;
    if (!target) return false;

    ensureHome(target, active);
    if (target.parentElement !== slot) slot.appendChild(target);
    target.classList.add('app-mounted-subnav');
    return true;
  }

  function selfTest() {
    const failures = [];
    const active = safeWorkspace(app.state.activeWorkspace || document.body.dataset.workspace || 'command');
    const slot = document.getElementById('appContextNavSlot');
    const expectedId = SUBNAV_IDS[active];
    const mounted = slot?.querySelector(':scope > .workspace-subnav');

    if (!document.getElementById('appNavigationCluster')) failures.push('missing-cluster');
    if (!slot) failures.push('missing-context-slot');
    if (slot?.hasAttribute('data-workspace')) failures.push('context-slot-workspace-collision');
    if (slot?.dataset.activeWorkspace !== active) failures.push(`context-slot-state:${active}`);
    if (!mounted || mounted.id !== expectedId) failures.push(`mounted-subnav:${expectedId}`);
    if (!document.querySelector(`.app-tabs [data-workspace="${active}"].active`)) failures.push(`active-workspace-tab:${active}`);
    return failures;
  }

  function init() {
    if (!ensureShell()) return false;
    sync();
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      if (!mutations.some(mutation => mutation.attributeName === 'data-workspace')) return;
      requestAnimationFrame(() => sync());
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-workspace'] });
    return true;
  }

  app.navHierarchy = { init, sync, selfTest };
})();
