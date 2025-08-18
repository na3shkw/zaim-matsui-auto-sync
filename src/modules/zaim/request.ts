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
  const requestHeaders: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    ...headers,
  };

  if (body) {
    requestHeaders["content-length"] = Buffer.byteLength(body).toString();
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    fetchOptions.body = body;
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.text();
}
