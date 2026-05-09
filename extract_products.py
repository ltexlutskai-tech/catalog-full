# -*- coding: utf-8 -*-
"""DEPRECATED (since the May 2026 redesign).

Previously this script extracted `const PRODUCTS=[...]` from catalog.html
into data/products.js. Starting with the new design, generate_data.py writes
data/products.js + data/lots.js directly, so extraction is no longer needed.

This file is kept as a no-op so update.bat continues to work without changes.
"""
import os, sys, io

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_JS = os.path.join(ROOT, 'data', 'products.js')

if os.path.exists(PRODUCTS_JS):
    print(f'extract_products.py: nothing to do — data/products.js already exists '
          f'({os.path.getsize(PRODUCTS_JS):,} bytes). '
          f'generate_data.py is the new source of truth.')
else:
    print('extract_products.py: data/products.js missing — run generate_data.py first.')
    sys.exit(1)
