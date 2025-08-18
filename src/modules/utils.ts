import readline from "readline";

/**
 * パラメータをキーで自然順ソートし、キーと値をURLエンコードしてkey=valueの形式にしたものを結合して返す。
 *
 * @example
 * // returns a=2&z=1&%E3%82%8A%E3%82%93%E3%81%94=3
 * getJoinedParamString({"z": 1, "a": 2, "りんご": 3}, "&")
 * @example
 * // returns a="2"&z="1"&%E3%82%8A%E3%82%93%E3%81%94="3"
 * getJoinedParamString({"z": 1, "a": 2, "りんご": 3}, "&", '"')
 * @param obj パラメータを表現するオブジェクト
 * @param separator 結合する際の区切り文字
 * @param valueQuotationChar パラメータ値を囲む文字列
 * @returns 結合された文字列
 */
export function getJoinedParamString(
  obj: Record<any, any>,
  separator: string,
  valueQuotationChar = ""
): string {
  const quot = valueQuotationChar;
  return Object.keys(obj)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${quot}${encodeURIComponent(obj[key])}${quot}`)
    .join(separator);
}

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
