import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageCapabilities, aggregateCapabilities } from '../src/core/capabilities.mjs';

const base = { message: { id: '1', type: 'text', authorId: 'me' }, chat: { type: 'group' }, currentUserId: 'me', currentUserRole: 'member', encryptionState: 'ready', networkState: 'online' };

test('author can edit and delete own text message', () => {
  const caps = getMessageCapabilities(base);
  assert.equal(caps.editable, true);
  assert.equal(caps.deletable, true);
});

test('ordinary member cannot delete or pin other users group messages', () => {
  const caps = getMessageCapabilities({ ...base, message: { ...base.message, authorId: 'other' } });
  assert.equal(caps.deletable, false);
  assert.equal(caps.pinnable, false);
});

test('admin can moderate group messages', () => {
  const caps = getMessageCapabilities({ ...base, message: { ...base.message, authorId: 'other' }, currentUserRole: 'admin' });
  assert.equal(caps.deletable, true);
  assert.equal(caps.pinnable, true);
});

test('system messages cannot be copied forwarded edited pinned or deleted', () => {
  const caps = getMessageCapabilities({ ...base, message: { type: 'system', authorId: 'system' }, currentUserRole: 'owner' });
  for (const key of ['copyable', 'forwardable', 'editable', 'pinnable', 'deletable']) assert.equal(caps[key], false, key);
});

test('undecrypted E2E message cannot be copied or forwarded', () => {
  const caps = getMessageCapabilities({ ...base, message: { ...base.message, encrypted: true, decrypted: false } });
  assert.equal(caps.copyable, false);
  assert.equal(caps.forwardable, false);
});

test('offline state blocks server mutations but keeps local copy', () => {
  const caps = getMessageCapabilities({ ...base, networkState: 'offline' });
  assert.equal(caps.copyable, true);
  assert.equal(caps.deletable, false);
  assert.equal(caps.editable, false);
  assert.equal(caps.pinnable, false);
});

test('aggregate pin only allows one message', () => {
  const messages = [{ ...base.message }, { ...base.message, id: '2' }];
  const aggregate = aggregateCapabilities(messages, () => ({ chat: base.chat, currentUserId: 'me', currentUserRole: 'admin', encryptionState: 'ready', networkState: 'online' }));
  assert.equal(aggregate.pinnable, false);
  assert.equal(aggregate.copyable, true);
});
