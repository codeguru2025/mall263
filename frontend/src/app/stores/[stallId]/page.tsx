import { Metadata } from 'next';
import StorePageClient from './StorePageClient';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/v1\/?$/, '');

async function fetchStallMeta(stallId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/stalls/${stallId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ stallId: string }> }): Promise<Metadata> {
  const { stallId } = await params;
  const stall = await fetchStallMeta(stallId);

  if (!stall) {
    return {
      title: 'Store | Mall263',
      description: 'Browse stores on Mall263.',
    };
  }

  const storeName = stall.name;
  const businessName = stall.merchant?.businessName;
  const mall = stall.mall?.name;
  const city = stall.mall?.city?.name ?? stall.mall?.city;
  const location = [mall, city].filter(Boolean).join(', ');
  const logo = stall.merchant?.user?.avatarUrl || stall.logoUrl;

  const title = businessName ? `${storeName} – ${businessName}` : storeName;
  const description = [
    `Shop at ${storeName}`,
    location && `located at ${location}`,
    stall.viewCount ? `${stall.viewCount} store visits` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    title: `${title} | Mall263`,
    description,
    openGraph: {
      title: `${title} | Mall263`,
      description,
      ...(logo ? { images: [{ url: logo, width: 800, height: 800 }] } : {}),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${title} | Mall263`,
      description,
      ...(logo ? { images: [logo] } : {}),
    },
  };
}

export default function StorePage() {
  return <StorePageClient />;
}
