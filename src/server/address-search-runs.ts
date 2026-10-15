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
 'geoapify-college-m3-validation-20261013-one': Object.freeze({
  head:'7c4ec31c74d236297791d9edbf8322cda901de0b',
  build:'artifacts/college-m3-address-pin-_pl2vht4/app',
  freeze:'qa/address-search-m3/freeze.json',
  launcher:'qa/address-search-m3/',
 }),
})
export type AddressRun = keyof typeof addressRuns
export function addressRun(value:unknown):AddressRun|null {
 return typeof value==='string'&&Object.hasOwn(addressRuns,value)?value as AddressRun:null
}
