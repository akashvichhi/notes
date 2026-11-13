import type { ReactElement } from 'react'

import { MantineProvider } from '@mantine/core'
import { render, type RenderResult } from '@testing-library/react'

import { theme } from '@src/styles/theme'

/** Renders a component inside the providers every screen of the app has. */
export function renderWithProviders(ui: ReactElement): RenderResult {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>)
}
