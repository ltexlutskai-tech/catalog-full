/* L-TEX universal header/footer renderer.
   Place a <div data-ltex-header data-active="catalog|lots|new|sale|about|contacts"></div>
   and <div data-ltex-footer></div> on each page; this script populates them.
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const ICONS = window.ICONS;

  const NAV = [
    { key: 'catalog',  label: 'Каталог',   href: 'catalog.html' },
    { key: 'lots',     label: 'Лоти',      href: 'lots.html' },
    { key: 'new',      label: 'Новинки',   href: 'catalog.html?new=1' },
    { key: 'sale',     label: 'Акції',     href: 'catalog.html?sale=1' },
    { key: 'about',    label: 'Про нас',   href: 'index.html#about' },
    { key: 'contacts', label: 'Контакти',  href: 'index.html#contacts' },
  ];

  function renderHeader(host){
    const active = host.dataset.active || '';
    const html = `
      <div class="site-header__inner">
        <a href="index.html" class="site-header__logo" aria-label="L-TEX — головна">L-TEX</a>

        <nav class="site-header__nav" aria-label="Головне меню">
          ${NAV.map(n => `<a href="${n.href}" class="${active === n.key ? 'active' : ''}">${n.label}</a>`).join('')}
        </nav>

        <div class="site-header__search" id="hdrSearch">
          <input type="search" placeholder="Пошук товарів…" autocomplete="off" id="hdrSearchInput" aria-label="Пошук товарів">
          <span class="site-header__search-icon icon icon-sm">${ICONS.search()}</span>
          <div class="search-results" id="hdrSearchResults" role="listbox"></div>
        </div>

        <div class="site-header__actions">
          <a href="tel:${L.CONFIG.PHONES[0].tel}" class="site-header__phone">${L.CONFIG.PHONES[0].display}</a>
          <a href="wishlist.html" class="icon-btn" aria-label="Список бажань" id="hdrWishBtn">
            <span class="icon">${ICONS.heart()}</span>
            <span class="badge" id="hdrWishCount" style="display:none">0</span>
          </a>
          <a href="cart.html" class="icon-btn" aria-label="Кошик" id="hdrCartBtn">
            <span class="icon">${ICONS.cart()}</span>
            <span class="badge cart" id="hdrCartCount" style="display:none">0</span>
          </a>
          <button class="icon-btn site-header__burger" id="hdrBurger" aria-label="Меню" type="button">
            <span class="icon">${ICONS.menu()}</span>
          </button>
        </div>
      </div>

      <!-- Mobile drawer -->
      <div class="mobile-menu" id="mobileMenu" role="dialog" aria-label="Меню" aria-hidden="true">
        <div class="mobile-menu__panel">
          <div class="mobile-menu__head">
            <span class="site-header__logo">L-TEX</span>
            <button class="icon-btn" id="mobileMenuClose" aria-label="Закрити" type="button">
              <span class="icon">${ICONS.x()}</span>
            </button>
          </div>
          <nav class="mobile-menu__nav" aria-label="Мобільне меню">
            ${NAV.map(n => `<a href="${n.href}" class="${active === n.key ? 'active' : ''}">${n.label}</a>`).join('')}
            <a href="wishlist.html"><span class="icon icon-sm" style="margin-right:.25rem">${ICONS.heart()}</span> Список бажань</a>
            <a href="cart.html"><span class="icon icon-sm" style="margin-right:.25rem">${ICONS.cart()}</span> Кошик</a>
          </nav>
          <div class="mobile-menu__foot">
            <div style="display:flex;flex-direction:column;gap:.5rem">
              ${L.CONFIG.PHONES.map(p => `<a href="tel:${p.tel}" style="font-weight:600">${p.display}</a>`).join('')}
              <a href="${L.CONFIG.TELEGRAM}" target="_blank" rel="noopener" class="btn btn-primary">
                <span class="icon icon-sm">${ICONS.send()}</span> Telegram
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    host.innerHTML = html;
    bindHeader();
  }

  function bindHeader(){
    /* Mobile menu */
    const menu = document.getElementById('mobileMenu');
    const burger = document.getElementById('hdrBurger');
    const closeBtn = document.getElementById('mobileMenuClose');
    const open = () => { menu.classList.add('open'); menu.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; };
    const close = () => { menu.classList.remove('open'); menu.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; };
    burger?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    menu?.addEventListener('click', e => { if(e.target === menu) close(); });

    /* Wishlist + cart count */
    const updCounts = () => {
      const wc = document.getElementById('hdrWishCount');
      const cc = document.getElementById('hdrCartCount');
      const wn = L.wishlist.count();
      const cn = L.cart.count();
      if(wc){ wc.textContent = wn; wc.style.display = wn ? 'flex' : 'none'; }
      if(cc){ cc.textContent = cn; cc.style.display = cn ? 'flex' : 'none'; }
    };
    updCounts();
    window.addEventListener('ltex:wishlist-changed', updCounts);
    window.addEventListener('ltex:cart-changed', updCounts);

    /* Search autocomplete */
    const input = document.getElementById('hdrSearchInput');
    const results = document.getElementById('hdrSearchResults');
    if(input && results){
      const render = (matches) => {
        if(!matches.length){
          results.innerHTML = `<div class="search-empty">Нічого не знайдено</div>`;
          results.classList.add('open');
          return;
        }
        results.innerHTML = matches.map(({p}) => {
          const img = p.thumb || p.image;
          const price = p.priceUah != null ? L.formatUah(p.priceUah) : '';
          const unit = p.unit ? `/${p.unit}` : '';
          return `<a class="search-result" href="${L.productHref(p.id)}">
            <div class="search-result__img">${img ? `<img src="${img}" alt="" loading="lazy">` : ''}</div>
            <div class="min-w-0 flex-1">
              <div class="search-result__title">${L.escapeHtml(p.name)}</div>
              <div class="search-result__meta">${L.escapeHtml(p.subcat || p.category || '')} ${p.sort ? '· ' + L.escapeHtml(p.sort) : ''}</div>
            </div>
            <div class="search-result__price">${price}${price ? `<span style="font-size:.6875rem;color:var(--gray-400);font-weight:400;display:block">${unit}</span>` : ''}</div>
          </a>`;
        }).join('');
        results.classList.add('open');
      };
      const run = () => {
        const q = input.value.trim();
        if(!q){ results.classList.remove('open'); return; }
        const matches = L.search(q, { limit: 8, minScore: 0.4 });
        render(matches);
      };
      const debouncedRun = L.debounce(run, 180);
      input.addEventListener('input', debouncedRun);
      input.addEventListener('focus', () => { if(input.value.trim()) run(); });
      input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){
          e.preventDefault();
          const q = input.value.trim();
          if(q) location.href = L.catalogHref({ q });
        } else if(e.key === 'Escape'){
          results.classList.remove('open');
          input.blur();
        }
      });
      document.addEventListener('click', e => {
        if(!e.target.closest('#hdrSearch')) results.classList.remove('open');
      });
    }
  }

  function renderFooter(host){
    const html = `
      <div class="site-footer__inner">
        <div>
          <h4>L-TEX</h4>
          <p style="color:var(--gray-400);font-size:.875rem;line-height:1.6">
            Секонд-хенд та сток гуртом від ${L.CONFIG.MIN_ORDER_KG} кг.<br>
            Англія, Німеччина, Канада, Польща, Італія, Шотландія.
          </p>
          <div class="site-footer__socials">
            <a href="${L.CONFIG.TELEGRAM}" target="_blank" rel="noopener" aria-label="Telegram"><span class="icon icon-sm">${ICONS.send()}</span></a>
            <a href="viber://chat?number=%2B380676710516" aria-label="Viber"><span class="icon icon-sm">${ICONS.messageCircle()}</span></a>
            <a href="mailto:${L.CONFIG.EMAIL}" aria-label="Email"><span class="icon icon-sm">${ICONS.mail()}</span></a>
          </div>
        </div>
        <div>
          <h4>Каталог</h4>
          <ul>
            ${L.TOP_CATS.map(c => `<li><a href="catalog.html?cat=${encodeURIComponent(c)}">${c}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4>Інформація</h4>
          <ul>
            <li><a href="catalog.html">Каталог товарів</a></li>
            <li><a href="lots.html">Наявні лоти</a></li>
            <li><a href="catalog.html?sale=1">Акції</a></li>
            <li><a href="catalog.html?sort=newest">Новинки</a></li>
            <li><a href="wishlist.html">Список бажань</a></li>
          </ul>
        </div>
        <div>
          <h4>Контакти</h4>
          <ul>
            ${L.CONFIG.PHONES.map(p => `<li><a href="tel:${p.tel}"><span class="icon icon-sm" style="vertical-align:-3px;margin-right:.25rem">${ICONS.phone()}</span>${p.display}</a></li>`).join('')}
            <li><a href="mailto:${L.CONFIG.EMAIL}"><span class="icon icon-sm" style="vertical-align:-3px;margin-right:.25rem">${ICONS.mail()}</span>${L.CONFIG.EMAIL}</a></li>
            <li><a href="${L.CONFIG.TELEGRAM}" target="_blank" rel="noopener"><span class="icon icon-sm" style="vertical-align:-3px;margin-right:.25rem">${ICONS.send()}</span>Telegram @L_TEX</a></li>
            <li style="color:var(--gray-400);margin-top:.25rem"><span class="icon icon-sm" style="vertical-align:-3px;margin-right:.25rem">${ICONS.mapPin()}</span>${L.CONFIG.ADDRESS}</li>
          </ul>
        </div>
      </div>
      <div class="site-footer__bottom">
        © ${new Date().getFullYear()} L-TEX — Секонд-хенд гуртом
      </div>
    `;
    host.innerHTML = html;
  }

  function init(){
    document.querySelectorAll('[data-ltex-header]').forEach(el => {
      el.classList.add('site-header');
      renderHeader(el);
    });
    document.querySelectorAll('[data-ltex-footer]').forEach(el => {
      el.classList.add('site-footer');
      renderFooter(el);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
