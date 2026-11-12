/**
 * Zaim ウェブ画面操作で使用するセレクタ
 *
 * 画面構造の変更に追従しやすいよう、セレクタはこのファイルに集約する。
 * 画面構造を調べ直す場合は `zaim-cli web inspect` を使用する。
 */

/** くふうアカウントのログイン画面（/signin） */
export const KufuLoginSelector = {
  email: "#email",
  password: "#password",
  submit: "#login-button",
} as const;

/** くふうアカウントの2段階認証画面（/signin/totp） */
export const KufuTwoFactorSelector = {
  passcode: "#passcode",
  submit: 'form[action$="/signin/totp"] input[type="submit"]',
} as const;

/**
 * Zaim の入力画面（/money/new?toggle=income）
 *
 * React の CSS Modules によりクラス名の末尾にハッシュが付くため、前方一致で指定する。
 */
export const IncomeFormSelector = {
  form: "#money_new_form",
  /** 各入力項目（項目名と入力欄の組）のラッパー */
  field: '[class*="IncomeForm-module__wrapper"]',
  /** 各入力項目の項目名 */
  fieldTitle: '[class*="IncomeForm-module__title"]',
  amount: 'input[name="amount"]',
  date: 'input[name="date"]',
  comment: 'input[name="comment"]',
  submit: 'input[type="submit"]',
  /** 登録成功時に表示されるメッセージ */
  successAlert: ".alert-info",
  /** 登録失敗時に表示されるメッセージ */
  errorAlert: ".alert-danger, .alert-error",
} as const;

/** 入力画面の項目名 */
export const IncomeFormFieldTitle = {
  category: "カテゴリ",
  account: "入金先",
} as const;

/** 登録成功時のメッセージ */
export const INCOME_REGISTERED_MESSAGE = "入力しました";
