import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationRegistry, copyMessages, createForwardDTO, deleteMessages, forwardMessages, mapWithConcurrency, withTimeout } from '../src/core/operations.mjs';

test('copy creates readable media labels', async () => {
  let captured = '';
  const result = await copyMessages([{ type: 'text', text: 'hello' }, { type: 'photo' }, { type: 'file', fileName: 'map.bin' }, { type: 'voice' }], { writeText: async (value) => { captured = value; } });
  assert.equal(result.copied, 4);
  assert.equal(captured, 'hello\n[Фото]\n[Файл: map.bin]\n[Голосовое]');
});

test('failed clipboard write propagates and can preserve selection in caller', async () => {
  await assert.rejects(copyMessages([{ type: 'text', text: 'x' }], { writeText: async () => { throw new Error('denied'); } }), /denied/);
});

test('forward DTO whitelists fields and strips unsafe source state', () => {
  const dto = createForwardDTO({ id: 'm1', chatId: 'c1', authorId: 'u1', type: 'text', text: 'safe', replyTo: {}, ghostAt: 1, reactions: {}, comments: [], uiSelected: true, internalKey: 'secret' }, { targetChatId: 'c2', senderId: 'me', idempotencyKey: 'key' });
  assert.equal(dto.text, 'safe');
  assert.equal(dto.chatId, 'c2');
  for (const field of ['replyTo', 'ghostAt', 'reactions', 'comments', 'uiSelected', 'internalKey']) assert.equal(field in dto, false, field);
});

test('delete supports partial success and permission denial', async () => {
  const registry = new OperationRegistry();
  const operation = registry.begin('delete');
  const repository = { deleteMessage: async (_chatId, messageId) => { if (messageId === 'fail') throw new Error('firebase-timeout'); } };
  const result = await deleteMessages({
    messages: [{ id: 'ok', chatId: 'c' }, { id: 'fail', chatId: 'c' }, { id: 'denied', chatId: 'c' }],
    canDelete: (message) => message.id !== 'denied', repository, operation, registry, timeoutMs: 100, concurrency: 2
  });
  assert.deepEqual(result.deleted, ['ok']);
  assert.equal(result.failed.length, 2);
  assert.ok(result.failed.some((item) => item.id === 'denied' && item.reason === 'permission-denied'));
  assert.ok(result.failed.some((item) => item.id === 'fail'));
});

test('double action can be guarded by one active operation token', () => {
  const registry = new OperationRegistry();
  const first = registry.begin('delete');
  assert.equal(registry.isActive(first), true);
  registry.finish(first);
  assert.equal(registry.isActive(first), false);
});

test('cancelled operation cannot mutate after navigation', async () => {
  const registry = new OperationRegistry();
  const operation = registry.begin('delete');
  registry.cancelAll();
  const result = await deleteMessages({ messages: [{ id: '1', chatId: 'c' }], canDelete: () => true, repository: { deleteMessage: async () => {} }, operation, registry });
  assert.equal(result.deleted.length, 0);
  assert.match(result.failed[0].reason, /operation-cancelled/);
});

test('forward retry uses stable idempotency key per operation and source', async () => {
  const keys = [];
  const registry = new OperationRegistry();
  const operation = registry.begin('forward');
  const result = await forwardMessages({
    messages: [{ id: 'm1', chatId: 'source', authorId: 'a', type: 'text', text: 'x' }], targetChatId: 'target', senderId: 'me',
    repository: { forwardMessage: async (dto) => keys.push(dto.idempotencyKey) }, operation, registry
  });
  assert.equal(result.forwarded.length, 1);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /m1:target$/);
});

test('withTimeout rejects stalled Firebase operation', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 15, 'firebase'), /timed out/);
});

test('concurrency mapper preserves input order', async () => {
  const result = await mapWithConcurrency([3, 1, 2], 2, async (value) => { await new Promise((resolve) => setTimeout(resolve, value)); return value * 2; });
  assert.deepEqual(result.map((item) => item.value), [6, 2, 4]);
});

test('forward supports partial success without duplicating successful items', async () => {
  const registry = new OperationRegistry();
  const operation = registry.begin('forward');
  const seen = new Set();
  const result = await forwardMessages({
    messages: [
      { id: 'ok', chatId: 'source', authorId: 'a', type: 'text', text: 'ok' },
      { id: 'fail', chatId: 'source', authorId: 'a', type: 'text', text: 'fail' }
    ],
    targetChatId: 'target', senderId: 'me', operation, registry,
    repository: {
      forwardMessage: async (dto) => {
        if (dto.forwardedFrom.messageId === 'fail') throw new Error('source-disappeared');
        if (seen.has(dto.idempotencyKey)) throw new Error('duplicate');
        seen.add(dto.idempotencyKey);
      }
    }
  });
  assert.deepEqual(result.forwarded, ['ok']);
  assert.deepEqual(result.failed.map((item) => item.id), ['fail']);
  assert.equal(seen.size, 1);
});
