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
