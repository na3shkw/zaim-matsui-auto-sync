import type { StrategyType } from "../../config.js";
import { FundStrategy } from "./fund-strategy.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";
import { UsStockPowerStrategy } from "./usstock-power-strategy.js";
import { UsStockStrategy } from "./usstock-strategy.js";

export class StrategyFactory {
  /**
   * 戦略名に基づいて適切なスクレイピング戦略を生成する
   * @param strategyName 戦略名
   * @returns スクレイピング戦略のインスタンス
   */
  static create(strategyName: StrategyType): AssetScrapingStrategy<unknown> {
    switch (strategyName) {
      case "fund":
        return new FundStrategy();
      case "usstock":
        return new UsStockStrategy();
      case "usstock-power":
        return new UsStockPowerStrategy();
    }
  }
}
