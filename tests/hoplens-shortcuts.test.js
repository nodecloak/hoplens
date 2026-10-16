// Compact dashboard navigation must skip probe cards inside closed details.
import test from 'node:test';
import assert from 'node:assert/strict';
let cards = [];
let scrollTop = null;
globalThis.document = { addEventListener() {}, getElementById: () => ({ querySelectorAll: () => cards }) };
globalThis.window = { pageYOffset: 0, scrollTo: ({ top }) => { scrollTop = top; } };
const { navigateCards } = await import('../frontend/utils/shortcut.js');
const card = (visible, top) => {
  const attrs = new Map();
  return { getClientRects: () => visible ? [{}] : [], getBoundingClientRect: () => ({ top }),
    classList: { add() {}, remove() {} }, getAttribute: (key) => attrs.get(key),
    setAttribute: (key, value) => attrs.set(key, value), removeAttribute: (key) => attrs.delete(key) };
};
test('J/K skip hidden details and highlight a visible compact card', () => {
  const hidden = card(false, 0);
  const visible = card(true, 500);
  cards = [hidden, visible];
  navigateCards('down');
  assert.equal(hidden.getAttribute('data-keyboard-hover'), undefined);
  assert.equal(visible.getAttribute('data-keyboard-hover'), 'true');
  assert.equal(scrollTop, 300);
});
test('an empty dashboard does not throw or scroll', () => {
  cards = [];
  scrollTop = null;
  assert.doesNotThrow(() => navigateCards('down'));
  assert.equal(scrollTop, null);
});
