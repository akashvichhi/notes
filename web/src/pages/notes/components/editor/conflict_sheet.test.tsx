import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { makeNote } from '@src/test_utils/note_factory'
import { renderWithProviders } from '@src/test_utils/render_with_providers'

import { ConflictSheet, type IConflictSheetProps } from './conflict_sheet'

const HANDLERS: Omit<IConflictSheetProps, 'serverCopy'> = {
  onKeepMine:    vi.fn(),
  onKeepTheirs:  vi.fn(),
  onSaveCopy:    vi.fn(),
  onRestoreMine: vi.fn(),
  onDiscard:     vi.fn(),
  onClose:       vi.fn(),
}

describe('ConflictSheet', () => {
  it('offers to restore or discard when the note was moved to Trash', () => {
    renderWithProviders(
      <ConflictSheet serverCopy={makeNote({ deletedAt: '2026-11-13T09:05:00Z' })} {...HANDLERS} />,
    )

    expect(screen.getByRole('button', { name: 'Restore and keep mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard my changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep mine' })).not.toBeInTheDocument()
  })

  it('offers keep mine, keep theirs or a copy when the note was edited elsewhere', () => {
    renderWithProviders(<ConflictSheet serverCopy={makeNote()} {...HANDLERS} />)

    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep theirs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save mine as a copy' })).toBeInTheDocument()
  })
})
