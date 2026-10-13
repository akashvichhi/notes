import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { memo, type SyntheticEvent, useCallback, useState } from 'react'

import { useMe, useUpdateProfile } from '@/hooks/queries/useAuth'

export const AccountDetailsModal = memo(function AccountDetailsModal({
  onClose,
}: {
  onClose: () => void
}) {
  const { data: user } = useMe()
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

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
            notifications.show({ color: 'green', message: 'Account details updated successfully' })
            onClose()
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Failed to update account details'
            notifications.show({ color: 'red', message: msg })
          },
        },
      )
    },
    [name, email, updateProfile, onClose],
  )

  return (
    <Modal opened onClose={onClose} title="Account Details" centered size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="Your name"
            value={name}
            onChange={handleNameChange}
            required
            autoFocus
          />
          <TextInput
            label="Email"
            placeholder="Your email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
          />
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updateProfile.isPending}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
})
