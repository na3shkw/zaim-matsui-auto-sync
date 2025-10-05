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
