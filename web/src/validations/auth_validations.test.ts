import { describe, expect, it } from 'vitest'

import { MIN_PASSWORD_LENGTH } from '@src/constants/limits'

import { validateEmail, validatePassword, validatePasswordConfirmation } from './auth_validations'

describe('validateEmail', (): void => {
  it('accepts an address with a local part and a domain', (): void => {
    expect(validateEmail('ada@example.com')).toBeNull()
  })

  it('rejects an address without an @', (): void => {
    expect(validateEmail('ada.example.com')).toBe('Enter a valid email address')
  })

  it('rejects an address containing a space', (): void => {
    expect(validateEmail('ada @example.com')).toBe('Enter a valid email address')
  })
})

describe('validatePassword', (): void => {
  it('accepts a password of the minimum length', (): void => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })

  it('rejects a password one character short, naming the minimum', (): void => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  })
})

describe('validatePasswordConfirmation', (): void => {
  it('accepts a confirmation equal to the password', (): void => {
    expect(validatePasswordConfirmation('secret-pass', { password: 'secret-pass' })).toBeNull()
  })

  it('rejects a confirmation that differs from the password', (): void => {
    expect(validatePasswordConfirmation('secret-pass', { password: 'other-pass' })).toBe('Passwords do not match')
  })
})
