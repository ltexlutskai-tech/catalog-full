/* L-TEX Wishlist + Cart (localStorage)
   Wishlist key: ltex-wishlist (array of product ids, max 100)
   Cart key:     ltex-cart (array of {id, qty}) — qty in кг (or шт for unit==='шт')
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;

  /* === WISHLIST === */
  const WK = 'ltex-wishlist';
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e) { return []; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  L.wishlist = {
    get: () => read(WK),
    has: (id) => read(WK).includes(String(id)),
    toggle: (id, name) => {
      const list = read(WK);
      const sid = String(id);
      const i = list.indexOf(sid);
      if(i === -1){
        if(list.length >= 100){ L.toast('Список бажань заповнено (100)', 'error'); return false; }
        list.unshift(sid);
        write(WK, list);
        L.toast(`«${name || 'Товар'}» додано в обране`, 'success');
        L.wishlist._notify();
        return true;
      } else {
        list.splice(i, 1);
        write(WK, list);
        L.toast(`«${name || 'Товар'}» прибрано з обраного`);
        L.wishlist._notify();
        return false;
      }
    },
    clear: () => { write(WK, []); L.wishlist._notify(); },
    count: () => read(WK).length,
    _notify: () => window.dispatchEvent(new CustomEvent('ltex:wishlist-changed', { detail: { count: read(WK).length } })),
  };

  /* === CART ===
     Item shape:
       { kind:'product', id, qty }              — generic product (unit kg or шт)
       { kind:'lot', barcode, prodId, qty:1 }   — concrete lot (always qty 1)
     Backward-compat: legacy items {id, qty} treated as kind:'product'.
  */
  const CK = 'ltex-cart';
  const isLot = it => it && (it.kind === 'lot' || (it.barcode && !it.id));
  const itemKey = it => isLot(it) ? `lot:${it.barcode}` : `prod:${it.id}`;
  L.cart = {
    items: () => read(CK),
    has: (id) => read(CK).some(it => !isLot(it) && String(it.id) === String(id)),
    hasLot: (barcode) => read(CK).some(it => isLot(it) && String(it.barcode) === String(barcode)),
    qtyOf: (id) => {
      const it = read(CK).find(x => !isLot(x) && String(x.id) === String(id));
      return it ? it.qty : 0;
    },
    add: (id, qty = 1, name) => {
      const list = read(CK);
      const sid = String(id);
      const ex = list.find(x => !isLot(x) && String(x.id) === sid);
      if(ex) ex.qty = Number(ex.qty || 0) + Number(qty);
      else list.unshift({ kind:'product', id: sid, qty: Number(qty) });
      write(CK, list);
      L.toast(`«${name || 'Товар'}» додано в кошик`, 'success');
      L.cart._notify();
    },
    addLot: (barcode, prodId, name) => {
      const list = read(CK);
      const bc = String(barcode);
      if(list.find(x => isLot(x) && String(x.barcode) === bc)){
        L.toast('Цей лот вже у кошику'); return;
      }
      list.unshift({ kind:'lot', barcode: bc, prodId: String(prodId || ''), qty: 1 });
      write(CK, list);
      L.toast(`Лот ${bc} додано в кошик`, 'success');
      L.cart._notify();
    },
    set: (id, qty) => {
      let list = read(CK);
      const sid = String(id);
      if(qty <= 0){
        list = list.filter(x => !(!isLot(x) && String(x.id) === sid));
      } else {
        const ex = list.find(x => !isLot(x) && String(x.id) === sid);
        if(ex) ex.qty = Number(qty);
        else list.unshift({ kind:'product', id: sid, qty: Number(qty) });
      }
      write(CK, list);
      L.cart._notify();
    },
    removeLot: (barcode) => {
      const bc = String(barcode);
      const list = read(CK).filter(x => !(isLot(x) && String(x.barcode) === bc));
      write(CK, list); L.cart._notify();
    },
    remove: (id) => L.cart.set(id, 0),
    clear: () => { write(CK, []); L.cart._notify(); },
    count: () => read(CK).length,
    /* For products sold per kg, 1 cart unit = 1 mix-lot of average weight.
       So total kg / sum = qty × avgWeight × pricePerKg.
       For per-piece products (unit='шт'), 1 unit = 1 piece. */
    totalKg: () => {
      const products = L.getProducts ? L.getProducts() : (window.PRODUCTS || []);
      let kg = 0;
      for(const it of read(CK)){
        if(isLot(it)){
          const lot = L.lotByBarcode ? L.lotByBarcode(it.barcode) : null;
          if(lot && lot.weight) kg += Number(lot.weight);
          continue;
        }
        const p = products.find(pp => String(pp.id) === String(it.id));
        if(!p) continue;
        if(p.unit === 'шт') continue;            /* per-piece lots have no kg weight */
        kg += L.lotMultiplier(p) * Number(it.qty);
      }
      return Math.round(kg * 10) / 10;
    },
    totalUah: () => {
      const products = L.getProducts ? L.getProducts() : (window.PRODUCTS || []);
      let uah = 0;
      for(const it of read(CK)){
        if(isLot(it)){
          const lot = L.lotByBarcode ? L.lotByBarcode(it.barcode) : null;
          if(lot && lot.price_uah) uah += Number(lot.price_uah);
          continue;
        }
        const p = products.find(pp => String(pp.id) === String(it.id));
        if(!p) continue;
        const eur = p.priceEur ?? L.priceEurFor(p) ?? 0;
        const multiplier = L.lotMultiplier(p);
        uah += L.eurToUah(eur) * multiplier * Number(it.qty);
      }
      return Math.round(uah);
    },
    totalEur: () => {
      const products = L.getProducts ? L.getProducts() : (window.PRODUCTS || []);
      let eur = 0;
      for(const it of read(CK)){
        if(isLot(it)){
          const lot = L.lotByBarcode ? L.lotByBarcode(it.barcode) : null;
          if(lot && lot.price_uah && lot.eur_rate) eur += lot.price_uah / lot.eur_rate;
          continue;
        }
        const p = products.find(pp => String(pp.id) === String(it.id));
        if(!p) continue;
        const price = p.priceEur ?? L.priceEurFor(p) ?? 0;
        const multiplier = L.lotMultiplier(p);
        eur += price * multiplier * Number(it.qty);
      }
      return Math.round(eur * 100) / 100;
    },
    _notify: () => window.dispatchEvent(new CustomEvent('ltex:cart-changed', { detail: { count: read(CK).length } })),
  };
})();
