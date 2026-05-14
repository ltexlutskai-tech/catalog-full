/* L-TEX Admin — upload product photos directly to the GitHub repo via the
   Contents API. Designed for the single shop manager: requires a Personal
   Access Token with `contents:write` access to the catalog-full repo,
   stored in localStorage on this browser only.

   Flow per upload batch:
     1. For each chosen file, compute target filename based on product name +
        ID + uniqueness suffix.
     2. PUT each file to GitHub Contents API (base64 body).
     3. Fetch current data/images.js, parse window.IMAGES_BY_ID, append new
        filenames under the product id, serialise + PUT back.
     4. Toast success. GH Pages takes ~1 min to deploy.
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const ICONS = window.ICONS;

  const REPO_OWNER = 'ltexlutskai-tech';
  const REPO_NAME = 'catalog-full';
  const BRANCH = 'main';
  const IMAGES_DIR = (window.IMAGES_DIR || '2025-2026-named-top5');
  const IMAGES_JS_PATH = 'data/images.js';
  const TOKEN_KEY = 'ltex-admin-token';
  const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

  const A = L.Admin = {};

  /* === Auth === */
  A.getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch(e){ return null; }
  };
  A.setToken = (tok) => {
    try { localStorage.setItem(TOKEN_KEY, tok); } catch(e){}
  };
  A.clearToken = () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch(e){}
  };

  async function gh(path, opts = {}){
    const tok = A.getToken();
    if(!tok) throw new Error('Не вказано GitHub-токен');
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${tok}`,
        ...(opts.headers || {}),
      },
    });
    if(!res.ok){
      const text = await res.text();
      let msg = `GitHub API ${res.status}`;
      try { const j = JSON.parse(text); if(j.message) msg += ': ' + j.message; } catch(e){ msg += ': ' + text.slice(0, 100); }
      throw new Error(msg);
    }
    return res.json();
  }

  A.checkToken = async () => {
    try {
      const u = await gh('https://api.github.com/user');
      /* Verify the user actually has access to the repo */
      await gh('');
      return { ok: true, login: u.login };
    } catch(e){
      return { ok: false, error: e.message };
    }
  };

  /* === File → base64 === */
  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = String(dataUrl).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* === Canvas-side thumbnail generation ===
     Mirrors optimize_images.py: max 800px wide, JPEG q82. Lets the catalog
     load fast right after a fresh upload, without waiting for the Python
     pipeline to re-run. Returns base64 (no data: prefix) for direct PUT. */
  async function makeThumbBase64(file, maxWidth = 800, quality = 0.82){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.naturalWidth);
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          /* Solid white background covers PNG transparency */
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            URL.revokeObjectURL(url);
            if(!blob){ reject(new Error('Canvas thumbnail encode failed')); return; }
            const reader = new FileReader();
            reader.onload = () => {
              const b64 = String(reader.result).split(',')[1] || '';
              resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }, 'image/jpeg', quality);
        } catch(e){
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  /* Same name as the original, but always .jpg (thumbnails are JPEG) */
  function thumbName(fname){
    return fname.replace(/\.[^./]+$/, '') + '.jpg';
  }

  /* === Filename helpers ===
     Convention used by extract_products/generate_assets:
       "(0215) Тюль тонка, фіранки, занавіски мікс.jpg"
       Second image of same product: "..._2.jpg", third "_3.jpg", etc.
  */
  function sanitiseName(s){
    return String(s).replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  }
  function targetFilename(product, existingNames, extLower){
    const id = String(product.id).padStart(4, '0');
    const baseStem = `(${id}) ${sanitiseName(product.name)}`.slice(0, 120);
    /* Find next available _N suffix */
    const taken = new Set(existingNames);
    if(!taken.has(`${baseStem}.${extLower}`)) return `${baseStem}.${extLower}`;
    let n = 2;
    while(taken.has(`${baseStem}_${n}.${extLower}`)) n++;
    return `${baseStem}_${n}.${extLower}`;
  }

  /* === UTF-8 ↔ base64 (modern, replaces broken `escape()` hack) === */
  function b64ToString(b64){
    const binary = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function stringToB64(str){
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    /* String.fromCharCode + spread blows the stack on big files; chunk it */
    const CHUNK = 0x8000;
    for(let i = 0; i < bytes.length; i += CHUNK){
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function isConflict(err){
    const m = String(err && err.message || '');
    return /\b(409|422)\b/.test(m) || /sha/i.test(m);
  }

  /* === Upload one file (with conflict retry) ===
     Cache-bust the GET so we don't read a stale sha (GitHub edge cache can
     serve a few seconds old; PUT with stale sha → 409/422). */
  async function uploadFile(path, content, message){
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `/contents/${encodedPath}`;

    async function getSha(){
      try {
        const existing = await gh(`${url}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
        return (existing && existing.sha) || null;
      } catch(e){
        /* 404 → file does not exist, that's fine */
        return null;
      }
    }

    let sha = await getSha();
    for(let attempt = 0; attempt < 3; attempt++){
      try {
        return await gh(url, {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content,
            branch: BRANCH,
            sha: sha || undefined,
          }),
        });
      } catch(e){
        if(!isConflict(e) || attempt === 2) throw e;
        /* Conflict: refetch sha and try again */
        await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
        sha = await getSha();
      }
    }
  }

  /* === Update data/images.js (with conflict retry) === */
  async function updateImagesJs(productId, newFilenames){
    for(let attempt = 0; attempt < 4; attempt++){
      try {
        const meta = await gh(`/contents/${IMAGES_JS_PATH}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`);
        const decoded = b64ToString(meta.content);
        const re = /window\.IMAGES_BY_ID\s*=\s*(\{[\s\S]*?\});/;
        const m = decoded.match(re);
        if(!m) throw new Error('Не вдалося розпарсити data/images.js');
        let data;
        try { data = JSON.parse(m[1]); }
        catch(e){ throw new Error('JSON-помилка в images.js: ' + e.message); }

        /* Add new filenames under both '215' and '0215' keys */
        const pid = String(productId).replace(/^0+/, '') || productId;
        const padded = String(productId).padStart(4, '0');
        [pid, padded].forEach(k => {
          const existing = data[k] || [];
          const merged = [...existing];
          for(const fn of newFilenames){
            if(!merged.includes(fn)) merged.push(fn);
          }
          data[k] = merged;
        });

        const newJs = '// auto-generated by generate_assets.py — do NOT edit\nwindow.IMAGES_BY_ID = ' + JSON.stringify(data) + ';\n';
        const newContent = stringToB64(newJs);

        return await gh(`/contents/${IMAGES_JS_PATH}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: `Add photos for product ${padded} (via admin)`,
            content: newContent,
            branch: BRANCH,
            sha: meta.sha,
          }),
        });
      } catch(e){
        if(!isConflict(e) || attempt === 3) throw e;
        /* Race against another commit (or stale sha cache). Wait and retry
           with a fresh GET. */
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  A.fetchExistingFilenames = async (productId) => {
    /* Use the current in-page IMAGES_BY_ID rather than another GitHub call.
       This is up to date for the user because they have just loaded the
       deployed images.js. New uploads during this session are tracked
       locally and don't need a re-fetch. */
    const padded = String(productId).padStart(4, '0');
    const trimmed = String(productId).replace(/^0+/, '') || padded;
    const m = window.IMAGES_BY_ID || {};
    return [...new Set([...(m[padded] || []), ...(m[trimmed] || [])])];
  };

  /* === Public: upload N files for a product === */
  A.uploadPhotos = async (product, files, onProgress) => {
    if(!product) throw new Error('Не вибрано товар');
    if(!files || !files.length) throw new Error('Не вибрано файлів');
    const tok = A.getToken();
    if(!tok) throw new Error('Не вказано GitHub-токен');

    const existing = await A.fetchExistingFilenames(product.id);
    const added = [];
    let i = 0;
    for(const file of files){
      i++;
      if(file.size > 30 * 1024 * 1024){
        throw new Error(`${file.name}: понад 30 MB. Стисніть або зменшіть фото`);
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'jpg';
      const fname = targetFilename(product, [...existing, ...added], ext);
      onProgress && onProgress({ stage: 'encoding', file: file.name, target: fname, current: i, total: files.length });

      /* Encode original + generate 800px thumbnail in parallel */
      const [origB64, thumbB64] = await Promise.all([
        fileToBase64(file),
        makeThumbBase64(file).catch(err => {
          console.warn('Thumbnail failed for', file.name, err);
          return null;
        }),
      ]);

      onProgress && onProgress({ stage: 'uploading', file: file.name, target: fname, current: i, total: files.length });
      const path = `${IMAGES_DIR}/${fname}`;
      await uploadFile(path, origB64, `Add photo: ${fname}`);

      /* Upload thumbnail to thumbs/ subfolder, same name, always .jpg */
      if(thumbB64){
        const tName = thumbName(fname);
        const tPath = `${IMAGES_DIR}/thumbs/${tName}`;
        try {
          await uploadFile(tPath, thumbB64, `Add thumbnail: ${tName}`);
        } catch(e){
          console.warn('Thumb upload failed:', e.message);
          /* Non-fatal — catalog falls back to original on 404 */
        }
      }

      added.push(fname);
      /* Update in-page state immediately so the UI reflects it */
      const m = window.IMAGES_BY_ID || (window.IMAGES_BY_ID = {});
      const padded = String(product.id).padStart(4, '0');
      const trimmed = String(product.id).replace(/^0+/, '') || padded;
      m[padded] = [...(m[padded] || []), fname];
      m[trimmed] = [...(m[trimmed] || []), fname];
    }

    onProgress && onProgress({ stage: 'updating-index', current: files.length, total: files.length });
    await updateImagesJs(product.id, added);

    onProgress && onProgress({ stage: 'done', count: added.length, files: added });
    return added;
  };

  /* === Image URL for admin previews ===
     raw.githubusercontent.com has a 'sandbox' CSP that blocks <img> embedding
     on other origins, so freshly uploaded photos showed as broken images even
     though the file existed. jsdelivr.net proxies the same repo with proper
     CORS / cross-origin-resource-policy headers and refreshes within ~1 min
     after a commit — perfect for admin previews. */
  function encPathSeg(s){
    return encodeURIComponent(s).replace(/'/g, '%27').replace(/%28/g, '(').replace(/%29/g, ')');
  }
  A.imageRawUrl = (filename) => {
    return `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${BRANCH}/${IMAGES_DIR}/${encPathSeg(filename)}`;
  };
})();
