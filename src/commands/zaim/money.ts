import { Command, Option } from "commander";
import dayjs from "dayjs";
import { Zaim } from "../../modules/index.js";

const zaim = new Zaim();

export const moneyCommand = new Command("money").description("入出金や振替の記録に関するコマンド");

moneyCommand
  .command("list")
  .description("入出金や振替の履歴を取得する")
  .addOption(
    new Option("--mode [value]", "履歴データのタイプ（出金・入金・振替）").choices([
      "payment",
      "income",
      "transfer",
    ])
  )
  .option("--category-id [value]", "カテゴリID")
  .option("--start-date [date]", "開始日")
  .option("--end-date [date]", "開始日")
  .option("--limit [value]", "1ページ当たりの表示件数")
  .option("--page [value]", "表示するページ", "1")
  .option("--to-account-id [value]", "入金先・振替先の口座ID（完全一致）")
  .action(async (options) => {
    const parseDate = (text: string) => dayjs(text, "YYYY-MM-DD");
    const startDate = options.startDate ? parseDate(options.startDate) : undefined;
    const endDate = options.endDate ? parseDate(options.endDate) : undefined;
    const journalEntries = await zaim.getJournalEntry({
      mode: options.mode,
      categoryId: options.categoryId,
      startDate,
      endDate,
      limit: options.limit,
      page: options.page,
      toAccountId: options.toAccountId,
    });
    console.table(journalEntries, [
      "id",
      "date",
      "mode",
      "category_id",
      "genre_id",
      "from_account_id",
      "to_account_id",
      "amount",
      "comment",
      "name",
    ]);
  });
