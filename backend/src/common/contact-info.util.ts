/**
 * Shared utility for detecting contact-information leakage in product text
 * and images.  Both the products service (description validation) and the
 * image-moderation service (OCR output validation) import from here so the
 * rules stay in one place.
 *
 * Descriptions must only describe the product: what it is, its features,
 * materials, sizes, and care instructions.  Nothing else is permitted.
 */

export const CONTACT_LEAK_PATTERNS: RegExp[] = [
  // Zimbabwe mobile numbers: 07x xxxxxxx | +263 7x xxxxxxx | 263 7x xxxxxxx
  /\+?(?:263|0)7[1-9]\s*\d{3}\s*\d{4}/,
  // Any WhatsApp reference or wa.me link
  /\bwh?a+ts?a+pp?\b|wa\.me\//i,
  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  // Social-media handles  (@username)
  /(?<![a-zA-Z0-9])@[a-zA-Z0-9_.]{2,}/,
  // External URLs
  /https?:\/\/|www\.[a-z]/i,
  // Explicit "call / text / inbox me" phrases
  /\b(?:call|text|inbox|ping|reach|message)\s+(?:me|us|him|her)\b/i,
  // Off-platform ordering language
  /\b(?:order|buy|shop|purchase|dm|inbox)\s+(?:via|on|through|at|from)\b/i,
  /\b(?:whatsapp|telegram|instagram|facebook|tiktok|twitter|snapchat)\s+(?:order|me|us|for|to\s+order)\b/i,
  // Zimbabwe physical address patterns
  /\b(?:house|stand|flat|plot|unit)\s*no\.?\s*\d+/i,
  /\b\d+\s+\w+\s+(?:avenue|street|road|drive|crescent|lane|close|way)\b/i,
  /\bcnr\b|\bcorner\s+of\b/i,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_LEAK_PATTERNS.some((re) => re.test(text));
}
