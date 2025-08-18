import crypto from "crypto";
import fs from "fs";
import { URLSearchParams } from "url";
import { logger } from "../logger.js";
import { getJoinedParamString, getUserInput } from "../utils.js";
import { Endpoint } from "./endpoints.js";
import { sendRequest } from "./request.js";

const { ZAIM_CONSUMER_KEY, ZAIM_CONSUMER_SECRET, ZAIM_ACCESS_TOKEN_FILE } = process.env;

interface OAuthConsumerCredentials {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

interface OAuthToken {
  oauth_token: string;
  oauth_token_secret: string;
}

interface OAuthTokenResponse extends OAuthToken {
  oauth_callback_confirmed: string;
}

interface AccessTokenResponse {
  oauth_token: string;
  oauth_token_secret: string;
}

export class ZaimAuth {
  private credentials: OAuthConsumerCredentials;

  constructor(authenticate: boolean = false) {
    if (!ZAIM_CONSUMER_KEY || !ZAIM_CONSUMER_SECRET) {
      throw new Error(
        "環境変数 ZAIM_CONSUMER_KEY または ZAIM_CONSUMER_SECRET が設定されていません。"
      );
    }
    this.credentials = {
      consumerKey: ZAIM_CONSUMER_KEY,
      consumerSecret: ZAIM_CONSUMER_SECRET,
    };
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
    this.credentials.token = oauthToken.oauth_token;
    this.credentials.tokenSecret = oauthToken.oauth_token_secret;
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
   * OAuth 1.0a署名を生成する
   *
   * @param method HTTPメソッド
   * @param url URL
   * @param params URLパラメータ
   * @param tokenSecret トークンシークレット
   * @returns OAuth 1.0a署名
   */
  private generateSignature(
    method: string,
    url: string,
    params: Record<string, string>,
    tokenSecret: string = ""
  ): string {
    // すべてのパラメータ（OAuth + クエリパラメータ）をソートして&で結合
    const joinedParam = getJoinedParamString(params, "&");

    // URLからクエリパラメータを除去
    const baseUrl = url.replace(/\?.+/, "");

    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(baseUrl),
      encodeURIComponent(joinedParam),
    ].join("&");

    const signingKey = `${encodeURIComponent(this.credentials.consumerSecret)}&${encodeURIComponent(
      tokenSecret
    )}`;

    return crypto.createHmac("sha1", signingKey).update(signatureBaseString).digest("base64");
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
  private async getAccessToken(verifier: string): Promise<AccessTokenResponse> {
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
   * @param queryParams URLパラメータ
   * @returns OAuthヘッダー
   */
  generateAuthHeader(
    method: string,
    url: string,
    queryParams: Record<string, string> = {}
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.credentials.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    };

    if (this.credentials.token) {
      oauthParams.oauth_token = this.credentials.token;
    }

    // OAuthパラメータとクエリパラメータを結合
    const allParams = { ...oauthParams, ...queryParams };

    const signature = this.generateSignature(method, url, allParams, this.credentials.tokenSecret);

    oauthParams.oauth_signature = signature;

    // AuthorizationヘッダーにはOAuth関連パラメータのみ含める
    const headerParts = getJoinedParamString(oauthParams, ", ", '"');

    return `OAuth ${headerParts}`;
  }
}
