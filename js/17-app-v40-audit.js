/* ==========================================================================
   RHW WEB APP · V4.0 RUNTIME
   Deterministic boot, diagnostics and smoke-test surface.
   ========================================================================== */
(function initRhwV4Runtime() {
  'use strict';
  const app = window.RHWV4;
  if (!app) return;

  const runtimeErrors = [];

  function recordError(error) {
    const message = String(error?.message || error || 'UNKNOWN RUNTIME ERROR');
    runtimeErrors.push(message);
    document.documentElement.dataset.v40Error = 'true';
    window.__RHW_V4_SMOKE__ = { ready: false, errors: [...runtimeErrors], route: location.hash };
    console.error('RHW V4 RUNTIME', error);
  }

  window.addEventListener('error', event => recordError(event.error || event.message));
  window.addEventListener('unhandledrejection', event => recordError(event.reason));

  function selfTest() {
    const failures = [];
    const requiredIds = ['rhwAppNav', 'rhwWorkspaceRoot', 'workspaceCommand', 'workspaceComms', 'commandNodeNav', 'commsNodeNav', 'commsForm', 'forumLivePreview'];
    requiredIds.forEach(id => { if (!document.getElementById(id)) failures.push(`missing:${id}`); });
    if (typeof app.command?.activate !== 'function') failures.push('module:command');
    if (typeof app.comms?.activate !== 'function') failures.push('module:comms');
    if (typeof app.storage?.saveDraft !== 'function') failures.push('module:storage');
    if (typeof app.comms?.buildBbcode !== 'function') failures.push('feature:bbcode');
    if (!document.querySelector('[data-command-panel="overview"]')) failures.push('route:command-overview');
    if (!document.querySelector('[data-comms-panel="ticker"]')) failures.push('route:comms-ticker');
    return failures;
  }

  function exposeSmoke(failures = []) {
    const route = app.route.parse();
    const allErrors = [...runtimeErrors, ...failures];
    window.__RHW_V4_SMOKE__ = {
      ready: allErrors.length === 0,
      errors: allErrors,
      workspace: app.state.activeWorkspace,
      commandNode: app.state.commandNode,
      commsNode: app.state.commsNode,
      route
    };
    document.documentElement.dataset.v40Ready = allErrors.length ? 'false' : 'true';
    if (allErrors.length) document.documentElement.dataset.v40Error = 'true';
  }

  function boot() {
    try {
      document.documentElement.dataset.rhwApp = 'v4';
      if (new URLSearchParams(location.search).has('smoke') || window.__RHW_SMOKE_INLINE__) document.documentElement.classList.add('v40-smoke-mode');
      app.storage?.init();
      if (!app.installShell()) throw new Error('V4 APP SHELL COULD NOT FIND THE STABLE DASHBOARD MOUNTS');
      app.command?.init();
      app.comms?.init();
      app.applyRoute({ replace: true });
      app.ready = true;
      const failures = selfTest();
      exposeSmoke(failures);
      if (failures.length) throw new Error(`V4 SELF TEST FAILED: ${failures.join(', ')}`);
    } catch (error) {
      recordError(error);
    }
  }

  app.runtime = { boot, selfTest, recordError };
  boot();
})();
