import path from "node:path";
import { defineConfig } from "vitest/config";

// aliasul „@/…” din tsconfig, ca testele să importe modulele exact ca aplicația
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});
