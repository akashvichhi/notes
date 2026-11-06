import { memo } from 'react'

import { List, Stack, Text, Title } from '@mantine/core'

import { CopyField } from './CopyField'
import { claudeCodeCommand, mcpUrl, TOKEN_PLACEHOLDER } from './mcpUrl'

/**
 * How to point an MCP client at this server. Without a token the commands carry
 * a placeholder; right after creating one they carry the real token.
 */
export const ConnectInstructions = memo(function ConnectInstructions({ token }: { token?: string }) {
  const value = token ?? TOKEN_PLACEHOLDER

  return (
    <Stack gap="md">
      <CopyField label="Server URL" value={mcpUrl()} />

      <Title mt="xs" order={5}>
        Claude Code
      </Title>
      <CopyField label="Run this in a terminal" value={claudeCodeCommand(value)} />

      <Title mt="xs" order={5}>
        Claude on the web, desktop and mobile
      </Title>
      <List withPadding size="sm" spacing={4} type="ordered">
        <List.Item>On claude.ai, open Customize → Connectors → Add custom connector.</List.Item>
        <List.Item>Paste the server URL above and choose no sign-in.</List.Item>
        <List.Item>
          Add the request header{' '}
          <Text inherit component="span" ff="monospace">
            Authorization
          </Text>{' '}
          with the value below.
        </List.Item>
      </List>
      <CopyField label="Authorization header value" value={`Bearer ${value}`} />

      <Title mt="xs" order={5}>
        Other MCP clients
      </Title>
      <Text size="sm">
        Use the server URL with the Streamable HTTP transport, and send the{' '}
        <Text inherit component="span" ff="monospace">
          Authorization
        </Text>{' '}
        header above with every request.
      </Text>

      <Text c="dimmed" size="xs">
        {token
          ? 'The connector must reach this server over public HTTPS. It then shows up in the Claude desktop and mobile apps too.'
          : `Replace ${TOKEN_PLACEHOLDER} with a token. Its value is shown only once, when you create it. Claude connectors must reach this server over public HTTPS, and then show up in the Claude desktop and mobile apps too.`}
      </Text>
    </Stack>
  )
})
