#!/usr/bin/env node
import { Command } from "commander";
import { accountCommand } from "./account.js";
import { authCommand } from "./auth.js";
import { categoryCommand } from "./category.js";
import { moneyCommand } from "./money.js";
import { webCommand } from "./web.js";

const program = new Command();

program.name("zaim").description("Zaim APIおよびZaimのウェブ画面のコマンドラインラッパー");

program.addCommand(accountCommand);
program.addCommand(authCommand);
program.addCommand(categoryCommand);
program.addCommand(moneyCommand);
program.addCommand(webCommand);

program.parse();
