# Night City Net — Test Report

Дата проверки: 2026-07-14

## Автоматические unit tests

Результат: **29 passed, 0 failed**.

Проверено:

- long-press и нормализация ID;
- привязка выделения к одному chatId;
- независимое снятие одного выбранного сообщения;
- закрытие режима после удаления последнего ID;
- отмена long-press при движении/scroll;
- подавление synthetic click только для того же pointer/message;
- reconciliation после удаления сообщения на другом устройстве;
- очистка при navigation/background/logout;
- immutable snapshot;
- 100 выбранных сообщений;
- reconciliation на наборе из 1000 сообщений;
- capabilities автора, участника, администратора;
- системные и нерасшифрованные E2E-сообщения;
- offline server mutations;
- clipboard labels и clipboard denied;
- безопасный forward DTO;
- partial delete и partial forward;
- operation cancellation и double-action guard;
- timeout и ограничение параллелизма;
- idempotency key.

## Chromium UI smoke tests

Результат: **passed, console errors: 0, page errors: 0**.

Проверено:

- авторизация;
- мобильный список чатов;
- личный чат;
- long-press и выбор двух сообщений;
- отправка текста;
- экран 360×800;
- экран 320×640;
- landscape 800×360;
- desktop 1440×900;
- группа и канал;
- увеличенный root font-size 24 px как приближение font scale 1.5;
- отсутствие горизонтального overflow.

## Найденные и исправленные регрессии во время smoke-test

1. Нижняя мобильная навигация перехватывала нажатие кнопки отправки в открытом чате.
2. Список чатов находился выше conversation panel и просвечивал через чат.
3. FAB не был привязан к chat-list panel и уезжал на правый край desktop.
4. `crypto.randomUUID()` не работал в незащищённом WebView-контексте; добавлен fallback ID generator.
5. Header identity наследовал браузерный стиль кнопки.

## Не проверено в этой среде

- Android emulator/physical device;
- gesture navigation и трёхкнопочная навигация на реальном Android;
- TalkBack end-to-end;
- Firebase Emulator Suite;
- реальный медленный интернет и многосуточный offline cache;
- FCM;
- WebRTC, Bluetooth, speaker routing и входящий звонок;
- реальные E2E text/media payloads;
- APK build/signature verification.
