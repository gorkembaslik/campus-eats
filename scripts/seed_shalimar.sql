-- =============================================================
-- Shalimar Restaurant Seed
-- pricing_model : monetary  (wallet balance in €)
-- currency_label: €
-- ticket_eur_value: 8.0
--   → 1 full physical ticket = €8 credit  (cashier reference only)
--   → half physical ticket   = €4 credit  (cashier reference only)
-- For monetary restaurants price_wallet_units = price_eur always.
-- =============================================================

WITH rest AS (
  INSERT INTO public.restaurants (
    name, slug, pricing_model, currency_label,
    ticket_eur_value, is_active, order_count, cuisine_tags
  )
  VALUES (
    'Shalimar', 'shalimar', 'monetary', '€',
    8.0, true, 0, ARRAY['Indian', 'Pakistani', 'Tandoori']
  )
  RETURNING id
)
INSERT INTO public.menu_items
  (restaurant_id, name, description, price_eur, price_wallet_units, available)
SELECT
  rest.id,
  items.name,
  items.description,
  items.price_eur,
  items.price_eur,   -- monetary: wallet units == € amount
  true
FROM rest,
(VALUES
  -- ── ANTIPASTI ────────────────────────────────────────────────
  ('Samosa Veg',               'Fagottini fritti ripieni di verdure',                    3.00),
  ('Samosa Carne',             'Fagottini fritti ripieni di carne',                      3.00),
  ('Pakora',                   'Frittelle di verdure con farina di ceci',                3.00),
  ('Chicken Pakora',           'Bocconcini di pollo marinati e fritti',                  4.00),
  ('Paneer Pakora',            'Polpettine fritte di formaggio e spezie',                4.00),
  ('Jhinga Pakora',            'Gamberoni in pastella fritti',                           4.00),
  ('Pappadams / Masala Pappadams', 'Sfoglie croccanti di legumi',                        2.00),
  ('Kashmiri Tikki',           'Polpettine fritte di formaggio e spezie',                4.00),
  ('Shami Kebab',              'Polpette di carne trita con lenticchie e spezie',        4.00),
  ('Mix Starter',              'Samosa, Pakora, Papad',                                  4.00),
  ('Veggie Roll',              'Naan con verdure miste, insalata e salse',               4.00),
  ('Chicken Roll',             'Naan con pollo speziato e salse',                        4.00),
  -- ── ZUPPE ────────────────────────────────────────────────────
  ('Chicken Soup',             'Zuppa di pollo con spezie',                              4.00),
  ('Daal Soup',                'Zuppa di lenticchie e spezie',                           3.00),
  ('Vegetarian Soup',          'Zuppa di verdure fresche e spezie',                      3.00),
  -- ── TANDOORI ─────────────────────────────────────────────────
  ('Chicken Tikka',            'Pollo marinato cotto nel Tandoor',                       9.00),
  ('Lamb Tikka',               'Agnello marinato cotto nel Tandoor',                    10.00),
  ('Haryalli Tikka',           'Pollo marinato in menta, zenzero, aglio',              10.00),
  ('Malai Tikka',              'Pollo marinato in formaggio e spezie',                  10.00),
  ('Chicken Tandoori',         'Cosce di pollo marinate cotte nel Tandoor',              8.00),
  ('Fish Tandoori',            'Orata intera marinata cotta nel Tandoor',               12.00),
  ('Seekh Kebab',              'Carne macinata speziata cotta nel Tandoor',             10.00),
  ('Reshmi Kebab',             'Carne trita marinata in formaggio e spezie',            10.00),
  -- ── PIATTI NON VEG – POLLO ───────────────────────────────────
  ('Karahi Chicken',           'Pollo con curry e peperoni (piccante)',                  9.00),
  ('Chicken Tikka Masala',     'Pollo tandoor in salsa curry',                           9.00),
  ('Chicken Curry',            'Pollo con curry e spezie',                               9.00),
  ('Chicken Palak',            'Pollo con spinaci e spezie',                             9.00),
  ('Chicken Achari',           'Pollo saltato con mango',                                9.00),
  ('Chicken Korma',            'Pollo con yogurt, mandorle e spezie',                    9.00),
  ('Chicken Madras',           'Pollo in salsa madras piccante',                         9.00),
  ('Chicken Jalfrezi',         'Pollo con patate e spezie',                              9.00),
  ('Chicken Vindaloo',         'Pollo con patate in salsa curry',                        9.00),
  ('Murgh Channa',             'Pollo con ceci in salsa curry',                          9.00),
  ('Butter Chicken',           'Pollo tandoor in salsa curry e burro',                   9.00),
  ('Chicken Mushroom Masala',  'Pollo con funghi e spezie',                              9.00),
  -- ── PIATTI NON VEG – CARNE MACINATA ─────────────────────────
  ('Keema Matar',              'Carne macinata con piselli in salsa curry',              9.00),
  ('Aloo Keema',               'Carne macinata con patate in salsa curry',               9.00),
  -- ── PIATTI NON VEG – PESCE E GAMBERI ────────────────────────
  ('Karahi Prawn',             'Gamberoni con curry e peperoni verdi (piccante)',        12.00),
  ('Fish Curry',               'Salmone in salsa curry',                                10.00),
  ('Prawn Curry',              'Gamberoni in salsa curry',                              10.00),
  -- ── PIATTI DI AGNELLO ────────────────────────────────────────
  ('Lamb Curry',               'Agnello con curry e spezie',                            10.00),
  ('Lamb Karahi',              'Agnello con curry, peperoni e spezie',                  10.00),
  ('Lamb Achari',              'Agnello saltato con spezie',                            10.00),
  ('Lamb Korma',               'Agnello con yogurt, mandorle e spezie',                 10.00),
  ('Lamb Palak',               'Agnello con spinaci e spezie',                          10.00),
  ('Lamb Madras',              'Agnello in salsa madras piccante',                      10.00),
  ('Lamb Jalfrezi',            'Agnello con spezie jalfrezi',                           10.00),
  ('Lamb Vindaloo',            'Agnello con patate in salsa curry',                     10.00),
  ('Rogan Josh',               'Agnello con curry, yogurt, peperoni e spezie',          10.00),
  -- ── PIATTI VEGETARIANI ───────────────────────────────────────
  ('Matar Paneer',             'Paneer e piselli in salsa curry',                        8.00),
  ('Palak Paneer',             'Spinaci con formaggio fresco',                           8.00),
  ('Vegetarian Kofta',         'Frittelle di verdure in salsa curry',                    7.00),
  ('Chana Masala',             'Ceci e patate in salsa speziata al pomodoro',            6.00),
  ('Vegetable Korma',          'Verdure in salsa yogurt, mandorle e spezie',             7.00),
  ('Punjabi Bharta',           'Melanzane macinate con spezie',                          6.00),
  ('Vegetable Curry',          'Verdure miste in salsa curry',                           6.00),
  ('Punjabi Tori',             'Zucchine con spezie',                                    7.00),
  ('Bhindi Masala',            'Okra con cipolla e spezie',                              6.00),
  ('Daal Tarka',               'Lenticchie con spezie',                                  6.00),
  ('Daal Makhni',              'Lenticchie nere con spezie',                             6.00),
  ('Aloo Gobhi',               'Cavolfiore e patate con spezie',                         6.00),
  ('Saag Aloo',                'Patate con spinaci e spezie',                            6.00),
  ('Raita',                    'Yogurt con verdure fresche',                             3.00),
  ('Mix Salad',                'Insalata fresca indiana',                                3.00),
  ('Russian Salad',            'Patate, piselli, ananas, mela e salsa cremosa',          5.00),
  -- ── RISO ─────────────────────────────────────────────────────
  ('Chicken Biryani',          'Riso con pollo e spezie',                                7.00),
  ('Lamb Biryani',             'Riso con agnello e spezie',                              8.00),
  ('Prawns Biryani',           'Riso con gamberetti e spezie',                           6.00),
  ('Vegetarian Biryani',       'Riso con verdure e spezie',                              7.00),
  ('Keema Biryani',            'Riso con carne macinata e spezie',                       5.00),
  ('Riso Pulao',               'Riso con zafferano, spezie e mandorle',                  5.00),
  ('White Rice',               'Riso basmati profumato',                                 5.00),
  ('Channa Pulao',             'Riso con ceci e spezie',                                 5.00),
  ('Matanjan',                 'Riso basmati profumato e zucchero',                      5.00),
  -- ── PANE ─────────────────────────────────────────────────────
  ('Garlic Naan',              'Naan all''aglio',                                        2.00),
  ('Cheese Naan',              'Naan al formaggio',                                      2.00),
  ('Butter Naan',              'Naan al burro',                                          2.00),
  ('Keema Naan',               'Naan ripieno di carne',                                  3.00),
  ('Stuffed Naan',             'Naan ripieno di verdure',                                2.50),
  ('Peshawari Naan',           'Naan con semi di sesamo',                                2.00),
  ('Naan',                     'Naan semplice',                                          1.50),
  ('Tandoori Roti',            'Pane integrale tandoor',                                 1.50),
  ('Puri',                     'Pane integrale fritto',                                  2.00),
  ('Chapati',                  'Pane integrale',                                         1.50),
  -- ── MENU FISSO ───────────────────────────────────────────────
  ('Menu Vegetarian',          'Mix Starters · Veg Korma · Dhal · Riso Pulao · Pane · Dolce a scelta (bevande escluse)', 18.00)
) AS items(name, description, price_eur);
