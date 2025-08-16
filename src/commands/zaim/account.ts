import { Command } from "commander";
import { Zaim } from "../../modules/index.js";

const zaim = new Zaim();

export const accountCommand = new Command("account").description("口座に関するコマンド");

accountCommand
  .command("list")
  .description("口座一覧を取得する")
  .option("--name [value]", "口座名（部分一致で検索）")
  .option("--active-only", "有効な口座だけ表示", true)
  .action(async (options) => {
    const accounts = await zaim.getAccount(options.name, options.activeOnly);
    console.table(accounts, ["id", "name", "sort", "website_id"]);
  });
