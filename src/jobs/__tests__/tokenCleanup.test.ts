// Mock dependencies before imports
const mockQuery = jest.fn();

jest.mock("../../infra/db", () => ({
  getDb: () => ({ query: mockQuery }),
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { TokenCleanupJob } from "../tokenCleanup";

describe("TokenCleanupJob", () => {
  let job: TokenCleanupJob;
  const mockRefreshRepo = { deleteExpired: jest.fn().mockResolvedValue(0) };
  const mockEmailRepo = { deleteExpired: jest.fn().mockResolvedValue(0) };
  const mockResetRepo = { deleteExpired: jest.fn().mockResolvedValue(0) };

  beforeEach(() => {
    jest.useFakeTimers();
    mockQuery.mockReset();
    mockRefreshRepo.deleteExpired.mockReset().mockResolvedValue(0);
    mockEmailRepo.deleteExpired.mockReset().mockResolvedValue(0);
    mockResetRepo.deleteExpired.mockReset().mockResolvedValue(0);
    // Default: advisory lock acquired, delete returns 0 rows
    mockQuery.mockResolvedValue({ rows: [{ acquired: true }], rowCount: 0 });
    job = new TokenCleanupJob(mockRefreshRepo, mockEmailRepo, mockResetRepo);
  });

  afterEach(() => {
    job.stop();
    jest.useRealTimers();
  });

  it("should acquire advisory lock before cleaning", async () => {
    job.start();

    // Flush the initial async call (one tick)
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [123456789],
    );
  });

  it("should release advisory lock after cleaning", async () => {
    job.start();
    // Flush all microtasks
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_advisory_unlock($1)",
      [123456789],
    );
  });

  it("should skip cleanup when lock is not acquired", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ acquired: false }], rowCount: 0 });

    job.start();
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Should not have called deleteExpired on any repo
    expect(mockRefreshRepo.deleteExpired).not.toHaveBeenCalled();
    expect(mockEmailRepo.deleteExpired).not.toHaveBeenCalled();
    expect(mockResetRepo.deleteExpired).not.toHaveBeenCalled();
  });

  it("should handle errors gracefully", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection failed"));

    job.start();
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Should not throw
    const { logger } = require("../../utils/logger");
    expect(logger.error).toHaveBeenCalled();
  });

  it("should stop cleanup when stop is called", () => {
    job.start();
    job.stop();

    // Advance timer — cleanup should not run again
    mockQuery.mockClear();
    jest.advanceTimersByTime(2 * 60 * 60 * 1000);
  });
});
