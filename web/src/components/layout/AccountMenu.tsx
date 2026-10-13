import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { Avatar, Loader, Menu, Overlay, Stack, Text } from '@mantine/core'
import { IconLock, IconLogout, IconUser } from '@tabler/icons-react'


import { useLogout, useMe } from '@/hooks/queries/useAuth'

import { AccountDetailsModal } from './AccountDetailsModal'
import { ChangePasswordModal } from './ChangePasswordModal'

export const AccountMenu = memo(function AccountMenu() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [accountDetailsOpen, setAccountDetailsOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const initials = useMemo(() => {
    return (user?.name ?? '?')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [user?.name])

  const handleOpenAccountDetails = useCallback(() => {
    setAccountDetailsOpen(true)
  }, [])

  const handleCloseAccountDetails = useCallback(() => {
    setAccountDetailsOpen(false)
  }, [])

  const handleOpenChangePassword = useCallback(() => {
    setChangePasswordOpen(true)
  }, [])

  const handleCloseChangePassword = useCallback(() => {
    setChangePasswordOpen(false)
  }, [])

  const handleLogout = useCallback(() => {
    if (logout.isPending) return
    logout.mutate(undefined, {
      onSettled: () => navigate('/login'),
    })
  }, [logout, navigate])

  return (
    <>
      <Menu withinPortal position="bottom-end">
        <Menu.Target>
          <Avatar color="blue" radius="xl" size={28} style={{ cursor: 'pointer' }}>
            {initials}
          </Avatar>
        </Menu.Target>
        <Menu.Dropdown>
          <Stack gap={0} px="sm" py="xs">
            {/* Confirming which account you are in, before you sign out of it. */}
            <Text fw={600} size="sm">
              {user?.name}
            </Text>
            <Text truncate c="dimmed" size="xs">
              {user?.email}
            </Text>
          </Stack>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconUser size={16} />}
            onClick={handleOpenAccountDetails}
          >
            Account details
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLock size={16} />}
            onClick={handleOpenChangePassword}
          >
            Change password
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            disabled={logout.isPending}
            leftSection={
              logout.isPending ? (
                <Loader color="red" size={14} />
              ) : (
                <IconLogout size={16} />
              )
            }
            onClick={handleLogout}
          >
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {logout.isPending && (
        <Overlay
          center
          fixed
          backgroundOpacity={0.6}
          blur={2}
          zIndex={10000}
        >
          <Stack align="center" gap="sm">
            <Loader color="blue" size="lg" />
            <Text c="white" fw={600} size="sm">
              Signing out…
            </Text>
          </Stack>
        </Overlay>
      )}

      {accountDetailsOpen && (
        <AccountDetailsModal onClose={handleCloseAccountDetails} />
      )}
      {changePasswordOpen && (
        <ChangePasswordModal onClose={handleCloseChangePassword} />
      )}
    </>
  )
})
