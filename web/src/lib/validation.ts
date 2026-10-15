import { MIN_PASSWORD_LENGTH } from '@/constants/limits'

export function validateEmail(value: string): string | null {
  return /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address'
}

export function validatePassword(value: string): string | null {
  return value.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
}

export function validatePasswordConfirmation(
  value: string,
  values: { password?: string },
): string | null {
  return value === values.password ? null : 'Passwords do not match'
}
