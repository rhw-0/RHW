/* ==========================================================================
   RHW WEB APP · V4.0 NEWSWIRE LIVE PREVIEW BRIDGE
   Makes the Newswire Manager working copy drive the ticker in this browser,
   while protecting unsaved local edits from accidental repository reloads.
   ========================================================================== */
(function initRhwV4NewswireLiveBridge() {
  'use strict';
  const app = window.RHWV4;
  const manager = app?.newswireManager;
  if (!app || !manager || app.newswireLiveBridge) return;

  const CATEGORIES = Object.freeze(['market', 'regional', 'security', 'operations', 'corporate']);
  const state = manager.state;
  const STYLE_ID = 'rhwV40NewswireLiveBridgeStyle';
  let managerObserver = null;
  let applyQueued = false;
  let lastSignature = '';

  function signature(entries = state.entries) {
    return (entries || []).map(entry => `${entry.id}\u0000${entry.category}\u0000${entry.tone}\u0000${entry.tag}\u0000${entry.message}`).join('\u0001');
  }

  function isChanged(entry) {
    const base = (state.baseEntries || []).find(item => item.id === entry.id);
    return !base || base.category !== entry.category || base.tone !== entry.tone || base.tag !== entry.tag || base.message !== entry.message;
  }

  function workingPools() {
    const pools = {};
    CATEGORIES.forEach(category => {
      const categoryEntries = (state.entries || []).filter(entry => entry.category === category);
      const changed = categoryEntries.filter(isChanged);
      const unchanged = categoryEntries.filter(entry => !isChanged(entry));
      pools[category] = [...changed, ...unchanged].map(entry => ({
        tag: String(entry.tag || '').trim().slice(0, 40),
        text: String(entry.message || '').trim().slice(0, 240),
        tone: String(entry.tone || 'lore').toLowerCase()
      })).filter(entry => entry.tag && entry.text);
    });
    return pools;
  }

  function resolveGlobal(name) {
    try {
      const value = window[name];
      if (typeof value === 'function') return value;
    } catch {}
    try {
      if (name === 'applyNewswirePools' && typeof applyNewswirePools === 'function') return applyNewswirePools;
      if (name === 'buildIndustrialNewswireMessages' && typeof buildIndustrialNewswireMessages === 'function') return buildIndustrialNewswireMessages;
      if (name === 'updateTickerSlots' && typeof updateTickerSlots === 'function') return updateTickerSlots;
    } catch {}
    return null;
  }

  function applyWorkingCopyToTicker({ force = false } = {}) {
    if (!state.loaded || !Array.isArray(state.entries)) return false;
    const nextSignature = signature();
    if (!force && nextSignature === lastSignature) return true;

    const applyPools = resolveGlobal('applyNewswirePools');
    if (!applyPools) return false;
    applyPools(workingPools());

    const buildMessages = resolveGlobal('buildIndustrialNewswireMessages');
    const updateSlots = resolveGlobal('updateTickerSlots');
    if (buildMessages && updateSlots) {
      try { updateSlots(buildMessages()); } catch {}
    }

    lastSignature = nextSignature;
    return true;
  }

  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    queueMicrotask(() => {
      applyQueued = false;
      applyWorkingCopyToTicker();
      refreshPublishHint();
    });
  }

  function refreshPublishHint() {
    const banner = document.getElementById('v40NewswirePublishBanner');
    const hint = document.getElementById('v40NewswirePublishHint');
    if (!banner || !hint) return;
    if (state.dirty) {
      banner.dataset.tone = 'dirty';
      hint.textContent = 'LIVE TICKER ABOVE IS PREVIEWING THIS LOCAL WORKING COPY. IT IS NOT PUBLISHED. USE COPY UPDATED NEWSWIRE OR EXPORT RHW_NEWSWIRE.MD TO PUBLISH IT MANUALLY.';
    }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #v40NewswireReloadBtn,#v40NewswireResetBtn{
        min-height:36px!important;padding:7px 12px!important;font-size:10px!important;letter-spacing:.075em!important
      }
      #v40NewswireReloadBtn{border-color:rgba(125,167,234,.32)!important;color:#bfd0ea!important}
      #v40NewswireResetBtn{border-color:rgba(201,139,44,.28)!important;color:#d9ad68!important}
      .v40-newswire-manager-head small,.v40-newswire-publish-banner span{font-size:9px!important}
      @media(max-width:900px){
        #v40NewswireReloadBtn,#v40NewswireResetBtn{font-size:9.5px!important;min-height:38px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function renameControls() {
    const reload = document.getElementById('v40NewswireReloadBtn');
    const reset = document.getElementById('v40NewswireResetBtn');
    if (reload) {
      reload.textContent = 'RELOAD PUBLISHED FILE';
      reload.title = 'Reload the repository version. Local edits are protected and must be reset explicitly first.';
    }
    if (reset) {
      reset.textContent = 'RESET TO PUBLISHED FILE';
      reset.title = 'Discard the local working copy and return to the currently published Newswire file.';
    }
  }

  function installReloadProtection() {
    const reload = document.getElementById('v40NewswireReloadBtn');
    if (!reload || reload.dataset.v40Protected === 'true') return;
    reload.dataset.v40Protected = 'true';
    reload.addEventListener('click', event => {
      if (!state.dirty) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      app.notify?.('LOCAL NEWSWIRE EDITS EXIST // USE RESET TO PUBLISHED FILE TO DISCARD THEM', 'warn');
      refreshPublishHint();
    }, true);
  }

  function observeManager() {
    const root = document.getElementById('v40NewswireManager');
    if (!root || root.dataset.v40LiveBridge === 'true') return;
    root.dataset.v40LiveBridge = 'true';
    managerObserver = new MutationObserver(queueApply);
    managerObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  function installRemoteRefreshGuard() {
    try {
      if (typeof loadNewswire !== 'function' || loadNewswire.__rhwV40WorkingCopyAware === true) return;
      const baseLoadNewswire = loadNewswire;
      const wrapped = async function rhwV40WorkingCopyAwareNewswireLoad(...args) {
        const result = await baseLoadNewswire.apply(this, args);
        if (state.dirty) applyWorkingCopyToTicker({ force: true });
        return result;
      };
      wrapped.__rhwV40WorkingCopyAware = true;
      loadNewswire = wrapped;
      try { window.loadNewswire = wrapped; } catch {}
    } catch {}
  }

  function selfTest() {
    const failures = [];
    const pools = workingPools();
    CATEGORIES.forEach(category => {
      if (!Array.isArray(pools[category])) failures.push(`pool:${category}`);
    });
    const reload = document.getElementById('v40NewswireReloadBtn');
    if (!reload || !reload.textContent.includes('PUBLISHED')) failures.push('reload-label');
    if (!document.getElementById(STYLE_ID)) failures.push('styles');
    return failures;
  }

  function install() {
    installStyles();
    renameControls();
    installReloadProtection();
    observeManager();
    installRemoteRefreshGuard();
    applyWorkingCopyToTicker({ force: true });
    refreshPublishHint();
  }

  // 16c loads before the runtime calls COMMS.init(). Wrap the manager-aware
  // COMMS initializer so the bridge binds only after 16b has mounted its UI.
  const baseCommsInit = app.comms.init;
  app.comms.init = function newswireLiveBridgeAwareInit(...args) {
    const result = baseCommsInit.apply(this, args);
    install();
    return result;
  };

  const baseCommsActivate = app.comms.activate;
  app.comms.activate = function newswireLiveBridgeAwareActivate(node, options) {
    const result = baseCommsActivate.call(this, node, options);
    if (node === 'ticker') install();
    return result;
  };

  // Early install is still useful for the shared styles / remote refresh guard.
  install();

  app.newswireLiveBridge = {
    install,
    workingPools,
    applyWorkingCopyToTicker,
    selfTest
  };
})();