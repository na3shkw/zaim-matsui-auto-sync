import readline from "readline";

/**
 * ユーザー入力を待機する
 *
 * @param question プロンプトとして表示する文字列
 * @returns 入力された文字列
 */
export function getUserInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
