# Changelog

## [v0.4.0](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.3.0...v0.4.0) - 2026-04-25
### New Features 🎉
- feat: パスキー認証に対応 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/47
### Other Changes
- build(deps): bump vite from 7.2.2 to 7.3.2 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/44
- refactor: ログイン方式をスクレイピング戦略から分離する by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/42
- ci: ドラフトPRがReady for reviewになった際にCIが実行されない問題を修正 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/46
- refactor: ページリセットを prepareTargetPage に移し必須化する by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/43
- build(deps): bump postcss from 8.5.6 to 8.5.10 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/49
- refactor: ログインメソッドをサブディレクトリに整理してファクトリを導入 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/48
- fix: entrypoint に register-matsui-passkey コマンドを追加 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/50

## [v0.3.0](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.2.1...v0.3.0) - 2026-04-01
### New Features 🎉
- クッキー管理をPlaywrightのstorageState APIを使用するようにリファクタリング by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/36
### Bug Fixes 🐛
- fix: ログインページのボタン特定エラーとnetworkidleタイムアウトを修正 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/39

## [v0.2.1](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.2.0...v0.2.1) - 2026-03-26
### Other Changes
- build(deps): bump picomatch from 4.0.3 to 4.0.4 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/37

## [v0.2.0](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.1.2...v0.2.0) - 2026-03-10
### Other Changes
- 投資信託ログインフローの更新 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/34

## [v0.1.2](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.1.1...v0.1.2) - 2026-03-09
### Other Changes
- docs: READMEのVNC接続手順を簡略化 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/23
- build(deps): bump rollup from 4.53.2 to 4.59.0 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/25
- attest actionをv4に更新し、新しいアクション名を適用 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/27
- build(deps): bump docker/metadata-action from 5 to 6 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/30
- build(deps): bump docker/build-push-action from 6 to 7 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/28
- build(deps): bump docker/setup-buildx-action from 3 to 4 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/29
- build(deps): bump docker/setup-qemu-action from 3 to 4 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/31
- build(deps): bump docker/login-action from 3 to 4 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/32

## [v0.1.1](https://github.com/na3shkw/zaim-matsui-auto-sync/compare/v0.1.0...v0.1.1) - 2026-02-15
### Other Changes
- publish-releaseジョブをgh CLIに簡素化 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/18
- Revert "Release for v0.1.1" by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/21
- セキュリティとプロビナンスを改善したGitHub Actionsワークフローのリファクタリング by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/22

## [v0.1.0](https://github.com/na3shkw/zaim-matsui-auto-sync/commits/v0.1.0) - 2026-02-15
### New Features 🎉
- tagprとGHCRを使った自動リリース機能を追加・Dockerコンテナのユーザー権限管理改善 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/12
- feat: 認証コード取得時のTimeoutErrorにリトライロジックを追加 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/13
### Other Changes
- config.jsonで同期設定をできるようにする by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/2
- Bump vite from 7.1.6 to 7.1.11 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/6
- Bump playwright from 1.54.2 to 1.55.1 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/5
- 米国株の時価総額も同期できるようにする by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/4
- エラーログ保存機能の追加と投資信託戦略のタイムアウト改善 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/7
- Bump glob and @vitest/coverage-v8 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/8
- ランダムなポップアップが表示されないようにする by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/11
- build(deps): bump actions/checkout from 5 to 6 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/16
- build(deps): bump actions/setup-node from 5 to 6 by @dependabot[bot] in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/15
- UID/GIDの変更処理を軽量化 by @na3shkw in https://github.com/na3shkw/zaim-matsui-auto-sync/pull/17
