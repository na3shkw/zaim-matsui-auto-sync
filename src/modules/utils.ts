import readline from "readline";

/**
 * 標準入力から読み取る readline インターフェースを生成する
 *
 * 複数行を続けて受け付ける場合に使用する。使用後は呼び出し側で close() すること。
 *
 * @param withOutput 標準出力にもプロンプトを出力するか（既定: false）
 * @returns readline インターフェース
 */
export function createInputInterface(withOutput = false): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    ...(withOutput ? { output: process.stdout } : {}),
  });
}

/**
 * ユーザー入力を待機する
 *
 * @param question プロンプトとして表示する文字列
 * @returns 入力された文字列
 */
export function getUserInput(question: string): Promise<string> {
  const rl = createInputInterface(true);

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 入力された文字列を数値に変換して返す.
 * 変換できない場合は undefined を返す.
 * カンマ区切りの数値にも対応.
 *
 * @param input 変換する文字列
 * @returns 変換された数値または undefined
 */
export function parseNumber(input: string): number | undefined {
  const normalizedInput = input.replace(/,/g, "").trim();
  const parsedNumber = Number(normalizedInput);
  return isNaN(parsedNumber) ? undefined : parsedNumber;
}

/**
 * ベースURLとパスを結合し、正規化された完全なURLを返す。
 *
 * @param baseUrl ベースとなるURL（末尾のスラッシュなし）
 * @param path URLパス（先頭のスラッシュは有無どちらでもよい）
 * @returns 完全なURL
 */
export function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
  return `${baseUrl}/${normalizedPath}`;
}
