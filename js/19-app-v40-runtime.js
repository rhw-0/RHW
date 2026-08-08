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
    ['rhwAppNav','rhwWorkspaceRoot','workspaceCommand','workspaceOperations','workspaceComms','commandNodeNav','operationsNodeNav','commsNodeNav','commsForm','forumLivePreview'].forEach(id => {
      if (!document.getElementById(id)) failures.push(`missing:${id}`);
    });
    if (typeof app.command?.activate !== 'function') failures.push('module:command');
    if (typeof app.operations?.activate !== 'function') failures.push('module:operations');
    if (typeof app.operationsCore?.buildPlan !== 'function') failures.push('feature:operations-planner');
    if (!app.operationsCore?.state?.catalog?.meta?.recipeCount) failures.push('feature:recipe-catalog');
    const bustardAlias = app.operations?.recipeAliases?.ship_assembly_dsy_barge;
    if (!bustardAlias || bustardAlias.outputId !== 'dsy_barge_package' || !app.operationsCore?.recipe?.('ship_assembly_dsy_barge')) failures.push('feature:bustard-recipe-alias');
    const iffSelect = document.getElementById('opsAffiliation');
    if (iffSelect?.textContent?.includes('RHW DEFAULT')) failures.push('ui:bmm-iff-label');
    if (typeof app.comms?.activate !== 'function') failures.push('module:comms');
    if (typeof app.commsSafety?.init !== 'function') failures.push('module:comms-safety');
    if (typeof app.storage?.saveDraft !== 'function') failures.push('module:storage');
    if (typeof app.comms?.buildBbcode !== 'function') failures.push('feature:bbcode');
    if (!document.querySelector('[data-command-panel="overview"]')) failures.push('route:command-overview');
    if (!document.querySelector('[data-operations-panel="calculator"]')) failures.push('route:operations-calculator');
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
      operationsNode: app.state.operationsNode,
      commsNode: app.state.commsNode,
      route,
      recipeCount: app.operationsCore?.state?.catalog?.meta?.recipeCount || 0
    };
    document.documentElement.dataset.v40Ready = allErrors.length ? 'false' : 'true';
    if (allErrors.length) document.documentElement.dataset.v40Error = 'true';
  }

  async function boot() {
    try {
      document.documentElement.dataset.rhwApp = 'v4';
      if (new URLSearchParams(location.search).has('smoke') || window.__RHW_SMOKE_INLINE__) document.documentElement.classList.add('v40-smoke-mode');
      app.storage?.init();
      if (!app.installShell()) throw new Error('V4 APP SHELL COULD NOT FIND THE STABLE DASHBOARD MOUNTS');
      app.command?.init();
      app.comms?.init();
      app.commsSafety?.init();
      await app.operations?.init();
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
