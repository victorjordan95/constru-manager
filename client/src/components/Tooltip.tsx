import { useState } from 'react'

interface TooltipProps {
  text: string
  children: React.ReactNode
}

export function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(30,30,30,0.9)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
