// Explicit approvals only; neither request input nor arbitrary env paths choose a run.
export const addressRuns = Object.freeze({
 'geoapify-address-validation-20261011-one': Object.freeze({
  head:'cbf62a12acbd8be2e649a44d17064acaf82d6482',
  build:'artifacts/geoapify-live-8jiueeim/app',
  freeze:'qa/address-search-native/freeze.json',
  launcher:'qa/address-search-native/',
 }),
 'geoapify-corrected-address-validation-20261011-one': Object.freeze({
  head:'b7ce7f8615c2162eec4817729aac31595c90afda',
  build:'artifacts/geoapify-corrected-20261011/app',
  freeze:'qa/address-search-corrected/freeze.json',
  launcher:'qa/address-search-corrected/',
 }),
})
export type AddressRun = keyof typeof addressRuns
export function addressRun(value:unknown):AddressRun|null {
 return typeof value==='string'&&Object.hasOwn(addressRuns,value)?value as AddressRun:null
}
