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

  /* === CART === */
  const CK = 'ltex-cart';
  L.cart = {
    items: () => read(CK),
    has: (id) => read(CK).some(it => String(it.id) === String(id)),
    qtyOf: (id) => {
      const it = read(CK).find(x => String(x.id) === String(id));
      return it ? it.qty : 0;
    },
    add: (id, qty = 1, name) => {
      const list = read(CK);
      const sid = String(id);
      const ex = list.find(x => String(x.id) === sid);
      if(ex) ex.qty = Number(ex.qty || 0) + Number(qty);
      else list.unshift({ id: sid, qty: Number(qty) });
      write(CK, list);
      L.toast(`«${name || 'Товар'}» додано в кошик`, 'success');
      L.cart._notify();
    },
    set: (id, qty) => {
      let list = read(CK);
      const sid = String(id);
      if(qty <= 0){
        list = list.filter(x => String(x.id) !== sid);
      } else {
        const ex = list.find(x => String(x.id) === sid);
        if(ex) ex.qty = Number(qty);
        else list.unshift({ id: sid, qty: Number(qty) });
      }
      write(CK, list);
      L.cart._notify();
    },
    remove: (id) => L.cart.set(id, 0),
    clear: () => { write(CK, []); L.cart._notify(); },
    count: () => read(CK).length,
    totalKg: () => {
      const products = L.getProducts ? L.getProducts() : (window.PRODUCTS || []);
      let kg = 0;
      for(const it of read(CK)){
        const p = products.find(pp => String(pp.id) === String(it.id));
        if(!p) continue;
        if(p.unit === 'кг') kg += Number(it.qty);
        else {
          const w = parseFloat(String(p.weight).replace(',', '.')) || 0;
          kg += w * Number(it.qty);
        }
      }
      return Math.round(kg * 10) / 10;
    },
    totalEur: () => {
      const products = L.getProducts ? L.getProducts() : (window.PRODUCTS || []);
      let eur = 0;
      for(const it of read(CK)){
        const p = products.find(pp => String(pp.id) === String(it.id));
        if(!p) continue;
        const price = p.priceEur ?? L.priceEurFor(p) ?? 0;
        if(p.unit === 'кг'){
          eur += price * Number(it.qty);
        } else {
          eur += price * Number(it.qty);
        }
      }
      return Math.round(eur * 100) / 100;
    },
    _notify: () => window.dispatchEvent(new CustomEvent('ltex:cart-changed', { detail: { count: read(CK).length } })),
  };
})();
