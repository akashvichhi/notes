import type { ReactElement } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '@src/api/auth_api'
import { renderWithProviders } from '@src/test_utils/render_with_providers'
import type { IUser } from '@src/types/api'

import { AccountDetailsModal } from './account_details_modal'

const USER: IUser = { uuid: 'user-1', name: 'Asha Rao', email: 'asha@example.com', preferences: {} }

vi.mock('@src/api/auth_api', () => ({
  fetchMe:       vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@src/utils/notifications', () => ({
  showErrorToast:   vi.fn(),
  showSuccessToast: vi.fn(),
}))

function renderModal(): void {
  const client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <AccountDetailsModal onClose={vi.fn()} />
    </QueryClientProvider>
  )
  renderWithProviders(ui)
}

describe('AccountDetailsModal', () => {
  beforeEach(() => {
    vi.mocked(authApi.fetchMe).mockResolvedValue(USER)
    vi.mocked(authApi.updateProfile).mockReset().mockResolvedValue(USER)
  })

  it('shows the email read-only', async () => {
    renderModal()

    const email: HTMLElement = await screen.findByDisplayValue(USER.email)
    expect(email).toHaveAttribute('readonly')
  })

  it('saves only the name', async () => {
    renderModal()

    const name: HTMLElement = await screen.findByDisplayValue(USER.name)
    await userEvent.clear(name)
    await userEvent.type(name, 'Asha R')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(vi.mocked(authApi.updateProfile).mock.calls[0]?.[0]).toEqual({ name: 'Asha R' })
  })
})
