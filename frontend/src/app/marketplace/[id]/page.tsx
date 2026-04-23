import { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/api\/v1\/?$/, '');

async function fetchProductMeta(id: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductMeta(id);

  if (!product) {
    return {
      title: 'Product | Mall263',
      description: 'Browse products on Mall263.',
    };
  }

  const title = [product.name, product.brand].filter(Boolean).join(' – ');
  const stallName = product.stall?.name;
  const mall = product.stall?.mall?.name;
  const location = [stallName, mall].filter(Boolean).join(' · ');
  const price = product.minPrice ? `From $${Number(product.minPrice).toFixed(2)}` : null;

  const description = [
    product.description?.slice(0, 140),
    price,
    location,
  ]
    .filter(Boolean)
    .join(' — ');

  const primaryImage =
    product.images?.find((i: any) => i.isPrimary)?.cdnUrl ||
    product.images?.[0]?.cdnUrl ||
    product.images?.[0]?.url;

  return {
    title: `${title} | Mall263`,
    description: description || `${product.name} available on Mall263.`,
    openGraph: {
      title: `${title} | Mall263`,
      description: description || `${product.name} available on Mall263.`,
      ...(primaryImage ? { images: [{ url: primaryImage, width: 1200, height: 630 }] } : {}),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Mall263`,
      description: description || `${product.name} available on Mall263.`,
      ...(primaryImage ? { images: [primaryImage] } : {}),
    },
  };
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
