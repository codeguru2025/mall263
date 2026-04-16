-- Marketplace category catalog (Facebook Marketplace–style top-level categories).
-- Inserts only rows that do not already conflict on name or slug (existing seed/admin categories stay).

INSERT INTO categories (id, name, slug, parent_id, image_url, sort_order, is_active, created_at)
SELECT gen_random_uuid(), v.name, v.slug, NULL, NULL, v.sort_order, true, NOW()
FROM (
  VALUES
    ('Antiques & collectibles', 'antiques-collectibles', 10),
    ('Arts & crafts', 'arts-crafts', 20),
    ('Baby', 'baby', 30),
    ('Books, films & music', 'books-films-music', 40),
    ('Car parts', 'car-parts', 50),
    ('Childrenswear & baby', 'childrenswear-baby', 60),
    ('DIY', 'diy', 70),
    ('Electronics', 'electronics', 80),
    ('Free & community', 'free-community', 90),
    ('Furniture', 'furniture', 100),
    ('Garage sale', 'garage-sale', 110),
    ('Health & beauty', 'health-beauty', 120),
    ('Home & kitchen', 'home-kitchen', 130),
    ('Jewellery & watches', 'jewellery-watches', 140),
    ('Luggage & bags', 'luggage-bags', 150),
    ('Menswear', 'menswear', 160),
    ('Miscellaneous', 'miscellaneous', 170),
    ('Musical instruments', 'musical-instruments', 180),
    ('Patio & garden', 'patio-garden', 190),
    ('Pet supplies', 'pet-supplies', 200),
    ('Properties for rent', 'properties-rent', 210),
    ('Properties for sale', 'properties-sale', 220),
    ('Sporting goods', 'sporting-goods', 230),
    ('Toys & games', 'toys-games', 240),
    ('Vehicles', 'vehicles', 250),
    ('Womenswear', 'womenswear', 260)
) AS v(name, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM categories c
  WHERE lower(trim(c.slug)) = lower(trim(v.slug))
     OR lower(trim(c.name)) = lower(trim(v.name))
);
