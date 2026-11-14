import { memo, useCallback, useEffect, useState } from 'react'

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'

interface IRenameItemModalProps {
  opened:       boolean
  title:        string
  label:        string
  placeholder?: string
  initialValue: string
  maxLength?:   number
  onClose:      () => void
  onConfirm:    (newName: string) => void
}

export const RenameItemModal: React.MemoExoticComponent<({ opened, title, label, placeholder, initialValue, maxLength, onClose, onConfirm, }: IRenameItemModalProps) => React.JSX.Element> = memo(function RenameItemModal({
  opened,
  title,
  label,
  placeholder,
  initialValue,
  maxLength,
  onClose,
  onConfirm,
}: IRenameItemModalProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (opened) {
      setValue(initialValue)
    }
  }, [opened, initialValue])

  const handleSubmit: (e: React.FormEvent) => void = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed: string = value.trim()
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
            onChange={(e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => setValue(e.currentTarget.value)}
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
