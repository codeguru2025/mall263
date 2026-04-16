'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { Loader2, MessageCircle } from 'lucide-react';

const TOPICS = [
  { value: 'account', label: 'Account & login' },
  { value: 'wallet', label: 'Wallet & payments' },
  { value: 'orders', label: 'Orders & delivery' },
  { value: 'seller', label: 'Selling & POS' },
  { value: 'demands', label: 'Demands & offers' },
  { value: 'services', label: 'Services marketplace' },
  { value: 'other', label: 'Something else' },
];

export default function HelpPage() {
  const user = useAuthStore((s) => s.user);
  const [topic, setTopic] = useState('other');
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState(
    user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
  );
  const [contactPhone, setContactPhone] = useState(user?.phone ?? '');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      toast.error('Please describe what you need in at least a few sentences.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/v1/support-requests', {
        topic: TOPICS.find((t) => t.value === topic)?.label ?? topic,
        message: message.trim(),
        ...(user
          ? {}
          : {
              contactName: contactName.trim(),
              contactPhone: contactPhone.trim(),
              ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
            }),
      });
      toast.success('Thanks — our team will review your request.');
      setMessage('');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : undefined;
      toast.error(
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Could not send your request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-navy-800">How can we help?</h1>
        <p className="text-gray-600 text-sm mt-2">
          Tell us what you need below, browse the{' '}
          <Link href="/help/faq" className="text-brand-blue font-bold hover:underline">
            FAQ
          </Link>
          , or message us on{' '}
          <a
            href="https://wa.me/263712171267"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green font-bold hover:underline inline-flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
          .
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Topic</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-navy-800 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none"
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
            What do you need?
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
            minLength={10}
            placeholder="Describe your question or issue in as much detail as you can (what happened, what you expected, order or stall names if relevant)."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-navy-800 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none resize-y"
          />
        </div>

        {!user && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Your name</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-navy-800 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Phone (Zimbabwe)
              </label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                placeholder="0771234567 or +263771234567"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-navy-800 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Email (optional)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-navy-800 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue outline-none"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Send request
        </button>
      </form>
    </div>
  );
}
