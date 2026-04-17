'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

/** Haversine formula — returns distance in km between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
  stallLat?: number | null;
  stallLng?: number | null;
  stallName?: string;
}

export function DeliveryCalculator({ stallLat, stallLng, stallName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [yourLat, setYourLat] = useState('');
  const [yourLng, setYourLng] = useState('');
  const [locating, setLocating] = useState(false);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['app-settings-public'],
    queryFn: () => api.get('/api/v1/settings/public').then((r) => r.data),
    staleTime: 600_000,
  });

  const ratePerKm = parseFloat(settings?.delivery_rate_per_km ?? '0.50');

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setYourLat(pos.coords.latitude.toFixed(6));
        setYourLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false),
    );
  }

  const lat1 = parseFloat(yourLat);
  const lon1 = parseFloat(yourLng);
  const distanceKm =
    stallLat && stallLng && isFinite(lat1) && isFinite(lon1)
      ? haversineKm(lat1, lon1, stallLat, stallLng)
      : null;

  const deliveryFee = distanceKm !== null ? distanceKm * ratePerKm : null;

  // Don't render if stall has no location data
  if (!stallLat || !stallLng) return null;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4 text-brand-blue" />
          </div>
          <div>
            <p className="font-bold text-sm text-navy-700">Delivery estimate</p>
            <p className="text-xs text-gray-500">
              {deliveryFee !== null
                ? `~${formatCurrency(deliveryFee)} · ${distanceKm!.toFixed(1)} km away`
                : 'Enter your location to estimate'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-50 pt-4">
          <p className="text-xs text-gray-500 mb-3">
            Rate: {formatCurrency(ratePerKm)}/km from{' '}
            <span className="font-semibold text-navy-700">{stallName ?? 'stall'}</span>
          </p>

          <button
            onClick={useMyLocation}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 text-brand-blue text-sm font-bold hover:bg-blue-100 transition-colors mb-3 disabled:opacity-60"
          >
            <MapPin className="w-4 h-4" />
            {locating ? 'Getting location…' : 'Use my current location'}
          </button>

          <p className="text-[10px] text-center text-gray-400 mb-3">— or enter coordinates manually —</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={yourLat}
                onChange={(e) => setYourLat(e.target.value)}
                placeholder="-17.8292"
                className="w-full mt-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm text-navy-700 font-semibold focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={yourLng}
                onChange={(e) => setYourLng(e.target.value)}
                placeholder="31.0522"
                className="w-full mt-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm text-navy-700 font-semibold focus:border-brand-blue outline-none"
              />
            </div>
          </div>

          {deliveryFee !== null && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Distance</p>
                <p className="font-black text-navy-700">{distanceKm!.toFixed(2)} km</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">Estimated fee</p>
                <p className="font-black text-brand-blue text-lg">{formatCurrency(deliveryFee)}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
            This is an estimate only. Actual delivery fee is agreed between you and the seller.
          </p>
        </div>
      )}
    </div>
  );
}
