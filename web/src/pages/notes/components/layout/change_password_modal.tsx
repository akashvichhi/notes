import { memo, type SyntheticEvent, useCallback, useState } from 'react'

import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

import type { IApiError } from '@src/api/api_client'
import { MIN_PASSWORD_LENGTH } from '@src/constants/limits'
import { MESSAGES } from '@src/constants/messages'
import { useUpdatePassword } from '@src/queries/auth_queries'
import { showErrorToast, showSuccessToast } from '@src/utils/notifications'

export const ChangePasswordModal: React.MemoExoticComponent<({ onClose, }: { onClose: () => void; }) => React.JSX.Element> = memo(function ChangePasswordModal({
  onClose,
}: {
  onClose: () => void
}) {
  const updatePassword: UseMutationResult<void, IApiError, { currentPassword: string; password: string; passwordConfirmation: string; }, unknown> = useUpdatePassword()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleCurrentPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPassword(e.currentTarget.value)
  }, [])

  const handleNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.currentTarget.value)
  }, [])

  const handleConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.currentTarget.value)
  }, [])

  const handleSubmit: (e: SyntheticEvent<HTMLFormElement>) => void = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (newPassword !== confirmPassword) {
        showErrorToast(MESSAGES.PASSWORDS_DIFFER)
        return
      }

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        showErrorToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
        return
      }

      updatePassword.mutate(
        {
          currentPassword:      currentPassword,
          password:              newPassword,
          passwordConfirmation: confirmPassword,
        },
        {
          onSuccess: () => {
            showSuccessToast(MESSAGES.PASSWORD_CHANGED)
            onClose()
          },
          onError: (err: IApiError) => showErrorToast(err.message || MESSAGES.PASSWORD_CHANGE_FAILED),
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
