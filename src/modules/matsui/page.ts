import { joinUrl } from "../utils.js";

/**
 * 松井証券の各ページのURL
 */
export class MatsuiPage {
  private static readonly MATSUI_WWW_BASE_URL = "https://www.matsui.co.jp";
  private static readonly MATSUI_FUND_BASE_URL = "https://fund.matsui.co.jp";
  private static readonly MATSUI_TRADE_BASE_URL = "https://trade.matsui.co.jp";
  private static readonly MATSUI_USSTOCK_BASE_URL = "https://usstock.matsui.co.jp";

  /**
   * 投資信託残高照会のURL
   */
  static get position(): string {
    return joinUrl(this.MATSUI_FUND_BASE_URL, "/ra/robo-advisor/page/main.html#!/position");
  }

  /**
   * お客様サイトメンテナンスページのURL
   */
  static get tradeMente(): string {
    return joinUrl(this.MATSUI_WWW_BASE_URL, "/nw/mente/trade_mainte.html");
  }

  /**
   * お客様サイトログインURL
   */
  static get tradeLogin(): string {
    return joinUrl(this.MATSUI_TRADE_BASE_URL, "/mgap/login");
  }

  /**
   * お客様サイトホームページURL
   */
  static get tradeMemberHome(): string {
    return joinUrl(this.MATSUI_TRADE_BASE_URL, "/mgap/member");
  }

  /**
   * 米国株取引トップページURL
   */
  static get usStockTradeTop(): string {
    return joinUrl(this.MATSUI_TRADE_BASE_URL, "/mgap/member#us-stock-trade-top");
  }

  /**
   * 米国株用サイトのホームページURL
   */
  static get usStockHome(): string {
    return joinUrl(this.MATSUI_USSTOCK_BASE_URL, "/web/#/equity/home");
  }

  /**
   * 米国株用サイトの保有資産ページURL
   */
  static get usStockPosition(): string {
    return joinUrl(this.MATSUI_USSTOCK_BASE_URL, "/web/#/equity/asset-info/position-view");
  }

  /**
   * 米国株用サイトの余力情報ページURL
   */
  static get usStockAssetPower(): string {
    return joinUrl(this.MATSUI_USSTOCK_BASE_URL, "/web/#/equity/asset-info/power");
  }

  /**
   * 米国株用サイトのお知らせページURL
   */
  static get usStockNotify(): string {
    return joinUrl(this.MATSUI_USSTOCK_BASE_URL, "/web/#/notify");
  }
}
