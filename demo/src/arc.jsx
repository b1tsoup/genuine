import { useEffect, useId, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'

const cx = (...c) => c.filter(Boolean).join(' ')

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="arc-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className="arc-seg-item" onClick={() => onChange(o.value)}>
          {o.icon && <HugeiconsIcon icon={o.icon} size={16} strokeWidth={1.5} />}{o.label}
        </button>
      ))}
    </div>
  )
}

export function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className={cx('arc-acc', open && 'open')}>
      <button className="arc-acc-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.5} className="arc-acc-chev" />{title}
      </button>
      <div id={id} className="arc-acc-panel" hidden={!open}>{children}</div>
    </div>
  )
}

export function Toasts({ items, onDismiss }) {
  return (
    <div className="arc-toasts" role="status" aria-live="polite">
      {items.map((t) => <Toast key={t.id} {...t} onDismiss={onDismiss} />)}
    </div>
  )
}

function Toast({ id, title, body, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 4000)
    return () => clearTimeout(t)
  }, [id, onDismiss])
  return (
    <div className="arc-toast">
      <div className="arc-toast-text">
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
      <button className="arc-toast-close" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
