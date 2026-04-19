/**
 * Mall263 ACID test suite
 * Registers ephemeral test accounts, runs invariant checks, cleans up.
 *
 * Run: node acid-test.mjs
 */

const BASE = 'https://mall263-r99jz.ondigitalocean.app';
const TS   = Date.now().toString().slice(-7);

let passed = 0;
let failed = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? `  →  ${detail}` : ''}`);
    failed++;
  }
}

async function register(role, suffix) {
  const phone = `+26377${TS}${suffix}`;
  const { status, data } = await req('POST', '/api/v1/auth/register', {
    phone, password: 'AcidTest99!',
    firstName: `Acid${role}`, lastName: 'Test', role,
  });
  if (status !== 201 || !data?.accessToken) {
    throw new Error(`Register ${role} failed: ${status} ${JSON.stringify(data)}`);
  }
  return { token: data.accessToken, userId: data.user.id, phone };
}

// ── 1. Auth sanity ─────────────────────────────────────────────────────────────

async function testAuth() {
  console.log('\n[1] Auth sanity');

  const { status: s1 } = await req('POST', '/api/v1/auth/login', {
    phone: '+263771000001', password: 'WRONG_PASSWORD',
  });
  assert('Wrong password → 401', s1 === 401, `got ${s1}`);

  const buyer = await register('BUYER', '0');
  assert('Fresh buyer registration → token', !!buyer.token);

  // Verify /me works
  const { status: ms } = await req('GET', '/api/v1/users/me', null, buyer.token);
  assert('/me with valid token → 200', ms === 200, `got ${ms}`);

  // Expired / garbage token
  const { status: bs } = await req('GET', '/api/v1/users/me', null, 'garbage.token.here');
  assert('Garbage token → 401', bs === 401, `got ${bs}`);

  return buyer;
}

// ── 2. Follow / Unfollow ACID ──────────────────────────────────────────────────

async function testFollowAcid(buyerToken) {
  console.log('\n[2] Follow / Unfollow ACID');

  // Resolve a stall ID from the browse endpoint (stall field on each product)
  const { data: browse } = await req('GET', '/api/v1/products/browse?limit=5');
  const stallId = browse?.data?.find(p => p?.stall?.id)?.stall?.id;
  if (!stallId) { console.log('  ⚠ No stallId resolvable — skipping follow ACID'); return; }

  console.log(`  Using stall: ${stallId}`);

  // Clean state
  await req('DELETE', `/api/v1/stalls/${stallId}/follow`, null, buyerToken);

  // Follow once
  const { status: f1, data: fd1 } = await req('POST', `/api/v1/stalls/${stallId}/follow`, null, buyerToken);
  assert('Follow → 200/201', f1 === 200 || f1 === 201, `got ${f1}`);
  const count1 = fd1?.followerCount;
  assert('followStall returns followerCount', typeof count1 === 'number', `got ${typeof count1}`);
  assert('followStall returns following:true', fd1?.following === true, `got ${fd1?.following}`);

  // Follow again — idempotent, count must not change
  const { status: f2, data: fd2 } = await req('POST', `/api/v1/stalls/${stallId}/follow`, null, buyerToken);
  assert('Double-follow is idempotent (no error)', f2 === 200 || f2 === 201, `got ${f2}`);
  assert('Double-follow does not inflate count', fd2?.followerCount === count1,
    `count after 1st follow=${count1}, after 2nd=${fd2?.followerCount}`);

  // Unfollow
  const { status: u1, data: ud1 } = await req('DELETE', `/api/v1/stalls/${stallId}/follow`, null, buyerToken);
  assert('Unfollow → 200/201', u1 === 200 || u1 === 201, `got ${u1}`);
  assert('Unfollow returns following:false', ud1?.following === false, `got ${ud1?.following}`);
  assert('Unfollow decrements count', ud1?.followerCount === count1 - 1,
    `before=${count1} after=${ud1?.followerCount}`);

  // Unfollow again — idempotent
  const { status: u2, data: ud2 } = await req('DELETE', `/api/v1/stalls/${stallId}/follow`, null, buyerToken);
  assert('Double-unfollow is idempotent (no error)', u2 === 200 || u2 === 201, `got ${u2}`);
  assert('Double-unfollow count stable', ud2?.followerCount === ud1?.followerCount,
    `1st unfollow=${ud1?.followerCount}, 2nd=${ud2?.followerCount}`);

  // Non-existent stall → 404
  const { status: u3 } = await req('DELETE', `/api/v1/stalls/00000000-0000-0000-0000-000000000000/follow`, null, buyerToken);
  assert('Unfollow unknown stallId → 404', u3 === 404, `got ${u3}`);

  // Unauthenticated follow → 401
  const { status: ua } = await req('POST', `/api/v1/stalls/${stallId}/follow`, null, null);
  assert('Unauthenticated follow → 401', ua === 401, `got ${ua}`);
}

// ── 3. Demand delivery location ────────────────────────────────────────────────

async function testDemandDeliveryLocation(buyerToken) {
  console.log('\n[3] Demand — deliveryLocation');

  const loc = 'Bulawayo CBD, Corner 9th Ave & Jason Moyo St';

  // Create demand with deliveryLocation
  const { status: cs, data: cd } = await req('POST', '/api/v1/demands', {
    title: '[ACID-TEST] ignore this demand',
    maxBudget: 1.00,
    urgency: 'LOW',
    deliveryLocation: loc,
  }, buyerToken);
  assert('Create demand with deliveryLocation → 201', cs === 201, `got ${cs} — ${JSON.stringify(cd)?.slice(0, 120)}`);
  if (cs !== 201) return;

  // Round-trip: fetch and verify deliveryLocation preserved
  const { status: gs, data: gd } = await req('GET', `/api/v1/demands/${cd.id}`, null, buyerToken);
  assert('Fetch demand → 200', gs === 200, `got ${gs}`);
  assert('deliveryLocation round-trips exactly', gd?.deliveryLocation === loc,
    `expected "${loc}" got "${gd?.deliveryLocation}"`);

  // XSS payload should be rejected by @Matches validation
  const { status: xs } = await req('POST', '/api/v1/demands', {
    title: '[ACID-TEST] xss',
    maxBudget: 1.00,
    deliveryLocation: '<script>alert(1)</script>',
  }, buyerToken);
  assert('XSS in deliveryLocation → 400', xs === 400, `got ${xs}`);

  // MaxLength boundary: 501 chars should fail
  const { status: ls } = await req('POST', '/api/v1/demands', {
    title: '[ACID-TEST] too long location',
    maxBudget: 1.00,
    deliveryLocation: 'A'.repeat(501),
  }, buyerToken);
  assert('deliveryLocation > 500 chars → 400', ls === 400, `got ${ls}`);

  // Exactly 500 chars of valid characters should pass
  const { status: ok500 } = await req('POST', '/api/v1/demands', {
    title: '[ACID-TEST] max length location',
    maxBudget: 1.00,
    deliveryLocation: 'A'.repeat(500),
  }, buyerToken);
  assert('deliveryLocation = 500 chars → 201', ok500 === 201, `got ${ok500}`);
}

// ── 4. USSD payment — auth & idempotency ──────────────────────────────────────

async function testUssdPaymentAcid(buyerToken) {
  console.log('\n[4] USSD merchant payment — auth & idempotency');

  // Buyer role cannot initiate — expect 403
  const { status: rs } = await req('POST', '/api/v1/pos/merchant-payment/initiate', {
    stallId: '00000000-0000-0000-0000-000000000000',
    items: [],
    paymentMethod: 'ECOCASH',
  }, buyerToken);
  assert('BUYER role initiate → 403', rs === 403, `got ${rs}`);

  // Unauthenticated initiate → 401
  const { status: us1 } = await req('POST', '/api/v1/pos/merchant-payment/initiate', {
    stallId: '00000000-0000-0000-0000-000000000000',
    items: [], paymentMethod: 'ECOCASH',
  }, null);
  assert('Unauthenticated initiate → 401', us1 === 401, `got ${us1}`);

  // Unauthenticated confirm → 401
  const { status: us2 } = await req('POST', '/api/v1/pos/merchant-payment/confirm/FAKE-REF', null, null);
  assert('Unauthenticated confirm → 401', us2 === 401, `got ${us2}`);

  // Confirm non-existent reference → 400
  const { status: cs } = await req('POST', '/api/v1/pos/merchant-payment/confirm/ACID-FAKE-REF-0000', null, buyerToken);
  // buyerToken is wrong role but server checks role before Redis lookup — expect 403
  // With correct role but bad ref it should be 400; with wrong role it should be 403
  assert('Non-existent reference confirm → 400 or 403', cs === 400 || cs === 403, `got ${cs}`);
}

// ── 5. Receipt verification ────────────────────────────────────────────────────

async function testReceiptVerification() {
  console.log('\n[5] Public receipt verification');

  // Non-existent UUID → 200 with authentic:false (not 404)
  const { status, data } = await req('GET', '/api/v1/pos/receipts/verify/00000000-0000-0000-0000-000000000000');
  assert('Unknown saleId → 200 with authentic:false', status === 200 && data?.authentic === false,
    `status=${status} authentic=${data?.authentic}`);

  // Non-UUID → should not 500
  const { status: ns } = await req('GET', '/api/v1/pos/receipts/verify/not-a-uuid');
  assert('Non-UUID saleId → non-500', ns !== 500, `got ${ns}`);

  // No auth required (public endpoint)
  // Already tested above without a token
  assert('Receipt verify is public (no auth needed)', status === 200, `got ${status}`);
}

// ── 6. Concurrent follow stress ────────────────────────────────────────────────

async function testConcurrentFollow(buyerToken, buyerToken2) {
  console.log('\n[6] Concurrent follow stress (same stall, two users)');

  if (!buyerToken2) { console.log('  ⚠ Second buyer not available — skipping'); return; }

  // Find a stall
  const { data: malls } = await req('GET', '/api/v1/stalls/malls');
  const mallId = malls?.[0]?.id;
  if (!mallId) { console.log('  ⚠ No stalls for concurrent test'); return; }

  // Resolve stall from browse endpoint
  const { data: browse } = await req('GET', '/api/v1/products/browse?limit=5');
  const stallId = browse?.data?.find(p => p?.stall?.id)?.stall?.id;
  if (!stallId) { console.log('  ⚠ No stall found — skipping concurrent test'); return; }

  console.log(`  Using stall: ${stallId}`);

  // Get baseline count
  const { data: base } = await req('GET', `/api/v1/stalls/${stallId}/follow-status`, null, buyerToken);
  const baseline = base?.followerCount ?? 0;

  // Both users follow simultaneously
  const [r1, r2] = await Promise.all([
    req('POST', `/api/v1/stalls/${stallId}/follow`, null, buyerToken),
    req('POST', `/api/v1/stalls/${stallId}/follow`, null, buyerToken2),
  ]);
  assert('Both concurrent follows succeed', (r1.status === 200 || r1.status === 201) && (r2.status === 200 || r2.status === 201),
    `user1=${r1.status} user2=${r2.status}`);

  // Get final count
  const { data: final } = await req('GET', `/api/v1/stalls/${stallId}/follow-status`, null, buyerToken);
  const expectedCount = baseline + 2;
  assert(`Count after 2 concurrent follows = baseline+2 (${baseline}→${expectedCount})`,
    final?.followerCount === expectedCount,
    `expected ${expectedCount} got ${final?.followerCount}`);

  // Clean up
  await Promise.all([
    req('DELETE', `/api/v1/stalls/${stallId}/follow`, null, buyerToken),
    req('DELETE', `/api/v1/stalls/${stallId}/follow`, null, buyerToken2),
  ]);
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Mall263 ACID Test Suite');
  console.log(`  Target : ${BASE}`);
  console.log(`  Run ID : ${TS}`);
  console.log(`${'═'.repeat(60)}`);

  let buyer, buyer2;
  try {
    buyer  = await testAuth();
    buyer2 = await register('BUYER', '1');

    await testFollowAcid(buyer.token);
    await testDemandDeliveryLocation(buyer.token);
    await testUssdPaymentAcid(buyer.token);
    await testReceiptVerification();
    await testConcurrentFollow(buyer.token, buyer2.token);
  } catch (err) {
    console.error('\nFATAL:', err.message);
    failed++;
  }

  console.log(`\n${'═'.repeat(60)}`);
  const total = passed + failed;
  console.log(`  Results : ${passed}/${total} passed${failed > 0 ? `, ${failed} FAILED` : ' — all green'}`);
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
