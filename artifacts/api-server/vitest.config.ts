import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run the safety/enforcement API regression suite serially. Each test
    // creates and tears down its own users against the real database, so
    // running files one at a time keeps the data isolated and deterministic.
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    env: {
      // Force the plain (transport-less) pino logger so vitest does not spawn a
      // pino-pretty worker thread that would keep the process alive.
      NODE_ENV: "production",
      LOG_LEVEL: "silent",
    },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
