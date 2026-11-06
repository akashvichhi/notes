import { memo } from 'react'

import { ActionIcon, Code, CopyButton, Group, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'

/** A value shown in monospace with a copy button beside it. */
export const CopyField = memo(function CopyField({
  label,
  value,
}: {
  label?: string
  value: string
}) {
  return (
    <div>
      {label && (
        <Text fw={500} mb={4} size="sm">
          {label}
        </Text>
      )}
      <Group align="flex-start" gap="xs" wrap="nowrap">
        <Code block style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {value}
        </Code>
        <CopyButton timeout={2000} value={value}>
          {({ copied, copy }) => (
            <Tooltip withArrow label={copied ? 'Copied' : 'Copy'} position="left">
              <ActionIcon
                aria-label={copied ? 'Copied' : `Copy ${label ?? 'value'}`}
                color={copied ? 'teal' : 'gray'}
                variant="subtle"
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </div>
  )
})
