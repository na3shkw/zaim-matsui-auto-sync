# Zaim-Matsui Auto Sync

## 概要

松井証券の NISA 資産状況を Zaim に同期するコマンドラインアプリケーションです。
Zaim には松井証券の連携があるものの、[松井証券の電話番号認証導入によって自動的な同期ができない](https://content.zaim.net/questions/show/1125)という背景があります。

このコマンドラインアプリケーションでは松井証券にログインして資産状況を取得し、そのデータを Zaim API を通して記録するものです。
cron などを利用して定期実行することを想定しています。

## 前提要件

- 松井証券の SMS 認証を有効にしていること。
- Android スマートフォンで SMS を受信し、Google メッセージで内容を確認できること。
- Zaim API にアプリケーションが登録してある（コンシューマ ID とコンシューマシークレットがある）こと。
- VNC クライアントがインストールされていること。
    - 事前セットアップに必要。

## 事前セットアップ

### Google へのログイン

Google メッセージへのアクセスをスムーズに行うため、事前に Chromium でログインとデバイスのペア設定を行う。

1. 下記のコマンドで Chromium を起動する。ホスト側 VNC ポートは適宜選択して入力する。
    ```bash
    docker compose run --rm -e APP_COMMAND='login-google' -e APP_ARGS='https://www.google.com' --publish <ホスト側 VNC ポート>:5901 app
    ```
2. `localhost:<ホスト側 VNC ポート>` に VNC 接続する。接続ユーザーは `appuser` で認証はなし。
3. 手動操作で Google にログインする。
4. ログイン後、https://messages.google.com/web/ に遷移してデバイスのペア設定を行う。
5. Chromium を閉じる。
6. 下記のコマンドで再度 Chromium を開き、VNC 接続してメッセージ内容が表示されることを確認する。
    ```bash
    docker compose run --rm -e APP_COMMAND='login-google' -e APP_ARGS='https://messages.google.com/web/' --publish <ホスト側 VNC ポート>:5901 app
    ```

### Zaim API のアクセストークンを取得する

下記コマンドを実行し、コマンドラインの指示に従って認証する。

```bash
docker compose run --rm -e APP_COMMAND='zaim-cli' -e APP_ARGS='auth setup-token' app
```

### 総額記録ファイルを作成する

`appdata/zaim/zaim-total-amount.json` ファイルを下記の内容で保存する。

```jsonc
[
  {
    // 記録開始時点での Zaim の口座残高
    "amount": 0,
    // .env の ZAIM_MATSUI_ACCOUNT_ID と同じ値
    "accountId": 12345678,
    "updatedAt": "2025-09-01T12:34:56+09:00"
  }
]
```

## 実行方法

下記コマンドを実行する。

```bash
docker compose run --rm -e APP_COMMAND='sync-matsui-zaim' app
```

Zaim への記録を行わないドライランモードで実行したい場合は下記のコマンドを実行する。

```bash
docker compose run --rm -e APP_COMMAND='sync-matsui-zaim' -e APP_ARGS='--dry-run' app
```

## 開発環境構築

### 事前セットアップ

1. 下記のコマンドで Chromium を起動する。
    ```bash
    ~/.cache/ms-playwright/chromium-1181/chrome-linux/chrome --no-sandbox --user-data-dir=./appdata/chromium/google https://www.google.com
    ```
2. 手動操作で Google にログインする。
3. ログイン後、https://messages.google.com/web/ に遷移してデバイスのペア設定を行う。
4. Chromium を閉じる。
5. 下記のコマンドで Playwright 経由で Chromium を起動する。
    ```bash
    npx playwright cr --user-data-dir=./appdata/chromium/google https://messages.google.com/web/
    ```
6. メッセージ内容が表示されることを確認する。
