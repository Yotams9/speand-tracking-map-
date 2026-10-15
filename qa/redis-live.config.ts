import { defineConfig } from 'vitest/config'

// Deliberate administrative verification only. The ordinary test/build path
// never discovers this suite or inherits its private connection file.
export default defineConfig({
  test: { include: ['qa/redis-live.test.ts'], maxWorkers: 1, testTimeout: 30_000, fileParallelism: false, bail: 1 },
})
