/* ==========================================================================
   RHW WEB APP · V4.0 NEWSWIRE MANAGER
   Loads the current RHW_Newswire.md into a browser-local working copy and
   supports add/edit/delete plus copy/export. It never publishes to GitHub.
   ========================================================================== */
(function initRhwV4NewswireManager() {
  'use strict';
  const app = window.RHWV4;
  if (!app?.comms || app.newswireManager) return;

  const CATEGORIES = Object.freeze(['market', 'regional', 'security', 'operations', 'corporate']);
  const TONES = Object.freeze(['good', 'warn', 'danger', 'remote', 'lore', 'muted']);
  const DRAFT_KEY = 'rhw-webapp-v4:newswire-manager-session';
  const SOURCE_URL = typeof DASHBOARD_CONFIG !== 'undefined' && DASHBOARD_CONFIG?.newswireUrl
    ? DASHBOARD_CONFIG.newswireUrl
    : './assets/RHW_Newswire.md';
  const STYLE_ID = 'rhwV40NewswireManagerStyle';
  const state = {
    entries: [], baseEntries: [], sourceText: '', baseHash: '', editingId: '',
    dirty: false, sourceMode: 'loading', loaded: false, loadError: ''
  };

  const esc = value => app.util.escape(String(value ?? ''));
  const cloneEntries = entries => entries.map(entry => ({ ...entry }));
  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const hashText = value => {
    let hash = 2166136261;
    for (const char of String(value || '')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  const makeId = (entry, index = Date.now()) => `nw-${index}-${hashText(`${entry.category}|${entry.tag}|${entry.message}`)}`;

  function normalizeTag(value) {
    return String(value || '').replace(/[\[\]|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function normalizeMessage(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  }
  function normalizeEntry(raw = {}, index = Date.now()) {
    const category = CATEGORIES.includes(slug(raw.category)) ? slug(raw.category) : 'operations';
    const tone = TONES.includes(String(raw.tone || '').toLowerCase()) ? String(raw.tone).toLowerCase() : 'lore';
    const tag = normalizeTag(raw.tag || 'RHW OPERATIONS');
    const message = normalizeMessage(raw.message || raw.text || '');
    return { id: String(raw.id || makeId({ category, tone, tag, message }, index)), category, tone, tag, message };
  }

  function parseSource(text) {
    const entries = [];
    let category = '';
    let fence = '';
    String(text || '').split('\n').forEach(rawLine => {
      const line = rawLine.trim();
      const fenceMatch = line.match(/^(```+|~~~+)/);
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1].slice(0, 3);
        else if (line.startsWith(fence)) fence = '';
        return;
      }
      if (fence) return;
      const header = line.match(/^##\s+(.+?)\s*$/);
      if (header) {
        const next = slug(header[1]);
        category = CATEGORIES.includes(next) ? next : '';
        return;
      }
      if (!category || !line.startsWith('-')) return;
      const match = line.match(/^-\s*\[([^|\]]+?)\s*\|\s*([A-Za-z]+)\s*\]\s*(.+)$/);
      if (!match) return;
      const entry = normalizeEntry({ category, tag: match[1], tone: match[2], message: match[3] }, entries.length + 1);
      if (entry.tag && entry.message) entries.push(entry);
    });
    return entries;
  }

  function serializeSource(entries = state.entries) {
    const lines = [
      '# RHW Industrial Newswire', '',
      'Edit the bulletins below without changing `index.html`.', '',
      'Format:', '', '```text', '## category', '- [TAG | tone] MESSAGE', '```', '',
      'Allowed tones: `good`, `warn`, `danger`, `remote`, `lore`, `muted`.',
      'The dashboard safely merges these entries with its built-in fallback messages.', ''
    ];
    CATEGORIES.forEach((category, categoryIndex) => {
      lines.push(`## ${category}`);
      entries.filter(entry => entry.category === category).forEach(entry => {
        lines.push(`- [${normalizeTag(entry.tag)} | ${TONES.includes(entry.tone) ? entry.tone : 'lore'}] ${normalizeMessage(entry.message)}`);
      });
      if (categoryIndex < CATEGORIES.length - 1) lines.push('');
    });
    return `${lines.join('\n').trimEnd()}\n`;
  }

  function entriesSignature(entries = state.entries) {
    return entries.map(entry => `${entry.category}\u0000${entry.tone}\u0000${entry.tag}\u0000${entry.message}`).join('\u0001');
  }

  function fallbackEntries() {
    try {
      if (typeof NEWSWIRE_POOLS === 'undefined') return [];
      const entries = [];
      CATEGORIES.forEach(category => {
        (NEWSWIRE_POOLS[category] || []).forEach(message => entries.push(normalizeEntry({
          category, tone: message.tone, tag: message.tag, message: message.text
        }, entries.length + 1)));
      });
      return entries;
    } catch {
      return [];
    }
  }

  function readSessionDraft(baseHash) {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (draft?.baseHash !== baseHash || !Array.isArray(draft.entries)) return null;
      return draft.entries.map((entry, index) => normalizeEntry(entry, index + 1));
    } catch {
      return null;
    }
  }

  function saveSessionDraft() {
    try {
      if (!state.dirty) {
        sessionStorage.removeItem(DRAFT_KEY);
        return;
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ baseHash: state.baseHash, entries: state.entries }));
    } catch {}
  }

  function clearSessionDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  }

  function recalcDirty() {
    state.dirty = entriesSignature(state.entries) !== entriesSignature(state.baseEntries);
    saveSessionDraft();
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v40-newswire-manager{margin:0 0 18px;border:1px solid rgba(125,167,234,.20);background:rgba(5,9,13,.42)}
      .v40-newswire-manager-head,.v40-newswire-editor-head,.v40-newswire-file-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)}
      .v40-newswire-manager-head>div,.v40-newswire-editor-head>div,.v40-newswire-file-head>div{display:grid;gap:3px}
      .v40-newswire-manager-head small,.v40-newswire-editor-head small,.v40-newswire-file-head small{font-family:var(--font-tech);font-size:8px;letter-spacing:.10em;color:rgba(224,224,224,.45)}
      .v40-newswire-manager-head strong,.v40-newswire-editor-head strong,.v40-newswire-file-head strong{font-family:var(--font-tech);font-size:11px;letter-spacing:.06em;color:#dfe5ea}
      .v40-newswire-manager-status[data-tone="dirty"]{color:#e7c963}.v40-newswire-manager-status[data-tone="warn"]{color:#c98b2c}.v40-newswire-manager-status[data-tone="good"]{color:#78ad8a}
      .v40-newswire-publish-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 14px;border-bottom:1px solid rgba(125,167,234,.15);background:rgba(125,167,234,.055)}
      .v40-newswire-publish-banner strong{font-family:var(--font-tech);font-size:10px;letter-spacing:.085em;color:#9fb6d9;white-space:nowrap}
      .v40-newswire-publish-banner span{font-family:var(--font-tech);font-size:8px;line-height:1.45;letter-spacing:.055em;color:rgba(224,224,224,.62);text-align:right}
      .v40-newswire-publish-banner[data-tone="dirty"]{border-color:rgba(212,175,55,.38);background:linear-gradient(90deg,rgba(212,175,55,.15),rgba(212,175,55,.045))}
      .v40-newswire-publish-banner[data-tone="dirty"] strong{color:#f0d06b;text-shadow:0 0 12px rgba(212,175,55,.2)}
      .v40-newswire-publish-banner[data-tone="warn"]{border-color:rgba(201,139,44,.34);background:rgba(201,139,44,.08)}
      .v40-newswire-publish-banner[data-tone="warn"] strong{color:#d9a34c}
      .v40-newswire-manager button,.v40-newswire-editor-action{min-height:30px;padding:6px 10px;border:1px solid rgba(125,167,234,.20);background:rgba(125,167,234,.055);color:#a9bddb;font-family:var(--font-tech);font-size:8px;font-weight:700;letter-spacing:.07em;box-shadow:none;clip-path:none}
      .v40-newswire-manager button:hover,.v40-newswire-manager button:focus-visible,.v40-newswire-editor-action:hover,.v40-newswire-editor-action:focus-visible{background:rgba(125,167,234,.11);color:#d5e1f2}
      .v40-newswire-category-summary{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05)}
      .v40-newswire-category-summary span{padding:4px 7px;border:1px solid rgba(212,175,55,.15);background:rgba(212,175,55,.035);font-family:var(--font-tech);font-size:8px;letter-spacing:.07em;color:rgba(224,224,224,.58)}
      .v40-newswire-list{display:grid;gap:8px;padding:12px 14px;max-height:440px;overflow:auto}
      .v40-newswire-empty{padding:24px;text-align:center;font-family:var(--font-tech);font-size:10px;letter-spacing:.08em;color:rgba(224,224,224,.45)}
      .v40-newswire-entry{display:grid;grid-template-columns:minmax(170px,.65fr) minmax(0,1.6fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid rgba(255,255,255,.065);background:rgba(0,0,0,.18)}
      .v40-newswire-entry.editing{border-color:rgba(212,175,55,.42);background:rgba(212,175,55,.045)}
      .v40-newswire-entry-id{display:grid;gap:5px;min-width:0}.v40-newswire-entry-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .v40-newswire-entry-meta span{padding:2px 5px;border:1px solid rgba(255,255,255,.08);font-family:var(--font-tech);font-size:7px;letter-spacing:.08em;color:rgba(224,224,224,.52)}
      .v40-newswire-entry-meta [data-tone="good"]{color:#78ad8a}.v40-newswire-entry-meta [data-tone="warn"]{color:#c98b2c}.v40-newswire-entry-meta [data-tone="danger"]{color:#c75e5e}.v40-newswire-entry-meta [data-tone="remote"]{color:#7da7ea}.v40-newswire-entry-meta [data-tone="lore"]{color:#c6a75a}
      .v40-newswire-entry-id strong{overflow:hidden;text-overflow:ellipsis;font-family:var(--font-tech);font-size:10px;letter-spacing:.055em;color:#e4e7ea}
      .v40-newswire-entry p{margin:0;font-family:var(--font-tech);font-size:9px;line-height:1.5;letter-spacing:.035em;color:rgba(224,224,224,.72)}
      .v40-newswire-entry-actions{display:flex;gap:6px}.v40-newswire-entry-actions button[data-newswire-delete]{border-color:rgba(199,94,94,.22);color:#c98282}
      .v40-newswire-editor-head{margin-top:12px;border:1px solid rgba(212,175,55,.14);border-bottom:0;background:rgba(212,175,55,.025)}
      .v40-newswire-editor-state{color:#e7c963!important}
      .v40-newswire-file{margin-top:18px;border:1px solid rgba(212,175,55,.16);background:rgba(0,0,0,.15)}
      .v40-newswire-file-actions{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px}
      .v40-newswire-file-actions .primary{border-color:rgba(212,175,55,.36);background:rgba(212,175,55,.075);color:#e7c963}
      .v40-newswire-file details{border-top:1px solid rgba(255,255,255,.05)}.v40-newswire-file summary{padding:10px 14px;cursor:pointer;font-family:var(--font-tech);font-size:8px;letter-spacing:.08em;color:rgba(224,224,224,.5)}
      .v40-newswire-file textarea{display:block;width:calc(100% - 28px);min-height:260px;margin:0 14px 14px;padding:12px;resize:vertical;border:1px solid rgba(212,175,55,.15);background:#06090c;color:#cfd4d7;font-family:var(--font-tech);font-size:9px;line-height:1.45}
      @media(max-width:900px){.v40-newswire-entry{grid-template-columns:1fr}.v40-newswire-entry-actions{justify-content:flex-start}.v40-newswire-manager-head,.v40-newswire-editor-head,.v40-newswire-file-head,.v40-newswire-publish-banner{align-items:flex-start;flex-direction:column}.v40-newswire-publish-banner span{text-align:left}.v40-newswire-list{max-height:none}}
    `;
    document.head.appendChild(style);
  }

  function managerMarkup() {
    return `<section class="v40-newswire-manager" id="v40NewswireManager">
      <div class="v40-newswire-manager-head"><div><small>CURRENT / WORKING BULLETINS</small><strong id="v40NewswireManagerStatus" class="v40-newswire-manager-status" data-tone="muted">LOADING RHW_NEWSWIRE.MD</strong></div><button type="button" id="v40NewswireReloadBtn">RELOAD CURRENT FILE</button></div>
      <div class="v40-newswire-publish-banner" id="v40NewswirePublishBanner" data-tone="clean"><strong id="v40NewswirePublishState">CURRENT FILE // READ ONLY</strong><span id="v40NewswirePublishHint">NOTHING ON THIS PAGE IS PUBLISHED AUTOMATICALLY. ADD / EDIT / DELETE CREATES A LOCAL WORKING COPY ONLY.</span></div>
      <div class="v40-newswire-category-summary" id="v40NewswireCategorySummary"></div>
      <div class="v40-newswire-list" id="v40NewswireList"><div class="v40-newswire-empty">LOADING CURRENT BULLETINS…</div></div>
    </section>`;
  }

  function fileMarkup() {
    return `<section class="v40-newswire-file" id="v40NewswireFilePanel">
      <div class="v40-newswire-file-head"><div><small>WORKING COPY OUTPUT</small><strong>UPDATED RHW_NEWSWIRE.MD</strong></div><small>NOT PUBLISHED AUTOMATICALLY</small></div>
      <div class="v40-newswire-file-actions"><button type="button" class="primary" id="v40NewswireCopyFileBtn">COPY UPDATED NEWSWIRE</button><button type="button" id="v40NewswireExportBtn">EXPORT RHW_NEWSWIRE.MD</button><button type="button" id="v40NewswireResetBtn">RESET TO CURRENT FILE</button></div>
      <details><summary>SHOW COMPLETE MARKDOWN SOURCE</summary><textarea id="v40NewswireFileOutput" readonly spellcheck="false"></textarea></details>
    </section>`;
  }

  function updateLabels() {
    const panel = document.querySelector('[data-comms-panel="ticker"] .v40-tool-panel');
    const title = panel?.querySelector('.comms-panel-head strong');
    if (title) title.textContent = 'BMM INDUSTRIAL NEWSWIRE MANAGER';
    const explainer = panel?.querySelector('.v40-newswire-explainer span');
    if (explainer) explainer.textContent = 'LOADS THE CURRENT RHW NEWSWIRE FILE INTO A LOCAL WORKING COPY. ADD, EDIT OR DELETE BULLETINS, THEN COPY OR EXPORT THE COMPLETE UPDATED FILE. CHANGES ARE NOT PUBLISHED AUTOMATICALLY.';
    const tab = document.querySelector('[data-comms-node="ticker"] small');
    if (tab) tab.textContent = 'NEWSWIRE MANAGER';
    if (document.body?.dataset?.commsNode === 'ticker') {
      const workspaceTitle = document.getElementById('commsWorkspaceTitle');
      const workspaceSubtitle = document.getElementById('commsWorkspaceSubtitle');
      if (workspaceTitle) workspaceTitle.textContent = 'BMM INDUSTRIAL NEWSWIRE MANAGER';
      if (workspaceSubtitle) workspaceSubtitle.textContent = 'CURRENT BULLETINS // ADD + EDIT + DELETE // EXPORT UPDATED SOURCE';
    }
  }

  function enhanceMarkup() {
    const panel = document.querySelector('[data-comms-panel="ticker"] .v40-tool-panel');
    if (!panel || panel.dataset.v40NewswireManager === 'true') return false;
    panel.dataset.v40NewswireManager = 'true';
    installStyles();
    updateLabels();

    const explainer = panel.querySelector('.v40-newswire-explainer');
    explainer?.insertAdjacentHTML('afterend', managerMarkup());
    const grid = panel.querySelector('.v40-tool-grid');
    grid?.insertAdjacentHTML('beforebegin', '<div class="v40-newswire-editor-head"><div><small>ENTRY EDITOR</small><strong id="v40NewswireEditorMode" class="v40-newswire-editor-state">ADD NEW BULLETIN</strong></div><small>LIVE PREVIEW BELOW</small></div>');

    const actions = panel.querySelector('.comms-actions');
    if (actions) {
      const copy = document.getElementById('v40CopyTickerBtn');
      if (copy) { copy.classList.remove('comms-primary'); copy.querySelector('span').textContent = 'COPY ENTRY BLOCK'; }
      actions.insertAdjacentHTML('afterbegin', '<button class="comms-primary" type="button" id="v40NewswireSaveBtn"><span>ADD TO NEWSWIRE</span></button><button type="button" id="v40NewswireCancelEditBtn" hidden><span>CANCEL EDIT</span></button>');
    }
    panel.insertAdjacentHTML('beforeend', fileMarkup());
    bindManager();
    return true;
  }

  function statusText() {
    if (!state.loaded) return ['LOADING RHW_NEWSWIRE.MD', 'muted'];
    if (state.sourceMode === 'fallback') return [`${state.entries.length} BULLETINS // FALLBACK SOURCE // REPOSITORY FILE UNAVAILABLE`, 'warn'];
    if (state.dirty) return [`${state.entries.length} BULLETINS // LOCAL EDITS // NOT PUBLISHED`, 'dirty'];
    return [`${state.entries.length} CURRENT BULLETINS // REPOSITORY SOURCE LOADED`, 'good'];
  }

  function publishBannerCopy() {
    if (!state.loaded) return ['LOADING CURRENT SOURCE', 'THE MANAGER HAS NOT LOADED A SOURCE FILE YET.', 'clean'];
    if (state.sourceMode === 'fallback') return ['FALLBACK SOURCE // NOT PUBLISHED', 'THE REPOSITORY FILE COULD NOT BE LOADED. ANY CHANGES HERE ARE LOCAL ONLY; RELOAD THE CURRENT FILE BEFORE EXPORTING.', 'warn'];
    if (state.dirty) return ['LOCAL EDITS // NOT PUBLISHED', 'YOUR CHANGES EXIST ONLY IN THIS BROWSER WORKING COPY. USE COPY UPDATED NEWSWIRE OR EXPORT RHW_NEWSWIRE.MD TO PUBLISH THEM MANUALLY.', 'dirty'];
    return ['CURRENT FILE // READ ONLY', 'NOTHING IS PUBLISHED AUTOMATICALLY. ADD / EDIT / DELETE WILL CREATE A LOCAL WORKING COPY AND THIS BANNER WILL TURN GOLD.', 'clean'];
  }

  function renderPublishBanner() {
    const banner = document.getElementById('v40NewswirePublishBanner');
    const label = document.getElementById('v40NewswirePublishState');
    const hint = document.getElementById('v40NewswirePublishHint');
    if (!banner || !label || !hint) return;
    const [labelText, hintText, tone] = publishBannerCopy();
    banner.dataset.tone = tone;
    label.textContent = labelText;
    hint.textContent = hintText;
  }

  function renderSummary() {
    const target = document.getElementById('v40NewswireCategorySummary');
    if (!target) return;
    target.innerHTML = CATEGORIES.map(category => `<span>${category.toUpperCase()} // ${state.entries.filter(entry => entry.category === category).length}</span>`).join('');
  }

  function renderList() {
    const target = document.getElementById('v40NewswireList');
    if (!target) return;
    if (!state.entries.length) {
      target.innerHTML = '<div class="v40-newswire-empty">NO BULLETINS IN WORKING COPY</div>';
      return;
    }
    target.innerHTML = state.entries.map(entry => `<article class="v40-newswire-entry${entry.id === state.editingId ? ' editing' : ''}" data-newswire-id="${esc(entry.id)}">
      <div class="v40-newswire-entry-id"><div class="v40-newswire-entry-meta"><span>${esc(entry.category.toUpperCase())}</span><span data-tone="${esc(entry.tone)}">${esc(entry.tone.toUpperCase())}</span></div><strong>${esc(entry.tag)}</strong></div>
      <p>${esc(entry.message)}</p>
      <div class="v40-newswire-entry-actions"><button type="button" data-newswire-edit="${esc(entry.id)}">EDIT</button><button type="button" data-newswire-delete="${esc(entry.id)}">DELETE</button></div>
    </article>`).join('');
  }

  function renderEditorMode() {
    const label = document.getElementById('v40NewswireEditorMode');
    const save = document.getElementById('v40NewswireSaveBtn');
    const cancel = document.getElementById('v40NewswireCancelEditBtn');
    if (label) label.textContent = state.editingId ? 'EDIT EXISTING BULLETIN' : 'ADD NEW BULLETIN';
    if (save?.querySelector('span')) save.querySelector('span').textContent = state.editingId ? 'SAVE CHANGES' : 'ADD TO NEWSWIRE';
    if (cancel) cancel.hidden = !state.editingId;
  }

  function renderFileOutput() {
    const output = document.getElementById('v40NewswireFileOutput');
    if (output) output.value = serializeSource();
  }

  function renderManager() {
    const status = document.getElementById('v40NewswireManagerStatus');
    const [text, tone] = statusText();
    if (status) { status.textContent = text; status.dataset.tone = tone; }
    renderPublishBanner();
    renderSummary();
    renderList();
    renderEditorMode();
    renderFileOutput();
  }

  function editorElements() {
    return {
      category: document.getElementById('v40TickerCategory'), tone: document.getElementById('v40TickerTone'),
      tag: document.getElementById('v40TickerTag'), message: document.getElementById('v40TickerMessage')
    };
  }

  function syncTickerPreview() {
    const { category, tone, tag, message } = editorElements();
    [category, tone].forEach(element => element?.dispatchEvent(new Event('change', { bubbles: true })));
    [tag, message].forEach(element => element?.dispatchEvent(new Event('input', { bubbles: true })));
  }

  function readEditor() {
    const { category, tone, tag, message } = editorElements();
    return normalizeEntry({ category: category?.value, tone: tone?.value, tag: tag?.value, message: message?.value });
  }

  function setEditor(entry) {
    const fields = editorElements();
    if (fields.category) fields.category.value = entry.category;
    if (fields.tone) fields.tone.value = entry.tone;
    if (fields.tag) fields.tag.value = entry.tag;
    if (fields.message) fields.message.value = entry.message;
    syncTickerPreview();
  }

  function clearEditor({ keepRouting = true } = {}) {
    const fields = editorElements();
    if (!keepRouting) {
      if (fields.category) fields.category.value = 'operations';
      if (fields.tone) fields.tone.value = 'good';
      if (fields.tag) fields.tag.value = 'RHW OPERATIONS';
    }
    if (fields.message) fields.message.value = '';
    state.editingId = '';
    syncTickerPreview();
    renderEditorMode();
    renderList();
  }

  function applyAdd(entry) {
    const normalized = normalizeEntry(entry, state.entries.length + Date.now());
    if (!normalized.tag || !normalized.message) return false;
    state.entries.push(normalized);
    recalcDirty();
    renderManager();
    return true;
  }

  function applyEdit(id, entry) {
    const index = state.entries.findIndex(item => item.id === id);
    if (index < 0) return false;
    const normalized = normalizeEntry({ ...entry, id }, index + 1);
    if (!normalized.tag || !normalized.message) return false;
    state.entries[index] = normalized;
    recalcDirty();
    renderManager();
    return true;
  }

  function applyDelete(id) {
    const index = state.entries.findIndex(item => item.id === id);
    if (index < 0) return false;
    state.entries.splice(index, 1);
    if (state.editingId === id) state.editingId = '';
    recalcDirty();
    renderManager();
    return true;
  }

  function beginEdit(id) {
    const entry = state.entries.find(item => item.id === id);
    if (!entry) return;
    state.editingId = id;
    setEditor(entry);
    renderEditorMode();
    renderList();
    document.querySelector('.v40-newswire-editor-head')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function saveEditor() {
    const entry = readEditor();
    if (!entry.tag || !entry.message) {
      app.notify('ENTER A NEWSWIRE TAG AND MESSAGE FIRST', 'warn');
      return;
    }
    const editing = state.editingId;
    const ok = editing ? applyEdit(editing, entry) : applyAdd(entry);
    if (!ok) { app.notify('NEWSWIRE ENTRY COULD NOT BE SAVED', 'warn'); return; }
    app.notify(editing ? 'NEWSWIRE ENTRY UPDATED // LOCAL WORKING COPY' : 'NEWSWIRE ENTRY ADDED // LOCAL WORKING COPY');
    clearEditor({ keepRouting: true });
  }

  function resetWorkingCopy({ announce = true } = {}) {
    state.entries = cloneEntries(state.baseEntries);
    state.editingId = '';
    state.dirty = false;
    clearSessionDraft();
    clearEditor({ keepRouting: true });
    renderManager();
    if (announce) app.notify('NEWSWIRE WORKING COPY RESET TO CURRENT FILE', 'warn');
  }

  function exportSource() {
    const blob = new Blob([serializeSource()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'RHW_Newswire.md';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.notify('UPDATED RHW_NEWSWIRE.MD EXPORTED');
  }

  async function copySource() {
    const copied = await app.util.copy(serializeSource());
    app.notify(copied ? 'UPDATED NEWSWIRE COPIED' : 'COPY FAILED', copied ? 'good' : 'warn');
  }

  function applyLoadedSource(sourceText, mode = 'repository') {
    const parsed = parseSource(sourceText);
    const fallback = mode === 'fallback' && !parsed.length ? fallbackEntries() : [];
    const loadedEntries = parsed.length ? parsed : fallback;
    state.sourceText = sourceText || serializeSource(loadedEntries);
    state.baseHash = hashText(state.sourceText);
    state.baseEntries = cloneEntries(loadedEntries);
    const draft = mode === 'repository' ? readSessionDraft(state.baseHash) : null;
    state.entries = (draft && Array.isArray(draft)) ? cloneEntries(draft) : cloneEntries(loadedEntries);
    state.sourceMode = mode;
    state.loaded = true;
    state.loadError = '';
    state.editingId = '';
    state.dirty = entriesSignature(state.entries) !== entriesSignature(state.baseEntries);
    renderManager();
  }

  async function loadCurrentSource({ force = false } = {}) {
    if (force && state.dirty && !window.confirm('Discard local Newswire edits and reload the current repository file?')) return;
    state.loaded = false;
    state.sourceMode = 'loading';
    renderManager();
    try {
      const response = await fetch(SOURCE_URL, { headers: { Accept: 'text/markdown,text/plain;q=0.9,*/*;q=0.1' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sourceText = await response.text();
      const parsed = parseSource(sourceText);
      if (!parsed.length) throw new Error('NO BULLETINS PARSED');
      if (force) clearSessionDraft();
      applyLoadedSource(sourceText, 'repository');
    } catch (error) {
      state.loadError = String(error?.message || error || 'UNKNOWN SOURCE ERROR');
      const entries = fallbackEntries();
      applyLoadedSource(serializeSource(entries), 'fallback');
    }
  }

  function bindManager() {
    const panel = document.getElementById('v40NewswireManager')?.closest('.v40-tool-panel');
    if (!panel || panel.dataset.v40NewswireManagerBound === 'true') return;
    panel.dataset.v40NewswireManagerBound = 'true';
    document.getElementById('v40NewswireSaveBtn')?.addEventListener('click', saveEditor);
    document.getElementById('v40NewswireCancelEditBtn')?.addEventListener('click', () => clearEditor({ keepRouting: true }));
    document.getElementById('v40NewswireReloadBtn')?.addEventListener('click', () => loadCurrentSource({ force: true }));
    document.getElementById('v40NewswireResetBtn')?.addEventListener('click', () => {
      if (state.dirty && !window.confirm('Discard all local Newswire edits?')) return;
      resetWorkingCopy();
    });
    document.getElementById('v40NewswireCopyFileBtn')?.addEventListener('click', copySource);
    document.getElementById('v40NewswireExportBtn')?.addEventListener('click', exportSource);
    document.getElementById('v40NewswireList')?.addEventListener('click', event => {
      const edit = event.target.closest('[data-newswire-edit]');
      const remove = event.target.closest('[data-newswire-delete]');
      if (edit) beginEdit(edit.dataset.newswireEdit);
      if (remove) {
        const entry = state.entries.find(item => item.id === remove.dataset.newswireDelete);
        if (entry && window.confirm(`Delete “${entry.tag}” from the local Newswire working copy?`)) {
          applyDelete(entry.id);
          app.notify('NEWSWIRE ENTRY DELETED // LOCAL WORKING COPY', 'warn');
        }
      }
    });
  }

  function selfTest() {
    const failures = [];
    const sample = '# RHW Industrial Newswire\n\n## market\n- [TEST DESK | good] FIRST MESSAGE\n\n## operations\n- [RHW OPS | warn] SECOND MESSAGE\n';
    const parsed = parseSource(sample);
    if (parsed.length !== 2 || parsed[0].category !== 'market' || parsed[1].tone !== 'warn') failures.push('parse');
    const roundTrip = parseSource(serializeSource(parsed));
    if (roundTrip.length !== 2 || roundTrip[0].tag !== 'TEST DESK' || roundTrip[1].message !== 'SECOND MESSAGE') failures.push('serialize');
    const copy = cloneEntries(parsed);
    copy.push(normalizeEntry({ category: 'security', tone: 'danger', tag: 'TEST', message: 'THIRD MESSAGE' }, 3));
    if (copy.length !== 3 || parsed.length !== 2) failures.push('add');
    copy[0] = normalizeEntry({ ...copy[0], message: 'EDITED MESSAGE' }, 1);
    if (copy[0].message !== 'EDITED MESSAGE') failures.push('edit');
    copy.splice(1, 1);
    if (copy.length !== 2) failures.push('delete');
    const dirtyBanner = (() => {
      const original = state.dirty;
      state.dirty = true;
      const copyValue = publishBannerCopy();
      state.dirty = original;
      return copyValue;
    })();
    if (!dirtyBanner[0].includes('LOCAL EDITS') || !dirtyBanner[0].includes('NOT PUBLISHED')) failures.push('publish-banner-copy');
    ['v40NewswireManager', 'v40NewswirePublishBanner', 'v40NewswirePublishState', 'v40NewswireList', 'v40NewswireSaveBtn', 'v40NewswireCopyFileBtn', 'v40NewswireExportBtn', 'v40NewswireFileOutput'].forEach(id => {
      if (!document.getElementById(id)) failures.push(`missing:${id}`);
    });
    return failures;
  }

  function enhance() {
    if (!enhanceMarkup() && !document.getElementById('v40NewswireManager')) return false;
    updateLabels();
    const failures = selfTest();
    if (failures.length) throw new Error(`V4 NEWSWIRE MANAGER SELF TEST FAILED: ${failures.join(', ')}`);
    if (!state.loaded) loadCurrentSource();
    return true;
  }

  const baseInit = app.comms.init;
  app.comms.init = function newswireManagerAwareInit(...args) {
    const result = baseInit.apply(this, args);
    enhance();
    return result;
  };

  const baseActivate = app.comms.activate;
  app.comms.activate = function newswireManagerAwareActivate(node, options) {
    const result = baseActivate.call(this, node, options);
    if (node === 'ticker') updateLabels();
    return result;
  };

  app.newswireManager = {
    state, enhance, parseSource, serializeSource, loadCurrentSource, applyLoadedSource,
    applyAdd, applyEdit, applyDelete, beginEdit, resetWorkingCopy, selfTest
  };
})();