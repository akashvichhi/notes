import { Button, Divider, Modal, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'

import { useMe, useUpdatePassword, useUpdateProfile } from '@/hooks/queries/useAuth'

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { data: user } = useMe()
  const updateProfile = useUpdateProfile()
  const updatePassword = useUpdatePassword()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile.mutate(
      { name, email },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Profile updated' })
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Failed to update profile'
          notifications.show({ color: 'red', message: msg })
        },
      },
    )
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      notifications.show({ color: 'red', message: 'New passwords do not match' })
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
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Failed to change password'
          notifications.show({ color: 'red', message: msg })
        },
      },
    )
  }

  return (
    <Modal opened onClose={onClose} title="Profile & Account" centered size="md">
      <Stack gap="lg">
        <form onSubmit={handleProfileSubmit}>
          <Stack gap="sm">
            <Title order={5}>Account Details</Title>
            <TextInput
              label="Name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Email"
              placeholder="Your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <Button type="submit" loading={updateProfile.isPending} mt="xs">
              Save changes
            </Button>
          </Stack>
        </form>

        <Divider />

        <form onSubmit={handlePasswordSubmit}>
          <Stack gap="sm">
            <Title order={5}>Change Password</Title>
            <PasswordInput
              label="Current password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="New password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Confirm new password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              required
            />
            <Button
              type="submit"
              variant="light"
              color="blue"
              loading={updatePassword.isPending}
              mt="xs"
            >
              Update password
            </Button>
          </Stack>
        </form>
      </Stack>
    </Modal>
  )
}
