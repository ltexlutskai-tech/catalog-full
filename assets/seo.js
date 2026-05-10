/* L-TEX SEO helpers
   Inserts structured data (Schema.org JSON-LD) and Open Graph / Twitter Card
   meta tags into <head>. Designed to run after products data has loaded.

   Usage on each page:
     LTEX.SEO.setMeta({ title, description, image, type, url });
     LTEX.SEO.setBreadcrumbs([{ name: 'Головна', url: '/' }, ...]);
     LTEX.SEO.setProduct(product);          // product page
     LTEX.SEO.setItemList(products, name);  // catalog / lots / wishlist
     LTEX.SEO.setOrganization();            // run once globally (auto-called)
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;
  const SEO = L.SEO = {};

  /* === Helpers === */
  function ensureMeta(attr, name){
    let el = document.head.querySelector(`meta[${attr}="${name}"]`);
    if(!el){
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    return el;
  }
  function setMetaContent(attr, name, content){
    if(!content) return;
    ensureMeta(attr, name).setAttribute('content', content);
  }
  function ensureLink(rel){
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if(!el){
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    return el;
  }
  function setJsonLd(id, data){
    let el = document.getElementById(id);
    if(!el){
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  /* === Public API === */

  SEO.setMeta = ({ title, description, image, type, url, keywords } = {}) => {
    if(title){
      document.title = title;
      setMetaContent('property', 'og:title', title);
      setMetaContent('name', 'twitter:title', title);
    }
    if(description){
      setMetaContent('name', 'description', description);
      setMetaContent('property', 'og:description', description);
      setMetaContent('name', 'twitter:description', description);
    }
    if(keywords){
      setMetaContent('name', 'keywords', keywords);
    }
    const absImg = image ? L.absUrl(image) : `${L.CONFIG.SITE_URL}/og-default.jpg`;
    setMetaContent('property', 'og:image', absImg);
    setMetaContent('name', 'twitter:image', absImg);

    const u = url ? L.absUrl(url) : L.absUrl(location.pathname + location.search);
    setMetaContent('property', 'og:url', u);
    ensureLink('canonical').setAttribute('href', u);

    setMetaContent('property', 'og:type', type || 'website');
    setMetaContent('property', 'og:site_name', L.CONFIG.BRAND);
    setMetaContent('property', 'og:locale', 'uk_UA');
    setMetaContent('name', 'twitter:card', 'summary_large_image');
  };

  SEO.setBreadcrumbs = (items) => {
    if(!items || !items.length) return;
    setJsonLd('ld-breadcrumbs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: L.absUrl(it.url),
      })),
    });
  };

  SEO.setProduct = (p) => {
    if(!p) return;
    const img = (p.images && p.images[0]) || p.image;
    const lots = L.lotsForProduct ? L.lotsForProduct(p.id) : [];
    const inStock = p.inStock || lots.some(l => !l.reserved);
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      sku: String(p.id).padStart(4, '0'),
      brand: { '@type': 'Brand', name: p.brand || L.CONFIG.BRAND },
      description: (p.detailRaw || p.name).slice(0, 500),
      image: img ? L.absUrl(img) : undefined,
      category: p.subcat || p.category,
      url: L.absUrl(L.productHref(p.id)),
    };
    if(p.priceUah){
      data.offers = {
        '@type': 'Offer',
        price: p.priceUah,
        priceCurrency: 'UAH',
        availability: `https://schema.org/${inStock ? 'InStock' : 'PreOrder'}`,
        priceValidUntil: new Date(Date.now() + 30 * 86400e3).toISOString().slice(0, 10),
        seller: { '@type': 'Organization', name: L.CONFIG.BRAND },
      };
    }
    setJsonLd('ld-product', data);
  };

  SEO.setItemList = (items, name) => {
    if(!items || !items.length) return;
    const list = items.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: L.absUrl(L.productHref(p.id)),
      name: p.name,
    }));
    setJsonLd('ld-itemlist', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: name || 'Каталог товарів',
      numberOfItems: items.length,
      itemListElement: list,
    });
  };

  SEO.setOrganization = () => {
    setJsonLd('ld-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: L.CONFIG.BRAND,
      url: L.CONFIG.SITE_URL,
      logo: L.CONFIG.SITE_URL + '/og-default.jpg',
      address: {
        '@type': 'PostalAddress',
        streetAddress: L.CONFIG.ADDRESS,
        addressCountry: 'UA',
      },
      contactPoint: L.CONFIG.PHONES.map(p => ({
        '@type': 'ContactPoint',
        telephone: p.tel,
        contactType: 'sales',
        areaServed: 'UA',
        availableLanguage: ['uk', 'ru'],
      })),
      email: L.CONFIG.EMAIL,
      sameAs: [L.CONFIG.TELEGRAM],
    });
  };

  /* Auto-run organization JSON-LD on every page that loads this script. */
  if(document.readyState !== 'loading') SEO.setOrganization();
  else document.addEventListener('DOMContentLoaded', SEO.setOrganization);
})();
