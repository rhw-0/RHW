/* ==========================================================================
   RHW WEB APP · V4.0 COMPOSER POLISH
   Signature automation, sign-off presets, shorter Bretonian cipher IDs,
   clearer document controls and BBCode presentation v2.
   ========================================================================== */

const RHW_V40_CLOSING_PRESETS = Object.freeze([
  Object.freeze({ label: 'FORMAL / UNKNOWN RECIPIENT — Yours faithfully,', value: 'Yours faithfully,' }),
  Object.freeze({ label: 'NAMED RECIPIENT — Yours sincerely,', value: 'Yours sincerely,' }),
  Object.freeze({ label: 'CROWN / ROYAL OFFICE — In loyal service to the Crown,', value: 'In loyal service to the Crown,' }),
  Object.freeze({ label: 'MILITARY / ADMIRALTY — Respectfully,', value: 'Respectfully,' }),
  Object.freeze({ label: 'BUSINESS PARTNER — With highest regards,', value: 'With highest regards,' }),
  Object.freeze({ label: 'SUPPLIER / CONTRACTOR — Kind regards,', value: 'Kind regards,' }),
  Object.freeze({ label: 'INTERNAL RHW / BMM — For Resolution Heavy Works,', value: 'For Resolution Heavy Works,' }),
  Object.freeze({ label: 'NEUTRAL — Regards,', value: 'Regards,' })
]);

const RHW_V40_CLASSIFICATION_COLORS = Object.freeze({
  'PUBLIC RELEASE': '#78ad8a',
  'RHW OFFICIAL': '#d4af37',
  'RHW INTERNAL': '#7da7ea',
  'COMMERCIAL CONFIDENTIAL': '#c6a75a',
  'BMM CONFIDENTIAL': '#c6a75a',
  'CROWN RESTRICTED': '#c98b2c',
  'ADMIRALTY EYES ONLY': '#c75e5e',
  'RHW EXECUTIVE': '#d4af37',
  'PRIORITY // RESTRICTED': '#c75e5e'
});

function v40ClassificationColor(value) {
  return RHW_V40_CLASSIFICATION_COLORS[value] || '#d4af37';
}

/* Shorter RP cipher designations: British/Bretonian-flavoured code names plus
   a key reference, rather than a full modern cryptographic suite string. */
v40GenerateCipher = function(templateKey = rhwCommsState?.templateKey || 'formal') {
  const authorities = RHW_V40_CIPHER.authorities[templateKey] || RHW_V40_CIPHER.authorities.formal;
  const authority = v40Pick(authorities);
  const family = v40Pick(RHW_V40_CIPHER.families);
  const keyset = v40Pick(RHW_V40_CIPHER.keysets);
  const mark = v40Roman(2 + Math.floor(Math.random() * 9));
  const serial = String(1 + Math.floor(Math.random() * 98)).padStart(2, '0');
  return `${authority}-${family}/${mark} · KEY ${keyset}-${serial}`;
};

function v40TemplateClosing(templateKey) {
  return appTemplate(templateKey)?.closing || 'Yours faithfully,';
}

function v40KnownClosing(value) {
  return RHW_V40_CLOSING_PRESETS.some(entry => entry.value === value);
}

function v40ClosingValue() {
  const select = document.getElementById('commsClosing');
  const custom = document.getElementById('commsClosingCustom');
  if (!select) return '';
  return select.value === '__custom__' ? (custom?.value || '').trim() : select.value;
}

function v40SetClosingControl(value) {
  const select = document.getElementById('commsClosing');
  const custom = document.getElementById('commsClosingCustom');
  if (!select) return;
  const next = String(value || '').trim() || 'Yours faithfully,';
  if (v40KnownClosing(next)) {
    select.value = next;
    if (custom) {
      custom.hidden = true;
      custom.value = '';
    }
  } else {
    select.value = '__custom__';
    if (custom) {
      custom.hidden = false;
      custom.value = next;
    }
  }
}

/* Sender profile owns the signature name + role. Only temporary/custom senders
   use the editable role field. */
appResolvedSender = function(state = rhwCommsState) {
  if (!state) return { name: '', title: '' };
  if (state.senderKey === '__custom__') {
    return {
      name: state.customSenderName?.trim() || 'UNASSIGNED SENDER',
      title: state.signatureTitle?.trim() || ''
    };
  }
  const sender = appSenderByKey(state.senderKey);
  return {
    name: sender?.name || 'UNASSIGNED SENDER',
    title: sender?.title || ''
  };
};

const v40ComposerBaseReadCommsForm = appReadCommsForm;
appReadCommsForm = function() {
  const state = v40ComposerBaseReadCommsForm();
  state.closing = v40ClosingValue() || state.closing || 'Yours faithfully,';
  if (state.senderKey !== '__custom__') {
    const sender = appSenderByKey(state.senderKey);
    if (sender) state.signatureTitle = sender.title || '';
  }
  return state;
};

const v40ComposerBaseToggleSenderControls = appToggleSenderControls;
appToggleSenderControls = function() {
  v40ComposerBaseToggleSenderControls();
  v40SyncSignatureUi();
};

const v40ComposerBaseApplyCommsState = appApplyCommsState;
appApplyCommsState = function(state, options = {}) {
  v40ComposerBaseApplyCommsState(state, options);
  const sender = rhwCommsState?.senderKey === '__custom__' ? null : appSenderByKey(rhwCommsState?.senderKey);
  if (sender) {
    rhwCommsState.signatureTitle = sender.title || '';
    const title = document.getElementById('commsSignatureTitle');
    if (title) title.value = sender.title || '';
  }
  v40SetClosingControl(rhwCommsState?.closing || v40TemplateClosing(rhwCommsState?.templateKey));
  v40SyncSignatureUi();
  v40UpdateDocumentControlSummary();
  appRenderForumPreview();
  appRenderBbcode();
  if (options.persist) appSaveCurrentState();
};

function v40InstallClosingSelector() {
  const old = document.getElementById('commsClosing');
  if (!old || old.tagName === 'SELECT') return;
  const field = old.closest('.comms-field');
  const current = old.value || rhwCommsState?.closing || 'Yours faithfully,';
  const select = document.createElement('select');
  select.id = 'commsClosing';
  select.innerHTML = RHW_V40_CLOSING_PRESETS
    .map(entry => `<option value="${appEscape(entry.value)}">${appEscape(entry.label)}</option>`)
    .join('') + '<option value="__custom__">CUSTOM CLOSING…</option>';
  old.replaceWith(select);

  const custom = document.createElement('input');
  custom.id = 'commsClosingCustom';
  custom.type = 'text';
  custom.maxLength = 100;
  custom.placeholder = 'Custom sign-off';
  custom.hidden = true;
  select.insertAdjacentElement('afterend', custom);

  const label = field?.querySelector(':scope > span');
  if (label) label.textContent = 'SIGN-OFF / CLOSING';
  const hint = document.createElement('small');
  hint.textContent = 'PRESETS BY RECIPIENT CONTEXT // STILL EDITABLE VIA CUSTOM';
  field?.appendChild(hint);

  select.addEventListener('change', () => {
    custom.hidden = select.value !== '__custom__';
    if (!custom.hidden) custom.focus();
    appSyncFromForm();
  });
  custom.addEventListener('input', appSyncFromForm);
  v40SetClosingControl(current);
}

function v40InstallSignatureAutomation() {
  const senderField = document.getElementById('commsSender')?.closest('.comms-field');
  const title = document.getElementById('commsSignatureTitle');
  const titleField = title?.closest('.comms-field');
  if (!senderField || !title || !titleField) return;

  const senderHint = senderField.querySelector('small');
  if (senderHint) senderHint.textContent = 'SENDER PROFILE ALSO CONTROLS THE SIGNATURE';

  const titleLabel = titleField.querySelector(':scope > span');
  if (titleLabel) titleLabel.textContent = 'SENDER ROLE / TITLE';

  if (!document.getElementById('v40SignatureAuto')) {
    const summary = document.createElement('div');
    summary.id = 'v40SignatureAuto';
    summary.className = 'comms-signature-auto';
    senderField.insertAdjacentElement('afterend', summary);
  }
  v40SyncSignatureUi();
}

function v40SyncSignatureUi() {
  const title = document.getElementById('commsSignatureTitle');
  const titleField = title?.closest('.comms-field');
  const summary = document.getElementById('v40SignatureAuto');
  const key = document.getElementById('commsSender')?.value || rhwCommsState?.senderKey;
  const custom = key === '__custom__';
  if (titleField) titleField.hidden = !custom;

  if (custom) {
    if (summary) summary.innerHTML = '<small>AUTO SIGNATURE</small><strong>CUSTOM SENDER</strong><span>NAME + ROLE ARE TAKEN FROM THE CUSTOM PROFILE FIELDS</span>';
    return;
  }

  const sender = appSenderByKey(key);
  if (title && sender) title.value = sender.title || '';
  if (summary) {
    summary.innerHTML = `<small>AUTO SIGNATURE</small><strong>${appEscape(sender?.name || 'UNASSIGNED SENDER')}</strong><span>${appEscape(sender?.title || 'NO ROLE REGISTERED')}</span>`;
  }
}

function v40InstallDocumentControlCard() {
  const template = document.getElementById('commsTemplate');
  const classification = document.getElementById('commsClassification');
  const grid = document.querySelector('#commsForm .comms-field-grid');
  if (!template || !classification || !grid || document.getElementById('v40DocumentControl')) return;

  const templateField = template.closest('.comms-field');
  const classificationField = classification.closest('.comms-field');
  const card = document.createElement('section');
  card.id = 'v40DocumentControl';
  card.className = 'comms-document-control';
  card.innerHTML = '<div class="comms-document-control-head"><div><small>DOCUMENT CONTROL</small><strong>TRANSMISSION PROFILE</strong></div><span id="v40DocumentControlSummary"></span></div><div class="comms-document-control-grid"></div>';
  grid.insertAdjacentElement('beforebegin', card);
  const cardGrid = card.querySelector('.comms-document-control-grid');
  if (templateField) cardGrid.appendChild(templateField);
  if (classificationField) cardGrid.appendChild(classificationField);

  const templateLabel = templateField?.querySelector(':scope > span');
  const classificationLabel = classificationField?.querySelector(':scope > span');
  if (templateLabel) templateLabel.textContent = 'DOCUMENT TYPE';
  if (classificationLabel) classificationLabel.textContent = 'SECURITY CLASSIFICATION';
  const classificationHint = classificationField?.querySelector('small');
  if (classificationHint) classificationHint.textContent = 'DISPLAYED AS ITS OWN SECURITY BANNER';
  v40UpdateDocumentControlSummary();
}

function v40UpdateDocumentControlSummary() {
  const target = document.getElementById('v40DocumentControlSummary');
  if (!target) return;
  const template = appTemplate(document.getElementById('commsTemplate')?.value || rhwCommsState?.templateKey);
  const classification = document.getElementById('commsClassification')?.value || rhwCommsState?.classification || v40DefaultClassification(template?.key);
  target.textContent = `${template?.label || 'TRANSMISSION'} // ${classification}`;
  target.style.setProperty('--classification-color', v40ClassificationColor(classification));
}

/* BBCode V2: template and classification are separate; subject gets a proper
   document-title block; signature always follows the sender profile. */
appBuildForumBbcode = function(state = rhwCommsState) {
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const template = appTemplate(state.templateKey);
  const accent = v40TemplateAccent(state.templateKey);
  const classification = state.classification?.trim() || v40DefaultClassification(state.templateKey);
  const classificationColor = v40ClassificationColor(classification);
  const recipient = state.recipient.trim() || 'UNSPECIFIED RECIPIENT';
  const location = state.location.trim() || 'Resolution Heavy Works, New London';
  const encryption = state.encryption.trim() || template.encryption || 'RHW-RESOLUTION/V · KEY NEW-LONDON-01';
  const subject = state.subject.trim() || 'UNTITLED TRANSMISSION';
  const body = v40BodyToBbcode(state.message.trim(), accent);
  const closing = state.closing.trim() || v40TemplateClosing(state.templateKey);
  const systemDate = state.systemDate.trim() || 'UNSET';
  const footerMotto = state.footerMotto.trim() || f.footerMotto;

  return `[align=center]\n` +
`[img]${f.logoUrl}[/img]\n` +
`[size=xx-large][font=Agency FB][b][color=${f.brandColor}]${f.organisation}[/color][/b][/font][/size]\n` +
`[size=small][font=Consolas][color=${f.mutedColor}]${f.subline}[/color][/font][/size]\n` +
`[/align]\n\n` +
`[hrc]${f.brandColor}[/hrc]\n` +
`[align=center][font=Consolas][size=x-small][color=${f.mutedColor}]RHW SECURE TRANSMISSION // ${template.label}[/color][/size][/font][br]\n` +
`[font=Consolas][size=small][b][color=${classificationColor}]CLASSIFICATION // ${classification}[/color][/b][/size][/font][/align]\n` +
`[hrc]${f.darkLineColor}[/hrc]\n\n` +
`[align=center]\n[table=${f.brandColor}]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]SENDER ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${sender.name}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]RECIPIENT ID:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${recipient}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]LOCATION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas]${location}[/font][/td]\n[/tr]\n` +
`[tr]\n[td][font=Consolas][b][color=${f.brandColor}]ENCRYPTION:[/color][/b][/font][/td]\n[td][font=Consolas]      [/font][/td]\n[td][font=Consolas][color=#9FB6D9]${encryption}[/color][/font][/td]\n[/tr]\n` +
`[/table]\n[/align]\n\n` +
`[hrc]${accent}[/hrc]\n` +
`[align=center][font=Consolas][size=x-small][color=${f.mutedColor}]SUBJECT[/color][/size][/font][br]\n` +
`[font=Agency FB][size=x-large][b][color=${accent}]${subject}[/color][/b][/size][/font][/align]\n` +
`[hrc]${accent}[/hrc]\n[br]\n` +
`[pi amount=12][font=Tahoma][color=${f.textColor}]\n\n${body}\n\n[/color][/font][/pi]\n` +
`[br]\n[align=right]\n` +
`[font=Agency FB][size=large][i]${closing}[/i][/size][/font]\n` +
`[size=large][b][font=Agency FB][color=${f.brandColor}]${sender.name}[/color][/font][/b][/size]\n` +
`[font=Consolas][size=small][color=${f.mutedColor}]${sender.title}[/color][/size][/font]\n` +
`[/align]\n\n[hrc]${f.darkLineColor}[/hrc]\n` +
`[align=center][font=Consolas][size=x-small][color=${f.footerColor}]\n${footerMotto}\nTRANSMISSION CLASS // ${classification}\n[RHW] SYSTEM TIME: ${systemDate}\n[/color][/size][/font][/align]`;
};

appRenderForumPreview = function(state = rhwCommsState) {
  const target = document.getElementById('forumLivePreview');
  if (!target || !state) return;
  const f = RHW_APP_CONFIG.forum;
  const sender = appResolvedSender(state);
  const template = appTemplate(state.templateKey);
  const accent = v40TemplateAccent(state.templateKey);
  const classification = state.classification || v40DefaultClassification(state.templateKey);
  const classificationColor = v40ClassificationColor(classification);
  const rows = [
    ['SENDER ID', sender.name || '—'],
    ['RECIPIENT ID', state.recipient || '—'],
    ['LOCATION', state.location || '—'],
    ['ENCRYPTION', state.encryption || '—']
  ];
  target.style.setProperty('--comms-accent', accent);
  target.style.setProperty('--classification-color', classificationColor);
  target.innerHTML = `
    <div class="forum-preview-identity">
      <img src="${appEscape(f.logoUrl)}" alt="" loading="lazy" />
      <div class="forum-preview-title">${appEscape(f.organisation)}</div>
      <div class="forum-preview-subline">${appEscape(f.subline)}</div>
      <div class="forum-preview-document-type">RHW SECURE TRANSMISSION // ${appEscape(template.label)}</div>
      <div class="forum-preview-classification">CLASSIFICATION // ${appEscape(classification)}</div>
    </div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-meta">
      ${rows.map(([label, value], index) => `<div class="forum-preview-meta-row"><strong>${label}:</strong><span class="${index === 3 ? 'encryption' : ''}">${appEscape(value)}</span></div>`).join('')}
    </div>
    <div class="forum-preview-subject"><small>SUBJECT</small><strong>${appEscape(state.subject || 'UNTITLED TRANSMISSION')}</strong></div>
    <div class="forum-preview-rule"></div>
    <div class="forum-preview-body">${state.message.trim() ? v40BodyToPreview(state.message.trim()) : '<span class="preview-placeholder">AWAITING TRANSMISSION BODY</span>'}</div>
    <div class="forum-preview-signature">
      <em>${appEscape(state.closing || v40TemplateClosing(state.templateKey))}</em>
      <strong>${appEscape(sender.name)}</strong>
      <small>${appEscape(sender.title)}</small>
    </div>
    <div class="forum-preview-footer">
      <span>${appEscape(state.footerMotto || f.footerMotto)}</span>
      <span>TRANSMISSION CLASS // ${appEscape(classification)}</span>
      <span>[RHW] SYSTEM TIME: ${appEscape(state.systemDate || 'UNSET')}</span>
    </div>`;
};

function v40InstallNewswireClarity() {
  const tab = document.querySelector('[data-comms-node="newswire"]');
  if (tab) {
    const label = tab.querySelector('span');
    const sub = tab.querySelector('small');
    if (label) label.textContent = 'TICKER';
    if (sub) sub.textContent = 'DASHBOARD BULLETIN';
  }
  const panel = document.querySelector('[data-comms-panel="newswire"] .v40-tool-panel');
  if (!panel) return;
  const title = panel.querySelector('.comms-panel-head strong');
  const meta = panel.querySelector('.comms-panel-head small');
  if (title) title.textContent = 'BMM INDUSTRIAL NEWSWIRE BUILDER';
  if (meta) meta.textContent = 'MOVING DASHBOARD TICKER';
  if (!panel.querySelector('.v40-newswire-explainer')) {
    const explainer = document.createElement('div');
    explainer.className = 'v40-newswire-explainer';
    explainer.innerHTML = '<strong>WHAT IS THIS?</strong><span>BUILDS ONE READY-TO-PASTE ENTRY FOR THE MOVING BMM INDUSTRIAL NEWSWIRE ABOVE THE RHW APP. IT DOES NOT CREATE A FORUM POST AND IT DOES NOT PUBLISH AUTOMATICALLY.</span>';
    panel.querySelector('.comms-panel-head')?.insertAdjacentElement('afterend', explainer);
  }
  const generated = panel.querySelector('.v40-generated-block small');
  if (generated) generated.textContent = 'TICKER SOURCE BLOCK // RHW_NEWSWIRE.MD';
}

function v40InstallComposerPolish() {
  v40InstallClosingSelector();
  v40InstallSignatureAutomation();
  v40InstallDocumentControlCard();
  v40InstallNewswireClarity();

  const templateSelect = document.getElementById('commsTemplate');
  const senderSelect = document.getElementById('commsSender');
  const classification = document.getElementById('commsClassification');

  templateSelect?.addEventListener('change', () => {
    v40SetClosingControl(v40TemplateClosing(templateSelect.value));
    v40UpdateDocumentControlSummary();
    appSyncFromForm();
  });
  senderSelect?.addEventListener('change', () => {
    const sender = appSenderByKey(senderSelect.value);
    if (sender) v40SetClosingControl(sender.closing || v40TemplateClosing(templateSelect?.value));
    v40SyncSignatureUi();
    appSyncFromForm();
  });
  classification?.addEventListener('change', () => {
    v40UpdateDocumentControlSummary();
    appSyncFromForm();
  });

  const current = appNormalizeCommsState(rhwCommsState || appDefaultCommsState());
  if (/ML-KEM|X25519|AES-256|CHACHA20/i.test(current.encryption || '')) {
    current.encryption = appTemplate(current.templateKey)?.encryption || current.encryption;
  }
  appApplyCommsState(current, { persist: true });
}

function v40LoadComposerPolishStyles() {
  if (document.querySelector('link[data-rhw-v40-composer]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './css/14-app-v40-composer.css';
  link.dataset.rhwV40Composer = 'true';
  document.head.appendChild(link);
}

v40LoadComposerPolishStyles();
v40InstallComposerPolish();
