/* ==========================================================================
   RHW WEB APP · V4.0 NEWSWIRE ORDERING + FILE-EDITOR POLISH
   Keeps the Newswire Manager strictly as a local RHW_Newswire.md editor.
   Adds within-category ordering controls and readable file reset/reload actions.
   ========================================================================== */
(function initRhwV4NewswireOrdering() {
  'use strict';
  const app = window.RHWV4;
  const manager = app?.newswireManager;
  if (!app || !manager || app.newswireOrdering) return;

  const state = manager.state;
  const STYLE_ID = 'rhwV40NewswireOrderingStyle';
  let observer = null;
  let installed = false;
  let primed = false;
  let applyingOrder = false;
  let knownIds = new Set();

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #v40NewswireReloadBtn,#v40NewswireResetBtn{
        min-height:38px!important;padding:8px 13px!important;font-size:10px!important;
        font-weight:700!important;letter-spacing:.075em!important;text-shadow:none!important;
        opacity:1!important;filter:none!important
      }
      #v40NewswireReloadBtn{
        border-color:rgba(125,167,234,.34)!important;background:rgba(125,167,234,.075)!important;color:#c3d4ee!important
      }
      #v40NewswireResetBtn{
        border-color:rgba(201,139,44,.36)!important;background:rgba(201,139,44,.075)!important;color:#e0b36a!important
      }
      #v40NewswireResetBtn:hover,#v40NewswireResetBtn:focus-visible{
        background:rgba(201,139,44,.14)!important;color:#f0c77f!important;border-color:rgba(201,139,44,.52)!important
      }
      #v40NewswireResetBtn:disabled,#v40NewswireReloadBtn:disabled{
        opacity:.52!important;color:rgba(224,224,224,.52)!important;background:rgba(255,255,255,.035)!important
      }
      .v40-newswire-order-actions{display:flex;gap:5px;align-items:center}
      .v40-newswire-order-actions button{
        min-width:54px!important;min-height:30px!important;padding:5px 7px!important;font-size:8px!important;
        border-color:rgba(212,175,55,.18)!important;background:rgba(212,175,55,.035)!important;color:#c9ae61!important
      }
      .v40-newswire-order-actions button:hover,.v40-newswire-order-actions button:focus-visible{
        background:rgba(212,175,55,.10)!important;color:#e6c96f!important
      }
      .v40-newswire-order-actions button:disabled{opacity:.28!important;cursor:not-allowed!important}
      .v40-newswire-entry-actions{flex-wrap:wrap;align-items:center}
      .v40-newswire-order-note{
        padding:8px 14px;border-top:1px solid rgba(212,175,55,.10);border-bottom:1px solid rgba(212,175,55,.10);
        background:rgba(212,175,55,.025);font-family:var(--font-tech);font-size:9px;line-height:1.45;letter-spacing:.055em;
        color:rgba(224,224,224,.58)
      }
      .v40-newswire-order-note strong{color:#d8bc68}
      @media(max-width:900px){
        #v40NewswireReloadBtn,#v40NewswireResetBtn{font-size:9.5px!important;min-height:40px!important}
        .v40-newswire-order-actions button{min-width:64px!important;min-height:34px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installOrderNote() {
    const summary = document.getElementById('v40NewswireCategorySummary');
    if (!summary || document.getElementById('v40NewswireOrderNote')) return;
    const note = document.createElement('div');
    note.id = 'v40NewswireOrderNote';
    note.className = 'v40-newswire-order-note';
    note.innerHTML = '<strong>ORDER</strong> // ▲ UP / ▼ DOWN CHANGES THE ORDER INSIDE EACH CATEGORY. NEW BULLETINS START AT THE TOP OF THEIR SELECTED CATEGORY.';
    summary.insertAdjacentElement('afterend', note);
  }

  function categoryEntries(category) {
    return (state.entries || []).filter(entry => entry.category === category);
  }

  function categoryPosition(entry) {
    return categoryEntries(entry.category).findIndex(item => item.id === entry.id);
  }

  function commitReorder(id) {
    const entry = (state.entries || []).find(item => item.id === id);
    if (!entry) return false;
    // applyEdit recalculates dirty/session state and re-renders the manager while
    // preserving the order we already changed in state.entries.
    return manager.applyEdit(id, { ...entry });
  }

  function moveWithinCategory(id, direction, { announce = true } = {}) {
    if (applyingOrder) return false;
    const entries = state.entries || [];
    const entry = entries.find(item => item.id === id);
    if (!entry) return false;
    const categoryIndices = entries.map((item, index) => item.category === entry.category ? index : -1).filter(index => index >= 0);
    const currentIndex = entries.findIndex(item => item.id === id);
    const currentPosition = categoryIndices.indexOf(currentIndex);
    const targetPosition = currentPosition + direction;
    if (currentPosition < 0 || targetPosition < 0 || targetPosition >= categoryIndices.length) return false;
    const targetIndex = categoryIndices[targetPosition];

    applyingOrder = true;
    try {
      [entries[currentIndex], entries[targetIndex]] = [entries[targetIndex], entries[currentIndex]];
      commitReorder(id);
      if (announce) app.notify?.('NEWSWIRE ORDER UPDATED // LOCAL WORKING COPY');
      return true;
    } finally {
      applyingOrder = false;
    }
  }

  function moveNewEntryToCategoryTop(id) {
    if (applyingOrder) return false;
    const entries = state.entries || [];
    const index = entries.findIndex(item => item.id === id);
    if (index < 0) return false;
    const entry = entries[index];
    const firstCategoryIndex = entries.findIndex(item => item.category === entry.category);
    if (firstCategoryIndex < 0 || firstCategoryIndex === index) return false;

    applyingOrder = true;
    try {
      entries.splice(index, 1);
      entries.splice(firstCategoryIndex, 0, entry);
      commitReorder(id);
      return true;
    } finally {
      applyingOrder = false;
    }
  }

  function enhanceRows() {
    const list = document.getElementById('v40NewswireList');
    if (!list) return;
    list.querySelectorAll('.v40-newswire-entry[data-newswire-id]').forEach(row => {
      const id = row.dataset.newswireId;
      const entry = (state.entries || []).find(item => item.id === id);
      const actions = row.querySelector('.v40-newswire-entry-actions');
      if (!entry || !actions) return;

      let order = actions.querySelector('.v40-newswire-order-actions');
      if (!order) {
        order = document.createElement('div');
        order.className = 'v40-newswire-order-actions';
        order.innerHTML = `<button type="button" data-newswire-up="${id}" title="Move earlier inside ${entry.category.toUpperCase()}">▲ UP</button><button type="button" data-newswire-down="${id}" title="Move later inside ${entry.category.toUpperCase()}">▼ DOWN</button>`;
        actions.insertAdjacentElement('afterbegin', order);
      }

      const position = categoryPosition(entry);
      const count = categoryEntries(entry.category).length;
      const up = order.querySelector('[data-newswire-up]');
      const down = order.querySelector('[data-newswire-down]');
      if (up) up.disabled = position <= 0;
      if (down) down.disabled = position < 0 || position >= count - 1;
    });
  }

  function primeOrDetectNewEntries() {
    if (!state.loaded || !Array.isArray(state.entries)) return;
    const currentIds = new Set(state.entries.map(entry => entry.id));
    if (!primed) {
      knownIds = currentIds;
      primed = true;
      enhanceRows();
      return;
    }

    if (!applyingOrder) {
      const fresh = state.entries.filter(entry => !knownIds.has(entry.id));
      if (fresh.length === 1) moveNewEntryToCategoryTop(fresh[0].id);
    }
    knownIds = new Set((state.entries || []).map(entry => entry.id));
    enhanceRows();
  }

  function bindOrdering() {
    const list = document.getElementById('v40NewswireList');
    if (!list || list.dataset.v40OrderingBound === 'true') return;
    list.dataset.v40OrderingBound = 'true';
    list.addEventListener('click', event => {
      const up = event.target.closest('[data-newswire-up]');
      const down = event.target.closest('[data-newswire-down]');
      if (up) { event.preventDefault(); moveWithinCategory(up.dataset.newswireUp, -1); }
      if (down) { event.preventDefault(); moveWithinCategory(down.dataset.newswireDown, 1); }
    });
  }

  function observeManager() {
    const root = document.getElementById('v40NewswireManager');
    if (!root || root.dataset.v40OrderingObserver === 'true') return;
    root.dataset.v40OrderingObserver = 'true';
    observer = new MutationObserver(() => queueMicrotask(primeOrDetectNewEntries));
    observer.observe(root, { childList: true, subtree: true });
  }

  function selfTest() {
    const failures = [];
    if (!document.getElementById(STYLE_ID)) failures.push('styles');
    if (!document.getElementById('v40NewswireOrderNote')) failures.push('order-note');
    if (document.getElementById('v40NewswireResetBtn') && getComputedStyle(document.getElementById('v40NewswireResetBtn')).color === 'rgba(0, 0, 0, 0)') failures.push('reset-readable');
    return failures;
  }

  function install() {
    if (!document.getElementById('v40NewswireManager')) return false;
    installStyles();
    installOrderNote();
    bindOrdering();
    observeManager();
    primeOrDetectNewEntries();
    installed = true;
    return true;
  }

  const baseCommsInit = app.comms.init;
  app.comms.init = function newswireOrderingAwareInit(...args) {
    const result = baseCommsInit.apply(this, args);
    install();
    return result;
  };

  const baseCommsActivate = app.comms.activate;
  app.comms.activate = function newswireOrderingAwareActivate(node, options) {
    const result = baseCommsActivate.call(this, node, options);
    if (node === 'ticker') install();
    return result;
  };

  install();

  app.newswireOrdering = {
    install,
    moveWithinCategory,
    moveNewEntryToCategoryTop,
    enhanceRows,
    selfTest
  };
})();