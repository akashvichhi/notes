import { memo } from 'react'

import { ActionIcon, CopyButton, Tooltip } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react'

import styles from './code_block_with_copy.module.css'

/** The one NodeView prop this view reads; Tiptap passes the rest too. */
export interface ICodeBlockWithCopyProps {
  node: NodeViewProps['node']
}

export const CodeBlockWithCopy: React.NamedExoticComponent<ICodeBlockWithCopyProps> = memo(function CodeBlockWithCopy({ node }: ICodeBlockWithCopyProps): React.JSX.Element {
  return (
    <NodeViewWrapper className={styles.wrapper}>
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
      <div className={styles.copy} contentEditable={false}>
        <CopyButton timeout={1500} value={node.textContent}>
          {({ copied, copy }: { copied: boolean; copy: () => void; }) => (
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
