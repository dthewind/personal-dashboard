export const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)

export function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Local-date formatter — never use toISOString() for calendar dates:
// it converts to UTC, which rolls past midnight during Central Time evenings.
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

export function prevMonth(m: string): string {
  const d = new Date(m + 'T12:00:00')
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function nextMonth(m: string): string {
  const d = new Date(m + 'T12:00:00')
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function monthRange(m: string): { start: string; end: string } {
  const d = new Date(m + 'T12:00:00')
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const last = new Date(y, mo, 0).getDate()
  return {
    start: `${y}-${String(mo).padStart(2, '0')}-01`,
    end: `${y}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
  }
}

export function monthLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
