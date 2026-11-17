import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentBrowser } from "./browser.js";

vi.mock("./logger.js");

describe("PersistentBrowser.clearSession", () => {
  let userDataDir: string;
  let stateFilePath: string;

  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "matsui-storage-state-"));
    stateFilePath = path.join(userDataDir, "storage-state.json");
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it("storage-state.json が存在する場合、削除する", async () => {
    fs.writeFileSync(stateFilePath, "{}");

    await new PersistentBrowser(userDataDir).clearSession();

    expect(fs.existsSync(stateFilePath)).toBe(false);
  });

  it("storage-state.json が存在しない場合、エラーにならず何もしない", async () => {
    await expect(new PersistentBrowser(userDataDir).clearSession()).resolves.toBeUndefined();
    expect(fs.existsSync(stateFilePath)).toBe(false);
  });
});
