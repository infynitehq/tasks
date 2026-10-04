export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function normalizePairingCode(value: string): string | null {
  const code = value.toUpperCase().replace(/[\s-]/g, "")
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code) ? code : null
}

export function formatPairingCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}
