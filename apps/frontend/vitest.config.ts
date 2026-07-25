import { defineConfig } from 'vitest/config';

// apiClient のロジック検証用の最小構成。
// React コンポーネントテストや E2E は対象外（node 環境で fetch / Amplify をモックする）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/utils/apiClient.ts'],
      reporter: ['text'],
    },
  },
});
