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
