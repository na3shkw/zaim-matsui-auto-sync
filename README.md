# Zaim-Matsui Auto Sync

## 事前セットアップ

Google メッセージへのアクセスをスムーズに行うため、事前に Chromium でログインとデバイスのペア設定を行う。

1. 下記のコマンドで Chromium を起動する。
    ```bash
    ~/.cache/ms-playwright/chromium-1181/chrome-linux/chrome --no-sandbox --user-data-dir=./chromium_data/google https://www.google.com
    ```
2. 手動操作で Google にログインする。
3. ログイン後、https://messages.google.com/web/ に遷移してデバイスのペア設定を行う。
4. Chromium を閉じる。
5. 下記のコマンドで Playwright 経由で Chromium を起動する。
    ```bash
    npx playwright cr --user-data-dir=./chromium_data/google https://messages.google.com/web/
    ```
6. メッセージ内容が表示されることを確認する。
