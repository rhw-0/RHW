/* ==========================================================================
   RHW WEB APP · V4.0 PREVIEW
   Application shell + COMMS forum transmission composer.
   ========================================================================== */

const RHW_APP_KEYS = RHW_APP_CONFIG.storageKeys;
let rhwActiveWorkspace = 'command';
let rhwCommsState = null;
let rhwCommsDrafts = [];
let rhwLocalSenders = [];
let rhwCommsAutosaveTimer = null;
let rhwCommsStatusTimer = null;

function appEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function appPlainTextHtml(value) {
  return appEscape(value).replace(/\r?\n/g, '<br>');
}

function appUid(prefix = 'rhw') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appReadArray(key) {
  const value = safeStorageGet(key, []);
  return Array.isArray(value) ? value : [];
}

function appNotify(message, tone = 'good') {
  const status = document.getElementById('commsStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
  clearTimeout(rhwCommsStatusTimer);
  rhwCommsStatusTimer = setTimeout(() => {
    status.textContent = 'LOCAL COMMAND CACHE READY';
    status.dataset.tone = 'muted';
  }, 2600);
}

function appTemplate(key) {
  return RHW_APP_CONFIG.templates.find(entry => entry.key === key) || RHW_APP_CONFIG.templates[0];
}

function appSenderByKey(key) {
  const builtIn = RHW_APP_CONFIG.senders.find(entry => entry.key === key);
  if (builtIn) return { ...builtIn, source: 'built-in' };
  const local = rhwLocalSenders.find(entry => entry.key === key);
  return local ? { ...local, source: 'local' } : null;
}

function appDefaultCommsState() {
  const sender = RHW_APP_CONFIG.senders[0];
  const template = RHW_APP_CONFIG.templates[0];
  return {
    templateKey: template.key,
    senderKey: sender.key,
    customSenderName: '',
    recipient: template.recipient || '',
    location: sender.location || '',
    encryption: sender.encryption || template.encryption || '',
    subject: '',
    message: '',
    closing: sender.closing || 'Yours faithfully,',
    signatureTitle: sender.title || '',
    systemDate: '',
    draftName: '',
    footerMotto: RHW_APP_CONFIG.forum.footerMotto
  };
}

function appNormalizeCommsState(raw) {
  const fallback = appDefaultCommsState();
  if (!raw || typeof raw !== 'object') return fallback;
  return {
    ...fallback,
    ...Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'string'))
  };
}

function appResolvedSender(state = rhwCommsState) {
  if (!state) return { name: '', title: '' };
  if (state.senderKey === '__custom__') {
    return {
      name: state.customSenderName.trim() || 'UNASSIGNED SENDER',
      title: state.signatureTitle.trim()
    };
  }
  const sender = appSenderByKey(state.senderKey);
  return {
    name: sender?.name || 'UNASSIGNED SENDER',
    title: state.signatureTitle.trim() || sender?.title || ''
  };
}

function appBuildForumBbcode(state = rhwCommsState) {
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const recipient = state.recipient.trim();
  const location = state.location.trim();
  const encryption = state.encryption.trim();
  const subject = state.subject.trim();
  const body = state.message.trim();
  const closing = state.closing.trim() || 'Yours faithfully,';
  const title = sender.title.trim();
  const systemDate = state.systemDate.trim() || 'UNSET';
  const footerMotto = state.footerMotto.trim() || f.footerMotto;

  return `[align=center]\n` +
`[img]${f.logoUrl}[/img]\n` +
`[size=xx-large][font=Agency FB][b][color=${f.brandColor}]${f.organisation}[/color][/b][/font][/size]\n` +
`[size=small][font=Consolas][color=${f.mutedColor}]${f.subline}[/color][/font][/size]\n` +
`[/align]\n\n` +
`[hrc]${f.brandColor}[/hrc]\n\n` +
`[align=center]\n` +
`[table=${f.brandColor}]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]SENDER ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${sender.name}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]RECIPIENT ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${recipient}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]LOCATION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${location}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]ENCRYPTION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas][color=${f.dangerColor}]${encryption}[/color][/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]SUBJECT:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas][b]${subject}[/b][/font][/td]\n[/tr]\n` +
`[/table]\n[/align]\n\n` +
`[hrc]${f.brandColor}[/hrc]\n[br]\n` +
`[pi amount=12][font=Tahoma][color=${f.textColor}]\n\n${body}\n\n[/color][/font][/pi]\n` +
`[br]\n` +
`[align=right]\n` +
`[font=Agency FB][size=large][i]${closing}[/i][/size][/font]\n` +
`[size=large][b][font=Agency FB][color=${f.brandColor}]${sender.name}[/color][/font][/b][/size]\n` +
`[font=Consolas][size=small][color=${f.mutedColor}]${title}[/color][/size][/font]\n` +
`[/align]\n\n` +
`[hrc]${f.darkLineColor}[/hrc]\n` +
`[align=center][font=Consolas][size=x-small][color=${f.footerColor}]\n` +
`${footerMotto}\n` +
`[RHW] SYSTEM TIME: ${systemDate}\n` +
`[/color][/size][/font][/align]`;
}

function appRenderForumPreview(state = rhwCommsState) {
  const target = document.getElementById('forumLivePreview');
  if (!target || !state) return;
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const template = appTemplate(state.templateKey);
  const rows = [
    ['SENDER ID', sender.name || '—'],
    ['RECIPIENT ID', state.recipient || '—'],
    ['LOCATION', state.location || '—'],
    ['ENCRYPTION', state.encryption || '—'],
    ['SUBJECT', state.subject || '—']
  ];

  target.innerHTML = `
    <div class="forum-preview-identity">
      <img src="${appEscape(f.logoUrl)}" alt="" loading="lazy" />
      <div class="forum-preview-title">${appEscape(f.organisation)}</div>
      <div class="forum-preview-subline">${appEscape(f.subline)}</div>
      <div class="forum-preview-template">${appEscape(template.label)}</div>
    </div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-meta">
      ${rows.map(([label, value], index) => `<div class="forum-preview-meta-row"><strong>${label}:</strong><span class="${index === 3 ? 'encryption' : ''}">${appEscape(value)}</span></div>`).join('')}
    </div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-body">${state.message.trim() ? appPlainTextHtml(state.message.trim()) : '<span class="preview-placeholder">AWAITING TRANSMISSION BODY</span>'}</div>
    <div class="forum-preview-signature">
      <em>${appEscape(state.closing || 'Yours faithfully,')}</em>
      <strong>${appEscape(sender.name)}</strong>
      <small>${appEscape(sender.title)}</small>
    </div>
    <div class="forum-preview-footer">
      <span>${appEscape(state.footerMotto || f.footerMotto)}</span>
      <span>[RHW] SYSTEM TIME: ${appEscape(state.systemDate || 'UNSET')}</span>
    </div>`;
}

function appRenderBbcode(state = rhwCommsState) {
  const output = document.getElementById('forumBbcodeOutput');
  if (!output || !state) return;
  output.value = appBuildForumBbcode(state);
}

function appSaveCurrentState() {
  if (!rhwCommsState) return;
  safeStorageSet(RHW_APP_KEYS.commsCurrent, rhwCommsState);
}

function appScheduleAutosave() {
  clearTimeout(rhwCommsAutosaveTimer);
  rhwCommsAutosaveTimer = setTimeout(appSaveCurrentState, 350);
}

function appSenderOptionsMarkup() {
  const builtIn = RHW_APP_CONFIG.senders.map(sender => `<option value="${appEscape(sender.key)}">${appEscape(sender.name)} · BUILT-IN</option>`).join('');
  const locals = rhwLocalSenders.map(sender => `<option value="${appEscape(sender.key)}">${appEscape(sender.name)} · LOCAL</option>`).join('');
  return `${builtIn}${locals}<option value="__custom__">CUSTOM / TEMPORARY SENDER…</option>`;
}

function appRefreshSenderSelect(selectedKey = rhwCommsState?.senderKey) {
  const select = document.getElementById('commsSender');
  if (!select) return;
  select.innerHTML = appSenderOptionsMarkup();
  const exists = [...select.options].some(option => option.value === selectedKey);
  select.value = exists ? selectedKey : RHW_APP_CONFIG.senders[0].key;
}

function appToggleSenderControls() {
  const senderKey = document.getElementById('commsSender')?.value;
  const customWrap = document.getElementById('customSenderWrap');
  const saveButton = document.getElementById('saveSenderBtn');
  const removeButton = document.getElementById('removeSenderBtn');
  if (customWrap) customWrap.hidden = senderKey !== '__custom__';
  if (saveButton) saveButton.hidden = senderKey !== '__custom__';
  if (removeButton) removeButton.hidden = !rhwLocalSenders.some(sender => sender.key === senderKey);
}

function appApplyCommsState(state, { persist = false } = {}) {
  rhwCommsState = appNormalizeCommsState(state);
  appRefreshSenderSelect(rhwCommsState.senderKey);

  const map = {
    commsTemplate: 'templateKey', commsSender: 'senderKey', customSenderName: 'customSenderName',
    commsRecipient: 'recipient', commsLocation: 'location', commsEncryption: 'encryption',
    commsSubject: 'subject', commsMessage: 'message', commsClosing: 'closing',
    commsSignatureTitle: 'signatureTitle', commsSystemDate: 'systemDate',
    commsDraftName: 'draftName', commsFooterMotto: 'footerMotto'
  };
  Object.entries(map).forEach(([id, key]) => {
    const input = document.getElementById(id);
    if (input) input.value = rhwCommsState[key] ?? '';
  });

  const subject = document.getElementById('commsSubject');
  if (subject) subject.placeholder = appTemplate(rhwCommsState.templateKey).subjectPlaceholder;
  appToggleSenderControls();
  appRenderForumPreview();
  appRenderBbcode();
  if (persist) appSaveCurrentState();
}

function appReadCommsForm() {
  const value = id => document.getElementById(id)?.value ?? '';
  return appNormalizeCommsState({
    templateKey: value('commsTemplate'),
    senderKey: value('commsSender'),
    customSenderName: value('customSenderName'),
    recipient: value('commsRecipient'),
    location: value('commsLocation'),
    encryption: value('commsEncryption'),
    subject: value('commsSubject'),
    message: value('commsMessage'),
    closing: value('commsClosing'),
    signatureTitle: value('commsSignatureTitle'),
    systemDate: value('commsSystemDate'),
    draftName: value('commsDraftName'),
    footerMotto: value('commsFooterMotto')
  });
}

function appSyncFromForm() {
  rhwCommsState = appReadCommsForm();
  appToggleSenderControls();
  appRenderForumPreview();
  appRenderBbcode();
  appScheduleAutosave();
}

function appHandleTemplateChange() {
  const previous = appTemplate(rhwCommsState?.templateKey);
  const nextKey = document.getElementById('commsTemplate')?.value || RHW_APP_CONFIG.templates[0].key;
  const next = appTemplate(nextKey);
  const recipient = document.getElementById('commsRecipient');
  const encryption = document.getElementById('commsEncryption');
  const subject = document.getElementById('commsSubject');

  if (recipient && (!recipient.value.trim() || recipient.value === previous.recipient)) recipient.value = next.recipient || '';
  if (encryption && (!encryption.value.trim() || encryption.value === previous.encryption)) encryption.value = next.encryption || '';
  if (subject) subject.placeholder = next.subjectPlaceholder;
  appSyncFromForm();
}

function appHandleSenderChange() {
  const key = document.getElementById('commsSender')?.value;
  const sender = appSenderByKey(key);
  if (sender) {
    const location = document.getElementById('commsLocation');
    const encryption = document.getElementById('commsEncryption');
    const closing = document.getElementById('commsClosing');
    const title = document.getElementById('commsSignatureTitle');
    if (location) location.value = sender.location || '';
    if (encryption) encryption.value = sender.encryption || '';
    if (closing) closing.value = sender.closing || 'Yours faithfully,';
    if (title) title.value = sender.title || '';
  }
  appSyncFromForm();
}

function appSaveLocalSender() {
  const state = appReadCommsForm();
  const name = state.customSenderName.trim();
  if (!name) { appNotify('ENTER A SENDER NAME FIRST', 'warn'); return; }
  const existingIndex = rhwLocalSenders.findIndex(sender => normalize(sender.name) === normalize(name));
  const profile = {
    key: existingIndex >= 0 ? rhwLocalSenders[existingIndex].key : appUid('local-sender'),
    name,
    title: state.signatureTitle.trim(),
    location: state.location.trim(),
    encryption: state.encryption.trim(),
    closing: state.closing.trim() || 'Yours faithfully,'
  };
  if (existingIndex >= 0) rhwLocalSenders[existingIndex] = profile;
  else rhwLocalSenders.push(profile);
  safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);
  state.senderKey = profile.key;
  appApplyCommsState(state, { persist: true });
  appNotify('LOCAL SENDER PROFILE SAVED');
}

function appRemoveLocalSender() {
  const key = document.getElementById('commsSender')?.value;
  const sender = rhwLocalSenders.find(entry => entry.key === key);
  if (!sender) return;
  if (!window.confirm(`Remove local sender profile “${sender.name}”?`)) return;
  rhwLocalSenders = rhwLocalSenders.filter(entry => entry.key !== key);
  safeStorageSet(RHW_APP_KEYS.localSenders, rhwLocalSenders);
  const state = appReadCommsForm();
  state.senderKey = RHW_APP_CONFIG.senders[0].key;
  const builtIn = RHW_APP_CONFIG.senders[0];
  state.location = builtIn.location;
  state.encryption = builtIn.encryption;
  state.closing = builtIn.closing;
  state.signatureTitle = builtIn.title;
  appApplyCommsState(state, { persist: true });
  appNotify('LOCAL SENDER PROFILE REMOVED', 'warn');
}

function appDraftDisplayDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function appRenderDrafts() {
  const list = document.getElementById('commsDraftList');
  if (!list) return;
  if (!rhwCommsDrafts.length) {
    list.innerHTML = '<div class="comms-empty-state">NO NAMED DRAFTS IN LOCAL CACHE<small>THE CURRENT TRANSMISSION IS STILL AUTOSAVED</small></div>';
    return;
  }
  list.innerHTML = rhwCommsDrafts
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .map(draft => {
      const sender = appResolvedSender(appNormalizeCommsState(draft.state));
      return `<article class="comms-draft-card" data-draft-id="${appEscape(draft.id)}">
        <div><strong>${appEscape(draft.name)}</strong><small>${appEscape(sender.name)} // ${appEscape(draft.state?.subject || 'NO SUBJECT')} // ${appEscape(appDraftDisplayDate(draft.updatedAt))}</small></div>
        <div class="comms-draft-actions"><button type="button" data-load-draft="${appEscape(draft.id)}">LOAD</button><button type="button" data-delete-draft="${appEscape(draft.id)}">DELETE</button></div>
      </article>`;
    }).join('');
}

function appSaveNamedDraft() {
  const state = appReadCommsForm();
  const name = state.draftName.trim() || state.subject.trim() || `Transmission ${new Date().toLocaleDateString('de-DE')}`;
  state.draftName = name;
  const existing = rhwCommsDrafts.find(draft => normalize(draft.name) === normalize(name));
  if (existing) {
    existing.state = state;
    existing.updatedAt = Date.now();
  } else {
    rhwCommsDrafts.push({ id: appUid('draft'), name, state, updatedAt: Date.now() });
  }
  safeStorageSet(RHW_APP_KEYS.commsDrafts, rhwCommsDrafts);
  appApplyCommsState(state, { persist: true });
  appRenderDrafts();
  appNotify(`DRAFT SAVED // ${name.toUpperCase()}`);
}

function appLoadDraft(id) {
  const draft = rhwCommsDrafts.find(entry => entry.id === id);
  if (!draft) return;
  appApplyCommsState(draft.state, { persist: true });
  appNotify(`DRAFT LOADED // ${draft.name.toUpperCase()}`);
  document.getElementById('commsComposerPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function appDeleteDraft(id) {
  const draft = rhwCommsDrafts.find(entry => entry.id === id);
  if (!draft) return;
  if (!window.confirm(`Delete draft “${draft.name}” from this browser?`)) return;
  rhwCommsDrafts = rhwCommsDrafts.filter(entry => entry.id !== id);
  safeStorageSet(RHW_APP_KEYS.commsDrafts, rhwCommsDrafts);
  appRenderDrafts();
  appNotify('DRAFT REMOVED', 'warn');
}

async function appCopyBbcode() {
  const output = document.getElementById('forumBbcodeOutput');
  if (!output) return;
  try {
    await navigator.clipboard.writeText(output.value);
    appNotify('BB CODE COPIED TO CLIPBOARD');
  } catch (error) {
    output.focus();
    output.select();
    const copied = document.execCommand?.('copy');
    appNotify(copied ? 'BB CODE COPIED TO CLIPBOARD' : 'COPY FAILED // SELECT THE CODE MANUALLY', copied ? 'good' : 'danger');
  }
}

function appResetTransmission() {
  const hasContent = Boolean(rhwCommsState?.message.trim() || rhwCommsState?.subject.trim());
  if (hasContent && !window.confirm('Start a new transmission? The current state is autosaved, but unsaved named-draft changes may be replaced.')) return;
  appApplyCommsState(appDefaultCommsState(), { persist: true });
  appNotify('NEW TRANSMISSION INITIALIZED');
}

function appCommsMarkup() {
  const templateOptions = RHW_APP_CONFIG.templates.map(template => `<option value="${appEscape(template.key)}">${appEscape(template.label)}</option>`).join('');
  return `
  <div class="workspace-frame comms-frame">
    <header class="workspace-heading">
      <div>
        <div class="workspace-kicker"><span>COMMS</span> RHW COMMUNICATION NETWORK</div>
        <h2>FORUM TRANSMISSION COMPOSER</h2>
        <p>WRITE NORMAL TEXT // RHW BUILDS THE FORUM BB CODE</p>
      </div>
      <div class="workspace-status" id="commsStatus" data-tone="muted">LOCAL COMMAND CACHE READY</div>
    </header>

    <div class="comms-grid">
      <section class="comms-panel composer-panel" id="commsComposerPanel">
        <div class="comms-panel-head"><div><span>01</span><strong>TRANSMISSION PARAMETERS</strong></div><small>AUTOSAVE ACTIVE</small></div>
        <form id="commsForm" autocomplete="off">
          <div class="comms-field-grid">
            <label class="comms-field"><span>TEMPLATE</span><select id="commsTemplate">${templateOptions}</select><small id="templateDescription"></small></label>
            <label class="comms-field"><span>SENDER PROFILE</span><select id="commsSender"></select><small>BUILT-IN OR BROWSER-LOCAL CHARACTER</small></label>
            <div class="comms-field comms-custom-sender" id="customSenderWrap" hidden><label><span>CUSTOM SENDER NAME</span><input id="customSenderName" type="text" maxlength="80" placeholder="Character name" /></label></div>
            <label class="comms-field comms-wide"><span>RECIPIENT ID</span><input id="commsRecipient" type="text" maxlength="180" placeholder="Recipient / office / organisation" /></label>
            <label class="comms-field"><span>LOCATION</span><input id="commsLocation" type="text" maxlength="160" /></label>
            <label class="comms-field"><span>ENCRYPTION / CHANNEL</span><input id="commsEncryption" type="text" maxlength="120" /></label>
            <label class="comms-field comms-wide"><span>SUBJECT</span><input id="commsSubject" type="text" maxlength="180" /></label>
            <label class="comms-field comms-wide message-field"><span>MESSAGE</span><textarea id="commsMessage" rows="14" placeholder="Write the actual forum post here — no BB code required."></textarea><small>PARAGRAPHS AND LINE BREAKS ARE PRESERVED</small></label>
            <label class="comms-field"><span>CLOSING</span><input id="commsClosing" type="text" maxlength="80" /></label>
            <label class="comms-field"><span>SIGNATURE TITLE</span><input id="commsSignatureTitle" type="text" maxlength="120" /></label>
            <label class="comms-field"><span>RP SYSTEM DATE</span><input id="commsSystemDate" type="text" maxlength="40" placeholder="05/08/836" /></label>
            <label class="comms-field"><span>DRAFT NAME</span><input id="commsDraftName" type="text" maxlength="100" placeholder="e.g. BAF Dunkirk Offer" /></label>
          </div>
          <details class="comms-advanced">
            <summary>ADVANCED TRANSMISSION SETTINGS</summary>
            <label class="comms-field"><span>FOOTER / SECURITY STAMP</span><input id="commsFooterMotto" type="text" maxlength="180" /></label>
          </details>
          <div class="comms-actions">
            <button class="comms-primary" type="button" id="copyBbcodeBtn"><span>COPY BB CODE</span></button>
            <button type="button" id="saveDraftBtn"><span>SAVE NAMED DRAFT</span></button>
            <button type="button" id="saveSenderBtn" hidden><span>SAVE SENDER PROFILE</span></button>
            <button type="button" id="removeSenderBtn" hidden><span>REMOVE LOCAL SENDER</span></button>
            <button type="button" id="newTransmissionBtn"><span>NEW TRANSMISSION</span></button>
          </div>
        </form>
      </section>

      <section class="comms-panel preview-panel">
        <div class="comms-panel-head"><div><span>02</span><strong>LIVE FORUM PREVIEW</strong></div><small>APPROXIMATE RENDER</small></div>
        <div class="forum-preview" id="forumLivePreview"></div>
      </section>
    </div>

    <section class="comms-panel bbcode-panel">
      <div class="comms-panel-head"><div><span>03</span><strong>GENERATED BB CODE</strong></div><small>EDITABLE AFTER COPY</small></div>
      <textarea id="forumBbcodeOutput" readonly spellcheck="false" aria-label="Generated forum BB code"></textarea>
      <div class="bbcode-hint">THE PREVIEW REPRODUCES RHW STYLING, BUT THE FORUM REMAINS THE FINAL RENDERER FOR ITS CUSTOM BB CODE.</div>
    </section>

    <section class="comms-panel drafts-panel">
      <div class="comms-panel-head"><div><span>04</span><strong>LOCAL DRAFT ARCHIVE</strong></div><small>THIS BROWSER ONLY</small></div>
      <div id="commsDraftList" class="comms-draft-list"></div>
    </section>
  </div>`;
}

function appInstallShell() {
  if (document.getElementById('rhwAppNav')) return;
  const ticker = document.getElementById('newswirePanel');
  const commandStrip = document.getElementById('commandStrip');
  const main = document.querySelector('main');
  if (!ticker || !commandStrip || !main) return;

  const nav = document.createElement('nav');
  nav.id = 'rhwAppNav';
  nav.className = 'rhw-app-nav';
  nav.setAttribute('aria-label', 'RHW application workspaces');
  nav.innerHTML = `
    <div class="app-nav-inner">
      <div class="app-nav-brand"><span class="app-nav-pulse"></span><div><strong>RHW WEB APP</strong><small>${appEscape(RHW_APP_VERSION)}</small></div></div>
      <div class="app-tabs" role="tablist" aria-label="RHW workspaces">
        <button type="button" role="tab" data-workspace="command" aria-controls="workspaceCommand"><span>COMMAND</span><small>LIVE OPERATIONS</small></button>
        <button type="button" role="tab" data-workspace="comms" aria-controls="workspaceComms"><span>COMMS</span><small>TRANSMISSION STUDIO</small></button>
      </div>
    </div>`;
  ticker.insertAdjacentElement('afterend', nav);

  const root = document.createElement('div');
  root.id = 'rhwWorkspaceRoot';
  root.className = 'rhw-workspace-root';
  nav.insertAdjacentElement('afterend', root);

  const command = document.createElement('section');
  command.id = 'workspaceCommand';
  command.className = 'app-workspace command-workspace';
  command.setAttribute('role', 'tabpanel');
  command.setAttribute('aria-label', 'Command workspace');
  root.appendChild(command);
  command.appendChild(commandStrip);
  command.appendChild(main);

  const comms = document.createElement('section');
  comms.id = 'workspaceComms';
  comms.className = 'app-workspace comms-workspace';
  comms.setAttribute('role', 'tabpanel');
  comms.setAttribute('aria-label', 'Communications workspace');
  comms.hidden = true;
  comms.innerHTML = appCommsMarkup();
  root.appendChild(comms);
}

function appWorkspaceFromHash() {
  const value = location.hash.replace(/^#/, '').toLowerCase();
  return ['command', 'comms'].includes(value) ? value : null;
}

function appActivateWorkspace(workspace, { updateHash = true } = {}) {
  const safeWorkspace = ['command', 'comms'].includes(workspace) ? workspace : 'command';
  rhwActiveWorkspace = safeWorkspace;
  safeStorageSet(RHW_APP_KEYS.activeWorkspace, safeWorkspace);
  document.body.dataset.workspace = safeWorkspace;

  document.querySelectorAll('.app-workspace').forEach(panel => {
    const active = panel.id === `workspace${safeWorkspace[0].toUpperCase()}${safeWorkspace.slice(1)}`;
    panel.hidden = !active;
  });
  document.querySelectorAll('[data-workspace]').forEach(button => {
    const active = button.dataset.workspace === safeWorkspace;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });

  document.title = safeWorkspace === 'comms'
    ? `RHW COMMS · ${RHW_APP_VERSION}`
    : `RHW Command Network · ${RHW_APP_VERSION}`;

  if (updateHash && appWorkspaceFromHash() !== safeWorkspace) history.replaceState(null, '', `#${safeWorkspace}`);
}

function appBindWorkspaceNavigation() {
  document.querySelectorAll('[data-workspace]').forEach(button => {
    button.addEventListener('click', () => appActivateWorkspace(button.dataset.workspace));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const buttons = [...document.querySelectorAll('[data-workspace]')];
      const current = buttons.indexOf(button);
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const next = buttons[(current + offset + buttons.length) % buttons.length];
      next.focus();
      appActivateWorkspace(next.dataset.workspace);
    });
  });
  window.addEventListener('hashchange', () => {
    const workspace = appWorkspaceFromHash();
    if (workspace) appActivateWorkspace(workspace, { updateHash: false });
  });
}

function appBindComms() {
  const form = document.getElementById('commsForm');
  if (!form) return;

  form.addEventListener('input', event => {
    if (event.target.id === 'commsTemplate' || event.target.id === 'commsSender') return;
    appSyncFromForm();
  });
  document.getElementById('commsTemplate')?.addEventListener('change', appHandleTemplateChange);
  document.getElementById('commsSender')?.addEventListener('change', appHandleSenderChange);
  document.getElementById('copyBbcodeBtn')?.addEventListener('click', appCopyBbcode);
  document.getElementById('saveDraftBtn')?.addEventListener('click', appSaveNamedDraft);
  document.getElementById('saveSenderBtn')?.addEventListener('click', appSaveLocalSender);
  document.getElementById('removeSenderBtn')?.addEventListener('click', appRemoveLocalSender);
  document.getElementById('newTransmissionBtn')?.addEventListener('click', appResetTransmission);
  document.getElementById('commsDraftList')?.addEventListener('click', event => {
    const load = event.target.closest('[data-load-draft]');
    const remove = event.target.closest('[data-delete-draft]');
    if (load) appLoadDraft(load.dataset.loadDraft);
    if (remove) appDeleteDraft(remove.dataset.deleteDraft);
  });
}

function appUpdateTemplateDescription() {
  const description = document.getElementById('templateDescription');
  const select = document.getElementById('commsTemplate');
  if (description && select) description.textContent = appTemplate(select.value).description;
}

function appInitComms() {
  rhwLocalSenders = appReadArray(RHW_APP_KEYS.localSenders).filter(sender => sender && typeof sender.key === 'string' && typeof sender.name === 'string');
  rhwCommsDrafts = appReadArray(RHW_APP_KEYS.commsDrafts).filter(draft => draft && typeof draft.id === 'string');
  const saved = safeStorageGet(RHW_APP_KEYS.commsCurrent, null);
  appApplyCommsState(saved || appDefaultCommsState());
  appRenderDrafts();
  appUpdateTemplateDescription();
  document.getElementById('commsTemplate')?.addEventListener('change', appUpdateTemplateDescription);
}

function appInitV4() {
  document.documentElement.dataset.rhwApp = 'v4';
  appInstallShell();
  appBindWorkspaceNavigation();
  appBindComms();
  appInitComms();
  const preferred = appWorkspaceFromHash() || safeStorageGet(RHW_APP_KEYS.activeWorkspace, 'command');
  appActivateWorkspace(['command', 'comms'].includes(preferred) ? preferred : 'command');
}

appInitV4();
