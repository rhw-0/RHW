/* ==========================================================================
   RHW WEB APP · V4.0 COMMS SAFETY + FINAL RC POLISH
   Keeps Ticker Builder output inside the stable Newswire parser contract and
   applies non-destructive release-candidate readability / COMMS enhancements.
   ========================================================================== */
(function initRhwV4CommsSafety() {
  'use strict';
  const app = window.RHWV4;
  if (!app) return;

  const MAX_TAG = 40;
  const MAX_MESSAGE = 240;
  const LOG_TEMPLATE_KEY = 'communication-log';
  let previewObserver = null;
  let currencyObserver = null;
  let previewQueued = false;

  function installCommunicationLogTemplate() {
    if (app.config.templates.some(template => template.key === LOG_TEMPLATE_KEY)) return;
    const logTemplate = Object.freeze({
      key: LOG_TEMPLATE_KEY,
      label: 'COMMUNICATION LOG',
      documentLabel: 'RHW COMMUNICATION LOG',
      description: 'Informal or internal channel traffic, chatter, contact logs and recorded exchanges.',
      recipient: 'RHW / BMM Internal Traffic',
      encryption: 'RHW-RESOLUTION/V · KEY NEW-LONDON-06',
      classification: 'RHW INTERNAL',
      closing: 'For Resolution Heavy Works,',
      salutation: '__none__',
      accent: '#7da7ea',
      subjectPlaceholder: 'Communication log / channel subject'
    });
    app.config = Object.freeze({
      ...app.config,
      templates: Object.freeze([...app.config.templates, logTemplate])
    });
  }

  function installPolishStyles() {
    if (document.getElementById('rhwV40ReleasePolishStyle')) return;
    const style = document.createElement('style');
    style.id = 'rhwV40ReleasePolishStyle';
    style.textContent = `
      .comms-panel-head-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
      .comms-preview-copy{min-height:30px;padding:5px 10px;border:1px solid rgba(212,175,55,.32);background:rgba(212,175,55,.075);color:#e7c963;clip-path:none;box-shadow:none;font-family:var(--font-tech);font-size:8px;font-weight:700;letter-spacing:.09em;white-space:nowrap}
      .comms-preview-copy:hover,.comms-preview-copy:focus-visible{background:rgba(212,175,55,.14);color:#f3d77b}
      .forum-preview-quote{margin:12px 0;padding:10px 12px;border-left:2px solid var(--comms-accent,#d4af37);background:rgba(255,255,255,.025);color:rgba(225,228,226,.82)}
      .forum-preview-spoiler{margin:12px 0;border:1px solid rgba(125,167,234,.22);background:rgba(125,167,234,.035)}
      .forum-preview-spoiler summary{padding:8px 10px;cursor:pointer;color:#9fb6d9;font-family:var(--font-tech);font-size:10px;font-weight:700;letter-spacing:.08em}
      .forum-preview-spoiler>div{padding:10px 12px;border-top:1px solid rgba(125,167,234,.14)}
      .forum-preview-blur{display:inline-block;filter:blur(5px);transition:filter .16s ease;cursor:help;user-select:none}
      .forum-preview-blur:hover,.forum-preview-blur:focus{filter:none;user-select:text}
      .forum-preview-bb-list{margin:10px 0;padding-left:22px}
      .comms-editor-toolbar [data-rhw-format]{border-color:rgba(125,167,234,.18)}
      @media (min-width:1200px){
        .app-active-node{font-size:8px!important}
        .workspace-subnav-label{font-size:9px!important}
        .workspace-subnav button span{font-size:11px!important}
        .workspace-subnav button small{font-size:8px!important}
        .command-overview-heading>div:first-child>span{font-size:10px!important}
        .command-overview-heading p,.command-overview-live{font-size:9px!important}
        .command-overview-card small,.command-overview-card span{font-size:9px!important}
        [data-command-panel="shipyard"] .section-kicker,[data-command-panel="shipyard"] .shipyard-control-subline{font-size:9px!important}
        [data-command-panel="shipyard"] .shipyard-summary-badge,[data-command-panel="shipyard"] .shipyard-panel-state{font-size:8.5px!important}
        [data-command-panel="shipyard"] .shipyard-section-title{font-size:10px!important}
        [data-command-panel="shipyard"] .shipyard-component-head,[data-command-panel="shipyard"] .shipyard-component-row{font-size:9px!important}
        [data-command-panel="shipyard"] .hull-registry-name small,[data-command-panel="shipyard"] .hull-registry-metric small{font-size:8px!important}
        [data-command-panel="shipyard"] .shipyard-plan-button{font-size:8px!important}
        .comms-field>span{font-size:9px!important}
        .comms-field small{font-size:8px!important;line-height:1.4}
        .comms-panel-head strong{font-size:11px!important}
        .comms-panel-head small{font-size:8px!important}
        .comms-document-control-head small{font-size:8px!important}
        .comms-document-control-head strong{font-size:12px!important}
        .comms-editor-toolbar button{font-size:8px!important;min-height:30px}
        .bbcode-hint,.sender-registry-intro{font-size:8px!important;line-height:1.45}
        .ops-panel-head strong{font-size:11px!important}
        .ops-panel-head small{font-size:8.5px!important}
        .ops-recipe-meta small{font-size:8px!important}
        .ops-material-table{font-size:9.5px!important}
        .ops-material-table th{font-size:9px!important}
        .ops-material-table td strong{font-size:10.5px!important}
        .ops-material-table td small{font-size:8px!important}
        .ops-price-memory,.ops-details summary,.ops-details span{font-size:8px!important}
        .ops-flow-card>small{font-size:8px!important}
        .ops-flow-card>span{font-size:8.5px!important}
        .ops-flow-card em{font-size:7.5px!important}
        .ops-profit-strip small,.ops-revenue-line small,.ops-cost-note{font-size:8px!important}
      }
      @media (max-width:760px){
        .comms-panel-head-actions{gap:5px}.comms-preview-copy{padding-inline:8px;font-size:7px}
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeTag(value) {
    return String(value || '')
      .replace(/[\[\]|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TAG);
  }

  function normalizeMessage(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_MESSAGE);
  }

  function sanitizeField(field) {
    if (!field) return false;
    const next = field.id === 'v40TickerTag' ? normalizeTag(field.value) : normalizeMessage(field.value);
    if (field.value === next) return false;
    field.value = next;
    return true;
  }

  function wrapSelection(kind) {
    const area = document.getElementById('commsMessage');
    if (!area) return;
    const wrappers = {
      italic: ['[i]', '[/i]'],
      underline: ['[u]', '[/u]'],
      strike: ['[s]', '[/s]'],
      quote: ['[quote]', '[/quote]'],
      list: ['[list]\n[*]', '\n[/list]'],
      log: ['[spoiler=COMMUNICATION LOG]', '[/spoiler]'],
      blur: ['[sp2]', '[/sp2]']
    };
    const pair = wrappers[kind];
    if (!pair) return;
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? start;
    const selected = area.value.slice(start, end);
    const inserted = `${pair[0]}${selected}${pair[1]}`;
    area.setRangeText(inserted, start, end, 'end');
    if (!selected) {
      const cursor = start + pair[0].length;
      area.setSelectionRange(cursor, cursor);
    }
    area.focus();
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function enhanceToolbar() {
    const toolbar = document.querySelector('.comms-editor-toolbar');
    if (!toolbar || toolbar.dataset.v40OfficialBbcode === 'true') return;
    toolbar.dataset.v40OfficialBbcode = 'true';
    const existingBold = toolbar.querySelector('[data-format="bold"]');
    if (existingBold) existingBold.title = 'Generates [b]…[/b] in the forum BBCode';
    const existingList = toolbar.querySelector('[data-format="list"]');
    if (existingList) { existingList.textContent = 'BULLET'; existingList.title = 'RHW quick bullet'; }
    const extras = [
      ['italic', 'ITALIC', '[i]…[/i]'],
      ['underline', 'UNDERLINE', '[u]…[/u]'],
      ['strike', 'STRIKE', '[s]…[/s]'],
      ['quote', 'QUOTE', '[quote]…[/quote]'],
      ['list', 'BB LIST', '[list][*]…[/list]'],
      ['log', 'COMM LOG', '[spoiler=COMMUNICATION LOG]…[/spoiler]'],
      ['blur', 'BLUR', '[sp2]…[/sp2]']
    ];
    extras.forEach(([kind, label, title]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.rhwFormat = kind;
      button.textContent = label;
      button.title = title;
      toolbar.appendChild(button);
    });
    toolbar.addEventListener('click', event => {
      const button = event.target.closest('[data-rhw-format]');
      if (button) wrapSelection(button.dataset.rhwFormat);
    });
  }

  function enhancePreviewBody() {
    const body = document.querySelector('#forumLivePreview .forum-preview-body');
    if (!body) return;
    let html = body.innerHTML;
    const before = html;
    html = html.replace(/\[spoiler=([^\]]+)\]([\s\S]*?)\[\/spoiler\]/gi, '<details class="forum-preview-spoiler"><summary>$1</summary><div>$2</div></details>');
    html = html.replace(/\[sp2\]([\s\S]*?)\[\/sp2\]/gi, '<span class="forum-preview-blur" tabindex="0" title="Blur spoiler — hover to reveal">$1</span>');
    html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="forum-preview-quote">$1</blockquote>');
    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_match, inner) => {
      const items = String(inner).split(/\[\*\]/i).slice(1).map(item => item.trim()).filter(Boolean);
      return items.length ? `<ul class="forum-preview-bb-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>` : inner;
    });
    html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
    html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
    html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');
    if (html !== before) body.innerHTML = html;
  }

  function queuePreviewEnhancement() {
    if (previewQueued) return;
    previewQueued = true;
    queueMicrotask(() => { previewQueued = false; enhancePreviewBody(); });
  }

  function installPreviewObserver() {
    const preview = document.getElementById('forumLivePreview');
    if (!preview || preview.dataset.v40BbcodePreview === 'true') return;
    preview.dataset.v40BbcodePreview = 'true';
    previewObserver = new MutationObserver(queuePreviewEnhancement);
    previewObserver.observe(preview, { childList: true, subtree: true, characterData: true });
    queuePreviewEnhancement();
  }

  function installPreviewCopy() {
    const head = document.querySelector('.preview-panel .comms-panel-head');
    if (!head || document.getElementById('copyBbcodePreviewBtn')) return;
    const small = head.querySelector('small');
    const actions = document.createElement('div');
    actions.className = 'comms-panel-head-actions';
    if (small) actions.appendChild(small);
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'copyBbcodePreviewBtn';
    button.className = 'comms-preview-copy';
    button.textContent = 'COPY BB CODE';
    button.addEventListener('click', async () => {
      const copied = await app.util.copy(app.comms?.buildBbcode?.() || '');
      app.notify(copied ? 'BB CODE COPIED TO CLIPBOARD' : 'COPY FAILED', copied ? 'good' : 'warn');
    });
    actions.appendChild(button);
    head.appendChild(actions);
  }

  function replaceCreditText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const raw = node.nodeValue || '';
      let next = raw;
      if (raw.trim() === 'CR') next = raw.replace('CR', '$');
      next = next.replace(/([0-9][0-9,]*(?:\.[0-9]+)?)\s+CR\b/g, (_match, amount) => `$${amount}`);
      if (next !== raw) node.nodeValue = next;
    });
  }

  function polishOperations() {
    const workspace = document.getElementById('workspaceOperations');
    if (!workspace) return;
    replaceCreditText(workspace);
    if (workspace.dataset.v40DollarObserver === 'true') return;
    workspace.dataset.v40DollarObserver = 'true';
    currencyObserver = new MutationObserver(() => replaceCreditText(workspace));
    currencyObserver.observe(workspace, { childList: true, subtree: true, characterData: true });
  }

  function initTickerGuard() {
    const workspace = document.getElementById('workspaceComms');
    const tag = document.getElementById('v40TickerTag');
    const message = document.getElementById('v40TickerMessage');
    if (!workspace || !tag || !message || workspace.dataset.v40TickerGuard === 'true') return;
    workspace.dataset.v40TickerGuard = 'true';
    tag.maxLength = MAX_TAG;
    message.maxLength = MAX_MESSAGE;

    /* Capture-phase sanitation runs before the existing COMMS target listeners,
       so renderTicker() sees and stores the parser-safe value on the same event. */
    const guard = event => {
      const target = event.target;
      if (target?.id === 'v40TickerTag' || target?.id === 'v40TickerMessage') sanitizeField(target);
    };
    workspace.addEventListener('input', guard, true);
    workspace.addEventListener('change', guard, true);

    const changed = sanitizeField(tag) || sanitizeField(message);
    if (changed) message.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function selfTest() {
    const failures = [];
    if (!document.getElementById('rhwV40ReleasePolishStyle')) failures.push('typography-style');
    if (!app.config.templates.some(template => template.key === LOG_TEMPLATE_KEY)) failures.push('communication-log-template');
    if (!document.getElementById('copyBbcodePreviewBtn')) failures.push('preview-copy');
    const toolbar = document.querySelector('.comms-editor-toolbar');
    ['italic', 'underline', 'strike', 'quote', 'list', 'log', 'blur'].forEach(kind => {
      if (!toolbar?.querySelector(`[data-rhw-format="${kind}"]`)) failures.push(`toolbar:${kind}`);
    });
    const operations = document.getElementById('workspaceOperations');
    if (operations && [...operations.querySelectorAll('.ops-price-input-wrap>span')].some(node => node.textContent.trim() === 'CR')) failures.push('currency-symbol');
    return failures;
  }

  function init() {
    initTickerGuard();
    enhanceToolbar();
    installPreviewObserver();
    installPreviewCopy();
    polishOperations();
  }

  installCommunicationLogTemplate();
  installPolishStyles();

  app.commsSafety = {
    init,
    selfTest,
    polishOperations,
    normalizeTag,
    normalizeMessage,
    limits: Object.freeze({ tag: MAX_TAG, message: MAX_MESSAGE }),
    forumFormatting: Object.freeze(['b', 'i', 'u', 's', 'quote', 'list', 'spoiler', 'sp2'])
  };
})();