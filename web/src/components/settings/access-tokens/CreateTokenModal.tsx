import { memo, useCallback, useState } from 'react'

import { Modal } from '@mantine/core'

import { useIsPhone } from '@/hooks/useIsPhone'

import { CreateTokenForm } from './CreateTokenForm'
import { TokenCreated } from './TokenCreated'

type Created = { token: string; name: string }

export const CreateTokenModal = memo(function CreateTokenModal({ onClose }: { onClose: () => void }) {
  const [created, setCreated] = useState<Created | null>(null)
  const isPhone = useIsPhone()

  const handleCreated = useCallback((token: string, name: string) => {
    setCreated({ token, name })
  }, [])

  // The token is shown once: a stray click outside must not throw it away.
  return (
    <Modal
      centered
      opened
      closeOnClickOutside={created === null}
      fullScreen={isPhone}
      size="lg"
      title={created ? 'Token created' : 'New access token'}
      onClose={onClose}
    >
      {created ? (
        <TokenCreated name={created.name} token={created.token} onDone={onClose} />
      ) : (
        <CreateTokenForm onCancel={onClose} onCreated={handleCreated} />
      )}
    </Modal>
  )
})
