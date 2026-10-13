import { Avatar, Menu, Stack, Text } from '@mantine/core'
import { IconLock, IconLogout, IconUser } from '@tabler/icons-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { AccountDetailsModal } from './AccountDetailsModal'
import { ChangePasswordModal } from './ChangePasswordModal'
import { useLogout, useMe } from '@/hooks/queries/useAuth'

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
    logout.mutate(undefined, { onSuccess: () => navigate('/login') })
  }, [logout, navigate])

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Avatar size={28} radius="xl" color="blue" style={{ cursor: 'pointer' }}>
            {initials}
          </Avatar>
        </Menu.Target>
        <Menu.Dropdown>
          <Stack gap={0} px="sm" py="xs">
            {/* Confirming which account you are in, before you sign out of it. */}
            <Text size="sm" fw={600}>
              {user?.name}
            </Text>
            <Text size="xs" c="dimmed" truncate>
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
            leftSection={<IconLogout size={16} />}
            onClick={handleLogout}
          >
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {accountDetailsOpen && (
        <AccountDetailsModal onClose={handleCloseAccountDetails} />
      )}
      {changePasswordOpen && (
        <ChangePasswordModal onClose={handleCloseChangePassword} />
      )}
    </>
  )
})
