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

  /* === Upload one file === */
  async function uploadFile(path, content, message){
    const url = `/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    /* If the path already exists, GitHub requires the existing sha */
    let sha = null;
    try {
      const existing = await gh(url + `?ref=${encodeURIComponent(BRANCH)}`);
      sha = existing && existing.sha || null;
    } catch(e){ /* 404 → file does not exist, that's fine */ }
    return gh(url, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content,
        branch: BRANCH,
        sha: sha || undefined,
      }),
    });
  }

  /* === Update data/images.js === */
  async function updateImagesJs(productId, newFilenames){
    const url = `/contents/${IMAGES_JS_PATH}?ref=${encodeURIComponent(BRANCH)}`;
    const meta = await gh(url);
    const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\s/g, ''))));
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
    const newContent = btoa(unescape(encodeURIComponent(newJs)));

    return gh(`/contents/${IMAGES_JS_PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add photos for product ${padded} (via admin)`,
        content: newContent,
        branch: BRANCH,
        sha: meta.sha,
      }),
    });
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
      const b64 = await fileToBase64(file);
      onProgress && onProgress({ stage: 'uploading', file: file.name, target: fname, current: i, total: files.length });
      const path = `${IMAGES_DIR}/${fname}`;
      await uploadFile(path, b64, `Add photo: ${fname}`);
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
     Use raw.githubusercontent.com so freshly-uploaded photos appear instantly
     without waiting for the ~1 minute GitHub Pages CDN deploy.
     Encode each path segment separately so spaces/Cyrillic survive,
     but parentheses (commonly in our filenames) stay as-is. */
  function encPathSeg(s){
    return encodeURIComponent(s).replace(/'/g, '%27').replace(/%28/g, '(').replace(/%29/g, ')');
  }
  A.imageRawUrl = (filename) => {
    return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${IMAGES_DIR}/${encPathSeg(filename)}`;
  };
})();
