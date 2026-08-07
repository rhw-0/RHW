/* ==========================================================================
   RHW V3.6 LAYOUT CONTROLS
   Small, presentation-only behavior for the redesigned command surface.
   ========================================================================== */

const RHW_PRODUCTION_DETAILS_KEY = 'rhw-dashboard-v3.6:production-details';

function initProductionDetailsToggle() {
  const panel = document.getElementById('productionPanel');
  const button = document.getElementById('productionDetailsBtn');
  if (!panel || !button) return;

  const label = button.querySelector('span');
  let expanded = Boolean(safeStorageGet(RHW_PRODUCTION_DETAILS_KEY, false));

  function applyState() {
    panel.classList.toggle('production-expanded', expanded);
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('title', expanded ? 'Collapse recipe ingredient details' : 'Show full recipe ingredient details');
    if (label) label.textContent = expanded ? 'HIDE RECIPE DETAILS' : 'SHOW RECIPE DETAILS';
  }

  button.addEventListener('click', () => {
    expanded = !expanded;
    safeStorageSet(RHW_PRODUCTION_DETAILS_KEY, expanded);
    applyState();
  });

  applyState();
}

function tagLayoutVersion() {
  document.documentElement.dataset.rhwLayout = 'v3.6';
}

tagLayoutVersion();
initProductionDetailsToggle();
