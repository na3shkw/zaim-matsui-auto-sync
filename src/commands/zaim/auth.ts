import { Command } from "commander";
import { Zaim } from "../../modules/index.js";

export const authCommand = new Command("auth").description("認証に関するコマンド");

authCommand
  .command("setup-token")
  .description("認証を行ってアクセストークンを生成する")
  .action(async () => {
    new Zaim(true);
  });
