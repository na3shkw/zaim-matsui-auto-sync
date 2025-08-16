import { Command } from "commander";
import { accountCommand } from "./account.js";
import { authCommand } from "./auth.js";

const program = new Command();

program.name("zaim").description("Zaim APIのコマンドラインラッパー");

program.addCommand(accountCommand);
program.addCommand(authCommand);

program.parse();
