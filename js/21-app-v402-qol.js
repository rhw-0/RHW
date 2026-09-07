/* ==========================================================================
   RHW WEB APP · V4.0.2 QUALITY-OF-LIFE TOOLS
   Explicit calculator price profiles + multi-hull shipyard planning.
   ========================================================================== */
(function initRhwV402Qol() {
  'use strict';
  const app = window.RHWV4;
  const core = app?.operationsCore;
  if (!app || !core || app.qol) return;

  const PROFILE_KEY = app.config.storageKeys.calculatorPriceProfiles || 'rhw-webapp-v4:calculator-price-profiles';
  const PLANNER_KEY = app.config.storageKeys.shipyardPlanner || 'rhw-webapp-v4:shipyard-planner';
  let operationsObserver = null;
  let shipyardObserver = null;
  let profileStatus = ['SAVED PROFILES ARE OPTIONAL // NOTHING IS LOADED AUTOMATICALLY', 'muted'];

  const esc = value => app.util.escape(String(value ?? ''));
  const normalize = value => app.util.normalize(String(value ?? ''));
  const integer = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  };

  function profiles() {
    const raw = app.store.get(PROFILE_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(profile => profile && profile.id && profile.name && profile.prices && typeof profile.prices === 'object');
  }

  function saveProfiles(next) {
    app.store.set(PROFILE_KEY, next.slice(0, 24));
  }

  function currentPriceInputs() {
    return [...document.querySelectorAll('#workspaceOperations [data-material-price]')];
  }

  function setProfileStatus(text, tone = 'muted') {
    profileStatus = [text, tone];
    const node = document.getElementById('opsPriceProfileStatus');
    if (node) { node.textContent = text; node.dataset.tone = tone; }
  }

  function profilePanelMarkup() {
    return `<details class="ops-price-profiles" id="opsPriceProfiles">
      <summary>PRICE PROFILES <small>Save or load prices</small></summary>
      <div class="ops-profile-controls">
        <label class="comms-field"><span>SAVED PROFILE</span><select id="opsPriceProfileSelect" aria-label="Saved calculator price profile"></select><small>SELECT A PROFILE TO LOAD OR UPDATE</small></label>
        <label class="comms-field"><span>PROFILE NAME</span><input id="opsPriceProfileName" type="text" maxlength="40" placeholder="Current Market, Admiralty Offer…"><small>SAVING UPDATES CURRENT RECIPE MATERIALS IN THIS PROFILE</small></label>
      </div>
      <div class="ops-profile-actions">
        <button type="button" id="opsPriceProfileLoad">LOAD PROFILE</button>
        <button type="button" class="primary" id="opsPriceProfileSave">SAVE / UPDATE</button>
        <button type="button" id="opsPriceProfileClear">CLEAR CURRENT</button>
        <button type="button" class="danger" id="opsPriceProfileDelete">DELETE PROFILE</button>
      </div>
      <div class="ops-profile-status" id="opsPriceProfileStatus" data-tone="muted"></div>
    </details>`;
  }

  function selectedProfile() {
    const id = document.getElementById('opsPriceProfileSelect')?.value || '';
    return profiles().find(profile => profile.id === id) || null;
  }

  function renderProfileSelect(preferredId = '') {
    const select = document.getElementById('opsPriceProfileSelect');
    const name = document.getElementById('opsPriceProfileName');
    if (!select || !name) return;
    const list = profiles();
    const keep = preferredId || select.value;
    select.innerHTML = `<option value="">${list.length ? 'SELECT SAVED PROFILE' : 'NO SAVED PROFILES'}</option>` + list.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)} // ${Object.keys(profile.prices).length} PRICES</option>`).join('');
    if (keep && list.some(profile => profile.id === keep)) select.value = keep;
    const active = list.find(profile => profile.id === select.value);
    if (active) name.value = active.name;
    setProfileStatus(...profileStatus);
  }

  function bindProfilePanel(panel) {
    if (!panel || panel.dataset.bound === 'true') return;
    panel.dataset.bound = 'true';
    const select = panel.querySelector('#opsPriceProfileSelect');
    const name = panel.querySelector('#opsPriceProfileName');
    select?.addEventListener('change', () => {
      const profile = selectedProfile();
      if (profile && name) name.value = profile.name;
      setProfileStatus(profile ? `${profile.name.toUpperCase()} SELECTED // PRESS LOAD PROFILE TO APPLY` : 'SAVED PROFILES ARE OPTIONAL // NOTHING IS LOADED AUTOMATICALLY', 'muted');
    });
    panel.querySelector('#opsPriceProfileSave')?.addEventListener('click', saveCurrentProfile);
    panel.querySelector('#opsPriceProfileLoad')?.addEventListener('click', loadSelectedProfile);
    panel.querySelector('#opsPriceProfileClear')?.addEventListener('click', () => clearCurrentPrices(true));
    panel.querySelector('#opsPriceProfileDelete')?.addEventListener('click', deleteSelectedProfile);
  }

  function ensureProfilePanel() {
    const costPanel = document.querySelector('#workspaceOperations .ops-cost-panel');
    if (!costPanel) return;
    let panel = document.getElementById('opsPriceProfiles');
    const created = !panel;
    if (!panel) {
      const memory = costPanel.querySelector('.ops-price-memory');
      if (memory) memory.insertAdjacentHTML('afterend', profilePanelMarkup());
      else costPanel.insertAdjacentHTML('beforeend', profilePanelMarkup());
      panel = document.getElementById('opsPriceProfiles');
    }
    bindProfilePanel(panel);
    if (created) renderProfileSelect();
  }

  function saveCurrentProfile() {
    const nameField = document.getElementById('opsPriceProfileName');
    const rawName = String(nameField?.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!rawName) { setProfileStatus('ENTER A PROFILE NAME FIRST', 'warn'); app.notify?.('ENTER A PRICE PROFILE NAME FIRST', 'warn'); return; }
    const inputs = currentPriceInputs();
    if (!inputs.length) { setProfileStatus('NO MATERIAL PRICE FIELDS AVAILABLE FOR THIS RECIPE', 'warn'); return; }
    const list = profiles();
    const selected = selectedProfile();
    const existing = selected || list.find(profile => normalize(profile.name) === normalize(rawName));
    const nextPrices = { ...(existing?.prices || {}) };
    let filled = 0;
    inputs.forEach(input => {
      const id = input.dataset.materialPrice;
      if (!id) return;
      if (input.value === '') delete nextPrices[id];
      else {
        const value = Number(input.value);
        if (Number.isFinite(value) && value >= 0) { nextPrices[id] = value; filled += 1; }
      }
    });
    if (!filled && !existing) { setProfileStatus('ENTER AT LEAST ONE CURRENT MATERIAL PRICE BEFORE SAVING', 'warn'); return; }
    const id = existing?.id || app.util.uid('price-profile');
    const profile = { id, name: rawName, prices: nextPrices, updatedAt: Date.now() };
    const next = [profile, ...list.filter(item => item.id !== id)].sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    saveProfiles(next);
    renderProfileSelect(id);
    const total = Object.keys(nextPrices).length;
    setProfileStatus(`${rawName.toUpperCase()} SAVED // ${total} MATERIAL PRICE${total === 1 ? '' : 'S'} IN PROFILE`, 'good');
    app.notify?.('PRICE PROFILE SAVED LOCALLY');
  }

  function clearCurrentPrices(announce = false) {
    const inputs = currentPriceInputs();
    inputs.forEach(input => {
      if (input.value === '') return;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (announce) {
      setProfileStatus('CURRENT CALCULATION PRICES CLEARED // SAVED PROFILES UNCHANGED', 'muted');
      app.notify?.('CURRENT MATERIAL PRICES CLEARED', 'warn');
    }
  }

  function loadSelectedProfile() {
    const profile = selectedProfile();
    if (!profile) { setProfileStatus('SELECT A SAVED PROFILE FIRST', 'warn'); return; }
    const inputs = currentPriceInputs();
    let applied = 0;
    inputs.forEach(input => {
      const id = input.dataset.materialPrice;
      const has = Object.prototype.hasOwnProperty.call(profile.prices, id);
      input.value = has ? String(profile.prices[id]) : '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (has) applied += 1;
    });
    setProfileStatus(`${profile.name.toUpperCase()} LOADED // ${applied} / ${inputs.length} CURRENT MATERIALS MATCHED`, applied ? 'good' : 'warn');
    app.notify?.(applied ? `PRICE PROFILE LOADED // ${applied} MATERIALS` : 'PROFILE HAS NO PRICES FOR THIS RECIPE', applied ? 'good' : 'warn');
  }

  function deleteSelectedProfile() {
    const profile = selectedProfile();
    if (!profile) { setProfileStatus('SELECT A SAVED PROFILE FIRST', 'warn'); return; }
    if (!window.confirm(`Delete saved price profile “${profile.name}”?`)) return;
    saveProfiles(profiles().filter(item => item.id !== profile.id));
    const name = document.getElementById('opsPriceProfileName');
    if (name) name.value = '';
    profileStatus = [`${profile.name.toUpperCase()} DELETED // CURRENT CALCULATION UNCHANGED`, 'muted'];
    renderProfileSelect();
  }

  function installPriceProfiles() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace) return;
    ensureProfilePanel();
    if (operationsObserver) return;
    const mount = document.getElementById('operationsCalculatorMount');
    if (!mount) return;
    operationsObserver = new MutationObserver(() => queueMicrotask(ensureProfilePanel));
    operationsObserver.observe(mount, { childList: true });
  }

  function plannerConfig() {
    try { return typeof CAPITAL_SHIPYARD !== 'undefined' ? CAPITAL_SHIPYARD : null; }
    catch { return null; }
  }

  function plannerState() {
    const config = plannerConfig();
    const raw = app.store.get(PLANNER_KEY, {}) || {};
    const first = config?.hulls?.[0]?.key || 'dunkirk';
    return { hullKey: config?.hulls?.some(hull => hull.key === raw.hullKey) ? raw.hullKey : first, quantity: Math.max(1, Math.min(20, integer(raw.quantity, 1))) };
  }

  function savePlannerState(patch) {
    app.store.set(PLANNER_KEY, { ...plannerState(), ...patch });
  }

  function componentStock(name) {
    try {
      if (typeof stockFor === 'function') return Math.max(0, Number(stockFor(name)) || 0);
      if (typeof findCommodity === 'function' && typeof quantity === 'function') {
        const item = findCommodity(name); return item ? Math.max(0, Number(quantity(item)) || 0) : 0;
      }
    } catch {}
    return 0;
  }

  function plannerMarkup() {
    const config = plannerConfig();
    if (!config?.hulls?.length || !config?.components?.length) return '';
    const state = plannerState();
    return `<section class="shipyard-build-planner" id="shipyardBuildPlanner">
      <div class="shipyard-build-planner-head"><div><small>CAPITAL TARGET TOOL</small><strong>MULTI-HULL BUILD PLANNER</strong></div><small>VERIFIED INVENTORY GAP // CALCULATOR HAND-OFF</small></div>
      <div class="shipyard-build-planner-controls">
        <label class="comms-field"><span>HULL</span><select id="shipyardPlanHull">${config.hulls.map(hull => `<option value="${esc(hull.key)}"${hull.key === state.hullKey ? ' selected' : ''}>${esc(hull.name)}</option>`).join('')}</select><small>REGISTERED CAPITAL HULL</small></label>
        <label class="comms-field"><span>TARGET QTY</span><input id="shipyardPlanQuantity" type="number" inputmode="numeric" min="1" max="20" step="1" value="${state.quantity}"><small>1–20 HULLS</small></label>
        <button type="button" class="shipyard-plan-open" id="shipyardPlanOpenCalculator">PRICE TARGET IN CALCULATOR</button>
      </div>
      <div class="shipyard-plan-summary"><div><small>TARGET</small><strong id="shipyardPlanTarget">—</strong></div><div><small>BUILDABLE NOW</small><strong id="shipyardPlanBuildable">—</strong></div><div><small>SHORTAGE TYPES</small><strong id="shipyardPlanShortages">—</strong></div></div>
      <div class="shipyard-plan-component-head"><span>COMPONENT</span><span>REQUIRED</span><span>STOCK</span><span>GAP</span></div>
      <div id="shipyardPlanRows"></div>
      <div class="shipyard-plan-note" id="shipyardPlanNote">PLANNER READS THE SAME VERIFIED RHW INVENTORY AS SHIPYARD CONTROL. IT DOES NOT CREATE A NEW TELEMETRY HISTORY.</div>
    </section>`;
  }

  function renderShipyardPlan() {
    const panel = document.getElementById('shipyardBuildPlanner');
    const config = plannerConfig();
    if (!panel || !config) return;
    const hullSelect = document.getElementById('shipyardPlanHull');
    const qtyInput = document.getElementById('shipyardPlanQuantity');
    const hullKey = hullSelect?.value || plannerState().hullKey;
    const qty = Math.max(1, Math.min(20, integer(qtyInput?.value, 1)));
    if (qtyInput && qtyInput.value !== String(qty)) qtyInput.value = String(qty);
    const hull = config.hulls.find(entry => entry.key === hullKey) || config.hulls[0];
    const telemetry = window.telemetrySnapshot();
    const verified = telemetry.available;
    const rows = config.components.map(component => {
      const perHull = Math.max(1, Number(component.required) || 1);
      const required = perHull * qty;
      const stock = verified ? componentStock(component.name) : null;
      const gap = stock === null ? null : Math.max(0, required - stock);
      return { ...component, perHull, required, stock, gap };
    });
    const buildable = verified && rows.length ? Math.min(...rows.map(row => Math.floor(row.stock / row.perHull))) : null;
    const shortages = verified ? rows.filter(row => row.gap > 0) : [];
    const target = document.getElementById('shipyardPlanTarget');
    const build = document.getElementById('shipyardPlanBuildable');
    const shortage = document.getElementById('shipyardPlanShortages');
    if (target) target.textContent = `${qty} × ${String(hull?.name || hullKey).replace(/-Class/i, '').toUpperCase()}`;
    if (build) { build.textContent = buildable === null ? 'STOCK UNKNOWN' : `${buildable} HULL${buildable === 1 ? '' : 'S'}`; build.className = buildable !== null && buildable >= qty ? 'good' : 'warn'; }
    if (shortage) { shortage.textContent = verified ? String(shortages.length) : '—'; shortage.className = verified && !shortages.length ? 'good' : 'warn'; }
    const host = document.getElementById('shipyardPlanRows');
    if (host) host.innerHTML = rows.map(row => `<div class="shipyard-plan-component-row"><strong>${esc(row.name)}</strong><span>${row.required.toLocaleString('en-US')}</span><span>${row.stock === null ? '—' : row.stock.toLocaleString('en-US')}</span><span class="gap${row.gap === 0 ? ' zero' : ''}">${row.gap === null ? '—' : row.gap.toLocaleString('en-US')}</span></div>`).join('');
    const note = document.getElementById('shipyardPlanNote');
    if (note) note.textContent = `${telemetry.detail} // ` + (!verified
      ? 'PLAN YOUR TARGET OFFLINE; COMPONENT GAPS NEED A STOCK SNAPSHOT.'
      : (shortages.length ? `${shortages.length} COMPONENT TYPE${shortages.length === 1 ? '' : 'S'} BELOW TARGET REQUIREMENT.` : 'TARGET COVERED BY THIS COMPONENT SNAPSHOT.'));
    savePlannerState({ hullKey: hull.key, quantity: qty });
  }

  function bindShipyardPlanner(panel) {
    if (!panel || panel.dataset.bound === 'true') return;
    panel.dataset.bound = 'true';
    panel.querySelector('#shipyardPlanHull')?.addEventListener('change', renderShipyardPlan);
    panel.querySelector('#shipyardPlanQuantity')?.addEventListener('input', renderShipyardPlan);
    panel.querySelector('#shipyardPlanOpenCalculator')?.addEventListener('click', () => {
      const hullKey = document.getElementById('shipyardPlanHull')?.value || plannerState().hullKey;
      const quantity = Math.max(1, Math.min(20, integer(document.getElementById('shipyardPlanQuantity')?.value, 1)));
      savePlannerState({ hullKey, quantity });
      const target = app.config.operations.shipyardTargets?.[hullKey];
      if (!target) { app.notify?.('NO CALCULATOR TARGET REGISTERED FOR THIS HULL', 'warn'); return; }
      app.productionPricing?.clearSessionPrices?.();
      app.productionPricing?.resetAffiliationToDefault?.();
      app.operations?.openTarget?.(target, quantity);
    });
  }

  function ensureShipyardPlanner() {
    const mount = document.getElementById('shipyardControl');
    const config = plannerConfig();
    if (!mount || !config?.hulls?.length) return;
    const stockAndRegistry = mount.querySelector('.shipyard-control-grid') || mount.querySelector('.shipyard-control-head') || mount.firstElementChild;
    if (!stockAndRegistry) return;
    let panel = document.getElementById('shipyardBuildPlanner');
    if (!panel) {
      stockAndRegistry.insertAdjacentHTML('afterend', plannerMarkup());
      panel = document.getElementById('shipyardBuildPlanner');
    } else if (panel.previousElementSibling !== stockAndRegistry) {
      stockAndRegistry.insertAdjacentElement('afterend', panel);
    }
    bindShipyardPlanner(panel);
    renderShipyardPlan();
  }

  function installShipyardPlanner() {
    const mount = document.getElementById('shipyardControl');
    if (!mount) return;
    ensureShipyardPlanner();
    if (shipyardObserver) return;
    shipyardObserver = new MutationObserver(() => queueMicrotask(ensureShipyardPlanner));
    shipyardObserver.observe(mount, { childList: true });
  }

  function selfTest() {
    const failures = [];
    if (!app.config.storageKeys.calculatorPriceProfiles) failures.push('profile-storage-key');
    if (!app.config.storageKeys.shipyardPlanner) failures.push('planner-storage-key');
    const calculator = document.querySelector('#workspaceOperations .ops-cost-panel');
    if (calculator && !document.getElementById('opsPriceProfiles')) failures.push('price-profile-panel');
    const shipyard = document.getElementById('shipyardControl');
    if (shipyard?.querySelector('.shipyard-control-head') && !document.getElementById('shipyardBuildPlanner')) failures.push('shipyard-planner');
    const shipyardGrid = shipyard?.querySelector('.shipyard-control-grid');
    const shipyardPlanner = document.getElementById('shipyardBuildPlanner');
    if (shipyardGrid && shipyardPlanner && shipyardGrid.nextElementSibling !== shipyardPlanner) failures.push('shipyard-planner-order');
    return failures;
  }

  const baseOperationsInit = app.operations?.init;
  if (typeof baseOperationsInit === 'function') {
    app.operations.init = async function qolOperationsInit(...args) {
      const result = await baseOperationsInit.apply(this, args);
      installPriceProfiles();
      return result;
    };
  }

  installShipyardPlanner();
  window.addEventListener('storage', event => {
    if (event.key === PROFILE_KEY) renderProfileSelect();
    if (event.key === PLANNER_KEY) { const state = plannerState(); const hull = document.getElementById('shipyardPlanHull'); const qty = document.getElementById('shipyardPlanQuantity'); if (hull) hull.value = state.hullKey; if (qty) qty.value = String(state.quantity); renderShipyardPlan(); }
  });

  app.qol = { installPriceProfiles, ensureProfilePanel, saveCurrentProfile, loadSelectedProfile, clearCurrentPrices, installShipyardPlanner, ensureShipyardPlanner, renderShipyardPlan, profiles, selfTest };
})();
