const ADMIN_ROLES = new Set(['owner', 'admin']);

export function getMessageCapabilities({
  message,
  chat,
  currentUserId,
  currentUserRole = 'member',
  encryptionState = 'ready',
  networkState = 'online'
}) {
  const isSystem = message?.type === 'system';
  const isAuthor = String(message?.authorId) === String(currentUserId);
  const isAdmin = ADMIN_ROLES.has(currentUserRole);
  const chatType = chat?.type ?? 'direct';
  const encryptedUnavailable = Boolean(message?.encrypted) && (encryptionState !== 'ready' || message?.decrypted === false);
  const restricted = Boolean(message?.noForward || message?.selfDestructed || message?.deleted);
  const online = networkState !== 'offline';
  const canModerate = isAdmin && (chatType === 'group' || chatType === 'channel');
  const channelWriter = chatType !== 'channel' || isAdmin || chat?.permissions?.canPost === true;

  return {
    selectable: !message?.deleted,
    copyable: !isSystem && !message?.deleted && !encryptedUnavailable && ['text', 'photo', 'video', 'file', 'voice', 'sticker', 'ice'].includes(message?.type),
    forwardable: !isSystem && !restricted && !encryptedUnavailable,
    deletable: !isSystem && online && (isAuthor || canModerate),
    editable: !isSystem && online && isAuthor && channelWriter && message?.type === 'text' && !message?.forwardedFrom && !message?.selfDestructAt,
    pinnable: !isSystem && online && (chatType === 'direct' ? isAuthor : isAdmin),
    reactable: !isSystem && !message?.deleted && !encryptedUnavailable,
    downloadable: ['photo', 'video', 'file', 'voice'].includes(message?.type) && !message?.deleted && !encryptedUnavailable
  };
}

export function aggregateCapabilities(messages, contextFactory) {
  const rows = messages.map((message) => getMessageCapabilities({ message, ...contextFactory(message) }));
  return {
    count: rows.length,
    copyable: rows.length > 0 && rows.every((row) => row.copyable),
    forwardable: rows.length > 0 && rows.every((row) => row.forwardable),
    deletable: rows.length > 0 && rows.some((row) => row.deletable),
    pinnable: rows.length === 1 && rows[0].pinnable
  };
}
