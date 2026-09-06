#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const memory = new Map();
let uid = 0;
let verified = false;
const stock = new Map([['steel', 10], ['copper', 100]]);
const productNames = new Map([['alpha', 'Alpha Assembly'], ['beta', 'Beta Assembly']]);

const app = {
  config: {
    storageKeys: { productionOrders: 'test:production-orders' },
    operations: { defaultAffiliation: 'br_m_grp' },
    forum: {
      logoUrl: 'https://example.invalid/rhw.png', organisation: 'RESOLUTION HEAVY WORKS',
      subline: 'TEST YARD', brandColor: '#d4af37', textColor: '#E0E0E0', mutedColor: '#808080',
      footerColor: '#555555', footerMotto: 'TEST REPORT'
    }
  },
  util: {
    escape: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    number: value => String(Number(value) || 0),
    uid: prefix => `${prefix}-${++uid}`
  },
  store: {
    get: (key, fallback = null) => memory.has(key) ? JSON.parse(JSON.stringify(memory.get(key))) : fallback,
    set: (key, value) => { memory.set(key, JSON.parse(JSON.stringify(value))); return true; }
  },
  notify() {}
};

app.operationsCore = {
  state: { catalog: { factions: [{ id: 'br_m_grp', name: 'BMM' }] } },
  product: id => ({ id, name: productNames.get(id) || id }),
  recipe: id => ({ id, name: `${id} recipe` }),
  telemetryReady: () => verified,
  telemetryQuantity: item => stock.get(item.id) || 0,
  buildPlan(options) {
    const multiplier = options.productId === 'alpha' ? 2 : 3;
    const rows = [{ item: { id: 'steel', name: 'Steel' }, required: options.quantity * multiplier }];
    if (options.productId === 'alpha') rows.push({ item: { id: 'copper', name: 'Copper' }, required: options.quantity });
    return {
      product: this.product(options.productId), rootRecipe: this.recipe(options.recipeId),
      actualOutput: options.quantity, directRequirements: rows
    };
  }
};

global.window = { RHWV4: app, telemetrySnapshot: () => ({ available: verified, stale: verified, fetchedAt: '2026-09-01T00:00:00.000Z', label: verified ? 'CACHED STOCK' : 'AWAITING VERIFIED TELEMETRY', detail: verified ? 'CACHED STOCK // SNAPSHOT 2026-09-01T00:00:00.000Z' : 'AWAITING VERIFIED TELEMETRY', tone: 'warn' }) };
global.document = { getElementById: () => null, querySelector: () => null };
require(path.join(__dirname, '..', 'js', '27-app-v40-production-orders.js'));

const api = app.productionOrders;
assert.ok(api, 'Production Order API must register');

api.clear();
const alpha = api.add({ productId: 'alpha', recipeId: 'recipe-alpha', productName: 'Alpha Assembly', quantity: 2, affiliationId: 'br_m_grp', priority: 'normal' });
const beta = api.add({ productId: 'beta', recipeId: 'recipe-beta', productName: 'Beta Assembly', quantity: 3, affiliationId: 'br_m_grp', priority: 'urgent' });
let report = api.buildReport();
assert.equal(report.orders.length, 2);
assert.equal(report.orders[0].order.id, beta.id, 'Urgent order must sort first');
assert.equal(report.totalOutput, 5);
assert.equal(report.materials.find(row => row.id === 'steel').required, 13, 'Shared steel must aggregate across orders');
assert.equal(report.materials.find(row => row.id === 'copper').required, 2);
assert.equal(report.materials.find(row => row.id === 'steel').stock, null, 'Unverified stock must stay unknown');
assert.match(api.buildBbcode(report), /AWAITING VERIFIED/);
assert.match(api.buildBbcode(report), /Alpha Assembly/);
assert.match(api.buildBbcode(report), /Beta Assembly/);
assert.ok(!JSON.stringify(api.snapshot()).includes('materialPrices'), 'Orders must not persist calculator prices');

verified = true;
report = api.buildReport();
assert.equal(report.materials.find(row => row.id === 'steel').deficit, 3);
assert.equal(report.materials.find(row => row.id === 'copper').deficit, 0);
assert.equal(report.bottlenecks, 1);

api.importOrders([{ ...alpha, quantity: 4, updatedAt: alpha.updatedAt + 1000 }]);
assert.equal(api.snapshot().length, 2, 'Import must merge instead of deleting current orders');
assert.equal(api.snapshot().find(order => order.id === alpha.id).quantity, 4, 'Newer imported order must win by id');

api.remove(beta.id);
assert.equal(api.snapshot().length, 1);
api.clear();
assert.deepEqual(api.snapshot(), []);

// Overflow must be rejected atomically, including batches with duplicate IDs.
const full = Array.from({ length: 100 }, (_, i) => ({ ...alpha, id: `existing-${i}`, createdAt: i + 1, updatedAt: i + 1 }));
api.restore(full);
const before = JSON.stringify(api.snapshot());
const savedBefore = JSON.stringify(memory.get('test:production-orders'));
assert.throws(() => api.importOrders([{ ...beta, id: 'new-101' }]), /LIMIT 100/);
assert.equal(JSON.stringify(api.snapshot()), before, 'Overflow must keep every existing order');
assert.equal(JSON.stringify(memory.get('test:production-orders')), savedBefore, 'Rejected import must not write storage');
api.importOrders([{ ...full[0], quantity: 8, updatedAt: 1000 }]);
assert.equal(api.snapshot().length, 100, 'Updates to existing IDs fit at the limit');
assert.equal(api.snapshot().find(order => order.id === 'existing-0').quantity, 8);
assert.throws(() => api.importOrders(Array.from({length: 250}, (_, i) => ({ ...beta, id: `large-${i}` }))), /LIMIT 100/);
const staleReport = api.buildReport();
assert.match(api.buildBbcode(staleReport), /CACHED STOCK/);
assert.match(api.buildBbcode(staleReport), /2026-09-01T00:00:00.000Z/);
assert.doesNotMatch(api.buildBbcode(staleReport), /VERIFIED STOCK \/\//);
const savedSet = app.store.set;
app.store.set = () => false;
const beforeFailure = JSON.stringify(api.snapshot());
assert.throws(() => api.importOrders([{ ...full[1], quantity: 77, updatedAt: 2000 }]), /NOT SAVED/);
assert.equal(JSON.stringify(api.snapshot()), beforeFailure, 'Storage failure must keep the active queue');
app.store.set = savedSet;

console.log('Production Order tests passed: priority, aggregation, telemetry truth-state, BBCode parity and safe import merge.');
