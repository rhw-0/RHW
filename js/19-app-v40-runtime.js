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

  function installDesktopReadabilityCoverage() {
    const style = document.getElementById('rhwV40ReleasePolishStyle');
    if (!style || style.dataset.fullReadability === 'true') return;
    style.dataset.fullReadability = 'true';
    style.textContent += `
      @media (min-width:1200px){
        [data-command-panel="inventory"] .alert-list li>span>strong{font-size:13px!important}
        [data-command-panel="inventory"] .alert-list li small{font-size:9px!important;line-height:1.35}
        [data-command-panel="inventory"] .overview-row-qty{font-size:13px!important}
        [data-command-panel="inventory"] .pill{font-size:9px!important}
        [data-command-panel="inventory"] .inventory-view-nav span{font-size:10px!important}
        [data-command-panel="inventory"] .inventory-view-nav small{font-size:8.5px!important}
        [data-command-panel="production"] .production-kicker{font-size:11px!important}
        [data-command-panel="production"] .module-state{font-size:10px!important}
        [data-command-panel="production"] .recipe-column-head{font-size:9.5px!important}
        [data-command-panel="production"] .recipe-short{font-size:9px!important}
        [data-command-panel="production"] .byproduct-strip{font-size:10px!important}
        [data-command-panel="production"] .footnote{font-size:12px!important}
        [data-command-panel="logistics"] .remote-route small,
        [data-command-panel="logistics"] .logistics-subhead-kicker,
        [data-command-panel="logistics"] .logistics-subhead-meta{font-size:9px!important}
        [data-command-panel="logistics"] .market-sort-button{font-size:9px!important}
        [data-command-panel="logistics"] .supplier-grid small,
        [data-command-panel="logistics"] .market-scan-grid small{font-size:9px!important;line-height:1.35}
      }
    `;
  }

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
    (app.commsSafety?.selfTest?.() || []).forEach(failure => failures.push(`polish:${failure}`));
    if (document.getElementById('rhwV40ReleasePolishStyle')?.dataset.fullReadability !== 'true') failures.push('polish:desktop-readability');
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
      installDesktopReadabilityCoverage();
      await app.operations?.init();
      app.applyRoute({ replace: true });
      app.commsSafety?.polishOperations?.();
      document.querySelectorAll('#workspaceOperations .ops-price-input-wrap > span').forEach(node => {
        if (node.textContent.trim() === 'CR') node.textContent = '$';
      });
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