/**
 * Content identity.
 *
 * A grade must attach to the work, not to the file. The same essay re-exported
 * as a fresh PDF is a different byte sequence and an identical submission, so
 * the hash is taken over canonical text rather than over the upload.
 */

const ZERO_WIDTH = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g
const SMART_QUOTES: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-',
  '\u00A0': ' ', '\u2026': '...',
}

/**
 * Strips the differences an export pipeline introduces and nothing else.
 * Case and word order are meaningful in an essay and are left alone.
 */
export function canonicalise(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2013\u2014\u2212\u00A0\u2026]/g, (c) => SMART_QUOTES[c] ?? c)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const encoder = new TextEncoder()

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** sha256 over the canonical text. This is the content identity of a submission. */
export async function contentHash(raw: string): Promise<string> {
  return sha256Hex(canonicalise(raw))
}

export function shortHash(hex: string, head = 8, tail = 4): string {
  return `${hex.slice(0, head)}\u2026${hex.slice(-tail)}`
}
