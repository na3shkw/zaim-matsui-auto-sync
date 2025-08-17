import { Command } from "commander";
import { accountCommand } from "./account.js";
import { authCommand } from "./auth.js";
import { categoryCommand } from "./category.js";
import { moneyCommand } from "./money.js";

const program = new Command();

program.name("zaim").description("Zaim APIのコマンドラインラッパー");

program.addCommand(accountCommand);
program.addCommand(authCommand);
program.addCommand(categoryCommand);
program.addCommand(moneyCommand);

program.parse();
