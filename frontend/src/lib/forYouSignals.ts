const STORAGE_KEY = 'mall263_for_you_hints_v1';
const MAX_IDS = 40;

export type ForYouHints = {
  categoryIds: string[];
  mallIds: string[];
  viewedProductIds: string[];
};

export function loadForYouHints(): ForYouHints {
  if (typeof window === 'undefined') {
    return { categoryIds: [], mallIds: [], viewedProductIds: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { categoryIds: [], mallIds: [], viewedProductIds: [] };
    const j = JSON.parse(raw) as Partial<ForYouHints>;
    return {
      categoryIds: Array.isArray(j.categoryIds) ? j.categoryIds.slice(0, MAX_IDS) : [],
      mallIds: Array.isArray(j.mallIds) ? j.mallIds.slice(0, MAX_IDS) : [],
      viewedProductIds: Array.isArray(j.viewedProductIds) ? j.viewedProductIds.slice(0, MAX_IDS) : [],
    };
  } catch {
    return { categoryIds: [], mallIds: [], viewedProductIds: [] };
  }
}

function persist(h: ForYouHints) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

/** Call when a shopper opens a product — feeds category / mall affinity + de-dupe in For You */
export function recordProductEngagement(input: {
  productId: string;
  categoryId?: string | null;
  mallId?: string | null;
}) {
  if (typeof window === 'undefined') return;
  const h = loadForYouHints();
  const cats = Array.from(
    new Set([...(input.categoryId ? [input.categoryId] : []), ...h.categoryIds]),
  ).slice(0, MAX_IDS);
  const malls = Array.from(
    new Set([...(input.mallId ? [input.mallId] : []), ...h.mallIds]),
  ).slice(0, MAX_IDS);
  const viewed = [
    input.productId,
    ...h.viewedProductIds.filter((id) => id !== input.productId),
  ].slice(0, MAX_IDS);
  persist({ categoryIds: cats, mallIds: malls, viewedProductIds: viewed });
}

/** Part of React Query key so the feed refetches after new views / interests */
export function forYouCacheKey(): string {
  const h = loadForYouHints();
  const cats = [...h.categoryIds].sort().join(',');
  const tail = h.viewedProductIds.slice(0, 10).join(',');
  return `${cats}|${h.mallIds[0] || ''}|${tail}`;
}

export function buildForYouSearchParams(page: number, limit = 12): string {
  const h = loadForYouHints();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (h.categoryIds.length) params.set('categoryIds', h.categoryIds.join(','));
  if (h.mallIds[0]) params.set('mallId', h.mallIds[0]);
  if (h.viewedProductIds.length) {
    params.set('excludeIds', h.viewedProductIds.slice(0, 24).join(','));
  }
  return params.toString();
}
