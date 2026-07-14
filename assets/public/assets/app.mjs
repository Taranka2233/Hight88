import { createSelectionState, selectionReducer, consumeSuppressedClick, selectedMessagesSnapshot, LONG_PRESS_MS } from '../src/core/selection.mjs';
import { getMessageCapabilities, aggregateCapabilities } from '../src/core/capabilities.mjs';
import { OperationRegistry, copyMessages, deleteMessages, forwardMessages, pinMessage } from '../src/core/operations.mjs';
import { currentUser } from '../src/data/demo-data.mjs';
import { LocalRepository } from '../src/services/local-repository.mjs';

const app = document.querySelector('#app');
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const repository = new LocalRepository();
const operations = new OperationRegistry();
let unsubscribeMessages = null;
let subscriptionToken = 0;
let pointerTimer = null;
let voiceRequestToken = 0;
let activeMediaStream = null;
let toastSequence = 0;

const state = {
  authenticated: localStorage.getItem('ncn.authenticated') === 'true',
  authMode: 'login',
  chats: [],
  messages: new Map(),
  activeChatId: null,
  selection: createSelectionState(),
  chatFilter: 'all',
  chatSearch: '',
  messageSearch: '',
  overlay: null,
  overlayPayload: null,
  replyDraft: null,
  draftByChat: JSON.parse(localStorage.getItem('ncn.drafts') || '{}'),
  networkState: navigator.onLine ? 'online' : 'offline',
  actionBusy: null,
  voice: { phase: 'idle', startedAt: null, elapsedMs: 0 },
  toasts: [],
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  settings: {
    compact: localStorage.getItem('ncn.compact') === 'true',
    effects: localStorage.getItem('ncn.effects') !== 'false',
    readReceipts: localStorage.getItem('ncn.receipts') !== 'false'
  }
};

const icons = {
  chats: '<path d="M5 6.5h14v9H9l-4 3v-12Z"/><path d="M8 10h8M8 13h5"/>',
  contacts: '<circle cx="12" cy="8" r="3"/><path d="M5.5 19c.7-3.3 2.9-5 6.5-5s5.8 1.7 6.5 5"/>',
  bookmark: '<path d="M7 4h10v16l-5-3-5 3V4Z"/>',
  archive: '<path d="M4 7h16M6 7v12h12V7M3 4h18v3H3zM10 11h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7L10.5 2h-3l-.7 2.3a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7L-1 10.5v3l2.3.7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2.3h3l.7-2.3a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7l2.3-.7Z" transform="translate(2) scale(.83)"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  phone: '<path d="M7 3 4 5c-.4 6.8 7.2 14.4 14 14l2-3-4-3-2 2c-2.4-.8-4.2-2.6-5-5l2-2-4-5Z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  forward: '<path d="m14 7 5 5-5 5"/><path d="M19 12H9a5 5 0 0 0-5 5v2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  pin: '<path d="m9 4 6 6M8 11l-4 4 5 1 1 5 4-4M14 5l5 5-4 4-5-5 4-4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  paperclip: '<path d="m8 12 6-6a4 4 0 0 1 6 6l-8 8a6 6 0 0 1-9-9l8-8"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 2 2.3 3 4 3s3-1 4-3M9 9h.01M15 9h.01"/>',
  send: '<path d="m4 4 17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  play: '<path d="m9 7 8 5-8 5V7Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  bell: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4L6 16ZM10 19h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 20"/>',
  file: '<path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v5h5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  userPlus: '<path d="M15 19c-.6-3-2.6-4.5-6-4.5S3.6 16 3 19M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM18 8v6M15 11h6"/>',
  logout: '<path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  wifi: '<path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0M10 15a3 3 0 0 1 4 0M12 19h.01"/>',
  muted: '<path d="M11 5 7 9H3v6h4l4 4V5ZM16 9l5 6M21 9l-5 6"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3.3-4-6-9-6Z"/><circle cx="7" cy="10" r="1"/><circle cx="9" cy="6" r="1"/><circle cx="14" cy="6" r="1"/><circle cx="17" cy="9" r="1"/>',
  shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l3 3M17 6l2 2"/>'
};

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? icons.info}</svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatBytes(value = 0) {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 ** 2).toFixed(1)} МБ`;
}

function formatDuration(ms = 0) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function activeChat() {
  return state.chats.find((chat) => String(chat.id) === String(state.activeChatId)) ?? null;
}

function activeMessages() {
  return state.messages.get(String(state.activeChatId)) ?? [];
}

function capabilitiesFor(message) {
  const chat = activeChat();
  return getMessageCapabilities({
    message,
    chat,
    currentUserId: currentUser.id,
    currentUserRole: chat?.role ?? 'member',
    encryptionState: 'ready',
    networkState: state.networkState
  });
}

function setSelection(nextSelection, shouldRender = true) {
  const entering = state.selection.phase !== 'selecting' && nextSelection.phase === 'selecting';
  state.selection = nextSelection;
  if (entering) {
    state.replyDraft = state.replyDraft;
    cancelVoice('selection');
  }
  if (shouldRender) render();
}

function clearSelection(reason = 'CLEAR') {
  operations.cancelAll();
  state.actionBusy = null;
  setSelection(selectionReducer(state.selection, { type: reason }));
}

function toast(title, detail = '', type = 'info') {
  const id = ++toastSequence;
  state.toasts.push({ id, title, detail, type });
  renderToasts();
  setTimeout(() => {
    state.toasts = state.toasts.filter((item) => item.id !== id);
    renderToasts();
  }, 3400);
}

function renderToasts() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.append(stack);
  }
  stack.innerHTML = state.toasts.map((item) => `<div class="toast ${item.type === 'error' ? 'error' : ''}"><div class="toast-title">${escapeHtml(item.title)}</div>${item.detail ? `<div class="toast-detail">${escapeHtml(item.detail)}</div>` : ''}</div>`).join('');
}

async function initialize() {
  state.chats = await repository.listChats();
  if (state.authenticated && !state.activeChatId && innerWidth > 850) selectChat(state.chats[0]?.id, false);
  render();
}

function selectChat(chatId, shouldRender = true) {
  const nextId = String(chatId);
  if (nextId === String(state.activeChatId)) return;
  operations.cancelAll();
  state.actionBusy = null;
  state.selection = selectionReducer(state.selection, { type: 'CHAT_CHANGED' });
  cancelVoice('navigation');
  unsubscribeMessages?.();
  unsubscribeMessages = null;
  state.activeChatId = nextId;
  state.replyDraft = null;
  const token = ++subscriptionToken;
  unsubscribeMessages = repository.subscribeMessages(nextId, (messages) => {
    if (token !== subscriptionToken || String(state.activeChatId) !== nextId) return;
    const normalized = messages.map((message) => ({ ...message, id: String(message.id), chatId: String(message.chatId) }));
    state.messages.set(nextId, normalized);
    state.selection = selectionReducer(state.selection, { type: 'RECONCILE', chatId: nextId, messageIds: normalized.map((message) => message.id) });
    render();
    requestAnimationFrame(() => scrollMessagesToBottom(false));
  });
  if (shouldRender) render();
}

function openChatList() {
  operations.cancelAll();
  state.selection = selectionReducer(state.selection, { type: 'CHAT_LIST_OPENED' });
  cancelVoice('navigation');
  state.activeChatId = null;
  unsubscribeMessages?.();
  unsubscribeMessages = null;
  subscriptionToken++;
  render();
}

function filteredChats() {
  const query = state.chatSearch.trim().toLocaleLowerCase('ru');
  return state.chats.filter((chat) => {
    const matchType = state.chatFilter === 'all' || chat.type === state.chatFilter || (state.chatFilter === 'unread' && chat.unread > 0);
    const matchQuery = !query || `${chat.title} ${chat.lastMessage}`.toLocaleLowerCase('ru').includes(query);
    return matchType && matchQuery;
  });
}

function renderAuth() {
  const register = state.authMode === 'register';
  return `<main class="auth-screen">
    <section class="auth-visual" aria-label="Night City Net">
      <div class="city-lines"></div>
      <div class="auth-message">
        <div class="auth-kicker">SECURE URBAN NETWORK // 01</div>
        <h1 class="auth-display">Night City<br><span>Net</span></h1>
        <p class="auth-copy">Приватная коммуникационная сеть для команд, сообществ и закрытых каналов. Тёмный интерфейс, надёжная синхронизация и контроль над каждым сообщением.</p>
      </div>
    </section>
    <section class="auth-panel">
      <form class="auth-card" data-action="auth-submit">
        <div class="auth-card-head">
          <div class="eyebrow">IDENTITY GATE</div>
          <h2 class="auth-card-title">${register ? 'Создать профиль' : 'Войти в сеть'}</h2>
          <p class="auth-card-text">${register ? 'Регистрация нового идентификатора Night City Net.' : 'Введите данные доступа к защищённому контуру.'}</p>
        </div>
        ${register ? `<div class="field"><label for="name">Имя в сети</label><input id="name" name="name" autocomplete="name" required placeholder="Vega" /></div>` : ''}
        <div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required placeholder="operator@ncn.net" /></div>
        <div class="field"><label for="password">Ключ доступа</label><input id="password" name="password" type="password" minlength="6" autocomplete="${register ? 'new-password' : 'current-password'}" required placeholder="••••••••••••" /></div>
        <button class="primary-button" type="submit">${register ? 'ЗАРЕГИСТРИРОВАТЬСЯ' : 'ПОДКЛЮЧИТЬСЯ'}</button>
        <div class="auth-foot">${register ? 'Уже есть профиль?' : 'Нужен новый профиль?'} <button type="button" data-action="auth-toggle">${register ? 'Войти' : 'Создать'}</button></div>
      </form>
    </section>
  </main>`;
}

function renderRail() {
  const items = [
    ['chats', 'Чаты', 'chats'],
    ['contacts', 'Контакты', 'contacts'],
    ['bookmark', 'Закладки', 'bookmarks'],
    ['archive', 'Архив', 'archive']
  ];
  return `<aside class="brand-rail" aria-label="Основная навигация">
    <div class="brand-mark" aria-label="NCN">NCN</div>
    <nav class="rail-nav">${items.map(([glyph, label, route], index) => `<button class="icon-button rail-button ${index === 0 && !state.overlay ? 'active' : ''}" data-open-overlay="${route}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`).join('')}</nav>
    <div class="rail-spacer"></div>
    <button class="icon-button rail-button" data-open-overlay="settings" aria-label="Настройки" title="Настройки">${icon('settings')}</button>
    <button class="avatar" data-open-overlay="profile" aria-label="Профиль ${escapeHtml(currentUser.name)}">${currentUser.avatar}</button>
  </aside>`;
}

function renderChatList() {
  const chats = filteredChats();
  const filters = [['all','Все'],['unread','Новые'],['direct','Личные'],['group','Группы'],['channel','Каналы']];
  return `<section class="chat-list-panel" aria-label="Список чатов">
    <header class="list-header">
      <div><div class="eyebrow">NIGHT CITY NET</div><h2 class="list-title">Сообщения</h2></div>
      <div class="connection-pill ${state.networkState === 'offline' ? 'offline' : ''}" title="${state.networkState === 'online' ? 'Подключено' : 'Нет сети'}"><span class="connection-dot"></span>${state.networkState === 'online' ? 'SYNC' : 'OFFLINE'}</div>
    </header>
    <div class="search-wrap">${icon('search')}<input class="search-input" data-role="chat-search" value="${escapeHtml(state.chatSearch)}" placeholder="Поиск людей и каналов" aria-label="Поиск чатов" /></div>
    <div class="filter-tabs" role="tablist">${filters.map(([id,label]) => `<button class="filter-tab ${state.chatFilter === id ? 'active' : ''}" data-chat-filter="${id}" role="tab" aria-selected="${state.chatFilter === id}">${label}</button>`).join('')}</div>
    <div class="chat-scroll">${chats.length ? chats.map(renderChatItem).join('') : `<div class="empty-state"><div class="empty-core"><div class="empty-title">Сигналов нет</div><div class="empty-text">Измените фильтр или поисковый запрос.</div></div></div>`}</div>
    <button class="fab" data-open-overlay="contacts" aria-label="Новый чат">${icon('plus')}</button>
  </section>`;
}

function renderChatItem(chat) {
  const type = chat.type === 'direct' ? 'DM' : chat.type === 'group' ? 'GRP' : 'CH';
  return `<button class="chat-item ${String(chat.id) === String(state.activeChatId) ? 'active' : ''}" data-chat-id="${escapeHtml(chat.id)}" aria-label="Открыть ${escapeHtml(chat.title)}">
    <span class="avatar ${chat.accent}">${escapeHtml(chat.avatar)}</span>
    <span class="chat-main"><span class="chat-line"><span class="chat-name">${escapeHtml(chat.title)}</span><span class="type-chip">${type}</span></span><span class="chat-preview">${escapeHtml(chat.lastMessage)}</span></span>
    <span class="chat-meta"><span>${escapeHtml(chat.lastAt)}</span>${chat.unread ? `<span class="unread">${chat.unread > 99 ? '99+' : chat.unread}</span>` : (chat.muted ? icon('muted') : '')}</span>
  </button>`;
}

function renderConversation() {
  const chat = activeChat();
  if (!chat) return `<section class="conversation-panel">${renderEmptyConversation()}</section>`;
  const messages = activeMessages();
  const selected = selectedMessagesSnapshot(state.selection, messages);
  const agg = aggregateCapabilities(selected, () => ({ chat, currentUserId: currentUser.id, currentUserRole: chat.role, encryptionState: 'ready', networkState: state.networkState }));
  return `<section class="conversation-panel" aria-label="Чат ${escapeHtml(chat.title)}">
    ${state.selection.phase === 'selecting' ? renderSelectionHeader(agg) : renderChatHeader(chat)}
    ${chat.pinnedMessageId ? renderPinnedBar(chat, messages) : ''}
    <div class="messages-scroll" data-role="messages-scroll" role="log" aria-label="Сообщения" tabindex="0">
      <div class="day-divider">Сегодня</div>
      ${messages.map((message) => renderMessage(message, chat)).join('')}
    </div>
    ${state.selection.phase === 'selecting' ? '' : renderComposer(chat)}
  </section>`;
}

function renderEmptyConversation() {
  return `<div class="empty-state"><div class="empty-core"><div class="empty-glyph">${icon('chats')}</div><div class="empty-title">Выберите линию связи</div><div class="empty-text">Откройте личный чат, группу или канал. Черновики сохраняются локально даже при нестабильной сети.</div></div></div>`;
}

function renderChatHeader(chat) {
  return `<header class="chat-header">
    <button class="icon-button mobile-back" data-action="back-to-list" aria-label="Назад">${icon('back')}</button>
    <button class="header-identity" data-open-overlay="chat-settings">
      <span class="avatar ${chat.accent}">${escapeHtml(chat.avatar)}</span>
      <span class="header-copy"><span class="header-title">${escapeHtml(chat.title)}</span><span class="header-subtitle">${escapeHtml(chat.subtitle)}</span></span>
    </button>
    <div class="header-actions">
      <button class="icon-button hide-narrow" data-open-overlay="message-search" aria-label="Поиск по сообщениям">${icon('search')}</button>
      <button class="icon-button" data-open-overlay="audio-call" aria-label="Аудиозвонок">${icon('phone')}</button>
      <button class="icon-button hide-narrow" data-open-overlay="video-call" aria-label="Видеозвонок">${icon('video')}</button>
      <button class="icon-button" data-open-overlay="chat-settings" aria-label="Настройки чата">${icon('more')}</button>
    </div>
  </header>`;
}

function renderSelectionHeader(agg) {
  const busy = Boolean(state.actionBusy);
  return `<header class="selection-header" aria-label="Панель выделения">
    <button class="icon-button" data-action="selection-clear" aria-label="Отменить выделение">${icon('close')}</button>
    <div class="selection-count" aria-live="polite"><strong>${state.selection.ids.size}</strong><span>выбрано</span></div>
    <div class="selection-actions">
      <button class="icon-button" data-action="selection-copy" aria-label="Копировать" title="Копировать" ${busy || !agg.copyable ? 'disabled' : ''}>${icon('copy')}</button>
      <button class="icon-button" data-action="selection-forward" aria-label="Переслать" title="Переслать" ${busy || !agg.forwardable ? 'disabled' : ''}>${icon('forward')}</button>
      <button class="icon-button" data-action="selection-pin" aria-label="Закрепить" title="Закрепить" ${busy || !agg.pinnable ? 'disabled' : ''}>${icon('pin')}</button>
      <button class="icon-button" data-action="selection-delete" aria-label="Удалить" title="Удалить" ${busy || !agg.deletable ? 'disabled' : ''}>${icon('trash')}</button>
    </div>
  </header>`;
}

function renderPinnedBar(chat, messages) {
  const message = messages.find((item) => String(item.id) === String(chat.pinnedMessageId));
  return `<button class="pinned-bar" data-message-id="${escapeHtml(chat.pinnedMessageId)}"><span class="pinned-accent"></span><span class="pinned-copy"><span class="pinned-label">Закреплённое сообщение</span><span class="pinned-text">${escapeHtml(message?.text ?? message?.caption ?? '[Медиа]')}</span></span></button>`;
}

function renderMessage(message, chat) {
  if (message.type === 'system') return `<div class="system-message" data-message-id="${escapeHtml(message.id)}">${escapeHtml(message.text)}</div>`;
  const own = String(message.authorId) === String(currentUser.id);
  const selected = state.selection.chatId === String(chat.id) && state.selection.ids.has(String(message.id));
  const caps = capabilitiesFor(message);
  const body = renderMessageBody(message);
  return `<article class="message-row ${own ? 'own' : ''} ${selected ? 'selected' : ''}" data-message-id="${escapeHtml(message.id)}" data-chat-id="${escapeHtml(chat.id)}" aria-selected="${selected}" tabindex="0">
    <div class="message-hit" data-message-hit="${escapeHtml(message.id)}" data-selectable="${caps.selectable}">
      ${!own && chat.type !== 'direct' ? `<span class="avatar message-avatar">${escapeHtml((message.authorName || '?').slice(0,2).toUpperCase())}</span>` : ''}
      <div class="message-bubble ${message.type === 'photo' ? 'media-card' : ''}">
        ${!own && chat.type !== 'direct' ? `<div class="message-author">${escapeHtml(message.authorName)}</div>` : ''}
        ${message.replyTo ? `<div class="reply-quote" data-jump-message="${escapeHtml(message.replyTo.messageId)}">${escapeHtml(message.replyTo.text)}</div>` : ''}
        ${body}
        ${message.reactions ? `<div class="reactions">${Object.entries(message.reactions).map(([emoji,count]) => `<button class="reaction" data-reaction="${escapeHtml(message.id)}">${escapeHtml(emoji)} ${count}</button>`).join('')}</div>` : ''}
        <div class="message-meta"><span>${escapeHtml(message.time ?? '')}</span>${own ? `<span class="delivery">${message.status === 'sent' ? '✓' : '✓✓'}</span>` : ''}</div>
      </div>
    </div>
  </article>`;
}

function renderMessageBody(message) {
  switch (message.type) {
    case 'text': return `<div class="message-text">${escapeHtml(message.text)}</div>`;
    case 'photo': return `<div class="media-preview" role="img" aria-label="Изображение: ${escapeHtml(message.caption ?? '')}"></div>${message.caption ? `<div class="media-caption">${escapeHtml(message.caption)}</div>` : ''}`;
    case 'file': return `<div class="file-card"><div class="file-icon">${icon('file')}</div><div><div class="file-name">${escapeHtml(message.fileName)}</div><div class="file-size">${formatBytes(message.fileSize)}</div></div></div>`;
    case 'voice': {
      const bars = Array.from({ length: 26 }, (_, index) => `<span style="height:${8 + ((index * 13) % 21)}px"></span>`).join('');
      return `<div class="voice-card"><button class="voice-play" data-action="play-voice" aria-label="Воспроизвести">${icon('play')}</button><div class="waveform">${bars}</div><span class="voice-duration">${formatDuration(message.durationMs)}</span></div>`;
    }
    default: return `<div class="message-text">[${escapeHtml(message.type)}]</div>`;
  }
}

function renderComposer(chat) {
  const draft = state.draftByChat[chat.id] ?? '';
  if (state.voice.phase !== 'idle') {
    return `<footer class="composer-wrap"><div class="recording-bar"><span class="recording-pulse"></span><span class="recording-time">${formatDuration(state.voice.elapsedMs)}</span><span class="recording-label">${state.voice.phase === 'requesting' ? 'Запрос доступа к микрофону…' : 'Запись голосового сообщения'}</span><button class="icon-button" data-action="voice-cancel" aria-label="Отменить">${icon('trash')}</button><button class="icon-button send-button" data-action="voice-stop" aria-label="Завершить и отправить" ${state.voice.phase !== 'recording' ? 'disabled' : ''}>${icon('stop')}</button></div></footer>`;
  }
  return `<footer class="composer-wrap">
    ${state.replyDraft ? `<div class="reply-draft"><span class="pinned-accent"></span><div class="reply-draft-copy"><div class="reply-draft-title">Ответ ${escapeHtml(state.replyDraft.authorName ?? '')}</div><div class="reply-draft-text">${escapeHtml(state.replyDraft.text ?? state.replyDraft.caption ?? '[Медиа]')}</div></div><button class="icon-button" data-action="reply-cancel" aria-label="Отменить ответ">${icon('close')}</button></div>` : ''}
    <form class="composer" data-action="send-message">
      <button type="button" class="icon-button" data-open-overlay="attachments" aria-label="Прикрепить файл">${icon('paperclip')}</button>
      <textarea data-role="composer-input" rows="1" aria-label="Сообщение" placeholder="Сообщение в ${escapeHtml(chat.title)}">${escapeHtml(draft)}</textarea>
      <button type="button" class="icon-button emoji-button" data-action="emoji" aria-label="Эмодзи">${icon('smile')}</button>
      ${draft.trim() ? `<button class="icon-button send-button" type="submit" aria-label="Отправить">${icon('send')}</button>` : `<button class="icon-button" type="button" data-action="voice-start" aria-label="Записать голосовое">${icon('mic')}</button>`}
    </form>
  </footer>`;
}

function renderDetails() {
  const chat = activeChat();
  if (!chat) return `<aside class="details-panel"></aside>`;
  return `<aside class="details-panel" aria-label="Информация о чате">
    <div class="details-head"><div class="avatar large details-avatar ${chat.accent}">${escapeHtml(chat.avatar)}</div><div class="details-title">${escapeHtml(chat.title)}</div><div class="details-subtitle">${escapeHtml(chat.subtitle)}</div>
      <div class="details-actions"><button class="detail-action" data-open-overlay="audio-call">${icon('phone')}Звонок</button><button class="detail-action" data-open-overlay="message-search">${icon('search')}Поиск</button><button class="detail-action" data-open-overlay="chat-settings">${icon('more')}Ещё</button></div>
    </div>
    <section class="detail-section"><div class="section-label">Контур</div><div class="detail-row">${icon('lock')}Шифрование<span class="detail-row-value">E2E READY</span></div><div class="detail-row">${icon('wifi')}Состояние<span class="detail-row-value">${state.networkState === 'online' ? 'SYNC' : 'OFFLINE'}</span></div><div class="detail-row">${icon('bell')}Уведомления<span class="detail-row-value">${chat.muted ? 'Выкл.' : 'Вкл.'}</span></div></section>
    <section class="detail-section"><div class="section-label">Медиа</div><div class="media-grid">${Array.from({ length: 6 }, () => '<button class="media-tile" data-open-overlay="media"></button>').join('')}</div></section>
  </aside>`;
}

function renderBottomNav() {
  return `<nav class="mobile-bottom-nav" aria-label="Навигация"><button class="bottom-button active" data-action="back-to-list">${icon('chats')}Чаты</button><button class="bottom-button" data-open-overlay="contacts">${icon('contacts')}Контакты</button><button class="bottom-button" data-open-overlay="bookmarks">${icon('bookmark')}Метки</button><button class="bottom-button" data-open-overlay="settings">${icon('settings')}Настройки</button></nav>`;
}

function renderOverlay() {
  if (!state.overlay) return '<div class="overlay-root"></div>';
  const titleMap = {
    contacts: ['Контакты', 'ПОИСК И НОВЫЕ ДИАЛОГИ'], bookmarks: ['Закладки', 'СОХРАНЁННЫЕ СООБЩЕНИЯ'], archive: ['Архив', 'СКРЫТЫЕ ЛИНИИ СВЯЗИ'],
    settings: ['Настройки', 'ПАРАМЕТРЫ КЛИЕНТА'], profile: ['Профиль', 'ИДЕНТИФИКАТОР ОПЕРАТОРА'], 'chat-settings': ['Настройки чата', 'ПРАВА, МЕДИА И УЧАСТНИКИ'],
    'message-search': ['Поиск', 'ПО СООБЩЕНИЯМ'], downloads: ['Загрузки', 'ФАЙЛЫ И МЕДИА'], invites: ['Приглашения', 'ЗАЯВКИ НА ВСТУПЛЕНИЕ'],
    attachments: ['Вложение', 'ВЫБОР ТИПА ДАННЫХ'], media: ['Медиа', 'ПРОСМОТР'], 'audio-call': ['Аудиозвонок', 'SECURE VOICE LINK'], 'video-call': ['Видеозвонок', 'SECURE VIDEO LINK'],
    forward: ['Переслать', 'ВЫБЕРИТЕ ЦЕЛЕВОЙ ЧАТ']
  };
  const [title, subtitle] = titleMap[state.overlay] ?? ['Night City Net', 'SYSTEM PANEL'];
  return `<div class="overlay-root open"><div class="scrim" data-action="overlay-close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="sheet-header"><div><div class="sheet-title">${escapeHtml(title)}</div><div class="sheet-subtitle">${escapeHtml(subtitle)}</div></div><button class="icon-button sheet-close" data-action="overlay-close" aria-label="Закрыть">${icon('close')}</button></header><div class="sheet-content">${renderOverlayContent()}</div></section></div>`;
}

function renderOverlayContent() {
  switch (state.overlay) {
    case 'contacts': return renderContacts();
    case 'bookmarks': return renderBookmarks();
    case 'archive': return renderArchive();
    case 'settings': return renderSettings();
    case 'profile': return renderProfile();
    case 'chat-settings': return renderChatSettings();
    case 'message-search': return renderMessageSearch();
    case 'downloads': return renderDownloads();
    case 'invites': return renderInvites();
    case 'attachments': return renderAttachments();
    case 'media': return `<div class="media-preview" style="height:55vh"></div><p class="auth-card-text">Локальный защищённый просмотрщик. Реальный файл будет загружаться через Firebase Storage с проверкой прав.</p>`;
    case 'audio-call': return renderCall(false);
    case 'video-call': return renderCall(true);
    case 'forward': return renderForwardPicker();
    default: return '';
  }
}

function menuRow(glyph, title, subtitle, action = '', trailing = '') {
  return `<button class="menu-row" ${action ? `data-action="${action}"` : ''}>${icon(glyph)}<span class="menu-row-copy"><span class="menu-row-title">${escapeHtml(title)}</span><span class="menu-row-subtitle">${escapeHtml(subtitle)}</span></span>${trailing}</button>`;
}

function renderContacts() {
  const contacts = [{name:'Mara Voss',handle:'@mara.v',avatar:'MV'},{name:'Kiro Dane',handle:'@kiro.ctrl',avatar:'KD'},{name:'Nix',handle:'@nix.hex',avatar:'NX'},{name:'Rin Takeda',handle:'@rin.t',avatar:'RT'}];
  return `<div class="search-wrap" style="margin:0 0 15px">${icon('search')}<input class="search-input" placeholder="Имя или @handle" /></div><div class="menu-list">${contacts.map((person) => `<button class="menu-row" data-action="contact-open"><span class="avatar">${person.avatar}</span><span class="menu-row-copy"><span class="menu-row-title">${person.name}</span><span class="menu-row-subtitle">${person.handle} · в сети</span></span>${icon('chats')}</button>`).join('')}</div>`;
}

function renderBookmarks() {
  const saved = state.chats.flatMap((chat) => (state.messages.get(chat.id) ?? []).filter((message) => message.type === 'text').slice(0,1).map((message) => ({ chat, message })));
  return `<div class="menu-list">${saved.length ? saved.map(({chat,message}) => menuRow('bookmark', chat.title, message.text, 'bookmark-open')).join('') : '<div class="empty-text">Закладок пока нет.</div>'}</div>`;
}

function renderArchive() {
  return `<div class="menu-list">${menuRow('archive','Ghost Protocol','Архивирован 4 дня назад','archive-open')}${menuRow('archive','Old Grid / 09','Без новых сообщений','archive-open')}</div>`;
}

function renderSettings() {
  return `<div class="menu-list">
    ${menuRow('palette','Тяжёлые эффекты','Отключайте на слабых устройствах','toggle-effects',`<span class="toggle ${state.settings.effects ? 'on' : ''}"></span>`)}
    ${menuRow('chats','Компактный режим','Больше диалогов на экране','toggle-compact',`<span class="toggle ${state.settings.compact ? 'on' : ''}"></span>`)}
    ${menuRow('check','Отчёты о прочтении','Показывать статус доставки','toggle-receipts',`<span class="toggle ${state.settings.readReceipts ? 'on' : ''}"></span>`)}
    ${menuRow('download','Управление загрузками','Автозагрузка и локальные файлы','open-downloads')}
    ${menuRow('userPlus','Приглашения и заявки','Управление доступом','open-invites')}
    ${menuRow('shield','Приватность и безопасность','Устройства, E2E и сессии','security-info')}
    ${menuRow('logout','Выйти из сети','Локальная сессия будет закрыта','logout')}
  </div>`;
}

function renderProfile() {
  return `<div style="text-align:center;padding:12px 0 25px"><div class="avatar large" style="margin:auto">${currentUser.avatar}</div><h2>${currentUser.name}</h2><div class="header-subtitle">${currentUser.handle}</div></div><div class="menu-list">${menuRow('key','NCN ID','ncn://operator/vega.zero')}${menuRow('shield','E2E ключ','Отпечаток 7C:19:AA:0F')}${menuRow('database','Хранилище','128 МБ локального кэша')}</div>`;
}

function renderChatSettings() {
  const chat = activeChat();
  if (!chat) return '<div class="empty-text">Чат не выбран.</div>';
  return `<div style="text-align:center;padding:8px 0 22px"><div class="avatar large ${chat.accent}" style="margin:auto">${chat.avatar}</div><h2>${escapeHtml(chat.title)}</h2><div class="header-subtitle">${escapeHtml(chat.subtitle)}</div></div><div class="menu-list">${menuRow('bell','Уведомления',chat.muted?'Отключены':'Включены','chat-mute',`<span class="toggle ${chat.muted ? '' : 'on'}"></span>`)}${menuRow('image','Фото, видео и файлы','Открыть галерею','open-media')}${menuRow('search','Поиск по сообщениям','Текст, отправитель и дата','open-message-search')}${chat.type !== 'direct' ? menuRow('contacts','Участники и права',`${chat.memberCount} участников · роль ${chat.role}`,'members-info') : ''}${menuRow('trash','Удалить историю','Требуется подтверждение прав','danger-info')}</div>`;
}

function renderMessageSearch() {
  const query = state.messageSearch.trim().toLocaleLowerCase('ru');
  const results = activeMessages().filter((message) => !query || `${message.text ?? ''} ${message.caption ?? ''}`.toLocaleLowerCase('ru').includes(query));
  return `<div class="search-wrap" style="margin:0 0 15px">${icon('search')}<input class="search-input" data-role="message-search-input" value="${escapeHtml(state.messageSearch)}" placeholder="Текст сообщения" /></div><div class="menu-list">${results.map((message) => menuRow(message.type === 'text' ? 'chats' : 'file', message.authorName ?? 'Система', message.text ?? message.caption ?? `[${message.type}]`, 'search-result-open')).join('') || '<div class="empty-text">Совпадений нет.</div>'}</div>`;
}

function renderDownloads() {
  return `<div class="menu-list">${menuRow('file','relay-map.ncn','277.5 КБ · загружено','download-open')}${menuRow('image','Северный шлюз','Изображение · кэш','download-open')}</div>`;
}

function renderInvites() {
  return `<div class="menu-list">${menuRow('userPlus','Pacifica Ops','Заявка на вступление · ожидает','invite-action')}${menuRow('key','Код приглашения','NCN-7F2A-19C0 · действует 24 часа','copy-invite')}</div>`;
}

function renderAttachments() {
  return `<div class="menu-list">${menuRow('image','Фото или видео','Камера и медиатека','attachment-demo')}${menuRow('file','Файл','Документы и архивы','attachment-demo')}${menuRow('mic','Голосовое сообщение','Запись с микрофона','voice-start-overlay')}${menuRow('lock','ICE-сообщение','Доступ по одноразовому коду','ice-demo')}</div>`;
}

function renderCall(video) {
  const chat = activeChat();
  return `<div class="call-screen"><div class="call-orbit"><div class="avatar large ${chat?.accent ?? ''}">${chat?.avatar ?? 'NC'}</div></div><div class="call-status">${video ? 'VIDEO' : 'AUDIO'} LINK // CONNECTING</div><div class="call-name">${escapeHtml(chat?.title ?? 'Unknown')}</div><div class="call-timer">00:00</div><div class="call-controls"><button class="call-control" data-action="call-toggle-mic">${icon('mic')}</button>${video ? `<button class="call-control" data-action="call-toggle-video">${icon('video')}</button>` : ''}<button class="call-control danger" data-action="overlay-close">${icon('phone')}</button></div></div>`;
}

function renderForwardPicker() {
  return `<div class="menu-list">${state.chats.filter((chat) => String(chat.id) !== String(state.activeChatId)).map((chat) => `<button class="menu-row" data-forward-target="${escapeHtml(chat.id)}"><span class="avatar ${chat.accent}">${chat.avatar}</span><span class="menu-row-copy"><span class="menu-row-title">${escapeHtml(chat.title)}</span><span class="menu-row-subtitle">${escapeHtml(chat.subtitle)}</span></span>${icon('forward')}</button>`).join('')}</div>`;
}

function render() {
  if (!state.authenticated) {
    app.innerHTML = renderAuth();
    renderToasts();
    return;
  }
  app.innerHTML = `<main class="app-shell ${state.activeChatId ? 'chat-open' : ''}">${renderRail()}${renderChatList()}${renderConversation()}${renderDetails()}${renderBottomNav()}</main>${renderOverlay()}`;
  renderToasts();
}

function openOverlay(name, payload = null) {
  state.overlay = name === 'chats' ? null : name;
  state.overlayPayload = payload;
  render();
}

function closeOverlay() {
  state.overlay = null;
  state.overlayPayload = null;
  render();
}

function scrollMessagesToBottom(smooth = true) {
  const target = document.querySelector('[data-role="messages-scroll"]');
  if (target) target.scrollTo({ top: target.scrollHeight, behavior: smooth && !state.reducedMotion ? 'smooth' : 'auto' });
}

function selectedSnapshot() {
  return selectedMessagesSnapshot(state.selection, activeMessages());
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('clipboard-denied');
}

async function handleCopySelection() {
  if (state.actionBusy) return;
  const snapshot = selectedSnapshot();
  state.actionBusy = 'copy'; render();
  try {
    await copyMessages(snapshot, { writeText: writeClipboard });
    clearSelection('CLEAR');
    toast('Скопировано', `${snapshot.length} сообщений`);
  } catch (error) {
    state.actionBusy = null; render();
    toast('Не удалось скопировать', 'Выделение сохранено.', 'error');
  }
}

async function handleDeleteSelection() {
  if (state.actionBusy) return;
  const snapshot = selectedSnapshot();
  const operation = operations.begin('delete', { chatId: state.activeChatId, ids: snapshot.map((item) => item.id), selectionRevision: state.selection.revision });
  state.actionBusy = 'delete'; render();
  try {
    const result = await deleteMessages({
      messages: snapshot,
      canDelete: (message) => capabilitiesFor(message).deletable,
      repository,
      operation,
      registry: operations
    });
    if (!operations.isActive(operation)) return;
    const failedIds = new Set(result.failed.map((item) => item.id));
    if (failedIds.size) {
      state.selection = { ...state.selection, ids: failedIds, phase: 'selecting', revision: state.selection.revision + 1 };
      toast('Удалено частично', `Удалено: ${result.deleted.length}, ошибок: ${result.failed.length}`, 'error');
    } else {
      state.selection = selectionReducer(state.selection, { type: 'CLEAR' });
      toast('Сообщения удалены', `${result.deleted.length} шт.`);
    }
  } catch (error) {
    toast('Ошибка удаления', error.message, 'error');
  } finally {
    operations.finish(operation);
    state.actionBusy = null;
    render();
  }
}

async function handleForwardTarget(targetChatId) {
  if (state.actionBusy) return;
  const snapshot = selectedSnapshot();
  const operation = operations.begin('forward', { sourceChatId: state.activeChatId, targetChatId, ids: snapshot.map((item) => item.id), selectionRevision: state.selection.revision });
  state.actionBusy = 'forward'; closeOverlay();
  try {
    const result = await forwardMessages({ messages: snapshot, targetChatId, senderId: currentUser.id, repository, operation, registry: operations });
    if (!operations.isActive(operation)) return;
    if (result.failed.length) {
      state.selection = { ...state.selection, ids: new Set(result.failed.map((item) => item.id)), phase: 'selecting', revision: state.selection.revision + 1 };
      toast('Переслано частично', `Успешно: ${result.forwarded.length}, ошибок: ${result.failed.length}`, 'error');
    } else {
      state.selection = selectionReducer(state.selection, { type: 'CLEAR' });
      toast('Переслано', `${result.forwarded.length} сообщений`);
    }
  } catch (error) {
    toast('Ошибка пересылки', error.message, 'error');
  } finally {
    operations.finish(operation);
    state.actionBusy = null;
    render();
  }
}

async function handlePinSelection() {
  if (state.actionBusy) return;
  const snapshot = selectedSnapshot();
  const operation = operations.begin('pin', { chatId: state.activeChatId, ids: snapshot.map((item) => item.id) });
  state.actionBusy = 'pin'; render();
  try {
    const id = await pinMessage({ messages: snapshot, repository, operation, registry: operations });
    if (!operations.isActive(operation)) return;
    state.chats = state.chats.map((chat) => String(chat.id) === String(state.activeChatId) ? { ...chat, pinnedMessageId: id } : chat);
    state.selection = selectionReducer(state.selection, { type: 'CLEAR' });
    toast('Сообщение закреплено');
  } catch (error) {
    toast('Не удалось закрепить', 'Выделение сохранено.', 'error');
  } finally {
    operations.finish(operation);
    state.actionBusy = null;
    render();
  }
}

async function sendTextMessage(text) {
  const chat = activeChat();
  if (!chat || !text.trim()) return;
  const id = createId();
  const draft = {
    id,
    authorId: currentUser.id,
    authorName: currentUser.name,
    type: 'text',
    text: text.trim(),
    replyTo: state.replyDraft ? { messageId: String(state.replyDraft.id), text: state.replyDraft.text ?? state.replyDraft.caption ?? '[Медиа]' } : null
  };
  state.draftByChat[chat.id] = '';
  state.replyDraft = null;
  saveDrafts();
  render();
  try {
    await repository.sendMessage(chat.id, draft, `send:${chat.id}:${id}`);
    requestAnimationFrame(() => scrollMessagesToBottom(true));
  } catch (error) {
    state.draftByChat[chat.id] = text;
    saveDrafts();
    render();
    toast('Сообщение не отправлено', 'Черновик восстановлен.', 'error');
  }
}

function saveDrafts() {
  localStorage.setItem('ncn.drafts', JSON.stringify(state.draftByChat));
}

async function startVoiceRecording() {
  if (state.selection.phase === 'selecting' || state.voice.phase !== 'idle') return;
  const token = ++voiceRequestToken;
  state.voice = { phase: 'requesting', startedAt: null, elapsedMs: 0 };
  render();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (token !== voiceRequestToken || state.selection.phase === 'selecting' || state.voice.phase !== 'requesting') {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    activeMediaStream = stream;
    state.voice = { phase: 'recording', startedAt: Date.now(), elapsedMs: 0 };
    render();
    tickVoice(token);
  } catch (error) {
    if (token !== voiceRequestToken) return;
    state.voice = { phase: 'idle', startedAt: null, elapsedMs: 0 };
    render();
    toast('Микрофон недоступен', 'Разрешение не выдано или устройство не найдено.', 'error');
  }
}

function tickVoice(token) {
  if (token !== voiceRequestToken || state.voice.phase !== 'recording') return;
  state.voice.elapsedMs = Date.now() - state.voice.startedAt;
  const label = document.querySelector('.recording-time');
  if (label) label.textContent = formatDuration(state.voice.elapsedMs);
  requestAnimationFrame(() => tickVoice(token));
}

function cancelVoice(reason = 'cancel') {
  voiceRequestToken++;
  activeMediaStream?.getTracks().forEach((track) => track.stop());
  activeMediaStream = null;
  if (state.voice.phase !== 'idle') state.voice = { phase: 'idle', startedAt: null, elapsedMs: 0 };
}

async function stopVoiceAndSend() {
  if (state.voice.phase !== 'recording') return;
  const durationMs = state.voice.elapsedMs;
  const chat = activeChat();
  cancelVoice('send');
  render();
  if (!chat || durationMs < 500) {
    toast('Запись отменена', 'Голосовое слишком короткое.', 'error');
    return;
  }
  const id = createId();
  await repository.sendMessage(chat.id, { id, authorId: currentUser.id, authorName: currentUser.name, type: 'voice', durationMs }, `voice:${chat.id}:${id}`);
}

function pointerStart(event, hit) {
  if (event.button !== undefined && event.button !== 0) return;
  const row = hit.closest('.message-row');
  const messageId = row?.dataset.messageId;
  const chatId = row?.dataset.chatId;
  if (!messageId || !chatId || hit.dataset.selectable !== 'true') return;
  clearTimeout(pointerTimer);
  state.selection = selectionReducer(state.selection, { type: 'POINTER_START', pointerId: event.pointerId, chatId, messageId, x: event.clientX, y: event.clientY, startedAt: Date.now(), selectable: true });
  pointerTimer = setTimeout(() => {
    const next = selectionReducer(state.selection, { type: 'LONG_PRESS', pointerId: event.pointerId, at: Date.now() });
    if (next !== state.selection) {
      setSelection(next);
      navigator.vibrate?.(22);
    }
  }, LONG_PRESS_MS);
}

function pointerMove(event) {
  if (!state.selection.pointerSession) return;
  const next = selectionReducer(state.selection, { type: 'POINTER_MOVE', pointerId: event.pointerId, x: event.clientX, y: event.clientY });
  if (next.pointerSession?.moved) clearTimeout(pointerTimer);
  state.selection = next;
}

function pointerEnd(event, cancelled = false) {
  clearTimeout(pointerTimer);
  state.selection = selectionReducer(state.selection, { type: cancelled ? 'POINTER_CANCEL' : 'POINTER_END', pointerId: event.pointerId });
}

function handleMessageClick(event, row) {
  const messageId = row.dataset.messageId;
  const chatId = row.dataset.chatId;
  const consumed = consumeSuppressedClick(state.selection, { pointerId: event.pointerId, chatId, messageId, at: Date.now() });
  state.selection = consumed.state;
  if (consumed.suppressed) {
    render();
    return;
  }
  if (state.selection.phase === 'selecting') {
    const message = activeMessages().find((item) => String(item.id) === String(messageId));
    state.selection = selectionReducer(state.selection, { type: 'TOGGLE', chatId, messageId, selectable: capabilitiesFor(message).selectable });
    render();
  }
}

app.addEventListener('pointerdown', (event) => {
  const hit = event.target.closest('[data-message-hit]');
  if (hit) pointerStart(event, hit);
});
app.addEventListener('pointermove', pointerMove);
app.addEventListener('pointerup', (event) => pointerEnd(event));
app.addEventListener('pointercancel', (event) => pointerEnd(event, true));
app.addEventListener('contextmenu', (event) => {
  if (event.target.closest('[data-message-hit]')) event.preventDefault();
});

app.addEventListener('input', (event) => {
  if (event.target.matches('[data-role="chat-search"]')) {
    state.chatSearch = event.target.value;
    render();
    requestAnimationFrame(() => document.querySelector('[data-role="chat-search"]')?.focus());
  }
  if (event.target.matches('[data-role="composer-input"]')) {
    const chat = activeChat();
    if (!chat) return;
    state.draftByChat[chat.id] = event.target.value;
    saveDrafts();
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
    const form = textarea.closest('form');
    const actionButton = form?.querySelector('[data-action="voice-start"], .send-button');
    if (actionButton && ((textarea.value.trim() && actionButton.dataset.action === 'voice-start') || (!textarea.value.trim() && !actionButton.dataset.action))) render();
  }
  if (event.target.matches('[data-role="message-search-input"]')) {
    state.messageSearch = event.target.value;
    render();
    requestAnimationFrame(() => document.querySelector('[data-role="message-search-input"]')?.focus());
  }
});

app.addEventListener('submit', (event) => {
  const action = event.target.dataset.action;
  if (action === 'auth-submit') {
    event.preventDefault();
    state.authenticated = true;
    localStorage.setItem('ncn.authenticated', 'true');
    if (!state.activeChatId && innerWidth > 850) selectChat(state.chats[0]?.id, false);
    render();
  }
  if (action === 'send-message') {
    event.preventDefault();
    const textarea = event.target.querySelector('textarea');
    sendTextMessage(textarea?.value ?? '');
  }
});

app.addEventListener('dblclick', (event) => {
  if (state.selection.phase === 'selecting') return;
  const row = event.target.closest('.message-row');
  if (!row) return;
  const message = activeMessages().find((item) => String(item.id) === String(row.dataset.messageId));
  if (message && message.type !== 'system') {
    state.replyDraft = { ...message };
    render();
  }
});

app.addEventListener('click', async (event) => {
  const row = event.target.closest('.message-row');
  if (row && !event.target.closest('button')) handleMessageClick(event, row);

  const chatButton = event.target.closest('[data-chat-id]');
  if (chatButton) selectChat(chatButton.dataset.chatId);

  const filter = event.target.closest('[data-chat-filter]');
  if (filter) { state.chatFilter = filter.dataset.chatFilter; render(); }

  const overlayButton = event.target.closest('[data-open-overlay]');
  if (overlayButton) openOverlay(overlayButton.dataset.openOverlay);

  const target = event.target.closest('[data-forward-target]');
  if (target) await handleForwardTarget(target.dataset.forwardTarget);

  const actionElement = event.target.closest('[data-action]');
  const action = actionElement?.dataset.action;
  switch (action) {
    case 'auth-toggle': state.authMode = state.authMode === 'login' ? 'register' : 'login'; render(); break;
    case 'back-to-list': openChatList(); break;
    case 'selection-clear': clearSelection('CLEAR'); break;
    case 'selection-copy': await handleCopySelection(); break;
    case 'selection-forward': openOverlay('forward'); break;
    case 'selection-delete': await handleDeleteSelection(); break;
    case 'selection-pin': await handlePinSelection(); break;
    case 'overlay-close': closeOverlay(); break;
    case 'reply-cancel': state.replyDraft = null; render(); break;
    case 'voice-start': await startVoiceRecording(); break;
    case 'voice-start-overlay': closeOverlay(); await startVoiceRecording(); break;
    case 'voice-cancel': cancelVoice(); render(); break;
    case 'voice-stop': await stopVoiceAndSend(); break;
    case 'emoji': {
      const chat = activeChat(); if (!chat) break;
      state.draftByChat[chat.id] = `${state.draftByChat[chat.id] ?? ''} ⚡`; saveDrafts(); render();
      requestAnimationFrame(() => document.querySelector('[data-role="composer-input"]')?.focus()); break;
    }
    case 'toggle-effects': state.settings.effects = !state.settings.effects; localStorage.setItem('ncn.effects', String(state.settings.effects)); render(); break;
    case 'toggle-compact': state.settings.compact = !state.settings.compact; localStorage.setItem('ncn.compact', String(state.settings.compact)); render(); break;
    case 'toggle-receipts': state.settings.readReceipts = !state.settings.readReceipts; localStorage.setItem('ncn.receipts', String(state.settings.readReceipts)); render(); break;
    case 'open-downloads': openOverlay('downloads'); break;
    case 'open-invites': openOverlay('invites'); break;
    case 'open-media': openOverlay('media'); break;
    case 'open-message-search': openOverlay('message-search'); break;
    case 'logout':
      operations.cancelAll(); cancelVoice('logout'); unsubscribeMessages?.(); state.selection = selectionReducer(state.selection, { type: 'LOGOUT' }); state.authenticated = false; state.activeChatId = null; state.overlay = null; localStorage.removeItem('ncn.authenticated'); render(); break;
    case 'copy-invite': await writeClipboard('NCN-7F2A-19C0'); toast('Код приглашения скопирован'); break;
    case 'attachment-demo': toast('Модуль вложений подготовлен', 'Для production подключается Capacitor File Picker и Firebase Storage.'); break;
    case 'ice-demo': toast('ICE-контейнер', 'В production нужен отдельный криптографический протокол и серверная валидация.'); break;
    case 'security-info': toast('Контур безопасности', 'Клиентские capabilities должны дублироваться Firestore Rules.'); break;
    case 'danger-info': toast('Операция заблокирована', 'В демо массовое удаление доступно через выделение сообщений.'); break;
    case 'invite-action': toast('Заявка обработана', 'Демо-режим: серверная запись не выполнена.'); break;
    case 'contact-open': closeOverlay(); toast('Новый диалог', 'Демо-контакт выбран.'); break;
    case 'play-voice': toast('Воспроизведение', 'В демо нет аудиофайла.'); break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    operations.cancelAll();
    state.selection = selectionReducer(state.selection, { type: 'BACKGROUND' });
    cancelVoice('background');
    render();
  }
});

window.addEventListener('online', () => { state.networkState = 'online'; render(); toast('Сеть восстановлена', 'Синхронизация продолжена.'); });
window.addEventListener('offline', () => { state.networkState = 'offline'; render(); toast('Нет соединения', 'Черновики и кэш остаются доступны.', 'error'); });
window.addEventListener('beforeunload', () => { unsubscribeMessages?.(); operations.cancelAll(); cancelVoice('unload'); });

initialize().catch((error) => {
  app.innerHTML = `<div class="empty-state"><div class="empty-core"><div class="empty-title">Не удалось запустить Night City Net</div><div class="empty-text">${escapeHtml(error.message)}</div></div></div>`;
});
