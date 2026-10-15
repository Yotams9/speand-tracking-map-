// The QA suites were written against the demo story in English. The app now
// starts in Hebrew with demo data hidden, so every suite opts in up front
// through the same per-device preferences a person would set.
export const demoEnglishStorage = {
  cookies: [],
  origins: [{
    origin: 'http://127.0.0.1:3000',
    localStorage: [
      { name: 'spendscape.demo-data.v1', value: 'on' },
      { name: 'spendscape.locale.v1', value: 'en' },
    ],
  }],
}
