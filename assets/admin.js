/* ============================================================
   L-TEX Admin — Photo Manager (clean rewrite)
   ============================================================
   Talks to GitHub Contents API:
     - uploadOne(product, file)   → adds 1 photo + its thumb + patches images.js
     - deletePhoto(product, name) → removes 1 photo + its thumb + patches images.js
   Token lives in this browser's localStorage only.

   Design goals:
     - One file per call. Sequencing is the caller's job. Easier to show progress.
     - Every API call logs to console.
     - Every error bubbles up with HTTP status attached.
     - UTF-8 safe base64 via TextEncoder/TextDecoder.
     - SHA conflicts (409/422) retried with cache-buster + small backoff.
============================================================ */
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;

  /* ---------- Config ---------- */
  const REPO_OWNER     = 'ltexlutskai-tech';
  const REPO_NAME      = 'catalog-full';
  const BRANCH         = 'main';
  const IMAGES_DIR     = window.IMAGES_DIR || '2025-2026-named-top5';
  const IMAGES_JS_PATH = 'data/images.js';
  const TOKEN_KEY      = 'ltex-admin-token';
  const API_BASE       = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const MAX_BYTES      = 30 * 1024 * 1024;

  const A = L.Admin = {};

  /* ---------- Token ---------- */
  A.getToken   = () => { try { return localStorage.getItem(TOKEN_KEY) || null; } catch(e){ return null; } };
  A.setToken   = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch(e){} };
  A.clearToken = ()  => { try { localStorage.removeItem(TOKEN_KEY); } catch(e){} };

  /* ---------- GitHub API wrapper ---------- */
  async function gh(path, opts = {}){
    const tok = A.getToken();
    if(!tok) throw new Error('Не вказано GitHub-токен');
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

    let res;
    try {
      res = await fetch(url, {
        ...opts,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${tok}`,
          ...(opts.headers || {}),
        },
      });
    } catch(netErr){
      console.error('[gh] network error', url, netErr);
      throw new Error(`Мережева помилка: ${netErr.message}`);
    }

    const text = await res.text();
    if(!res.ok){
      let detail = '';
      try { const j = JSON.parse(text); if(j.message) detail = j.message; }
      catch(e){ detail = text.slice(0, 200); }
      const msg = `GitHub API ${res.status}: ${detail || res.statusText}`;
      console.error('[gh]', opts.method || 'GET', url, msg);
      const err = new Error(msg);
      err.status = res.status;
      err.detail = detail;
      throw err;
    }
    try { return text ? JSON.parse(text) : null; }
    catch(e){ return null; }
  }

  /* ---------- Token verification ---------- */
  A.checkToken = async () => {
    try {
      const u = await gh('https://api.github.com/user');
      await gh('');  // verify repo access
      return { ok: true, login: u.login };
    } catch(e){
      return { ok: false, error: e.message };
    }
  };

  /* ---------- UTF-8 ↔ base64 ---------- */
  function bytesToB64(bytes){
    let bin = '';
    const CHUNK = 0x8000;
    for(let i = 0; i < bytes.length; i += CHUNK){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function strToB64(str){
    return bytesToB64(new TextEncoder().encode(str));
  }
  function b64ToStr(b64){
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  async function fileToB64(file){
    const buf = await file.arrayBuffer();
    return bytesToB64(new Uint8Array(buf));
  }
  async function blobToB64(blob){
    const buf = await blob.arrayBuffer();
    return bytesToB64(new Uint8Array(buf));
  }

  /* ---------- Canvas thumbnail ---------- */
  async function makeThumbBlob(file, maxWidth = 800, quality = 0.82){
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Не вдалося відкрити фото для мініатюри'));
        i.src = url;
      });
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return await new Promise((res, rej) => {
        cv.toBlob(b => b ? res(b) : rej(new Error('Canvas encode failed')), 'image/jpeg', quality);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Canvas rotation (keeps original mime where possible) ---------- */
  function mimeFromName(name){
    const ext = (String(name).split('.').pop() || '').toLowerCase();
    if(ext === 'png')  return 'image/png';
    if(ext === 'webp') return 'image/webp';
    if(ext === 'gif')  return 'image/jpeg';   /* canvas can't encode GIF — fall back */
    return 'image/jpeg';
  }
  async function rotateImageBlob(blob, degrees, mime){
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload  = () => res(i);
        i.onerror = () => rej(new Error('Не вдалося прочитати фото для повороту'));
        i.src = url;
      });
      const deg = ((degrees % 360) + 360) % 360;
      const radians = (deg * Math.PI) / 180;
      const swap = (deg === 90 || deg === 270);
      const cv = document.createElement('canvas');
      cv.width  = swap ? img.naturalHeight : img.naturalWidth;
      cv.height = swap ? img.naturalWidth  : img.naturalHeight;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(radians);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const quality = mime === 'image/png' ? undefined : 0.92;
      return await new Promise((res, rej) => {
        cv.toBlob(b => b ? res(b) : rej(new Error('Canvas encode failed')), mime, quality);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Filename helpers ---------- */
  function sanitiseName(s){
    return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  }
  function buildFilename(product, existingNames, ext){
    const id = String(product.id).padStart(4, '0');
    const stem = `(${id}) ${sanitiseName(product.name)}`.slice(0, 120);
    const taken = new Set(existingNames);
    if(!taken.has(`${stem}.${ext}`)) return `${stem}.${ext}`;
    let n = 2;
    while(taken.has(`${stem}_${n}.${ext}`)) n++;
    return `${stem}_${n}.${ext}`;
  }
  function thumbName(fname){
    return fname.replace(/\.[^./]+$/, '') + '.jpg';
  }
  function encodePath(path){
    return path.split('/').map(encodeURIComponent).join('/');
  }

  /* ---------- Low-level file ops ---------- */
  async function getFileSha(path){
    try {
      const meta = await gh(`/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
      return (meta && meta.sha) || null;
    } catch(e){
      if(e.status === 404) return null;
      throw e;
    }
  }
  async function putFile(path, contentB64, message, sha){
    const body = { message, content: contentB64, branch: BRANCH };
    if(sha) body.sha = sha;
    return gh(`/contents/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }
  async function deleteFileApi(path, message){
    const sha = await getFileSha(path);
    if(!sha) return null;
    return gh(`/contents/${encodePath(path)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
  }

  /* ---------- Retry-on-409/422 wrappers ---------- */
  async function putWithRetry(path, contentB64, message){
    let lastErr;
    for(let i = 0; i < 4; i++){
      try {
        const sha = await getFileSha(path);
        return await putFile(path, contentB64, message, sha);
      } catch(e){
        lastErr = e;
        if(e.status !== 409 && e.status !== 422) throw e;
        console.warn(`[putWithRetry] conflict on ${path}, retry ${i + 1}/4`);
        await new Promise(r => setTimeout(r, 350 * (i + 1)));
      }
    }
    throw lastErr;
  }

  /* ---------- Patch data/images.js ---------- */
  function findObjectLiteral(text, prefix){
    /* Locate prefix (e.g. 'window.IMAGES_BY_ID'), then balance braces. */
    const i = text.indexOf(prefix);
    if(i === -1) return null;
    const open = text.indexOf('{', i);
    if(open === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for(let k = open; k < text.length; k++){
      const ch = text[k];
      if(esc){ esc = false; continue; }
      if(ch === '\\'){ esc = true; continue; }
      if(ch === '"'){ inStr = !inStr; continue; }
      if(inStr) continue;
      if(ch === '{') depth++;
      else if(ch === '}'){ depth--; if(depth === 0) return { start: open, end: k }; }
    }
    return null;
  }

  async function patchImagesJs(transform, commitMessage){
    let lastErr;
    for(let attempt = 0; attempt < 5; attempt++){
      try {
        const meta = await gh(`/contents/${IMAGES_JS_PATH}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
        const text = b64ToStr(meta.content);
        const loc = findObjectLiteral(text, 'IMAGES_BY_ID');
        if(!loc) throw new Error('Не знайдено IMAGES_BY_ID у data/images.js');
        const json = text.slice(loc.start, loc.end + 1);
        let data;
        try { data = JSON.parse(json); }
        catch(e){ throw new Error('JSON-помилка в images.js: ' + e.message); }
        transform(data);
        const newJs = '// auto-generated — managed by admin / generate_assets.py\nwindow.IMAGES_BY_ID = ' + JSON.stringify(data) + ';\n';
        return await gh(`/contents/${IMAGES_JS_PATH}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage,
            content: strToB64(newJs),
            branch: BRANCH,
            sha: meta.sha,
          }),
        });
      } catch(e){
        lastErr = e;
        if(e.status !== 409 && e.status !== 422){
          /* Not a conflict — bail out immediately */
          throw e;
        }
        console.warn(`[patchImagesJs] conflict, retry ${attempt + 1}/5`);
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  /* ---------- Preview URL ----------
     Default: jsdelivr CDN (fast, free, but caches @main files ~12h and
     ignores ?v= cache-busters). After a local rotation we hold the
     freshly-encoded Blob in `_localPreviews` and return its blob: URL
     instead, so the admin shows the new orientation immediately
     regardless of CDN state.

     `_recentRotations` survives page reload via localStorage so we can
     rehydrate blob previews from the repo on next boot — otherwise CDN
     would still serve the stale pre-rotation copy and the user would
     see their work "revert" after a refresh. */
  A._localPreviews = new Map();  /* filename → blobURL (in-memory) */

  const ROT_STORE_KEY = 'ltex-admin-recent-rotations';
  function loadRecentRotations(){
    try { return JSON.parse(localStorage.getItem(ROT_STORE_KEY) || '{}') || {}; }
    catch(e){ return {}; }
  }
  function saveRecentRotation(filename){
    try {
      const m = loadRecentRotations();
      m[filename] = Date.now();
      /* Cap to most recent 200 entries to stay well within localStorage quota */
      const entries = Object.entries(m).sort((a,b) => b[1] - a[1]).slice(0, 200);
      const trimmed = Object.fromEntries(entries);
      localStorage.setItem(ROT_STORE_KEY, JSON.stringify(trimmed));
    } catch(e){ /* quota / private mode — ignore */ }
  }

  A.imageRawUrl = (filename) => {
    const local = A._localPreviews.get(filename);
    if(local) return local;
    const safe = encodePath(filename);
    return `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${IMAGES_DIR}/${safe}`;
  };
  function setLocalPreview(filename, blob){
    const prev = A._localPreviews.get(filename);
    if(prev) { try { URL.revokeObjectURL(prev); } catch(e){} }
    A._localPreviews.set(filename, URL.createObjectURL(blob));
  }

  /* Rehydrate `_localPreviews` after a page reload by re-fetching the
     bytes of recently-rotated files straight from the repo (Contents/
     Blob API — no CDN). Background: caller can dispatch an event when
     each preview is ready so the UI can refresh affected <img>s. */
  A.rehydrateRecentRotations = async (opts = {}) => {
    const maxAgeMs = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;  /* 24h */
    const m = loadRecentRotations();
    const now = Date.now();
    const due = Object.entries(m).filter(([_, ts]) => (now - ts) < maxAgeMs);
    if(!due.length) return { rehydrated: 0 };
    if(!A.getToken()) return { rehydrated: 0 };
    let count = 0;
    /* Sequential to avoid hammering the API; admin gallery only renders
       what the user is currently looking at, so this stays in the
       background of the UI thread. */
    for(const [filename] of due){
      try {
        const { blob } = await fetchImageBlob(`${IMAGES_DIR}/${filename}`, null);
        setLocalPreview(filename, blob);
        count++;
        window.dispatchEvent(new CustomEvent('ltex:admin-preview-ready', { detail: { filename }}));
      } catch(e){
        console.warn('[rehydrate]', filename, e.message);
      }
    }
    console.log('[rehydrateRecentRotations] refreshed', count, 'previews');
    return { rehydrated: count };
  };
  /* Ask jsdelivr to drop its CDN copy so the live site picks up the new
     bytes in ~1 min instead of waiting 12h for the cache to expire. */
  async function purgeJsdelivr(filename){
    try {
      const safe = encodePath(filename);
      const url = `https://purge.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${IMAGES_DIR}/${safe}`;
      const resp = await fetch(url, { method: 'GET' });
      console.log('[purgeJsdelivr]', filename, resp.status);
    } catch(e){
      console.warn('[purgeJsdelivr] failed:', e.message);
    }
  }

  /* ---------- Public: list current filenames for a product ---------- */
  A.listPhotos = (product) => {
    const padded  = String(product.id).padStart(4, '0');
    const trimmed = String(product.id).replace(/^0+/, '') || padded;
    const m = window.IMAGES_BY_ID || {};
    return [...new Set([...(m[padded] || []), ...(m[trimmed] || [])])];
  };

  /* ---------- Public: refresh in-memory IMAGES_BY_ID from the live repo ----------
     The data/images.js shipped with the HTML page is heavily cached (GH Pages
     CDN + browser). Pull the canonical file straight from the Contents API
     after every successful operation (and on page load), so the admin always
     sees what's really committed — no stale local view. */
  A.reloadImagesIndex = async () => {
    try {
      const meta = await gh(`/contents/${IMAGES_JS_PATH}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
      const text = b64ToStr(meta.content);
      const loc = findObjectLiteral(text, 'IMAGES_BY_ID');
      if(!loc) throw new Error('IMAGES_BY_ID не знайдено');
      const data = JSON.parse(text.slice(loc.start, loc.end + 1));
      window.IMAGES_BY_ID = data;
      console.log('[reloadImagesIndex]', Object.keys(data).length, 'keys loaded from repo');
      return data;
    } catch(e){
      console.warn('[reloadImagesIndex] failed:', e.message);
      throw e;
    }
  };

  /* ---------- Public: upload ONE photo ----------
     Steps:
       1) read file → base64
       2) (optional) generate 800px JPEG thumbnail → base64
       3) PUT original to <IMAGES_DIR>/<fname>
       4) PUT thumb to <IMAGES_DIR>/thumbs/<thumbname>  (best-effort)
       5) PATCH data/images.js to include the new fname
       6) update window.IMAGES_BY_ID locally so the UI reflects it
     Returns: { filename, hadThumb }
  ----------------------------------------------- */
  A.uploadOne = async (product, file, onProgress) => {
    if(!A.getToken())   throw new Error('Не вказано GitHub-токен');
    if(!product || !product.id) throw new Error('Не вибрано товар');
    if(!file)           throw new Error('Не вибрано файл');
    if(file.size > MAX_BYTES) throw new Error(`${file.name}: ${(file.size/1024/1024).toFixed(1)} MB > 30 MB`);

    onProgress && onProgress({ stage: 'preparing' });

    /* Always base the new filename on the live committed state, not the
       maybe-stale cached data/images.js — avoids the case where two recent
       uploads ended up with the same name because the page didn't see them. */
    try { await A.reloadImagesIndex(); } catch(e){ /* network glitch — fall back to local state */ }

    const existing = A.listPhotos(product);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fname = buildFilename(product, existing, ext);
    console.log('[uploadOne]', product.id, '→', fname);

    /* Encode original */
    onProgress && onProgress({ stage: 'encoding', target: fname });
    const origB64 = await fileToB64(file);

    /* Generate thumbnail (best-effort) */
    let thumbB64 = null;
    try {
      const thumbBlob = await makeThumbBlob(file);
      thumbB64 = await blobToB64(thumbBlob);
    } catch(e){
      console.warn('[uploadOne] thumb generation failed:', e.message);
    }

    /* PUT original */
    onProgress && onProgress({ stage: 'uploading-original', target: fname });
    await putWithRetry(`${IMAGES_DIR}/${fname}`, origB64, `Add photo: ${fname}`);

    /* PUT thumb (best-effort) */
    let hadThumb = false;
    if(thumbB64){
      onProgress && onProgress({ stage: 'uploading-thumb', target: fname });
      try {
        await putWithRetry(`${IMAGES_DIR}/thumbs/${thumbName(fname)}`, thumbB64, `Add thumb: ${thumbName(fname)}`);
        hadThumb = true;
      } catch(e){
        console.warn('[uploadOne] thumb upload failed:', e.message);
        /* Original is in — catalog will fall back via onerror */
      }
    }

    /* Patch images.js */
    onProgress && onProgress({ stage: 'updating-index', target: fname });
    await patchImagesJs(data => {
      const padded  = String(product.id).padStart(4, '0');
      const trimmed = String(product.id).replace(/^0+/, '') || padded;
      for(const k of [padded, trimmed]){
        const list = data[k] || [];
        if(!list.includes(fname)) list.push(fname);
        data[k] = list;
      }
    }, `Add photo for product ${String(product.id).padStart(4,'0')}`);

    /* Mirror in-page state */
    const map = window.IMAGES_BY_ID || (window.IMAGES_BY_ID = {});
    const padded  = String(product.id).padStart(4, '0');
    const trimmed = String(product.id).replace(/^0+/, '') || padded;
    for(const k of [padded, trimmed]){
      if(!Array.isArray(map[k])) map[k] = [];
      if(!map[k].includes(fname)) map[k].push(fname);
    }

    onProgress && onProgress({ stage: 'done', filename: fname, hadThumb });
    return { filename: fname, hadThumb };
  };

  /* ---------- Fetch existing image bytes from the repo ----------
     If we have a locally-rotated blob for this file (from an earlier
     click), USE THAT as the source for the next rotation. Otherwise the
     Contents API can return a still-cached pre-rotation version even
     after our previous PUT succeeded, which makes consecutive 90° clicks
     appear to do nothing (each click rotated the same original, not the
     previously-rotated bytes — 5 × 90° looks like one 90° to the eye).

     Contents API inlines files <= 1 MB as base64; larger files come back
     with empty `content` plus a sha — fetch those via the Git Blob API
     which has no size cap (and stays authenticated). */
  async function fetchImageBlob(path, filename){
    if(filename){
      const localUrl = A._localPreviews.get(filename);
      if(localUrl){
        try {
          const resp = await fetch(localUrl);
          if(resp.ok){
            const blob = await resp.blob();
            console.log('[fetchImageBlob] using local preview for', filename);
            return { blob, sha: null };
          }
        } catch(e){ /* fall through to network */ }
      }
    }
    const meta = await gh(`/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
    const mime = mimeFromName(path);
    const b64ToBytes = (b64) => {
      const bin = atob(String(b64).replace(/\s/g, ''));
      const bytes = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    };
    if(meta.content && meta.content.length > 0){
      return { blob: new Blob([b64ToBytes(meta.content)], { type: mime }), sha: meta.sha };
    }
    if(meta.sha){
      const blobMeta = await gh(`/git/blobs/${meta.sha}`);
      if(blobMeta && blobMeta.content){
        return { blob: new Blob([b64ToBytes(blobMeta.content)], { type: mime }), sha: meta.sha };
      }
    }
    throw new Error('Не вдалося завантажити фото для повороту');
  }

  /* ---------- Public: rotate ONE photo ----------
     Steps:
       1) GET current bytes from repo
       2) decode → canvas-rotate by N° → re-encode in original mime
       3) PUT rotated bytes back to the same path (same filename ⇒ images.js
          stays untouched, no DB patch needed)
       4) regenerate the 800px thumbnail and PUT it (best-effort)
     `degrees` is normalised, 90/180/270 supported (90 = clockwise).
  ----------------------------------------------- */
  A.rotatePhoto = async (product, filename, degrees, onProgress) => {
    if(!A.getToken())           throw new Error('Не вказано GitHub-токен');
    if(!product || !product.id) throw new Error('Не вибрано товар');
    if(!filename)               throw new Error('Не вказано файл');
    const deg = ((parseInt(degrees, 10) % 360) + 360) % 360;
    if(deg === 0) return { filename, rotated: 0 };

    console.log('[rotatePhoto]', product.id, '↻', filename, deg + '°');

    onProgress && onProgress({ stage: 'fetching', target: filename });
    const path = `${IMAGES_DIR}/${filename}`;
    const { blob: origBlob } = await fetchImageBlob(path, filename);

    onProgress && onProgress({ stage: 'rotating', target: filename });
    const mime = mimeFromName(filename);
    const rotatedBlob = await rotateImageBlob(origBlob, deg, mime);
    const rotatedB64  = await blobToB64(rotatedBlob);

    onProgress && onProgress({ stage: 'uploading-original', target: filename });
    await putWithRetry(path, rotatedB64, `Rotate photo ${deg}°: ${filename}`);

    /* Regenerate thumbnail from the rotated bytes (best-effort) */
    let hadThumb = false;
    try {
      const thumbBlob = await makeThumbBlob(rotatedBlob);
      const thumbB64  = await blobToB64(thumbBlob);
      onProgress && onProgress({ stage: 'uploading-thumb', target: filename });
      await putWithRetry(`${IMAGES_DIR}/thumbs/${thumbName(filename)}`, thumbB64, `Regenerate thumb: ${thumbName(filename)}`);
      hadThumb = true;
    } catch(e){
      console.warn('[rotatePhoto] thumb regenerate failed:', e.message);
    }

    /* Show the freshly-rotated bytes locally without waiting on any CDN.
       We already have the encoded Blob in memory from the rotation, so
       just hand it to imageRawUrl via a blob: URL. */
    setLocalPreview(filename, rotatedBlob);
    /* Remember this file as recently-rotated so that, after a page
       reload, rehydrateRecentRotations() can re-fetch its bytes from
       the repo (bypassing the CDN) and the admin doesn't appear to
       "revert" the rotation. */
    saveRecentRotation(filename);

    /* Fire-and-forget: nudge jsdelivr to invalidate its cached copy so
       the catalog (which is loaded by end users, not the admin) catches
       the new orientation within ~1 min instead of waiting 12h. */
    purgeJsdelivr(filename);
    if(hadThumb) purgeJsdelivr(`thumbs/${thumbName(filename)}`);

    onProgress && onProgress({ stage: 'done', filename, rotated: deg, hadThumb });
    return { filename, rotated: deg, hadThumb };
  };

  /* ---------- Public: reorder photos ----------
     `newOrder` must be a permutation of the product's current photo
     filenames — same set, different order. The first item becomes the
     product's primary (cover) photo, since the catalog/product pages
     pick `thumbs[0] || images[0]` as the card thumbnail.

     We only patch data/images.js (no file moves) — the filenames are
     unchanged, just the array order, so site behaviour updates after
     the next page load.
  ----------------------------------------------- */
  A.reorderPhotos = async (product, newOrder) => {
    if(!A.getToken())           throw new Error('Не вказано GitHub-токен');
    if(!product || !product.id) throw new Error('Не вибрано товар');
    if(!Array.isArray(newOrder)) throw new Error('newOrder має бути масивом');

    /* Always validate against the freshest committed list — the local
       cache could be stale. */
    try { await A.reloadImagesIndex(); } catch(e){ /* offline — use local */ }

    const current = A.listPhotos(product);
    const a = [...current].sort();
    const b = [...newOrder].sort();
    if(a.length !== b.length || a.some((v, i) => v !== b[i])){
      throw new Error('Список фото не співпадає з поточним');
    }
    /* No-op if order is already what was asked for */
    if(current.every((v, i) => v === newOrder[i])) return { changed: false };

    console.log('[reorderPhotos]', product.id, newOrder);

    await patchImagesJs(data => {
      const padded  = String(product.id).padStart(4, '0');
      const trimmed = String(product.id).replace(/^0+/, '') || padded;
      for(const k of [padded, trimmed]){
        if(Array.isArray(data[k])) data[k] = [...newOrder];
      }
    }, `Reorder photos for product ${String(product.id).padStart(4,'0')}`);

    /* Mirror in-page state */
    const map = window.IMAGES_BY_ID || (window.IMAGES_BY_ID = {});
    const padded  = String(product.id).padStart(4, '0');
    const trimmed = String(product.id).replace(/^0+/, '') || padded;
    for(const k of [padded, trimmed]){
      if(Array.isArray(map[k])) map[k] = [...newOrder];
    }

    return { changed: true, order: newOrder };
  };

  /* Convenience: bump one filename to position 0 (sets it as primary). */
  A.setPrimaryPhoto = async (product, filename) => {
    const current = A.listPhotos(product);
    if(!current.includes(filename)) throw new Error('Файл не належить товару');
    if(current[0] === filename) return { changed: false };
    const newOrder = [filename, ...current.filter(f => f !== filename)];
    return A.reorderPhotos(product, newOrder);
  };

  /* ---------- Public: delete ONE photo ----------
     Steps:
       1) DELETE <IMAGES_DIR>/<fname>     (404 → treat as success)
       2) DELETE <IMAGES_DIR>/thumbs/<...> (best-effort)
       3) PATCH data/images.js
       4) update window.IMAGES_BY_ID locally
  ----------------------------------------------- */
  A.deletePhoto = async (product, filename) => {
    if(!A.getToken())          throw new Error('Не вказано GitHub-токен');
    if(!product || !product.id) throw new Error('Не вибрано товар');
    if(!filename)               throw new Error('Не вказано файл');
    console.log('[deletePhoto]', product.id, '↓', filename);

    /* 1) original */
    await deleteFileApi(`${IMAGES_DIR}/${filename}`, `Remove photo: ${filename}`);

    /* 2) thumb (best-effort) */
    try {
      await deleteFileApi(`${IMAGES_DIR}/thumbs/${thumbName(filename)}`, `Remove thumb: ${thumbName(filename)}`);
    } catch(e){
      console.warn('[deletePhoto] thumb delete failed:', e.message);
    }

    /* 3) images.js */
    await patchImagesJs(data => {
      const padded  = String(product.id).padStart(4, '0');
      const trimmed = String(product.id).replace(/^0+/, '') || padded;
      for(const k of [padded, trimmed]){
        if(Array.isArray(data[k])) data[k] = data[k].filter(n => n !== filename);
      }
    }, `Remove photo from product ${String(product.id).padStart(4,'0')}`);

    /* 4) in-page state */
    const map = window.IMAGES_BY_ID || {};
    const padded  = String(product.id).padStart(4, '0');
    const trimmed = String(product.id).replace(/^0+/, '') || padded;
    for(const k of [padded, trimmed]){
      if(Array.isArray(map[k])) map[k] = map[k].filter(n => n !== filename);
    }
  };
})();
