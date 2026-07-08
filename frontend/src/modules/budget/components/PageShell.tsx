import type { ReactNode } from 'react'

export default function PageShell({ children, gap = 'space-y-2' }: { children: ReactNode; gap?: string }) {
  return <div className={gap}>{children}</div>
}
