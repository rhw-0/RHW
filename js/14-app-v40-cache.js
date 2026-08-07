/* ==========================================================================
   RHW WEB APP · V4.0 LOCAL CACHE PORTABILITY
   Move COMMS drafts and local sender profiles between preview/live origins.
   ========================================================================== */

function appInstallCachePortability() {
  const draftsPanel = document.querySelector('.drafts-panel');
  const draftList = document.getElementById('commsDraftList');
  if (!draftsPanel || !draftList || document.getElementById('exportCommsCacheBtn')) return;

  const tools = document.createElement('div');
  tools.className = 'comms-actions comms-cache-tools';
  tools.innerHTML = `
    <button type="button" id="exportCommsCacheBtn"><span>EXPORT LOCAL CACHE</span></button>
    <button type="button" id="importCommsCacheBtn"><span>IMPORT LOCAL CACHE</span></button>
    <input type="file" id="importCommsCacheInput" accept="application/json,.json" hidden />`;
  draftList.insertAdjacentElement('beforebegin', tools);

  const hint = document.createElement('div');
  hint.className = 'bbcode-hint';
  hint.textContent = 'EXPORT MOVES BROWSER-LOCAL DRAFTS + CUSTOM SENDERS BETWEEN THE V4 PREVIEW AND THE EVENTUAL LIVE APP.';
  tools.insertAdjacentElement('afterend', hint);

  document.getElementById('exportCommsCacheBtn')?.addEventListener('click', appExportLocalCache);
  document.getElementById('importCommsCacheBtn')?.addEventListener('click', () => document.getElementById('importCommsCacheInput')?.click());
  document.getElementById('importCommsCacheInput')?.addEventListener('change', appImportLocalCacheFile);
}

function appExportLocalCache() {
  appSyncFromForm();
  appSaveCurrentState();
  const payload = {
    format: 'rhw-webapp-local-cache',
    version: 1,
    appVersion: RHW_APP_VERSION,
    exportedAt: new Date().toISOString(),
    current: rhwCommsState,
    drafts: rhwCommsDrafts,
    localSenders: rhwLocalSenders
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rhw-comms-cache-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  appNotify('LOCAL CACHE EXPORTED');
}

async function appImportLocalCacheFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || raw.format !== 'rhw-webapp-local-cache' || Number(raw.version) !== 1) {
      throw new Error('UNSUPPORTED CACHE FILE');
    }
    const nextDrafts = Array.isArray(raw.drafts) ? raw.drafts.filter(draft => draft && typeof draft.id === 'string') : [];
    const nextSenders = Array.isArray(raw.localSenders) ? raw.localSenders.filter(sender => sender && typeof sender.key === 'string' && typeof sender.name === 'string') : [];
    const nextCurrent = appNormalizeCommsState(raw.current || appDefaultCommsState());

    rhwCommsDrafts = nextDrafts;
    rhwLocalSenders = nextSenders;
    safeStorageSet(RHW_APP_KEYS.commsDrafts, rhwCommsDrafts);
    safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);

    const senderValid = nextCurrent.senderKey === '__custom__' || Boolean(appSenderByKey(nextCurrent.senderKey));
    if (!senderValid) nextCurrent.senderKey = RHW_APP_CONFIG.senders[0].key;
    appApplyCommsState(nextCurrent, { persist: true });
    appRenderDrafts();
    appNotify(`CACHE IMPORTED // ${rhwCommsDrafts.length} DRAFTS // ${rhwLocalSenders.length} LOCAL SENDERS`);
  } catch (error) {
    console.error('RHW CACHE IMPORT FAILED', error);
    appNotify(`CACHE IMPORT FAILED // ${String(error?.message || 'INVALID FILE').toUpperCase()}`, 'danger');
  } finally {
    input.value = '';
  }
}

appInstallCachePortability();
