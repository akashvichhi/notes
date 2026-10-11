import { ActionIcon, Avatar, Menu, Text } from '@mantine/core'
import { IconLogout, IconUser } from '@tabler/icons-react'
import { useNavigate } from 'react-router'

import { useLogout, useMe } from '@/hooks/queries/useAuth'

export function AccountMenu() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login'),
    })
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?'

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <ActionIcon variant="subtle" size="lg" radius="xl" aria-label="Account">
          <Avatar size={28} radius="xl" color="blue">
            {initial}
          </Avatar>
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" fw={500} truncate>{user?.name}</Text>
          <Text size="xs" c="dimmed" truncate>{user?.email}</Text>
        </Menu.Label>
        <Menu.Divider />
        <Menu.Item leftSection={<IconUser size={14} />} disabled>
          Profile
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={handleLogout}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
