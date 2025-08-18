import crypto from "crypto";
import fs from "fs";
import OAuth from "oauth-1.0a";
import { URLSearchParams } from "url";
import { logger } from "../logger.js";
import { getUserInput } from "../utils.js";
import { Endpoint } from "./endpoints.js";
import { sendRequest } from "./request.js";

const { ZAIM_CONSUMER_KEY, ZAIM_CONSUMER_SECRET, ZAIM_ACCESS_TOKEN_FILE } = process.env;

interface OAuthToken {
  oauth_token: string;
  oauth_token_secret: string;
}

interface OAuthTokenResponse extends OAuthToken {
  oauth_callback_confirmed: string;
}

export class ZaimAuth {
  private oauthAccessToken?: OAuth.Token;
  private oauth: OAuth;

  constructor(authenticate: boolean = false) {
    if (!ZAIM_CONSUMER_KEY || !ZAIM_CONSUMER_SECRET) {
      throw new Error(
        "環境変数 ZAIM_CONSUMER_KEY または ZAIM_CONSUMER_SECRET が設定されていません。"
      );
    }
    this.oauth = new OAuth({
      consumer: {
        key: ZAIM_CONSUMER_KEY,
        secret: ZAIM_CONSUMER_SECRET,
      },
      signature_method: "HMAC-SHA1",
      hash_function(base_string, key) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });
    if (authenticate) {
      this.authenticate();
    }
    this.loadAccessToken();
  }

  /**
   * アクセストークンをセットする
   *
   * @param oauthToken OAuthトークンのオブジェクト
   */
  private setAccessToken(oauthToken: OAuthToken): void {
    this.oauthAccessToken = {
      key: oauthToken.oauth_token,
      secret: oauthToken.oauth_token_secret,
    };
  }

  /**
   * アクセストークンをファイルから読み込む
   */
  private loadAccessToken(): void {
    if (!ZAIM_ACCESS_TOKEN_FILE) {
      throw new Error("環境変数 ZAIM_ACCESS_TOKEN_FILE が設定されていません。");
    }
    if (!fs.existsSync(ZAIM_ACCESS_TOKEN_FILE)) {
      throw new Error(
        `アクセストークンファイル ${ZAIM_ACCESS_TOKEN_FILE} がありません。認証を先に行ってください。`
      );
    }
    const accessToken = JSON.parse(fs.readFileSync(ZAIM_ACCESS_TOKEN_FILE, { encoding: "utf-8" }));
    if (!accessToken.oauth_token || !accessToken.oauth_token_secret) {
      throw new Error("アクセストークンの内容が不正です。認証を行ってください。");
    }
    this.setAccessToken(accessToken);
  }

  /**
   * リクエストトークンを取得する
   *
   * @returns リクエストトークンのオブジェクト
   */
  private async getRequestToken(): Promise<OAuthTokenResponse> {
    const url = Endpoint.requestToken;
    const authHeader = this.generateAuthHeader("POST", url, {
      oauth_callback: "oob",
    });

    // POSTボディにoauth_callbackを含める
    const postData = "oauth_callback=oob";

    const response = await sendRequest(
      url,
      "POST",
      {
        Authorization: authHeader,
      },
      postData
    );

    const params = new URLSearchParams(response);
    return {
      oauth_token: params.get("oauth_token") || "",
      oauth_token_secret: params.get("oauth_token_secret") || "",
      oauth_callback_confirmed: params.get("oauth_callback_confirmed") || "",
    };
  }

  /**
   * アクセストークンを取得する
   *
   * @param verifier 認証コード
   * @returns アクセストークンのオブジェクト
   */
  private async getAccessToken(verifier: string): Promise<OAuthToken> {
    const url = Endpoint.accessToken;
    const authHeader = this.generateAuthHeader("POST", url, {
      oauth_verifier: verifier,
    });

    // POSTボディにoauth_verifierを含める
    const postData = `oauth_verifier=${encodeURIComponent(verifier)}`;

    const response = await sendRequest(
      url,
      "POST",
      {
        Authorization: authHeader,
      },
      postData
    );

    const params = new URLSearchParams(response);
    return {
      oauth_token: params.get("oauth_token") || "",
      oauth_token_secret: params.get("oauth_token_secret") || "",
    };
  }

  /**
   * OAuth認証フローを実行する
   */
  private async authenticate(): Promise<void> {
    if (!ZAIM_ACCESS_TOKEN_FILE) {
      throw new Error("環境変数 ZAIM_ACCESS_TOKEN_FILE が設定されていません。");
    }
    try {
      console.log("🔐 Zaim OAuth 1.0a 認証を開始します...\n");

      // Step 1: リクエストトークンを取得
      console.log("📝 Step 1: リクエストトークンを取得中...");
      const requestToken = await this.getRequestToken();
      console.log("✅ リクエストトークンを取得しました\n");

      // 一時的にトークンを設定
      this.setAccessToken(requestToken);

      // Step 2: ユーザーに認証URLを提示
      const authUrl = `${Endpoint.authorize}?oauth_token=${requestToken.oauth_token}`;
      console.log("🌐 Step 2: 以下のURLにアクセスして認証を行ってください:");
      console.log(`${authUrl}\n`);

      // Step 3: 認証コードを取得
      const verifier = await getUserInput(
        "認証後に表示されるコード（verifier）を入力してください: "
      );

      if (!verifier) {
        throw new Error("認証コードが入力されませんでした");
      }

      // Step 4: アクセストークンを取得
      console.log("\n🔑 Step 3: アクセストークンを取得中...");
      const accessToken = await this.getAccessToken(verifier);
      fs.writeFileSync(ZAIM_ACCESS_TOKEN_FILE, JSON.stringify(accessToken, null, 2), {
        encoding: "utf-8",
      });
      console.log("✅ アクセストークンを取得して保存しました！\n");

      console.log("🎉 認証が完了しました！");
    } catch (error) {
      logger.error(error, "❌ 認証エラー:");
      throw error;
    }
  }

  /**
   * OAuthヘッダーを生成する
   *
   * @param method HTTPメソッド
   * @param url URL
   * @param data カスタムデータ（oauth_*のオプションも含む）
   * @returns OAuthヘッダー
   */
  generateAuthHeader(method: string, url: string, data?: Record<string, string>): string {
    const oauthData = this.oauth.authorize(
      {
        url,
        method,
        data,
      },
      this.oauthAccessToken
    );
    return this.oauth.toHeader(oauthData).Authorization;
  }
}
