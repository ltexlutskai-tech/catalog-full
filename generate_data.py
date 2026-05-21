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
    ('шолом',            'Аксесуари', 'Шапки та головні убори'),
    ('рукавичк',         'Аксесуари', 'Шапки та головні убори'),  # немає окремої підкат
    ('рукавиц',          'Аксесуари', 'Шапки та головні убори'),
    ('шарф',             'Аксесуари', 'Шапки та головні убори'),
    ('хустк',            'Аксесуари', 'Шапки та головні убори'),
    ('ремен',            'Аксесуари', 'Сумки та рюкзаки'),
    ('ремін',            'Аксесуари', 'Сумки та рюкзаки'),
    ('ремні',            'Аксесуари', 'Сумки та рюкзаки'),
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
    ('спальник',         'Дім та побут', 'Побутові товари'),
    ('пряж',             'Дім та побут', 'Побутові товари'),
    ('товари для тварин','Дім та побут', 'Товари для тварин'),
    ('лежак',            'Дім та побут', 'Товари для тварин'),
    ('товари для дом',   'Дім та побут', 'Побутові товари'),
    ('товари для офіс',  'Дім та побут', 'Побутові товари'),
    ('побутова технік',  'Дім та побут', 'Побутові товари'),
    ('домовий мікс',     'Дім та побут', 'Побутові товари'),
    ('домашній мікс',    'Дім та побут', 'Побутові товари'),
    ('обіход',           'Дім та побут', 'Побутові товари'),
    ('кераміка',         'Дім та побут', 'Побутові товари'),
    ('декор',            'Дім та побут', 'Побутові товари'),
    ('новорічн',         'Дім та побут', 'Побутові товари'),
    ('ручки офіс',       'Дім та побут', 'Побутові товари'),
    ('ручки',            'Дім та побут', 'Побутові товари'),
    ('щітк',             'Дім та побут', 'Побутові товари'),
    ('офісн',            'Дім та побут', 'Побутові товари'),

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

# ===== КЛАСИФІКАТОР ТЕГІВ З КОЛОНКИ "Категорії" =====
# Кожному відомому тегу присвоюємо тип і канонічне значення.
# Якщо тег невідомий — ігнорується (логуємо в кінці).

TAG_TOP_CAT = {
    'одяг': 'Одяг',
    'взуття': 'Взуття',
    'аксесуари': 'Аксесуари',
    'дім та побут': 'Дім та побут',
    'іграшки': 'Іграшки',
    'bric a brac': 'Bric-a-Brac',
    'bric-a-brac': 'Bric-a-Brac',
    'agd': 'Bric-a-Brac',
    'косметика': 'Косметика',
}

# Підкатегорія → (top, canonical subcategory)
TAG_SUBCAT = {
    # Одяг
    'светри та кардигани': ('Одяг', 'Светри та кардигани'),
    'худі та світшоти':    ('Одяг', 'Худі та світшоти'),
    'куртки та пальта':    ('Одяг', 'Куртки та пальта'),
    'одяг мікс':           ('Одяг', 'Одяг мікс'),
    'кофти флісові':       ('Одяг', 'Кофти флісові'),
    'шорти':               ('Одяг', 'Шорти'),
    'штани та брюки':      ('Одяг', 'Штани та брюки'),
    'футболки':            ('Одяг', 'Футболки'),
    'майки та топи':       ('Одяг', 'Майки та топи'),
    'купальники':          ('Одяг', 'Купальники'),
    'нижня білизна':       ('Одяг', 'Нижня білизна'),
    'сорочки та блузи':    ('Одяг', 'Сорочки та блузи'),
    'колготки та легінси': ('Одяг', 'Колготки та легінси'),
    'лосини':              ('Одяг', 'Колготки та легінси'),
    'спідниці та плаття':  ('Одяг', 'Спідниці та плаття'),
    'халати та піжами':    ('Одяг', 'Халати та піжами'),
    'шкарпетки':           ('Одяг', 'Шкарпетки'),
    'джинси':              ('Одяг', 'Джинси'),
    'робочий одяг':        ('Одяг', 'Робочий одяг'),
    'спец-одяг':           ('Одяг', 'Робочий одяг'),
    'військовий одяг':     ('Одяг', 'Робочий одяг'),
    'спортивний одяг':     ('Одяг', 'Спортивний одяг'),
    'вітровки та штормовки': ('Одяг', 'Вітровки та штормовки'),
    'лижний одяг':         ('Одяг', 'Куртки та пальта'),
    'костюми':             ('Одяг', 'Костюми'),
    'комбінезони':         ('Одяг', 'Комбінезони'),
    'жилетки':             ('Одяг', 'Піджаки та жилети'),
    'піджаки та жилети':   ('Одяг', 'Піджаки та жилети'),
    # Взуття
    'взуття мікс':            ('Взуття', 'Взуття мікс'),
    'кросівки та кеди':       ('Взуття', 'Кросівки та кеди'),
    'тапочки та шльопанці':   ('Взуття', 'Тапочки та шльопанці'),
    'гумове взуття':          ('Взуття', 'Взуття гумове'),
    'взуття гумове':          ('Взуття', 'Взуття гумове'),
    'черевики та чоботи':     ('Взуття', 'Черевики та чоботи'),
    'туфлі та босоніжки':     ('Взуття', 'Туфлі та босоніжки'),
    'робоче взуття':          ('Взуття', 'Взуття робоче'),
    'взуття робоче':          ('Взуття', 'Взуття робоче'),
    # Аксесуари
    'біжутерія':             ('Аксесуари', 'Біжутерія'),
    'сумки та рюкзаки':      ('Аксесуари', 'Сумки та рюкзаки'),
    'ремені':                ('Аксесуари', 'Сумки та рюкзаки'),
    'шапки та головні убори':('Аксесуари', 'Шапки та головні убори'),
    'рукавички':             ('Аксесуари', 'Шапки та головні убори'),
    'рукавиці':              ('Аксесуари', 'Шапки та головні убори'),
    # Дім та побут
    'постільна білизна':  ('Дім та побут', 'Постільна білизна'),
    'рушники':            ('Дім та побут', 'Рушники'),
    'товари для тварин':  ('Дім та побут', 'Товари для тварин'),
    'килими та килимки':  ('Дім та побут', 'Килими та килимки'),
    'побутові товари':    ('Дім та побут', 'Побутові товари'),
    'домашній текстиль':  ('Дім та побут', 'Побутові товари'),
    'пряжа':              ('Дім та побут', 'Побутові товари'),
    'спальні мішки':      ('Дім та побут', 'Побутові товари'),
    # Іграшки
    'тверді іграшки':  ('Іграшки', 'Тверді іграшки'),
    'іграшка тверда':  ('Іграшки', 'Тверді іграшки'),
    "м'які іграшки":   ('Іграшки', "М'які іграшки"),
    "іграшка м'яка":   ('Іграшки', "М'які іграшки"),
    # Bric-a-Brac
    'bric a brac (підкат)': ('Bric-a-Brac', 'Bric-a-Brac'),
    # Косметика
    'косметика декоративна': ('Косметика', 'Косметика декоративна'),
}

# Сезон
TAG_SEASON = {
    'демісезон': 'Демісезон',
    'зима': 'Зима',
    'літо': 'Літо',
    'всесезонне': 'Всесезонне',
}

# Стать / audience
TAG_AUDIENCE = {
    'жіноче': 'Жіноче',
    'чоловіче': 'Чоловіче',
    'дитяче': 'Дитяче',
    'мікс жіноче+чоловіче': 'Мікс',
    'мікс доросле+дитяче': 'Мікс',
    'доросле+дитяче': 'Мікс',
    'дорослі': 'Дорослі',
}

# Сорт
TAG_SORT = {
    '1-й сорт': '1й сорт', '1й сорт': '1й сорт',
    '2-й сорт': '2й сорт', '2й сорт': '2й сорт',
    'сток': 'Сток',
    'екстра': 'Екстра',
    'крем': 'Крем',
    'мікс': 'Мікс',
    # комбіновані — позначаємо як "Мікс" (склад різний)
    'екстра + 1-й сорт': 'Мікс',
    '1-й + 2-й сорт':    'Мікс',
    'екстра+крем':       'Мікс',
    'сток + крем':       'Мікс',
}

# Країна
TAG_COUNTRY = {
    'англія': 'Англія',
    'німеччина': 'Німеччина',
    'німеччина d': 'Німеччина',
    'польща': 'Польща',
    'канада': 'Канада',
    'італія': 'Італія',
    'шотландія': 'Шотландія',
    'бельгія': 'Бельгія',
    'голандія': 'Голандія',
    'голландія': 'Голандія',
    'україна': 'Україна',
    'америка': 'Америка',
}

def classify_categories_column(cats_text):
    """Парсить колонку 'Категорії' (через кому) і повертає словник атрибутів.
    Невпізнані теги ігноруються. Повертає None для відсутніх — щоб виклик
    знав, що треба впасти на fallback по назві."""
    if not cats_text or cats_text == 'nan':
        return None
    out = {
        'category': None, 'subcategory': None,
        'sort': None, 'season': None, 'audience': None, 'country': None,
    }
    unknown = []
    for raw in cats_text.split(','):
        t = raw.strip()
        if not t:
            continue
        key = t.lower()
        if key in TAG_SUBCAT:
            top, sub = TAG_SUBCAT[key]
            # Підкатегорія завжди визначає батьківську категорію
            out['category'] = top
            out['subcategory'] = sub
        elif key in TAG_TOP_CAT:
            # Категорія ставиться тільки якщо ще немає від підкатегорії
            if not out['category']:
                out['category'] = TAG_TOP_CAT[key]
        elif key in TAG_SEASON:
            out['season'] = TAG_SEASON[key]
        elif key in TAG_AUDIENCE:
            out['audience'] = TAG_AUDIENCE[key]
        elif key in TAG_SORT:
            out['sort'] = TAG_SORT[key]
        elif key in TAG_COUNTRY:
            out['country'] = TAG_COUNTRY[key]
        else:
            unknown.append(t)
    out['_unknown'] = unknown
    return out

# Парсер колонки "Опис" — витягує атрибути з рядків виду "✔️Сезон: X"
def parse_description(desc_text):
    if not desc_text or desc_text == 'nan':
        return {}
    out = {}
    # Прибираємо галочки і нерозривні пробіли
    text = desc_text.replace('✔️', '').replace('✔', '').replace('\xa0', ' ')
    # Ловимо пари "Поле: значення" — значення до кінця рядка
    fields = {
        'season':   r'Сезон\s*:\s*([^\n\r]+)',
        'sort':     r'Сорт\s*:\s*([^\n\r]+)',
        'audience': r'Стать\s*:\s*([^\n\r]+)',
        'qty_per_bag': r'Кількість одиниць\s*:\s*([^\n\r]+)',
        'unit_weight': r'Вага одиниці\s*:\s*([^\n\r]+)',
        'sizes':    r'Розміри\s*:\s*([^\n\r]+)',
    }
    for k, pat in fields.items():
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            v = m.group(1).strip().rstrip('.').strip()
            if v:
                out[k] = v
    return out

def normalize_desc_season(v):
    if not v: return None
    s = v.lower()
    if 'демі' in s: return 'Демісезон'
    if 'зим'  in s: return 'Зима'
    if 'літ'  in s: return 'Літо'
    if 'всесезон' in s: return 'Всесезонне'
    return None

def normalize_desc_sort(v):
    if not v: return None
    s = v.lower()
    if 'екстр' in s and 'крем' in s: return 'Мікс'
    if '1' in s and '2' in s and 'сорт' in s: return 'Мікс'
    if 'екстр' in s: return 'Екстра'
    if 'крем'  in s: return 'Крем'
    if '1' in s and 'сорт' in s: return '1й сорт'
    if '2' in s and 'сорт' in s: return '2й сорт'
    if 'сток' in s: return 'Сток'
    if 'мікс' in s: return 'Мікс'
    return None

def normalize_desc_audience(v):
    if not v: return None
    s = v.lower()
    has_w = 'жін' in s
    has_m = 'чол' in s
    has_c = 'дит' in s or 'хлопч' in s or 'дівч' in s
    if has_w and has_m: return 'Мікс'
    if has_w: return 'Жіноче'
    if has_m: return 'Чоловіче'
    if has_c: return 'Дитяче'
    return None

def detect_attrs(name_lower):
    # Normalize quote marks: backtick `, right-single ’, prime ' → ' (so 'м’яч' / 'м`яч' / "м'яч" all match)
    name_lower = name_lower.replace('`', "'").replace('’', "'").replace('ʼ', "'")
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
    before_id = nom[:id_match.start()].rstrip().rstrip(',').strip()
    after_id  = nom[id_match.end():].lstrip().lstrip(',').strip()

    if before_id:
        # Звичайний випадок: "<назва> (ID), <метадані>"
        name = before_id
        parts_after = [p.strip() for p in after_id.split(',')]
    else:
        # (ID) на початку: "(ID) <назва>, <метадані>" — назва йде до першого мета-поля
        # (youtube-посилання / вага у вигляді числа / 'шт' / 'кг')
        raw_parts = [p.strip() for p in after_id.split(',')]
        name_parts, parts_after = [], []
        saw_meta = False
        for p in raw_parts:
            is_meta = ('youtube.com' in p or 'youtu.be' in p
                       or p.lower() in ('шт', 'кг')
                       or bool(re.match(r'^[\d][\d\-\.]*$', p)))
            if is_meta:
                saw_meta = True
                parts_after.append(p)
            elif not saw_meta:
                name_parts.append(p)
            else:
                parts_after.append(p)
        name = ', '.join([p for p in name_parts if p]).strip()

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

    # ── Нова структура файлу (8 колонок) ──
    # 0 артикул | 1 номенклатура+yt+вага | 2 опис | 3 категорії
    # 4 ціна    | 5 акція                 | 6 шт   | 7 вага кг
    # Підтримка старої структури (5 колонок) залишена як fallback.
    n_cols = len(row)
    if n_cols >= 8:
        desc_text = str(row.iloc[2]) if pd.notna(row.iloc[2]) else ''
        cats_text = str(row.iloc[3]) if pd.notna(row.iloc[3]) else ''
        price_raw = row.iloc[4]
        akciya_raw = row.iloc[5]
        qty_raw    = row.iloc[6]
        weight_raw = row.iloc[7]
    else:
        desc_text = ''
        cats_text = ''
        price_raw  = row.iloc[2]
        akciya_raw = row.iloc[3]
        qty_raw    = row.iloc[4]
        weight_raw = None

    price = round(float(price_raw), 2) if pd.notna(price_raw) else None
    akciya = round(float(akciya_raw), 2) if pd.notna(akciya_raw) else None
    qty_stock = int(qty_raw) if pd.notna(qty_raw) else None
    if pd.notna(weight_raw):
        try:
            weight = str(weight_raw).strip() if not isinstance(weight_raw, (int, float)) else str(weight_raw)
        except Exception:
            pass

    if price is None and akciya is None and youtube == '':
        skipped_f1 += 1
        continue

    # 1) Класифікація з колонки "Категорії" (пріоритет)
    cat_info = classify_categories_column(cats_text)
    # 2) Атрибути з опису (фолбек для season/sort/audience)
    desc_info = parse_description(desc_text)
    # 3) Стара детекція по назві (фолбек для всього іншого)
    name_lower = name.lower()
    n_cat, n_sub, n_sort, n_season, n_aud, n_country, brand = detect_attrs(name_lower)

    if cat_info and (cat_info.get('category') or cat_info.get('subcategory')):
        category    = cat_info.get('category')    or n_cat
        subcategory = cat_info.get('subcategory') or n_sub
    else:
        category, subcategory = n_cat, n_sub

    sort_val = (cat_info and cat_info.get('sort')) \
               or normalize_desc_sort(desc_info.get('sort')) \
               or n_sort
    season   = (cat_info and cat_info.get('season')) \
               or normalize_desc_season(desc_info.get('season')) \
               or n_season
    audience = (cat_info and cat_info.get('audience')) \
               or normalize_desc_audience(desc_info.get('audience')) \
               or n_aud
    country  = (cat_info and cat_info.get('country')) or n_country

    # Витягнемо число одиниць у мішку з опису (якщо є) — лише для довідки
    qty_per_bag = None
    qpb_raw = desc_info.get('qty_per_bag', '')
    if qpb_raw:
        m = re.search(r'(\d+)', qpb_raw)
        if m:
            qty_per_bag = int(m.group(1))

    products.append({
        'id': prod_id, 'name': name,
        'category': category, 'subcategory': subcategory,
        'brand': brand, 'sort': sort_val, 'season': season,
        'audience': audience, 'country': country,
        'unit': get_unit_from_map(prod_id, unit_f1), 'weight': weight,
        'price': price, 'akciya': akciya,
        'youtube': youtube, 'qty_stock': qty_stock,
        'qty_per_bag': qty_per_bag,
    })

print(f"[FILE1] Products: {len(products)}, skipped: {skipped_f1}")

# ===== СОРТУВАННЯ: спочатку товари в наявності (qty_stock > 0) за спаданням =====
# Усі товари без запасу (qty_stock = 0 або None) йдуть у кінець, серед них
# зберігається стабільний порядок за id.
def _stock_sort_key(p):
    q = p.get('qty_stock')
    in_stock = q is not None and q > 0
    # Кортеж: (0|1, від'ємна кількість, id) → природний sort: спершу 0-група спадання
    return (0 if in_stock else 1, -(q or 0), int(p['id']))

products.sort(key=_stock_sort_key)
in_stock_n = sum(1 for p in products if (p.get('qty_stock') or 0) > 0)
print(f"  В наявності: {in_stock_n} | Без запасу: {len(products) - in_stock_n}")

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
    # Видаляємо (ID) де б він не стояв — на початку, в середині або в кінці
    prod_name = re.sub(r'\s*\(\d+\)\s*', ' ', name_part).strip()

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
        # Якщо є запис у Прайсі — використовуємо вже визначені атрибути
        # (з колонки "Категорії" + опису + fallback по назві).
        # Інакше падаємо на стару детекцію по назві з лотового файлу.
        if p:
            category    = p['category']
            subcategory = p['subcategory']
            sort_val    = p['sort']
            season      = p['season']
            audience    = p['audience']
            brand       = p.get('brand', '')
            country     = p.get('country', '')
        else:
            name_lower = prod_name.lower()
            category, subcategory, sort_val, season, audience, country, brand = detect_attrs(name_lower)

        # Якщо в Прайсі назва порожня — підставляємо з файлу мішків
        name_from_f1 = p.get('name', '') or ''
        lots_data[prod_id] = {
            'id': prod_id,
            'name': name_from_f1 if name_from_f1 else prod_name,
            'category': category,
            'subcategory': subcategory,
            'sort': sort_val,
            'season': season,
            'audience': audience,
            'brand': brand,
            'country': country,
            'unit': 'кг',
            'price': p.get('price'),
            'akciya': p.get('akciya'),
            'youtube': p.get('youtube', ''),
            'qty_stock': p.get('qty_stock'),
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

# ===== СОРТУВАННЯ LOTS_DATA: товари з найбільшим qty_stock — на початок =====
# JS-об'єкт зберігає порядок ключів, тому Object.keys() поверне у тому ж порядку.
def _lots_sort_key(item):
    pid, pd_obj = item
    q = pd_obj.get('qty_stock')
    in_stock = q is not None and q > 0
    return (0 if in_stock else 1, -(q or 0), int(pid))

lots_data = dict(sorted(lots_data.items(), key=_lots_sort_key))

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
    qpb_str = str(p['qty_per_bag']) if p.get('qty_per_bag') is not None else 'null'
    lines.append(f"    price:{price_str},akciya:{akciya_str},")
    lines.append(f"    youtube:{js_str(p['youtube'])},qty_stock:{qty_str},qty_per_bag:{qpb_str}")
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
    price_s  = str(pd_obj['price'])     if pd_obj['price']     is not None else 'null'
    akciya_s = str(pd_obj['akciya'])    if pd_obj['akciya']    is not None else 'null'
    qstock_s = str(pd_obj.get('qty_stock')) if pd_obj.get('qty_stock') is not None else 'null'
    lots_js = ',\n'.join([lot_to_js(l) for l in pd_obj['lots']])
    return (f"  '{pid}':{{id:'{pid}',name:'{esc(pd_obj['name'])}',"
            f"category:'{esc(pd_obj['category'])}',subcategory:'{esc(pd_obj['subcategory'])}',"
            f"sort:'{esc(pd_obj['sort'])}',season:'{esc(pd_obj['season'])}',audience:'{esc(pd_obj['audience'])}',"
            f"brand:'{esc(pd_obj['brand'])}',country:'{esc(pd_obj['country'])}',unit:'кг',"
            f"price:{price_s},akciya:{akciya_s},qty_stock:{qstock_s},youtube:'{esc(pd_obj['youtube'])}',"
            f"lots:[\n{lots_js}\n    ]}}")

lots_entries = [prod_lots_to_js(pid, pd_obj) for pid, pd_obj in lots_data.items()]
lots_js = "window.LOTS_DATA={\n" + ",\n".join(lots_entries) + "\n};"

# LOTS_IDS + LOTS_ORDER (порядок як у lots_data після сортування за наявністю)
# JS Object з числовими-подібними ключами ('1001', '1913') ігнорує порядок
# вставки і повертає їх натурально по числу. Тому окремий масив для порядку.
lots_ids_list = list(lots_data.keys())
lots_ids_js = ("window.LOTS_IDS=new Set([" + ",".join([f"'{x}'" for x in lots_ids_list]) + "]);"
               + "\nwindow.LOTS_ORDER=[" + ",".join([f"'{x}'" for x in lots_ids_list]) + "];")

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

# ===== ГЕНЕРУЄМО sitemap.xml ДЛЯ SEO =====
SITE_URL = 'https://ltexlutskai-tech.github.io/catalog-full'
SITEMAP_OUT = os.path.join(BASE_DIR, 'sitemap.xml')

import datetime
today = datetime.date.today().isoformat()

# Уникальні верхні категорії та підкатегорії
top_cats = set()
sub_pairs = set()  # (top, sub)
TOP_BY_SUB = {}  # subcategory -> top
for sub_list in VALID_SUBCATS.items():
    top, subs = sub_list
    for s in subs:
        TOP_BY_SUB[s] = top

for p in products:
    cat = p['category']
    sub = p['subcategory']
    top_cats.add(cat)
    if sub:
        sub_pairs.add((cat, sub))

from urllib.parse import quote
def url_enc(s):
    return quote(s, safe='')

sm_lines = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">']

def add_url(loc, priority='0.5', changefreq='weekly'):
    # Escape & as &amp; for valid XML
    loc_xml = loc.replace('&', '&amp;')
    sm_lines.append(f'  <url><loc>{loc_xml}</loc><lastmod>{today}</lastmod>'
                    f'<changefreq>{changefreq}</changefreq><priority>{priority}</priority></url>')

# Static pages
add_url(f'{SITE_URL}/',                   priority='1.0', changefreq='daily')
add_url(f'{SITE_URL}/catalog.html',       priority='0.9', changefreq='daily')
add_url(f'{SITE_URL}/lots.html',          priority='0.9', changefreq='daily')
add_url(f'{SITE_URL}/catalog.html?new=1', priority='0.7', changefreq='daily')
add_url(f'{SITE_URL}/catalog.html?sale=1',priority='0.7', changefreq='weekly')

# Top-level categories
for cat in sorted(top_cats):
    add_url(f'{SITE_URL}/catalog.html?cat={url_enc(cat)}', priority='0.8', changefreq='daily')

# Subcategories
for cat, sub in sorted(sub_pairs):
    add_url(f'{SITE_URL}/catalog.html?cat={url_enc(cat)}&sub={url_enc(sub)}',
            priority='0.7', changefreq='weekly')

# Individual products
for p in products:
    add_url(f'{SITE_URL}/product.html?id={p["id"]}', priority='0.6', changefreq='weekly')

# Lot listings per product (only when lots exist)
for pid in lots_data.keys():
    add_url(f'{SITE_URL}/lots.html?id={pid}', priority='0.5', changefreq='weekly')

sm_lines.append('</urlset>')
with open(SITEMAP_OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sm_lines))

print(f"\n{'='*50}")
print(f"✅ data/products.js  ({len(products)} товарів)")
print(f"✅ data/lots.js      ({len(lots_data)} продуктів з лотами, {total_lots} лотів)")
print(f"✅ sitemap.xml       ({len(sm_lines)-2} URL)")

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
