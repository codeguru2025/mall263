/** Matches backend `RegisterDto` / admin update validation. */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordMinLengthHint(): string {
  return `Use at least ${PASSWORD_MIN_LENGTH} characters. You can mix letters, numbers, and symbols.`;
}

export function passwordOptionalChangeHint(): string {
  return `Leave blank to keep the current password. If you change it, use at least ${PASSWORD_MIN_LENGTH} characters.`;
}
