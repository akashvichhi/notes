import { memo, useCallback } from 'react'

import { Badge, Button, Center, Group, Loader, Table, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

import { normalizeError } from '@/api/client'
import { useAccessTokens, useRevokeAccessToken } from '@/hooks/queries/useAccessTokens'
import { showErrorToast, showSuccessToast } from '@/lib/notifications'
import type { AccessToken } from '@/types/api'

dayjs.extend(relativeTime)

const formatDate = (iso: string | null, fallback: string) => (iso ? dayjs(iso).format('D MMM YYYY') : fallback)

const isExpired = (token: AccessToken) => token.expires_at !== null && dayjs(token.expires_at).isBefore(dayjs())

const TokenRow = memo(function TokenRow({ token }: { token: AccessToken }) {
  const revoke = useRevokeAccessToken()
  const expired = isExpired(token)

  const handleRevoke = useCallback(() => {
    modals.openConfirmModal({
      title:        'Revoke access token',
      children:     `Anything using “${token.name}” will lose access to your notes immediately. This cannot be undone.`,
      labels:       { confirm: 'Revoke', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm:    () => {
        revoke.mutate(token.id, {
          onSuccess: () => showSuccessToast(`Revoked “${token.name}”`),
          onError:   (err: unknown) => showErrorToast(normalizeError(err).message || 'Failed to revoke token'),
        })
      },
    })
  }, [revoke, token.id, token.name])

  return (
    <Table.Tr>
      <Table.Td>
        <Text fw={500} size="sm">
          {token.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          {token.abilities.includes('notes:read') && (
            <Badge size="sm" variant="light">
              Read
            </Badge>
          )}
          {token.abilities.includes('notes:write') && (
            <Badge color="orange" size="sm" variant="light">
              Write
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDate(token.created_at, '—')}</Text>
      </Table.Td>
      <Table.Td>
        <Text c={token.last_used_at ? undefined : 'dimmed'} size="sm">
          {token.last_used_at ? dayjs(token.last_used_at).fromNow() : 'Never'}
        </Text>
      </Table.Td>
      <Table.Td>
        {expired ? (
          <Badge color="gray" size="sm" variant="light">
            Expired
          </Badge>
        ) : (
          <Text size="sm">{formatDate(token.expires_at, 'Never')}</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Button color="red" loading={revoke.isPending} size="xs" variant="subtle" onClick={handleRevoke}>
          Revoke
        </Button>
      </Table.Td>
    </Table.Tr>
  )
})

export const TokenList = memo(function TokenList() {
  const { data: tokens, isLoading, isError } = useAccessTokens()

  if (isLoading) {
    return (
      <Center py="lg">
        <Loader size="sm" />
      </Center>
    )
  }

  if (isError) {
    return (
      <Text c="red" size="sm">
        Could not load your tokens.
      </Text>
    )
  }

  if (!tokens || tokens.length === 0) {
    return (
      <Text c="dimmed" py="lg" size="sm" ta="center">
        No access tokens yet.
      </Text>
    )
  }

  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Scopes</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Last used</Table.Th>
            <Table.Th>Expires</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
})
