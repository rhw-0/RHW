'use strict';
const assert = require('assert');
const path = require('path');

global.window = globalThis;
const memory = new Map();
const baseEntries = [
  { id: 'a', category: 'operations', tone: 'good', tag: 'ALPHA', message: 'BASE ONE' },
  { id: 'b', category: 'operations', tone: 'good', tag: 'BRAVO', message: 'BASE TWO' },
  { id: 'c', category: 'security', tone: 'warn', tag: 'CHARLIE', message: 'BASE THREE' }
];
const currentEntries = [
  { ...baseEntries[1], message: 'EDITED TWO' },
  baseEntries[0],
  { id: 'd', category: 'market', tone: 'lore', tag: 'DELTA', message: 'ADDED FOUR' }
];

const manager = {
  state: {
    entries: currentEntries.map(entry => ({ ...entry })),
    baseEntries: baseEntries.map(entry => ({ ...entry })),
    baseHash: 'abc12345', sourceMode: 'repository', loaded: true,
    dirty: true, draftSourceChanged: false
  },
  serializeSource(entries = null) {
    return (entries || this.state.entries).map(entry => `- [${entry.tag} | ${entry.tone}] ${entry.message}`).join('\n') + '\n';
  },
  restoreDraft(raw) {
    this.state.entries = raw.entries.map(entry => ({ ...entry }));
    this.state.dirty = true;
    return raw;
  }
};

global.RHWV4 = {
  version: 'V4.0.2',
  config: { repository: 'PhyteHQ/RHW', storageKeys: { newswireReviewHistory: 'test:newswire-history' } },
  util: { escape: value => String(value), copy: async () => true },
  store: {
    get: (key, fallback) => memory.has(key) ? memory.get(key) : fallback,
    set: (key, value) => { memory.set(key, JSON.parse(JSON.stringify(value))); return true; },
    remove: key => { memory.delete(key); return true; }
  },
  newswireManager: manager,
  newswire2: {
    auditEntries(entries) {
      return { byId: new Map(entries.map(entry => [entry.id, { status: 'ready', duplicate: false, reasons: [] }])), ready: entries.length, review: 0, duplicates: 0, issues: 0 };
    },
    buildForumBbcode(entry) { return `[quote][b]${entry.tag}[/b]\n${entry.message}[/quote]`; }
  }
};

require(path.join(__dirname, '..', 'js', '29-app-v40-newswire-review.js'));
const review = RHWV4.newswireReview;
assert(review, 'Newswire Review API must register');

const diff = review.diffEntries(baseEntries, currentEntries);
assert.strictEqual(diff.added.length, 1, 'One bulletin must be reported as added');
assert.strictEqual(diff.edited.length, 1, 'One bulletin must be reported as edited');
assert.strictEqual(diff.deleted.length, 1, 'One bulletin must be reported as deleted');
assert.strictEqual(diff.moved.length, 1, 'One unchanged bulletin must be reported as moved');

const payload = review.buildReviewPackage();
assert.strictEqual(payload.format, 'rhw-newswire-review-package', 'Review package format must be explicit');
assert.strictEqual(payload.repository.name, 'PhyteHQ/RHW', 'Review package must target the RHW repository');
assert.strictEqual(payload.repository.base, 'main', 'Review package must target main');
assert.strictEqual(payload.summary.added, 1, 'Package summary must use the canonical diff');
assert.strictEqual(payload.summary.edited, 1, 'Package summary must include edits');
assert.strictEqual(payload.summary.deleted, 1, 'Package summary must include deletions');
assert.strictEqual(payload.summary.moved, 1, 'Package summary must include reordering');
assert.strictEqual(payload.qa.passed, true, 'Ready entries must pass QA');
assert.strictEqual(payload.handoff.directPublish, false, 'A review package must never publish automatically');
assert(payload.markdown.includes('EDITED TWO'), 'Package must contain canonical working-copy Markdown');
assert(payload.baseMarkdown.includes('BASE TWO'), 'Package must contain the reviewed base Markdown');
assert(payload.channels.some(channel => channel.forumBbcode.includes('DELTA')), 'Changed bulletins must carry matching Forum BBCode');

for (let index = 0; index < 10; index += 1) {
  manager.state.entries[0].message = `VERSION ${index}`;
  review.captureSnapshot({ force: true });
}
assert.strictEqual(review.readHistory().length, review.HISTORY_LIMIT, 'Version history must be capped locally');
assert(review.reportText().includes('This package does not publish automatically'), 'Review report must explain the controlled handoff');

manager.state.sourceMode = 'cache';
assert.throws(() => review.buildReviewPackage(), /RELOAD THE CURRENT REPOSITORY FILE/, 'Cached source must block review handoff even when its response was HTTP 200');

manager.state.sourceMode = 'fallback';
assert.throws(() => review.buildReviewPackage(), /RELOAD THE CURRENT REPOSITORY FILE/, 'Fallback data must block a GitHub handoff');

console.log('Newswire Review model passed: diff, QA gate, Forum parity, package safety and bounded local history');
