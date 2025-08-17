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
