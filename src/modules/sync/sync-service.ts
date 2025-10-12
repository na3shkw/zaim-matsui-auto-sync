import dayjs from "dayjs";
import type { AccountConfig, AppConfig, MatsuiConfig, StrategyType } from "../config.js";
import { logger } from "../logger.js";
import type { MatsuiScraper } from "../matsui/scraper.js";
import { StrategyFactory } from "../matsui/strategies/index.js";
import type { Zaim } from "../zaim/client.js";
import type { TotalAmountRepository } from "./total-amount-repository.js";

export interface SyncOptions {
  dryRun: boolean;
}

export interface LastTotalAmount {
  accountId: number;
  amount: number;
  updatedAt: string;
}

export class MatsuiZaimSyncService {
  constructor(
    private scraper: MatsuiScraper,
    private totalAmountRepo: TotalAmountRepository,
    private zaimClient: Zaim
  ) {}

  /**
   * 同期処理の実行
   *
   * @param config アプリケーション設定
   * @param options 同期オプション
   */
  async sync(config: AppConfig, options: SyncOptions): Promise<void> {
    const enabledAccounts = config.accounts.filter((acc) => acc.enabled);
    if (enabledAccounts.length === 0) {
      throw new Error("有効なアカウントが1つもありません。");
    }

    await this.scraper.initialize();

    try {
      // 戦略ごとにグルーピング（同じ戦略は1回だけ実行）
      const strategyGroups = this.groupByStrategyType(enabledAccounts);

      // 各戦略を実行してデータ取得
      logger.info("資産評価額を取得します。");
      const scrapedDataMap = new Map<StrategyType, any>();

      for (const [strategyType, _] of strategyGroups) {
        const strategy = StrategyFactory.create(strategyType);
        this.scraper.setStrategy(strategy);
        await this.scraper.authenticate();
        const data = await this.scraper.scrape();
        scrapedDataMap.set(strategyType, data);
      }

      // 前回記録時点の総額を取得
      logger.info("総額記録ファイルを取得します。");
      const lastTotalAmounts = this.totalAmountRepo.load();
      logger.info("前回同期実行後の総額を取得しました。");

      // 各アカウントを処理
      for (const account of enabledAccounts) {
        const scrapedData = scrapedDataMap.get(account.matsui.type);
        if (!scrapedData) {
          throw new Error(`口座種別 ${account.matsui.type} のデータが取得できませんでした。`);
        }

        const currentAmount = this.extractAmount(scrapedData, account.matsui);

        await this.processAccount(account, currentAmount, lastTotalAmounts, options.dryRun);
      }

      // 総額データを更新
      if (options.dryRun) {
        logger.info("ドライランモードのため総額データの更新は行いません。");
      } else {
        this.totalAmountRepo.save(lastTotalAmounts);
        logger.info("総額データを更新しました。");
      }
    } finally {
      await this.scraper.close();
    }
  }

  /**
   * 戦略タイプでアカウントをグルーピング
   *
   * @param accounts アカウント一覧
   * @returns 戦略タイプをキー、アカウント配列を値とするMap
   */
  private groupByStrategyType(accounts: AccountConfig[]): Map<StrategyType, AccountConfig[]> {
    const map = new Map<StrategyType, AccountConfig[]>();

    for (const account of accounts) {
      const type = account.matsui.type;
      if (!map.has(type)) {
        map.set(type, []);
      }
      map.get(type)!.push(account);
    }

    return map;
  }

  /**
   * スクレイピングデータから評価額を抽出
   *
   * @param data スクレイピングによって取得したデータ
   * @param matsuiConfig 松井証券の設定
   * @returns 評価額
   */
  private extractAmount(data: any, matsuiConfig: MatsuiConfig): number {
    // 戦略によって構造が異なる場合はここで吸収
    switch (matsuiConfig.type) {
      case "fund": {
        // fund戦略: details[accountName].評価額を参照
        const value = data.details?.[matsuiConfig.accountName]?.評価額;
        if (typeof value !== "number") {
          throw new Error(`${matsuiConfig.accountName}の評価額を取得できませんでした`);
        }
        return value;
      }
      case "usstock": {
        // usstock戦略: totalAmountフィールドを直接参照
        if (typeof data.totalAmount !== "number") {
          throw new Error(`${matsuiConfig.accountName}の評価額を取得できませんでした`);
        }
        return data.totalAmount;
      }
      default:
        throw new Error(`未対応の戦略タイプです: ${matsuiConfig.type}`);
    }
  }

  /**
   * 個別アカウントの処理（差分計算とZaim記録）
   *
   * @param account アカウントの設定
   * @param currentAmount 現在の評価額
   * @param lastTotalAmounts 前回記録時点の総額データ一覧
   * @param dryRun ドライランモードかどうか
   */
  private async processAccount(
    account: AccountConfig,
    currentAmount: number,
    lastTotalAmounts: LastTotalAmount[],
    dryRun: boolean
  ): Promise<void> {
    let lastTotalAmountItem = lastTotalAmounts.find(
      (item) => item.accountId === account.zaim.accountId
    );

    if (typeof lastTotalAmountItem === "undefined") {
      logger.info(
        `${account.name}の前回総額データがありません。初回実行時は前回総額を0として続行します。`
      );
      lastTotalAmountItem = {
        amount: 0,
        accountId: account.zaim.accountId,
        updatedAt: dayjs().format(),
      };
      lastTotalAmounts.push(lastTotalAmountItem);
    }

    const amount = currentAmount - lastTotalAmountItem.amount;
    logger.info(`${account.name}の記録する金額は ${amount} 円です。`);

    if (dryRun) {
      logger.info("ドライランモードのためZaimへの記録は行いません。");
      return;
    }

    // Zaim APIにデータを送信
    await this.zaimClient.registerIncomeJournalEntry({
      categoryId: account.zaim.categoryId,
      amount,
      date: dayjs(),
      toAccountId: account.zaim.accountId,
      comment: "自動同期",
    });
    logger.info(`${account.name}のZaimへの記録が完了しました。`);

    // 総額データに反映
    lastTotalAmountItem.amount = currentAmount;
    lastTotalAmountItem.updatedAt = dayjs().format();
  }
}
