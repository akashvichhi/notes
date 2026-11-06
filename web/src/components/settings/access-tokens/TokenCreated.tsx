import { memo } from 'react'

import { Alert, Button, Divider, Group, Stack } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

import { ConnectInstructions } from './ConnectInstructions'
import { CopyField } from './CopyField'

/** Shown once, right after creating a token: the server never returns it again. */
export const TokenCreated = memo(function TokenCreated({
  name,
  token,
  onDone,
}: {
  name: string
  token: string
  onDone: () => void
}) {
  return (
    <Stack gap="md">
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Copy it now">
        This is the only time “{name}” will be shown. If you lose it, revoke it and create a new one.
      </Alert>

      <CopyField label="Token" value={token} />

      <Divider label="Ready to paste, with this token" labelPosition="left" />

      <ConnectInstructions token={token} />

      <Group justify="flex-end" mt="sm">
        <Button onClick={onDone}>Done</Button>
      </Group>
    </Stack>
  )
})
