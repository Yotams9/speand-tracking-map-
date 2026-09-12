// No protocol adapter: Tesseract's public workerPath option points here.
// Silence third-party diagnostics at the worker boundary; no receipt data exits
// through console/error telemetry. Public API reports fixed codes in session.mjs.
for (const key of ['log','info','debug','warn','error','trace','table']) console[key] = () => {};
// Defense in depth in this isolated benchmark; persistent language caching is
// disabled through the public API as well. Never mount a persistent filesystem.
for (const key of ['open','deleteDatabase']) indexedDB[key] = () => { throw Error('storage-forbidden'); };
for (const key of ['open','match','delete','keys','has']) caches[key] = () => { throw Error('storage-forbidden'); };
importScripts('/vendor/worker.min.js');
