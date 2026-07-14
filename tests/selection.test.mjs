import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionState, selectionReducer, consumeSuppressedClick, selectedMessagesSnapshot } from '../src/core/selection.mjs';

function longPress(state, { pointerId = 1, chatId = 'c1', messageId = 'm1' } = {}) {
  state = selectionReducer(state, { type: 'POINTER_START', pointerId, chatId, messageId, x: 0, y: 0, selectable: true });
  return selectionReducer(state, { type: 'LONG_PRESS', pointerId, at: 1000 });
}

test('long press enters selecting state and normalizes ids', () => {
  const state = longPress(createSelectionState(), { chatId: 7, messageId: 42 });
  assert.equal(state.phase, 'selecting');
  assert.equal(state.chatId, '7');
  assert.deepEqual([...state.ids], ['42']);
});

test('selection stays bound to one chat', () => {
  let state = longPress(createSelectionState());
  state = selectionReducer(state, { type: 'TOGGLE', chatId: 'c2', messageId: 'm2', selectable: true });
  assert.deepEqual([...state.ids], ['m1']);
  assert.equal(state.chatId, 'c1');
});

test('toggling one id does not clear other ids', () => {
  let state = longPress(createSelectionState());
  state = selectionReducer(state, { type: 'TOGGLE', chatId: 'c1', messageId: 'm2', selectable: true });
  state = selectionReducer(state, { type: 'TOGGLE', chatId: 'c1', messageId: 'm1', selectable: true });
  assert.equal(state.phase, 'selecting');
  assert.deepEqual([...state.ids], ['m2']);
});

test('removing last selected id closes selection mode', () => {
  let state = longPress(createSelectionState());
  state = selectionReducer(state, { type: 'TOGGLE', chatId: 'c1', messageId: 'm1', selectable: true });
  assert.equal(state.phase, 'idle');
  assert.equal(state.ids.size, 0);
  assert.equal(state.chatId, null);
});

test('pointer movement cancels long press', () => {
  let state = selectionReducer(createSelectionState(), { type: 'POINTER_START', pointerId: 1, chatId: 'c1', messageId: 'm1', x: 0, y: 0, selectable: true });
  state = selectionReducer(state, { type: 'POINTER_MOVE', pointerId: 1, x: 30, y: 0 });
  state = selectionReducer(state, { type: 'LONG_PRESS', pointerId: 1 });
  assert.equal(state.phase, 'idle');
});

test('synthetic click is suppressed only for same pointer and message', () => {
  let state = longPress(createSelectionState(), { pointerId: 9, messageId: 'm1' });
  let result = consumeSuppressedClick(state, { pointerId: 8, chatId: 'c1', messageId: 'm1', at: 1200 });
  assert.equal(result.suppressed, false);
  result = consumeSuppressedClick(result.state, { pointerId: 9, chatId: 'c1', messageId: 'm2', at: 1200 });
  assert.equal(result.suppressed, false);
  result = consumeSuppressedClick(result.state, { pointerId: 9, chatId: 'c1', messageId: 'm1', at: 1200 });
  assert.equal(result.suppressed, true);
});

test('reconcile removes messages deleted on another device', () => {
  let state = longPress(createSelectionState());
  state = selectionReducer(state, { type: 'TOGGLE', chatId: 'c1', messageId: 'm2', selectable: true });
  state = selectionReducer(state, { type: 'RECONCILE', chatId: 'c1', messageIds: ['m2', 'm3'] });
  assert.deepEqual([...state.ids], ['m2']);
});

test('reconcile closes mode when every selected message disappeared', () => {
  let state = longPress(createSelectionState());
  state = selectionReducer(state, { type: 'RECONCILE', chatId: 'c1', messageIds: ['other'] });
  assert.equal(state.phase, 'idle');
});

test('navigation, background and logout clear selection', () => {
  for (const type of ['CHAT_CHANGED', 'CHAT_LIST_OPENED', 'BACKGROUND', 'LOGOUT']) {
    const state = selectionReducer(longPress(createSelectionState()), { type });
    assert.equal(state.phase, 'idle', type);
    assert.equal(state.ids.size, 0, type);
  }
});

test('snapshot is immutable and only contains selected messages', () => {
  let state = longPress(createSelectionState());
  const snapshot = selectedMessagesSnapshot(state, [{ id: 'm1', text: 'A' }, { id: 'm2', text: 'B' }]);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].text, 'A');
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot[0]), true);
});

test('supports 100 selected messages without cross-chat leakage', () => {
  let state = createSelectionState();
  for (let i = 0; i < 100; i++) state = selectionReducer(state, { type: 'TOGGLE', chatId: 'bulk', messageId: i, selectable: true });
  assert.equal(state.ids.size, 100);
  assert.equal(state.chatId, 'bulk');
});

test('reconciles selection against 1000-message dataset', () => {
  let state = createSelectionState();
  for (let i = 0; i < 100; i++) state = selectionReducer(state, { type: 'TOGGLE', chatId: 'large', messageId: i * 5, selectable: true });
  const messageIds = Array.from({ length: 1000 }, (_, index) => String(index)).filter((id) => Number(id) % 25 !== 0);
  state = selectionReducer(state, { type: 'RECONCILE', chatId: 'large', messageIds });
  assert.equal(state.ids.size, 80);
  assert.ok([...state.ids].every((id) => Number(id) % 25 !== 0));
});
