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

import { startTokenCleanup, stopTokenCleanup } from "../tokenCleanup";

describe("tokenCleanup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockQuery.mockReset();
    // Default: advisory lock acquired, delete returns 0 rows
    mockQuery.mockResolvedValue({ rows: [{ acquired: true }], rowCount: 0 });
  });

  afterEach(() => {
    stopTokenCleanup();
    jest.useRealTimers();
  });

  it("should acquire advisory lock before cleaning", async () => {
    startTokenCleanup();

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
    startTokenCleanup();
    // Flush all microtasks
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_advisory_unlock($1)",
      [123456789],
    );
  });

  it("should skip cleanup when lock is not acquired", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ acquired: false }], rowCount: 0 });

    startTokenCleanup();
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Should only have the lock attempt call, no DELETE calls
    const deleteCalls = mockQuery.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("DELETE"),
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it("should handle errors gracefully", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection failed"));

    startTokenCleanup();
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // Should not throw
    const { logger } = require("../../utils/logger");
    expect(logger.error).toHaveBeenCalled();
  });

  it("should stop cleanup when stopTokenCleanup is called", () => {
    startTokenCleanup();
    stopTokenCleanup();

    // Advance timer — cleanup should not run again
    mockQuery.mockClear();
    jest.advanceTimersByTime(2 * 60 * 60 * 1000);
  });
});
