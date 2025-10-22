import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LastTotalAmount } from "../../types/sync.js";
import { TotalAmountRepository } from "./total-amount-repository.js";

vi.mock("fs");
vi.mock("../logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);

describe("TotalAmountRepository", () => {
  const mockFilePath = "/test/total-amounts.json";
  let repository: TotalAmountRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new TotalAmountRepository(mockFilePath);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("load", () => {
    it("ファイルが存在しない場合、空の配列を返す", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = repository.load();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).toHaveBeenCalledWith(mockFilePath);
    });

    it("正常なデータを読み込める", () => {
      const validData: LastTotalAmount[] = [
        {
          accountId: 12345,
          amount: 1000000,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
        {
          accountId: 11111,
          amount: 500000,
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validData));

      const result = repository.load();

      expect(result).toEqual(validData);
      expect(mockFs.existsSync).toHaveBeenCalledWith(mockFilePath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockFilePath, { encoding: "utf-8" });
    });

    it("空配列を読み込める", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("[]");

      const result = repository.load();

      expect(result).toEqual([]);
    });

    it("JSON形式が不正な場合、エラーを投げる", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("{ invalid json }");

      expect(() => repository.load()).toThrow();
    });

    it("ファイルの中身がnullの場合、エラーを投げる", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("null");

      expect(() => repository.load()).toThrow("総額記録ファイルの中身が空です。");
    });

    it("ファイルの中身がundefinedの場合、エラーを投げる", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("undefined");

      expect(() => repository.load()).toThrow();
    });

    it("ファイル読み込みエラーの場合、エラーを投げる", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => repository.load()).toThrow("Permission denied");
    });
  });

  describe("save", () => {
    it("データを正常に保存できる", () => {
      const data: LastTotalAmount[] = [
        {
          accountId: 12345,
          amount: 1000000,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];

      repository.save(data);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockFilePath,
        JSON.stringify(data, null, 2),
        { encoding: "utf-8" }
      );
    });

    it("空配列を保存できる", () => {
      const data: LastTotalAmount[] = [];

      repository.save(data);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockFilePath,
        JSON.stringify(data, null, 2),
        { encoding: "utf-8" }
      );
    });

    it("複数のデータを保存できる", () => {
      const data: LastTotalAmount[] = [
        {
          accountId: 12345,
          amount: 1000000,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
        {
          accountId: 11111,
          amount: 500000,
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
        {
          accountId: 33333,
          amount: 2000000,
          updatedAt: "2025-01-03T00:00:00.000Z",
        },
      ];

      repository.save(data);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockFilePath,
        JSON.stringify(data, null, 2),
        { encoding: "utf-8" }
      );
    });

    it("ファイル書き込みエラーの場合、エラーを投げる", () => {
      const data: LastTotalAmount[] = [
        {
          accountId: 12345,
          amount: 1000000,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];

      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("Disk full");
      });

      expect(() => repository.save(data)).toThrow("Disk full");
    });
  });
});
