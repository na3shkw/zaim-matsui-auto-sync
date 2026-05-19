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

/**
 * 米国株の余力データ（米国株口座の使用可能現金を円換算した合計）
 */
export interface UsStockPowerAsset {
  /**
   * 米国株口座の使用可能現金合計（円換算）
   * = 使用可能現金(円) + 使用可能現金(ドル) × 米ドル/円レート（四捨五入）
   */
  totalBuyingPower: number;
}
