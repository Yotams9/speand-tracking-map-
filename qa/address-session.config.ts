import {defineConfig} from '@playwright/test'
const output=process.env.SPENDSCAPE_ADDRESS_QA_OUT
if(!output)throw Error('fresh-address-output-required')
export default defineConfig({testDir:'.',testMatch:['spendscape-address-search.spec.ts','spendscape-address-session.spec.ts'],workers:1,timeout:60000,expect:{timeout:12000},reporter:'line',outputDir:output+'/results',use:{extraHTTPHeaders:{'x-spendscape-synthetic-qa':'1'},baseURL:'http://127.0.0.1:3197',browserName:'chromium',channel:'chrome',headless:true,colorScheme:'dark',trace:'off',video:'off',screenshot:'off'}})
