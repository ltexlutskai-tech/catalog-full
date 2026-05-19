/* L-TEX Smart Search
   Features:
   - Tokenization with normalization (lowercase, apostrophes, ё→е, и↔і, ї→і, latin ↔ cyrillic transliteration)
   - Synonyms map (clothes/shoes/seasons/genders/origins)
   - Slang & misspellings (футбол(ка), кросс(овки), труси, бра, тішотка, тішка, тіш, hoodie, etc.)
   - Token matching with optional fuzzy (Levenshtein) on tokens of length ≥ 5
   - Relevance scoring: exact name match > full token coverage > partial coverage > synonym only
*/
window.LTEX = window.LTEX || {};
(() => {
  const L = window.LTEX;

  /* ===== Normalization ===== */
  const FOLD = {
    'ё':'е','й':'и','ї':'і','і':'и','’':'\'','ʼ':'\'','`':'\'',
    'ы':'и','э':'е',
    /* Cyrillic → latin (basic) — used both ways via reversal */
  };
  const norm = (s) => {
    if(!s) return '';
    s = String(s).toLowerCase().trim();
    s = s.replace(/[ёйїіыэ’ʼ`]/g, ch => FOLD[ch] || ch);
    return s;
  };

  /* ===== Cyr ↔ Latin (rough, both-way friendly) ===== */
  const CYR2LAT_BASIC = {
    'а':'a','б':'b','в':'v','г':'g','ґ':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ь':'','ю':'yu','я':'ya','є':'ye'
  };
  const LAT2CYR_BASIC = (() => {
    /* reverse mapping for short syllables; not bijective so we keep simple */
    const map = {};
    for(const [c,l] of Object.entries(CYR2LAT_BASIC)){ if(l && !map[l]) map[l] = c; }
    return map;
  })();
  const transliterate = (s, dir = 'auto') => {
    s = norm(s);
    const isCyr = /[а-яёіїєґ]/i.test(s);
    if(dir === 'lat' || (dir === 'auto' && isCyr)){
      return s.split('').map(c => CYR2LAT_BASIC[c] !== undefined ? CYR2LAT_BASIC[c] : c).join('');
    } else if(dir === 'cyr' || (dir === 'auto' && !isCyr)){
      let out = ''; let i = 0;
      while(i < s.length){
        let matched = false;
        for(const len of [3,2,1]){
          const seg = s.slice(i, i+len);
          if(LAT2CYR_BASIC[seg]){ out += LAT2CYR_BASIC[seg]; i += len; matched = true; break; }
        }
        if(!matched){ out += s[i]; i++; }
      }
      return out;
    }
    return s;
  };

  /* ===== Synonyms map =====
     Each row: array of equivalent tokens (single words, without spaces)
     Multiple word phrases use stemming (first 4-5 letters).
     Stem comparison handles word forms (футболк-а, футболк-ою).
  */
  const SYN_GROUPS = [
    /* === TOPS === */
    ['футболк','майк','тенісн','тенисн','tshirt','tee','тішотк','тішк','топік','tshirts'],
    ['кофт','світшот','худі','hoodie','толстовк','свитшот','світщот','кенгур','реглан','sweatshirt'],
    ['светр','свитер','sweater','пуловер','джемпер','кардиган','пайт','knit','в\'язан','вязан'],
    ['блуз','рубашк','сорочк','shirt','блузк','рубаха','тунік'],
    ['жилет','vest','безрукавк','жилетк'],
    ['куртк','jacket','парк','анорак','бомбер','вітровк','штормовк','windbreaker','пуховик','піджак','blazer'],
    ['пальт','coat','тренч','шуб','півпальт','півпальто','пуховик-довг'],
    ['піжам','нічниц','pajama','pyjama','піжамн','nightgown','нічн-сорочк'],
    ['халат','кімон','robe','банн','купальн-халат'],

    /* === BOTTOMS === */
    ['джинс','denim','jean','jeans'],
    ['штан','брюк','pants','trouser','брючин','штанин','штаны','чінос','chinos'],
    ['шорт','short','берміуд','бермуд','shorts'],
    ['легінс','лосин','leggings','легинс','лосіна'],
    ['колготк','панчох','tights','чулок','чулки'],
    ['спідниц','юбк','skirt'],
    ['сукн','плат','dress','сарафан','платтячк','платтячко','платье'],
    ['комбінезон','overall','jumpsuit','полукомбі','полукомбінезон','напівкомбінезон','ромпер'],

    /* === UNDERWEAR === */
    ['труси','трусик','panties','боксер','стринг','трусы','білизн','underwear','бельё','спідн-бел'],
    ['ліфчик','бюстгальтер','лифчик','bra','бра','топ-бра','бюстье','bralette'],
    ['боді','body','bodysuit'],
    ['термобілизн','thermal','термо','термобельё','thermals'],

    /* === SOCKS === */
    ['шкарпетк','носк','socks','гольф','гольфики','подследн','подсл','следк','следки','носочк'],

    /* === FLEECE === */
    ['флісов','флис','fleece','флісовк','флиска','флеска','флешка-фліс'],

    /* === SHOES === */
    ['кросівк','кросовк','снікерс','sneakers','кеди','sneaker','кросс','кроссовк','кросовка','спортивн-взутт'],
    ['туфл','shoe','туфельк','лодочк','туфельки','pumps'],
    ['черевик','ботинк','boot','чобіт','чоботи','берц','boots','челсі','chelsea','угі','ugg'],
    ['сандал','босоніжк','sandal','босоножк','босонiжк','sandals'],
    ['тапочк','тапк','шльопанц','шлепанц','slipper','flip','тапочки','flipflop','flip-flop','капці','капец'],
    ['взутт','обув','footwear','shoes','взутн','обувь'],

    /* === ACCESSORIES === */
    ['сумк','bag','сумочк','клатч','шопер','tot','tote','рюкзак','backpack','ранец','ранц','саквояж','barsetk','барсетк','torba','борсетк'],
    ['ремен','belt','пасок','паск','ременя','пояс'],
    ['шапк','шарф','scarf','капелюх','берет','панам','beanie','beanies','cap','hat','кепк','бейсболк','baseball-cap','snapback','хустк','платок','бандан','бандана'],
    ['рукавиц','перчатк','glove','рукавичк','gloves','митенк','варежк'],
    ['окуляр','sunglas','glasses','sunglasses','очки'],
    ['біжутер','прикрас','jewel','jewelry','jewellery','браслет','ланцюжок','цепочк','сережк','серьг','каблучк','перстен','кільце','кольцо'],

    /* === SWIMWEAR === */
    ['купальник','swimsuit','плавк','swim','swimwear','бікіні','bikini','купальн','купаль'],

    /* === HOME / TEXTILE === */
    ['постільн','подушк','ковдр','простир','наволочк','покривал','пододіял','pillow','blanket','linen','постель','одеял','наволоч','простын','пододеяль'],
    ['рушник','полотенц','towel','towels','полотенце'],
    ['килим','rug','carpet','доріжк','коврик','ковёр','ковер'],
    ['скатерт','tablecloth','скатерть','серветк','салфетк','napkin'],
    ['штор','curtain','завіс','занавеск','tюль','tulle','тюль'],

    /* === TOYS === */
    ['іграшк','игрушк','toy','toys','плюш','plush','мягк-игрушк','м\'як-іграшк','м\'якаіграшк','soft-toy'],

    /* === COSMETICS === */
    ['косметик','cosmetic','cosmetics','помад','туш','рум\'ян','тіні','тушь','тени','румяна','лак-для-ніг','nail','помада','lipstick'],

    /* === MATERIALS / FABRIC === */
    ['бавовн','cotton','хлопок','хлопков','коттон','100cotton','100%cotton'],
    ['шкір','leather','кожа','кожан','leatherette','еко-шкір','екошкір','искож','genuine-leather'],
    ['замш','suede','велюр','velour'],
    ['вовн','шерсть','wool','woolen','шерстян'],
    ['льон','linen-fabric','лен','льняной','flax'],
    ['шовк','silk','шёлк','шелк','шелков'],
    ['кашемір','cashmere','кашемир'],
    ['синтетик','полієстер','polyester','poliester','нейлон','nylon','viscose','віскоз','вискоз','лайкр','спандекс','spandex','elastane','еластан'],

    /* === QUALITIES / GRADES (важливо для секонд-хенду) === */
    ['екстр','extra','лук','топ-сорт','топсорт','top-grade','top-quality','преміум','premium','premiumg','топ','клас-а','grade-a','a-grade','a-class','vip','він','wiн'],
    ['крем','cream','beigecreme','creamgrade'],
    ['1й','перш','first','sort1','first-sort','перший-сорт','перший','1сорт','onesort','firstgrade'],
    ['2й','друг','second','sort2','second-sort','другий-сорт','другий','2сорт','secondgrade'],
    ['сток','stock','стік','deadstock','dead-stock','new-stock','новостік','новий-сток'],
    ['мікс','mix','асорті','assorti','assorted','микс','коктейль'],
    ['оригінал','original','оригинал','originals','genuine','автентичн','authentic'],
    ['маловжит','маловжива','маловжитий','маловжите','малоношен','малоношене','малоношений','мало-ношен','хорош-стан','лайт-юс','light-used','gently-used'],
    ['секонд','second-hand','secondhand','секондхенд','секонд-хенд','sh','секон','б/у','бу','used'],

    /* === LOT / WHOLESALE / B2B SLANG === */
    ['опт','гурт','wholesale','оптом','гуртом','опт-партія','опт-партия','оптовик'],
    ['парті','batch','batches','lot','лот','лоти','лоты'],
    ['мішок','мешок','bag-bulk','sack','sacks','тюк','bale','bales','бель','куль'],
    ['кг','kg','килогр','kilogram','kilo','kilos'],

    /* === SEASONS === */
    ['зим','winter','зимов','winter-collection'],
    ['літ','лет','summer','літн','летн','літніх','летнего'],
    ['демісез','demi','весн','осінь','осен','spring','autumn','fall','перехідн','міжсезон','демисезон','демик'],
    ['всесезон','all-season','allseason','круглорічн','круглогодичн'],

    /* === GENDER / AUDIENCE === */
    ['жіноч','женск','women','womens','для-жінок','жіночий','жіночого','женский','женского','female','ladies','lady'],
    ['чоловіч','мужск','men','mens','чолов','для-чоловіків','чоловічий','мужской','male','gentleman','gents'],
    ['дитяч','детск','kids','child','дитин','дитя','baby','підлітк','подростк','toddler','infant','newborn','новонароджен','малюк','малыш','teen','teens','children'],
    ['доросл','adult','для-дорослих','для-взрослых','adults'],
    ['унісекс','unisex','мікс-стат','оба-стат'],

    /* === COUNTRIES (народні написання) === */
    ['англ','english','uk','британ','british','лондон','london','england','england-uk','велик-британ','great-britain'],
    ['нім','germany','german','deutschland','німеччин','германия','герман','germ'],
    ['канад','canada','canadian','canad'],
    ['польщ','poland','polska','polish','польша','польс'],
    ['шотланд','scotland','scottish','шотландск'],
    ['італ','italy','italian','italia','італьянс'],
    ['сша','usa','american','штат','штатів','штатов','америк','america','us'],
    ['франц','france','french','французск'],
    ['голланд','holland','netherlands','dutch','нідерланд'],
    ['швец','sweden','swedish','швед'],
    ['данія','denmark','danish','дан'],
    ['бельг','belgium','belgian'],

    /* === BRAND-LIKE / STYLE === */
    ['робоч','workwear','spec','спецодяг','спецовка','рабочая','роба','форма-робоч'],
    ['велик','plus-size','xxl','oversize','оверсайз','оверсайс','xxxl','plus','big-size','batal','батал'],
    ['брен','brand','фірмов','firmen','marka','брендов','firmenn'],
    ['спорт','sport','sports','sportswear','спортивн','sportwear'],
    ['вінтаж','vintage','ретро','retro','винтаж','old-school'],

    /* === STATES === */
    ['нов','new','новий','novyj','новые','свіж','свежи','свеж','fresh'],
    ['акці','sale','знижк','скидк','discount','распродаж','розпродаж'],
  ];

  /* Build stem → group lookup */
  const STEM_TO_GROUP = new Map();
  SYN_GROUPS.forEach((group, idx) => {
    for(const word of group){
      const stem = norm(word);
      STEM_TO_GROUP.set(stem, idx);
    }
  });

  /* Get list of stems in a phrase (cleaned) */
  const tokenize = (s) => norm(s)
    .replace(/[^a-z0-9а-яёіїєґ\-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  /* Find best stem (longest matching prefix from STEM_TO_GROUP keys) */
  const tokenStem = (token) => {
    /* Try direct match (length 4..token.length-1) */
    for(let len = Math.min(token.length, 9); len >= 3; len--){
      const stem = token.slice(0, len);
      if(STEM_TO_GROUP.has(stem)) return { stem, group: STEM_TO_GROUP.get(stem) };
    }
    return null;
  };

  /* Levenshtein (capped) */
  const lev = (a, b, max = 2) => {
    if(Math.abs(a.length - b.length) > max) return max + 1;
    if(a === b) return 0;
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, (_,i) => [i, ...Array(n).fill(0)]);
    for(let j = 0; j <= n; j++) dp[0][j] = j;
    for(let i = 1; i <= m; i++){
      let row_min = Infinity;
      for(let j = 1; j <= n; j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
        if(dp[i][j] < row_min) row_min = dp[i][j];
      }
      if(row_min > max) return max + 1;
    }
    return dp[m][n];
  };

  /* === Build searchable index for a product === */
  const buildHaystack = (p) => {
    const parts = [
      p.name, p.category, p.subcategory, p.topCat, p.subcat,
      p.brand, p.sort, p.season, p.audience, p.country,
      p.id, String(p.id).replace(/^0+/, ''),
    ].filter(Boolean).join(' ');
    return norm(parts);
  };

  const indexProduct = (p) => {
    if(p._searchIndex) return p._searchIndex;
    const hay = buildHaystack(p);
    const tokens = tokenize(hay);
    const stems = new Set();
    const groups = new Set();
    for(const t of tokens){
      const s = tokenStem(t);
      if(s){ stems.add(s.stem); groups.add(s.group); }
    }
    p._searchIndex = { hay, tokens, stems, groups, hayLat: transliterate(hay, 'lat') };
    return p._searchIndex;
  };

  /* === Match query against single product, returns 0..1 score (or 0 if no match) === */
  const scoreProduct = (p, queryTokens, queryGroups, rawQuery) => {
    const idx = indexProduct(p);
    if(queryTokens.length === 0) return 0;

    /* 1) Exact substring of full query in product name -> +0.6 */
    let score = 0;
    const nameLower = norm(p.name);
    if(rawQuery && nameLower.includes(rawQuery)){
      score += 0.6;
      /* Bonus if name starts with query */
      if(nameLower.startsWith(rawQuery)) score += 0.2;
    }

    /* 2) Per-token coverage */
    let matched = 0;
    for(const qt of queryTokens){
      let hit = false;
      /* Direct substring in haystack */
      if(idx.hay.includes(qt) || idx.hayLat.includes(qt)){ hit = true; }
      else {
        /* Stem match via synonym groups */
        const qs = tokenStem(qt);
        if(qs && idx.groups.has(qs.group)){ hit = true; }
        /* Fuzzy as last resort */
        else if(qt.length >= 5){
          for(const t of idx.tokens){
            if(Math.abs(t.length - qt.length) <= 2 && lev(t, qt, 2) <= 2){ hit = true; break; }
          }
        }
      }
      if(hit) matched++;
    }
    const coverage = matched / queryTokens.length;
    score += coverage * 0.6;

    /* 3) Synonym group overlap bonus */
    if(queryGroups.size && idx.groups.size){
      let overlap = 0;
      for(const g of queryGroups) if(idx.groups.has(g)) overlap++;
      score += (overlap / queryGroups.size) * 0.2;
    }

    /* 4) ID exact match */
    if(rawQuery && (String(p.id) === rawQuery || String(p.id).replace(/^0+/, '') === rawQuery)){
      score += 1.0;
    }

    return score;
  };

  /* === Public API === */
  L.search = (query, opts = {}) => {
    const products = (opts.products) || (L.getProducts ? L.getProducts() : (window.PRODUCTS || []));
    const limit = opts.limit || products.length;
    const minScore = opts.minScore ?? 0.3;

    const raw = norm(query);
    if(!raw) return products.slice(0, limit).map(p => ({ p, score: 0 }));

    const tokens = tokenize(raw);
    const groups = new Set();
    for(const t of tokens){
      const s = tokenStem(t);
      if(s) groups.add(s.group);
    }
    /* Latin form of tokens for cross-script matching */
    const tokensLat = tokens.map(t => transliterate(t, 'lat'));
    const allTokens = [...new Set([...tokens, ...tokensLat])];

    const scored = [];
    for(const p of products){
      const s = scoreProduct(p, allTokens, groups, raw);
      if(s >= minScore) scored.push({ p, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  };

  /* simple boolean predicate */
  L.matches = (p, query) => {
    if(!query) return true;
    const r = L.search(query, { products: [p], minScore: 0.4 });
    return r.length > 0;
  };

  /* expose helpers for debugging */
  L._search = { norm, tokenize, tokenStem, lev, transliterate, SYN_GROUPS, STEM_TO_GROUP };
})();
