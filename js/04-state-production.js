async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`TELEMETRY TIMEOUT AFTER ${Math.round(timeoutMs / 1000)}S`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function stockState(item) {
  if (!item || item.missing) return 'critical';
  const q = quantity(item);
  const nm = commodityKey(item);
  const custom = CUSTOM_ALERTS[nm];
  if (custom) {
    if (custom.type === 'max') return q >= custom.red ? 'critical' : (q >= custom.yellow ? 'low' : 'ok');
    return q < custom.red ? 'critical' : (q < custom.yellow ? 'low' : 'ok');
  }
  if (PROCUREMENT.includes(nm) || BYPRODUCTS.includes(nm) || CONFISCATED.includes(nm)) return 'ok';
  const min = minStock(item);
  if (min > 0 && q <= min * 0.25) return 'critical';
  if (min > 0 && q < min) return 'low';
  return 'ok';
}

const STATE_SEVERITY = Object.freeze({ ok: 0, low: 1, critical: 2 });

function strictestState(states = []) {
  return states.reduce((worst, state) =>
    (STATE_SEVERITY[state] ?? 0) > (STATE_SEVERITY[worst] ?? 0) ? state : worst
  , 'ok');
}

function shipyardComponentAnalysis(item) {
  const key = commodityKey(item);
  const component = CAPITAL_SHIPYARD?.components?.find(entry => keyFromName(entry.name) === key);
  if (!component) return null;
  const required = Math.max(1, Number(component.required) || 1);
  const stock = item && !item.missing ? quantity(item) : 0;
  const coverage = Math.floor(stock / required);
  return { required, stock, coverage, state: shipyardTrafficState(coverage) };
}

function stateForRole(item, role) {
  if (!item || item.missing) return 'critical';
  const key = commodityKey(item);
  if (role === 'shipyard') return shipyardComponentAnalysis(item)?.state || stockState(item);
  if (role === 'procurement' && FEEDSTOCK.includes(key)) return feedstockAnalysis(item).state;
  return stockState(item);
}

function operationalState(item) {
  const roles = assetRoles(item);
  if (!roles.length) return stockState(item);
  return strictestState(roles.map(role => stateForRole(item, role)));
}

function hasVerifiedTelemetry() {
  return Boolean(rhwBase && lastLoaded && Array.isArray(items));
}

function assetRoles(item) {
  const nm = commodityKey(item);
  const roles = [];
  if (MAINTENANCE.includes(nm)) roles.push('maintenance');
  if (EXPORTS.includes(nm)) roles.push('export');
  if (SHIPYARD.includes(nm)) roles.push('shipyard');
  if (BYPRODUCTS.includes(nm)) roles.push('byproduct');
  if (CONFISCATED.includes(nm)) roles.push('confiscated');
  if (PROCUREMENT.includes(nm) || FEEDSTOCK.includes(nm)) roles.push('procurement');
  return [...new Set(roles)];
}

function hasAssetRole(item, role) {
  return assetRoles(item).includes(role);
}

function assetRole(item) {
  return assetRoles(item)[0] || 'other';
}

function rebuildItemCaches() {
  const requiredKeys = [...FEEDSTOCK, ...MAINTENANCE, ...EXPORTS, ...SHIPYARD, ...BYPRODUCTS, ...CONFISCATED, ...PROCUREMENT].map(keyFromName);
  const augmentedItems = Array.isArray(items) ? [...items] : [];
  const existingKeys = new Set(augmentedItems.map(commodityKey));

  requiredKeys.forEach(reqKey => {
    if (existingKeys.has(reqKey)) return;
    augmentedItems.push({
      name: CANONICAL_NAMES[reqKey] || reqKey.toUpperCase(),
      quantity: 0,
      missing: true,
      synthetic: true,
      price_to_sell_to_base: null,
      price_to_buy_from_base: null
    });
    existingKeys.add(reqKey);
  });

  items = augmentedItems;
  itemsByKey = new Map();
  operationalItemsCache = [];
  const seenOperational = new Set();

  for (const item of items) {
    const key = commodityKey(item);
    if (!itemsByKey.has(key)) itemsByKey.set(key, item);
    if (!assetRoles(item).length || seenOperational.has(key)) continue;
    seenOperational.add(key);
    operationalItemsCache.push(item);
  }
}

function operationalItems() { return operationalItemsCache; }

function roleLabel(role) { 
  if (role === 'maintenance') return 'FACILITY'; 
  if (role === 'export') return 'EXPORT'; 
  if (role === 'shipyard') return 'SHIPYARD';
  if (role === 'byproduct') return 'WASTE'; 
  if (role === 'confiscated') return 'SEIZED';
  return 'PROCUREMENT'; 
}

function statusLabel(state, role) {
  if (role === 'byproduct' || role === 'confiscated') return state === 'critical' ? 'OVERFLOW' : (state === 'low' ? 'WARN' : 'STABLE');
  return state === 'critical' ? 'CRITICAL' : (state === 'low' ? 'LOW' : 'STABLE');
}

function rolePill(role) {
  let cls = 'buy';
  if (role === 'export') cls = 'both';
  if (role === 'maintenance') cls = 'sell';
  if (role === 'shipyard') cls = 'shipyard-pill';
  if (role === 'byproduct') cls = 'waste';
  if (role === 'confiscated') cls = 'confiscated-pill';
  return `<span class="pill ${cls}">${roleLabel(role)}</span>`;
}

function rolePillsFor(item) {
  const roles = assetRoles(item);
  if (!roles.length) return rolePill('procurement');
  return `<span class="role-pill-stack">${roles.map(role => rolePill(role)).join('')}</span>`;
}

function statusPill(state, role) { return `<span class="pill ${state}">${statusLabel(state, role)}</span>`; }
function firstValidPrice(item, keys) {
  if (!item || item.missing) return null;
  for (const key of keys) {
    if (item[key] === undefined || item[key] === null || item[key] === '') continue;
    const value = finiteNumber(item[key], null, 0);
    if (value !== null) return value;
  }
  return null;
}
function priceSell(item) { return firstValidPrice(item, ['price_to_sell_to_base', 'sell_price', 'price_sell', 'price']); }
function priceBuy(item) { return firstValidPrice(item, ['price_to_buy_from_base', 'buy_price', 'price_buy', 'price']); }
function findCommodity(name) { return itemsByKey.get(keyFromName(name)) || null; }
function stockFor(name) { const item = findCommodity(name); return item ? quantity(item) : 0; }
function displayRecipeName(name) { return displayName({ name }); }

function sortManifestBy(column) {
  if (!column) return;
  if (sortCol === column) sortAsc = !sortAsc;
  else { sortCol = column; sortAsc = true; }
  saveViewPreferences();
  renderManifest();
}

function handleSort(event) {
  const th = event.target.closest('th[data-sort]');
  if (th) sortManifestBy(th.dataset.sort);
}

function handleSortKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  const th = event.currentTarget;
  sortManifestBy(th?.dataset?.sort);
}

function updateSortArrows() {
  els.tableHeaders.forEach(th => {
    const active = th.dataset.sort === sortCol;
    if (active) th.setAttribute('data-dir', sortAsc ? 'asc' : 'desc');
    else th.removeAttribute('data-dir');
    th.setAttribute('aria-sort', active ? (sortAsc ? 'ascending' : 'descending') : 'none');
  });
}

function analyzeRecipe(recipe) {
  const productItem = findCommodity(recipe.product);
  const productStock = productItem ? quantity(productItem) : 0;

  const ingredientData = recipe.ingredients.map(pair => {
    const originalName = pair[0];
    const required = pair[1];
    
    let stock = 0;
    let displayNameStr = displayRecipeName(originalName);
    let extraHtml = '';

    if (keyFromName(originalName) === 'gold') {
      const stdGold = stockFor('Gold');
      const wcGold = stockFor('Wildcat Gold');
      stock = stdGold + wcGold;
      
      displayNameStr = 'Gold / Wildcat Gold';
      extraHtml = `<span style="display:block; font-size:9.5px; opacity:0.8; margin-top:3px; letter-spacing:0.05em; font-family:var(--font-tech);"><span style="color:var(--gold);">STD: ${number(stdGold)}</span> // <span style="color:#ce93d8;">WC: ${number(wcGold)}</span></span>`;
    } else {
      stock = stockFor(originalName);
    }

    const cycles = required > 0 ? Math.floor(stock / required) : 0;
    const currentCycleGap = Math.max(0, required - stock);
    return { name: originalName, displayName: displayNameStr, extraHtml, required, stock, cycles, currentCycleGap };
  });

  const possibleCycles = ingredientData.length ? Math.min(...ingredientData.map(i => i.cycles)) : 0;
  const possibleOutput = possibleCycles * recipe.output;
  ingredientData.forEach(ingredient => {
    ingredient.nextCycleGap = Math.max(0, ((possibleCycles + 1) * ingredient.required) - ingredient.stock);
    ingredient.nextGapRatio = ingredient.required > 0 ? ingredient.nextCycleGap / ingredient.required : 0;
  });
  const bottleneck = ingredientData.length ? ingredientData.reduce((lowest, current) => {
    if (current.cycles < lowest.cycles) return current;
    if (current.cycles > lowest.cycles) return lowest;
    if (current.nextGapRatio > lowest.nextGapRatio) return current;
    if (current.nextGapRatio < lowest.nextGapRatio) return lowest;
    return current.nextCycleGap > lowest.nextCycleGap ? current : lowest;
  }) : null;
  const nextCycleGap = bottleneck ? bottleneck.nextCycleGap : 0;
  const cardState = possibleCycles <= 0 ? 'critical' : possibleCycles < 10 ? 'low' : 'ok';

  return { recipe, productItem, productStock, ingredientData, possibleCycles, possibleOutput, bottleneck, nextCycleGap, cardState };
}

function renderProductionModules() {
  if (!els.productionGrid) return;
  if (!hasVerifiedTelemetry()) {
    const failed = Boolean(lastSyncError);
    els.productionGrid.innerHTML = `<div class="feature-empty production-empty">${failed ? 'TELEMETRY UNAVAILABLE' : 'AWAITING FIRST TELEMETRY BURST'}<small>${failed ? 'NO VERIFIED RHW INVENTORY IS AVAILABLE' : 'PRODUCTION ANALYSIS WILL APPEAR AFTER THE FIRST SUCCESSFUL SYNC'}</small></div>`;
    return;
  }
  if (!Array.isArray(RECIPES) || !RECIPES.length) {
    els.productionGrid.innerHTML = '<div class="feature-empty production-empty">PRODUCTION MODULES STANDBY<small>NO RECIPES CONFIGURED</small></div>';
    return;
  }

  els.productionGrid.innerHTML = RECIPES.map((recipe, index) => {
    const analysis = analyzeRecipe(recipe);
    const ingredientRows = analysis.ingredientData.map(item => {
      const isBottleneck = analysis.bottleneck && item.name === analysis.bottleneck.name;
      const shortText = item.currentCycleGap > 0
        ? `<span class="recipe-short">Short ${number(item.currentCycleGap)}</span>`
        : '';

      return `<li class="${isBottleneck ? 'bottleneck' : ''}">
                <span class="recipe-name">${escapeHTML(item.displayName)}${item.extraHtml || ''}</span>
                <span class="recipe-required">${number(item.required)}</span>
                <span class="recipe-stock">${number(item.stock)}${shortText}</span>
              </li>`;
    }).join('');

    const bottleneckDisplay = analysis.bottleneck ? (keyFromName(analysis.bottleneck.name) === 'gold' ? 'GOLD / WILDCAT GOLD' : escapeHTML(analysis.bottleneck.name).toUpperCase()) : '';
    const nextGapText = analysis.bottleneck
      ? `<div class="next-gap ${analysis.cardState}">NEXT +1 CYCLE: <strong>${bottleneckDisplay} +${number(analysis.nextCycleGap)}</strong></div>`
      : '';

    const byproductsText = recipe.byproducts && recipe.byproducts.length
      ? `<div class="byproduct-strip"><span>BYPRODUCT / CYCLE</span>${recipe.byproducts.map(bp => `<span class="byproduct-tag">${number(bp[1])} ${escapeHTML(displayRecipeName(bp[0]))}</span>`).join('')}</div>`
      : '';

    return `<div class="production-card ${analysis.cardState}">
              <div class="production-card-head">
                <div>
                  <div class="production-kicker">MODULE-${String(index + 1).padStart(2, '0')}</div>
                  <div class="production-title">${escapeHTML(displayRecipeName(recipe.product))}</div>
                  <div class="footnote">YIELD PER CYCLE: ${number(recipe.output)}</div>
                </div>
                <span class="module-state ${analysis.cardState}">${statusLabel(analysis.cardState, 'production')}</span>
              </div>
              <div class="production-stats">
                <div class="production-stat production-stock-primary"><small>IN STOCK</small><strong>${number(analysis.productStock)}</strong></div>
                <div class="production-stat"><small>MAX CYCLES</small><strong>${number(analysis.possibleCycles)}</strong></div>
                <div class="production-stat"><small>EST. YIELD</small><strong>${number(analysis.possibleOutput)}</strong></div>
              </div>
              ${nextGapText}
              <div class="recipe-column-head" aria-hidden="true">
                <span>Material</span><span>Required / Cycle</span><span>Current Stock</span>
              </div>
              <ul class="recipe-list">${ingredientRows}</ul>
              ${byproductsText}
            </div>`;
  }).join('');
}

