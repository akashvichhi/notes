import type { ReactElement } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import * as notesApi from '@src/api/notes_api'
import { renderWithProviders } from '@src/test_utils/render_with_providers'

import { EmptyTrashModal } from './empty_trash_modal'

vi.mock('@src/api/notes_api', () => ({
  emptyTrash: vi.fn(),
}))

vi.mock('@src/utils/notifications', () => ({
  showErrorToast:   vi.fn(),
  showSuccessToast: vi.fn(),
}))

function renderModal(onClose: () => void): void {
  const client: QueryClient = new QueryClient()
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <EmptyTrashModal noteCount={13} onClose={onClose} />
    </QueryClientProvider>
  )
  renderWithProviders(ui)
}

describe('EmptyTrashModal', () => {
  beforeEach(() => {
    vi.mocked(notesApi.emptyTrash).mockReset().mockResolvedValue(undefined)
  })

  it('says how many notes will be deleted for good', () => {
    renderModal(vi.fn())

    expect(screen.getByText(/All 13 notes in the Trash will be deleted permanently/)).toBeInTheDocument()
  })

  it('empties the Trash and closes when confirmed', async () => {
    const onClose: Mock<() => void> = vi.fn()
    renderModal(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'Empty Trash' }))

    expect(notesApi.emptyTrash).toHaveBeenCalledOnce()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('deletes nothing when cancelled', async () => {
    const onClose: Mock<() => void> = vi.fn()
    renderModal(onClose)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(notesApi.emptyTrash).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
