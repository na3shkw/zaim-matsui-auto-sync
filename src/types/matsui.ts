interface PositionItem {
  評価額: number | undefined;
  評価損益: number | undefined;
  /**
   * 損益率 (%)
   */
  損益率: number | undefined;
}

export interface PositionDetails {
  [key: string]: PositionItem;
}

export interface Position {
  details: PositionDetails;
  total: PositionItem;
}

/**
 * 米国株の評価額データ
 */
export interface UsStockAsset {
  /**
   * 株式評価損益合計（円）
   */
  totalProfit: number;
  /**
   * 評価損益率（%）
   */
  totalProfitRate: number;
  /**
   * 株式時価総額合計（円）
   */
  totalAmount: number;
  /**
   * 前日比合計（円）
   */
  dailyChange: number;
}
