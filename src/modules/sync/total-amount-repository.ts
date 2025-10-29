import fs from "fs";
import type { LastTotalAmount } from "../../types/sync.js";
import { logger } from "../logger.js";

export class TotalAmountRepository {
  constructor(private filePath: string) {}

  /**
   * 総額データをファイルから読み込む
   */
  load(): LastTotalAmount[] {
    if (!fs.existsSync(this.filePath)) {
      logger.info("総額記録ファイルがありません。");
      return [];
    }

    try {
      const data = fs.readFileSync(this.filePath, { encoding: "utf-8" });
      const parsed = JSON.parse(data);

      if (!parsed) {
        throw new Error("総額記録ファイルの中身が空です。");
      }

      return parsed;
    } catch (error) {
      logger.error(error, "総額記録ファイルの読み込みに失敗しました。");
      throw error;
    }
  }

  /**
   * 総額データをファイルに保存する
   */
  save(data: LastTotalAmount[]): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), { encoding: "utf-8" });
    } catch (error) {
      logger.error(error, "総額記録ファイルの保存に失敗しました。");
      throw error;
    }
  }
}
