/* ==========================================================================
   RHW PR5 · NEWSWIRE 2.0 CONTROL CENTER
   Search, readiness checks, priority controls and synchronized channel output
   for the browser-local RHW_Newswire.md working copy.
   ========================================================================== */
(function initRhwNewswire2() {
  'use strict';
  const app = window.RHWV4;
  const manager = app?.newswireManager;
  if (!app || !manager || app.newswire2) return;

  const state = manager.state;
  const STATUS_FILTERS = Object.freeze(['all', 'ready', 'review', 'duplicate']);
  const view = { query: '', status: 'all', selectedId: '', refreshQueued: false };
  let observer = null;

  const normalizedText = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const entryIdentity = entry => `${normalizedText(entry?.category)}|${normalizedText(entry?.tag)}|${normalizedText(entry?.message)}`;
  const editorElements = () => ({
    category: document.getElementById('v40TickerCategory'),
    tone: document.getElementById('v40TickerTone'),
    tag: document.getElementById('v40TickerTag'),
    message: document.getElementById('v40TickerMessage')
  });
  const readEditor = () => {
    const fields = editorElements();
    return {
      id: state.editingId || '',
      category: fields.category?.value || 'operations',
      tone: fields.tone?.value || 'good',
      tag: String(fields.tag?.value || '').trim(),
      message: String(fields.message?.value || '').trim()
    };
  };

  function auditEntries(entries = state.entries) {
    const result = { byId: new Map(), ready: 0, review: 0, duplicates: 0, issues: 0 };
    const identities = new Map();
    (entries || []).forEach(entry => {
      const identity = entryIdentity(entry);
      if (!identities.has(identity)) identities.set(identity, []);
      identities.get(identity).push(entry.id);
    });
    (entries || []).forEach(entry => {
      const reasons = [];
      const tag = String(entry?.tag || '').trim();
      const message = String(entry?.message || '').trim();
      const duplicate = (identities.get(entryIdentity(entry)) || []).length > 1;
      if (!tag) reasons.push('EMPTY TAG');
      if (!message) reasons.push('EMPTY MESSAGE');
      if (tag.length > 40) reasons.push('TAG TOO LONG');
      if (message.length > 240) reasons.push('MESSAGE TOO LONG');
      if (duplicate) reasons.push('DUPLICATE');
      const status = reasons.length ? 'review' : 'ready';
      if (status === 'ready') result.ready += 1;
      else result.review += 1;
      if (duplicate) result.duplicates += 1;
      result.issues += reasons.length;
      result.byId.set(entry.id, { status, duplicate, reasons });
    });
    return result;
  }

  function auditEditor(entry = readEditor()) {
    const reasons = [];
    if (!entry.tag) reasons.push('ENTER TAG');
    if (!entry.message) reasons.push('ENTER MESSAGE');
    if (entry.tag.length > 40) reasons.push('TAG TOO LONG');
    if (entry.message.length > 240) reasons.push('MESSAGE TOO LONG');
    const duplicate = state.entries.some(item => item.id !== entry.id && entryIdentity(item) === entryIdentity(entry));
    if (entry.tag && entry.message && duplicate) reasons.push('DUPLICATE BULLETIN');
    return { ready: reasons.length === 0, duplicate, reasons };
  }

  function buildForumBbcode(entry) {
    const category = String(entry?.category || 'operations').toUpperCase();
    const tone = String(entry?.tone || 'lore').toUpperCase();
    const tag = String(entry?.tag || 'RHW NEWSWIRE').trim();
    const message = String(entry?.message || 'AWAITING BULLETIN').trim();
    return `[quote][b][color=#D4AF37]RHW NEWSWIRE // ${category}[/color][/b]\n[b]${tag}[/b]\n${message}\n[size=85]SIGNAL // ${tone}[/size][/quote]`;
  }

  function controlMarkup() {
    return `<section class="v40-news2-control" id="v40NewswireControlCenter" aria-label="Newswire control center">
      <header><div><small>NEWSWIRE 2.0</small><strong>CONTROL CENTER</strong></div><span id="v40NewswireResultCount">0 VISIBLE</span></header>
      <div class="v40-news2-metrics">
        <div data-news2-metric="total"><small>TOTAL</small><strong id="v40News2Total">0</strong></div>
        <div data-news2-metric="ready"><small>READY</small><strong id="v40News2Ready">0</strong></div>
        <div data-news2-metric="review"><small>NEEDS REVIEW</small><strong id="v40News2Review">0</strong></div>
        <div data-news2-metric="local"><small>WORKING COPY</small><strong id="v40News2Local">CURRENT</strong></div>
      </div>
      <div class="v40-news2-tools">
        <label class="v40-news2-search"><span>SEARCH BULLETINS</span><div><input type="search" id="v40NewswireSearch" autocomplete="off" placeholder="Tag, message, category…"><button type="button" id="v40NewswireSearchClear" aria-label="Clear Newswire search">CLEAR</button></div></label>
        <div class="v40-news2-status" role="group" aria-label="Readiness filter">
          <span>STATUS</span><div>${STATUS_FILTERS.map(status => `<button type="button" data-newswire-status="${status}" aria-pressed="${status === 'all'}">${status === 'all' ? 'ALL' : status === 'ready' ? 'READY' : status === 'review' ? 'REVIEW' : 'DUPLICATES'}</button>`).join('')}</div>
        </div>
      </div>
    </section>`;
  }

  function channelMarkup() {
    return `<section class="v40-news2-channels" id="v40NewswireChannelPreview">
      <header><div><small>ONE BULLETIN // TWO CHANNELS</small><strong>SYNCED OUTPUT PREVIEW</strong></div><span id="v40News2PreviewSource">EDITOR</span></header>
      <div class="v40-news2-editor-gate" id="v40News2EditorGate" data-tone="review"><strong>NEEDS INPUT</strong><span>ENTER A TAG AND MESSAGE</span></div>
      <div class="v40-news2-channel-grid">
        <article class="v40-news2-channel" data-channel="ticker"><div class="v40-news2-channel-head"><small>DASHBOARD</small><strong>TICKER</strong></div><div class="v40-news2-ticker"><span>BMM INDUSTRIAL NEWSWIRE</span><p><b id="v40News2TickerTag">RHW NEWSWIRE</b><span id="v40News2TickerMessage">AWAITING BULLETIN</span></p></div></article>
        <article class="v40-news2-channel" data-channel="forum"><div class="v40-news2-channel-head"><div><small>FORUM</small><strong>BB CODE</strong></div><button type="button" id="v40News2CopyForum">COPY BB CODE</button></div><div class="v40-news2-forum-preview"><small id="v40News2ForumMeta">OPERATIONS // GOOD</small><b id="v40News2ForumTag">RHW NEWSWIRE</b><p id="v40News2ForumMessage">AWAITING BULLETIN</p></div><textarea id="v40News2ForumCode" readonly spellcheck="false" aria-label="Forum BBCode for selected Newswire bulletin"></textarea></article>
      </div>
    </section>`;
  }

  function gateMarkup() {
    return `<div class="v40-news2-output-gate" id="v40News2OutputGate" data-tone="ready"><div><small>OUTPUT GATE</small><strong id="v40News2OutputGateState">READY TO EXPORT</strong></div><span id="v40News2OutputGateHint">THE WORKING COPY PASSED ALL AUTOMATIC CHECKS.</span></div>`;
  }

  function installMarkup() {
    const managerRoot = document.getElementById('v40NewswireManager');
    if (!managerRoot) return false;
    if (!document.getElementById('v40NewswireControlCenter')) {
      managerRoot.querySelector('.v40-newswire-manager-head')?.insertAdjacentHTML('afterend', controlMarkup());
    }
    const tickerPreview = document.querySelector('[data-comms-panel="ticker"] .ticker-builder-preview');
    if (tickerPreview && !document.getElementById('v40NewswireChannelPreview')) tickerPreview.insertAdjacentHTML('afterend', channelMarkup());
    const fileHead = document.querySelector('#v40NewswireFilePanel .v40-newswire-file-head');
    if (fileHead && !document.getElementById('v40News2OutputGate')) fileHead.insertAdjacentHTML('afterend', gateMarkup());
    return Boolean(document.getElementById('v40NewswireControlCenter') && document.getElementById('v40NewswireChannelPreview'));
  }

  function selectedEntry() {
    const selected = state.entries.find(entry => entry.id === view.selectedId);
    if (selected) return { ...selected, source: 'SELECTED BULLETIN' };
    const editor = readEditor();
    return { ...editor, source: state.editingId ? 'EDITING BULLETIN' : 'NEW BULLETIN' };
  }

  function renderChannelPreview() {
    if (!document.getElementById('v40NewswireChannelPreview')) return;
    const entry = selectedEntry();
    const tag = entry.tag || 'RHW NEWSWIRE';
    const message = entry.message || 'AWAITING BULLETIN';
    const setText = (id, text) => { const element = document.getElementById(id); if (element && element.textContent !== text) element.textContent = text; };
    setText('v40News2PreviewSource', entry.source);
    setText('v40News2TickerTag', tag);
    setText('v40News2TickerMessage', message);
    setText('v40News2ForumTag', tag);
    setText('v40News2ForumMessage', message);
    setText('v40News2ForumMeta', `${String(entry.category || 'operations').toUpperCase()} // ${String(entry.tone || 'good').toUpperCase()}`);
    const code = document.getElementById('v40News2ForumCode');
    if (code) code.value = buildForumBbcode({ ...entry, tag, message });
    const channelRoot = document.getElementById('v40NewswireChannelPreview');
    if (channelRoot) channelRoot.dataset.tone = entry.tone || 'muted';
    renderEditorGate();
  }

  function renderEditorGate() {
    const gate = document.getElementById('v40News2EditorGate');
    const save = document.getElementById('v40NewswireSaveBtn');
    if (!gate) return;
    const audit = auditEditor();
    gate.dataset.tone = audit.ready ? 'ready' : 'review';
    const label = gate.querySelector('strong');
    const hint = gate.querySelector('span');
    if (label) label.textContent = audit.ready ? 'READY TO SAVE' : audit.duplicate ? 'DUPLICATE BLOCKED' : 'NEEDS REVIEW';
    if (hint) hint.textContent = audit.ready ? 'TICKER + FORUM OUTPUT ARE SYNCHRONIZED' : audit.reasons.join(' // ');
    if (save) {
      save.disabled = !audit.ready;
      save.title = audit.ready ? '' : audit.reasons.join(' // ');
    }
  }

  function renderMetrics(audit = auditEntries()) {
    const values = {
      v40News2Total: String(state.entries.length),
      v40News2Ready: String(audit.ready),
      v40News2Review: String(audit.review),
      v40News2Local: state.dirty ? 'LOCAL EDITS' : 'CURRENT'
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && element.textContent !== value) element.textContent = value;
    });
    const reviewMetric = document.querySelector('[data-news2-metric="review"]');
    if (reviewMetric) reviewMetric.dataset.tone = audit.review ? 'review' : 'ready';
    const localMetric = document.querySelector('[data-news2-metric="local"]');
    if (localMetric) localMetric.dataset.tone = state.dirty ? 'dirty' : 'ready';
  }

  function renderOutputGate(audit = auditEntries()) {
    const gate = document.getElementById('v40News2OutputGate');
    if (!gate) return;
    const ready = audit.review === 0;
    gate.dataset.tone = ready ? 'ready' : 'review';
    const label = document.getElementById('v40News2OutputGateState');
    const hint = document.getElementById('v40News2OutputGateHint');
    if (label) label.textContent = ready ? 'READY TO EXPORT' : `REVIEW ${audit.review} BULLETIN${audit.review === 1 ? '' : 'S'} FIRST`;
    if (hint) hint.textContent = ready ? 'THE WORKING COPY PASSED ALL AUTOMATIC CHECKS.' : `${audit.duplicates} DUPLICATE${audit.duplicates === 1 ? '' : 'S'} // ${audit.issues} TOTAL WARNING${audit.issues === 1 ? '' : 'S'}`;
    ['v40NewswireCopyFileBtn', 'v40NewswireExportBtn'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = !ready;
      button.title = ready ? '' : 'Resolve Newswire warnings before creating the output file.';
    });
  }

  function renderRows(audit = auditEntries()) {
    const list = document.getElementById('v40NewswireList');
    if (!list) return;
    state.entries.forEach(entry => {
      const row = list.querySelector(`.v40-newswire-entry[data-newswire-id="${CSS.escape(entry.id)}"]`);
      if (!row) return;
      const entryAudit = audit.byId.get(entry.id) || { status: 'ready', duplicate: false, reasons: [] };
      row.dataset.news2Status = entryAudit.status;
      row.dataset.news2Duplicate = entryAudit.duplicate ? 'true' : 'false';
      const meta = row.querySelector('.v40-newswire-entry-meta');
      let status = meta?.querySelector('[data-news2-row-status]');
      if (meta && !status) {
        status = document.createElement('span');
        status.dataset.news2RowStatus = 'true';
        meta.appendChild(status);
      }
      if (status) {
        status.dataset.tone = entryAudit.status;
        const statusText = entryAudit.duplicate ? 'DUPLICATE' : entryAudit.status === 'ready' ? 'READY' : 'REVIEW';
        if (status.textContent !== statusText) status.textContent = statusText;
        status.title = entryAudit.reasons.join(' // ');
      }
      const position = state.entries.filter(item => item.category === entry.category).findIndex(item => item.id === entry.id);
      let priority = meta?.querySelector('[data-news2-priority]');
      if (meta && !priority) {
        priority = document.createElement('span');
        priority.dataset.news2Priority = 'true';
        meta.appendChild(priority);
      }
      if (priority) {
        const priorityText = position === 0 ? 'PRIORITY 01' : `QUEUE ${String(position + 1).padStart(2, '0')}`;
        if (priority.textContent !== priorityText) priority.textContent = priorityText;
        priority.dataset.top = position === 0 ? 'true' : 'false';
      }
      const actions = row.querySelector('.v40-newswire-entry-actions');
      if (actions && !actions.querySelector('[data-news2-preview]')) {
        const preview = document.createElement('button');
        preview.type = 'button';
        preview.dataset.news2Preview = entry.id;
        preview.textContent = 'PREVIEW';
        actions.appendChild(preview);
      }
      if (actions && !actions.querySelector('[data-news2-pin]')) {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.dataset.news2Pin = entry.id;
        pin.textContent = 'PIN TOP';
        actions.appendChild(pin);
      }
      const pin = actions?.querySelector('[data-news2-pin]');
      if (pin) pin.disabled = position === 0;
      row.classList.toggle('selected', view.selectedId === entry.id);
    });
  }

  function matchesView(entry, audit) {
    const category = app.newswireOrdering?.activeFilter || 'all';
    if (category !== 'all' && entry.category !== category) return false;
    const haystack = normalizedText(`${entry.category} ${entry.tone} ${entry.tag} ${entry.message}`);
    if (view.query && !haystack.includes(view.query)) return false;
    const entryAudit = audit.byId.get(entry.id) || { status: 'ready', duplicate: false };
    if (view.status === 'ready' && entryAudit.status !== 'ready') return false;
    if (view.status === 'review' && entryAudit.status !== 'review') return false;
    if (view.status === 'duplicate' && !entryAudit.duplicate) return false;
    return true;
  }

  function applyFilters(audit = auditEntries()) {
    const rows = [...document.querySelectorAll('#v40NewswireList .v40-newswire-entry[data-newswire-id]')];
    let visible = 0;
    rows.forEach(row => {
      const entry = state.entries.find(item => item.id === row.dataset.newswireId);
      const show = Boolean(entry && matchesView(entry, audit));
      row.dataset.news2Visible = show ? 'true' : 'false';
      if (show) visible += 1;
    });
    document.querySelectorAll('#v40NewswireList .v40-newswire-category-divider').forEach(divider => {
      const category = divider.dataset.newswireCategoryDivider;
      divider.dataset.news2Visible = rows.some(row => row.dataset.news2Visible === 'true' && state.entries.find(entry => entry.id === row.dataset.newswireId)?.category === category) ? 'true' : 'false';
    });
    let empty = document.getElementById('v40News2Empty');
    if (!visible && state.entries.length) {
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'v40News2Empty';
        empty.className = 'v40-newswire-empty v40-news2-empty';
        document.getElementById('v40NewswireList')?.appendChild(empty);
      }
      if (empty.textContent !== 'NO BULLETINS MATCH THIS SEARCH + STATUS FILTER') empty.textContent = 'NO BULLETINS MATCH THIS SEARCH + STATUS FILTER';
    } else empty?.remove();
    const count = document.getElementById('v40NewswireResultCount');
    const countText = `${visible} VISIBLE // ${state.entries.length} TOTAL`;
    if (count && count.textContent !== countText) count.textContent = countText;
  }

  function setStatus(status) {
    view.status = STATUS_FILTERS.includes(status) ? status : 'all';
    document.querySelectorAll('[data-newswire-status]').forEach(button => {
      const active = button.dataset.newswireStatus === view.status;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    refresh();
  }

  function setQuery(query) {
    view.query = normalizedText(query);
    const input = document.getElementById('v40NewswireSearch');
    if (input && input.value !== query) input.value = query;
    refresh();
  }

  function selectEntry(id) {
    if (!state.entries.some(entry => entry.id === id)) return false;
    view.selectedId = id;
    renderRows();
    renderChannelPreview();
    document.getElementById('v40NewswireChannelPreview')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    return true;
  }

  function pinToTop(id) {
    const index = state.entries.findIndex(entry => entry.id === id);
    if (index < 0) return false;
    const entry = state.entries[index];
    const first = state.entries.findIndex(item => item.category === entry.category);
    if (first < 0 || first === index) return false;
    state.entries.splice(index, 1);
    state.entries.splice(first, 0, entry);
    manager.applyEdit(id, { ...entry });
    view.selectedId = id;
    app.notify?.('NEWSWIRE PRIORITY UPDATED // PINNED TO CATEGORY TOP');
    return true;
  }

  function refresh() {
    if (!document.getElementById('v40NewswireControlCenter')) return;
    if (view.selectedId && !state.entries.some(entry => entry.id === view.selectedId)) view.selectedId = '';
    if (!view.selectedId && state.loaded && state.entries.length && !readEditor().message) view.selectedId = state.entries[0].id;
    const audit = auditEntries();
    renderMetrics(audit);
    renderRows(audit);
    renderOutputGate(audit);
    applyFilters(audit);
    renderChannelPreview();
  }

  function queueRefresh() {
    if (view.refreshQueued) return;
    view.refreshQueued = true;
    queueMicrotask(() => {
      view.refreshQueued = false;
      refresh();
    });
  }

  function bind() {
    const root = document.querySelector('[data-comms-panel="ticker"] .v40-tool-panel');
    if (!root || root.dataset.news2Bound === 'true') return;
    root.dataset.news2Bound = 'true';
    document.getElementById('v40NewswireSearch')?.addEventListener('input', event => setQuery(event.target.value));
    document.getElementById('v40NewswireSearchClear')?.addEventListener('click', () => setQuery(''));
    document.querySelector('.v40-news2-status')?.addEventListener('click', event => {
      const button = event.target.closest('[data-newswire-status]');
      if (button) setStatus(button.dataset.newswireStatus);
    });
    ['v40TickerCategory', 'v40TickerTone', 'v40TickerTag', 'v40TickerMessage'].forEach(id => {
      const field = document.getElementById(id);
      ['input', 'change'].forEach(type => field?.addEventListener(type, () => {
        view.selectedId = '';
        renderChannelPreview();
        renderRows();
      }));
    });
    document.getElementById('v40NewswireList')?.addEventListener('click', event => {
      const preview = event.target.closest('[data-news2-preview]');
      const pin = event.target.closest('[data-news2-pin]');
      if (preview) selectEntry(preview.dataset.news2Preview);
      if (pin && !pin.disabled) pinToTop(pin.dataset.news2Pin);
    });
    document.getElementById('v40News2CopyForum')?.addEventListener('click', async () => {
      const copied = await app.util.copy(document.getElementById('v40News2ForumCode')?.value || '');
      app.notify?.(copied ? 'FORUM BB CODE COPIED' : 'COPY FAILED', copied ? 'good' : 'warn');
    });
    document.getElementById('v40NewswireCategorySummary')?.addEventListener('click', queueRefresh);
    const managerRoot = document.getElementById('v40NewswireManager');
    if (managerRoot && managerRoot.dataset.news2Observed !== 'true') {
      managerRoot.dataset.news2Observed = 'true';
      observer = new MutationObserver(queueRefresh);
      observer.observe(managerRoot, { childList: true, subtree: true });
    }
  }

  function selfTest() {
    const sample = [
      { id: 'a', category: 'operations', tone: 'good', tag: 'SAME', message: 'SAME MESSAGE' },
      { id: 'b', category: 'operations', tone: 'warn', tag: 'SAME', message: 'SAME MESSAGE' },
      { id: 'c', category: 'market', tone: 'good', tag: 'UNIQUE', message: 'READY MESSAGE' }
    ];
    const audit = auditEntries(sample);
    const code = buildForumBbcode(sample[2]);
    const failures = [];
    if (audit.ready !== 1 || audit.review !== 2 || audit.duplicates !== 2) failures.push('audit');
    if (!code.includes('UNIQUE') || !code.includes('READY MESSAGE') || !code.includes('MARKET')) failures.push('bbcode');
    ['v40NewswireControlCenter', 'v40NewswireSearch', 'v40News2OutputGate', 'v40NewswireChannelPreview', 'v40News2ForumCode'].forEach(id => {
      if (!document.getElementById(id)) failures.push(`missing:${id}`);
    });
    return failures;
  }

  function install() {
    if (!installMarkup()) return false;
    bind();
    setStatus(view.status);
    const failures = selfTest();
    if (failures.length) throw new Error(`NEWSWIRE 2.0 SELF TEST FAILED: ${failures.join(', ')}`);
    refresh();
    document.documentElement.dataset.rhwNewswire2 = 'true';
    return true;
  }

  const baseCommsInit = app.comms.init;
  app.comms.init = function newswire2AwareInit(...args) {
    const result = baseCommsInit.apply(this, args);
    install();
    return result;
  };
  const baseCommsActivate = app.comms.activate;
  app.comms.activate = function newswire2AwareActivate(node, options) {
    const result = baseCommsActivate.call(this, node, options);
    if (node === 'ticker') install();
    return result;
  };

  app.newswire2 = {
    install, refresh, auditEntries, buildForumBbcode, setStatus, setQuery, selectEntry, pinToTop, selfTest,
    get query() { return view.query; },
    get status() { return view.status; }
  };
  install();
})();
