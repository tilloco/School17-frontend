/** Digits only, at most 16. */
export const cardDigits = (s: string) => s.replace(/\D/g, '').slice(0, 16);
/** "5808558885885500" -> "5808 5588 8588 5500" */
export const cardGroups = (digits: string) => digits.replace(/(.{4})/g, '$1 ').trim();
/** The check-digit rule every real bank card follows: it catches a mistyped digit before the server does. */
export function luhnOk(digits: string): boolean {
  if (digits.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
