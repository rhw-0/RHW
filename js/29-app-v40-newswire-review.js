/* ==========================================================================
   RHW PR10 · NEWSWIRE REVIEW DESK
   Local snapshots, repository-vs-working-copy review and a credential-free
   handoff package for preparing a reviewed GitHub Draft pull request.
   ========================================================================== */
(function initRhwNewswireReview() {
  'use strict';
  const app = window.RHWV4;
  const manager = app?.newswireManager;
  if (!app || !manager || app.newswireReview) return;

  const HISTORY_LIMIT = 8;
  const HISTORY_KEY = app.config.storageKeys.newswireReviewHistory || 'rhw-webapp-v4:newswire-review-history';
  const REPOSITORY = 'rhw-0/RHW';
  const SOURCE_PATH = 'assets/RHW_Newswire.md';
  const esc = value => app.util.escape(String(value ?? ''));
  const cloneEntries = entries => (entries || []).map(entry => ({ ...entry }));
  let observer = null;
  let syncTimer = 0;

  const entryFields = entry => ({
    category: String(entry?.category || ''),
    tone: String(entry?.tone || ''),
    tag: String(entry?.tag || ''),
    message: String(entry?.message || '')
  });
  const contentSignature = entry => JSON.stringify(entryFields(entry));
  const entriesSignature = entries => (entries || []).map(entry => `${entry.id}\u0000${contentSignature(entry)}`).join('\u0001');

  function categoryPositions(entries) {
    const counts = new Map();
    const positions = new Map();
    (entries || []).forEach(entry => {
      const category = String(entry.category || 'operations');
      const position = counts.get(category) || 0;
      positions.set(entry.id, position);
      counts.set(category, position + 1);
    });
    return positions;
  }

  function diffEntries(baseEntries = manager.state.baseEntries, currentEntries = manager.state.entries) {
    const base = cloneEntries(baseEntries);
    const current = cloneEntries(currentEntries);
    const baseById = new Map(base.map(entry => [entry.id, entry]));
    const currentById = new Map(current.map(entry => [entry.id, entry]));
    const basePositions = categoryPositions(base);
    const currentPositions = categoryPositions(current);
    const diff = { added: [], edited: [], deleted: [], moved: [], unchanged: [] };

    current.forEach(after => {
      const before = baseById.get(after.id);
      if (!before) {
        diff.added.push({ type: 'added', id: after.id, after, to: currentPositions.get(after.id) });
        return;
      }
      const fields = Object.keys(entryFields(after)).filter(field => String(before[field] || '') !== String(after[field] || ''));
      if (fields.length) {
        diff.edited.push({ type: 'edited', id: after.id, before, after, fields });
        return;
      }
      const from = basePositions.get(after.id);
      const to = currentPositions.get(after.id);
      if (from !== to) diff.moved.push({ type: 'moved', id: after.id, before, after, from, to });
      else diff.unchanged.push({ type: 'unchanged', id: after.id, before, after });
    });
    base.forEach(before => {
      if (!currentById.has(before.id)) diff.deleted.push({ type: 'deleted', id: before.id, before, from: basePositions.get(before.id) });
    });
    diff.all = [...diff.added, ...diff.edited, ...diff.deleted, ...diff.moved];
    diff.total = diff.all.length;
    return diff;
  }

  function fallbackAudit(entries) {
    const byId = new Map();
    let ready = 0;
    let review = 0;
    let issues = 0;
    (entries || []).forEach(entry => {
      const reasons = [];
      if (!String(entry.tag || '').trim()) reasons.push('EMPTY TAG');
      if (!String(entry.message || '').trim()) reasons.push('EMPTY MESSAGE');
      if (String(entry.tag || '').length > 40) reasons.push('TAG TOO LONG');
      if (String(entry.message || '').length > 240) reasons.push('MESSAGE TOO LONG');
      if (reasons.length) review += 1;
      else ready += 1;
      issues += reasons.length;
      byId.set(entry.id, { status: reasons.length ? 'review' : 'ready', duplicate: false, reasons });
    });
    return { byId, ready, review, duplicates: 0, issues };
  }

  function reviewState(entries = manager.state.entries) {
    const diff = diffEntries(manager.state.baseEntries, entries);
    const audit = app.newswire2?.auditEntries?.(entries) || fallbackAudit(entries);
    const reasons = [];
    if (!manager.state.loaded) reasons.push('WAIT FOR THE CURRENT SOURCE TO LOAD');
    if (manager.state.sourceMode !== 'repository') reasons.push('RELOAD THE CURRENT REPOSITORY FILE');
    if (manager.state.draftSourceChanged) reasons.push('THE REPOSITORY SOURCE CHANGED — REVIEW THE RECOVERED DRAFT');
    if (!manager.state.dirty || !diff.total) reasons.push('MAKE A LOCAL NEWSWIRE CHANGE FIRST');
    if (audit.review) reasons.push(`REVIEW ${audit.review} BULLETIN${audit.review === 1 ? '' : 'S'} WITH QA WARNINGS`);
    return { ready: reasons.length === 0, reasons, diff, audit };
  }

  function qaPayload(audit) {
    const entries = [];
    audit.byId?.forEach?.((value, id) => {
      if (value.reasons?.length) entries.push({ id, reasons: [...value.reasons] });
    });
    return {
      passed: audit.review === 0,
      ready: audit.ready,
      review: audit.review,
      duplicates: audit.duplicates,
      issues: audit.issues,
      entries
    };
  }

  function changePayload(change) {
    const payload = { type: change.type, id: change.id };
    if (change.before) payload.before = entryFields(change.before);
    if (change.after) payload.after = entryFields(change.after);
    if (change.fields) payload.fields = [...change.fields];
    if (Number.isInteger(change.from)) payload.from = change.from + 1;
    if (Number.isInteger(change.to)) payload.to = change.to + 1;
    return payload;
  }

  function plural(count, singular, pluralValue = `${singular}S`) {
    return `${count} ${count === 1 ? singular : pluralValue}`;
  }

  function summaryLine(review = reviewState()) {
    const { diff, audit } = review;
    return `${plural(diff.added.length, 'ADDED')} // ${plural(diff.edited.length, 'EDITED')} // ${plural(diff.deleted.length, 'DELETED')} // ${plural(diff.moved.length, 'MOVED')} // QA ${audit.review ? 'REVIEW REQUIRED' : 'PASSED'}`;
  }

  function reportText(review = reviewState()) {
    const lines = [
      '# RHW Newswire Review', '',
      `Repository: ${REPOSITORY}`,
      `Source: ${SOURCE_PATH}`,
      `Base: main / ${manager.state.baseHash || 'unknown'}`,
      `Review: ${review.ready ? 'READY FOR HANDOFF' : 'BLOCKED'}`, '',
      `Summary: ${summaryLine(review)}`
    ];
    if (review.reasons.length) lines.push('', 'Automatic gates:', ...review.reasons.map(reason => `- ${reason}`));
    if (review.diff.all.length) {
      lines.push('', 'Changes:');
      review.diff.all.forEach(change => {
        const entry = change.after || change.before;
        const detail = change.type === 'edited'
          ? ` (${change.fields.join(', ')})`
          : change.type === 'moved' ? ` (${change.from + 1} → ${change.to + 1})` : '';
        lines.push(`- ${change.type.toUpperCase()}: [${entry.category}] ${entry.tag}${detail}`);
      });
    }
    lines.push('', 'This package does not publish automatically. Review it in ChatGPT Work before creating a GitHub Draft pull request.');
    return `${lines.join('\n')}\n`;
  }

  function buildReviewPackage({ requireReady = true } = {}) {
    const review = reviewState();
    if (requireReady && !review.ready) throw new Error(review.reasons.join(' // ') || 'NEWSWIRE REVIEW IS NOT READY');
    const changedEntries = review.diff.all.map(change => change.after).filter(Boolean);
    return {
      format: 'rhw-newswire-review-package',
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: app.version,
      repository: { name: REPOSITORY, base: 'main', sourcePath: SOURCE_PATH },
      source: { mode: manager.state.sourceMode, baseHash: manager.state.baseHash },
      summary: {
        added: review.diff.added.length,
        edited: review.diff.edited.length,
        deleted: review.diff.deleted.length,
        moved: review.diff.moved.length,
        unchanged: review.diff.unchanged.length,
        total: manager.state.entries.length
      },
      qa: qaPayload(review.audit),
      changes: review.diff.all.map(changePayload),
      channels: changedEntries.map(entry => ({
        id: entry.id,
        ticker: entryFields(entry),
        forumBbcode: app.newswire2?.buildForumBbcode?.(entry) || ''
      })),
      markdown: manager.serializeSource(),
      baseMarkdown: manager.serializeSource(manager.state.baseEntries),
      report: reportText(review),
      handoff: {
        requestedAction: 'prepare-github-draft-pull-request',
        humanReviewRequired: true,
        directPublish: false,
        instructions: 'Share this package with ChatGPT Work. Review the Markdown and change report before creating a GitHub Draft pull request.'
      }
    };
  }

  function packageName() {
    return `rhw-newswire-review-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function packageText(payload = buildReviewPackage()) {
    return JSON.stringify(payload, null, 2);
  }

  function buildFile(payload = buildReviewPackage()) {
    if (typeof File !== 'function') return null;
    return new File([packageText(payload)], packageName(), { type: 'application/json', lastModified: Date.now() });
  }

  function setActionStatus(message, tone = 'ready') {
    const status = document.getElementById('v40NewswireReviewActionStatus');
    if (status) { status.textContent = message; status.dataset.tone = tone; }
  }

  function downloadPackage(payload = null, { fallback = false } = {}) {
    try {
      const reviewPackage = payload || buildReviewPackage();
      const blob = new Blob([packageText(reviewPackage)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = packageName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const message = fallback ? 'SHARE UNAVAILABLE // REVIEW PACKAGE DOWNLOADED' : 'NEWSWIRE REVIEW PACKAGE DOWNLOADED';
      setActionStatus(message, fallback ? 'warn' : 'good');
      app.notify?.(message, fallback ? 'warn' : 'good');
      return { downloaded: true, fallback };
    } catch (error) {
      setActionStatus(String(error?.message || error), 'warn');
      app.notify?.('NEWSWIRE REVIEW IS NOT READY', 'warn');
      return { downloaded: false, error: String(error?.message || error) };
    }
  }

  async function sharePackage() {
    let payload;
    try { payload = buildReviewPackage(); }
    catch (error) {
      setActionStatus(String(error?.message || error), 'warn');
      app.notify?.('NEWSWIRE REVIEW IS NOT READY', 'warn');
      return { shared: false, error: String(error?.message || error) };
    }
    const file = buildFile(payload);
    const canShare = file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && (() => {
      try { return navigator.canShare({ files: [file] }); }
      catch { return false; }
    })();
    if (!canShare) return downloadPackage(payload, { fallback: true });
    try {
      await navigator.share({
        files: [file],
        title: 'RHW Newswire review package',
        text: 'Reviewed RHW Newswire working copy for preparing a GitHub Draft pull request in ChatGPT Work.'
      });
      setActionStatus('REVIEW PACKAGE HANDED TO YOUR SHARE MENU', 'good');
      app.notify?.('NEWSWIRE REVIEW PACKAGE SHARED');
      return { shared: true, downloaded: false };
    } catch (error) {
      if (error?.name === 'AbortError') {
        setActionStatus('SHARE CANCELLED // NOTHING WAS SENT', 'ready');
        return { shared: false, cancelled: true };
      }
      return downloadPackage(payload, { fallback: true });
    }
  }

  async function copySummary() {
    const copied = await app.util.copy(reportText());
    setActionStatus(copied ? 'REVIEW SUMMARY COPIED' : 'COPY FAILED', copied ? 'good' : 'warn');
    app.notify?.(copied ? 'NEWSWIRE REVIEW SUMMARY COPIED' : 'COPY FAILED', copied ? 'good' : 'warn');
    return copied;
  }

  function readHistory() {
    const raw = app.store.get(HISTORY_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.filter(snapshot => snapshot && Array.isArray(snapshot.entries) && snapshot.id)
      .slice(0, HISTORY_LIMIT)
      .map(snapshot => ({ ...snapshot, entries: cloneEntries(snapshot.entries) }));
  }

  function saveHistory(history) {
    return app.store.set(HISTORY_KEY, history.slice(0, HISTORY_LIMIT));
  }

  function captureSnapshot({ force = false } = {}) {
    if (!manager.state.loaded || !manager.state.dirty) return false;
    const history = readHistory();
    const signature = entriesSignature(manager.state.entries);
    if (!force && history[0]?.signature === signature && history[0]?.baseHash === manager.state.baseHash) return false;
    const review = reviewState();
    history.unshift({
      id: `nw-review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      baseHash: manager.state.baseHash,
      signature,
      summary: {
        added: review.diff.added.length,
        edited: review.diff.edited.length,
        deleted: review.diff.deleted.length,
        moved: review.diff.moved.length,
        qaReview: review.audit.review
      },
      entries: cloneEntries(manager.state.entries)
    });
    saveHistory(history);
    return true;
  }

  function restoreSnapshot(id, { confirm: confirmRestore = true } = {}) {
    const snapshot = readHistory().find(item => item.id === id);
    if (!snapshot) return false;
    if (confirmRestore && !window.confirm('Restore this local Newswire version? Your current working copy will remain available in version history.')) return false;
    captureSnapshot({ force: true });
    manager.restoreDraft({ version: 1, baseHash: snapshot.baseHash, entries: snapshot.entries, savedAt: Date.now() });
    captureSnapshot({ force: true });
    render();
    app.notify?.('LOCAL NEWSWIRE VERSION RESTORED', 'good');
    return true;
  }

  function clearHistory({ confirm: confirmClear = true } = {}) {
    if (confirmClear && readHistory().length && !window.confirm('Clear all local Newswire review versions? The current working copy is not deleted.')) return false;
    app.store.remove(HISTORY_KEY);
    renderHistory();
    app.notify?.('NEWSWIRE VERSION HISTORY CLEARED', 'warn');
    return true;
  }

  function workflowStepMarkup() {
    return '<button type="button" data-newswire-jump="review"><span>04</span><small>QA + HANDOFF</small><strong>REVIEW</strong></button>';
  }

  function reviewMarkup() {
    return `<section class="v40-newswire-review" id="v40NewswireReviewCenter" aria-labelledby="v40NewswireReviewTitle">
      <header class="v40-newswire-review-head"><div><small>LOCAL VERSION HISTORY // LIVE DIFF // QA</small><strong id="v40NewswireReviewTitle">NEWSWIRE REVIEW DESK</strong></div><span id="v40NewswireReviewState" data-tone="clean">WAITING FOR SOURCE</span></header>
      <div class="v40-newswire-review-metrics">
        <div data-review-metric="added"><small>ADDED</small><strong id="v40ReviewAdded">0</strong></div>
        <div data-review-metric="edited"><small>EDITED</small><strong id="v40ReviewEdited">0</strong></div>
        <div data-review-metric="deleted"><small>DELETED</small><strong id="v40ReviewDeleted">0</strong></div>
        <div data-review-metric="moved"><small>MOVED</small><strong id="v40ReviewMoved">0</strong></div>
        <div data-review-metric="qa"><small>QA WARNINGS</small><strong id="v40ReviewWarnings">0</strong></div>
      </div>
      <div class="v40-newswire-review-gate" id="v40NewswireReviewGate" data-tone="clean"><strong id="v40NewswireReviewGateState">NO LOCAL CHANGES</strong><span id="v40NewswireReviewGateHint">CREATE OR EDIT A BULLETIN TO START A REVIEW.</span></div>
      <div class="v40-newswire-review-grid">
        <section class="v40-newswire-change-panel"><header><div><small>CURRENT REPOSITORY → LOCAL WORKING COPY</small><strong>CHANGE REPORT</strong></div><span id="v40NewswireChangeCount">0 CHANGES</span></header><div id="v40NewswireChangeList" class="v40-newswire-change-list"></div></section>
        <section class="v40-newswire-history-panel"><header><div><small>THIS BROWSER ONLY</small><strong>VERSION HISTORY</strong></div><button type="button" id="v40NewswireClearHistory">CLEAR</button></header><div id="v40NewswireHistoryList" class="v40-newswire-history-list"></div></section>
      </div>
      <div class="v40-newswire-handoff">
        <div><small>CONTROLLED GITHUB HANDOFF</small><strong>REVIEW PACKAGE</strong><p>Contains the canonical Markdown, change report, QA result and matching Forum BBCode. It never publishes by itself.</p></div>
        <div class="v40-newswire-handoff-actions"><button type="button" class="primary" id="v40NewswireShareReview">SHARE REVIEW PACKAGE</button><button type="button" id="v40NewswireDownloadReview">DOWNLOAD PACKAGE</button><button type="button" id="v40NewswireCopyReviewSummary">COPY REVIEW SUMMARY</button></div>
      </div>
      <div class="v40-newswire-review-action-status" id="v40NewswireReviewActionStatus" data-tone="ready">SHARE OR DOWNLOAD, THEN OPEN THE PACKAGE IN CHATGPT WORK TO PREPARE A GITHUB DRAFT PR.</div>
    </section>`;
  }

  function installMarkup() {
    const workflow = document.getElementById('v40NewswireWorkflow');
    if (workflow && !workflow.querySelector('[data-newswire-jump="review"]')) workflow.insertAdjacentHTML('beforeend', workflowStepMarkup());
    const filePanel = document.getElementById('v40NewswireFilePanel');
    if (filePanel && !document.getElementById('v40NewswireReviewCenter')) {
      const details = filePanel.querySelector('details');
      if (details) details.insertAdjacentHTML('beforebegin', reviewMarkup());
      else filePanel.insertAdjacentHTML('beforeend', reviewMarkup());
    }
    return Boolean(document.getElementById('v40NewswireReviewCenter'));
  }

  function changeMarkup(change) {
    const entry = change.after || change.before;
    const label = { added: '+ ADD', edited: '~ EDIT', deleted: '− DELETE', moved: '↕ MOVE' }[change.type] || change.type.toUpperCase();
    const detail = change.type === 'edited'
      ? change.fields.map(field => field.toUpperCase()).join(' + ')
      : change.type === 'moved' ? `POSITION ${change.from + 1} → ${change.to + 1}` : `${entry.category.toUpperCase()} // ${entry.tone.toUpperCase()}`;
    return `<article class="v40-newswire-change" data-change-type="${esc(change.type)}"><span>${esc(label)}</span><div><strong>${esc(entry.tag)}</strong><small>${esc(detail)}</small><p>${esc(entry.message)}</p></div></article>`;
  }

  function renderChanges(review) {
    const target = document.getElementById('v40NewswireChangeList');
    if (!target) return;
    target.innerHTML = review.diff.all.length
      ? review.diff.all.map(changeMarkup).join('')
      : '<div class="v40-newswire-review-empty">LOCAL WORKING COPY MATCHES THE CURRENT REPOSITORY SOURCE.</div>';
    const count = document.getElementById('v40NewswireChangeCount');
    if (count) count.textContent = plural(review.diff.total, 'CHANGE');
  }

  function formatHistoryTime(value) {
    try { return new Date(Number(value)).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return 'UNKNOWN TIME'; }
  }

  function renderHistory() {
    const target = document.getElementById('v40NewswireHistoryList');
    if (!target) return;
    const history = readHistory();
    target.innerHTML = history.length ? history.map(snapshot => {
      const summary = snapshot.summary || {};
      const sourceChanged = Boolean(snapshot.baseHash && snapshot.baseHash !== manager.state.baseHash);
      return `<article class="v40-newswire-history" data-source-changed="${sourceChanged}"><div><strong>${esc(formatHistoryTime(snapshot.createdAt))}</strong><small>${esc(`${summary.added || 0} ADD // ${summary.edited || 0} EDIT // ${summary.deleted || 0} DELETE // ${summary.moved || 0} MOVE`)}</small>${sourceChanged ? '<span>SOURCE CHANGED</span>' : ''}</div><button type="button" data-review-restore="${esc(snapshot.id)}">RESTORE</button></article>`;
    }).join('') : '<div class="v40-newswire-review-empty">VERSIONS APPEAR AUTOMATICALLY AFTER LOCAL NEWSWIRE CHANGES.</div>';
    const clear = document.getElementById('v40NewswireClearHistory');
    if (clear) clear.disabled = history.length === 0;
  }

  function render() {
    if (!document.getElementById('v40NewswireReviewCenter')) return;
    const review = reviewState();
    const values = {
      v40ReviewAdded: review.diff.added.length,
      v40ReviewEdited: review.diff.edited.length,
      v40ReviewDeleted: review.diff.deleted.length,
      v40ReviewMoved: review.diff.moved.length,
      v40ReviewWarnings: review.audit.review
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    });
    const stateLabel = document.getElementById('v40NewswireReviewState');
    const gate = document.getElementById('v40NewswireReviewGate');
    const gateState = document.getElementById('v40NewswireReviewGateState');
    const gateHint = document.getElementById('v40NewswireReviewGateHint');
    const tone = review.ready ? 'ready' : manager.state.dirty ? 'review' : 'clean';
    if (stateLabel) {
      stateLabel.dataset.tone = tone;
      stateLabel.textContent = review.ready ? 'READY FOR HANDOFF' : manager.state.dirty ? 'REVIEW REQUIRED' : 'NO LOCAL CHANGES';
    }
    if (gate) gate.dataset.tone = tone;
    if (gateState) gateState.textContent = review.ready ? 'QA PASSED // READY FOR HANDOFF' : manager.state.dirty ? 'HANDOFF BLOCKED' : 'NO LOCAL CHANGES';
    if (gateHint) gateHint.textContent = review.ready ? summaryLine(review) : review.reasons.join(' // ');
    ['v40NewswireShareReview', 'v40NewswireDownloadReview'].forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = !review.ready;
        button.title = review.ready ? '' : review.reasons.join(' // ');
      }
    });
    const copy = document.getElementById('v40NewswireCopyReviewSummary');
    if (copy) copy.disabled = !manager.state.loaded;
    renderChanges(review);
    renderHistory();
    document.documentElement.dataset.rhwNewswireReview = review.ready ? 'ready' : 'blocked';
  }

  function queueSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      captureSnapshot();
      render();
    }, 120);
  }

  function bind() {
    const reviewCenter = document.getElementById('v40NewswireReviewCenter');
    if (!reviewCenter || reviewCenter.dataset.bound === 'true') return;
    reviewCenter.dataset.bound = 'true';
    document.querySelector('[data-newswire-jump="review"]')?.addEventListener('click', () => {
      document.querySelectorAll('[data-newswire-jump]').forEach(button => button.removeAttribute('aria-current'));
      document.querySelector('[data-newswire-jump="review"]')?.setAttribute('aria-current', 'step');
      reviewCenter.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    reviewCenter.addEventListener('click', event => {
      const restore = event.target.closest('[data-review-restore]');
      if (restore) restoreSnapshot(restore.dataset.reviewRestore);
      if (event.target.closest('#v40NewswireClearHistory')) clearHistory();
      if (event.target.closest('#v40NewswireShareReview')) sharePackage();
      if (event.target.closest('#v40NewswireDownloadReview')) downloadPackage();
      if (event.target.closest('#v40NewswireCopyReviewSummary')) copySummary();
    });
    const list = document.getElementById('v40NewswireList');
    if (list && list.dataset.reviewObserved !== 'true') {
      list.dataset.reviewObserved = 'true';
      observer = new MutationObserver(queueSync);
      observer.observe(list, { childList: true, subtree: true });
    }
  }

  function selfTest() {
    const base = [
      { id: 'a', category: 'operations', tone: 'good', tag: 'ALPHA', message: 'ONE' },
      { id: 'b', category: 'operations', tone: 'good', tag: 'BRAVO', message: 'TWO' },
      { id: 'c', category: 'security', tone: 'warn', tag: 'CHARLIE', message: 'THREE' }
    ];
    const current = [
      { ...base[1], message: 'TWO EDITED' },
      base[0],
      { id: 'd', category: 'market', tone: 'lore', tag: 'DELTA', message: 'FOUR' }
    ];
    const diff = diffEntries(base, current);
    const failures = [];
    if (diff.added.length !== 1 || diff.edited.length !== 1 || diff.deleted.length !== 1 || diff.moved.length !== 1) failures.push('diff-model');
    if (typeof document !== 'undefined') {
      ['v40NewswireReviewCenter', 'v40NewswireReviewGate', 'v40NewswireChangeList', 'v40NewswireHistoryList', 'v40NewswireShareReview'].forEach(id => {
        if (!document.getElementById(id)) failures.push(`missing:${id}`);
      });
    }
    return failures;
  }

  function init() {
    if (!installMarkup()) return false;
    bind();
    captureSnapshot();
    render();
    const failures = selfTest();
    if (failures.length) throw new Error(`NEWSWIRE REVIEW SELF TEST FAILED: ${failures.join(', ')}`);
    return true;
  }

  app.newswireReview = {
    init, render, selfTest, diffEntries, reviewState, buildReviewPackage, reportText,
    buildFile, sharePackage, downloadPackage, copySummary,
    readHistory, captureSnapshot, restoreSnapshot, clearHistory,
    HISTORY_LIMIT, HISTORY_KEY
  };
})();
