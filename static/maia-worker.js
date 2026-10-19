/**
 * Maia-3 (human-like chess move prediction) in a Web Worker, with ONNX Runtime.
 * Adapted from the Maia Chess platform (CSSLab, University of Toronto,
 * https://github.com/CSSLab/maia-platform-frontend, GPL-3.0). The model is
 * served in two parts (each under the host's file-size limit), joined here,
 * and kept in IndexedDB so it downloads only once.
 *
 * In:  { type: 'init' } | { type: 'download' } | { type: 'inference', id, tokens, eloSelf, eloOppo }
 * Out: { type: 'status', status } | { type: 'progress', progress } | { type: 'error', message, id? }
 *      | { type: 'result', id, logitsMove, logitsValue }
 */
importScripts('/ort/ort.wasm.min.js');
ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1;

const PARTS = ['/maia/maia3.part1', '/maia/maia3.part2'];
const VERSION = 'maia3-simplified-1';
const DB = 'knight24-maia';
const STORE = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cached() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(VERSION);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function store(buffer) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(buffer, VERSION);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {
    // Private browsing: the model works for this visit only.
  }
}

let session = null;

async function start(buffer) {
  session = await ort.InferenceSession.create(buffer);
  postMessage({ type: 'status', status: 'ready' });
}

/** `background`: fetched at low priority, so pages the player opens meanwhile come first. */
async function download(background) {
  postMessage({ type: 'status', status: 'downloading' });
  const chunks = [];
  let received = 0;
  let total = 0;
  const sizes = await Promise.all(PARTS.map((p) => fetch(p, { method: 'HEAD' }).then((r) => +(r.headers.get('Content-Length') || 0)).catch(() => 0)));
  total = sizes.reduce((a, b) => a + b, 0);
  for (const part of PARTS) {
    const res = await fetch(part, background ? { priority: 'low' } : undefined);
    if (!res.ok) throw new Error('The model could not be downloaded.');
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) postMessage({ type: 'progress', progress: Math.min(99, Math.floor((received / total) * 100)) });
    }
  }
  const buffer = new Uint8Array(received);
  let at = 0;
  for (const c of chunks) {
    buffer.set(c, at);
    at += c.length;
  }
  await store(buffer.buffer);
  postMessage({ type: 'progress', progress: 100 });
  await start(buffer.buffer);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const buffer = await cached();
      if (buffer) await start(buffer);
      else postMessage({ type: 'status', status: 'no-cache' });
    } else if (msg.type === 'download') {
      await download(!!msg.background);
    } else if (msg.type === 'inference') {
      if (!session) throw new Error('The model is not loaded.');
      const feeds = {
        tokens: new ort.Tensor('float32', new Float32Array(msg.tokens), [1, 64, 12]),
        elo_self: new ort.Tensor('float32', Float32Array.from([msg.eloSelf]), [1]),
        elo_oppo: new ort.Tensor('float32', Float32Array.from([msg.eloOppo]), [1]),
      };
      const out = await session.run(feeds);
      const logitsMove = new Float32Array(out.logits_move.data);
      const logitsValue = new Float32Array(out.logits_value.data);
      postMessage({ type: 'result', id: msg.id, logitsMove: logitsMove.buffer, logitsValue: logitsValue.buffer }, [logitsMove.buffer, logitsValue.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'error', id: msg.id, message: (err && err.message) || 'Maia failed' });
  }
};
