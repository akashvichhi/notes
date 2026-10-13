import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor:  'blue',
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  headings:   { fontWeight: '650' },
  components: {
    // Mobile Safari zooms the page when a focused input is under 16px.
    Input: { styles: { input: { fontSize: 16 } } },
  },
})
