function updateBaseTelemetry() {
  if (!rhwBase) return;
  const money = rhwBase.money ?? rhwBase.credits ?? rhwBase.base_money;
  const cargo = rhwBase.cargospace ?? rhwBase.cargo_space ?? rhwBase.cargo_space_left ?? rhwBase.storage_free;
  const health = rhwBase.health ?? rhwBase.base_health;
  const healthDisplay = formatBaseHealth(health);

  if (els.baseMoneyVal) scrambleText(els.baseMoneyVal, formatCurrency(money));
  if (els.baseStorageVal) scrambleText(els.baseStorageVal, Number.isFinite(Number(cargo)) ? numFormatter.format(cargo) : '–');
  if (els.baseHealthVal) scrambleText(els.baseHealthVal, healthDisplay);

  if (els.baseHealthCard) {
    const healthNumber = parseFloat(String(healthDisplay).replace(',', '.'));
    els.baseHealthCard.classList.remove('health-good', 'health-warn', 'health-critical');
    if (Number.isFinite(healthNumber)) {
      if (healthNumber < 25) els.baseHealthCard.classList.add('health-critical');
      else if (healthNumber < 75) els.baseHealthCard.classList.add('health-warn');
      else els.baseHealthCard.classList.add('health-good');
    }
  }

  const system = rhwBase.system_name || 'New London';
  const region = rhwBase.region_name || 'BRETONIA';
  const sector = rhwBase.sector_coord || 'C-6';
  const pos = formatPosition(rhwBase.pos ?? rhwBase.base_pos);

  if (els.stripRegion) els.stripRegion.innerHTML = `REGION <strong>${escapeHTML(region)}</strong>`;
  if (els.stripSystem) els.stripSystem.innerHTML = `SYSTEM <strong>${escapeHTML(system)}</strong>`;
  if (els.stripCoords) els.stripCoords.innerHTML = `SECTOR <strong>${escapeHTML(sector)}</strong>`;
  if (els.stripPosition) els.stripPosition.innerHTML = `POS <strong>${escapeHTML(pos)}</strong>`;
}

function readinessText(state, role) {
  if (role === 'byproduct') {
    if (state === 'critical') return 'CONTAINMENT CRITICAL';
    if (state === 'low') return 'DISPOSAL WATCH';
    return 'CONTAINMENT STABLE';
  }
  if (role === 'confiscated') {
    if (state === 'critical') return 'VAULT OVERFLOW';
    if (state === 'low') return 'HIGH VOLUME';
    return 'EVIDENCE SECURED';
  }
  if (role === 'export') {
    if (state === 'critical') return 'EXPORT RESERVE CRITICAL';
    if (state === 'low') return 'LOW EXPORT RESERVE';
    return 'EXPORT READY';
  }
  if (role === 'maintenance') {
    if (state === 'critical') return 'FACILITY RISK';
    if (state === 'low') return 'RESERVE WATCH';
    return 'FACILITY STABLE';
  }
  return 'TRACKED';
}

function updateSyncCountdown() {
  if (!els.syncCountdown) return;
  if (isLoading) {
    els.syncCountdown.textContent = 'SYNCING';
    els.syncCountdown.style.color = 'var(--warn)';
    return;
  }
  if (!nextSyncAt) {
    els.syncCountdown.textContent = '–';
    els.syncCountdown.style.color = 'var(--gold)';
    return;
  }

  const remaining = Math.max(0, Math.ceil((nextSyncAt - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  els.syncCountdown.textContent = minutes > 0 ? `${minutes}:${seconds}` : `${remaining}s`;
  els.syncCountdown.style.color = remaining <= 30 ? 'var(--warn)' : 'var(--gold)';
}

function setTelemetryState(telemetry, cls = 'gold') {
  if (!els.telemetryStateVal) return;
  scrambleText(els.telemetryStateVal, telemetry);
  els.telemetryStateVal.style.color = `var(--${cls})`;
}

function setFooterConnection(state, colorToken = '') {
  if (!els.footerConnection) return;
  els.footerConnection.textContent = state;
  els.footerConnection.style.color = colorToken ? `var(--${colorToken})` : '';
}

function setSupplierLinkState(state, text) {
  if (els.supplierLinkBadge) {
    els.supplierLinkBadge.classList.remove('polling', 'online', 'offline', 'degraded', 'stale');
    els.supplierLinkBadge.classList.add(state);
  }
  if (els.supplierLinkText) els.supplierLinkText.textContent = text;
}

function tickerStateTone(state) {
  if (state === 'critical') return 'danger';
  if (state === 'low') return 'warn';
  return 'good';
}

function healthPercentValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 100) return Math.max(0, Math.min(100, n));
  return Math.max(0, Math.min(100, (n / 24000000) * 100));
}

function priorityToneRank(tone) {
  return tone === 'danger' ? 3 : (tone === 'warn' ? 2 : 1);
}

function buildPriorityWire(recipeAnalyses) {
  const priorities = [];
  const healthRaw = rhwBase.health ?? rhwBase.base_health;
  const healthPercent = healthPercentValue(healthRaw);

  if (healthPercent !== null && healthPercent < 75) {
    priorities.push({
      tag: 'PRIORITY / STRUCTURAL',
      text: `FACILITY INTEGRITY ${healthPercent < 25 ? 'CRITICAL' : 'DEGRADED'} AT ${number(healthPercent.toFixed(1))}%`,
      tone: healthPercent < 25 ? 'danger' : 'warn'
    });
  }

  const reserveAlerts = operationalItems()
    .map(item => {
      const roles = assetRoles(item).filter(role => role === 'maintenance' || role === 'export');
      return { item, roles, state: strictestState(roles.map(role => stateForRole(item, role))) };
    })
    .filter(entry => entry.roles.length && entry.state !== 'ok')
    .sort((a, b) => priorityToneRank(tickerStateTone(b.state)) - priorityToneRank(tickerStateTone(a.state)));

  if (reserveAlerts.length) {
    const worstTone = tickerStateTone(reserveAlerts[0].state);
    const summary = reserveAlerts.slice(0, 3).map(entry => {
      const roleText = entry.roles.map(roleLabel).join('+');
      return `${displayName(entry.item).toUpperCase()} [${roleText}] ${statusLabel(entry.state, entry.roles[0])}`;
    }).join(' / ');
    priorities.push({
      tag: 'PRIORITY / RESERVES',
      text: summary,
      tone: worstTone
    });
  }

  const wasteAlerts = operationalItems()
    .filter(item => {
      const role = hasAssetRole(item, 'byproduct') ? 'byproduct' : (hasAssetRole(item, 'confiscated') ? 'confiscated' : null);
      return role && stateForRole(item, role) !== 'ok';
    })
    .sort((a, b) => priorityToneRank(tickerStateTone(operationalState(b))) - priorityToneRank(tickerStateTone(operationalState(a))));

  if (wasteAlerts.length) {
    const item = wasteAlerts[0];
    const percent = Math.round((quantity(item) / Math.max(1, barMaxFor(item))) * 100);
    priorities.push({
      tag: 'PRIORITY / HAZMAT',
      text: `${displayName(item).toUpperCase()} HAS REACHED ${percent}% OF OPERATIONAL CAPACITY`,
      tone: tickerStateTone(operationalState(item))
    });
  }

  const blocked = recipeAnalyses.filter(analysis => analysis.possibleCycles <= 0);
  if (blocked.length) {
    const blockedNames = blocked.slice(0, 3).map(analysis => displayRecipeName(analysis.recipe.product).toUpperCase());
    const bottleneckCounts = new Map();
    blocked.forEach(analysis => {
      const key = analysis.bottleneck ? analysis.bottleneck.name.toUpperCase() : 'UNKNOWN INPUT';
      bottleneckCounts.set(key, (bottleneckCounts.get(key) || 0) + 1);
    });
    const primary = [...bottleneckCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN INPUT';
    priorities.push({
      tag: 'PRIORITY / PRODUCTION',
      text: `${blockedNames.join(' / ')} OFFLINE // PRIMARY CONSTRAINT ${primary}`,
      tone: 'danger'
    });
  }

  REMOTE_FACILITIES.forEach(facility => {
    const base = remoteBases.get(facility.key);
    if (!base || !Array.isArray(base.shop_items)) {
      priorities.push({
        tag: `PRIORITY / ${facility.system.toUpperCase()} LINK`,
        text: `${facility.name.toUpperCase()} DATABANK UNREACHABLE // REMOTE QUOTATIONS UNAVAILABLE`,
        tone: 'warn'
      });
    }
  });

  return priorities
    .sort((a, b) => priorityToneRank(b.tone) - priorityToneRank(a.tone))
    .slice(0, 2);
}

function buildFinanceDeskMessage() {
  const money = rhwBase.money ?? rhwBase.credits ?? rhwBase.base_money;
  const cargo = rhwBase.cargospace ?? rhwBase.cargo_space ?? rhwBase.cargo_space_left ?? rhwBase.storage_free;
  return {
    tag: 'RHW FINANCE DESK',
    text: `TREASURY STANDS AT ${formatCurrency(money)} // AVAILABLE STORAGE ${Number.isFinite(Number(cargo)) ? number(cargo) : 'UNKNOWN'} UNITS`,
    tone: 'lore'
  };
}

function buildRemoteMarketMessage(facilityKey) {
  const facility = REMOTE_FACILITIES.find(entry => entry.key === facilityKey);
  if (!facility) return { tag: 'REMOTE MARKET', text: 'UNKNOWN FACILITY CONFIGURATION', tone: 'danger' };

  const base = remoteBases.get(facility.key);
  if (!base || !Array.isArray(base.shop_items)) {
    return {
      tag: `${facility.system.toUpperCase()} MARKET`,
      text: `${facility.name.toUpperCase()} QUOTATION FEED UNAVAILABLE`,
      tone: 'danger'
    };
  }

  const parts = facility.targets.map(targetName => {
    const item = base.shop_items.find(entry => commodityKey(entry) === targetName);
    if (!item) return `${displayRecipeName(targetName).toUpperCase()} UNLISTED`;
    const price = priceBuy(item);
    const isPrimary = keyFromName(targetName) === keyFromName(facility.statusTarget);
    const amount = isPrimary ? sellableStock(item) : quantity(item);
    const label = isPrimary ? ' FOR SALE' : '';
    return `${displayName(item).toUpperCase()} ${number(amount)}${label}${price > 0 ? ` @ ${formatCurrency(price)}` : ''}`;
  });

  const primaryItem = base.shop_items.find(entry => commodityKey(entry) === keyFromName(facility.statusTarget));
  const primaryAvailable = Boolean(primaryItem && sellableStock(primaryItem) > 0);

  return {
    tag: `${facility.system.toUpperCase()} MARKET`,
    text: `${facility.name.toUpperCase()} // ${parts.join(' // ')}`,
    tone: primaryAvailable ? 'remote' : 'warn'
  };
}

function buildProductionDeskMessage(recipeAnalyses) {
  const blocked = recipeAnalyses.filter(analysis => analysis.possibleCycles <= 0);
  const readyCount = recipeAnalyses.length - blocked.length;

  if (blocked.length) {
    const recovery = blocked
      .filter(analysis => analysis.bottleneck)
      .sort((a, b) => a.nextCycleGap - b.nextCycleGap)[0];
    const recoveryText = recovery?.bottleneck
      ? `NEXT RECOVERY TARGET ${escapeHTML(recovery.bottleneck.name).toUpperCase()} +${number(recovery.nextCycleGap)}`
      : 'RECOVERY INPUT UNDER REVIEW';
    return {
      tag: 'RHW PRODUCTION DESK',
      text: `${readyCount} OF ${recipeAnalyses.length} LINES AVAILABLE // ${recoveryText}`,
      tone: blocked.length >= Math.ceil(recipeAnalyses.length / 2) ? 'danger' : 'warn'
    };
  }

  const lowestReady = recipeAnalyses.reduce((lowest, current) => current.possibleCycles < lowest.possibleCycles ? current : lowest);
  return {
    tag: 'RHW PRODUCTION DESK',
    text: `ALL ${recipeAnalyses.length} LINES READY // LOWEST INPUT RESERVE SUPPORTS ${number(lowestReady.possibleCycles)} CYCLES`,
    tone: lowestReady.possibleCycles < 10 ? 'warn' : 'good'
  };
}

function buildIndustrialNewswireMessages() {
  if (!rhwBase) {
    return Array.from({ length: TICKER_DYNAMIC_SLOT_COUNT }, (_, index) => ({
      tag: index === 0 ? 'BMM NEWSWIRE' : 'EDITORIAL DESK',
      text: index === 0 ? 'AWAITING INITIAL TELEMETRY BURST' : 'ASSEMBLING MARKET AND REGIONAL BULLETINS',
      tone: index === 0 ? 'warn' : 'muted'
    }));
  }

  const recipeAnalyses = RECIPES.map(analyzeRecipe);
  const messages = [...buildPriorityWire(recipeAnalyses)];
  const usedTexts = new Set(messages.map(message => message.text));

  [
    buildFinanceDeskMessage(),
    ...REMOTE_FACILITIES.map(facility => buildRemoteMarketMessage(facility.key)),
    buildProductionDeskMessage(recipeAnalyses)
  ].forEach(message => {
    messages.push(message);
    usedTexts.add(message.text);
  });

  ['market', 'regional', 'security', 'operations', 'corporate'].forEach(category => {
    const message = pickNewswireMessage(category, [...usedTexts]);
    messages.push(message);
    usedTexts.add(message.text);
  });

  const extraCategories = ['market', 'regional', 'operations', 'security', 'corporate'];
  let extraIndex = 0;
  while (messages.length < TICKER_DYNAMIC_SLOT_COUNT) {
    const category = extraCategories[extraIndex % extraCategories.length];
    const message = pickNewswireMessage(category, [...usedTexts]);
    messages.push(message);
    usedTexts.add(message.text);
    extraIndex++;
  }

  return messages.slice(0, TICKER_DYNAMIC_SLOT_COUNT);
}

function updateNetworkFeed(mode = 'live', errorMessage = '') {
  if (!FEATURES.newswire) return;
  if (!tickerContainer) return;
  if (mode === 'loading') {
    updateTickerSlot(0, { tag: 'BMM NEWSWIRE', text: 'TELEMETRY BURST IN PROGRESS // MARKET DESKS STANDING BY', tone: 'warn' });
    return;
  }
  if (mode === 'error') {
    const staleTime = lastLoaded ? lastLoaded.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'NONE';
    updateTickerSlot(0, { tag: 'PRIORITY / UPLINK', text: `DARKSTAT CONNECTION LOST // ${String(errorMessage || 'UNKNOWN TELEMETRY ERROR').toUpperCase()}`, tone: 'danger' });
    updateTickerSlot(1, { tag: 'RHW CACHE', text: `DISPLAYING LAST VERIFIED DATA // SYNC ${staleTime}`, tone: lastLoaded ? 'warn' : 'danger' });
    return;
  }
  updateTickerSlots(buildIndustrialNewswireMessages());
}

