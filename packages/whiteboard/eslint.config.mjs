import { createNextConfig } from "@workspace/eslint-config/next";

export default createNextConfig({ tsconfigRootDir: import.meta.dirname }).map((config) => ({
  ...config,
  rules: {
    ...config.rules,
    "@next/next/no-html-link-for-pages": "off"
  }
}));
