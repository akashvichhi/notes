import { memo, useCallback, useState } from 'react'
import { Link } from 'react-router'

import { Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'

import { ConnectInstructions } from '@/components/settings/access-tokens/ConnectInstructions'
import { CreateTokenModal } from '@/components/settings/access-tokens/CreateTokenModal'
import { TokenList } from '@/components/settings/access-tokens/TokenList'
import { useMe } from '@/hooks/queries/useAuth'

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
            to="/"
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
              <Text inherit c="blue" component={Link} to="/login">
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
