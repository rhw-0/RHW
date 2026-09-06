function sellableStock(item) {
  if (!item) return 0;
  return Math.max(0, quantity(item) - Math.max(0, minStock(item)));
}

function supplierItemState(item) {
  if (!item) return 'critical';
  const available = sellableStock(item);
  return available > 5000 ? 'ok' : (available > 0 ? 'low' : 'critical');
}

function supplierStateText(item) {
  if (!item) return 'UNLISTED';
  const available = sellableStock(item);
  if (available > 5000) return `SUPPLY STABLE // ${number(available)} FOR SALE`;
  if (available > 0) return `SUPPLY LOW // ${number(available)} FOR SALE`;
  return quantity(item) > 0 ? 'BASE RESERVE ONLY' : 'DEPLETED';
}

function marketBaseSystem(base) {
  const value = base?.system_name ?? base?.system ?? base?.systemName;
  return String(value || 'UNKNOWN SYSTEM').trim() || 'UNKNOWN SYSTEM';
}

function marketBaseIsLocal(base) {
  return normalize(base?.name) === BASE_NAME || normalize(base?.nickname) === BASE_NAME;
}

function validMarketPrice(item) {
  const price = priceBuy(item);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function updateMarketSortButtons() {
  els.marketSortButtons?.forEach(button => {
    const active = button.dataset.marketSort === marketSort;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderMarketScan() {
  const grid = els.marketScanGrid;
  if (!grid || !FEATURES.marketScan) return { totalOffers: 0, uniqueBases: 0, pending: false };

  updateMarketSortButtons();

  if (!MARKET_SCAN.length) {
    if (els.marketScanMeta) els.marketScanMeta.textContent = 'NO CHANNELS CONFIGURED';
    grid.innerHTML = '<div class="supplier-empty">REGIONAL MARKET SCAN STANDBY<small>NO SCAN TARGETS CONFIGURED</small></div>';
    return { totalOffers: 0, uniqueBases: 0, pending: false };
  }

  if (!Array.isArray(allBases) || !allBases.length) {
    const failed = Boolean(lastSyncError);
    if (els.marketScanMeta) els.marketScanMeta.textContent = failed ? 'TELEMETRY UNAVAILABLE' : 'AWAITING FIRST TELEMETRY BURST';
    grid.innerHTML = `<div class="supplier-empty">${failed ? 'MARKET DATA UNAVAILABLE' : 'MARKET SCAN PENDING'}<small>${failed ? 'SYNC FAILED // RETRY WITH REFRESH' : 'AWAITING FIRST TELEMETRY BURST'}</small></div>`;
    return { totalOffers: 0, uniqueBases: 0, pending: true };
  }

  const sellerKeys = new Set();
  let totalOffers = 0;
  const cards = MARKET_SCAN.map(targetName => {
    const key = keyFromName(targetName);
    const priced = [];
    const unlisted = [];

    for (const base of allBases) {
      if (!base || !Array.isArray(base.shop_items)) continue;
      const item = base.shop_items.find(entry => commodityKey(entry) === key);
      if (!item) continue;

      const total = quantity(item);
      const reserve = Math.max(0, minStock(item) || 0);
      const sellable = Math.max(0, total - reserve);
      if (sellable <= 0) continue;

      const name = String(base.name || base.nickname || 'UNKNOWN BASE').trim() || 'UNKNOWN BASE';
      const baseKey = normalize(name);
      const offer = {
        baseKey,
        name,
        local: marketBaseIsLocal(base),
        system: marketBaseSystem(base),
        q: sellable,
        total,
        reserve,
        price: validMarketPrice(item)
      };

      if (offer.price === null) unlisted.push(offer);
      else {
        priced.push(offer);
        sellerKeys.add(baseKey);
        totalOffers += 1;
      }
    }

    const bestPrice = priced.length ? Math.min(...priced.map(offer => offer.price)) : null;
    if (marketSort === 'stock') {
      priced.sort((a, b) => (b.q - a.q) || (a.price - b.price) || a.name.localeCompare(b.name));
    } else {
      priced.sort((a, b) => (a.price - b.price) || (b.q - a.q) || a.name.localeCompare(b.name));
    }
    unlisted.sort((a, b) => (b.q - a.q) || a.name.localeCompare(b.name));

    let visiblePriced = priced.slice(0, 6);
    const bestOffer = marketSort === 'stock' && bestPrice !== null
      ? priced.find(offer => offer.price === bestPrice)
      : null;
    if (bestOffer && !visiblePriced.includes(bestOffer)) {
      visiblePriced = visiblePriced.length < 6
        ? [...visiblePriced, bestOffer]
        : [...visiblePriced.slice(0, 5), bestOffer];
    }
    const remainingSlots = Math.max(0, 6 - visiblePriced.length);
    const visibleUnlisted = unlisted.slice(0, remainingSlots);
    let allVisible = [...visiblePriced, ...visibleUnlisted];

    const localOffer = [...priced, ...unlisted].find(offer => offer.local);
    if (localOffer && !allVisible.includes(localOffer)) {
      if (allVisible.length < 6) allVisible.push(localOffer);
      else {
        let replaceIndex = allVisible.length - 1;
        if (bestOffer && allVisible[replaceIndex] === bestOffer) {
          replaceIndex = allVisible.findLastIndex(offer => offer !== bestOffer);
        }
        if (replaceIndex >= 0) allVisible[replaceIndex] = localOffer;
      }
    }

    const compareOffers = marketSort === 'stock'
      ? ((a, b) => (b.q - a.q) || ((a.price ?? Infinity) - (b.price ?? Infinity)) || a.name.localeCompare(b.name))
      : ((a, b) => ((a.price ?? Infinity) - (b.price ?? Infinity)) || (b.q - a.q) || a.name.localeCompare(b.name));
    allVisible.sort(compareOffers);
    const maxQ = Math.max(0, ...allVisible.map(offer => offer.q));

    return { targetName, priced, unlisted, bestPrice, allVisible, maxQ };
  });

  if (els.marketScanMeta) {
    const cachePrefix = dataIsStale ? 'CACHE ONLY · ' : '';
    els.marketScanMeta.textContent = `${cachePrefix}${sellerKeys.size} BASES · ${totalOffers} PRICED OFFERS`;
  }

  grid.innerHTML = cards.map(card => {
    const title = CANONICAL_NAMES[keyFromName(card.targetName)] || displayRecipeName(card.targetName);
    const state = dataIsStale ? 'stale' : (card.priced.length ? 'ok' : (card.unlisted.length ? 'low' : 'critical'));
    const rows = card.allVisible.map(offer => {
      const isUnlisted = offer.price === null;
      const isBest = !isUnlisted && card.bestPrice !== null && offer.price === card.bestPrice;
      const fillPct = card.maxQ > 0 ? Math.max(3, Math.min(100, (offer.q / card.maxQ) * 100)) : 0;
      const rowClass = dataIsStale ? 'stale' : (isUnlisted ? 'unlisted' : 'info');
      const localLabel = offer.local ? 'RHW LOCAL / OWN FACILITY · ' : '';
      const note = `${localLabel}${offer.system.toUpperCase()}${isBest ? ' · BEST PRICE' : ''}${isUnlisted ? ' · STOCK DETECTED / NOT LISTED' : ''}`;
      const priceText = isUnlisted ? 'NOT LISTED' : formatCurrency(offer.price);
      return `
        <div class="supplier-commodity-row ${rowClass}${offer.local ? ' rhw-local-offer' : ''}">
          <div class="supplier-commodity-name">
            <strong>${escapeHTML(offer.name)}</strong>
            <small class="${rowClass}">${escapeHTML(note)}</small>
          </div>
          <div class="supplier-commodity-metric stock">
            <small>For Sale</small>
            <strong class="scramble-market" data-val="${number(offer.q)}"></strong>
          </div>
          <div class="supplier-commodity-metric price">
            <small>Unit Price</small>
            <strong class="scramble-market${isUnlisted ? ' unlisted' : ''}" data-val="${escapeHTML(priceText)}"></strong>
          </div>
          <div class="supplier-progress-wrap" data-tooltip="${number(offer.q)} FOR SALE // ${number(offer.total)} TOTAL · ${number(offer.reserve)} BASE RESERVE">
            <div class="supplier-progress-fill ${dataIsStale ? 'stale' : (isUnlisted ? 'low' : 'info')}" style="width:${fillPct}%;"></div>
          </div>
        </div>`;
    }).join('');

    const empty = '<div class="supplier-commodity-row critical"><div class="supplier-commodity-name"><strong>NO SELLERS FOUND</strong><small class="critical">NO BASE ABOVE ITS MINIMUM RESERVE</small></div></div>';
    const pricedCount = card.priced.length;
    const unlistedCount = card.unlisted.length;
    const linkClass = dataIsStale ? 'stale' : (pricedCount ? 'online' : (unlistedCount ? 'degraded' : 'offline'));
    const linkText = dataIsStale ? 'STALE DATA' : (pricedCount ? 'SCAN LIVE' : (unlistedCount ? 'UNLISTED STOCK' : 'NO SUPPLY'));

    return `
      <div class="supplier-card market-card ${state}">
        <div class="supplier-scanline"></div>
        <div class="remote-facility-head">
          <div>
            <div class="remote-card-meta">
              <span class="remote-badge">MARKET SCAN</span>
              <span class="remote-badge">${pricedCount} OFFER${pricedCount === 1 ? '' : 'S'}</span>
            </div>
            <div class="supplier-title">${escapeHTML(String(title).toUpperCase())}</div>
            <div class="remote-facility-subline">${marketSort === 'price' ? 'SORTED BY BEST PRICE' : 'SORTED BY AVAILABLE STOCK'} // TOP ${Math.min(6, card.allVisible.length)} RESULTS</div>
          </div>
          <span class="remote-link-pill ${linkClass}">${linkText}</span>
        </div>
        <div class="supplier-commodity-list">${rows || empty}</div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.scramble-market').forEach(el => scrambleText(el, el.dataset.val));
  return { totalOffers, uniqueBases: sellerKeys.size, pending: false };
}

function renderSupplier() {
  const supplierGrid = document.getElementById('supplierGrid');
  if (!els.externalLogisticsPanel || (!FEATURES.fixedLogistics && !FEATURES.marketScan)) return;

  let readableCount = 0;
  let liveCount = 0;

  if (FEATURES.fixedLogistics && supplierGrid) {
    readableCount = REMOTE_FACILITIES.filter(facility => {
      const base = remoteBases.get(facility.key);
      return base && Array.isArray(base.shop_items);
    }).length;
    liveCount = dataIsStale ? 0 : readableCount;

    if (!REMOTE_FACILITIES.length) {
      supplierGrid.innerHTML = '<div class="supplier-empty">FIXED LOGISTICS STANDBY<small>NO REMOTE FACILITIES CONFIGURED</small></div>';
    } else {
      supplierGrid.innerHTML = REMOTE_FACILITIES.map(facility => {
        const base = remoteBases.get(facility.key);
        const baseReadable = Boolean(base && Array.isArray(base.shop_items));
        const baseLive = baseReadable && !dataIsStale;
        const baseStale = baseReadable && dataIsStale;

        const rowData = facility.targets.map(targetName => {
          const item = baseReadable ? base.shop_items.find(entry => commodityKey(entry) === targetName) : null;
          const q = item ? quantity(item) : 0;
          const reserve = item ? Math.max(0, minStock(item)) : 0;
          const forSale = item ? sellableStock(item) : 0;
          const price = item ? priceBuy(item) : null;
          const isStatusTarget = keyFromName(targetName) === keyFromName(facility.statusTarget);
          const signalState = supplierItemState(item);
          const state = baseStale ? 'stale' : (isStatusTarget ? signalState : 'info');
          const stateText = baseStale
            ? (isStatusTarget ? 'CACHED STATUS' : 'CACHED REFERENCE')
            : (isStatusTarget ? supplierStateText(item) : (baseLive ? 'REFERENCE STOCK' : 'DATA UNAVAILABLE'));
          const title = CANONICAL_NAMES[targetName] || displayRecipeName(targetName);
          const fallbackMax = BAR_MAX_FALLBACKS[targetName] || 50000;
          const supplierMax = item ? (maxStock(item) || fallbackMax) : fallbackMax;
          const fillPct = baseReadable && supplierMax > 0 ? Math.min(100, Math.max(0, (q / supplierMax) * 100)) : 0;
          return { q, reserve, forSale, price, state, signalState, stateText, title, supplierMax, fillPct, isStatusTarget };
        });

        const primarySignal = rowData.find(row => row.isStatusTarget);
        const facilityState = baseStale ? 'stale' : (baseLive && primarySignal ? primarySignal.signalState : 'critical');
        const linkClass = baseStale ? 'stale' : (baseLive ? 'online' : 'offline');
        const linkText = baseStale ? 'STALE DATA' : (baseLive ? 'LINK ACTIVE' : 'LINK LOST');

        const rows = rowData.map(row => `
          <div class="supplier-commodity-row ${row.state}">
            <div class="supplier-commodity-name">
              <strong>${escapeHTML(row.title)}</strong>
              <small class="${row.state}">${escapeHTML(row.stateText)}</small>
            </div>
            <div class="supplier-commodity-metric stock">
              <small>Stock</small>
              <strong class="scramble-supplier" data-val="${baseReadable ? number(row.q) : 'N/A'}"></strong>
            </div>
            <div class="supplier-commodity-metric price">
              <small>Unit Buy</small>
              <strong class="scramble-supplier" data-val="${baseReadable ? formatCurrency(row.price) : 'N/A'}"></strong>
            </div>
            <div class="supplier-progress-wrap" data-tooltip="TOTAL STOCK ${number(row.q)} // BASE RESERVE ${number(row.reserve)} // FOR SALE ${number(row.forSale)} // MAX ${number(row.supplierMax)}" aria-label="TOTAL STOCK ${number(row.q)} // BASE RESERVE ${number(row.reserve)} // FOR SALE ${number(row.forSale)} // MAX ${number(row.supplierMax)}">
              <div class="supplier-progress-fill ${row.state}" style="width:${row.fillPct}%;"></div>
            </div>
          </div>`).join('');

        return `
          <div class="supplier-card remote-facility-card ${facilityState}">
            <div class="supplier-scanline"></div>
            <div class="remote-facility-head">
              <div>
                <div class="remote-card-meta">
                  <span class="remote-badge">REMOTE FACILITY</span>
                  <span class="remote-badge">${escapeHTML(facility.system.toUpperCase())}</span>
                </div>
                <div class="supplier-title">${escapeHTML(facility.name)}</div>
                <div class="remote-facility-subline">PROCUREMENT RADAR // ${facility.targets.length} COMMODITY CHANNELS</div>
              </div>
              <span class="remote-link-pill ${linkClass}">${linkText}</span>
            </div>
            <div class="supplier-commodity-list">${rows}</div>
          </div>`;
      }).join('');
      supplierGrid.querySelectorAll('.scramble-supplier').forEach(el => scrambleText(el, el.dataset.val));
    }

    if (els.fixedLogisticsMeta) {
      const prefix = dataIsStale ? 'CACHE ONLY · ' : '';
      els.fixedLogisticsMeta.textContent = `${prefix}${readableCount}/${REMOTE_FACILITIES.length} LINKS READABLE`;
    }
  }

  const marketStats = FEATURES.marketScan ? renderMarketScan() : { totalOffers: 0, uniqueBases: 0, pending: false };

  if (dataIsStale && lastLoaded) {
    const staleTime = lastLoaded.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSupplierLinkState('stale', `CACHE ONLY · LAST SYNC ${staleTime}`);
    return;
  }

  const fixedComplete = !FEATURES.fixedLogistics || (REMOTE_FACILITIES.length > 0 && liveCount === REMOTE_FACILITIES.length);
  const marketReady = !FEATURES.marketScan || (!marketStats.pending && Array.isArray(allBases) && allBases.length > 0);
  const summary = [];
  if (FEATURES.fixedLogistics) summary.push(`${liveCount}/${REMOTE_FACILITIES.length} LINKS`);
  if (FEATURES.marketScan) summary.push(`${marketStats.totalOffers} OFFERS`);

  if (!marketReady) setSupplierLinkState('polling', 'REGIONAL SCAN PENDING');
  else if (fixedComplete && (!FEATURES.marketScan || marketStats.totalOffers > 0)) setSupplierLinkState('online', summary.join(' · '));
  else if ((FEATURES.fixedLogistics && liveCount > 0) || (FEATURES.marketScan && marketStats.totalOffers > 0)) setSupplierLinkState('degraded', summary.join(' · '));
  else setSupplierLinkState('offline', summary.join(' · ') || 'UPLINK STANDBY');
}
