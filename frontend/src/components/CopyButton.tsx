import { useState } from 'react'
import { Button } from './ui/Button'
import { Icon } from './ui/Icons'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} className={copied ? 'text-healthy' : undefined} />
      {copied ? 'Copied' : label}
    </Button>
  )
}
