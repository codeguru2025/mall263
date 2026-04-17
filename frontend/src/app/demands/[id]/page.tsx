'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import UrgencyCountdown, { useCountdown, formatCountdown } from '@/components/UrgencyCountdown';
import OfferExpiryBar from '@/components/OfferExpiryBar';
import {
  ArrowLeft, Gavel, Clock, CheckCircle2, ChevronDown, Loader2, AlertCircle,
  MapPin, MessageCircle, Truck, Navigation, Store, PackageCheck, X, Receipt,
  TrendingUp, Star
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'ECOCASH', label: 'EcoCash' },
  { value: 'ONEMONEY', label: 'OneMoney' },
  { value: 'TELECASH', label: 'Telecash' },
  { value: 'CARD', label: 'Card' },
];

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({ message: '', totalPrice: '', stallId: '' });
  const [deliveryOfferId, setDeliveryOfferId] = useState<string | null>(null);
  const [buyerLocation, setBuyerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [activeMapOffer, setActiveMapOffer] = useState<string | null>(null);
  const [fulfillModal, setFulfillModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: demand, isLoading, isError } = useQuery({
    queryKey: ['demand', id],
    queryFn: () => api.get(`/api/v1/demands/${id}`).then((r) => r.data),
    enabled: isAuthenticated && !!id,
  });

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated && ['STALL_OWNER', 'ATTENDANT'].includes(user?.role ?? ''),
  });

  // Fetch stalls separately — merchants/me doesn't embed stalls
  const { data: myStalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: isAuthenticated && ['STALL_OWNER', 'ATTENDANT'].includes(user?.role ?? '') && !!merchant?.id,
  });

  const { data: deliveryRate } = useQuery({
    queryKey: ['delivery-rate'],
    queryFn: () => api.get('/api/v1/demands/delivery/rate').then((r) => r.data),
  });

  const stallId = myStalls?.[0]?.id ?? '';

  const submitOffer = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/demands/${id}/offers`, {
        stallId,
        totalPrice: parseFloat(offerForm.totalPrice),
        message: offerForm.message || undefined,
        items: [],
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Offer submitted!');
      setOfferOpen(false);
      setOfferForm({ message: '', totalPrice: '', stallId: '' });
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to submit offer'),
  });

  const acceptOffer = useMutation({
    mutationFn: (offerId: string) =>
      api.post(`/api/v1/demands/offers/${offerId}/accept`).then((r) => r.data),
    onSuccess: (_, offerId) => {
      toast.success('Offer accepted!');
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
      setActiveMapOffer(offerId);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to accept offer'),
  });

  const openChat = useMutation({
    mutationFn: (offerId: string) =>
      api.post(`/api/v1/chat/rooms/${offerId}`).then((r) => r.data),
    onSuccess: (room) => {
      router.push(`/chat/${room.id}`);
    },
    onError: () => toast.error('Could not open chat'),
  });

  const completeSale = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/demands/${id}/fulfill`, { stallId, paymentMethod }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Sale recorded! Receipt: ${data.receiptNumber}`);
      setFulfillModal(false);
      setCompletedSaleId(data.saleId);
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to complete sale'),
  });

  const requestDelivery = useMutation({
    mutationFn: ({ offerId, lat, lng }: { offerId: string; lat: number; lng: number }) =>
      api.post(`/api/v1/demands/offers/${offerId}/delivery`, { buyerLat: lat, buyerLng: lng }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Delivery requested! Fee: ${formatCurrency(data.deliveryFee)} for ${data.distanceKm.toFixed(1)}km`);
      setDeliveryOfferId(null);
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to request delivery'),
  });

  const handleRequestDelivery = (offerId: string) => {
    if (buyerLocation) {
      requestDelivery.mutate({ offerId, lat: buyerLocation.lat, lng: buyerLocation.lng });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setBuyerLocation(loc);
        setLocating(false);
        requestDelivery.mutate({ offerId, lat: loc.lat, lng: loc.lng });
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location. Please enable location access.');
      },
      { timeout: 10000 }
    );
  };

  // Must be called unconditionally before any early returns
  const timeLeft = useCountdown(demand?.expiresAt ?? '');

  if (authLoading) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !demand) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-brand-red" />
        <p className="text-navy-700 font-bold">Demand not found</p>
        <Link href="/demands" className="btn-primary">Back to Demands</Link>
      </div>
    );
  }

  const isBuyer = demand.buyer?.id === user?.id;
  const isSeller = ['STALL_OWNER', 'ATTENDANT'].includes(user?.role ?? '');
  const isOpen = demand.status === 'OPEN';

  const statusColors: Record<string, string> = {
    OPEN: 'badge-live',
    MATCHED: 'badge-bid',
    FULFILLED: 'badge-success',
    EXPIRED: 'badge-danger',
    CLOSED: 'bg-gray-100 text-gray-600 border border-gray-200',
  };

  const urgencyColors: Record<string, string> = {
    HIGH: 'text-brand-red bg-red-50 border-red-200',
    MEDIUM: 'text-brand-orange bg-orange-50 border-orange-200',
    LOW: 'text-brand-blue bg-blue-50 border-blue-200',
    URGENT: 'text-brand-red bg-red-100 border-red-300 animate-pulse',
  };

  const acceptedOffer = (demand.offers || []).find((o: any) => o.status === 'ACCEPTED');
  const pendingOfferCount = (demand.offers || []).filter((o: any) => o.status === 'PENDING').length;
  const trustScore = demand.buyer?.trustScore?.overallScore 
    ? parseFloat(String(demand.buyer.trustScore.overallScore))
    : 50;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/demands" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Demand Details</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Demand card */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            {demand.buyer?.avatarUrl ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden relative flex-shrink-0">
                <Image src={demand.buyer.avatarUrl} alt={demand.buyer.firstName} fill className="object-cover" sizes="48px" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Gavel className="w-6 h-6 text-brand-orange" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`badge text-[10px] ${statusColors[demand.status] || statusColors.CLOSED}`}>{demand.status}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${urgencyColors[demand.urgency] || urgencyColors.MEDIUM}`}>
                  {demand.urgency}
                </span>
                <UrgencyCountdown 
                  expiresAt={demand.expiresAt} 
                  urgency={demand.urgency}
                  size="sm"
                />
              </div>
              <h2 className="font-black text-navy-700 text-lg leading-tight">{demand.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">by {demand.buyer?.firstName} {demand.buyer?.lastName}</p>
                <span className="flex items-center gap-1 text-xs text-brand-green bg-green-50 px-1.5 py-0.5 rounded">
                  <Star className="w-3 h-3" />
                  Trust {trustScore.toFixed(0)}
                </span>
              </div>
            </div>
          </div>

          {demand.description && (
            <p className="text-sm text-gray-600 mb-4">{demand.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Budget Range</p>
              <p className="font-black text-navy-700">
                {formatCurrency(parseFloat(demand.minBudget || '0'))} – {formatCurrency(parseFloat(demand.maxBudget || '0'))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Offers</p>
              <p className="font-black text-navy-700">{demand.offers?.length ?? 0} received</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Posted {new Date(demand.createdAt).toLocaleDateString()}</span>
            <span className="text-gray-300">|</span>
            <span className={timeLeft.total < 3600000 ? 'text-brand-red font-bold' : ''}>
              Expires in {formatCountdown(timeLeft)}
            </span>
          </div>
        </div>

        {/* Accepted offer — map + actions */}
        {acceptedOffer && (
          <div className="bg-white rounded-2xl border-2 border-brand-green overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-brand-green" />
                <span className="font-black text-navy-700">Offer Accepted</span>
                <span className="text-brand-green font-black">{formatCurrency(parseFloat(acceptedOffer.totalPrice))}</span>
              </div>
              <button
                onClick={() => openChat.mutate(acceptedOffer.id)}
                disabled={openChat.isPending}
                className="flex items-center gap-1.5 bg-brand-blue text-white text-xs font-bold py-2 px-3 rounded-xl hover:bg-blue-600 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {openChat.isPending ? 'Opening...' : 'Chat'}
                {acceptedOffer.chatRoom && (
                  <span className="w-2 h-2 bg-brand-green rounded-full" />
                )}
              </button>
            </div>

            {/* Stall info */}
            <div className="px-5 py-3 bg-gray-50 flex items-center gap-3">
              <Store className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-navy-700">{acceptedOffer.stall?.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Stall {acceptedOffer.stall?.stallNumber}
                  {acceptedOffer.stall?.mall?.name ? ` · ${acceptedOffer.stall.mall.name}` : ''}
                  {acceptedOffer.stall?.mall?.city ? `, ${acceptedOffer.stall.mall.city}` : ''}
                </div>
              </div>
            </div>

            {/* Map */}
            {(acceptedOffer.stall?.latitude || acceptedOffer.stall?.mall?.latitude) && (
              <div className="px-5 py-4 space-y-3">
                <div className="relative rounded-xl overflow-hidden h-48 bg-gray-100">
                  <iframe
                    title="Stall location"
                    width="100%"
                    height="100%"
                    loading="lazy"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      (acceptedOffer.stall?.longitude ?? acceptedOffer.stall?.mall?.longitude) - 0.005
                    }%2C${
                      (acceptedOffer.stall?.latitude ?? acceptedOffer.stall?.mall?.latitude) - 0.005
                    }%2C${
                      (acceptedOffer.stall?.longitude ?? acceptedOffer.stall?.mall?.longitude) + 0.005
                    }%2C${
                      (acceptedOffer.stall?.latitude ?? acceptedOffer.stall?.mall?.latitude) + 0.005
                    }&layer=mapnik&marker=${
                      acceptedOffer.stall?.latitude ?? acceptedOffer.stall?.mall?.latitude
                    }%2C${
                      acceptedOffer.stall?.longitude ?? acceptedOffer.stall?.mall?.longitude
                    }`}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${
                    acceptedOffer.stall?.latitude ?? acceptedOffer.stall?.mall?.latitude
                  },${
                    acceptedOffer.stall?.longitude ?? acceptedOffer.stall?.mall?.longitude
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-brand-blue text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
                >
                  <Navigation className="w-4 h-4" /> Get Directions
                </a>
              </div>
            )}

            {/* Seller: Complete Sale */}
            {isSeller && demand.status === 'MATCHED' && acceptedOffer?.stallId === stallId && (
              <div className="px-5 py-4 border-t border-gray-100 space-y-2">
                <p className="text-xs text-gray-500">Goods handed over and payment received? Record the sale to generate a receipt.</p>
                <button
                  onClick={() => setFulfillModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand-green text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-colors"
                >
                  <PackageCheck className="w-4 h-4" /> Record Sale &amp; Get Receipt
                </button>
              </div>
            )}

            {/* Show receipt link after completion */}
            {isSeller && demand.status === 'FULFILLED' && completedSaleId && (
              <div className="px-5 py-4 border-t border-gray-100">
                <Link
                  href={`/receipts/${completedSaleId}`}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-navy-700 text-white text-sm font-bold rounded-xl hover:bg-navy-800 transition-colors"
                >
                  <Receipt className="w-4 h-4" /> View Receipt
                </Link>
              </div>
            )}

            {/* Delivery section */}
            {isBuyer && (
              <div className="px-5 py-4 border-t border-gray-100">
                {acceptedOffer.deliveryRequest ? (
                  <div className="flex items-center gap-3 bg-green-50 rounded-xl p-3">
                    <Truck className="w-5 h-5 text-brand-green" />
                    <div>
                      <div className="text-sm font-bold text-brand-green">Delivery Requested</div>
                      <div className="text-xs text-gray-500">
                        {acceptedOffer.deliveryRequest.distanceKm?.toFixed(1)}km ·{' '}
                        {formatCurrency(parseFloat(acceptedOffer.deliveryRequest.deliveryFee))} ·{' '}
                        Status: {acceptedOffer.deliveryRequest.status}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      Want it delivered? Rate: {formatCurrency(deliveryRate?.ratePerKm ?? 0.5)}/km
                    </div>
                    <button
                      onClick={() => handleRequestDelivery(acceptedOffer.id)}
                      disabled={locating || requestDelivery.isPending}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-brand-orange text-white text-sm font-bold rounded-xl hover:bg-orange-500 transition-colors disabled:opacity-60"
                    >
                      {locating || requestDelivery.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> {locating ? 'Getting location...' : 'Requesting...'}</>
                      ) : (
                        <><Truck className="w-4 h-4" /> Request Delivery</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit offer — sellers only */}
        {isSeller && isOpen && stallId && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
            <button
              onClick={() => setOfferOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-4 font-bold text-navy-700 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-green" /> Submit Your Offer
              </span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${offerOpen ? 'rotate-180' : ''}`} />
            </button>
            {offerOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="label">Your Price ($) <span className="text-brand-red">*</span></label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 25.00"
                    min="0.01"
                    step="0.01"
                    value={offerForm.totalPrice}
                    onChange={(e) => setOfferForm((f) => ({ ...f, totalPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Message to buyer</label>
                  <textarea
                    className="input min-h-[80px] resize-none"
                    placeholder="Tell the buyer what you have and when they can collect..."
                    value={offerForm.message}
                    onChange={(e) => setOfferForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => {
                    const price = parseFloat(offerForm.totalPrice);
                    if (isNaN(price) || price <= 0) { toast.error('Enter a valid price'); return; }
                    const max = parseFloat(demand.maxBudget || '0');
                    const min = parseFloat(demand.minBudget || '0');
                    if (max > 0 && price > max) { toast.error(`Exceeds buyer's max budget ${formatCurrency(max)}`); return; }
                    if (min > 0 && price < min) { toast.error(`Below buyer's min budget ${formatCurrency(min)}`); return; }
                    submitOffer.mutate();
                  }}
                  disabled={!offerForm.totalPrice || submitOffer.isPending}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {submitOffer.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                    : <><Gavel className="w-4 h-4" /> Submit Offer</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Offers list */}
        <div>
          <h3 className="font-black text-lg text-navy-700 mb-2">
            {isBuyer ? 'Offers Received' : 'All Offers'} ({demand.offers?.length ?? 0})
          </h3>
          {isOpen && pendingOfferCount > 1 && (
            <p className="text-xs font-bold text-brand-orange bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
              {pendingOfferCount} sellers competing — each offer expires on its own timer. Compare prices and act
              before time runs out.
            </p>
          )}
          {(demand.offers || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 text-center py-10">
              <Gavel className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No offers yet. Sellers will respond soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {demand.offers.map((offer: any) => {
                const isAccepted = offer.status === 'ACCEPTED';
                const isPending = offer.status === 'PENDING';
                const isRejected = offer.status === 'REJECTED';

                return (
                  <div
                    key={offer.id}
                    className={`bg-white rounded-2xl border-2 transition-all ${
                      isAccepted ? 'border-brand-green shadow-sm' :
                      isRejected ? 'border-gray-100 opacity-60' :
                      'border-gray-100'
                    }`}
                  >
                    <div className="p-4 flex items-center gap-3">
                      {/* Seller avatar placeholder */}
                      <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-navy-700 truncate">
                            {offer.stall?.name || 'Seller'}
                          </span>
                          {isAccepted && (
                            <span className="text-[10px] font-bold bg-green-100 text-brand-green px-2 py-0.5 rounded-full">Accepted</span>
                          )}
                          {isRejected && (
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Rejected</span>
                          )}
                        </div>
                        {offer.stall?.mall?.name && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {offer.stall.mall.name}{offer.stall.mall.city ? `, ${offer.stall.mall.city}` : ''}
                          </div>
                        )}
                        {offer.message && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{offer.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xl font-black text-navy-700">
                          {formatCurrency(parseFloat(offer.totalPrice))}
                        </span>
                        {isBuyer && isPending && isOpen && (
                          <button
                            onClick={() => acceptOffer.mutate(offer.id)}
                            disabled={acceptOffer.isPending}
                            className="flex items-center gap-1.5 bg-brand-green text-white text-xs font-bold py-2 px-3 rounded-xl hover:bg-green-600 transition-colors"
                          >
                            {acceptOffer.isPending
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Accept
                          </button>
                        )}
                        {isAccepted && (
                          <button
                            onClick={() => openChat.mutate(offer.id)}
                            disabled={openChat.isPending}
                            className="flex items-center gap-1.5 bg-brand-blue text-white text-xs font-bold py-2 px-3 rounded-xl hover:bg-blue-600 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Chat
                          </button>
                        )}
                      </div>
                    </div>
                    {isPending && offer.createdAt && offer.expiresAt && (
                      <div className="px-4 pb-4">
                        <OfferExpiryBar createdAt={offer.createdAt} expiresAt={offer.expiresAt} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Complete Sale Modal */}
      {fulfillModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-black text-navy-700">Record Sale</h3>
                <p className="text-xs text-gray-400 mt-0.5">How did the buyer pay?</p>
              </div>
              <button onClick={() => setFulfillModal(false)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Amount */}
              {acceptedOffer && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Amount received</span>
                  <span className="font-black text-xl text-navy-700">{formatCurrency(parseFloat(acceptedOffer.totalPrice))}</span>
                </div>
              )}

              {/* Payment method */}
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      paymentMethod === opt.value
                        ? 'border-brand-green bg-green-50 text-brand-green'
                        : 'border-gray-100 bg-white text-navy-600 hover:border-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-center">
                A 2.5% platform commission will be charged from your wallet.
              </p>

              <button
                onClick={() => completeSale.mutate()}
                disabled={completeSale.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60"
              >
                {completeSale.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : <><PackageCheck className="w-4 h-4" /> Complete &amp; Generate Receipt</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
