# Zaim-Matsui Auto Sync

[![Test](https://github.com/na3shkw/zaim-matsui-auto-sync/actions/workflows/test.yml/badge.svg)](https://github.com/na3shkw/zaim-matsui-auto-sync/actions/workflows/test.yml)
[![CodeQL](https://github.com/na3shkw/zaim-matsui-auto-sync/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/na3shkw/zaim-matsui-auto-sync/actions/workflows/github-code-scanning/codeql)

## 概要

松井証券の資産状況（投資信託・米国株）を Zaim に同期するコマンドラインアプリケーションです。
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

### `.env` ファイルの作成

`.env.example` をコピーして `.env` ファイルを作成し、各項目の内容を設定する。

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

### `config.json` ファイルの作成

`config.example.json` をコピーして `config.json` ファイルを作成し、各項目の内容を設定する。

```jsonc
{
  "name": "NISA",   // 任意の名前
  "enabled": true,  // 無効化したい場合は false にする
  "matsui": {
    "type": "fund", // "fund" (投資信託) または "usstock" (米国株)
    "accountName": "NISA口座(積立)" // 下記 (A) を参照
  },
  "zaim": {
    "accountId": "12345678",      // 下記 (B) を参照
    "categoryId": "12345678"      // 下記 (C) を参照
  }
}
```

#### (A) `matsui.accountName`

この値は同期対象の口座を指定するもの。

- **投資信託 (`type: "fund"`) の場合**:
  - 松井証券の投資信託残高照会ページにアクセスし、全保有銘柄の表にある「口座区分」列の値を設定する
  - 例: `"NISA口座(積立)"`、`"特定口座"`
- **米国株 (`type: "usstock"`) の場合**:
  - 任意の文字列を設定する（米国株のデータ取得にはこの項目を利用しない）

#### (B) `zaim.accountId`

この値は同期先の Zaim の口座 ID を指定するもの。
下記コマンドを実行して口座 ID 一覧を取得し、記録先の口座 ID を設定する。
異なる松井証券の口座の同期先として Zaim の同じ口座 ID は設定できないことに注意する。

```bash
docker compose run --rm -e APP_COMMAND='zaim-cli' -e APP_ARGS='account list' app
```

#### (C) `zaim.categoryId`

この値は同期先の Zaim の収入カテゴリ ID を指定するもの。
下記コマンドを実行して収入カテゴリ ID 一覧を取得し、記録に利用するカテゴリ ID を設定する。

```bash
docker compose run --rm -e APP_COMMAND='zaim-cli' -e APP_ARGS='category list --mode income' app
```

### 総額記録ファイルを作成する

`appdata/zaim/zaim-total-amount.example.json` ファイルをコピーして `appdata/zaim/zaim-total-amount.json` を作成し、内容を適宜編集して保存する。

```jsonc
[
  {
    "amount": 0,  // 記録開始時点での Zaim の口座残高
    "accountId": 12345678,  // config.json の zaim.accountId と同じ値
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
    $(find $PLAYWRIGHT_BROWSERS_PATH/ -executable -name chrome -print -quit) --no-sandbox --user-data-dir=./appdata/chromium/google https://www.google.com
    ```
2. 手動操作で Google にログインする。
3. ログイン後、https://messages.google.com/web/ に遷移してデバイスのペア設定を行う。
4. Chromium を閉じる。
5. 下記のコマンドで Playwright 経由で Chromium を起動する。
    ```bash
    npx playwright cr --user-data-dir=./appdata/chromium/google https://messages.google.com/web/
    ```
6. メッセージ内容が表示されることを確認する。
