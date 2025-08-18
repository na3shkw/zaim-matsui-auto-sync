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
