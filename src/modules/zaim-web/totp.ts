import { createHmac } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpOptions {
  /** 桁数（既定: 6） */
  digits?: number;
  /** 有効期間（秒、既定: 30） */
  period?: number;
}

/**
 * Base32 文字列をバイト列にデコードする
 *
 * 空白・ハイフン・パディング（=）は無視し、大文字小文字は区別しない。
 *
 * @param input Base32 文字列
 * @returns デコード結果
 */
export function decodeBase32(input: string): Buffer {
  const normalized = input.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Base32 として不正な文字が含まれています: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * RFC 6238 に基づくワンタイムパスワード（HMAC-SHA1）を生成する
 *
 * @param secret Base32 形式のシークレットキー
 * @param timestamp 基準時刻（ミリ秒）
 * @param options 桁数・有効期間
 * @returns ワンタイムパスワード
 */
export function generateTotp(
  secret: string,
  timestamp: number = Date.now(),
  { digits = 6, period = 30 }: TotpOptions = {},
): string {
  const counter = Math.floor(timestamp / 1000 / period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * 現在のワンタイムパスワードの残り有効秒数を返す
 *
 * @param timestamp 基準時刻（ミリ秒）
 * @param period 有効期間（秒）
 * @returns 残り秒数
 */
export function getTotpRemainingSeconds(timestamp: number = Date.now(), period: number = 30): number {
  return period - (Math.floor(timestamp / 1000) % period);
}
