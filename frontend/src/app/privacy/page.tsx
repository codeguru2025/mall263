import Link from 'next/link';
import { Logo } from '@/components/Logo';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy – Mall263',
  description: 'How Mall263 collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-black text-navy-700 text-sm">Mall263</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-bold text-brand-blue">
            <Link href="/help" className="hover:underline">Help</Link>
            <Link href="/help/terms" className="hover:underline">Terms</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <article className="max-w-none text-navy-800 text-sm leading-relaxed space-y-6">
          <div>
            <h1 className="text-2xl font-black text-navy-900">Privacy Policy</h1>
            <p className="text-gray-500 mt-1 text-xs">Effective date: 18 April 2026 &nbsp;·&nbsp; Last updated: 18 April 2026</p>
            <p className="text-gray-700 mt-3">
              Mall263 (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the Mall263 mobile app and website
              (collectively, the &ldquo;Platform&rdquo;). This policy explains what personal information we collect, why we
              collect it, how we use it, and the rights you have over your data. By using the Platform you agree to this policy.
            </p>
          </div>

          <section>
            <h2 className="text-lg font-bold text-navy-900">1. Information we collect</h2>

            <h3 className="font-semibold text-navy-800 mt-4 mb-1">1.1 Information you provide directly</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li><span className="font-semibold">Phone number</span> — used to create and authenticate your account. Required to use the Platform.</li>
              <li><span className="font-semibold">Name</span> — used to personalise your experience and display on listings.</li>
              <li><span className="font-semibold">Profile photo</span> — optional; shown on your public profile and stall pages.</li>
              <li><span className="font-semibold">Product and stall information</span> — names, descriptions, prices, and images you list as a seller.</li>
              <li><span className="font-semibold">Messages</span> — content you send through in-app chat between buyers and sellers.</li>
              <li><span className="font-semibold">Support requests</span> — information you share when contacting our Help Centre.</li>
            </ul>

            <h3 className="font-semibold text-navy-800 mt-4 mb-1">1.2 Information collected automatically</h3>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li><span className="font-semibold">Device information</span> — device model, operating system version, and unique device identifiers, used for push notifications and fraud prevention.</li>
              <li><span className="font-semibold">App usage data</span> — screens visited, features used, and actions taken, to improve the Platform and diagnose issues.</li>
              <li><span className="font-semibold">Location</span> — approximate location for delivery features and driver job matching. Precise GPS is requested only when you use driver or delivery features, and only while the app is in use.</li>
              <li><span className="font-semibold">Log data</span> — IP address, timestamps, and crash reports via Sentry for stability monitoring.</li>
            </ul>

            <h3 className="font-semibold text-navy-800 mt-4 mb-1">1.3 Financial data</h3>
            <p className="text-gray-700">
              We record wallet deposits, withdrawals, and transaction history within the Platform. We do not store full card numbers.
              Payments are processed through Paynow Zimbabwe; their privacy policy applies to payment processing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">2. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>To create and secure your account and verify your identity.</li>
              <li>To process transactions, manage your wallet, and provide receipts.</li>
              <li>To connect buyers with sellers and facilitate delivery.</li>
              <li>To send push notifications about orders, messages, and account activity (you can opt out in settings).</li>
              <li>To detect and prevent fraud, money-laundering, and abuse.</li>
              <li>To comply with applicable Zimbabwean law and regulatory obligations.</li>
              <li>To improve, personalise, and expand the Platform.</li>
              <li>To respond to your support requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">3. How we share your information</h2>
            <p className="text-gray-700">We do <span className="font-semibold">not</span> sell your personal information. We share data only as follows:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-700 mt-2">
              <li><span className="font-semibold">Between buyers and sellers</span> — limited profile information is shared to facilitate deals you initiate.</li>
              <li><span className="font-semibold">Service providers</span> — hosting (DigitalOcean), error monitoring (Sentry), search (Meilisearch), and payment processing (Paynow Zimbabwe) — bound by data-processing agreements.</li>
              <li><span className="font-semibold">Law enforcement / regulators</span> — when required by valid legal process or Zimbabwean law.</li>
              <li><span className="font-semibold">Business transfers</span> — if Mall263 is acquired or merges, your data may transfer to the new owner under the same protections.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">4. Data retention</h2>
            <p className="text-gray-700">
              We retain your personal data for as long as your account is active or as needed to provide our services. Transaction
              and wallet records are retained for at least 7 years to comply with financial regulations. If you request deletion,
              we will remove or anonymise personal data within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">5. Security</h2>
            <p className="text-gray-700">
              We use industry-standard measures including HTTPS encryption, hashed passwords, JWT-based authentication, and
              database-level access controls. No method of transmission over the internet is 100% secure; we work continuously
              to protect your data but cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">6. Children&apos;s privacy</h2>
            <p className="text-gray-700">
              Mall263 is not directed at children under 13. We do not knowingly collect personal information from children
              under 13. If you believe a child has provided us personal data, contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">7. Your rights</h2>
            <p className="text-gray-700">You may at any time:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-700 mt-2">
              <li><span className="font-semibold">Access</span> — request a copy of the personal data we hold about you.</li>
              <li><span className="font-semibold">Correct</span> — update inaccurate information through your profile settings.</li>
              <li><span className="font-semibold">Delete</span> — request deletion of your account and associated personal data.</li>
              <li><span className="font-semibold">Opt out of notifications</span> — disable push notifications in the app or device settings.</li>
            </ul>
            <p className="text-gray-700 mt-2">
              To exercise these rights, email us at{' '}
              <a href="mailto:ausiziba@gmail.com" className="text-brand-blue font-semibold hover:underline">
                ausiziba@gmail.com
              </a>{' '}
              or use the Help Centre. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">8. Third-party links</h2>
            <p className="text-gray-700">
              The Platform may contain links to external websites. We are not responsible for the privacy practices of those sites
              and encourage you to review their policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">9. Changes to this policy</h2>
            <p className="text-gray-700">
              We may update this policy from time to time. We will notify you of material changes via the app or by updating the
              effective date above. Continued use of the Platform after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-navy-900">10. Contact us</h2>
            <p className="text-gray-700">For privacy questions or data requests, contact:</p>
            <address className="not-italic mt-2 text-gray-700 space-y-0.5">
              <p className="font-semibold">Mall263 Privacy Team</p>
              <p>
                Email:{' '}
                <a href="mailto:ausiziba@gmail.com" className="text-brand-blue font-semibold hover:underline">
                  ausiziba@gmail.com
                </a>
              </p>
              <p>
                WhatsApp:{' '}
                <a href="https://wa.me/263712171267" className="text-brand-blue font-semibold hover:underline">
                  +263 71 217 1267
                </a>
              </p>
              <p>
                Help Centre:{' '}
                <Link href="/help" className="text-brand-blue font-semibold hover:underline">
                  mall263-r99jz.ondigitalocean.app/help
                </Link>
              </p>
            </address>
          </section>
        </article>
      </main>

      <footer className="border-t border-gray-100 bg-white mt-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <Link href="/privacy" className="hover:underline font-semibold text-navy-700">Privacy Policy</Link>
          <Link href="/help/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/help/faq" className="hover:underline">FAQ</Link>
          <Link href="/help" className="hover:underline">Help Centre</Link>
        </div>
      </footer>
    </div>
  );
}
