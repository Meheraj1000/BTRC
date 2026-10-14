import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-jwt-secret-please-change";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-change";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
});
