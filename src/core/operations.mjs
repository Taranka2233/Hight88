import { normalizeId } from './selection.mjs';

export class OperationRegistry {
  #active = new Map();

  begin(kind, snapshot = {}) {
    const id = `${kind}:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    const operation = Object.freeze({
      id,
      kind,
      token: Symbol(id),
      startedAt: Date.now(),
      snapshot: Object.freeze({ ...snapshot })
    });
    this.#active.set(id, operation);
    return operation;
  }

  isActive(operation) {
    return this.#active.get(operation?.id)?.token === operation?.token;
  }

  finish(operation) {
    if (this.isActive(operation)) this.#active.delete(operation.id);
  }

  cancelAll() {
    this.#active.clear();
  }

  get size() {
    return this.#active.size;
  }
}

export function withTimeout(promise, timeoutMs, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function mapWithConcurrency(items, limit, worker) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: safeLimit }, run));
  return results;
}

export function messageToClipboardLine(message) {
  const labels = {
    photo: '[Фото]',
    video: '[Видео]',
    file: `[Файл${message.fileName ? `: ${message.fileName}` : ''}]`,
    voice: '[Голосовое]',
    sticker: '[Стикер]',
    system: '[Системное сообщение]',
    ice: message.text ? message.text : '[ICE-сообщение]'
  };
  return message.type === 'text' ? String(message.text ?? '') : (labels[message.type] ?? `[${message.type ?? 'Сообщение'}]`);
}

export async function copyMessages(messages, clipboard) {
  const text = messages.map(messageToClipboardLine).join('\n');
  await clipboard.writeText(text);
  return { copied: messages.length, text };
}

const ALLOWED_FORWARD_FIELDS = [
  'type', 'text', 'mediaUrl', 'thumbnailUrl', 'fileName', 'fileSize', 'mimeType',
  'durationMs', 'width', 'height', 'stickerId', 'caption', 'encryptionEnvelope'
];

export function createForwardDTO(message, { targetChatId, senderId, idempotencyKey }) {
  if (!message || message.deleted) throw new Error('Source message no longer exists');
  const dto = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    chatId: normalizeId(targetChatId),
    authorId: normalizeId(senderId),
    createdAt: null,
    status: 'sending',
    forwardedFrom: {
      chatId: normalizeId(message.chatId),
      messageId: normalizeId(message.id),
      authorId: normalizeId(message.authorId)
    },
    idempotencyKey
  };
  for (const field of ALLOWED_FORWARD_FIELDS) {
    if (message[field] !== undefined) dto[field] = structuredClone(message[field]);
  }
  return dto;
}

export async function deleteMessages({ messages, canDelete, repository, operation, registry, timeoutMs = 9000, concurrency = 4 }) {
  const immutable = Object.freeze(messages.map((message) => Object.freeze({ ...message })));
  const allowed = immutable.filter(canDelete);
  const denied = immutable.filter((message) => !canDelete(message)).map((message) => ({ id: normalizeId(message.id), reason: 'permission-denied' }));
  const settled = await mapWithConcurrency(allowed, concurrency, async (message) => {
    if (!registry.isActive(operation)) throw new Error('operation-cancelled');
    const key = `${operation.id}:${normalizeId(message.id)}`;
    await withTimeout(repository.deleteMessage(message.chatId, message.id, key), timeoutMs, 'delete-message');
    if (!registry.isActive(operation)) throw new Error('stale-operation');
    return normalizeId(message.id);
  });
  const deleted = [];
  const failed = [...denied];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') deleted.push(result.value);
    else failed.push({ id: normalizeId(allowed[index].id), reason: result.reason?.message ?? 'unknown' });
  });
  return { deleted, failed };
}

export async function forwardMessages({ messages, targetChatId, senderId, repository, operation, registry, timeoutMs = 12000, concurrency = 3 }) {
  const immutable = Object.freeze(messages.map((message) => Object.freeze({ ...message })));
  const settled = await mapWithConcurrency(immutable, concurrency, async (message) => {
    if (!registry.isActive(operation)) throw new Error('operation-cancelled');
    const idempotencyKey = `${operation.id}:${normalizeId(message.id)}:${normalizeId(targetChatId)}`;
    const dto = createForwardDTO(message, { targetChatId, senderId, idempotencyKey });
    await withTimeout(repository.forwardMessage(dto), timeoutMs, 'forward-message');
    if (!registry.isActive(operation)) throw new Error('stale-operation');
    return normalizeId(message.id);
  });
  const forwarded = [];
  const failed = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') forwarded.push(result.value);
    else failed.push({ id: normalizeId(immutable[index].id), reason: result.reason?.message ?? 'unknown' });
  });
  return { forwarded, failed };
}

export async function pinMessage({ messages, repository, operation, registry, timeoutMs = 9000 }) {
  if (messages.length !== 1) throw new Error('Exactly one message must be selected');
  const message = Object.freeze({ ...messages[0] });
  await withTimeout(repository.pinMessage(message.chatId, message.id, operation.id), timeoutMs, 'pin-message');
  if (!registry.isActive(operation)) throw new Error('stale-operation');
  return normalizeId(message.id);
}
