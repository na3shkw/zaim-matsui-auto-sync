import { Command, Option } from "commander";
import { Zaim } from "../../modules/index.js";

export const categoryCommand = new Command("category").description("カテゴリに関するコマンド");

categoryCommand
  .command("list")
  .description("カテゴリ一覧を取得する")
  .addOption(
    new Option("--mode [value]", "カテゴリのタイプ（支出・収入）").choices(["payment", "income"])
  )
  .action(async (options) => {
    const zaim = new Zaim();
    const categories = await zaim.getCategory(options.mode);
    console.table(categories);
  });
