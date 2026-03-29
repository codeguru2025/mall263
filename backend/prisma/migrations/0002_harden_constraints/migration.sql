-- Migration: 0002_harden_constraints
-- Adds database-level guards that the application layer also enforces.
-- These constraints are a last line of defence against bugs or direct DB access.

-- ── Inventory ────────────────────────────────────────────────────────────────
-- Quantity can never go negative (stock cannot be oversold at the DB level).
ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_qty_non_negative
  CHECK (quantity >= 0);

-- Reserved quantity must also be non-negative.
ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_reserved_non_negative
  CHECK (reserved_qty >= 0);

-- Available stock (quantity - reserved) must be >= 0.
ALTER TABLE inventory
  ADD CONSTRAINT chk_inventory_available_non_negative
  CHECK (quantity >= reserved_qty);

-- ── Wallet balances ───────────────────────────────────────────────────────────
-- Available balance can never go negative.
ALTER TABLE wallets
  ADD CONSTRAINT chk_wallet_available_non_negative
  CHECK (available_balance >= 0);

-- Locked balance can never go negative.
ALTER TABLE wallets
  ADD CONSTRAINT chk_wallet_locked_non_negative
  CHECK (locked_balance >= 0);

-- ── Wallet transaction amounts ────────────────────────────────────────────────
-- Transaction amounts must always be positive.
ALTER TABLE wallet_transactions
  ADD CONSTRAINT chk_wallet_tx_amount_positive
  CHECK (amount > 0);

-- ── Deposit idempotency ───────────────────────────────────────────────────────
-- Unique partial index on external_ref: prevents a payment gateway webhook
-- from being processed twice and double-crediting a wallet.
-- NULL external_refs are excluded (internal/manual transactions have no ref).
CREATE UNIQUE INDEX uidx_wallet_tx_external_ref
  ON wallet_transactions (external_ref)
  WHERE external_ref IS NOT NULL;
