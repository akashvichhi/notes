import { memo, type SyntheticEvent, useCallback, useEffect, useState } from 'react'

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { MESSAGES } from '@src/constants/messages'
import { useMe, useUpdateProfile } from '@src/queries/auth_queries'
import type { IUser } from '@src/types/api'
import type { IProfileUpdate } from '@src/types/auth'
import { showErrorToast, showSuccessToast } from '@src/utils/notifications'

export const AccountDetailsModal: React.MemoExoticComponent<({ onClose, }: { onClose: () => void; }) => React.JSX.Element> = memo(function AccountDetailsModal({
  onClose,
}: {
  onClose: () => void
}) {
  const { data: user } = useMe()
  const updateProfile: UseMutationResult<IUser, IApiError, IProfileUpdate, unknown> = useUpdateProfile()

  const [name, setName] = useState(user?.name ?? '')

  useEffect(() => {
    if (user) {
      setName(user.name)
    }
  }, [user])

  const handleNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value)
  }, [])

  const handleSubmit: (e: SyntheticEvent<HTMLFormElement>) => void = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      updateProfile.mutate(
        { name },
        {
          onSuccess: () => {
            showSuccessToast(MESSAGES.ACCOUNT_UPDATED)
            onClose()
          },
          onError: (err: IApiError) => showErrorToast(err.message || MESSAGES.ACCOUNT_UPDATE_FAILED),
        },
      )
    },
    [name, updateProfile, onClose],
  )

  return (
    <Modal centered opened size="sm" title="Account Details" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            autoFocus
            required
            label="Name"
            placeholder="Your name"
            value={name}
            onChange={handleNameChange}
          />
          <TextInput
            readOnly
            label="Email"
            placeholder="Your email"
            type="email"
            value={user?.email ?? ''}
          />
          <Group gap="xs" justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={updateProfile.isPending} type="submit">
              Save changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
})
