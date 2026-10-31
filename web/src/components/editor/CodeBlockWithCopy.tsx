import { memo } from 'react'

import { ActionIcon, CopyButton, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

import styles from './CodeBlockWithCopy.module.css'

export const CodeBlockWithCopy = memo(function CodeBlockWithCopy({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper className={styles.wrapper}>
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
      <div className={styles.copy} contentEditable={false}>
        <CopyButton timeout={1500} value={node.textContent}>
          {({ copied, copy }) => (
            <Tooltip withArrow label={copied ? 'Copied' : 'Copy'}>
              <ActionIcon aria-label="Copy code" color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </div>
    </NodeViewWrapper>
  )
})
