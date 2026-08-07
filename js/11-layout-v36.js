/* ==========================================================================
   RHW V3.6 LAYOUT CONTROLS
   Presentation-only behavior for the redesigned command surface.
   ========================================================================== */

const RHW_PRODUCTION_DETAILS_KEY = 'rhw-dashboard-v3.6:production-details';

function arrangeV36CommandFlow() {
  const production = document.getElementById('productionPanel');
  const logistics = document.getElementById('externalLogisticsPanel');
  if (!production || !logistics || !logistics.parentNode) return;

  // Operational flow: overview -> shipyard -> production -> procurement -> manifest.
  if (production.nextElementSibling !== logistics) {
    logistics.parentNode.insertBefore(production, logistics);
  }

  const productionIndex = production.querySelector('.section-kicker span');
  const logisticsIndex = logistics.querySelector('.section-kicker span');
  if (productionIndex) productionIndex.textContent = '05';
  if (logisticsIndex) logisticsIndex.textContent = '06';
}

function ensureProductionDetailsButton() {
  const panel = document.getElementById('productionPanel');
  const head = panel?.querySelector('.panel-head');
  if (!panel || !head) return null;

  let button = document.getElementById('productionDetailsBtn');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'productionDetailsBtn';
  button.className = 'uplink-button production-details-toggle';
  button.type = 'button';
  button.setAttribute('aria-controls', 'productionGrid');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span>SHOW RECIPE DETAILS</span>';
  head.appendChild(button);
  return button;
}

function initProductionDetailsToggle() {
  const panel = document.getElementById('productionPanel');
  const button = ensureProductionDetailsButton();
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
arrangeV36CommandFlow();
initProductionDetailsToggle();
