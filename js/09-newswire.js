const NEWSWIRE_URL = DASHBOARD_CONFIG.newswireUrl;
const NEWSWIRE_TONES = ['good', 'warn', 'danger', 'remote', 'lore', 'muted'];

function parseNewswireMarkdown(text) {
  const pools = {};
  let category = null;
  let fenceMarker = '';
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    const fenceMatch = line.match(/^(```+|~~~+)/);
    if (fenceMatch) {
      if (!fenceMarker) fenceMarker = fenceMatch[1].slice(0, 3);
      else if (line.startsWith(fenceMarker)) fenceMarker = '';
      continue;
    }
    if (fenceMarker) continue;
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      category = normalize(headerMatch[1]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (category && !pools[category]) pools[category] = [];
      continue;
    }
    if (!category || !line.startsWith('-')) continue;
    const msgMatch = line.match(/^-\s*\[([^|\]]+?)\s*\|\s*([A-Za-z]+)\s*\]\s*(.+)$/);
    if (!msgMatch) continue;
    const tag = msgMatch[1].trim().toUpperCase().slice(0, 40);
    const toneCandidate = msgMatch[2].trim().toLowerCase();
    const tone = NEWSWIRE_TONES.includes(toneCandidate) ? toneCandidate : 'lore';
    const body = msgMatch[3].trim().toUpperCase().slice(0, 240);
    if (tag && body) pools[category].push({ tag, text: body, tone });
  }
  return pools;
}

function mergeNewswirePools(remotePools = {}) {
  const merged = {};
  const categories = new Set([...Object.keys(NEWSWIRE_POOLS), ...Object.keys(remotePools || {})]);
  categories.forEach(category => {
    const seen = new Set();
    const combined = [...(remotePools?.[category] || []), ...(NEWSWIRE_POOLS[category] || [])];
    merged[category] = combined.filter(message => {
      const identity = `${message.tag}\u0000${message.text}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  });
  return merged;
}

function countNewswireBulletins(pools) {
  return Object.values(pools || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
}

function setNewswireFeedStatus(mode, bulletinCount = 0, cachedAt = 0) {
  const el = document.getElementById('newswireFeedStatus');
  if (!el) return;
  el.classList.remove('feed-live', 'feed-stale', 'feed-local');
  el.classList.add(mode === 'live' ? 'feed-live' : (mode === 'stale' ? 'feed-stale' : 'feed-local'));
  const label = el.querySelector('.feed-status-text');
  if (label) label.textContent = mode === 'live' ? 'REMOTE FEED LIVE' : (mode === 'stale' ? 'REMOTE FEED STALE' : 'LOCAL FALLBACK');
  const cacheTime = cachedAt ? new Date(cachedAt).toLocaleString('de-DE') : '';
  el.title = mode === 'live'
    ? `${bulletinCount} external bulletins loaded from the RHW repository`
    : (mode === 'stale'
      ? `Remote file unavailable // using ${bulletinCount} cached bulletins from ${cacheTime || 'the last verified sync'}`
      : 'Remote file unavailable or disabled // using bulletins embedded in the dashboard');
}

function applyNewswirePools(pools) {
  activeNewswirePools = mergeNewswirePools(pools);
  newswireHistory.clear();
  if (lastLoaded) updateTickerSlots(buildIndustrialNewswireMessages());
}

function scheduleNewswireRefresh() {
  clearTimeout(newswireRefreshTimer);
  if (!FEATURES.newswire || !FEATURES.remoteNewswire || !NEWSWIRE_URL || NEWSWIRE_REFRESH_MS <= 0) return;
  newswireRefreshTimer = setTimeout(() => loadNewswire(), NEWSWIRE_REFRESH_MS);
}

async function loadNewswire({ schedule = true } = {}) {
  if (newswireIsLoading) return;
  newswireIsLoading = true;

  if (!FEATURES.newswire || !FEATURES.remoteNewswire || !NEWSWIRE_URL) {
    activeNewswirePools = NEWSWIRE_POOLS;
    setNewswireFeedStatus('local');
    newswireIsLoading = false;
    if (schedule) scheduleNewswireRefresh();
    return;
  }

  try {
    const response = await fetchWithTimeout(NEWSWIRE_URL, {
      headers: { 'Accept': 'text/markdown,text/plain;q=0.9,*/*;q=0.1' },
      cache: 'no-store'
    }, 10000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sourceText = await response.text();
    const remotePools = parseNewswireMarkdown(sourceText);
    const count = countNewswireBulletins(remotePools);
    if (!count) throw new Error('NO BULLETINS PARSED');

    applyNewswirePools(remotePools);
    safeStorageSet(STORAGE_KEYS.newswireCache, { sourceText, savedAt: Date.now() });
    setNewswireFeedStatus('live', count);
  } catch (error) {
    const cached = safeStorageGet(STORAGE_KEYS.newswireCache, null);
    const cachedPools = cached?.sourceText ? parseNewswireMarkdown(cached.sourceText) : {};
    const cachedCount = countNewswireBulletins(cachedPools);
    if (cachedCount) {
      applyNewswirePools(cachedPools);
      setNewswireFeedStatus('stale', cachedCount, Number(cached.savedAt) || 0);
    } else {
      activeNewswirePools = NEWSWIRE_POOLS;
      newswireHistory.clear();
      setNewswireFeedStatus('local');
    }
    console.warn('RHW NEWSWIRE FETCH FAILED', error);
  } finally {
    newswireIsLoading = false;
    if (schedule) scheduleNewswireRefresh();
  }
}

restoreViewPreferences();
applyFeatureVisibility();
initEcoMode();
updateRoleSegments();
updateSortArrows();
updateMarketSortButtons();

refreshAll();
