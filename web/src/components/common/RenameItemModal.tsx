import { memo, useCallback, useEffect, useState } from 'react'

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'

interface RenameItemModalProps {
  opened: boolean
  title: string
  label: string
  placeholder?: string
  initialValue: string
  maxLength?: number
  onClose: () => void
  onConfirm: (newName: string) => void
}

export const RenameItemModal = memo(function RenameItemModal({
  opened,
  title,
  label,
  placeholder,
  initialValue,
  maxLength,
  onClose,
  onConfirm,
}: RenameItemModalProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (opened) {
      setValue(initialValue)
    }
  }, [opened, initialValue])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed && trimmed !== initialValue) {
        onConfirm(trimmed)
      }
      onClose()
    },
    [value, initialValue, onConfirm, onClose],
  )

  return (
    <Modal centered opened={opened} size="sm" title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            autoFocus
            data-autofocus
            label={label}
            maxLength={maxLength}
            placeholder={placeholder ?? label}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
})
