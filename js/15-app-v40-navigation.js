/* ==========================================================================
   RHW WEB APP · V4.0 NAVIGATION + COMMS ENHANCEMENTS
   Command nodes, COMMS tools, RP cipher generator and BBCode formatting.
   ========================================================================== */

const RHW_V40_NODE_KEYS = Object.freeze({
  command: 'rhw-webapp-v4:command-node',
  comms: 'rhw-webapp-v4:comms-node',
  newswire: 'rhw-webapp-v4:newswire-composer'
});

const RHW_V40_COMMAND_NODES = Object.freeze([
  ['overview', 'OVERVIEW', 'EXECUTIVE STATUS'],
  ['inventory', 'INVENTORY', 'STOCK + MANIFEST'],
  ['shipyard', 'SHIPYARD', 'CAPITAL HULLS'],
  ['production', 'PRODUCTION', 'RECIPE CONTROL'],
  ['logistics', 'LOGISTICS', 'REMOTE SUPPLY']
]);

const RHW_V40_COMMS_NODES = Object.freeze([
  ['forum', 'FORUM', 'TRANSMISSION COMPOSER'],
  ['newswire', 'NEWSWIRE', 'EDITORIAL GENERATOR'],
  ['drafts', 'DRAFTS', 'LOCAL ARCHIVE'],
  ['senders', 'SENDERS', 'IDENTITY REGISTRY']
]);

const RHW_V40_CLASSIFICATIONS = Object.freeze([
  'PUBLIC RELEASE',
  'RHW OFFICIAL',
  'RHW INTERNAL',
  'COMMERCIAL CONFIDENTIAL',
  'BMM CONFIDENTIAL',
  'CROWN RESTRICTED',
  'ADMIRALTY EYES ONLY',
  'RHW EXECUTIVE',
  'PRIORITY // RESTRICTED'
]);

const RHW_V40_CIPHER = Object.freeze({
  authorities: Object.freeze({
    formal: ['CROWN', 'WHITEHALL', 'RHW'],
    procurement: ['ADMIRALTY', 'CROWN', 'BAF'],
    trade: ['BMM', 'RHW', 'THAMES'],
    operations: ['RHW', 'BMM', 'NEW-LONDON'],
    incident: ['CROWN-PRIORITY', 'RHW-SECURITY', 'BAF'],
    announcement: ['RHW-HERALD', 'BMM-PUBLIC', 'CROWN-BROADCAST']
  }),
  families: ['TYPEX', 'SOVEREIGN', 'IRONCLAD', 'LIONHEART', 'BLACKTHORN', 'CROWNGLASS', 'RESOLUTION'],
  suites: [
    'ML-KEM-1024 + AES-256-GCM',
    'ML-KEM-768 + AES-256-GCM',
    'X25519 + CHACHA20-POLY1305',
    'X25519 + AES-256-GCM'
  ],
  keysets: ['LION', 'VICTORIA', 'THAMES', 'WINDSOR', 'CROWN', 'NEW-LONDON', 'RESOLUTION', 'BRITANNIA', 'FOUNDRY']
});

function v40Pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function v40Roman(value) {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return numerals[Math.max(1, Math.min(12, Number(value) || 1)) - 1];
}

function v40GenerateCipher(templateKey = rhwCommsState?.templateKey || 'formal') {
  const authorities = RHW_V40_CIPHER.authorities[templateKey] || RHW_V40_CIPHER.authorities.formal;
  const authority = v40Pick(authorities);
  const family = v40Pick(RHW_V40_CIPHER.families);
  const suite = v40Pick(RHW_V40_CIPHER.suites);
  const keyset = v40Pick(RHW_V40_CIPHER.keysets);
  const mark = v40Roman(2 + Math.floor(Math.random() * 9));
  const serial = String(1 + Math.floor(Math.random() * 98)).padStart(2, '0');
  return `${authority}/${family}-MK-${mark} // ${suite} // KEYSET ${keyset}-${serial}`;
}

function v40TemplateAccent(templateKey) {
  return appTemplate(templateKey)?.accent || RHW_APP_CONFIG.forum.brandColor;
}

function v40DefaultClassification(templateKey) {
  return appTemplate(templateKey)?.classification || 'RHW OFFICIAL';
}

function v40InlineBbcode(value) {
  return String(value || '').replace(/\*\*(.+?)\*\*/g, '[b]$1[/b]');
}

function v40BodyToBbcode(value, accent) {
  const lines = String(value || '').replace(/\r/g, '').split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('## ')) {
      return `[font=Agency FB][size=large][b][color=${accent}]${v40InlineBbcode(trimmed.slice(3))}[/color][/b][/size][/font]`;
    }
    if (/^!warning\s+/i.test(trimmed)) {
      return `[color=#c98b2c][b]WARNING //[/b] ${v40InlineBbcode(trimmed.replace(/^!warning\s+/i, ''))}[/color]`;
    }
    if (/^!status\s+/i.test(trimmed)) {
      return `[color=#78ad8a][b]STATUS //[/b] ${v40InlineBbcode(trimmed.replace(/^!status\s+/i, ''))}[/color]`;
    }
    if (/^-\s+/.test(trimmed)) {
      return `[b]•[/b] ${v40InlineBbcode(trimmed.replace(/^-\s+/, ''))}`;
    }
    return v40InlineBbcode(line);
  }).join('\n');
}

function v40InlinePreview(value) {
  return appEscape(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function v40BodyToPreview(value) {
  const lines = String(value || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(v40InlinePreview).join('<br>')}</p>`);
    paragraph = [];
  };
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { flush(); return; }
    if (trimmed.startsWith('## ')) {
      flush();
      blocks.push(`<h3>${v40InlinePreview(trimmed.slice(3))}</h3>`);
      return;
    }
    if (/^!warning\s+/i.test(trimmed)) {
      flush();
      blocks.push(`<div class="forum-preview-callout warning"><strong>WARNING //</strong> ${v40InlinePreview(trimmed.replace(/^!warning\s+/i, ''))}</div>`);
      return;
    }
    if (/^!status\s+/i.test(trimmed)) {
      flush();
      blocks.push(`<div class="forum-preview-callout status"><strong>STATUS //</strong> ${v40InlinePreview(trimmed.replace(/^!status\s+/i, ''))}</div>`);
      return;
    }
    if (/^-\s+/.test(trimmed)) {
      flush();
      blocks.push(`<div class="forum-preview-bullet"><b>•</b><span>${v40InlinePreview(trimmed.replace(/^-\s+/, ''))}</span></div>`);
      return;
    }
    paragraph.push(line);
  });
  flush();
  return blocks.join('');
}

/* -------------------------------------------------------------------------
   COMMS state extension: classification stays compatible with old V4 drafts.
   ------------------------------------------------------------------------- */
const v40BaseDefaultCommsState = appDefaultCommsState;
appDefaultCommsState = function() {
  const state = v40BaseDefaultCommsState();
  return { ...state, classification: v40DefaultClassification(state.templateKey) };
};

const v40BaseNormalizeCommsState = appNormalizeCommsState;
appNormalizeCommsState = function(raw) {
  const state = v40BaseNormalizeCommsState(raw);
  if (!state.classification) state.classification = v40DefaultClassification(state.templateKey);
  return state;
};

const v40BaseReadCommsForm = appReadCommsForm;
appReadCommsForm = function() {
  const state = v40BaseReadCommsForm();
  state.classification = document.getElementById('commsClassification')?.value || v40DefaultClassification(state.templateKey);
  return state;
};

const v40BaseApplyCommsState = appApplyCommsState;
appApplyCommsState = function(state, options = {}) {
  v40BaseApplyCommsState(state, options);
  const classification = document.getElementById('commsClassification');
  if (classification) classification.value = rhwCommsState?.classification || v40DefaultClassification(rhwCommsState?.templateKey);
  appRenderForumPreview();
  appRenderBbcode();
};

/* -------------------------------------------------------------------------
   Upgraded forum renderer: classification banner + lightweight smart markup.
   ------------------------------------------------------------------------- */
appBuildForumBbcode = function(state = rhwCommsState) {
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const template = appTemplate(state.templateKey);
  const accent = v40TemplateAccent(state.templateKey);
  const classification = state.classification?.trim() || v40DefaultClassification(state.templateKey);
  const recipient = state.recipient.trim();
  const location = state.location.trim();
  const encryption = state.encryption.trim();
  const subject = state.subject.trim();
  const body = v40BodyToBbcode(state.message.trim(), accent);
  const closing = state.closing.trim() || 'Yours faithfully,';
  const title = sender.title.trim();
  const systemDate = state.systemDate.trim() || 'UNSET';
  const footerMotto = state.footerMotto.trim() || f.footerMotto;

  return `[align=center]\n` +
`[img]${f.logoUrl}[/img]\n` +
`[size=xx-large][font=Agency FB][b][color=${f.brandColor}]${f.organisation}[/color][/b][/font][/size]\n` +
`[size=small][font=Consolas][color=${f.mutedColor}]${f.subline}[/color][/font][/size]\n` +
`[/align]\n\n` +
`[hrc]${f.brandColor}[/hrc]\n` +
`[align=center][font=Consolas][size=small][b][color=${accent}]/// ${classification} /// ${template.label} ///[/color][/b][/size][/font][/align]\n` +
`[hrc]${f.darkLineColor}[/hrc]\n\n` +
`[align=center]\n[table=${f.brandColor}]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]SENDER ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${sender.name}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]RECIPIENT ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${recipient}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]LOCATION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${location}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]ENCRYPTION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas][color=${accent}]${encryption}[/color][/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]SUBJECT:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas][b]${subject}[/b][/font][/td]\n[/tr]\n` +
`[/table]\n[/align]\n\n` +
`[hrc]${f.brandColor}[/hrc]\n[br]\n` +
`[pi amount=12][font=Tahoma][color=${f.textColor}]\n\n${body}\n\n[/color][/font][/pi]\n` +
`[br]\n[align=right]\n` +
`[font=Agency FB][size=large][i]${closing}[/i][/size][/font]\n` +
`[size=large][b][font=Agency FB][color=${f.brandColor}]${sender.name}[/color][/font][/b][/size]\n` +
`[font=Consolas][size=small][color=${f.mutedColor}]${title}[/color][/size][/font]\n` +
`[/align]\n\n[hrc]${f.darkLineColor}[/hrc]\n` +
`[align=center][font=Consolas][size=x-small][color=${f.footerColor}]\n${footerMotto}\n[RHW] SYSTEM TIME: ${systemDate}\n[/color][/size][/font][/align]`;
};

appRenderForumPreview = function(state = rhwCommsState) {
  const target = document.getElementById('forumLivePreview');
  if (!target || !state) return;
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const template = appTemplate(state.templateKey);
  const accent = v40TemplateAccent(state.templateKey);
  const classification = state.classification || v40DefaultClassification(state.templateKey);
  const rows = [
    ['SENDER ID', sender.name || '—'],
    ['RECIPIENT ID', state.recipient || '—'],
    ['LOCATION', state.location || '—'],
    ['ENCRYPTION', state.encryption || '—'],
    ['SUBJECT', state.subject || '—']
  ];
  target.style.setProperty('--comms-accent', accent);
  target.innerHTML = `
    <div class="forum-preview-identity">
      <img src="${appEscape(f.logoUrl)}" alt="" loading="lazy" />
      <div class="forum-preview-title">${appEscape(f.organisation)}</div>
      <div class="forum-preview-subline">${appEscape(f.subline)}</div>
      <div class="forum-preview-classification">/// ${appEscape(classification)} /// ${appEscape(template.label)} ///</div>
    </div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-meta">
      ${rows.map(([label, value], index) => `<div class="forum-preview-meta-row"><strong>${label}:</strong><span class="${index === 3 ? 'encryption' : ''}">${appEscape(value)}</span></div>`).join('')}
    </div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-body">${state.message.trim() ? v40BodyToPreview(state.message.trim()) : '<span class="preview-placeholder">AWAITING TRANSMISSION BODY</span>'}</div>
    <div class="forum-preview-signature">
      <em>${appEscape(state.closing || 'Yours faithfully,')}</em>
      <strong>${appEscape(sender.name)}</strong>
      <small>${appEscape(sender.title)}</small>
    </div>
    <div class="forum-preview-footer">
      <span>${appEscape(state.footerMotto || f.footerMotto)}</span>
      <span>[RHW] SYSTEM TIME: ${appEscape(state.systemDate || 'UNSET')}</span>
    </div>`;
};

function v40InstallComposerEnhancements() {
  const form = document.getElementById('commsForm');
  const encryption = document.getElementById('commsEncryption');
  if (!form || !encryption || document.getElementById('randomizeCipherBtn')) return;

  const encryptionField = encryption.closest('.comms-field');
  const encryptionLabel = encryptionField?.querySelector(':scope > span');
  if (encryptionLabel) encryptionLabel.textContent = 'ENCRYPTION';
  if (encryptionField) {
    const wrap = document.createElement('div');
    wrap.className = 'comms-inline-control';
    encryption.insertAdjacentElement('beforebegin', wrap);
    wrap.appendChild(encryption);
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'randomizeCipherBtn';
    button.className = 'comms-mini-action';
    button.textContent = '↻ ROLL CIPHER';
    button.title = 'Generate an in-universe encryption designation. This labels the RP transmission; it does not cryptographically encrypt the forum post.';
    wrap.appendChild(button);
    const hint = document.createElement('small');
    hint.textContent = 'RP CIPHER DESIGNATION // DOES NOT ENCRYPT THE POST';
    encryptionField.appendChild(hint);
    button.addEventListener('click', () => {
      encryption.value = v40GenerateCipher(document.getElementById('commsTemplate')?.value);
      appSyncFromForm();
      appNotify('NEW CIPHER DESIGNATION ISSUED');
    });
  }

  const templateField = document.getElementById('commsTemplate')?.closest('.comms-field');
  if (templateField) {
    const classification = document.createElement('label');
    classification.className = 'comms-field';
    classification.innerHTML = `<span>CLASSIFICATION</span><select id="commsClassification">${RHW_V40_CLASSIFICATIONS.map(value => `<option value="${appEscape(value)}">${appEscape(value)}</option>`).join('')}</select><small>CONTROLS THE TRANSMISSION SECURITY BANNER</small>`;
    templateField.insertAdjacentElement('afterend', classification);
  }

  const messageField = document.getElementById('commsMessage')?.closest('.message-field');
  const messageHint = messageField?.querySelector('small');
  if (messageHint) messageHint.textContent = 'SMART MARKUP: ## HEADING · **BOLD** · !WARNING · !STATUS · - LIST ITEM';

  const templateSelect = document.getElementById('commsTemplate');
  templateSelect?.addEventListener('change', () => {
    const classification = document.getElementById('commsClassification');
    if (classification) classification.value = v40DefaultClassification(templateSelect.value);
    appSyncFromForm();
  });

  const current = appNormalizeCommsState(rhwCommsState || appDefaultCommsState());
  if (!current.classification) current.classification = v40DefaultClassification(current.templateKey);
  appApplyCommsState(current, { persist: true });
}

/* -------------------------------------------------------------------------
   Command node navigation.
   ------------------------------------------------------------------------- */
function v40NodeButtonMarkup(nodes, attr) {
  return nodes.map(([key, label, sub]) => `<button type="button" ${attr}="${key}"><span>${label}</span><small>${sub}</small></button>`).join('');
}

function v40OverviewMarkup() {
  return `<section class="command-overview-panel">
    <div class="command-overview-heading">
      <div><span>COMMAND / OVERVIEW</span><h2>EXECUTIVE STATUS BOARD</h2><p>ONE SCREEN // FACILITY, INVENTORY, YARD, PRODUCTION AND SUPPLY READINESS</p></div>
      <div class="command-overview-live"><i></i> LIVE TELEMETRY</div>
    </div>
    <div class="command-overview-grid">
      <button type="button" class="command-overview-card" data-command-jump="inventory"><small>FACILITY + INVENTORY</small><strong id="v40OverviewInventory">SCANNING</strong><span id="v40OverviewInventoryMeta">AWAITING STATUS</span></button>
      <button type="button" class="command-overview-card" data-command-jump="shipyard"><small>CAPITAL SHIPYARD</small><strong id="v40OverviewShipyard">SCANNING</strong><span id="v40OverviewShipyardMeta">AWAITING YARD CONTROL</span></button>
      <button type="button" class="command-overview-card" data-command-jump="production"><small>PRODUCTION</small><strong id="v40OverviewProduction">SCANNING</strong><span id="v40OverviewProductionMeta">AWAITING MODULE DATA</span></button>
      <button type="button" class="command-overview-card" data-command-jump="logistics"><small>REMOTE LOGISTICS</small><strong id="v40OverviewLogistics">SCANNING</strong><span id="v40OverviewLogisticsMeta">AWAITING SAT-LINK</span></button>
      <button type="button" class="command-overview-card command-overview-card-wide" data-command-jump="inventory"><small>LOCAL MANIFEST</small><strong id="v40OverviewManifest">SCANNING</strong><span id="v40OverviewManifestMeta">AWAITING ASSET REGISTRY</span></button>
    </div>
  </section>`;
}

function v40InstallCommandNodes() {
  const workspace = document.getElementById('workspaceCommand');
  const strip = document.getElementById('commandStrip');
  const main = workspace?.querySelector('main');
  if (!workspace || !strip || !main || document.getElementById('commandNodeNav')) return;

  const nav = document.createElement('nav');
  nav.id = 'commandNodeNav';
  nav.className = 'workspace-subnav command-subnav';
  nav.setAttribute('aria-label', 'Command sections');
  nav.innerHTML = `<div class="workspace-subnav-label">COMMAND NODES</div><div class="workspace-subnav-tabs">${v40NodeButtonMarkup(RHW_V40_COMMAND_NODES, 'data-command-node')}</div>`;
  strip.insertAdjacentElement('afterend', nav);

  const host = document.createElement('div');
  host.id = 'commandNodeHost';
  host.className = 'command-node-host';
  main.prepend(host);

  const panels = {};
  RHW_V40_COMMAND_NODES.forEach(([key]) => {
    const panel = document.createElement('section');
    panel.className = 'command-node-panel';
    panel.dataset.commandPanel = key;
    panel.hidden = true;
    host.appendChild(panel);
    panels[key] = panel;
  });
  panels.overview.innerHTML = v40OverviewMarkup();

  const summary = main.querySelector('.summary-grid');
  const manifest = main.querySelector('.manifest-panel');
  const shipyard = document.getElementById('shipyardControl');
  const production = document.getElementById('productionPanel');
  const logistics = document.getElementById('externalLogisticsPanel');
  if (summary) panels.inventory.appendChild(summary);
  if (manifest) panels.inventory.appendChild(manifest);
  if (shipyard) panels.shipyard.appendChild(shipyard);
  if (production) panels.production.appendChild(production);
  if (logistics) panels.logistics.appendChild(logistics);

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-command-node]');
    if (button) v40ActivateCommandNode(button.dataset.commandNode);
  });
  panels.overview.addEventListener('click', event => {
    const card = event.target.closest('[data-command-jump]');
    if (card) v40ActivateCommandNode(card.dataset.commandJump);
  });
}

function v40UpdateCommandOverview() {
  if (!document.getElementById('v40OverviewInventory')) return;
  const maintenance = document.getElementById('maintenanceCount')?.textContent?.trim() || '0';
  const exports = document.getElementById('exportCount')?.textContent?.trim() || '0';
  const feedstock = document.getElementById('feedstockCount')?.textContent?.trim() || '0';
  const shipyardBadge = document.querySelector('#shipyardControl .shipyard-summary-badge')?.textContent?.trim();
  const productionCount = document.querySelectorAll('#productionGrid .production-card').length;
  const logisticsState = document.getElementById('supplierLinkText')?.textContent?.trim();
  const marketState = document.getElementById('marketScanMeta')?.textContent?.trim();
  const manifestRows = document.querySelectorAll('#itemsBody tr').length;

  document.getElementById('v40OverviewInventory').textContent = `${maintenance} FACILITY FLAGS`;
  document.getElementById('v40OverviewInventoryMeta').textContent = `${exports} EXPORT ASSETS // ${feedstock} FEEDSTOCK LINES`;
  document.getElementById('v40OverviewShipyard').textContent = shipyardBadge || 'YARD ONLINE';
  document.getElementById('v40OverviewShipyardMeta').textContent = 'OPEN CAPITAL SHIPYARD CONTROL';
  document.getElementById('v40OverviewProduction').textContent = productionCount ? `${productionCount} MODULES` : 'SCANNING';
  document.getElementById('v40OverviewProductionMeta').textContent = 'LIVE CAPACITY + BOTTLENECK CONTROL';
  document.getElementById('v40OverviewLogistics').textContent = logisticsState || 'SAT-LINK SCANNING';
  document.getElementById('v40OverviewLogisticsMeta').textContent = marketState || 'REMOTE SUPPLY + MARKET RADAR';
  document.getElementById('v40OverviewManifest').textContent = manifestRows ? `${manifestRows} ASSET LINES` : 'SCANNING';
  document.getElementById('v40OverviewManifestMeta').textContent = 'SEARCHABLE LOCAL STOCK REGISTRY';
}

function v40ActivateCommandNode(node, { updateHash = true } = {}) {
  const valid = RHW_V40_COMMAND_NODES.some(([key]) => key === node) ? node : 'overview';
  safeStorageSet(RHW_V40_NODE_KEYS.command, valid);
  document.body.dataset.commandNode = valid;
  document.querySelectorAll('[data-command-panel]').forEach(panel => { panel.hidden = panel.dataset.commandPanel !== valid; });
  document.querySelectorAll('[data-command-node]').forEach(button => {
    const active = button.dataset.commandNode === valid;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (rhwActiveWorkspace === 'command') {
    v40SetActiveNode(`COMMAND / ${valid.toUpperCase()}`);
    document.title = `RHW ${valid.toUpperCase()} · ${RHW_APP_VERSION}`;
    if (updateHash) v40WriteRoute('command', valid);
  }
  if (valid === 'overview') v40UpdateCommandOverview();
}

/* -------------------------------------------------------------------------
   COMMS nodes: forum, newswire, drafts, senders.
   ------------------------------------------------------------------------- */
function v40NewswireMarkup() {
  return `<section class="comms-panel v40-tool-panel">
    <div class="comms-panel-head"><div><span>NW</span><strong>RHW NEWSWIRE GENERATOR</strong></div><small>RHW_NEWSWIRE.MD FORMAT</small></div>
    <div class="v40-tool-grid">
      <label class="comms-field"><span>CATEGORY</span><select id="v40NewswireCategory"><option value="market">MARKET</option><option value="regional">REGIONAL</option><option value="security">SECURITY</option><option value="operations">OPERATIONS</option><option value="corporate">CORPORATE</option></select></label>
      <label class="comms-field"><span>TONE</span><select id="v40NewswireTone"><option value="good">GOOD</option><option value="warn">WARN</option><option value="danger">DANGER</option><option value="remote">REMOTE</option><option value="lore">LORE</option><option value="muted">MUTED</option></select></label>
      <label class="comms-field"><span>TAG</span><input id="v40NewswireTag" type="text" maxlength="50" value="RHW OPERATIONS" /></label>
      <label class="comms-field comms-wide"><span>MESSAGE</span><textarea id="v40NewswireMessage" rows="5" maxlength="500" placeholder="Transmission headline..."></textarea></label>
    </div>
    <div class="v40-generated-block"><small>READY-TO-PASTE MARKDOWN</small><textarea id="v40NewswireOutput" readonly spellcheck="false"></textarea></div>
    <div class="comms-actions"><button class="comms-primary" type="button" id="v40CopyNewswireBtn"><span>COPY NEWSWIRE BLOCK</span></button></div>
  </section>`;
}

function v40SendersMarkup() {
  return `<section class="comms-panel v40-tool-panel">
    <div class="comms-panel-head"><div><span>ID</span><strong>SENDER IDENTITY REGISTRY</strong></div><small>BUILT-IN + LOCAL PROFILES</small></div>
    <div class="sender-registry-intro">CHARACTER PROFILES SUPPLY DEFAULT SIGNATURE, LOCATION AND CIPHER DATA TO THE FORUM COMPOSER.</div>
    <div id="v40SenderRegistry" class="sender-registry"></div>
    <div class="comms-actions"><button class="comms-primary" type="button" id="v40CreateSenderBtn"><span>CREATE LOCAL SENDER</span></button></div>
  </section>`;
}

function v40InstallCommsNodes() {
  const frame = document.querySelector('.comms-frame');
  const heading = frame?.querySelector('.workspace-heading');
  if (!frame || !heading || document.getElementById('commsNodeNav')) return;

  const nav = document.createElement('nav');
  nav.id = 'commsNodeNav';
  nav.className = 'workspace-subnav comms-subnav';
  nav.setAttribute('aria-label', 'Communications tools');
  nav.innerHTML = `<div class="workspace-subnav-label">COMMS NODES</div><div class="workspace-subnav-tabs">${v40NodeButtonMarkup(RHW_V40_COMMS_NODES, 'data-comms-node')}</div>`;
  heading.insertAdjacentElement('afterend', nav);

  const host = document.createElement('div');
  host.id = 'commsNodeHost';
  host.className = 'comms-node-host';
  nav.insertAdjacentElement('afterend', host);

  const panels = {};
  RHW_V40_COMMS_NODES.forEach(([key]) => {
    const panel = document.createElement('section');
    panel.className = 'comms-node-panel';
    panel.dataset.commsPanel = key;
    panel.hidden = true;
    host.appendChild(panel);
    panels[key] = panel;
  });

  const grid = frame.querySelector('.comms-grid');
  const bbcode = frame.querySelector('.bbcode-panel');
  const drafts = frame.querySelector('.drafts-panel');
  if (grid) panels.forum.appendChild(grid);
  if (bbcode) panels.forum.appendChild(bbcode);
  if (drafts) panels.drafts.appendChild(drafts);
  panels.newswire.innerHTML = v40NewswireMarkup();
  panels.senders.innerHTML = v40SendersMarkup();

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-comms-node]');
    if (button) v40ActivateCommsNode(button.dataset.commsNode);
  });

  panels.drafts.addEventListener('click', event => {
    if (!event.target.closest('[data-load-draft]')) return;
    setTimeout(() => {
      v40ActivateCommsNode('forum');
      document.getElementById('commsComposerPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  });

  v40BindNewswireTool();
  v40BindSenderRegistry();
  v40RenderSenderRegistry();
}

function v40ActivateCommsNode(node, { updateHash = true } = {}) {
  const valid = RHW_V40_COMMS_NODES.some(([key]) => key === node) ? node : 'forum';
  safeStorageSet(RHW_V40_NODE_KEYS.comms, valid);
  document.body.dataset.commsNode = valid;
  document.querySelectorAll('[data-comms-panel]').forEach(panel => { panel.hidden = panel.dataset.commsPanel !== valid; });
  document.querySelectorAll('[data-comms-node]').forEach(button => {
    const active = button.dataset.commsNode === valid;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (valid === 'senders') v40RenderSenderRegistry();
  if (rhwActiveWorkspace === 'comms') {
    v40SetActiveNode(`COMMS / ${valid.toUpperCase()}`);
    document.title = `RHW COMMS ${valid.toUpperCase()} · ${RHW_APP_VERSION}`;
    if (updateHash) v40WriteRoute('comms', valid);
  }
}

function v40RenderNewswire() {
  const category = document.getElementById('v40NewswireCategory')?.value || 'operations';
  const tone = document.getElementById('v40NewswireTone')?.value || 'good';
  const tag = document.getElementById('v40NewswireTag')?.value.trim() || 'RHW NEWSWIRE';
  const message = document.getElementById('v40NewswireMessage')?.value.trim() || 'AWAITING BULLETIN';
  const output = document.getElementById('v40NewswireOutput');
  if (output) output.value = `## ${category}\n- [${tag} | ${tone}] ${message}`;
  safeStorageSet(RHW_V40_NODE_KEYS.newswire, { category, tone, tag, message });
}

function v40BindNewswireTool() {
  const panel = document.querySelector('[data-comms-panel="newswire"]');
  if (!panel) return;
  const saved = safeStorageGet(RHW_V40_NODE_KEYS.newswire, {});
  ['Category', 'Tone', 'Tag', 'Message'].forEach(name => {
    const input = document.getElementById(`v40Newswire${name}`);
    const key = name.toLowerCase();
    if (input && typeof saved?.[key] === 'string') input.value = saved[key];
    input?.addEventListener('input', v40RenderNewswire);
    input?.addEventListener('change', v40RenderNewswire);
  });
  document.getElementById('v40CopyNewswireBtn')?.addEventListener('click', async () => {
    const output = document.getElementById('v40NewswireOutput');
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output.value);
      appNotify('NEWSWIRE BLOCK COPIED');
    } catch (error) {
      output.focus(); output.select(); document.execCommand?.('copy');
      appNotify('NEWSWIRE BLOCK SELECTED // COPY MANUALLY', 'warn');
    }
  });
  v40RenderNewswire();
}

function v40RenderSenderRegistry() {
  const target = document.getElementById('v40SenderRegistry');
  if (!target) return;
  const profiles = [
    ...RHW_APP_CONFIG.senders.map(sender => ({ ...sender, source: 'BUILT-IN' })),
    ...rhwLocalSenders.map(sender => ({ ...sender, source: 'LOCAL' }))
  ];
  target.innerHTML = profiles.map(sender => `<article class="sender-registry-card">
    <div class="sender-registry-head"><div><small>${appEscape(sender.source)}</small><strong>${appEscape(sender.name)}</strong></div><span>${appEscape(sender.source === 'LOCAL' ? 'LOCAL CACHE' : 'RHW REGISTRY')}</span></div>
    <dl><div><dt>ROLE</dt><dd>${appEscape(sender.title || '—')}</dd></div><div><dt>LOCATION</dt><dd>${appEscape(sender.location || '—')}</dd></div><div><dt>DEFAULT CIPHER</dt><dd>${appEscape(sender.encryption || '—')}</dd></div><div><dt>SIGN-OFF</dt><dd>${appEscape(sender.closing || '—')}</dd></div></dl>
    <div class="sender-registry-actions"><button type="button" data-use-sender="${appEscape(sender.key)}">USE IN COMPOSER</button>${sender.source === 'LOCAL' ? `<button type="button" data-remove-registry-sender="${appEscape(sender.key)}">REMOVE</button>` : ''}</div>
  </article>`).join('');
}

function v40UseSenderInComposer(key) {
  const sender = appSenderByKey(key);
  if (!sender) return;
  const state = appReadCommsForm();
  state.senderKey = sender.key;
  state.location = sender.location || '';
  state.encryption = sender.encryption || '';
  state.closing = sender.closing || 'Yours faithfully,';
  state.signatureTitle = sender.title || '';
  appApplyCommsState(state, { persist: true });
  v40ActivateCommsNode('forum');
  appNotify(`SENDER ACTIVE // ${sender.name.toUpperCase()}`);
}

function v40RemoveRegistrySender(key) {
  const sender = rhwLocalSenders.find(entry => entry.key === key);
  if (!sender || !window.confirm(`Remove local sender profile “${sender.name}”?`)) return;
  rhwLocalSenders = rhwLocalSenders.filter(entry => entry.key !== key);
  safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);
  if (rhwCommsState?.senderKey === key) {
    const fallback = RHW_APP_CONFIG.senders[0];
    appApplyCommsState({ ...rhwCommsState, senderKey: fallback.key, location: fallback.location, encryption: fallback.encryption, closing: fallback.closing, signatureTitle: fallback.title }, { persist: true });
  }
  v40RenderSenderRegistry();
  appRefreshSenderSelect(rhwCommsState?.senderKey);
  appNotify('LOCAL SENDER PROFILE REMOVED', 'warn');
}

function v40BindSenderRegistry() {
  const panel = document.querySelector('[data-comms-panel="senders"]');
  if (!panel) return;
  panel.addEventListener('click', event => {
    const use = event.target.closest('[data-use-sender]');
    const remove = event.target.closest('[data-remove-registry-sender]');
    if (use) v40UseSenderInComposer(use.dataset.useSender);
    if (remove) v40RemoveRegistrySender(remove.dataset.removeRegistrySender);
  });
  document.getElementById('v40CreateSenderBtn')?.addEventListener('click', () => {
    const state = appReadCommsForm();
    state.senderKey = '__custom__';
    state.customSenderName = '';
    state.signatureTitle = '';
    appApplyCommsState(state, { persist: true });
    v40ActivateCommsNode('forum');
    setTimeout(() => document.getElementById('customSenderName')?.focus(), 0);
  });
}

/* -------------------------------------------------------------------------
   Route model: #command/overview and #comms/forum.
   ------------------------------------------------------------------------- */
function v40ParseRoute() {
  const parts = location.hash.replace(/^#/, '').toLowerCase().split('/').filter(Boolean);
  const workspace = ['command', 'comms'].includes(parts[0]) ? parts[0] : null;
  return { workspace, node: parts[1] || null };
}

function v40WriteRoute(workspace, node) {
  const next = `#${workspace}/${node}`;
  if (location.hash !== next) history.replaceState(null, '', next);
}

function v40SetActiveNode(value) {
  const target = document.getElementById('appActiveNode');
  if (target) target.textContent = `ACTIVE NODE: ${value}`;
}

function v40InstallActiveNodeDisplay() {
  const brand = document.querySelector('.app-nav-brand > div');
  if (!brand || document.getElementById('appActiveNode')) return;
  const active = document.createElement('small');
  active.id = 'appActiveNode';
  active.className = 'app-active-node';
  active.textContent = 'ACTIVE NODE: COMMAND / OVERVIEW';
  brand.appendChild(active);
}

const v40BaseWorkspaceFromHash = appWorkspaceFromHash;
appWorkspaceFromHash = function() {
  return v40ParseRoute().workspace || v40BaseWorkspaceFromHash();
};

const v40BaseActivateWorkspace = appActivateWorkspace;
appActivateWorkspace = function(workspace, { updateHash = true } = {}) {
  const safeWorkspace = ['command', 'comms'].includes(workspace) ? workspace : 'command';
  v40BaseActivateWorkspace(safeWorkspace, { updateHash: false });
  const route = v40ParseRoute();
  if (safeWorkspace === 'command') {
    const node = route.workspace === 'command' && route.node
      ? route.node
      : safeStorageGet(RHW_V40_NODE_KEYS.command, 'overview');
    v40ActivateCommandNode(node, { updateHash: false });
    if (updateHash) v40WriteRoute('command', document.body.dataset.commandNode || 'overview');
  } else {
    const node = route.workspace === 'comms' && route.node
      ? route.node
      : safeStorageGet(RHW_V40_NODE_KEYS.comms, 'forum');
    v40ActivateCommsNode(node, { updateHash: false });
    if (updateHash) v40WriteRoute('comms', document.body.dataset.commsNode || 'forum');
  }
};

function v40InstallNavigationEnhancements() {
  v40InstallActiveNodeDisplay();
  v40InstallCommandNodes();
  v40InstallCommsNodes();
  v40InstallComposerEnhancements();

  setInterval(v40UpdateCommandOverview, 1500);
  document.getElementById('saveSenderBtn')?.addEventListener('click', () => setTimeout(v40RenderSenderRegistry, 0));

  const route = v40ParseRoute();
  const workspace = route.workspace || rhwActiveWorkspace || 'command';
  appActivateWorkspace(workspace, { updateHash: true });
}

function v40LoadEnhancementStyles() {
  if (document.querySelector('link[data-rhw-v40-nodes]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './css/13-app-v40-navigation.css';
  link.dataset.rhwV40Nodes = 'true';
  document.head.appendChild(link);
}

v40LoadEnhancementStyles();
v40InstallNavigationEnhancements();
