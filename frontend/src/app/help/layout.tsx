import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-black text-navy-700 text-sm">Help Centre</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-bold text-brand-blue">
            <Link href="/help" className="hover:underline">Get help</Link>
            <Link href="/help/faq" className="hover:underline">FAQ</Link>
            <Link href="/help/terms" className="hover:underline">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
