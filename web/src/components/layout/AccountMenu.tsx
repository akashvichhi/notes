import { Avatar, Menu, Stack, Text } from '@mantine/core'
import { IconLogout, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { ProfileModal } from './ProfileModal'
import { useLogout, useMe } from '@/hooks/queries/useAuth'

/** Exactly two items. There is no gear icon anywhere in the app. */
export function AccountMenu() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  const initials = (user?.name ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Avatar size={28} radius="xl" color="blue" style={{ cursor: 'pointer' }}>{initials}</Avatar>
        </Menu.Target>
        <Menu.Dropdown>
          <Stack gap={0} px="sm" py="xs">
            {/* Confirming which account you are in, before you sign out of it. */}
            <Text size="sm" fw={600}>{user?.name}</Text>
            <Text size="xs" c="dimmed" truncate>{user?.email}</Text>
          </Stack>
          <Menu.Divider />
          <Menu.Item leftSection={<IconUser size={16} />} onClick={() => setProfileOpen(true)}>
            Profile
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconLogout size={16} />}
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
          >
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}
