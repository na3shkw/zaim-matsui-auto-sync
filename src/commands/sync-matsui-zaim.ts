import { Command } from "commander";
import { scrapeMatsui } from "../modules/index.js";

const program = new Command();

program
  .name("sync-matsui-zaim")
  .description("松井証券の資産情報をZaimに同期する")
  .action(async () => {
    const nisaData = await scrapeMatsui();
    console.log(nisaData);
  });

program.parse();
