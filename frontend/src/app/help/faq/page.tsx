import Link from 'next/link';

const FAQ = [
  {
    q: 'How do I pay for something on Mall263?',
    a: 'Most purchases use your in-app wallet. You can fund your wallet from supported mobile money or bank methods where available. Sellers may also accept cash at pickup depending on the listing.',
  },
  {
    q: 'How do I become a seller?',
    a: 'Create an account and choose the seller (stall owner) path during registration. Complete your stall details and list your products. Our team or a field agent may verify your stall before you go live.',
  },
  {
    q: 'What is a “demand”?',
    a: 'Buyers can post what they are looking for. Sellers submit offers. If you accept an offer, the platform rules around wallet holds and messaging apply until the deal is completed.',
  },
  {
    q: 'I cannot log in or I forgot my password.',
    a: 'Use the phone-based login flow on the sign-in page. If you are still stuck, use the Help Centre form on this site or WhatsApp our support line so we can verify your account safely.',
  },
  {
    q: 'How do I contact support?',
    a: 'Use the Get help page to describe your issue, or message us on WhatsApp at +263 71 217 1267. Please do not share passwords or one-time PINs with anyone claiming to be support.',
  },
];

export default function HelpFaqPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-800">Frequently asked questions</h1>
        <p className="text-gray-600 text-sm mt-2">
          Quick answers about buying, selling, and using Mall263. Still stuck?{' '}
          <Link href="/help" className="text-brand-blue font-bold hover:underline">
            Send us a request
          </Link>
          .
        </p>
      </div>
      <div className="divide-y divide-gray-100 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {FAQ.map((item) => (
          <div key={item.q} className="p-5 sm:p-6">
            <h2 className="font-bold text-navy-800 text-sm sm:text-base">{item.q}</h2>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
