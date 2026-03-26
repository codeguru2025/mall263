export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bag shape */}
        <path d="M20 35L15 90C15 93 17 95 20 95H80C83 95 85 93 85 90L80 35H20Z" fill="#3B9AE1"/>
        <path d="M20 35L15 90C15 93 17 95 20 95H55L65 35H20Z" fill="#43A047"/>
        <path d="M35 50L15 90C15 93 17 95 20 95H45L55 50H35Z" fill="#FFC107"/>
        <path d="M40 60L15 90C15 93 17 95 20 95H35L45 60H40Z" fill="#F7941D"/>
        <path d="M42 65L15 90C15 93 17 95 20 95H30L40 65H42Z" fill="#E53935"/>
        {/* Handle */}
        <path d="M35 35C35 22 40 15 50 15C60 15 65 22 65 35" stroke="#1B2A4A" strokeWidth="5" fill="none" strokeLinecap="round"/>
        {/* Location pin */}
        <circle cx="50" cy="62" r="14" fill="white" opacity="0.9"/>
        <path d="M50 52C45 52 41 56 41 61C41 68 50 76 50 76C50 76 59 68 59 61C59 56 55 52 50 52ZM50 64C48.3 64 47 62.7 47 61C47 59.3 48.3 58 50 58C51.7 58 53 59.3 53 61C53 62.7 51.7 64 50 64Z" fill="#F7941D"/>
      </svg>
      <div className="flex items-baseline">
        <span className="font-black text-brand-navy tracking-tight" style={{ fontSize: size * 0.5 }}>MALL</span>
        <span className="font-black tracking-tight" style={{ fontSize: size * 0.5 }}>
          <span className="text-brand-green">2</span>
          <span className="text-brand-orange">6</span>
          <span className="text-brand-red">3</span>
        </span>
      </div>
    </div>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 35L15 90C15 93 17 95 20 95H80C83 95 85 93 85 90L80 35H20Z" fill="#3B9AE1"/>
      <path d="M20 35L15 90C15 93 17 95 20 95H55L65 35H20Z" fill="#43A047"/>
      <path d="M35 50L15 90C15 93 17 95 20 95H45L55 50H35Z" fill="#FFC107"/>
      <path d="M40 60L15 90C15 93 17 95 20 95H35L45 60H40Z" fill="#F7941D"/>
      <path d="M42 65L15 90C15 93 17 95 20 95H30L40 65H42Z" fill="#E53935"/>
      <path d="M35 35C35 22 40 15 50 15C60 15 65 22 65 35" stroke="#1B2A4A" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <circle cx="50" cy="62" r="14" fill="white" opacity="0.9"/>
      <path d="M50 52C45 52 41 56 41 61C41 68 50 76 50 76C50 76 59 68 59 61C59 56 55 52 50 52ZM50 64C48.3 64 47 62.7 47 61C47 59.3 48.3 58 50 58C51.7 58 53 59.3 53 61C53 62.7 51.7 64 50 64Z" fill="#F7941D"/>
    </svg>
  );
}
