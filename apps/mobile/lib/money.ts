export type ParsedMoneyInput = {
  amount: number;
  canonical: string;
};

const MONEY_INPUT_RE = /^(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/;

export function parseMoneyInput(input: string): ParsedMoneyInput | null {
  const trimmed = input.trim();
  if (!MONEY_INPUT_RE.test(trimmed)) return null;

  const normalized = trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;

  return {
    amount,
    canonical: amount.toFixed(2),
  };
}
