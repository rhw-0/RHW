/* ============================================================================
   RHW WEB APP · V4.0 PREVIEW AUDIT FIXES
   Temporary pre-release hardening for interaction, routing and local data.
   Consolidate these hooks into the V4 modules before the final V4.0 release.
   ============================================================================ */

const RHW_V40_COMMS_HEADING_COPY = Object.freeze({
  forum: Object.freeze({
    title: 'FORUM TRANSMISSION COMPOSER',
    subtitle: 'WRITE NORMAL TEXT // RHW BUILDS THE FORUM BB CODE',
    publicNode: 'FORUM'
  }),
  newswire: Object.freeze({
    title: 'BMM INDUSTRIAL NEWSWIRE BUILDER',
    subtitle: 'BUILD ONE READY-TO-PASTE DASHBOARD TICKER ENTRY',
    publicNode: 'TICKER'
  }),
  drafts: Object.freeze({
    title: 'LOCAL DRAFT ARCHIVE',
    subtitle: 'SAVED TRANSMISSIONS // CACHE EXPORT + IMPORT',
    publicNode: 'DRAFTS'
  }),
  senders: Object.freeze({
    title: 'SENDER IDENTITY REGISTRY',
    subtitle: 'BUILT-IN + BROWSER-LOCAL RHW CHARACTERS',
    publicNode: 'SENDERS'
  })
});

function v40AuditSetText(id, value) {
  const target = document.getElementById(id);
  if (target && target.textContent !== value) target.textContent = value;
}

function v40AuditSenderSnapshot(state, sender = appResolvedSender(state)) {
  if (!state || typeof state !== 'object') return state;
  state.senderSnapshotName = String(sender?.name || state.senderSnapshotName || '').trim();
  state.senderSnapshotTitle = String(sender?.title || state.senderSnapshotTitle || '').trim();
  return state;
}

/* Preserve the sender identity inside drafts. A deleted browser-local profile
   must not turn an old transmission into "UNASSIGNED SENDER". */
const v40AuditBaseResolvedSender = appResolvedSender;
appResolvedSender = function(state = rhwCommsState) {
  const resolved = v40AuditBaseResolvedSender(state);
  if (resolved?.name && resolved.name !== 'UNASSIGNED SENDER') return resolved;
  return {
    name: state?.senderSnapshotName?.trim() || 'UNASSIGNED SENDER',
    title: state?.senderSnapshotTitle?.trim() || ''
  };
};

const v40AuditBaseReadCommsForm = appReadCommsForm;
appReadCommsForm = function() {
  const state = v40AuditBaseReadCommsForm();
  return v40AuditSenderSnapshot(state);
};

function v40AuditSnapshotSenderReferences(sender) {
  if (!sender?.key) return;
  let draftsChanged = false;
  rhwCommsDrafts.forEach(draft => {
    if (draft?.state?.senderKey !== sender.key) return;
    draft.state.senderSnapshotName = sender.name || draft.state.senderSnapshotName || '';
    draft.state.senderSnapshotTitle = sender.title || draft.state.senderSnapshotTitle || '';
    draftsChanged = true;
  });
  if (draftsChanged) safeStorageSet(RHW_APP_KEYS.commsDrafts, rhwCommsDrafts);

  if (rhwCommsState?.senderKey === sender.key) {
    rhwCommsState.senderSnapshotName = sender.name || rhwCommsState.senderSnapshotName || '';
    rhwCommsState.senderSnapshotTitle = sender.title || rhwCommsState.senderSnapshotTitle || '';
    appSaveCurrentState();
  }
}

/* Sender identity controls signature/location/cipher. The closing belongs to
   the recipient/document context and therefore survives sender switches. */
function v40AuditApplySender(key, { notify = true } = {}) {
  const preservedClosing = v40ClosingValue() || rhwCommsState?.closing || v40TemplateClosing(rhwCommsState?.templateKey);
  const sender = appSenderByKey(key);
  const state = appReadCommsForm();
  state.senderKey = key;

  if (sender) {
    state.location = sender.location || '';
    state.encryption = sender.encryption || '';
    state.signatureTitle = sender.title || '';
    state.senderSnapshotName = sender.name || '';
    state.senderSnapshotTitle = sender.title || '';
  }
  state.closing = preservedClosing;
  appApplyCommsState(state, { persist: true });
  v40SetClosingControl(preservedClosing);
  v40SyncSignatureUi();
  if (notify && sender) appNotify(`SENDER ACTIVE // ${sender.name.toUpperCase()}`);
}

function v40AuditRebindSenderSelect() {
  const old = document.getElementById('commsSender');
  if (!old || old.dataset.auditBound === 'true') return;
  const selected = old.value;
  const select = old.cloneNode(true);
  select.dataset.auditBound = 'true';
  old.replaceWith(select);
  select.value = selected;

  select.addEventListener('change', () => {
    if (select.value === '__custom__') {
      const preservedClosing = v40ClosingValue() || rhwCommsState?.closing || v40TemplateClosing(rhwCommsState?.templateKey);
      const state = appReadCommsForm();
      state.senderKey = '__custom__';
      state.closing = preservedClosing;
      appApplyCommsState(state, { persist: true });
      v40SetClosingControl(preservedClosing);
      document.getElementById('customSenderName')?.focus();
      return;
    }
    v40AuditApplySender(select.value, { notify: false });
  });
}

function v40AuditSaveLocalSender() {
  const state = appReadCommsForm();
  const name = state.customSenderName.trim();
  if (!name) {
    appNotify('ENTER A SENDER NAME FIRST', 'warn');
    return;
  }

  const existingIndex = rhwLocalSenders.findIndex(sender => normalize(sender.name) === normalize(name));
  const profile = {
    key: existingIndex >= 0 ? rhwLocalSenders[existingIndex].key : appUid('local-sender'),
    name,
    title: state.signatureTitle.trim(),
    location: state.location.trim(),
    encryption: state.encryption.trim()
  };
  if (existingIndex >= 0) rhwLocalSenders[existingIndex] = profile;
  else rhwLocalSenders.push(profile);
  safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);

  state.senderKey = profile.key;
  state.senderSnapshotName = profile.name;
  state.senderSnapshotTitle = profile.title;
  appApplyCommsState(state, { persist: true });
  appRefreshSenderSelect(profile.key);
  v40RenderSenderRegistry();
  appNotify('LOCAL SENDER PROFILE SAVED');
}

function v40AuditRemoveLocalSenderKey(key) {
  const sender = rhwLocalSenders.find(entry => entry.key === key);
  if (!sender) return;
  if (!window.confirm(`Remove local sender profile “${sender.name}”? Existing drafts keep a sender snapshot.`)) return;

  v40AuditSnapshotSenderReferences(sender);
  rhwLocalSenders = rhwLocalSenders.filter(entry => entry.key !== key);
  safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);

  if (rhwCommsState?.senderKey === key) {
    const closing = v40ClosingValue() || rhwCommsState.closing || v40TemplateClosing(rhwCommsState.templateKey);
    const fallback = RHW_APP_CONFIG.senders[0];
    const state = appReadCommsForm();
    state.senderKey = fallback.key;
    state.location = fallback.location || '';
    state.encryption = fallback.encryption || '';
    state.signatureTitle = fallback.title || '';
    state.senderSnapshotName = fallback.name || '';
    state.senderSnapshotTitle = fallback.title || '';
    state.closing = closing;
    appApplyCommsState(state, { persist: true });
    v40SetClosingControl(closing);
  }

  appRefreshSenderSelect(rhwCommsState?.senderKey);
  v40RenderSenderRegistry();
  appRenderDrafts();
  appNotify('LOCAL SENDER PROFILE REMOVED', 'warn');
}

function v40AuditRebindSenderActions() {
  const oldSave = document.getElementById('saveSenderBtn');
  if (oldSave && oldSave.dataset.auditBound !== 'true') {
    const save = oldSave.cloneNode(true);
    save.dataset.auditBound = 'true';
    oldSave.replaceWith(save);
    save.addEventListener('click', v40AuditSaveLocalSender);
  }

  const oldRemove = document.getElementById('removeSenderBtn');
  if (oldRemove && oldRemove.dataset.auditBound !== 'true') {
    const remove = oldRemove.cloneNode(true);
    remove.dataset.auditBound = 'true';
    oldRemove.replaceWith(remove);
    remove.addEventListener('click', () => v40AuditRemoveLocalSenderKey(document.getElementById('commsSender')?.value));
  }
}

v40UseSenderInComposer = function(key) {
  const sender = appSenderByKey(key);
  if (!sender) return;
  v40AuditApplySender(key);
  v40ActivateCommsNode('forum');
};

v40RemoveRegistrySender = function(key) {
  v40AuditRemoveLocalSenderKey(key);
};

/* The identity registry should describe the sender identity, not recipient-
   dependent sign-offs. */
v40RenderSenderRegistry = function() {
  const target = document.getElementById('v40SenderRegistry');
  if (!target) return;
  const profiles = [
    ...RHW_APP_CONFIG.senders.map(sender => ({ ...sender, source: 'BUILT-IN' })),
    ...rhwLocalSenders.map(sender => ({ ...sender, source: 'LOCAL' }))
  ];
  target.innerHTML = profiles.map(sender => `<article class="sender-registry-card">
    <div class="sender-registry-head"><div><small>${appEscape(sender.source)}</small><strong>${appEscape(sender.name)}</strong></div><span>${appEscape(sender.source === 'LOCAL' ? 'LOCAL CACHE' : 'RHW REGISTRY')}</span></div>
    <dl><div><dt>ROLE</dt><dd>${appEscape(sender.title || '—')}</dd></div><div><dt>LOCATION</dt><dd>${appEscape(sender.location || '—')}</dd></div><div><dt>DEFAULT CIPHER</dt><dd>${appEscape(sender.encryption || '—')}</dd></div></dl>
    <div class="sender-registry-actions"><button type="button" data-use-sender="${appEscape(sender.key)}">USE IN COMPOSER</button>${sender.source === 'LOCAL' ? `<button type="button" data-remove-registry-sender="${appEscape(sender.key)}">REMOVE</button>` : ''}</div>
  </article>`).join('');
};

function v40AuditUpdateCommsHeading(node) {
  const copy = RHW_V40_COMMS_HEADING_COPY[node] || RHW_V40_COMMS_HEADING_COPY.forum;
  const heading = document.querySelector('.comms-frame > .workspace-heading');
  const title = heading?.querySelector('h2');
  const subtitle = heading?.querySelector('p');
  if (title) title.textContent = copy.title;
  if (subtitle) subtitle.textContent = copy.subtitle;
  if (rhwActiveWorkspace === 'comms') {
    v40SetActiveNode(`COMMS / ${copy.publicNode}`);
    document.title = `RHW COMMS ${copy.publicNode} · ${RHW_APP_VERSION}`;
  }
}

function v40AuditScrollActive(selector) {
  const button = document.querySelector(selector);
  if (!button || typeof button.scrollIntoView !== 'function') return;
  window.requestAnimationFrame(() => button.scrollIntoView({
    behavior: prefersReducedMotion?.matches ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'center'
  }));
}

const v40AuditBaseActivateCommsNode = v40ActivateCommsNode;
v40ActivateCommsNode = function(node, options = {}) {
  v40AuditBaseActivateCommsNode(node, options);
  const active = document.body.dataset.commsNode || node;
  v40AuditUpdateCommsHeading(active);
  v40AuditScrollActive('[data-comms-node].active');
};

const v40AuditBaseActivateCommandNode = v40ActivateCommandNode;
v40ActivateCommandNode = function(node, options = {}) {
  v40AuditBaseActivateCommandNode(node, options);
  v40AuditScrollActive('[data-command-node].active');
};

/* Public route says TICKER; the internal node remains "newswire" for backward
   compatibility with existing V4 preview caches and links. */
const v40AuditBaseParseRoute = v40ParseRoute;
v40ParseRoute = function() {
  const route = v40AuditBaseParseRoute();
  if (route.workspace === 'comms' && route.node === 'ticker') route.node = 'newswire';
  return route;
};

v40WriteRoute = function(workspace, node) {
  const publicNode = workspace === 'comms' && node === 'newswire' ? 'ticker' : node;
  const next = `#${workspace}/${publicNode}`;
  if (location.hash === next) return;
  history.pushState({ rhwWorkspace: workspace, rhwNode: publicNode }, '', next);
};

window.addEventListener('popstate', () => {
  const route = v40ParseRoute();
  if (!route.workspace) return;
  appActivateWorkspace(route.workspace, { updateHash: false });
  if (route.workspace === 'command') v40ActivateCommandNode(route.node || 'overview', { updateHash: false });
  else v40ActivateCommsNode(route.node || 'forum', { updateHash: false });
});

/* Correct the executive overview semantics. The V4 prototype originally used
   tracked-line counts as if they were active warning counts. */
function v40AuditUpdateCommandOverview() {
  if (!document.getElementById('v40OverviewInventory')) return;
  if (!hasVerifiedTelemetry()) {
    v40AuditSetText('v40OverviewInventory', 'AWAITING TELEMETRY');
    v40AuditSetText('v40OverviewInventoryMeta', 'NO VERIFIED LOCAL INVENTORY');
    v40AuditSetText('v40OverviewProduction', 'SCANNING');
    v40AuditSetText('v40OverviewManifest', 'SCANNING');
    return;
  }

  const operational = operationalItems();
  const flaggedKeys = new Set();
  operational.forEach(item => {
    const roles = assetRoles(item);
    roles.forEach(role => {
      if (!['maintenance', 'procurement', 'byproduct', 'confiscated'].includes(role)) return;
      if (stateForRole(item, role) !== 'ok') flaggedKeys.add(commodityKey(item));
    });
  });
  const exportLines = operational.filter(item => hasAssetRole(item, 'export')).length;
  const facilityLines = operational.filter(item => hasAssetRole(item, 'maintenance')).length;
  const analyses = RECIPES.map(analyzeRecipe);
  const constrained = analyses.filter(entry => entry.cardState !== 'ok').length;
  const shipyardBadge = document.querySelector('#shipyardControl .shipyard-summary-badge')?.textContent?.trim();
  const logisticsState = document.getElementById('supplierLinkText')?.textContent?.trim();
  const marketState = document.getElementById('marketScanMeta')?.textContent?.trim();

  v40AuditSetText('v40OverviewInventory', flaggedKeys.size ? `${flaggedKeys.size} ACTIVE FLAGS` : 'INVENTORY NOMINAL');
  v40AuditSetText('v40OverviewInventoryMeta', `${facilityLines} FACILITY LINES // ${exportLines} EXPORT LINES`);
  v40AuditSetText('v40OverviewShipyard', shipyardBadge || 'YARD ONLINE');
  v40AuditSetText('v40OverviewShipyardMeta', 'OPEN CAPITAL SHIPYARD CONTROL');
  v40AuditSetText('v40OverviewProduction', constrained ? `${constrained} CONSTRAINED` : 'ALL MODULES READY');
  v40AuditSetText('v40OverviewProductionMeta', `${analyses.length} RECIPES // LIVE BOTTLENECK ANALYSIS`);
  v40AuditSetText('v40OverviewLogistics', logisticsState || 'SAT-LINK SCANNING');
  v40AuditSetText('v40OverviewLogisticsMeta', marketState || 'REMOTE SUPPLY + MARKET RADAR');
  v40AuditSetText('v40OverviewManifest', `${operational.length} ASSET LINES`);
  v40AuditSetText('v40OverviewManifestMeta', 'SEARCHABLE LOCAL STOCK REGISTRY');
}

v40UpdateCommandOverview = v40AuditUpdateCommandOverview;

function v40AuditWatchOverview() {
  const panel = document.querySelector('.command-overview-panel');
  if (!panel || panel.dataset.auditObserved === 'true') return;
  panel.dataset.auditObserved = 'true';
  const observer = new MutationObserver(() => v40AuditUpdateCommandOverview());
  observer.observe(panel, { subtree: true, childList: true, characterData: true });
  v40AuditUpdateCommandOverview();
}

/* Import is merge-only in preview. An import must never silently erase drafts
   or sender profiles already stored in this browser. */
async function v40AuditImportLocalCacheFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || raw.format !== 'rhw-webapp-local-cache' || Number(raw.version) !== 1) {
      throw new Error('UNSUPPORTED CACHE FILE');
    }

    const importedDrafts = Array.isArray(raw.drafts)
      ? raw.drafts.filter(draft => draft && typeof draft.id === 'string' && draft.state && typeof draft.state === 'object')
      : [];
    const importedSenders = Array.isArray(raw.localSenders)
      ? raw.localSenders.filter(sender => sender && typeof sender.key === 'string' && typeof sender.name === 'string')
      : [];

    const senderMap = new Map(rhwLocalSenders.map(sender => [sender.key, sender]));
    importedSenders.forEach(sender => senderMap.set(sender.key, sender));
    rhwLocalSenders = [...senderMap.values()];

    const draftMap = new Map(rhwCommsDrafts.map(draft => [draft.id, draft]));
    importedDrafts.forEach(draft => draftMap.set(draft.id, draft));
    rhwCommsDrafts = [...draftMap.values()];

    safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);
    safeStorageSet(RHW_APP_KEYS.commsDrafts, rhwCommsDrafts);
    appRefreshSenderSelect(rhwCommsState?.senderKey);
    appRenderDrafts();
    v40RenderSenderRegistry();

    if (raw.current && window.confirm('Imported cache merged. Load its current transmission into the composer too?')) {
      const nextCurrent = appNormalizeCommsState(raw.current);
      const senderValid = nextCurrent.senderKey === '__custom__' || Boolean(appSenderByKey(nextCurrent.senderKey));
      if (!senderValid) {
        nextCurrent.senderSnapshotName = nextCurrent.senderSnapshotName || 'IMPORTED SENDER';
        nextCurrent.senderSnapshotTitle = nextCurrent.senderSnapshotTitle || '';
      }
      appApplyCommsState(nextCurrent, { persist: true });
    }

    appNotify(`CACHE MERGED // ${importedDrafts.length} DRAFTS // ${importedSenders.length} SENDERS`);
  } catch (error) {
    console.error('RHW CACHE MERGE FAILED', error);
    appNotify(`CACHE IMPORT FAILED // ${String(error?.message || 'INVALID FILE').toUpperCase()}`, 'danger');
  } finally {
    input.value = '';
  }
}

function v40AuditRebindCacheImport() {
  const oldButton = document.getElementById('importCommsCacheBtn');
  const oldInput = document.getElementById('importCommsCacheInput');
  if (!oldButton || !oldInput || oldButton.dataset.auditBound === 'true') return;

  const button = oldButton.cloneNode(true);
  const input = oldInput.cloneNode(true);
  button.dataset.auditBound = 'true';
  oldButton.replaceWith(button);
  oldInput.replaceWith(input);
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', v40AuditImportLocalCacheFile);

  const hint = document.querySelector('.comms-cache-tools + .bbcode-hint');
  if (hint) hint.textContent = 'IMPORT MERGES WITH EXISTING DRAFTS + CUSTOM SENDERS // NOTHING IS SILENTLY REPLACED.';
}

function v40InstallAuditFixes() {
  v40AuditRebindSenderSelect();
  v40AuditRebindSenderActions();
  v40AuditRebindCacheImport();
  v40AuditWatchOverview();
  v40RenderSenderRegistry();
  v40AuditUpdateCommsHeading(document.body.dataset.commsNode || 'forum');
  v40AuditScrollActive('[data-command-node].active, [data-comms-node].active');

  const current = appReadCommsForm();
  appApplyCommsState(current, { persist: true });
}

v40InstallAuditFixes();
