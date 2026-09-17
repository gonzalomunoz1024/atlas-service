import { Drawer, useOverlayClose } from './ui/Overlay'
import { Icon } from './ui/Icons'
import { IconButton } from './ui/Button'
import { EnhancementContent } from './EnhancementContent'

export function EnhancementDrawer({ component, onClose }: { component: string; onClose: () => void }) {
  return (
    <Drawer onClose={onClose} raised>
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <EnhancementContent component={component} />
      </div>
    </Drawer>
  )
}

function Header() {
  const close = useOverlayClose()
  return (
    <div className="flex items-center justify-between border-b border-stroke-light p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-sm bg-warning-tint px-2 py-1 text-caption font-semibold text-warning">
          Enhancement
        </span>
        <h2 className="text-title3 font-semibold text-primary">Logging &amp; alerting</h2>
      </div>
      <IconButton label="Close" onClick={close}>
        <Icon name="close" size={18} />
      </IconButton>
    </div>
  )
}
