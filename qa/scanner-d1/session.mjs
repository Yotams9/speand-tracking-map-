// QA-only public-API experiment. Never imported by the application.
export function createOcrSession({ loadApi, publish, clock = () => performance.now(), initMs = 20_000, ocrMs = 15_000, totalMs = 30_000 }) {
  let current = null, disposed = false, generation = 0;
  const emit = (run, code) => { if (current === run && !run.cancelled && !disposed) publish(code); };
  function releaseInput(run) { if (run.image) run.image.fill(0); run.image = null; }
  function finish(run, code, result = null) {
    if (run.settled) return;
    run.settled = true; clearTimeout(run.timer); clearTimeout(run.totalTimer);
    run.resolve({ code, result, timings: { ...run.timings, elapsedMs: clock() - run.started } });
  }
  async function terminate(run) {
    if (run.worker) { const worker = run.worker; run.worker = null; await worker.terminate(); }
  }
  function cancel(code = 'cancelled') {
    const run = current;
    if (!run) return;
    run.cancelled = true; generation++; releaseInput(run);
    run.abort?.();
    // Public API exposes no handle while createWorker is pending. Keep the slot
    // occupied until it settles; a timeout must not create overlapping workers.
    void terminate(run);
    finish(run, code);
  }
  function start(image, languages, paths) {
    if (disposed || current) { image.fill(0); return Promise.resolve({ code: disposed ? 'disposed' : 'busy', result: null }); }
    const run = { image, worker: null, cancelled: false, settled: false, started: clock(), generation: ++generation, timings: {}, timer: null, totalTimer: null, resolve: null };
    current = run;
    const completion = new Promise(resolve => { run.resolve = resolve; });
    const cancelled = new Promise((_, reject) => { run.abort = () => reject(Error('cancelled')); });
    // Initialization deliberately awaits the eventual public handle for cleanup.
    // Observe the rejection even when cancellation happens before recognition.
    void cancelled.catch(() => {});
    const live = () => !disposed && !run.cancelled && current === run && generation === run.generation;
    const timeout = code => { if (live()) { emit(run, code); cancel(code); } };
    run.timer = setTimeout(() => timeout('init-timeout'), initMs);
    run.totalTimer = setTimeout(() => timeout('total-timeout'), totalMs);
    void (async () => {
      try {
        emit(run, 'loading-api');
        const api = await loadApi();
        if (!live()) return;
        emit(run, 'initializing');
        const initStart = clock();
        run.worker = await api.createWorker(languages, 1, {
          ...paths, workerBlobURL: false, cacheMethod: 'none', gzip: false,
          legacyCore: false, legacyLang: false, logging: false,
          logger: event => {
            const states = { 'loading tesseract core': 'loading-core', 'loading language traineddata': 'loading-language', 'recognizing text': 'recognizing' };
            if (states[event.status]) emit(run, states[event.status]);
          },
          errorHandler: () => { if (live()) { emit(run, 'engine-error'); cancel('engine-error'); } },
        }, { debug_file: '/dev/null' });
        run.timings.initMs = clock() - initStart;
        if (!live()) return;
        clearTimeout(run.timer);
        run.timer = setTimeout(() => timeout('ocr-timeout'), ocrMs);
        emit(run, 'recognizing');
        const recognizeStart = clock();
        const result = await Promise.race([run.worker.recognize(run.image, { tessedit_pageseg_mode: '6' }, { text: true }), cancelled]);
        run.timings.ocrMs = clock() - recognizeStart;
        if (!live()) return;
        const text = result.data.text;
        await terminate(run);
        if (!live()) return;
        emit(run, text.trim() ? 'success' : 'no-text');
        finish(run, text.trim() ? 'success' : 'no-text', text);
      } catch { if (live()) { emit(run, 'engine-error'); finish(run, 'engine-error'); } }
      finally {
        releaseInput(run); await terminate(run);
        if (current === run) current = null;
        if (!run.settled) finish(run, 'cancelled');
      }
    })();
    return completion;
  }
  return { start, cancel, dispose() { disposed = true; cancel(); }, status: () => ({ occupied: current !== null, pendingHandle: !!current && !current.worker, disposed }) };
}
