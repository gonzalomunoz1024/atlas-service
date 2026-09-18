import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { SyntheticTest } from '../types/atlas'
import { CopyButton } from './CopyButton'
import { Modal, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'
import { Skeleton } from './ui/Skeleton'

interface Props {
  traceId: string
  /** observed call context — lets HyperExecute build the payload from the OpenAPI spec */
  node?: string
  endpoint?: string
  onClose: () => void
}

export function SyntheticModal({ traceId, node, endpoint, onClose }: Props) {
  const [test, setTest] = useState<SyntheticTest | null>(null)

  useEffect(() => {
    api.syntheticFromTrace(traceId, { node, endpoint }).then(setTest).catch(() => setTest(null))
  }, [traceId, node, endpoint])

  return (
    <Modal onClose={onClose} raised width="max-w-2xl">
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {!test ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-secondary">{test.summary}</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-sm bg-surface-secondary px-2 py-0.5 font-mono text-caption font-semibold">
                {test.method}
              </span>
              <span className="font-mono text-primary">{test.path}</span>
            </div>
            {test.body && (
              <div>
                <div className="mb-1 text-sm font-semibold text-primary">Request Body</div>
                <pre className="overflow-x-auto rounded-md bg-surface-secondary p-4 font-mono text-caption leading-relaxed text-primary">
                  {test.body}
                </pre>
              </div>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">hyperexecute.yaml</span>
                <CopyButton text={test.hyperExecuteYaml} />
              </div>
              <pre className="overflow-x-auto rounded-md bg-surface-secondary p-4 font-mono text-caption leading-relaxed text-primary">
                {test.hyperExecuteYaml}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Header() {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-accent-tint px-2 py-1 text-caption font-semibold text-accent">
          HyperExecute
        </span>
        <h2 className="text-title3 font-semibold text-primary">Synthetic Test</h2>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}
