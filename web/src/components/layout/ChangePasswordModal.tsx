import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { memo, type SyntheticEvent, useCallback, useState } from 'react'

import { useUpdatePassword } from '@/hooks/queries/useAuth'

export const ChangePasswordModal = memo(function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void
}) {
  const updatePassword = useUpdatePassword()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleCurrentPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.currentTarget.value)
  }, [])

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.currentTarget.value)
  }, [])

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.currentTarget.value)
  }, [])

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (newPassword !== confirmPassword) {
        notifications.show({ color: 'red', message: 'New passwords do not match' })
        return
      }

      if (newPassword.length < 8) {
        notifications.show({ color: 'red', message: 'Password must be at least 8 characters long' })
        return
      }

      updatePassword.mutate(
        {
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Password updated successfully' })
            onClose()
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Failed to change password'
            notifications.show({ color: 'red', message: msg })
          },
        },
      )
    },
    [newPassword, confirmPassword, currentPassword, updatePassword, onClose],
  )

  return (
    <Modal opened onClose={onClose} title="Change Password" centered size="sm">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <PasswordInput
            label="Current password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={handleCurrentPasswordChange}
            required
            autoFocus
          />
          <PasswordInput
            label="New password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={handleNewPasswordChange}
            required
          />
          <PasswordInput
            label="Confirm new password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            required
          />
          <Group justify="flex-end" gap="xs" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updatePassword.isPending}>
              Update password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
})
