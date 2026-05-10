/* L-TEX Universal Order/Request modal.
   Usage:
     LTEX.openOrderModal({
       title: '📩 Замовити',
       subject: 'Замовлення товару',          // email subject + Telegram heading
       presetText: 'Назва товару (1234)\n…',  // pre-filled message body
       cta: 'Надіслати запит',                // optional submit label
       intent: 'order' | 'video' | 'consult'  // optional preset variant
     })
*/
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
            <div class="flex gap-2" style="margin-top:.75rem">
              <button class="btn btn-primary flex-1" type="button" id="ltexOrdSendTg">
                <span class="icon icon-sm">${ICONS.send()}</span>
                Надіслати в Telegram
              </button>
              <a class="btn btn-outline flex-1" href="#" id="ltexOrdSendMail">
                <span class="icon icon-sm">${ICONS.mail()}</span>
                Email
              </a>
            </div>
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

    /* Wire actions */
    const tgBtn = document.getElementById('ltexOrdSendTg');
    const mailBtn = document.getElementById('ltexOrdSendMail');

    /* Replace buttons by clones to drop previous listeners */
    const tgClone = tgBtn.cloneNode(true);
    tgBtn.replaceWith(tgClone);
    const mailClone = mailBtn.cloneNode(true);
    mailBtn.replaceWith(mailClone);

    tgClone.addEventListener('click', () => {
      const c = collect();
      if(!c.phone){ L.toast('Вкажіть телефон', 'error'); return; }
      window.open(L.tgOrderUrl(buildText(c)), '_blank', 'noopener');
      L.toast('Відкрито Telegram', 'success');
      m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    });
    mailClone.addEventListener('click', e => {
      e.preventDefault();
      const c = collect();
      if(!c.phone && !c.email){ L.toast('Вкажіть телефон або email', 'error'); return; }
      location.href = L.mailOrderUrl(subject, buildText(c));
    });

    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    /* Focus phone */
    setTimeout(() => document.getElementById('ltexOrdPhone').focus(), 100);
  };
})();
