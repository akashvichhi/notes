import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RootErrorFallback } from './root_error_fallback'

describe('RootErrorFallback', () => {
  it('offers a reload without needing any provider', () => {
    render(<RootErrorFallback />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reload' })).toBeInTheDocument()
  })
})
