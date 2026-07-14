export const currentUser = {
  id: 'u-me',
  name: 'Vega',
  handle: '@vega.zero',
  status: 'online',
  role: 'owner',
  avatar: 'VG'
};

export const demoChats = [
  {
    id: 'chat-direct-1',
    type: 'direct',
    title: 'Mara Voss',
    subtitle: 'в сети',
    avatar: 'MV',
    accent: 'cyan',
    unread: 3,
    pinned: true,
    muted: false,
    lastMessage: 'Пакет уже в туннеле. Проверь ключ.',
    lastAt: '18:42',
    memberCount: 2,
    role: 'member'
  },
  {
    id: 'chat-group-1',
    type: 'group',
    title: 'Afterlife / Core',
    subtitle: '18 участников',
    avatar: 'AC',
    accent: 'yellow',
    unread: 12,
    pinned: true,
    muted: false,
    lastMessage: 'Kiro: сетка снова отвечает',
    lastAt: '18:30',
    memberCount: 18,
    role: 'admin'
  },
  {
    id: 'chat-channel-1',
    type: 'channel',
    title: 'NСN // Broadcast',
    subtitle: '4.2K подписчиков',
    avatar: 'NB',
    accent: 'red',
    unread: 0,
    pinned: false,
    muted: true,
    lastMessage: 'Обновление узлов завершено.',
    lastAt: '17:55',
    memberCount: 4200,
    role: 'owner',
    permissions: { canPost: true }
  },
  {
    id: 'chat-direct-2',
    type: 'direct',
    title: 'Rin Takeda',
    subtitle: 'была недавно',
    avatar: 'RT',
    accent: 'purple',
    unread: 0,
    pinned: false,
    muted: false,
    lastMessage: 'Увидимся у северного терминала.',
    lastAt: 'Вчера',
    memberCount: 2,
    role: 'member'
  },
  {
    id: 'chat-group-2',
    type: 'group',
    title: 'Pacifica Relay',
    subtitle: '7 участников',
    avatar: 'PR',
    accent: 'green',
    unread: 1,
    pinned: false,
    muted: false,
    lastMessage: 'Сигнал стабилен на 76%.',
    lastAt: 'Пн',
    memberCount: 7,
    role: 'member'
  }
];

const makeText = (id, chatId, authorId, authorName, text, time, extra = {}) => ({
  id: String(id), chatId, authorId, authorName, type: 'text', text, time, createdAt: Number(id), status: 'read', ...extra
});

export const demoMessages = {
  'chat-direct-1': [
    { id: '1001', chatId: 'chat-direct-1', authorId: 'system', type: 'system', text: 'Защищённый канал установлен', time: '18:21', createdAt: 1001 },
    makeText(1002, 'chat-direct-1', 'u-mara', 'Mara', 'Проверка линии. Ты меня слышишь?', '18:22'),
    makeText(1003, 'chat-direct-1', 'u-me', 'Vega', 'Чисто. Шум ниже порога.', '18:23'),
    { id: '1004', chatId: 'chat-direct-1', authorId: 'u-mara', authorName: 'Mara', type: 'photo', caption: 'Северный шлюз, сектор 7', mediaUrl: '', time: '18:25', createdAt: 1004, status: 'read' },
    makeText(1005, 'chat-direct-1', 'u-mara', 'Mara', 'Пакет уже в туннеле. Проверь ключ.', '18:42', { replyTo: { messageId: '1003', text: 'Чисто. Шум ниже порога.' } }),
    { id: '1006', chatId: 'chat-direct-1', authorId: 'u-me', authorName: 'Vega', type: 'voice', durationMs: 18000, time: '18:43', createdAt: 1006, status: 'delivered' }
  ],
  'chat-group-1': [
    { id: '2001', chatId: 'chat-group-1', authorId: 'system', type: 'system', text: 'Kiro добавил Nix в группу', time: '17:58', createdAt: 2001 },
    makeText(2002, 'chat-group-1', 'u-kiro', 'Kiro', 'Сетка снова отвечает. Пинг 31 мс.', '18:03'),
    makeText(2003, 'chat-group-1', 'u-nix', 'Nix', 'На западном узле всё ещё дрожит маршрут.', '18:05'),
    { id: '2004', chatId: 'chat-group-1', authorId: 'u-me', authorName: 'Vega', type: 'file', fileName: 'relay-map.ncn', fileSize: 284133, time: '18:08', createdAt: 2004, status: 'read' },
    makeText(2005, 'chat-group-1', 'u-kiro', 'Kiro', 'Принял. Фиксирую окно на 02:10.', '18:30', { reactions: { '⚡': 4, '✓': 2 } })
  ],
  'chat-channel-1': [
    { id: '3001', chatId: 'chat-channel-1', authorId: 'u-me', authorName: 'NCN', type: 'photo', caption: 'NODE STATUS // ALL GREEN', mediaUrl: '', time: '16:00', createdAt: 3001, status: 'read' },
    makeText(3002, 'chat-channel-1', 'u-me', 'NCN', 'Обновление узлов завершено. Клиенты версии 0.1 переходят на новый маршрут синхронизации.', '17:55', { reactions: { '⚡': 128, '🛰️': 37 } })
  ],
  'chat-direct-2': [
    makeText(4001, 'chat-direct-2', 'u-rin', 'Rin', 'Увидимся у северного терминала.', 'Вчера')
  ],
  'chat-group-2': [
    makeText(5001, 'chat-group-2', 'u-vale', 'Vale', 'Сигнал стабилен на 76%.', 'Пн')
  ]
};
