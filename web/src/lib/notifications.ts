import { notifications } from '@mantine/notifications'

export function showErrorToast(message: string, id?: string): void {
  notifications.show({
    id,
    color:     'red',
    message,
    autoClose: 3500,
  })
}

export function showSuccessToast(message: string, id?: string): void {
  notifications.show({
    id,
    color:     'green',
    message,
    autoClose: 3000,
  })
}
