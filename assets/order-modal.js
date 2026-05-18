/* L-TEX Universal Order/Request modal.
   Usage:
     LTEX.openOrderModal({
       title: '📩 Замовити',
       subject: 'Замовлення товару',          // becomes the Telegram heading
       presetText: 'Назва товару (1234)\n…',  // pre-filled details block
       cta: 'Надіслати запит',                // optional submit label
       intent: 'order' | 'video' | 'consult'  // optional preset variant
     })

   Primary submit posts JSON to L.CONFIG.LEAD_WORKER_URL (a Cloudflare
   Worker that forwards the lead to a Telegram bot — see
   scripts/cloudflare-worker/worker.js). If the worker URL is empty, that
   button is hidden and the user still has the manual "Open in Telegram"
   share-url fallback. */
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const ICONS = window.ICONS;
  const STORE_KEY = 'ltex-client';

  function ensureModal(){
    let m = document.getElementById('ltexOrderModal');
    if(m) return m;
    m = document.createElement('div');
    m.id = 'ltexOrderModal';
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML = `
      <div class="modal__panel" style="max-width:30rem">
        <div class="modal__head">
          <h3 class="h3" id="ltexOrderTitle">Замовлення</h3>
          <button class="icon-btn" id="ltexOrderClose" type="button" aria-label="Закрити">
            <span class="icon">${ICONS.x()}</span>
          </button>
        </div>
        <div class="modal__body">
          <p class="text-sm text-muted" id="ltexOrderHint" style="margin-bottom:1rem">
            Залиште свої контакти — менеджер зв'яжеться впродовж 15 хвилин у робочий час.
          </p>
          <div id="ltexOrderPreset" style="margin-bottom:1rem"></div>
          <form id="ltexOrderForm" novalidate>
            <div class="form-field">
              <label for="ltexOrdName">Ім'я</label>
              <input type="text" id="ltexOrdName" autocomplete="name">
            </div>
            <div class="form-field">
              <label for="ltexOrdPhone">Телефон <span style="color:var(--destructive)">*</span></label>
              <input type="tel" id="ltexOrdPhone" required placeholder="+380…" autocomplete="tel" inputmode="tel">
            </div>
            <div class="form-field">
              <label for="ltexOrdEmail">Email <span class="text-xs text-muted">(необов'язково)</span></label>
              <input type="email" id="ltexOrdEmail" autocomplete="email" inputmode="email">
            </div>
            <div class="form-field">
              <label for="ltexOrdRegion">Місто / область</label>
              <input type="text" id="ltexOrdRegion" autocomplete="address-level1">
            </div>
            <div class="form-field">
              <label for="ltexOrdMsg">Коментар</label>
              <textarea id="ltexOrdMsg" rows="2" placeholder="Уточнення, питання…"></textarea>
            </div>
            <!-- Honeypot — bots fill it, humans don't see it -->
            <input type="text" name="website" id="ltexOrdHp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none" aria-hidden="true">
            <div class="flex gap-2" style="margin-top:.75rem">
              <button class="btn btn-primary flex-1" type="button" id="ltexOrdSubmit">
                <span class="icon icon-sm">${ICONS.send()}</span>
                <span id="ltexOrdSubmitLabel">Надіслати заявку</span>
              </button>
              <button class="btn btn-outline flex-1" type="button" id="ltexOrdSendTg" title="Відкрити Telegram з готовим текстом">
                <span class="icon icon-sm">${ICONS.send()}</span>
                Telegram
              </button>
            </div>
            <div id="ltexOrdStatus" style="display:none;margin-top:.75rem;padding:.625rem .75rem;border-radius:var(--radius-md);font-size:.8125rem;text-align:center"></div>
            <p class="text-xs text-muted text-center" style="margin-top:.75rem">
              Або одразу:
              <a href="${L.CONFIG.TELEGRAM}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600">@L_TEX</a>
              ·
              <a href="tel:${L.CONFIG.PHONES[0].tel}" style="color:var(--primary);font-weight:600">${L.CONFIG.PHONES[0].display}</a>
            </p>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    const close = () => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    document.getElementById('ltexOrderClose').addEventListener('click', close);
    m.addEventListener('click', e => { if(e.target === m) close(); });
    return m;
  }

  function loadClient(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function saveClient(c){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch(e){}
  }

  L.openOrderModal = (opts = {}) => {
    const m = ensureModal();
    const title = opts.title || '📩 Замовити';
    const subject = opts.subject || 'Запит з сайту L-TEX';
    const preset = opts.presetText || '';
    const intent = opts.intent || 'order';

    const intentHints = {
      order:   "Залиште свої контакти — менеджер зв'яжеться впродовж 15 хвилин у робочий час.",
      video:   'Запросимо відеоогляд цього товару у постачальника. Зазвичай готово протягом 1–2 днів.',
      consult: 'Менеджер передзвонить і відповість на ваші питання про товар.',
    };

    document.getElementById('ltexOrderTitle').textContent = title;
    document.getElementById('ltexOrderHint').textContent = intentHints[intent] || intentHints.order;

    const presetBox = document.getElementById('ltexOrderPreset');
    if(preset){
      presetBox.innerHTML = `<div class="key-facts" style="margin:0;padding:.75rem 1rem"><pre style="white-space:pre-wrap;font-family:inherit;font-size:.8125rem;line-height:1.5;color:var(--gray-700);margin:0">${L.escapeHtml(preset)}</pre></div>`;
    } else {
      presetBox.innerHTML = '';
    }

    /* Restore saved client info */
    const saved = loadClient();
    document.getElementById('ltexOrdName').value = saved.name || '';
    document.getElementById('ltexOrdPhone').value = saved.phone || '';
    document.getElementById('ltexOrdEmail').value = saved.email || '';
    document.getElementById('ltexOrdRegion').value = saved.region || '';
    document.getElementById('ltexOrdMsg').value = '';

    const collect = () => {
      const c = {
        name: document.getElementById('ltexOrdName').value.trim(),
        phone: document.getElementById('ltexOrdPhone').value.trim(),
        email: document.getElementById('ltexOrdEmail').value.trim(),
        region: document.getElementById('ltexOrdRegion').value.trim(),
        msg: document.getElementById('ltexOrdMsg').value.trim(),
      };
      saveClient({ name: c.name, phone: c.phone, email: c.email, region: c.region });
      return c;
    };

    const buildText = (c) => {
      const lines = [];
      if(preset){ lines.push(preset); lines.push(''); }
      lines.push('— Контакти —');
      if(c.name) lines.push(`Ім'я: ${c.name}`);
      if(c.phone) lines.push(`Телефон: ${c.phone}`);
      if(c.email) lines.push(`Email: ${c.email}`);
      if(c.region) lines.push(`Регіон: ${c.region}`);
      if(c.msg) { lines.push(''); lines.push(`Коментар: ${c.msg}`); }
      return lines.join('\n');
    };

    /* Status helper */
    const statusEl = document.getElementById('ltexOrdStatus');
    function setStatus(kind, msg){
      if(!msg){ statusEl.style.display = 'none'; statusEl.textContent = ''; return; }
      statusEl.style.display = 'block';
      statusEl.textContent = msg;
      statusEl.style.background = kind === 'success' ? 'var(--green-50)'
        : kind === 'error'   ? 'var(--red-50)'
        : 'var(--gray-100)';
      statusEl.style.color = kind === 'success' ? 'var(--green-700)'
        : kind === 'error'   ? 'var(--red-700)'
        : 'var(--gray-700)';
      statusEl.style.border = '1px solid ' + (kind === 'success' ? 'var(--green-200)'
        : kind === 'error'   ? 'var(--red-200)'
        : 'var(--border)');
    }

    /* Hide the primary "Надіслати заявку" button if the Worker URL is not
       configured — fall back to the manual Telegram share button so the form
       still works during initial setup. */
    const submitBtn = document.getElementById('ltexOrdSubmit');
    const tgBtn = document.getElementById('ltexOrdSendTg');
    const workerUrl = (L.CONFIG.LEAD_WORKER_URL || '').replace(/\/+$/, '');
    if(!workerUrl){
      submitBtn.style.display = 'none';
      tgBtn.classList.remove('btn-outline');
      tgBtn.classList.add('btn-primary');
    }

    /* Replace with clones to drop listeners from previous opens */
    const submitClone = submitBtn.cloneNode(true);
    submitBtn.replaceWith(submitClone);
    const tgClone = tgBtn.cloneNode(true);
    tgBtn.replaceWith(tgClone);

    tgClone.addEventListener('click', () => {
      const c = collect();
      if(!c.phone){ L.toast('Вкажіть телефон', 'error'); setStatus('error', 'Потрібен телефон'); return; }
      window.open(L.tgOrderUrl(buildText(c)), '_blank', 'noopener');
      setStatus('success', 'Відкрито Telegram. Натисніть «Надіслати» там, щоб завершити.');
      L.toast('Відкрито Telegram', 'success');
    });

    submitClone.addEventListener('click', async () => {
      if(!workerUrl) return;
      const c = collect();
      if(!c.phone){ L.toast('Вкажіть телефон', 'error'); setStatus('error', 'Потрібен телефон'); return; }
      const hp = document.getElementById('ltexOrdHp')?.value || '';
      const label = document.getElementById('ltexOrdSubmitLabel');
      const origLabel = label.textContent;
      submitClone.disabled = true; tgClone.disabled = true;
      label.textContent = 'Надсилаємо…';
      setStatus('info', 'Надсилаємо заявку менеджеру…');
      try {
        const payload = {
          form: opts.formId || 'orderModal',
          subject,
          intent,
          name: c.name,
          phone: c.phone,
          email: c.email,
          region: c.region,
          comment: c.msg,
          preset,
          page: location.href,
          ua: navigator.userAgent,
          website: hp, // honeypot
        };
        const res = await fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if(res.ok && data.ok){
          setStatus('success', '✅ Заявку надіслано! Менеджер передзвонить впродовж 15 хв у робочий час.');
          L.toast('Заявку надіслано', 'success');
          setTimeout(() => {
            m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
          }, 1800);
        } else {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
      } catch(err) {
        setStatus('error', `⚠️ Не вдалося надіслати (${err.message}). Скористайтесь кнопкою «Telegram» або зателефонуйте: ${L.CONFIG.PHONES[0].display}`);
        L.toast('Помилка відправки', 'error');
        submitClone.disabled = false; tgClone.disabled = false;
        label.textContent = origLabel;
      }
    });

    setStatus(null);
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    /* Focus phone */
    setTimeout(() => document.getElementById('ltexOrdPhone').focus(), 100);
  };
})();
