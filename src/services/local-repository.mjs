import { demoChats, demoMessages } from '../data/demo-data.mjs';

const clone = (value) => structuredClone(value);
const wait = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
const createRepositoryId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class LocalRepository {
  #chats = clone(demoChats);
  #messages = clone(demoMessages);
  #listeners = new Map();
  #idempotency = new Set();

  async listChats() {
    await wait();
    return clone(this.#chats);
  }

  subscribeMessages(chatId, callback) {
    const key = String(chatId);
    const listener = { callback, active: true };
    if (!this.#listeners.has(key)) this.#listeners.set(key, new Set());
    this.#listeners.get(key).add(listener);
    queueMicrotask(() => listener.active && callback(clone(this.#messages[key] ?? []), { fromCache: false }));
    return () => {
      listener.active = false;
      this.#listeners.get(key)?.delete(listener);
      if (this.#listeners.get(key)?.size === 0) this.#listeners.delete(key);
    };
  }

  #emit(chatId) {
    const key = String(chatId);
    for (const listener of this.#listeners.get(key) ?? []) {
      if (listener.active) listener.callback(clone(this.#messages[key] ?? []), { fromCache: false });
    }
  }

  async sendMessage(chatId, draft, idempotencyKey) {
    await wait(110);
    if (this.#idempotency.has(idempotencyKey)) return;
    this.#idempotency.add(idempotencyKey);
    const key = String(chatId);
    this.#messages[key] ??= [];
    this.#messages[key].push({
      ...clone(draft),
      id: draft.id ?? createRepositoryId(),
      chatId: key,
      createdAt: Date.now(),
      time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
      status: 'sent'
    });
    this.#emit(key);
  }

  async deleteMessage(chatId, messageId, idempotencyKey) {
    await wait(95);
    if (this.#idempotency.has(idempotencyKey)) return;
    this.#idempotency.add(idempotencyKey);
    const key = String(chatId);
    const before = this.#messages[key] ?? [];
    if (!before.some((item) => String(item.id) === String(messageId))) throw new Error('message-not-found');
    this.#messages[key] = before.filter((item) => String(item.id) !== String(messageId));
    this.#emit(key);
  }

  async forwardMessage(dto) {
    await wait(110);
    if (this.#idempotency.has(dto.idempotencyKey)) return;
    this.#idempotency.add(dto.idempotencyKey);
    const key = String(dto.chatId);
    this.#messages[key] ??= [];
    this.#messages[key].push({ ...clone(dto), createdAt: Date.now(), time: 'сейчас', status: 'sent' });
    this.#emit(key);
  }

  async pinMessage(chatId, messageId, idempotencyKey) {
    await wait(90);
    if (this.#idempotency.has(idempotencyKey)) return;
    this.#idempotency.add(idempotencyKey);
    const key = String(chatId);
    if (!(this.#messages[key] ?? []).some((item) => String(item.id) === String(messageId))) throw new Error('message-not-found');
    this.#chats = this.#chats.map((chat) => String(chat.id) === key ? { ...chat, pinnedMessageId: String(messageId) } : chat);
  }
}
