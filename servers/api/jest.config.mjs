import { createDefaultEsmPreset } from "ts-jest";

const esmPreset = createDefaultEsmPreset({
  tsconfig: "tsconfig.json"
});

export default {
  ...esmPreset,
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.jest.ts"],
  moduleNameMapper: {
    "^node:test$": "<rootDir>/tests/jest-node-compat.ts",
    "^node:assert/strict$": "<rootDir>/tests/jest-assert-compat.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  collectCoverageFrom: [
    "features/**/*.ts",
    "integrations/**/*.ts",
    "middleware/**/*.ts",
    "!**/tests/**",
    "!**/*.d.ts"
  ],
  coverageDirectory: "coverage/jest",
  coverageReporters: ["text", "lcov", "html"]
};
