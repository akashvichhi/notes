import { memo, type SyntheticEvent, useCallback, useState } from 'react'

import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core'

import { MIN_PASSWORD_LENGTH } from '@/constants/limits'
import { useUpdatePassword } from '@/hooks/queries/useAuth'
import { showErrorToast, showSuccessToast } from '@/lib/notifications'

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
        showErrorToast('Passwords do not match')
        return
      }

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        showErrorToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
        return
      }

      updatePassword.mutate(
        {
          current_password:      currentPassword,
          password:              newPassword,
          password_confirmation: confirmPassword,
        },
        {
          onSuccess: () => {
            showSuccessToast('Password updated successfully')
            onClose()
          },
          onError: (err: unknown) => {
            const msg =
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message
              ?? 'Failed to change password'
            showErrorToast(msg)
          },
        },
      )
    },
    [newPassword, confirmPassword, currentPassword, updatePassword, onClose],
  )

  return (
    <Modal centered opened size="sm" title="Change Password" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <PasswordInput
            autoFocus
            required
            label="Current password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={handleCurrentPasswordChange}
          />
          <PasswordInput
            required
            label="New password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={handleNewPasswordChange}
          />
          <PasswordInput
            required
            label="Confirm new password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
          />
          <Group gap="xs" justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={updatePassword.isPending} type="submit">
              Update password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
})
