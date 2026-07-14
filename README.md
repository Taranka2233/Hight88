# Night City Net

Стартовый production-oriented фундамент мобильного мессенджера в серьёзной киберпанк-эстетике. Интерфейс создан с нуля и не использует логотипы, персонажей или графические материалы Cyberpunk 2077.

## Что работает сейчас

- автономный `template_fixed.html` без CDN и внешних шрифтов;
- авторизация/регистрация в демонстрационном локальном режиме;
- список личных чатов, групп и каналов;
- адаптивный чат для 320 px, landscape и desktop;
- текст, фото-заглушка, файл, голосовое и системные сообщения;
- ответы, реакции и статусы доставки в UI;
- конечный автомат множественного выделения;
- long-press, tap-toggle, reconciliation при удалении сообщения;
- копирование, частичное удаление, пересылка и закрепление;
- operation token, timeout, idempotency key и ограничение параллелизма;
- локальные черновики и offline-индикатор;
- панели контактов, профиля, настроек, поиска, архива, закладок, загрузок и приглашений;
- каркас аудио/видеозвонка и безопасная отмена запроса микрофона;
- Firebase Repository, Firestore Rules и Storage Rules как production-заготовка;
- Capacitor 8 configuration и GitHub Actions workflow для APK.

## Структура

```text
assets/public/                 исходный web-интерфейс
src/core/selection.mjs         state machine выделения
src/core/capabilities.mjs      единый расчёт прав
src/core/operations.mjs        безопасные массовые операции
src/services/local-repository  локальный realtime demo adapter
src/services/firebase-repository Firebase adapter
firebase/                      Firestore/Storage rules
scripts/build-web.mjs          сборка автономного HTML
scripts/build-android.sh       проверяемая Android-сборка
tests/                         unit и UI smoke tests
template_fixed.html            автономный итоговый интерфейс
```

## Запуск интерфейса

Откройте `template_fixed.html` в современном Chromium/WebView. Для пересборки:

```bash
npm run build:web
npm test
node scripts/verify-web.mjs
```

UI smoke-тест использует Playwright и системный Chromium:

```bash
python tests/ui-smoke.py
```

## Firebase production wiring

Демонстрационная сборка использует `LocalRepository`. Для production необходимо:

1. Настроить Firebase Authentication.
2. Передать Firebase config через защищённую конфигурацию сборки.
3. Заменить создание `LocalRepository` на `FirebaseRepository`.
4. Развернуть и протестировать `firebase/firestore.rules` и `firebase/storage.rules` в Emulator Suite.
5. Настроить FCM, Cloud Functions для fan-out/уведомлений и отдельный presence-контур.
6. Провести криптографический аудит E2E/ICE протокола. Наличие UI-метки E2E само по себе не означает реализованное end-to-end шифрование.

## Android

Проект рассчитан на Capacitor. Локальный скрипт `scripts/build-android.sh`:

- запускает тесты и web integrity check;
- создаёт/синхронизирует Android-проект;
- устанавливает versionCode/versionName;
- собирает debug APK;
- проверяет zipalign, подпись, ZIP-целостность;
- создаёт SHA-256.

Для release необходимо предоставить собственный signing key и добавить release signing step. Без исходного ключа APK нельзя обновить поверх ранее подписанной версии приложения.

## Ограничения текущей итерации

Это архитектурно рабочий foundation/MVP, а не завершённый production-мессенджер. Реальные Firebase credentials, FCM backend, WebRTC signaling/SFU, E2E cryptographic protocol, медиа upload/download, background services, Android Telecom/Bluetooth integration и emulator/device matrix ещё не подключены. Firestore/Storage rules подготовлены, но не прошли Firebase Emulator Suite в этой среде.
