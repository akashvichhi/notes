import { memo, useCallback, useState } from 'react'
import { Link } from 'react-router'

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'

import { ConnectInstructions } from '@src/pages/access_tokens/components/connect_instructions'
import { CreateTokenModal } from '@src/pages/access_tokens/components/create_token_modal'
import { TokenList } from '@src/pages/access_tokens/components/token_list'
import { useMe } from '@src/queries/auth_queries'
import { ROUTE_PATHS } from '@src/routes/route_paths'

export const AccessTokensPage = memo(function AccessTokensPage() {
  const { data: user } = useMe()
  const [createOpen, setCreateOpen] = useState(false)

  const handleOpenCreate = useCallback(() => setCreateOpen(true), [])
  const handleCloseCreate = useCallback(() => setCreateOpen(false), [])

  return (
    <Container px="md" py="lg" size="md">
      <Stack gap="lg">
        <div>
          <Button
            component={Link}
            leftSection={<IconArrowLeft size={16} />}
            px={0}
            to={ROUTE_PATHS.HOME}
            variant="transparent"
          >
            Back to notes
          </Button>
          <Title order={2}>Access tokens</Title>
          <Text c="dimmed" mt={4} size="sm">
            Tokens give apps and AI assistants access to your Cloud notes over MCP: read-only, or read
            and write. A token can never delete anything.
          </Text>
        </div>

        {/* Native apps work signed out, on local notes only; tokens belong to a Cloud account. */}
        {user ? (
          <>
            <Paper withBorder p="md">
              <Group justify="space-between" mb="sm" wrap="nowrap">
                <Title order={4}>Your tokens</Title>
                <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                  New token
                </Button>
              </Group>
              <TokenList />
            </Paper>

            <Paper withBorder p="md">
              <Title mb="sm" order={4}>
                Connect an MCP client
              </Title>
              <ConnectInstructions />
            </Paper>
          </>
        ) : (
          <Paper withBorder p="md">
            <Text size="sm">
              Sign in to your Cloud account to create access tokens.{' '}
              <Text inherit c="blue" component={Link} to={ROUTE_PATHS.LOGIN}>
                Sign in
              </Text>
            </Text>
          </Paper>
        )}
      </Stack>

      {createOpen && <CreateTokenModal onClose={handleCloseCreate} />}
    </Container>
  )
})
