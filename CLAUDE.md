# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

松井証券のお客様サイトを Playwright でスクレイピングして資産評価額を取得し、前回実行時からの差分を Zaim API の収入として記録する CLI アプリケーション。cron 等による定期実行を前提とする。コード・コメント・ログ・コミットメッセージはすべて日本語で記述する。

## 開発時の注意

- 実行系スクリプトは `tsx --env-file=.env` を使用するため、ローカル実行時は `.env` に秘密情報だけでなく `CONFIG_FILE` / `ZAIM_TOTAL_AMOUNT_FILE` / `ZAIM_ACCESS_TOKEN_FILE` / `CHROMIUM_USER_DATA_DIR_*` / `ERROR_LOG_DIR` の定義が必要。devcontainer では `containerEnv`、Docker 実行時は `compose.yaml` の `environment` で設定されている（`.env.example` には含まれない）。
- 事前セットアップ（パスキー登録、Google ログイン、Zaim トークン取得）および Docker 経由の実行手順は README.md を参照。

## アーキテクチャ

### 全体の流れ（`src/modules/sync/sync-service.ts`）

`src/commands/sync-matsui-zaim.ts` で依存関係を組み立て、`MatsuiZaimSyncService.sync()` に注入する（設定 → Scraper → LoginMethod → TotalAmountRepository → ZaimRegistrar。ZaimRegistrar は `ZAIM_REGISTER_METHOD` に応じて `createZaimRegistrar()` が生成する）。処理の仕様は以下の通り:

1. 有効な口座を `matsui.type`（戦略タイプ）でグルーピングし、同一戦略のスクレイピングは 1 回のみ実行して結果を共有する。
2. 記録する金額は **現在の評価額 − 総額記録ファイルの前回値** とする。
   - 差分が 0 円の口座はスキップする。
   - Zaim に差分を収入として登録し、成功後に前回値を現在値へ更新して**口座ごとに**記録ファイルへ保存する（後続の口座が失敗しても二重登録にならないようにするため）。
   - `--dry-run` 指定時も `ZaimRegistrar.registerIncome(params, { dryRun: true })` を呼び出すが、登録方式側で登録を行わず、記録ファイルも更新しない。ドライランの指定は `registerIncome()` の引数でのみ渡す（登録方式のインスタンスには持たせない）。

前回値は `ZAIM_TOTAL_AMOUNT_FILE`（`appdata/zaim/zaim-total-amount.json`）に Zaim の `accountId` ごとに保存する。このファイルの損壊・巻き戻りは差分の不整合につながるため、ファイル操作は必ず `TotalAmountRepository` 経由で実行する。なお `config.json` では、Zod の `refine` により同一 `zaim.accountId` の重複を禁止している（同一 Zaim 口座への複数松井口座の集約は不可）。

### コンポーネント構造

ログイン方式（`MATSUI_LOGIN_METHOD` → `LoginMethodFactory`）と資産取得戦略（`config.json` の `matsui.type` → `StrategyFactory`）をインターフェースで分離しており、`MatsuiScraper` が両者を保持する。新しい資産種別を追加する場合は、戦略クラス・`StrategyFactory`・`config.ts` の `StrategyTypeSchema`・`sync-service.ts` の `extractAmount()`・`src/types/matsui.ts` の型をすべて更新する。

### セッションとブラウザ

- `modules/browser.ts` にて `chromium.launchPersistentContext`（`channel: "chromium"`, `--single-process`）を使用し、ユーザーデータディレクトリを保持・再利用する。`launchPersistentContext` は `storageState` 非対応のため、Cookie は `storage-state.json` に保存し `addCookies()` で復元する。ポップアップ用の `Rtoaster*.js` はルートで無効化する。
- ストレージ状態の保存は、ログイン方式ではなく `MatsuiScraper.authenticate()` がログイン成功後に `saveState()` で行う。
- スクレイピング中に `SessionTimeoutError`（`throwIfSessionTimeout()` が iframe 内文言から判定）が発生した場合のみ、`clearSession()` → 再ログイン → 1 回のリトライを実行する。
- URL は直書きせず、`matsui/page.ts` の `MatsuiPage`（Zaim API は `zaim/endpoints.ts` の `Endpoint`、Zaim のウェブ画面は `zaim-web/page.ts` の `ZaimWebPage`）の静的 getter を参照する。URL の結合には `utils.ts` の `joinUrl()` を使う。
- 戦略の実行失敗時および収入登録の失敗時は、`ERROR_LOG_DIR/<timestamp>/` にスクリーンショット・HTML・metadata.json を出力する。

### Zaim モジュール

Zaim への収入登録は `sync/zaim-registrar.ts` の `ZaimRegistrar` で抽象化しており、`ZAIM_REGISTER_METHOD`（`api` | `web`、既定 `api`）で切り替える。`web` は `zaim-web/` の `ZaimWebRegistrar` がくふうアカウント（メール・パスワード＋TOTP、`zaim-web/totp.ts` で生成）でログインし、`/money/new?toggle=income` を操作する。金額欄は読み取り専用の電卓入力のため paste イベントで入力する。セレクタは `zaim-web/selectors.ts` に集約し、画面調査には `zaim-cli web inspect`（headed ブラウザでの手動操作中の HTML・スクショ・登録リクエストを保存）を使う。Zaim 単体の動作確認は `zaim-cli web login` / `zaim-cli web register-income --dry-run`（送信ボタンを押さない）で行う。ログインは、ログイン画面に留まった場合はメールアドレス・パスワードの誤りとして、2段階認証画面に留まった場合は次の周期のコードで 1 回だけ再試行したうえでエラーにする。Zaim の実際のウェブ画面がないと検証できない処理（画面操作・ログイン）は自動テストの対象外とする（松井証券のスクレイピングと同じ方針）。

`zaim/` は OAuth 1.0a の自前実装。アクセストークンは `ZAIM_ACCESS_TOKEN_FILE` に保存し、初回取得は `zaim-cli auth setup-token` で行う。認証フローのシーケンス図は `src/modules/zaim/README.md` に記載。

## 慣習

- ESM + `verbatimModuleSyntax` を採用。相対 import には必ず `.js` 拡張子を付与し、型のみの import は `import type` を使用する。`noUncheckedIndexedAccess` と `exactOptionalPropertyTypes` を有効化している。
- ロガーは `modules/logger.ts` の `logger`（pino、Proxy 経由の遅延シングルトン）を使用する。テスト時は `vi.mock("../logger.js")` により `src/modules/__mocks__/logger.ts` を使用する。
- 環境変数はモジュールトップで `const { FOO } = process.env` として参照し、使用箇所で未設定チェックを行って日本語のエラーをスローする。
- テストは対象ファイルと同階層に `*.test.ts` として配置する。Playwright の `Page` / `FrameLocator` は必要なメソッドのみモック化し、`as unknown as Page` でキャストする。
- リリース管理には tagpr を使用する（`main` ブランチへのマージで release PR 作成、`package.json` がバージョンファイル）。
