import { MemoryRouter } from 'react-router'

import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { renderWithProviders } from '@src/test_utils/render_with_providers'

import { RouteBoundary } from './route_boundary'

const INTERNAL_DETAIL: string = 'TypeError at notes_repo.ts:42'

let shouldThrow: boolean = true

function Page(): React.JSX.Element {
  if (shouldThrow) throw new Error(INTERNAL_DETAIL)
  return <p>Notes</p>
}

describe('RouteBoundary', () => {
  let consoleError: MockInstance

  beforeEach(() => {
    shouldThrow = true
    // React reports every caught render error to the console.
    consoleError = vi.spyOn(console, 'error').mockImplementation((): void => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('shows a fallback without the error details when the page crashes', () => {
    renderWithProviders(<MemoryRouter><RouteBoundary><Page /></RouteBoundary></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.queryByText(INTERNAL_DETAIL, { exact: false })).not.toBeInTheDocument()
  })

  it('renders the page again after "Try again"', async () => {
    renderWithProviders(<MemoryRouter><RouteBoundary><Page /></RouteBoundary></MemoryRouter>)
    shouldThrow = false

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('Notes')).toBeInTheDocument()
  })
})
