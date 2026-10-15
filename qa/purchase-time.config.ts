import {defineConfig} from '@playwright/test'
const out=process.env.SPENDSCAPE_TIME_QA_OUT
if(!out)throw Error('isolated-output-required')
export default defineConfig({testDir:'.',testMatch:'spendscape-purchase-time.spec.ts',workers:1,timeout:60000,expect:{timeout:12000},reporter:'line',outputDir:out+'/results',use:{baseURL:'http://127.0.0.1:3196',browserName:'chromium',channel:'chrome',headless:true,colorScheme:'dark',trace:'off',video:'off',screenshot:'off'}})
