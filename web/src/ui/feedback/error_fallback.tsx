import { memo } from 'react'

import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

export interface IErrorFallbackProps {
  title:       string
  message:     string
  actionLabel: string
  onAction:    () => void
  /** The whole viewport (app level) or just the area the boundary wraps. */
  fullPage?:   boolean
}

export const ErrorFallback: React.NamedExoticComponent<IErrorFallbackProps> = memo(function ErrorFallback({
  title, message, actionLabel, onAction, fullPage = false,
}: IErrorFallbackProps): React.JSX.Element {
  return (
    <Center h={fullPage ? '100dvh' : '100%'} p="md" role="alert">
      <Stack align="center" gap="md" maw={420} ta="center">
        <IconAlertTriangle aria-hidden color="var(--mantine-color-red-6)" size={40} />
        <Title order={3}>{title}</Title>
        <Text c="dimmed" size="sm">{message}</Text>
        <Button onClick={onAction}>{actionLabel}</Button>
      </Stack>
    </Center>
  )
})
