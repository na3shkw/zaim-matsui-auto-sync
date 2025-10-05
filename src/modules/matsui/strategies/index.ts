import { FundStrategy } from "./fund-strategy.js";
import type { AssetScrapingStrategy } from "./strategy-interface.js";

type StrategyName = "fund";

export class StrategyFactory {
  /**
   * 戦略名に基づいて適切なスクレイピング戦略を生成する
   * @param strategyName 戦略名
   * @returns スクレイピング戦略のインスタンス
   */
  static create(strategyName: StrategyName): AssetScrapingStrategy<unknown> {
    switch (strategyName) {
      case "fund":
        return new FundStrategy();
      default:
        throw new Error(`不明な戦略名: ${strategyName}`);
    }
  }
}
