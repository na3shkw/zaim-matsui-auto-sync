import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentBrowser } from "./browser.js";

vi.mock("./logger.js");

const { launchPersistentContext } = vi.hoisted(() => ({ launchPersistentContext: vi.fn() }));
vi.mock("playwright", () => ({ chromium: { launchPersistentContext } }));

describe("PersistentBrowser.open", () => {
  beforeEach(() => {
    launchPersistentContext.mockReset();
    launchPersistentContext.mockImplementation(async () => ({
      pages: () => [{}],
      route: vi.fn(),
      storageState: vi.fn(),
      close: vi.fn(),
    }));
  });

  it("起動済みの場合は例外にし、ブラウザを新たに起動しない", async () => {
    const browser = new PersistentBrowser("/tmp/unused");
    await browser.open();

    await expect(browser.open()).rejects.toThrow("ブラウザは起動済みです");
    expect(launchPersistentContext).toHaveBeenCalledTimes(1);
  });

  it("close() した後は再度起動できる", async () => {
    const browser = new PersistentBrowser("/tmp/unused");
    await browser.open();
    await browser.close();

    await expect(browser.open()).resolves.toBeDefined();
    expect(launchPersistentContext).toHaveBeenCalledTimes(2);
  });
});

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
