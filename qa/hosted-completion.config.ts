import {defineConfig} from '@playwright/test'
if(!process.env.SPENDSCAPE_HOSTED_QA_OUT)throw Error('fresh-output-required')
export default defineConfig({testDir:'.',testMatch:['spendscape-hosted-demo.spec.ts','spendscape-hosted-completion.spec.ts'],workers:1,timeout:60000,reporter:'line',outputDir:process.env.SPENDSCAPE_HOSTED_QA_OUT+'/results',use:{baseURL:'http://127.0.0.1:3206',browserName:'chromium',channel:'chrome',headless:true,trace:'off',screenshot:'off',video:'off'}})
