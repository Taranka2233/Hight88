# Build Report

## Web

- `npm run build:web`: passed.
- `node scripts/verify-web.mjs`: passed.
- `dist/index.html` идентичен `template_fixed.html`.
- Итоговый HTML автономный: CSS и JavaScript встроены, CDN не используются.

## APK

APK **не собрана**.

Причины:

- в среде отсутствуют Android SDK, `sdkmanager`, `zipalign` и `apksigner`;
- установка npm dependencies не завершилась в доступное время;
- production signing key не предоставлен.

Поэтому подпись v2/v3, ZIP integrity и install/update compatibility не проверялись. Готовый workflow и `scripts/build-android.sh` включены в проект для выполнения в Android/GitHub Actions окружении.
