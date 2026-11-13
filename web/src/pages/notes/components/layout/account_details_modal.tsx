import { memo, type SyntheticEvent, useCallback, useEffect, useState } from 'react'

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'

import type { ApiError } from '@src/api/api_client'
import { useMe, useUpdateProfile } from '@src/queries/auth_queries'
import { showErrorToast, showSuccessToast } from '@src/utils/notifications'

export const AccountDetailsModal = memo(function AccountDetailsModal({
  onClose,
}: {
  onClose: () => void
}) {
  const { data: user } = useMe()
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.currentTarget.value)
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.currentTarget.value)
  }, [])

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      updateProfile.mutate(
        { name, email },
        {
          onSuccess: () => {
            showSuccessToast('Account details updated successfully')
            onClose()
          },
          onError: (err: ApiError) => showErrorToast(err.message || 'Failed to update account details'),
        },
      )
    },
    [name, email, updateProfile, onClose],
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
            required
            label="Email"
            placeholder="Your email"
            type="email"
            value={email}
            onChange={handleEmailChange}
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
