import https from "https";

/**
 * HTTPSリクエストを送信する
 *
 * @param url URL
 * @param method HTTPメソッド
 * @param headers リクエストヘッダ
 * @param body リクエストボディ
 * @returns レスポンス
 */
export async function sendRequest(
  url: string,
  method: string = "GET",
  headers: Record<string, string> = {},
  body?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const contentLength = body ? { "content-length": Buffer.byteLength(body) } : {};
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...contentLength,
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
