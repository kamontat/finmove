export enum AccountType {
  Credit = "Credit",
  Debit = "Debit",
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owners: string[]; // owner IDs
}
