import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs");

const mockFs = vi.mocked(fs);

describe("loadConfig", () => {
  const mockConfigPath = "/test/config.json";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.CONFIG_FILE = mockConfigPath;
  });

  afterEach(() => {
    delete process.env.CONFIG_FILE;
  });

  it("CONFIG_FILE環境変数が設定されていない場合、エラーを投げる", async () => {
    delete process.env.CONFIG_FILE;

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow("環境変数 CONFIG_FILE が設定されていません。");
  });

  it("設定ファイルが存在しない場合、エラーを投げる", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow(`設定ファイルが存在しません: ${mockConfigPath}`);
  });

  it("正常な設定ファイルを読み込める", async () => {
    const validConfig = {
      accounts: [
        {
          name: "testAccount",
          enabled: true,
          matsui: {
            type: "fund",
            accountName: "testAccount",
          },
          zaim: {
            accountId: 12345,
            categoryId: 67890,
          },
        },
      ],
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

    const { loadConfig } = await import("./config.js");
    const result = loadConfig();

    expect(result).toEqual(validConfig);
    expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigPath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(mockConfigPath, "utf8");
  });

  it("JSON形式が不正な場合、適切なエラーを投げる", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{ invalid json }");

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow(`設定ファイルのJSON形式が不正です`);
  });

  it("Zodバリデーションエラーの場合、適切なエラーを投げる", async () => {
    const invalidConfig = {
      accounts: [
        {
          // name が不足
          enabled: true,
          matsui: {
            type: "fund",
            accountName: "testAccount",
          },
          zaim: {
            accountId: 12345,
            categoryId: 67890,
          },
        },
      ],
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow(`設定ファイルの形式が正しくありません`);
  });

  it("ファイル読み込みエラーの場合、適切なエラーを投げる", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow(`設定ファイルの読み込みに失敗しました`);
  });

  it("重複するzaim.accountIdの場合、エラーを投げる", async () => {
    const duplicateAccountIdConfig = {
      accounts: [
        {
          name: "fundAccount1",
          enabled: true,
          matsui: {
            type: "fund",
            accountName: "fundAccount1",
          },
          zaim: {
            accountId: 12345,
            categoryId: 11111,
          },
        },
        {
          name: "fundAccount2",
          enabled: true,
          matsui: {
            type: "fund",
            accountName: "fundAccount2",
          },
          zaim: {
            accountId: 12345,
            categoryId: 22222,
          },
        },
      ],
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(duplicateAccountIdConfig));

    const { loadConfig } = await import("./config.js");
    expect(() => loadConfig()).toThrow("Duplicate zaim.accountId values are not allowed");
  });

  it("複数アカウントの設定を正しく読み込める", async () => {
    const multiAccountConfig = {
      accounts: [
        {
          name: "fundAccount",
          enabled: true,
          matsui: {
            type: "fund",
            accountName: "fundAccount",
          },
          zaim: {
            accountId: 11111,
            categoryId: 22222,
          },
        },
        {
          name: "anotherFundAccount",
          enabled: false,
          matsui: {
            type: "fund",
            accountName: "anotherFundAccount",
          },
          zaim: {
            accountId: 33333,
            categoryId: 44444,
          },
        },
      ],
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(multiAccountConfig));

    const { loadConfig } = await import("./config.js");
    const result = loadConfig();

    expect(result).toEqual(multiAccountConfig);
    expect(result.accounts).toHaveLength(2);
  });
});
