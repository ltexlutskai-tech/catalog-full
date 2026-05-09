import pandas as pd
import re
import json
import sys
import io

# Force UTF-8 stdout on Windows (cp1251 default crashes on cyrillic + emoji)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# ===== CATEGORY/ATTRIBUTE DETECTION =====
# Підкатегорії МАЮТЬ точно відповідати SUBCATS в catalog.html!
# SUBCATS (ground truth):
# Одяг: Вітровки та штормовки | Джинси | Колготки та легінси | Комбінезони | Костюми
#        Кофти флісові | Купальники | Куртки та пальта | Майки та топи | Нижня білизна
#        Одяг мікс | Піджаки та жилети | Робочий одяг | Светри та кардигани
#        Сорочки та блузи | Спортивний одяг | Спідниці та плаття | Футболки
#        Халати та піжами | Худі та світшоти | Шкарпетки | Шорти | Штани та брюки
# Взуття: Взуття гумове | Взуття мікс | Взуття робоче | Кросівки та кеди
#          Тапочки та шльопанці | Туфлі та босоніжки | Черевики та чоботи
# Аксесуари: Біжутерія | Сумки та рюкзаки | Шапки та головні убори
# Дім та побут: Килими та килимки | Побутові товари | Постільна білизна | Рушники | Товари для тварин
# Іграшки: М'які іграшки | Тверді іграшки
# Bric-a-Brac: Bric-a-Brac
# Косметика: Косметика декоративна

CATEGORY_MAP = [
    # ── Bric-a-Brac / AGD ──
    ('bric',             'Bric-a-Brac', 'Bric-a-Brac'),
    ('брік брак',        'Bric-a-Brac', 'Bric-a-Brac'),
    ('брік-брак',        'Bric-a-Brac', 'Bric-a-Brac'),
    ('брик брак',        'Bric-a-Brac', 'Bric-a-Brac'),
    ('брик-брак',        'Bric-a-Brac', 'Bric-a-Brac'),
    ('агд',              'Bric-a-Brac', 'Bric-a-Brac'),
    ('agd',              'Bric-a-Brac', 'Bric-a-Brac'),

    # ── Косметика ──
    ('косметик',         'Косметика', 'Косметика декоративна'),
    ('парфум',           'Косметика', 'Косметика декоративна'),

    # ── Іграшки ──
    # ВАЖЛИВО: м'які іграшки — до загального 'іграшк', інакше всі підуть в Тверді.
    # Дублюємо варіанти з обома типами апострофа ( ' = U+0027 і ' = U+2019) та без.
    ('плюшев',                   'Іграшки', "М'які іграшки"),
    ("м'які іграшк",              'Іграшки', "М'які іграшки"),
    ('м\u2019які іграшк',         'Іграшки', "М'які іграшки"),
    ('мякі іграшк',              'Іграшки', "М'які іграшки"),
    ("іграшки м'як",              'Іграшки', "М'які іграшки"),
    ('іграшки м\u2019як',         'Іграшки', "М'які іграшки"),
    ('іграшки мяк',              'Іграшки', "М'які іграшки"),
    ("м'яч",                      'Іграшки', 'Тверді іграшки'),
    ('м\u2019яч',                 'Іграшки', 'Тверді іграшки'),
    ('іграшк',                   'Іграшки', 'Тверді іграшки'),
    ("м'як",                      'Іграшки', "М'які іграшки"),
    ('м\u2019як',                 'Іграшки', "М'які іграшки"),

    # ── Взуття ──
    ('взуття гумов',     'Взуття', 'Взуття гумове'),
    ('взуття робоч',     'Взуття', 'Взуття робоче'),
    ('взуття спорт',     'Взуття', 'Кросівки та кеди'),
    ('кросівк',          'Взуття', 'Кросівки та кеди'),
    ('кед',              'Взуття', 'Кросівки та кеди'),
    ('снікер',           'Взуття', 'Кросівки та кеди'),
    ('sneaker',          'Взуття', 'Кросівки та кеди'),
    ('тапочк',           'Взуття', 'Тапочки та шльопанці'),
    ('шльопанц',         'Взуття', 'Тапочки та шльопанці'),
    ('крокс',            'Взуття', 'Тапочки та шльопанці'),
    ('сабо',             'Взуття', 'Тапочки та шльопанці'),
    ('туфл',             'Взуття', 'Туфлі та босоніжки'),
    ('босоніжк',         'Взуття', 'Туфлі та босоніжки'),
    ('сандал',           'Взуття', 'Туфлі та босоніжки'),
    ('черевик',          'Взуття', 'Черевики та чоботи'),
    ('чобот',            'Взуття', 'Черевики та чоботи'),
    ('угги',             'Взуття', 'Черевики та чоботи'),
    ('уггі',             'Взуття', 'Черевики та чоботи'),
    ('дутик',            'Взуття', 'Черевики та чоботи'),
    ('гумов',            'Взуття', 'Взуття гумове'),
    ('взутт',            'Взуття', 'Взуття мікс'),

    # ── Аксесуари ──
    ('шапк',             'Аксесуари', 'Шапки та головні убори'),
    ('кепк',             'Аксесуари', 'Шапки та головні убори'),
    ('бейсболк',         'Аксесуари', 'Шапки та головні убори'),
    ('панам',            'Аксесуари', 'Шапки та головні убори'),
    ('берет',            'Аксесуари', 'Шапки та головні убори'),
    ('капелюх',          'Аксесуари', 'Шапки та головні убори'),
    ('рукавичк',         'Аксесуари', 'Шапки та головні убори'),  # немає окремої підкат
    ('рукавиц',          'Аксесуари', 'Шапки та головні убори'),
    ('шарф',             'Аксесуари', 'Шапки та головні убори'),
    ('хустк',            'Аксесуари', 'Шапки та головні убори'),
    ('ремен',            'Аксесуари', 'Сумки та рюкзаки'),
    ('ремін',            'Аксесуари', 'Сумки та рюкзаки'),
    ('гаманец',          'Аксесуари', 'Сумки та рюкзаки'),
    ('сумк',             'Аксесуари', 'Сумки та рюкзаки'),
    ('рюкзак',           'Аксесуари', 'Сумки та рюкзаки'),
    ('біжутер',          'Аксесуари', 'Біжутерія'),
    ('прикрас',          'Аксесуари', 'Біжутерія'),

    # ── Дім та побут ──
    ('постіл',           'Дім та побут', 'Постільна білизна'),
    ('наволочк',         'Дім та побут', 'Постільна білизна'),
    ('наматрасник',      'Дім та побут', 'Постільна білизна'),
    ('рушник',           'Дім та побут', 'Рушники'),
    ('ковдр',            'Дім та побут', 'Побутові товари'),
    ('плед',             'Дім та побут', 'Побутові товари'),
    ('подушк',           'Дім та побут', 'Побутові товари'),
    ('тюль',             'Дім та побут', 'Побутові товари'),
    ('штор',             'Дім та побут', 'Побутові товари'),
    ('килим',            'Дім та побут', 'Килими та килимки'),
    ('коврик',           'Дім та побут', 'Килими та килимки'),
    ('спальний мішок',   'Дім та побут', 'Побутові товари'),
    ('спальні мішк',     'Дім та побут', 'Побутові товари'),
    ('пряж',             'Дім та побут', 'Побутові товари'),
    ('товари для тварин','Дім та побут', 'Товари для тварин'),
    ('товари для дом',   'Дім та побут', 'Побутові товари'),
    ('товари для офіс',  'Дім та побут', 'Побутові товари'),
    ('побутова технік',  'Дім та побут', 'Побутові товари'),

    # ── Одяг — ВАЖЛИВО: порядок від специфічного до загального ──

    # Шкарпетки та колготки
    ('шкарпетк',         'Одяг', 'Шкарпетки'),
    ('колготк',          'Одяг', 'Колготки та легінси'),
    ('лосін',            'Одяг', 'Колготки та легінси'),
    ('лосин',            'Одяг', 'Колготки та легінси'),
    ('леггінс',          'Одяг', 'Колготки та легінси'),
    ('капрі',            'Одяг', 'Колготки та легінси'),

    # Робочий одяг (ОДЯГ, НЕ ВЗУТТЯ!)
    ('робочий одяг',     'Одяг', 'Робочий одяг'),
    ('одяг робочий',     'Одяг', 'Робочий одяг'),
    ('медичний одяг',    'Одяг', 'Робочий одяг'),
    ('військовий одяг',  'Одяг', 'Робочий одяг'),
    ('одяг для мото',    'Одяг', 'Робочий одяг'),
    ('мотоцикл',         'Одяг', 'Робочий одяг'),

    # Лижний/спортивний верхній (перед 'куртк')
    ('лижний одяг',      'Одяг', 'Куртки та пальта'),
    ('лижна',            'Одяг', 'Куртки та пальта'),
    ('дощовик',          'Одяг', 'Вітровки та штормовки'),
    ('вітровк',          'Одяг', 'Вітровки та штормовки'),
    ('штормовк',         'Одяг', 'Вітровки та штормовки'),
    ('gore-tex',         'Одяг', 'Вітровки та штормовки'),
    ('goretex',          'Одяг', 'Вітровки та штормовки'),
    ('gore tex',         'Одяг', 'Вітровки та штормовки'),
    ('анорак',           'Одяг', 'Вітровки та штормовки'),
    ('куртк',            'Одяг', 'Куртки та пальта'),
    ('пуховик',          'Одяг', 'Куртки та пальта'),
    ('пальто',           'Одяг', 'Куртки та пальта'),
    ('тренч',            'Одяг', 'Куртки та пальта'),

    # Флісовий одяг та жилетки (перед загальним 'кофт')
    ('флісов',           'Одяг', 'Кофти флісові'),
    ('фліс',             'Одяг', 'Кофти флісові'),
    ('fleece',           'Одяг', 'Кофти флісові'),
    ('жилетк',           'Одяг', 'Піджаки та жилети'),
    ('жилет',            'Одяг', 'Піджаки та жилети'),

    # Худі та світшоти (перед 'кофт')
    ('худі',             'Одяг', 'Худі та світшоти'),
    ('капюшон',          'Одяг', 'Худі та світшоти'),
    ('світшот',          'Одяг', 'Худі та світшоти'),
    ('толстовк',         'Одяг', 'Худі та світшоти'),
    ('кофт',             'Одяг', 'Кофти флісові'),

    # Светри
    ('светр',            'Одяг', 'Светри та кардигани'),
    ('кардиган',         'Одяг', 'Светри та кардигани'),
    ('джемпер',          'Одяг', 'Светри та кардигани'),

    # Футболки та майки
    ('гавайк',           'Одяг', 'Футболки'),
    ('футболк',          'Одяг', 'Футболки'),
    ('майк',             'Одяг', 'Майки та топи'),
    ('топ ',             'Одяг', 'Майки та топи'),
    ('поло',             'Одяг', 'Футболки'),

    # Сорочки
    ('сорочк',           'Одяг', 'Сорочки та блузи'),
    ('блузк',            'Одяг', 'Сорочки та блузи'),
    ('блуз',             'Одяг', 'Сорочки та блузи'),

    # Штани
    ('джинс',            'Одяг', 'Джинси'),
    ('шорт',             'Одяг', 'Шорти'),
    ('штан',             'Одяг', 'Штани та брюки'),
    ('брюк',             'Одяг', 'Штани та брюки'),
    ('бриджі',           'Одяг', 'Штани та брюки'),

    # Піджаки
    ('піджак',           'Одяг', 'Піджаки та жилети'),
    ('жакет',            'Одяг', 'Піджаки та жилети'),
    ('блейзер',          'Одяг', 'Піджаки та жилети'),
    ('костюм',           'Одяг', 'Костюми'),

    # Спідниці та сукні
    ('спідниц',          'Одяг', 'Спідниці та плаття'),
    ('сарафан',          'Одяг', 'Спідниці та плаття'),
    ('платт',            'Одяг', 'Спідниці та плаття'),
    ('плаття',           'Одяг', 'Спідниці та плаття'),
    ('сукн',             'Одяг', 'Спідниці та плаття'),

    # Комбінезони
    ('комбінезон',       'Одяг', 'Комбінезони'),
    ('кігурум',          'Одяг', 'Комбінезони'),

    # Купальники
    ('купальник',        'Одяг', 'Купальники'),
    ('купальн',          'Одяг', 'Купальники'),

    # Нічний одяг
    ('піжам',            'Одяг', 'Халати та піжами'),
    ('нічний',           'Одяг', 'Халати та піжами'),
    ('халат',            'Одяг', 'Халати та піжами'),

    # Термобілизна → спортивний одяг (немає окремої підкат)
    ('термо',            'Одяг', 'Спортивний одяг'),

    # Нижня білизна
    ('білизн',           'Одяг', 'Нижня білизна'),
    ('нижн',             'Одяг', 'Нижня білизна'),
    ('бодік',            'Одяг', 'Нижня білизна'),
    ('бюстгалтер',       'Одяг', 'Нижня білизна'),

    # Спортивний одяг (загальне — перед 'одяг мікс')
    ('спорт',            'Одяг', 'Спортивний одяг'),
]

# ── Підкатегорії які є в catalog.html SUBCATS (для валідації) ──
VALID_SUBCATS = {
    'Одяг': ['Вітровки та штормовки','Джинси','Колготки та легінси','Комбінезони',
              'Костюми','Кофти флісові','Купальники','Куртки та пальта','Майки та топи',
              'Нижня білизна','Одяг мікс','Піджаки та жилети','Робочий одяг',
              'Светри та кардигани','Сорочки та блузи','Спортивний одяг',
              'Спідниці та плаття','Футболки','Халати та піжами','Худі та світшоти',
              'Шкарпетки','Шорти','Штани та брюки'],
    'Взуття': ['Взуття гумове','Взуття мікс','Взуття робоче','Кросівки та кеди',
               'Тапочки та шльопанці','Туфлі та босоніжки','Черевики та чоботи'],
    'Аксесуари': ['Біжутерія','Сумки та рюкзаки','Шапки та головні убори'],
    'Дім та побут': ['Килими та килимки','Побутові товари','Постільна білизна',
                     'Рушники','Товари для тварин'],
    'Іграшки': ["М'які іграшки",'Тверді іграшки'],
    'Bric-a-Brac': ['Bric-a-Brac'],
    'Косметика': ['Косметика декоративна'],
}

SORT_MAP = [
    ('екстра', 'Екстра'), ('крем', 'Крем'),
    ('1-й сорт', '1й сорт'), ('1й сорт', '1й сорт'), ('1 сорт', '1й сорт'),
    ('2-й сорт', '2й сорт'), ('2й сорт', '2й сорт'), ('2 сорт', '2й сорт'),
    ('сток', 'Сток'), ('мікс', 'Мікс'),
]

SEASON_MAP = [
    ('демісезон', 'Демісезон'), ('зима', 'Зима'), ('зимов', 'Зима'),
    ('літо', 'Літо'), ('літн', 'Літо'), ('всесезон', 'Всесезонне'),
]

AUDIENCE_MAP = [
    ('жіноч', 'Жіноче'), ('жін.', 'Жіноче'),
    ('чоловіч', 'Чоловіче'), ('чол.', 'Чоловіче'),
    ('дитяч', 'Дитяче'), ('підлітк', 'Дитяче'), ('хлопч', 'Дитяче'), ('дівч', 'Дитяче'),
    ('дорослі', 'Дорослі'),
]

COUNTRY_MAP = [
    ('англ', 'Англія'), ('uk ', 'Англія'),
    ('німеч', 'Німеччина'), ('герман', 'Німеччина'),
    ('польськ', 'Польща'), ('польщ', 'Польща'),
    ('канад', 'Канада'),
    ('італ', 'Італія'),
    ('шотланд', 'Шотландія'),
]

BRAND_LIST = ['nike', 'adidas', 'puma', 'zara', 'h&m', 'primark', 'next', 'marks & spencer',
              'george', 'f&f', 'tu ', 'matalan', 'livergy', 'esmara', 'crivit', 'lupilu',
              'pepperts', 'tchibo', 'c&a', 'gap', 'levis', 'tommy', 'diesel', 'calvin klein',
              'ralph lauren', 'guess']

def detect_attrs(name_lower):
    category, subcategory = 'Одяг', 'Одяг мікс'
    for kw, cat, sub in CATEGORY_MAP:
        if kw in name_lower:
            category, subcategory = cat, sub
            break
    sort_val = 'Мікс'
    for kw, val in SORT_MAP:
        if kw in name_lower:
            sort_val = val
            break
    season = 'Всесезонне'
    for kw, val in SEASON_MAP:
        if kw in name_lower:
            season = val
            break
    audience = 'Мікс'
    for kw, val in AUDIENCE_MAP:
        if kw in name_lower:
            audience = val
            break
    country = ''
    for kw, val in COUNTRY_MAP:
        if kw in name_lower:
            country = val
            break
    brand = ''
    for b in BRAND_LIST:
        if b in name_lower:
            brand = b.title()
            break
    return category, subcategory, sort_val, season, audience, country, brand

def js_str(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    # Escape string for JS single-quoted string
    v = str(v)
    v = v.replace('\\', '\\\\')
    v = v.replace("'", "\\u2019")
    v = v.replace('\n', '\\n')
    v = v.replace('\r', '')
    return f"'{v}'"

# ===== PARSE FILE 1 =====
import glob, os, sys

BASE_DIR = r'D:\LTEX каталог'

# Автопошук файлів за маскою (щоб не змінювати шлях щодня)
prays_files = sorted(glob.glob(os.path.join(BASE_DIR, 'Прайс*.xlsx')))
mishky_files = sorted(glob.glob(os.path.join(BASE_DIR, 'Список конкретних мішків*.xlsx')))

if not prays_files:
    sys.exit(f'❌ Не знайдено файл Прайс*.xlsx в папці {BASE_DIR}')
if not mishky_files:
    sys.exit(f'❌ Не знайдено файл Список конкретних мішків*.xlsx в папці {BASE_DIR}')

FILE1 = prays_files[-1]   # беремо найновіший
FILE2 = mishky_files[-1]

sht_files = sorted(glob.glob(os.path.join(BASE_DIR, 'Одиниці*ШТ*.xlsx')) +
                    glob.glob(os.path.join(BASE_DIR, 'Одиниці*шт*.xlsx')))
kg_files  = sorted(glob.glob(os.path.join(BASE_DIR, 'Одиниці*КГ*.xlsx')) +
                    glob.glob(os.path.join(BASE_DIR, 'Одиниці*кг*.xlsx')))

FILE_SHT = sht_files[-1] if sht_files else None
FILE_KG  = kg_files[-1]  if kg_files  else None

print(f'📂 Файл 1: {os.path.basename(FILE1)}')
print(f'📂 Файл 2: {os.path.basename(FILE2)}')
if FILE_SHT:
    print(f'📂 Файл ШТ: {os.path.basename(FILE_SHT)}')
else:
    print(f'⚠️  Файл ШТ (Одиниці*ШТ*.xlsx) не знайдено')
if FILE_KG:
    print(f'📂 Файл КГ: {os.path.basename(FILE_KG)}')
else:
    print(f'⚠️  Файл КГ (Одиниці*КГ*.xlsx) не знайдено')

df1 = pd.read_excel(FILE1, header=None)

# Завантажуємо одиниці виміру з двох файлів (ШТ і КГ)
def load_unit_ids(filepath):
    ids = set()
    if not filepath:
        return ids
    df = pd.read_excel(filepath, header=None)
    for i in range(1, len(df)):
        val = str(df.iloc[i, 1]) if pd.notna(df.iloc[i, 1]) else ''
        m = re.search(r'\((\d{1,4})\)', val)
        if m:
            ids.add(m.group(1).zfill(4))
    return ids

sht_ids = load_unit_ids(FILE_SHT)
kg_ids  = load_unit_ids(FILE_KG)

def get_unit_from_map(prod_id, fallback='кг'):
    if prod_id in sht_ids:
        return 'шт'
    if prod_id in kg_ids:
        return 'кг'
    return fallback

print(f'  ШТ: {len(sht_ids)} позицій | КГ: {len(kg_ids)} позицій')
df1 = df1.iloc[1:]

products = []
skipped_f1 = 0
for _, row in df1.iterrows():
    nom = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
    if not nom or nom == 'nan':
        continue

    id_match = re.search(r'\((\d{1,4})\)', nom)
    if not id_match:
        skipped_f1 += 1
        continue

    prod_id = id_match.group(1).zfill(4)
    # Назва — все що до (ID), не ріжемо по комі
    name = re.sub(r'\s*\(\d{1,4}\).*$', '', nom).strip().rstrip(', ').strip()

    # YouTube, вага та одиниця — з частин після (ID)
    after_id = re.sub(r'^.*?\(\d{1,4}\)', '', nom)
    parts_after = [p.strip() for p in after_id.split(',')]

    youtube = ''
    weight = ''
    unit_f1 = 'кг'
    for part in parts_after:
        p = part.strip()
        if 'youtube.com' in p or 'youtu.be' in p:
            youtube = p
        elif p.lower() == 'шт':
            unit_f1 = 'шт'
        elif p.lower() == 'кг':
            unit_f1 = 'кг'
        elif re.match(r'^[\d][\d\-\.]*$', p) and not weight:
            weight = p

    price_raw = row.iloc[2]
    akciya_raw = row.iloc[3]
    qty_raw = row.iloc[4]

    price = round(float(price_raw), 2) if pd.notna(price_raw) else None
    akciya = round(float(akciya_raw), 2) if pd.notna(akciya_raw) else None
    qty_stock = int(qty_raw) if pd.notna(qty_raw) else None

    if price is None and akciya is None and youtube == '':
        skipped_f1 += 1
        continue

    name_lower = name.lower()
    category, subcategory, sort_val, season, audience, country, brand = detect_attrs(name_lower)

    products.append({
        'id': prod_id, 'name': name,
        'category': category, 'subcategory': subcategory,
        'brand': brand, 'sort': sort_val, 'season': season,
        'audience': audience, 'country': country,
        'unit': get_unit_from_map(prod_id, unit_f1), 'weight': weight,
        'price': price, 'akciya': akciya,
        'youtube': youtube, 'qty_stock': qty_stock,
    })

print(f"[FILE1] Products: {len(products)}, skipped: {skipped_f1}")

# ===== PARSE FILE 2 =====
df2 = pd.read_excel(FILE2, header=None)
df2 = df2.iloc[1:]

# Перевіряємо структуру: є колонка "Статус" чи ні
headers_row0 = list(pd.read_excel(FILE2, header=None).iloc[0].astype(str))
has_status = 'Статус' in headers_row0
if has_status:
    status_col = headers_row0.index('Статус')
    df2_avail = df2[df2.iloc[:, status_col] == 'Наявний']
    print(f"  Колонка Статус знайдена, фільтр 'Наявний': {len(df2_avail)} рядків")
else:
    df2_avail = df2
    print(f"  Колонки Статус немає — беремо всі {len(df2_avail)} рядків")

# Зміщення колонок залежно від структури файлу
# Стара: [G]Бронь [H]Статус [I]Ціна_продажу [J]Акційна [K]Курс
# Нова:  [G]Бронь [H]Акційна [I]Ціна_продажу [J]Курс
COL_AKCIYA = 9 if has_status else 7
COL_PRICE  = 8 if has_status else 8
COL_EUR    = 10 if has_status else 9

# Build product lookup from File 1
prod_by_id = {p['id']: p for p in products}

lots_data = {}
barcodes_seen = set()
dup_barcodes = []
total_lots = 0
reserved_count = 0

for _, row in df2_avail.iterrows():
    nom = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
    if not nom or nom == 'nan':
        continue

    id_match = re.search(r'\((\d{1,4})\)', nom)
    if not id_match:
        continue

    prod_id = id_match.group(1).zfill(4)
    name_part = nom.split(',')[0].strip()
    prod_name = re.sub(r'\s*\(\d+\)\s*$', '', name_part).strip()

    weight_raw = row.iloc[2]
    weight = float(weight_raw) if pd.notna(weight_raw) else 0.0

    barcode_raw = row.iloc[3]
    if pd.notna(barcode_raw):
        try:
            barcode = str(int(float(barcode_raw)))
        except (ValueError, TypeError):
            barcode = str(barcode_raw).strip()
    else:
        barcode = ''

    youtube_raw = str(row.iloc[4]).strip() if pd.notna(row.iloc[4]) else ''
    youtube_url = youtube_raw if ('youtube.com' in youtube_raw or 'youtu.be' in youtube_raw) else ''

    # Generate embed URL
    youtube_embed = ''
    if youtube_url:
        vid_match = re.search(r'youtu\.be/([a-zA-Z0-9_-]+)', youtube_url)
        if vid_match:
            youtube_embed = f"https://www.youtube.com/embed/{vid_match.group(1)}"
        else:
            vid_match2 = re.search(r'v=([a-zA-Z0-9_-]+)', youtube_url)
            if vid_match2:
                youtube_embed = f"https://www.youtube.com/embed/{vid_match2.group(1)}"

    desc_raw = str(row.iloc[5]).strip() if pd.notna(row.iloc[5]) else ''
    desc = desc_raw

    bron_raw = row.iloc[6]
    reserved = bool(pd.notna(bron_raw) and str(bron_raw).strip() != '')

    price_regular_raw = row.iloc[COL_PRICE]
    price_akciya_raw = row.iloc[COL_AKCIYA]
    eur_rate_raw = row.iloc[COL_EUR]

    price_regular_uah = round(float(price_regular_raw), 2) if pd.notna(price_regular_raw) else None
    price_akciya_uah = round(float(price_akciya_raw), 2) if pd.notna(price_akciya_raw) else None
    eur_rate = float(eur_rate_raw) if pd.notna(eur_rate_raw) else 51.5

    is_akciya = price_akciya_uah is not None
    price_uah = price_akciya_uah if is_akciya else price_regular_uah

    # Determine unit
    unit = 'кг'
    if 'Вага одиниці: -' in desc:
        unit = 'шт'

    # Extract qty
    qty = None
    qty_match = re.search(r'Кількість одиниць:\s*(\d+)', desc)
    if qty_match:
        qty = int(qty_match.group(1))

    # price_per_unit = price_uah / weight
    price_per_unit = None
    if price_uah and weight and weight > 0:
        price_per_unit = round(price_uah / weight / eur_rate, 2)

    # Check barcode uniqueness
    if barcode in barcodes_seen:
        dup_barcodes.append(barcode)
    barcodes_seen.add(barcode)

    if reserved:
        reserved_count += 1

    lot_obj = {
        'barcode': barcode,
        'weight': weight,
        'reserved': reserved,
        'eur_rate': eur_rate,
        'price_regular_uah': price_regular_uah,
        'price_akciya_uah': price_akciya_uah,
        'price_uah': price_uah,
        'price_per_unit': price_per_unit,
        'price_per_kg': price_per_unit,
        'is_akciya': is_akciya,
        'unit': unit,
        'qty': qty,
        'youtube': youtube_url,
        'youtube_embed': youtube_embed,
        'desc': desc,
        'prodId': prod_id,
        'prodName': prod_name,
    }

    if prod_id not in lots_data:
        # Get product info from File 1 if available
        p = prod_by_id.get(prod_id, {})
        name_lower = prod_name.lower()
        category, subcategory, sort_val, season, audience, country, brand = detect_attrs(name_lower)

        lots_data[prod_id] = {
            'id': prod_id,
            'name': p.get('name', prod_name),
            # ЗАВЖДИ перераховуємо категорію/підкатегорію з назви — не зберігаємо стару
            'category': category,
            'subcategory': subcategory,
            'sort': sort_val,
            'season': season,
            'audience': audience,
            'brand': brand if brand else p.get('brand', ''),
            'country': country if country else p.get('country', ''),
            'unit': 'кг',
            'price': p.get('price'),
            'akciya': p.get('akciya'),
            'youtube': p.get('youtube', ''),
            'lots': [],
        }

    lots_data[prod_id]['lots'].append(lot_obj)
    total_lots += 1

print(f"[FILE2] Products in lots: {len(lots_data)}, Total lots: {total_lots}")
print(f"  Reserved: {reserved_count}, Free: {total_lots - reserved_count}")
if dup_barcodes:
    print(f"  ⚠️ Duplicate barcodes: {dup_barcodes}")
else:
    print("  ✓ No duplicate barcodes")

# ===== GENERATE PRODUCTS JS =====
def product_to_js(p):
    lines = []
    lines.append(f"  {{")
    lines.append(f"    id:{js_str(p['id'])},name:{js_str(p['name'])},")
    lines.append(f"    category:{js_str(p['category'])},subcategory:{js_str(p['subcategory'])},")
    lines.append(f"    brand:{js_str(p['brand'])},sort:{js_str(p['sort'])},season:{js_str(p['season'])},")
    lines.append(f"    audience:{js_str(p['audience'])},country:{js_str(p['country'])},")
    lines.append(f"    unit:{js_str(p['unit'])},weight:{js_str(p['weight'])},")
    price_str = str(p['price']) if p['price'] is not None else 'null'
    akciya_str = str(p['akciya']) if p['akciya'] is not None else 'null'
    qty_str = str(p['qty_stock']) if p['qty_stock'] is not None else 'null'
    lines.append(f"    price:{price_str},akciya:{akciya_str},")
    lines.append(f"    youtube:{js_str(p['youtube'])},qty_stock:{qty_str}")
    lines.append(f"  }}")
    return '\n'.join(lines)

products_js_items = [product_to_js(p) for p in products]
products_js = "window.PRODUCTS=[\n" + ",\n".join(products_js_items) + "\n];"

# ===== GENERATE LOTS_DATA JS =====
def lot_to_js(lot):
    bc = lot['barcode']
    w = lot['weight']
    res = 'true' if lot['reserved'] else 'false'
    er = lot['eur_rate']
    pru = lot['price_regular_uah'] if lot['price_regular_uah'] is not None else 'null'
    pau = lot['price_akciya_uah'] if lot['price_akciya_uah'] is not None else 'null'
    pu = lot['price_uah'] if lot['price_uah'] is not None else 'null'
    ppu = lot['price_per_unit'] if lot['price_per_unit'] is not None else 'null'
    ia = 'true' if lot['is_akciya'] else 'false'
    qty = lot['qty'] if lot['qty'] is not None else 'null'
    
    desc = str(lot['desc']).replace('\\', '\\\\').replace("'", "\\u2019").replace('\n', '\\n').replace('\r', '')
    prod_name = str(lot['prodName']).replace('\\', '\\\\').replace("'", "\\u2019")
    
    return (f"      {{barcode:'{bc}',weight:{w},reserved:{res},eur_rate:{er},"
            f"price_regular_uah:{pru},price_akciya_uah:{pau},"
            f"price_uah:{pu},price_per_unit:{ppu},price_per_kg:{ppu},"
            f"is_akciya:{ia},unit:'{lot['unit']}',qty:{qty},"
            f"youtube:'{lot['youtube']}',youtube_embed:'{lot['youtube_embed']}',"
            f"desc:'{desc}',prodId:'{lot['prodId']}',prodName:'{prod_name}'}}")

def prod_lots_to_js(pid, pd_obj):
    # Ескейпимо ВСІ рядкові поля — без цього апостроф в підкатегорії (напр. "М'які іграшки")
    # розриває JS string і ламає LOTS_DATA цілком.
    def esc(s):
        return str(s).replace("'", "\\u2019")
    price_s = str(pd_obj['price']) if pd_obj['price'] is not None else 'null'
    akciya_s = str(pd_obj['akciya']) if pd_obj['akciya'] is not None else 'null'
    lots_js = ',\n'.join([lot_to_js(l) for l in pd_obj['lots']])
    return (f"  '{pid}':{{id:'{pid}',name:'{esc(pd_obj['name'])}',"
            f"category:'{esc(pd_obj['category'])}',subcategory:'{esc(pd_obj['subcategory'])}',"
            f"sort:'{esc(pd_obj['sort'])}',season:'{esc(pd_obj['season'])}',audience:'{esc(pd_obj['audience'])}',"
            f"brand:'{esc(pd_obj['brand'])}',country:'{esc(pd_obj['country'])}',unit:'кг',"
            f"price:{price_s},akciya:{akciya_s},youtube:'{esc(pd_obj['youtube'])}',"
            f"lots:[\n{lots_js}\n    ]}}")

lots_entries = [prod_lots_to_js(pid, pd_obj) for pid, pd_obj in lots_data.items()]
lots_js = "window.LOTS_DATA={\n" + ",\n".join(lots_entries) + "\n};"

# LOTS_IDS
lots_ids_list = list(lots_data.keys())
lots_ids_js = "window.LOTS_IDS=new Set([" + ",".join([f"'{x}'" for x in lots_ids_list]) + "]);"

# ===== ЗАПИСУЄМО ДАНІ ПРЯМО В data/*.js =====
DATA_DIR = os.path.join(BASE_DIR, 'data')
os.makedirs(DATA_DIR, exist_ok=True)

PRODUCTS_OUT = os.path.join(DATA_DIR, 'products.js')
LOTS_OUT     = os.path.join(DATA_DIR, 'lots.js')

with open(PRODUCTS_OUT, 'w', encoding='utf-8') as f:
    f.write('// auto-generated by generate_data.py — do NOT edit manually\n')
    f.write(products_js + '\n')
    f.write(lots_ids_js + '\n')

with open(LOTS_OUT, 'w', encoding='utf-8') as f:
    f.write('// auto-generated by generate_data.py — do NOT edit manually\n')
    f.write(lots_js + '\n')

print(f"\n{'='*50}")
print(f"✅ data/products.js  ({len(products)} товарів)")
print(f"✅ data/lots.js      ({len(lots_data)} продуктів з лотами, {total_lots} лотів)")

# Summary
print(f"\n{'='*50}")
print(f"✅ Оновлено!")
print(f"\n📊 catalog.html:")
print(f"  Товарів: {len(products)}")
print(f"\n📊 lots.html:")
print(f"  Продуктів: {len(lots_data)} | Лотів: {total_lots} | Вільних: {total_lots - reserved_count} | Заброньованих: {reserved_count}")

# ===== ВАЛІДАЦІЯ ПІДКАТЕГОРІЙ =====
from collections import Counter
sub_counts = Counter(p['subcategory'] for p in products)
print(f"\n📋 Розподіл по підкатегоріях ({len(sub_counts)} унікальних):")
for sub, cnt in sorted(sub_counts.items(), key=lambda x: -x[1]):
    print(f"  {cnt:3d}  {sub}")

# Перевірка: чи не потрапило щось зайве в "Одяг мікс"
miks_count = sub_counts.get('Одяг мікс', 0)
if miks_count > 50:
    print(f"\n⚠️  УВАГА: {miks_count} товарів в 'Одяг мікс' — можливо потрібно додати нові ключові слова в CATEGORY_MAP")
    # Show top 10 undetected
    miks_names = [(p['id'], p['name']) for p in products if p['subcategory'] == 'Одяг мікс']
    print("   Перші 10 нерозпізнаних:")
    for id_, name in miks_names[:10]:
        print(f"     [{id_}] {name}")
else:
    print(f"\n✓ 'Одяг мікс': {miks_count} — в нормі")
