'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft, Truck, CheckCircle2, AlertTriangle, MapPin, User,
  Navigation, Loader2, ShieldCheck, Banknote, Handshake,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<string, string> = {
  BROADCAST: 'Finding a driver…',
  ACCEPTED: 'Driver en route to pickup',
  PICKUP_CONFIRMED: 'Item picked up — in transit',
  IN_TRANSIT: 'In transit to you',
  DELIVERED: 'Delivered — confirm receipt',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned to seller',
};

const STATUS_COLOR: Record<string, string> = {
  BROADCAST: 'bg-gray-400',
  ACCEPTED: 'bg-brand-blue',
  PICKUP_CONFIRMED: 'bg-brand-blue',
  IN_TRANSIT: 'bg-brand-orange',
  DELIVERED: 'bg-brand-green',
  COMPLETED: 'bg-brand-green',
  CANCELLED: 'bg-brand-red',
  RETURNED: 'bg-brand-red',
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  SAFE_PAY: <ShieldCheck className="w-4 h-4" />,
  CASH_ON_DELIVERY: <Banknote className="w-4 h-4" />,
  DIRECT_DEAL: <Handshake className="w-4 h-4" />,
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-bold text-navy-700">{value}</span>
    </div>
  );
}

function DriverMap({ lat, lng }: { lat: number; lng: number }) {
  const delta = 0.015;
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100">
      <iframe
        title="Driver location"
        width="100%"
        height="220"
        loading="lazy"
        style={{ border: 0, display: 'block' }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`}
      />
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-2.5 bg-brand-blue text-white text-sm font-bold hover:bg-blue-600 transition-colors"
      >
        <Navigation className="w-4 h-4" /> Open in Google Maps
      </a>
    </div>
  );
}

export default function DeliveryTrackPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['delivery-job', jobId],
    queryFn: () => api.get(`/api/v1/delivery/jobs/${jobId}`).then((r) => r.data),
    enabled: isAuthenticated && !!jobId,
    refetchInterval: 15_000,
  });

  const confirmMut = useMutation({
    mutationFn: () => api.post(`/api/v1/delivery/jobs/${jobId}/confirm-receipt`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Receipt confirmed! Payment released to seller.');
      qc.invalidateQueries({ queryKey: ['delivery-job', jobId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed to confirm'),
  });

  const disputeMut = useMutation({
    mutationFn: () => api.post(`/api/v1/disputes/${jobId}`, { reason: disputeReason }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Dispute filed. Our team will review shortly.');
      setShowDisputeForm(false);
      qc.invalidateQueries({ queryKey: ['delivery-job', jobId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed to file dispute'),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/api/v1/delivery/jobs/${jobId}/cancel`, { reason: 'Cancelled by user' }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Job cancelled.');
      qc.invalidateQueries({ queryKey: ['delivery-job', jobId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed to cancel'),
  });

  if (!jobId || typeof jobId !== 'string') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="w-12 h-12 text-brand-orange" />
        <p className="font-bold text-navy-700">Invalid delivery link.</p>
        <Link href="/demands" className="btn-primary">Back to Demands</Link>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle className="w-12 h-12 text-brand-orange" />
        <p className="font-bold text-navy-700">Delivery job not found or access denied.</p>
        <Link href="/demands" className="btn-primary">Back to Demands</Link>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[job.status] ?? 'bg-gray-400';
  const isBuyer = job.buyerId === user?.id;
  const canConfirm = job.status === 'DELIVERED' && isBuyer;
  const canCancel = ['BROADCAST', 'ACCEPTED'].includes(job.status);
  const canDispute = ['DELIVERED', 'COMPLETED'].includes(job.status) && !job.dispute;
  const isActive = !['COMPLETED', 'CANCELLED', 'RETURNED'].includes(job.status);

  const driverLat = job.driver?.currentLat != null ? Number(job.driver.currentLat) : null;
  const driverLng = job.driver?.currentLng != null ? Number(job.driver.currentLng) : null;
  const hasDriverPos = driverLat != null && driverLng != null && !isNaN(driverLat) && !isNaN(driverLng);

  const pickupLat = job.pickupGpsLat != null ? Number(job.pickupGpsLat) : null;
  const pickupLng = job.pickupGpsLng != null ? Number(job.pickupGpsLng) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </button>
          <Truck className="w-5 h-5 text-brand-blue" />
          <h1 className="text-lg font-black text-navy-700">Track Delivery</h1>
          {isActive && (
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse inline-block" />
              Live · 15 s
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Status hero */}
        <div className={`${statusColor} rounded-2xl p-5 text-white`}>
          <div className="flex items-center gap-2 mb-1">
            {MODE_ICONS[job.mode]}
            <span className="text-sm font-bold opacity-80">{job.mode.replace(/_/g, ' ')}</span>
            <span className="ml-auto text-xs font-bold bg-white/20 rounded-full px-2 py-0.5 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> 10 km delivery radius
            </span>
          </div>
          <p className="text-xl font-black">{STATUS_LABELS[job.status] ?? job.status}</p>
        </div>

        {/* Map */}
        {hasDriverPos && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Driver Location
            </p>
            <DriverMap lat={driverLat!} lng={driverLng!} />
          </div>
        )}

        {/* Pickup GPS (after confirmation) */}
        {pickupLat != null && pickupLng != null && !hasDriverPos && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Pickup Location
            </p>
            <DriverMap lat={pickupLat} lng={pickupLng} />
          </div>
        )}

        {/* Driver info */}
        {job.driver && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Driver
            </p>
            <InfoRow label="Name" value={`${job.driver.user.firstName} ${job.driver.user.lastName}`} />
            <InfoRow label="Phone" value={job.driver.user.phone} />
            <InfoRow label="Tier" value={job.driver.tier} />
          </div>
        )}

        {/* Job details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Job Details</p>
          <InfoRow label="Pickup zone" value={job.pickupZone} />
          <InfoRow label="Drop zone" value={job.dropZone} />
          {job.pickupAddress && <InfoRow label="Pickup address" value={job.pickupAddress} />}
          {job.dropAddress && <InfoRow label="Drop address" value={job.dropAddress} />}
          <InfoRow label="Item amount" value={formatCurrency(parseFloat(job.itemAmount))} />
          <InfoRow label="Delivery fee" value={formatCurrency(parseFloat(job.deliveryFee))} />
          <InfoRow label="Platform fee" value={formatCurrency(parseFloat(job.platformFee))} />
        </div>

        {/* Escrow */}
        {job.escrow && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-brand-green uppercase tracking-wide mb-3 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> SafePay Escrow
            </p>
            <InfoRow label="Status" value={job.escrow.status.replace(/_/g, ' ')} />
            <InfoRow label="Total held" value={formatCurrency(parseFloat(job.escrow.totalHeld))} />
          </div>
        )}

        {/* Dispute */}
        {job.dispute && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-brand-red uppercase tracking-wide mb-3 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Dispute
            </p>
            <InfoRow label="Status" value={job.dispute.status} />
            <InfoRow label="Reason" value={job.dispute.reason} />
            {job.dispute.resolution && <InfoRow label="Resolution" value={job.dispute.resolution} />}
          </div>
        )}

        {/* Actions */}
        {canConfirm && (
          <button
            onClick={() => {
              if (confirm('Confirm you received the item? This releases payment to the seller.')) {
                confirmMut.mutate();
              }
            }}
            disabled={confirmMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-4 bg-brand-green text-white font-black text-base rounded-2xl hover:bg-green-600 transition-colors disabled:opacity-60"
          >
            {confirmMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Confirm Receipt
          </button>
        )}

        {canDispute && !showDisputeForm && (
          <button
            onClick={() => setShowDisputeForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-orange text-white font-bold text-sm rounded-2xl hover:bg-orange-500 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" /> Open Dispute
          </button>
        )}

        {showDisputeForm && (
          <div className="bg-white rounded-2xl border-2 border-brand-orange p-4 space-y-3">
            <p className="font-black text-navy-700">Describe the issue</p>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="What went wrong? Be specific — this helps our team resolve it faster."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDisputeForm(false)}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => disputeMut.mutate()}
                disabled={!disputeReason.trim() || disputeMut.isPending}
                className="flex-1 py-3 bg-brand-orange text-white rounded-xl text-sm font-bold hover:bg-orange-500 transition-colors disabled:opacity-60"
              >
                {disputeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Dispute'}
              </button>
            </div>
          </div>
        )}

        {canCancel && (
          <button
            onClick={() => {
              if (confirm('Cancel this delivery job?')) cancelMut.mutate();
            }}
            disabled={cancelMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-brand-red text-brand-red font-bold text-sm rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            {cancelMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Job'}
          </button>
        )}
      </div>
    </div>
  );
}
