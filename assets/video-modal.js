/* L-TEX Video Modal — plays YouTube videos / playlists in an overlay,
   without leaving the site.

   Markup contract: any element with [data-video="<youtube url>"] becomes a
   trigger. Optionally [data-video-title="..."] sets the modal heading.

   For graceful fallback (and SEO), the trigger can also be an <a href="..."
   target="_blank"> — the handler calls preventDefault so the modal opens
   instead of navigating, but middle-click / ctrl-click / right-click still
   open YouTube directly via the href.
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const ICONS = window.ICONS;

  let modalEl = null;

  function ensureModal(){
    if(modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'video-modal';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('aria-label', 'Відеоогляд');
    modalEl.innerHTML = `
      <div class="video-modal__panel" role="document">
        <button class="video-modal__close" type="button" aria-label="Закрити">
          <span class="icon">${ICONS.x({size:24})}</span>
        </button>
        <div class="video-modal__title" id="videoModalTitle"></div>
        <div class="video-modal__frame" id="videoModalFrame"></div>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.querySelector('.video-modal__close').addEventListener('click', close);
    modalEl.addEventListener('click', e => { if(e.target === modalEl) close(); });
    return modalEl;
  }

  function close(){
    if(!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    /* Wipe the iframe so playback stops immediately */
    const frame = modalEl.querySelector('#videoModalFrame');
    if(frame) frame.innerHTML = '';
  }

  L.openVideoModal = (url, title) => {
    /* Playlists open on YouTube in a new tab rather than embedding — the
       in-site player loses the playlist sidebar and feels like a single
       video, which is the opposite of what we promise on cards labelled
       "Відеоогляд". Single-video URLs (per-lot reviews) still play in
       the modal so visitors don't leave the page mid-browse. */
    const id = L.youtubeId(url);
    if(id && typeof id !== 'string'){
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const embedUrl = L.youtubeEmbedUrl(url);
    if(!embedUrl){
      /* Unknown URL format — let the browser handle it */
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const modal = ensureModal();
    modal.querySelector('#videoModalTitle').textContent = title || '';
    modal.querySelector('#videoModalFrame').innerHTML = `<iframe
      src="${embedUrl}"
      title="${L.escapeHtml(title || 'Відеоогляд')}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    /* Focus close button for accessibility */
    setTimeout(() => modal.querySelector('.video-modal__close')?.focus(), 100);
  };
  L.closeVideoModal = close;

  /* Delegated click handler in capture phase so it fires *before* the anchor
     navigates. Skips modified clicks (ctrl/cmd/shift/middle) — those keep
     working as expected (open in new tab / save link). */
  document.addEventListener('click', (e) => {
    if(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if(e.button && e.button !== 0) return;
    const el = e.target.closest('[data-video]');
    if(!el) return;
    const url = el.dataset.video;
    if(!url) return;
    e.preventDefault();
    e.stopPropagation();
    L.openVideoModal(url, el.dataset.videoTitle);
  }, true);

  /* Esc to close */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modalEl && modalEl.classList.contains('open')) close();
  });
})();
