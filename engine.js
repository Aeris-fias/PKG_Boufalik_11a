class MetadataEngine {
  constructor() {
    this.threadCount = Math.min(navigator.hardwareConcurrency || 4, 12);
    this.workers = [];
  }

  initPool() {
    if (this.workers.length > 0) return;

    const L = window.DataParsingLayer;
    const workerSource = [
      L.readSlice.toString(),
      L.getExtension.toString(),
      L.parseBMP.toString(),
      L.parsePNG.toString(),
      L.parseGIF.toString(),
      L.parsePCX.toString(),
      L.parseJPEG.toString(),
      L.parseTIFF.toString(),
      L.parseImageFile.toString(),
      "self.onmessage = async function(e) {",
      "  const files = e.data.files;",
      "  const batchStartIndex = e.data.batchStartIndex;",
      "  const results = new Array(files.length);",
      "  const concurrency = 32;",
      "  for (let i = 0; i < files.length; i += concurrency) {",
      "    const end = Math.min(i + concurrency, files.length);",
      "    const tasks = [];",
      "    for (let j = i; j < end; j++) {",
      "      const file = files[j];",
      "      const idx = batchStartIndex + j + 1;",
      "      tasks.push(",
      "        parseImageFile(file).then(function(parsed) {",
      "          parsed.index = idx;",
      "          results[j] = parsed;",
      "        }).catch(function(err) {",
      "          results[j] = {",
      "            index: idx,",
      "            fileName: file.name,",
      "            fileSize: file.size,",
      "            detectedFormat: 'UNKNOWN',",
      "            dimensions: '—',",
      "            pixels: 0,",
      "            dpi: '—',",
      "            bitDepth: '—',",
      "            bitDepthNum: 0,",
      "            compression: '—',",
      "            status: 'corrupted',",
      "            statusText: 'Ошибка чтения'",
      "          };",
      "        })",
      "      );",
      "    }",
      "    await Promise.all(tasks);",
      "  }",
      "  self.postMessage({ results: results });",
      "};"
    ].join("\n\n");

    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    for (let i = 0; i < this.threadCount; i++) {
      this.workers.push(new Worker(url));
    }
  }

  async processFiles(files, onProgress) {
    this.initPool();
    const total = files.length;
    const allResults = new Array(total);
    let processed = 0;
    const startTime = performance.now();

    const batchSize = 250;
    const batches = [];
    for (let i = 0; i < total; i += batchSize) {
      batches.push({
        files: files.slice(i, i + batchSize),
        batchStartIndex: i
      });
    }

    let batchCursor = 0;

    await new Promise((resolve) => {
      let activeWorkers = 0;

      const assignNextBatch = (worker) => {
        if (batchCursor >= batches.length) {
          activeWorkers--;
          if (activeWorkers === 0) resolve();
          return;
        }

        const batch = batches[batchCursor++];
        worker.onmessage = (e) => {
          const results = e.data.results;
          const baseIdx = batch.batchStartIndex;
          for (let i = 0; i < results.length; i++) {
            allResults[baseIdx + i] = results[i];
          }
          processed += results.length;

          const elapsedSec = (performance.now() - startTime) / 1000;
          const speed = elapsedSec > 0 ? Math.round(processed / elapsedSec) : processed;
          const pct = Math.min(100, Math.round((processed / total) * 100));

          onProgress({ processed, total, pct, speed, elapsedSec });
          assignNextBatch(worker);
        };

        worker.postMessage(batch);
      };

      for (let i = 0; i < this.workers.length; i++) {
        if (batchCursor < batches.length) {
          activeWorkers++;
          assignNextBatch(this.workers[i]);
        }
      }
    });

    return allResults;
  }
}

window.CoreEngineLayer = new MetadataEngine();