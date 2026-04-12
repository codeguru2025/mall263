'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Phone, Briefcase, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: s, isLoading, isError } = useQuery({
    queryKey: ['service', id],
    queryFn: () => api.get(`/api/v1/services/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  if (isError || !s) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-brand-red" />
        <p className="text-navy-700 font-bold">Service not found</p>
        <Link href="/services" className="btn-primary text-sm">
          Back to services
        </Link>
      </div>
    );
  }

  const phone = s.provider?.phone as string | undefined;

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/services" className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-black text-navy-700 text-sm">Service</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy-700 leading-tight">{s.title}</h1>
            {s.category?.name && <p className="text-sm text-gray-400 mt-1">{s.category.name}</p>}
          </div>
        </div>

        {s.description && (
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{s.description}</p>
        )}

        {s.priceFrom != null && Number(s.priceFrom) > 0 && (
          <div className="rounded-2xl bg-green-50 border-2 border-green-100 px-4 py-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Starting at</p>
            <p className="text-2xl font-black text-brand-green">{formatCurrency(Number(s.priceFrom))}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-3">
          <h2 className="font-bold text-navy-700">Provider</h2>
          <p className="text-sm text-gray-600">
            {s.provider?.firstName} {s.provider?.lastName}
          </p>
          {s.stall && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-navy-700">{s.stall.name}</p>
                {s.mall && (
                  <p className="text-gray-500">
                    {s.mall.name}, {s.mall.city}
                  </p>
                )}
              </div>
            </div>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-blue hover:underline"
            >
              <Phone className="w-4 h-4" /> {phone}
            </a>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">
            Reach out to book or get a quote. Mall263 does not process payments for services yet — agree details
            directly with the provider.
          </p>
        </div>
      </div>
    </div>
  );
}
