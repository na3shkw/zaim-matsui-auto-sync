import fs from "fs";
import { z } from "zod";

const { CONFIG_FILE } = process.env;

// Zodスキーマ定義
export const MatsuiConfigSchema = z.object({
  type: z.literal("fund"),
  accountName: z.string(),
});

export const ZaimConfigSchema = z.object({
  accountId: z.number(),
  categoryId: z.number(),
});

export const AccountConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  matsui: MatsuiConfigSchema,
  zaim: ZaimConfigSchema,
});

export const AppConfigSchema = z.object({
  accounts: z.array(AccountConfigSchema),
});

// 型定義（Zodスキーマから自動生成）
export type MatsuiConfig = z.infer<typeof MatsuiConfigSchema>;
export type ZaimConfig = z.infer<typeof ZaimConfigSchema>;
export type AccountConfig = z.infer<typeof AccountConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * 設定ファイルを読み込んで型安全なオブジェクトを返す
 */
export function loadConfig(): AppConfig {
  if (!CONFIG_FILE) {
    throw new Error("環境変数 CONFIG_FILE が設定されていません。");
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`設定ファイルが存在しません: ${CONFIG_FILE}`);
  }

  try {
    const jsonData = fs.readFileSync(CONFIG_FILE, "utf8");
    const rawData = JSON.parse(jsonData);

    return AppConfigSchema.parse(rawData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(`設定ファイルの形式が正しくありません (${CONFIG_FILE}): ${errorMessages}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`設定ファイルのJSON形式が不正です (${CONFIG_FILE}): ${error.message}`);
    }
    if (error instanceof Error) {
      throw new Error(`設定ファイルの読み込みに失敗しました (${CONFIG_FILE}): ${error.message}`);
    }
    throw error;
  }
}
