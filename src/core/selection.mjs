export const LONG_PRESS_MS = 520;
export const POINTER_MOVE_TOLERANCE_PX = 9;

export function normalizeId(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function createSelectionState() {
  return {
    phase: 'idle',
    chatId: null,
    ids: new Set(),
    pointerSession: null,
    suppressedClick: null,
    revision: 0
  };
}

function bump(state, patch = {}) {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function clearState(state) {
  if (state.phase === 'idle' && state.ids.size === 0 && !state.pointerSession && !state.suppressedClick) {
    return state;
  }
  return bump(state, {
    phase: 'idle',
    chatId: null,
    ids: new Set(),
    pointerSession: null,
    suppressedClick: null
  });
}

export function selectionReducer(state, event) {
  switch (event.type) {
    case 'POINTER_START': {
      const chatId = normalizeId(event.chatId);
      const messageId = normalizeId(event.messageId);
      if (!chatId || !messageId || event.selectable === false) return state;
      return bump(state, {
        pointerSession: {
          pointerId: event.pointerId,
          chatId,
          messageId,
          startedAt: event.startedAt ?? Date.now(),
          startX: Number(event.x ?? 0),
          startY: Number(event.y ?? 0),
          moved: false,
          longPressTriggered: false
        }
      });
    }

    case 'POINTER_MOVE': {
      const session = state.pointerSession;
      if (!session || session.pointerId !== event.pointerId) return state;
      const dx = Number(event.x ?? 0) - session.startX;
      const dy = Number(event.y ?? 0) - session.startY;
      if (Math.hypot(dx, dy) <= (event.tolerance ?? POINTER_MOVE_TOLERANCE_PX)) return state;
      return bump(state, { pointerSession: { ...session, moved: true } });
    }

    case 'LONG_PRESS': {
      const session = state.pointerSession;
      if (!session || session.pointerId !== event.pointerId || session.moved || session.longPressTriggered) return state;
      const ids = state.chatId === session.chatId ? new Set(state.ids) : new Set();
      ids.add(session.messageId);
      return bump(state, {
        phase: 'selecting',
        chatId: session.chatId,
        ids,
        pointerSession: { ...session, longPressTriggered: true },
        suppressedClick: {
          pointerId: session.pointerId,
          chatId: session.chatId,
          messageId: session.messageId,
          expiresAt: (event.at ?? Date.now()) + 900
        }
      });
    }

    case 'POINTER_END': {
      const session = state.pointerSession;
      if (!session || session.pointerId !== event.pointerId) return state;
      return bump(state, { pointerSession: null });
    }

    case 'POINTER_CANCEL': {
      if (!state.pointerSession) return state;
      if (event.pointerId !== undefined && state.pointerSession.pointerId !== event.pointerId) return state;
      return bump(state, { pointerSession: null });
    }

    case 'TOGGLE': {
      const chatId = normalizeId(event.chatId);
      const messageId = normalizeId(event.messageId);
      if (!chatId || !messageId || event.selectable === false) return state;
      if (state.phase === 'selecting' && state.chatId !== chatId) return state;
      const ids = new Set(state.ids);
      if (ids.has(messageId)) ids.delete(messageId);
      else ids.add(messageId);
      if (ids.size === 0) return clearState(state);
      return bump(state, { phase: 'selecting', chatId, ids });
    }

    case 'SELECT_ONLY': {
      const chatId = normalizeId(event.chatId);
      const messageId = normalizeId(event.messageId);
      if (!chatId || !messageId || event.selectable === false) return state;
      return bump(state, { phase: 'selecting', chatId, ids: new Set([messageId]) });
    }

    case 'RECONCILE': {
      if (state.phase !== 'selecting') return state;
      const chatId = normalizeId(event.chatId);
      if (chatId !== state.chatId) return state;
      const valid = new Set((event.messageIds ?? []).map(normalizeId).filter(Boolean));
      const ids = new Set([...state.ids].filter((id) => valid.has(id)));
      if (ids.size === 0) return clearState(state);
      if (ids.size === state.ids.size && [...ids].every((id) => state.ids.has(id))) return state;
      return bump(state, { ids });
    }

    case 'CONSUME_SUPPRESSED_CLICK': {
      const click = state.suppressedClick;
      if (!click) return { state, suppressed: false };
      const matches = click.pointerId === event.pointerId &&
        click.chatId === normalizeId(event.chatId) &&
        click.messageId === normalizeId(event.messageId) &&
        click.expiresAt >= (event.at ?? Date.now());
      return {
        state: matches ? bump(state, { suppressedClick: null }) : state,
        suppressed: matches
      };
    }

    case 'CLEAR':
    case 'CHAT_CHANGED':
    case 'CHAT_LIST_OPENED':
    case 'BACKGROUND':
    case 'LOGOUT':
      return clearState(state);

    default:
      return state;
  }
}

export function consumeSuppressedClick(state, event) {
  const result = selectionReducer(state, { ...event, type: 'CONSUME_SUPPRESSED_CLICK' });
  return result.state ? result : { state, suppressed: false };
}

export function selectedMessagesSnapshot(selection, messages) {
  if (selection.phase !== 'selecting') return Object.freeze([]);
  const selected = messages
    .filter((message) => selection.ids.has(normalizeId(message.id)))
    .map((message) => Object.freeze({ ...message }));
  return Object.freeze(selected);
}
