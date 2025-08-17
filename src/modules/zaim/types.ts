import type { Dayjs } from "dayjs";

export interface Account {
  id: number;
  name: string;
  modified: "string";
  sort: number;
  active: number;
  local_id: number;
  website_id: number;
  parent_account_id: number;
}

export interface AccountListResponse {
  accounts: Account[];
  requested: number;
}

export type JournalType = "income" | "payment" | "transfer";

export interface JournalEntry {
  id: number;
  mode: JournalType;
  user_id: number;
  date: string;
  category_id: number;
  genre_id: number;
  to_account_id: number;
  from_account_id: number;
  amount: number;
  comment: string;
  active: number;
  name: string;
  receipt_id: number;
  place: string;
  created: string;
  currency_code: string;
}

export interface JournalEntryListResponse {
  money: JournalEntry[];
  requested: number;
}

export interface GetJournalEntryParam {
  mode?: JournalType;
  categoryId?: number;
  startDate?: Dayjs | undefined;
  endDate?: Dayjs | undefined;
  limit?: number;
  toAccountId?: number;
  page?: number;
  activeOnly?: boolean;
}

export interface RegisterIncomeJournalEntryParam {
  categoryId: number;
  /**
   * 小数点なしの金額
   */
  amount: number;
  /**
   * 過去3ヶ月以内の日付
   */
  date: Dayjs;
  /**
   * 入金先口座ID
   */
  toAccountId?: number;
  place?: string;
  comment?: string;
}

interface Place {
  id: number;
  user_id: number;
  category_id: number;
  account_id: number;
  transfer_account_id: number;
  mode: string;
  place_uid: string;
  service: string;
  name: string;
  original_name: string;
  tel: string;
  count: number;
  place_pattern_id: number;
  calc_flag: number;
  edit_flag: number;
  active: number;
  modified: string;
  created: string;
}

export interface RegisterIncomeJournalEntryResponse {
  stamps: null;
  banners: any[];
  money: {
    id: number;
    place_uid?: string;
    modified: string;
  };
  place?: Place;
  user: {
    input_count: number;
    repeat_count: number;
    day_count: number;
    data_modified: string;
  };
  requested: number;
}

export interface Category {
  id: number;
  name: string;
  mode: string;
  sort: number;
  parent_category_id: number;
  active: number;
  modified: string;
}

export interface CategoryListResponse {
  categories: Category[];
  requested: number;
}
