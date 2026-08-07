/* ==========================================================================
   RHW WEB APP · V4.0 COMMS SAFETY
   Keeps Ticker Builder output inside the exact format consumed by the stable
   RHW Newswire markdown parser without patching or replacing COMMS functions.
   ========================================================================== */
(function initRhwV4CommsSafety() {
  'use strict';
  const app = window.RHWV4;
  if (!app) return;

  const MAX_TAG = 40;
  const MAX_MESSAGE = 240;

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

  function init() {
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

  app.commsSafety = { init, normalizeTag, normalizeMessage, limits: Object.freeze({ tag: MAX_TAG, message: MAX_MESSAGE }) };
})();
