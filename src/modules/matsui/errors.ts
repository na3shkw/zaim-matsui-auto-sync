export class SessionTimeoutError extends Error {
  constructor(message = "セッションタイムアウトエラーが発生しました。") {
    super(message);
    this.name = "SessionTimeoutError";
  }
}
