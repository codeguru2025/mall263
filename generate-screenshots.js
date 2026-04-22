const { Jimp, loadFont } = require('jimp');
const path = require('path');
const fs = require('fs');

const NAVY   = 0x1B2A4AFF;
const ORANGE = 0xF97316FF;
const GREEN  = 0x22C55EFF;
const RED    = 0xEF4444FF;
const WHITE  = 0xFFFFFFFF;
const LGRAY  = 0xF3F4F6FF;
const MGRAY  = 0xE5E7EBFF;
const BLUE   = 0x3B82F6FF;
const DNAVY  = 0x253659FF;
const MNAVY  = 0x3D4F6AFF;

const outDir = 'apps/mobile/assets/screenshots';
fs.mkdirSync(outDir, { recursive: true });

const FP = 'C:/Users/ausiz/CascadeProjects/mall263/node_modules/@jimp/plugin-print/fonts/open-sans';

// Base design resolution
const BW = 1080, BH = 1920;

function fillRect(img, x, y, w, h, color) {
  x=Math.max(0,Math.round(x)); y=Math.max(0,Math.round(y));
  w=Math.max(0,Math.round(w)); h=Math.max(0,Math.round(h));
  const iw=img.bitmap.width, ih=img.bitmap.height;
  const x2=Math.min(x+w,iw), y2=Math.min(y+h,ih);
  const r=(color>>>24)&0xFF, g=(color>>>16)&0xFF, b=(color>>>8)&0xFF, a=color&0xFF;
  for(let py=y;py<y2;py++) for(let px=x;px<x2;px++){
    const i=(py*iw+px)*4;
    img.bitmap.data[i]=r; img.bitmap.data[i+1]=g; img.bitmap.data[i+2]=b; img.bitmap.data[i+3]=a;
  }
}

function roundedRect(img, x, y, w, h, r, color) {
  x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);r=Math.round(r);
  r=Math.min(r,Math.floor(w/2),Math.floor(h/2));
  fillRect(img,x+r,y,w-2*r,h,color);
  fillRect(img,x,y+r,r,h-2*r,color);
  fillRect(img,x+w-r,y+r,r,h-2*r,color);
  for(let cy=0;cy<r;cy++) for(let cx=0;cx<r;cx++){
    if((cx-r+.5)*(cx-r+.5)+(cy-r+.5)*(cy-r+.5)<=r*r){
      fillRect(img,x+cx,y+cy,1,1,color);
      fillRect(img,x+w-r+cx,y+cy,1,1,color);
      fillRect(img,x+cx,y+h-r+cy,1,1,color);
      fillRect(img,x+w-r+cx,y+h-r+cy,1,1,color);
    }
  }
}

function pr(img, font, x, y, text) {
  img.print({ font, x:Math.round(x), y:Math.round(y), text:String(text) });
}

// Make scalers bound to actual W/H
function makeScale(W, H) {
  return {
    x: v => v * W / BW,
    y: v => v * H / BH,
    // For sizes that should scale uniformly (font sizes, radii) use width
    s: v => v * W / BW,
  };
}

// ── SCREEN 1: Home / Marketplace ─────────────────────────────────────────────
async function drawHome(img, f, W, H) {
  const { x, y, s } = makeScale(W, H);
  fillRect(img, 0, 0, W, H, LGRAY);

  // Status bar
  fillRect(img, 0, 0, W, y(55), NAVY);
  pr(img, f.s16w, x(40), y(14), '9:41 AM');
  pr(img, f.s16w, W-x(160), y(14), 'WiFi  100%');

  // Header
  fillRect(img, 0, y(55), W, y(130), NAVY);
  pr(img, f.s64w, x(25), y(65), 'Mall263');
  pr(img, f.s16w, x(25), y(145), 'Zimbabwe Marketplace');

  // Search
  fillRect(img, 0, y(185), W, y(75), WHITE);
  roundedRect(img, x(20), y(192), W-x(40), y(58), s(10), LGRAY);
  pr(img, f.s16b, x(45), y(208), 'Search products, stalls...');

  // Category pills
  fillRect(img, 0, y(260), W, y(80), WHITE);
  const cats = ['All','Food','Fashion','Electr.','Services'];
  cats.forEach((cat, i) => {
    const cx = x(15) + i*x(208);
    if (cx + x(195) > W) return;
    roundedRect(img, cx, y(268), x(195), y(55), s(27), i===0?NAVY:MGRAY);
    pr(img, i===0?f.s16w:f.s16b, cx+x(22), y(283), cat);
  });

  // Featured label
  pr(img, f.s32b, x(20), y(362), 'Featured Products');

  // 2-col product cards — fill remaining height with 4 cards
  const cw = Math.floor((W - x(45)) / 2);
  const cardH = Math.floor((H - y(415) - y(115) - y(15)) / 2 - y(12));
  const imgH = Math.floor(cardH * 0.46);
  const products = [
    { name:'Fresh Tomatoes', price:'ZWL 250',   cat:'Food',    bg:0xFF6B6BFF },
    { name:"Classic Shirt",  price:'ZWL 1,500', cat:'Fashion', bg:0x4ECDC4FF },
    { name:'Phone Charger',  price:'ZWL 800',   cat:'Electr.', bg:0x45B7D1FF },
    { name:'Sugar 2kg',      price:'ZWL 350',   cat:'Grocery', bg:0x96CEB4FF },
  ];
  products.forEach((prod, i) => {
    const col = i%2, row = Math.floor(i/2);
    const px = x(15) + col*(cw+x(15));
    const py = y(408) + row*(cardH+y(12));
    roundedRect(img, px, py, cw, cardH, s(12), WHITE);
    fillRect(img, px, py, cw, imgH, prod.bg);
    roundedRect(img, px+x(10), py+y(10), x(120), y(36), s(6), 0x00000044);
    pr(img, f.s16w, px+x(20), py+y(18), prod.cat);
    pr(img, f.s16b, px+x(12), py+imgH+y(14), prod.name);
    pr(img, f.s32b, px+x(12), py+imgH+y(44), prod.price);
    const btnY = py + cardH - y(55);
    roundedRect(img, px+x(12), btnY, cw-x(24), y(44), s(8), NAVY);
    pr(img, f.s16w, px+x(38), btnY+y(13), 'Add to Cart');
  });

  // Bottom nav
  fillRect(img, 0, H-y(115), W, y(115), WHITE);
  fillRect(img, 0, H-y(115), W, y(2), MGRAY);
  const tabs = ['Home','Search','Wallet','Orders','Profile'];
  const tw = Math.floor(W/5);
  tabs.forEach((tab, i) => {
    const tx = i*tw + Math.floor((tw-x(50))/2);
    fillRect(img, tx, H-y(95), x(50), y(42), i===0?NAVY:LGRAY);
    pr(img, f.s16b, tx-x(5), H-y(42), tab);
  });
}

// ── SCREEN 2: Wallet ──────────────────────────────────────────────────────────
async function drawWallet(img, f, W, H) {
  const { x, y, s } = makeScale(W, H);
  fillRect(img, 0, 0, W, H, LGRAY);
  fillRect(img, 0, 0, W, y(55), NAVY);
  pr(img, f.s16w, x(40), y(14), '9:41 AM');
  pr(img, f.s16w, W-x(160), y(14), 'WiFi  100%');
  fillRect(img, 0, y(55), W, y(105), NAVY);
  pr(img, f.s32w, x(25), y(78), 'My Wallet');
  roundedRect(img, W-x(165), y(72), x(148), y(52), s(8), ORANGE);
  pr(img, f.s16w, W-x(150), y(88), '+ Add Money');

  // Balance card
  roundedRect(img, x(20), y(178), W-x(40), y(270), s(20), NAVY);
  pr(img, f.s16w, x(45), y(200), 'Total Available Balance');
  pr(img, f.s64w, x(45), y(235), 'ZWL 4,250');
  fillRect(img, x(40), y(322), W-x(80), y(2), MNAVY);
  roundedRect(img, x(40), y(334), x(258), y(75), s(10), DNAVY);
  pr(img, f.s16w, x(55), y(348), 'Locked');
  pr(img, f.s32w, x(55), y(372), 'ZWL 500');
  roundedRect(img, x(330), y(334), x(258), y(75), s(10), DNAVY);
  pr(img, f.s16w, x(345), y(348), 'Pending');
  pr(img, f.s32w, x(345), y(372), 'ZWL 200');

  // Quick actions
  const actions = ['Send','Receive','Pay','History'];
  const aw = Math.floor((W-x(60))/4);
  actions.forEach((a, i) => {
    const ax = x(15) + i*(aw+x(15));
    roundedRect(img, ax, y(472), aw, y(108), s(12), WHITE);
    fillRect(img, ax+x(18), y(482), x(58), y(52), NAVY);
    pr(img, f.s16b, ax+x(12), y(542), a);
  });

  // Transactions — fill remaining space
  pr(img, f.s32b, x(20), y(605), 'Recent Transactions');
  const txns = [
    { label:'Sale - Shirt x2',      amt:'+ZWL 3,000', sub:'Today 10:45  Cash',    c:GREEN },
    { label:'EcoCash Withdrawal',   amt:'-ZWL 800',   sub:'Today 08:15  EcoCash', c:RED   },
    { label:'Commission Earned',    amt:'+ZWL 450',   sub:'Yesterday  Auto',      c:GREEN },
    { label:'Purchase - Groceries', amt:'-ZWL 350',   sub:'Yesterday  Cash',      c:RED   },
    { label:'Wallet Top-up',        amt:'+ZWL 2,000', sub:'16 Apr  Paynow',       c:GREEN },
    { label:'Sale - Trousers x1',   amt:'+ZWL 2,200', sub:'15 Apr  EcoCash',      c:GREEN },
    { label:'Market Supplies',      amt:'-ZWL 620',   sub:'14 Apr  Cash',         c:RED   },
  ];
  const available = H - y(655) - y(115);
  const rowH = Math.floor(available / txns.length);
  txns.forEach((tx, i) => {
    const ty = y(650) + i*rowH;
    roundedRect(img, x(15), ty, W-x(30), rowH-y(8), s(10), WHITE);
    fillRect(img, x(25), ty+y(12), x(60), rowH-y(28), tx.c);
    pr(img, f.s16b, x(100), ty+y(12), tx.label);
    pr(img, f.s16b, x(100), ty+y(40), tx.sub);
    pr(img, f.s32b, W-x(280), ty+y(18), tx.amt);
  });

  fillRect(img, 0, H-y(115), W, y(115), WHITE);
  fillRect(img, 0, H-y(115), W, y(2), MGRAY);
}

// ── SCREEN 3: Product Detail ──────────────────────────────────────────────────
async function drawProductDetail(img, f, W, H) {
  const { x, y, s } = makeScale(W, H);
  fillRect(img, 0, 0, W, H, WHITE);
  fillRect(img, 0, 0, W, y(55), NAVY);
  pr(img, f.s16w, x(40), y(14), '9:41 AM');
  fillRect(img, 0, y(55), W, y(90), NAVY);
  pr(img, f.s32w, x(25), y(78), 'Product Detail');

  // Hero image — 42% of screen
  const heroH = Math.floor(H * 0.42);
  fillRect(img, 0, y(145), W, heroH, 0x4ECDC4FF);
  fillRect(img, x(250), y(145)+heroH/4, W-x(500), heroH/2, 0x3AB8AFFF);
  pr(img, f.s64w, x(340), y(145)+heroH/2-x(40), 'PHOTO');
  // dot nav
  for(let d=0;d<4;d++) roundedRect(img, W/2-x(45)+d*x(28), y(145)+heroH-y(30), x(18), x(18), x(9), d===0?WHITE:0xFFFFFF88);

  const infoY = y(145) + heroH + y(15);
  pr(img, f.s64b, x(20), infoY, 'ZWL 1,500');
  pr(img, f.s32b, x(20), infoY+y(75), "Men's Classic Shirt");
  pr(img, f.s16b, x(20), infoY+y(122), 'Fashion Hub Stall   4.8 stars  (124 reviews)');
  roundedRect(img, x(20), infoY+y(158), x(295), y(50), s(8), 0xDCFCE7FF);
  pr(img, f.s16b, x(35), infoY+y(170), 'In Stock  -  15 units left');
  fillRect(img, x(20), infoY+y(218), W-x(40), y(2), MGRAY);

  // Sizes
  pr(img, f.s32b, x(20), infoY+y(238), 'Size');
  const sizes = ['XS','S','M','L','XL'];
  sizes.forEach((sz, i) => {
    const bx = x(20)+i*x(118);
    roundedRect(img, bx, infoY+y(285), x(100), y(62), s(8), i===2?NAVY:LGRAY);
    pr(img, i===2?f.s16w:f.s16b, bx+x(30), infoY+y(302), sz);
  });

  // Description
  pr(img, f.s32b, x(20), infoY+y(368), 'Description');
  pr(img, f.s16b, x(20), infoY+y(415), 'Premium 100% cotton. Perfect for formal');
  pr(img, f.s16b, x(20), infoY+y(445), 'and casual occasions. Machine washable.');
  pr(img, f.s16b, x(20), infoY+y(475), 'Available in 5 colors and 5 sizes.');
  pr(img, f.s16b, x(20), infoY+y(515), 'Free delivery within Harare CBD.');

  // Seller info card
  roundedRect(img, x(20), infoY+y(558), W-x(40), y(88), s(10), LGRAY);
  fillRect(img, x(32), infoY+y(570), x(62), y(62), NAVY);
  pr(img, f.s16w, x(42), infoY+y(590), 'FH');
  pr(img, f.s32b, x(108), infoY+y(570), 'Fashion Hub Stall');
  pr(img, f.s16b, x(108), infoY+y(610), 'Harare CBD  •  Member since 2023');

  // CTA
  fillRect(img, 0, H-y(168), W, y(168), WHITE);
  fillRect(img, 0, H-y(168), W, y(2), MGRAY);
  pr(img, f.s16b, x(30), H-y(148), 'Quantity:');
  roundedRect(img, x(185), H-y(158), x(52), y(52), s(8), LGRAY);
  pr(img, f.s32b, x(200), H-y(147), '-');
  pr(img, f.s32b, x(255), H-y(147), '1');
  roundedRect(img, x(300), H-y(158), x(52), y(52), s(8), LGRAY);
  pr(img, f.s32b, x(315), H-y(147), '+');
  roundedRect(img, x(20), H-y(105), W-x(40), y(82), s(12), NAVY);
  pr(img, f.s32w, x(390), H-y(82), 'Add to Cart');
}

// ── SCREEN 4: Demands & Offers ────────────────────────────────────────────────
async function drawDemands(img, f, W, H) {
  const { x, y, s } = makeScale(W, H);
  fillRect(img, 0, 0, W, H, LGRAY);
  fillRect(img, 0, 0, W, y(55), NAVY);
  pr(img, f.s16w, x(40), y(14), '9:41 AM');
  fillRect(img, 0, y(55), W, y(105), NAVY);
  pr(img, f.s32w, x(25), y(78), 'Demands & Offers');
  roundedRect(img, W-x(168), y(72), x(150), y(52), s(8), ORANGE);
  pr(img, f.s16w, W-x(152), y(88), '+ Post Demand');

  // Tabs
  fillRect(img, 0, y(160), W, y(75), WHITE);
  pr(img, f.s32b, x(35), y(175), 'My Demands');
  fillRect(img, x(20), y(228), x(238), y(5), NAVY);
  pr(img, f.s32b, x(360), y(175), 'Browse');

  const demands = [
    { title:'Rice 5kg bags wanted',       budget:'ZWL 600',   cat:'Groceries',   offers:3, time:'2h ago',  hot:true  },
    { title:'School uniforms - size 10',  budget:'ZWL 2,500', cat:'Clothing',    offers:7, time:'5h ago',  hot:true  },
    { title:'iPhone 12 charger needed',   budget:'ZWL 800',   cat:'Electronics', offers:1, time:'1d ago',  hot:false },
    { title:'Weekly fresh veg supply',    budget:'ZWL 1,200', cat:'Food',        offers:5, time:'1d ago',  hot:true  },
    { title:'HP ink cartridges 680',      budget:'ZWL 950',   cat:'Office',      offers:2, time:'2d ago',  hot:false },
    { title:'Leather school shoes sz 6',  budget:'ZWL 1,800', cat:'Footwear',    offers:4, time:'3d ago',  hot:false },
  ];

  const listStart = y(248);
  const listEnd = H - y(115);
  const rowH = Math.floor((listEnd - listStart) / demands.length);

  demands.forEach((d, i) => {
    const dy = listStart + i*rowH;
    roundedRect(img, x(15), dy+y(4), W-x(30), rowH-y(8), s(12), WHITE);
    if (d.hot) {
      roundedRect(img, W-x(145), dy+y(16), x(125), y(38), s(8), 0xFEF3C7FF);
      pr(img, f.s16b, W-x(132), dy+y(24), 'HOT');
    }
    roundedRect(img, x(25), dy+y(16), x(200), y(38), s(6), LGRAY);
    pr(img, f.s16b, x(38), dy+y(24), d.cat);
    pr(img, f.s32b, x(25), dy+y(65), d.title.substring(0,30));
    pr(img, f.s16b, x(25), dy+y(108), 'Budget: ' + d.budget + '  -  ' + d.offers + ' offers  -  ' + d.time);
    roundedRect(img, W-x(215), dy+rowH-y(52), x(190), y(40), s(8), NAVY);
    pr(img, f.s16w, W-x(202), dy+rowH-y(43), 'View Offers');
  });

  fillRect(img, 0, H-y(115), W, y(115), WHITE);
  fillRect(img, 0, H-y(115), W, y(2), MGRAY);
}

// ── SCREEN 5: POS Dashboard ───────────────────────────────────────────────────
async function drawPOS(img, f, W, H) {
  const { x, y, s } = makeScale(W, H);
  fillRect(img, 0, 0, W, H, LGRAY);
  fillRect(img, 0, 0, W, y(55), NAVY);
  pr(img, f.s16w, x(40), y(14), '9:41 AM');
  fillRect(img, 0, y(55), W, y(105), NAVY);
  pr(img, f.s32w, x(25), y(78), 'Point of Sale');
  pr(img, f.s16w, W-x(228), y(88), 'Fashion Hub Stall');

  // 2x2 stat cards
  const stats = [
    { label:"Today's Sales", val:'ZWL 8,450', c:GREEN  },
    { label:'Transactions',  val:'23',        c:BLUE   },
    { label:'Items Sold',    val:'47',        c:ORANGE },
    { label:'Refunds',       val:'1',         c:RED    },
  ];
  const sw = Math.floor((W-x(45))/2);
  const sh = y(175);
  stats.forEach((st, i) => {
    const col=i%2, row=Math.floor(i/2);
    const sx=x(15)+col*(sw+x(15)), sy=y(178)+row*(sh+y(12));
    roundedRect(img, sx, sy, sw, sh, s(12), WHITE);
    fillRect(img, sx+x(22), sy+y(22), x(58), y(58), st.c);
    pr(img, f.s16b, sx+x(22), sy+y(96), st.label);
    pr(img, f.s32b, sx+x(22), sy+y(124), st.val);
  });

  // New Sale CTA
  const btnY = y(178) + 2*(sh+y(12)) + y(12);
  roundedRect(img, x(20), btnY, W-x(40), y(88), s(12), GREEN);
  pr(img, f.s32w, x(400), btnY+y(26), '+ New Sale');

  // Recent sales — fill remaining space
  const salesY = btnY + y(105);
  pr(img, f.s32b, x(20), salesY, 'Recent Sales');
  const sales = [
    { item:"Men's Shirt x2",    amt:'ZWL 3,000', t:'10:45 AM', m:'Cash'    },
    { item:"Trousers x1",       amt:'ZWL 2,200', t:'10:12 AM', m:'EcoCash' },
    { item:"Ladies Blouse x1",  amt:'ZWL 1,800', t:'09:30 AM', m:'Cash'    },
    { item:"Belt + Socks",      amt:'ZWL 650',   t:'09:05 AM', m:'Paynow'  },
    { item:"School Shirt x3",   amt:'ZWL 800',   t:'08:50 AM', m:'Cash'    },
    { item:"Jeans x1",          amt:'ZWL 2,500', t:'08:20 AM', m:'EcoCash' },
    { item:"Sneakers x1",       amt:'ZWL 3,200', t:'08:00 AM', m:'Cash'    },
  ];
  const listTop = salesY + y(52);
  const listBot = H - y(115);
  const rh = Math.floor((listBot - listTop) / sales.length);
  sales.forEach((sale, i) => {
    const sy = listTop + i*rh;
    roundedRect(img, x(15), sy+y(4), W-x(30), rh-y(8), s(10), WHITE);
    fillRect(img, x(25), sy+y(12), x(62), rh-y(24), NAVY);
    pr(img, f.s16w, x(36), sy+rh/2-y(12), 'POS');
    pr(img, f.s16b, x(102), sy+y(12), sale.item);
    pr(img, f.s16b, x(102), sy+y(40), sale.t + '  ' + sale.m);
    pr(img, f.s32b, W-x(272), sy+y(18), sale.amt);
  });

  fillRect(img, 0, H-y(115), W, y(115), WHITE);
  fillRect(img, 0, H-y(115), W, y(2), MGRAY);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const screens = [
  { fn: drawHome,          name: '01_home' },
  { fn: drawWallet,        name: '02_wallet' },
  { fn: drawProductDetail, name: '03_product_detail' },
  { fn: drawDemands,       name: '04_demands' },
  { fn: drawPOS,           name: '05_pos' },
];

const platforms = [
  { name: 'iphone',  W: 1290, H: 2796 },
  { name: 'android', W: 1080, H: 1920 },
];

(async () => {
  console.log('Loading fonts...');
  const fonts = {
    s16w: await loadFont(FP + '/open-sans-16-white/open-sans-16-white.fnt'),
    s32w: await loadFont(FP + '/open-sans-32-white/open-sans-32-white.fnt'),
    s64w: await loadFont(FP + '/open-sans-64-white/open-sans-64-white.fnt'),
    s16b: await loadFont(FP + '/open-sans-16-black/open-sans-16-black.fnt'),
    s32b: await loadFont(FP + '/open-sans-32-black/open-sans-32-black.fnt'),
    s64b: await loadFont(FP + '/open-sans-64-black/open-sans-64-black.fnt'),
  };
  console.log('Generating...');
  for (const plat of platforms) {
    for (const screen of screens) {
      const img = new Jimp({ width: plat.W, height: plat.H, color: WHITE });
      await screen.fn(img, fonts, plat.W, plat.H);
      const filename = path.join(outDir, `${plat.name}_${screen.name}.png`);
      await img.write(filename);
      console.log('Saved:', filename);
    }
  }
  console.log('\nAll 10 screenshots done!');
})();
