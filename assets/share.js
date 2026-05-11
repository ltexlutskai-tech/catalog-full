/* L-TEX Share — share the current page (or a specific URL) via the native
   Web Share Sheet (mobile / macOS Safari) with a desktop fallback modal
   that offers Telegram / Viber / WhatsApp / Email + one-click copy.

   The URL is shown to the user in its DECODED form (so Cyrillic stays
   readable, not %D1%84%D1%83%...), and the encoded form is what's actually
   sent to other apps — so the link reliably works everywhere.

   Usage:
     LTEX.share({ url, title, text })
     LTEX.share()  // shares the current page
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const ICONS = window.ICONS;

  /* Decode %xx-encoded URL safely for display */
  function decodeUrlForDisplay(url){
    try { return decodeURI(url); }
    catch(e){ return url; }
  }

  /* Always provide an absolute URL — Telegram/Viber/etc expect that */
  function ensureAbsolute(url){
    if(!url) return location.href;
    if(/^https?:\/\//i.test(url)) return url;
    return new URL(url, location.href).href;
  }

  let modalEl = null;
  function ensureModal(){
    if(modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal share-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('aria-label', 'Поділитися посиланням');
    modalEl.innerHTML = `
      <div class="modal__panel share-modal__panel">
        <div class="modal__head">
          <h3 class="h3">🔗 Поділитися посиланням</h3>
          <button class="icon-btn" id="shareClose" type="button" aria-label="Закрити">
            <span class="icon">${ICONS.x()}</span>
          </button>
        </div>
        <div class="modal__body">
          <p class="text-sm text-muted" id="shareTitle" style="margin-bottom:.75rem"></p>

          <div class="share-link-wrap">
            <input type="text" id="shareUrlInput" readonly class="share-link-input">
            <button class="btn btn-primary" id="shareCopyBtn" type="button">
              <span class="icon icon-sm" id="shareCopyIcon">${ICONS.check({size:16})}</span>
              <span id="shareCopyLabel">Копіювати</span>
            </button>
          </div>

          <div class="share-options" id="shareOptions"></div>

          <p class="text-xs text-muted text-center" style="margin-top:.5rem">
            Підказка: кирилиця у посиланні може виглядати як <code>%D1%84%D1%83…</code> — це нормально, всі месенджери відобразять його правильно.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    document.getElementById('shareClose').addEventListener('click', close);
    modalEl.addEventListener('click', e => { if(e.target === modalEl) close(); });
    return modalEl;
  }

  function close(){
    if(!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* Build the per-target URL */
  function buildTargets(url, title, text){
    const msg = (text || title || '').trim();
    const composed = msg ? `${msg}\n${url}` : url;
    return [
      {
        key: 'tg',  label: 'Telegram',  icon: ICONS.send({size:18}),
        href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(msg)}`,
        color: '#229ED9',
      },
      {
        key: 'wa',  label: 'WhatsApp',  icon: ICONS.messageCircle({size:18}),
        href: `https://wa.me/?text=${encodeURIComponent(composed)}`,
        color: '#25D366',
      },
      {
        key: 'vb',  label: 'Viber',     icon: ICONS.messageCircle({size:18}),
        href: `viber://forward?text=${encodeURIComponent(composed)}`,
        color: '#7360F2',
      },
      {
        key: 'mail',label: 'Email',     icon: ICONS.mail({size:18}),
        href: `mailto:?subject=${encodeURIComponent(title || 'L-TEX')}&body=${encodeURIComponent(composed)}`,
        color: 'var(--gray-700)',
      },
    ];
  }

  L.share = (opts = {}) => {
    const url = ensureAbsolute(opts.url || location.href);
    const title = opts.title || document.title;
    const text = opts.text || '';

    /* Native Web Share API where supported (most mobile + macOS Safari).
       Skip on desktop Chrome/Firefox where the sheet often is missing. */
    const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    if(canNative && isMobile){
      navigator.share({ url, title, text }).catch(() => openFallback(url, title, text));
      return;
    }
    openFallback(url, title, text);
  };

  function openFallback(url, title, text){
    const m = ensureModal();
    /* Show decoded form so users see readable Cyrillic when copying. */
    const display = decodeUrlForDisplay(url);
    m.querySelector('#shareUrlInput').value = display;
    m.querySelector('#shareTitle').textContent = title || '';

    /* Reset copy button */
    const copyBtn = document.getElementById('shareCopyBtn');
    const copyLabel = document.getElementById('shareCopyLabel');
    const copyIcon = document.getElementById('shareCopyIcon');
    copyLabel.textContent = 'Копіювати';
    copyIcon.innerHTML = ICONS.check({size:16});
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(display);
        copyLabel.textContent = 'Скопійовано';
        copyIcon.innerHTML = ICONS.check({size:16});
        L.toast('Посилання скопійовано', 'success');
        setTimeout(() => { copyLabel.textContent = 'Копіювати'; }, 1800);
      } catch(e){
        /* Fallback: select + execCommand */
        const inp = document.getElementById('shareUrlInput');
        inp.select(); inp.setSelectionRange(0, inp.value.length);
        try { document.execCommand('copy'); L.toast('Посилання скопійовано', 'success'); }
        catch(_){ L.toast('Не вдалося скопіювати — виділіть вручну', 'error'); }
      }
    };

    /* Render targets */
    const opts = buildTargets(url, title, text);
    const root = document.getElementById('shareOptions');
    root.innerHTML = opts.map(o => `
      <a class="share-option" href="${o.href}" target="_blank" rel="noopener" data-key="${o.key}" style="--share-color:${o.color}">
        <span class="share-option__icon">${o.icon}</span>
        <span>${o.label}</span>
      </a>
    `).join('');
    /* On Telegram/Viber clicks, also close modal */
    root.querySelectorAll('.share-option').forEach(a => {
      a.addEventListener('click', () => setTimeout(close, 200));
    });

    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    /* Select the URL on open for easy keyboard-copy */
    setTimeout(() => {
      const inp = document.getElementById('shareUrlInput');
      if(inp){ inp.focus(); inp.select(); }
    }, 80);
  }

  /* Delegated [data-share] click handler:
       <button data-share data-share-title="..." data-share-text="..." data-share-url="...">
     All attrs optional — defaults to the current page URL/title. */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-share]');
    if(!el) return;
    e.preventDefault();
    L.share({
      url: el.dataset.shareUrl,
      title: el.dataset.shareTitle,
      text: el.dataset.shareText,
    });
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modalEl && modalEl.classList.contains('open')) close();
  });
})();
