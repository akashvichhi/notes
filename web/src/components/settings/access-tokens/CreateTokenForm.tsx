import { memo, type SyntheticEvent, useCallback, useState } from 'react'

import { Button, Checkbox, Group, Select, Stack, Text, TextInput } from '@mantine/core'

import { normalizeError } from '@/api/client'
import { useCreateAccessToken } from '@/hooks/queries/useAccessTokens'
import { showErrorToast } from '@/lib/notifications'
import type { AccessTokenAbility } from '@/types/api'

const MAX_NAME_LENGTH = 60

const EXPIRY_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'never', label: 'Never' },
]

export const CreateTokenForm = memo(function CreateTokenForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (token: string, name: string) => void
}) {
  const createToken = useCreateAccessToken()

  const [name, setName] = useState('')
  const [canRead, setCanRead] = useState(true)
  const [canWrite, setCanWrite] = useState(false)
  const [expiry, setExpiry] = useState<string>('90')

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value)
  }, [])

  const handleReadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCanRead(e.currentTarget.checked)
  }, [])

  // Writing needs reading, so ticking write ticks read too.
  const handleWriteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.currentTarget.checked
    setCanWrite(checked)
    if (checked) setCanRead(true)
  }, [])

  const handleExpiryChange = useCallback((value: string | null) => {
    setExpiry(value ?? '90')
  }, [])

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      const abilities: AccessTokenAbility[] = []
      if (canRead || canWrite) abilities.push('notes:read')
      if (canWrite) abilities.push('notes:write')

      if (abilities.length === 0) {
        showErrorToast('Choose at least one scope')
        return
      }

      createToken.mutate(
        {
          name:            name.trim(),
          abilities,
          expires_in_days: expiry === 'never' ? null : Number(expiry),
        },
        {
          onSuccess: ({ token, access_token }) => onCreated(token, access_token.name),
          onError:   (err: unknown) => showErrorToast(normalizeError(err).message || 'Failed to create token'),
        },
      )
    },
    [canRead, canWrite, createToken, expiry, name, onCreated],
  )

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <TextInput
          autoFocus
          required
          description="So you can recognise it later."
          label="Name"
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Work laptop"
          value={name}
          onChange={handleNameChange}
        />

        <Stack gap={6}>
          <Text fw={500} size="sm">
            Scopes
          </Text>
          <Checkbox
            checked={canRead || canWrite}
            description="Search and read notes, folders and tags."
            disabled={canWrite}
            label="Read notes"
            onChange={handleReadChange}
          />
          <Checkbox
            checked={canWrite}
            description="Also create and edit notes, folders and tags. Nothing can ever be deleted with a token."
            label="Write notes"
            onChange={handleWriteChange}
          />
        </Stack>

        <Select
          allowDeselect={false}
          data={EXPIRY_OPTIONS}
          label="Expires after"
          value={expiry}
          onChange={handleExpiryChange}
        />

        <Group gap="xs" justify="flex-end" mt="sm">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={name.trim() === ''} loading={createToken.isPending} type="submit">
            Create token
          </Button>
        </Group>
      </Stack>
    </form>
  )
})
