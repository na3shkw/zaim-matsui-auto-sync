/**
 * 松井証券のサイト操作の妨げになるため、読み込みを無効化するスクリプトのURLパターン
 */
export const MATSUI_BLOCKED_SCRIPT_PATTERNS = [
  // ランダムに表示されるポップアップ
  /\/Rtoaster(\.Popup)?\.js(\?.*)?$/,
  // KARTE が表示する要素がボタンに重なり、クリックできなくなる
  /^https:\/\/[^/]+\.karte\.io\//,
];
