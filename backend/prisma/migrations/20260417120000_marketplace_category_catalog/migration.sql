-- Marketplace category catalog (Facebook Marketplace–style top-level categories).
-- Safe to re-run: upserts by slug.

INSERT INTO categories (id, name, slug, parent_id, image_url, sort_order, is_active, created_at)
VALUES
  (gen_random_uuid(), 'Antiques & collectibles', 'antiques-collectibles', NULL, NULL, 10, true, NOW()),
  (gen_random_uuid(), 'Arts & crafts', 'arts-crafts', NULL, NULL, 20, true, NOW()),
  (gen_random_uuid(), 'Baby', 'baby', NULL, NULL, 30, true, NOW()),
  (gen_random_uuid(), 'Books, films & music', 'books-films-music', NULL, NULL, 40, true, NOW()),
  (gen_random_uuid(), 'Car parts', 'car-parts', NULL, NULL, 50, true, NOW()),
  (gen_random_uuid(), 'Childrenswear & baby', 'childrenswear-baby', NULL, NULL, 60, true, NOW()),
  (gen_random_uuid(), 'DIY', 'diy', NULL, NULL, 70, true, NOW()),
  (gen_random_uuid(), 'Electronics', 'electronics', NULL, NULL, 80, true, NOW()),
  (gen_random_uuid(), 'Free & community', 'free-community', NULL, NULL, 90, true, NOW()),
  (gen_random_uuid(), 'Furniture', 'furniture', NULL, NULL, 100, true, NOW()),
  (gen_random_uuid(), 'Garage sale', 'garage-sale', NULL, NULL, 110, true, NOW()),
  (gen_random_uuid(), 'Health & beauty', 'health-beauty', NULL, NULL, 120, true, NOW()),
  (gen_random_uuid(), 'Home & kitchen', 'home-kitchen', NULL, NULL, 130, true, NOW()),
  (gen_random_uuid(), 'Jewellery & watches', 'jewellery-watches', NULL, NULL, 140, true, NOW()),
  (gen_random_uuid(), 'Luggage & bags', 'luggage-bags', NULL, NULL, 150, true, NOW()),
  (gen_random_uuid(), 'Menswear', 'menswear', NULL, NULL, 160, true, NOW()),
  (gen_random_uuid(), 'Miscellaneous', 'miscellaneous', NULL, NULL, 170, true, NOW()),
  (gen_random_uuid(), 'Musical instruments', 'musical-instruments', NULL, NULL, 180, true, NOW()),
  (gen_random_uuid(), 'Patio & garden', 'patio-garden', NULL, NULL, 190, true, NOW()),
  (gen_random_uuid(), 'Pet supplies', 'pet-supplies', NULL, NULL, 200, true, NOW()),
  (gen_random_uuid(), 'Properties for rent', 'properties-rent', NULL, NULL, 210, true, NOW()),
  (gen_random_uuid(), 'Properties for sale', 'properties-sale', NULL, NULL, 220, true, NOW()),
  (gen_random_uuid(), 'Sporting goods', 'sporting-goods', NULL, NULL, 230, true, NOW()),
  (gen_random_uuid(), 'Toys & games', 'toys-games', NULL, NULL, 240, true, NOW()),
  (gen_random_uuid(), 'Vehicles', 'vehicles', NULL, NULL, 250, true, NOW()),
  (gen_random_uuid(), 'Womenswear', 'womenswear', NULL, NULL, 260, true, NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
