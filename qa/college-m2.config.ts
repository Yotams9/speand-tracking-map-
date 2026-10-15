import {defineConfig} from '@playwright/test'
const out=process.env.SPENDSCAPE_M2_QA_OUT
if(!out)throw Error('fresh-milestone-output-required')
export default defineConfig({testDir:'.',testMatch:'spendscape-college-m2.spec.ts',workers:1,fullyParallel:false,timeout:120000,expect:{timeout:15000},reporter:'line',outputDir:`${out}/browser-results`,use:{baseURL:'http://127.0.0.1:3192',browserName:'chromium',channel:'chrome',headless:true,colorScheme:'dark',trace:'off',video:'off',screenshot:'off'}})
