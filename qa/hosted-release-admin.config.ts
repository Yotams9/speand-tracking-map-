import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['qa/hosted-release-admin.test.ts'],maxWorkers:1,fileParallelism:false,bail:1,testTimeout:15000}})
