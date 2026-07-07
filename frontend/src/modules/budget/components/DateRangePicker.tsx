export type RangePreset =
  | 'this_month' | 'this_quarter' | 'this_year'
  | 'last_month' | 'last_quarter' | 'last_year'
  | 'custom'

export interface DateRange {
  preset: RangePreset
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
}

function pad(n: number) { return String(n).padStart(2, '0') }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}` }
function lastDay(y: number, m: number) { return new Date(y, m, 0).getDate() }
function qStart(m: number) { return Math.floor((m - 1) / 3) * 3 + 1 }

export function computeRange(preset: RangePreset, customStart = '', customEnd = ''): { start: string; end: string } {
  if (preset === 'custom') return { start: customStart, end: customEnd }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  switch (preset) {
    case 'this_month':
      return { start: ymd(y, m, 1), end: ymd(y, m, lastDay(y, m)) }
    case 'this_quarter': {
      const qs = qStart(m)
      return { start: ymd(y, qs, 1), end: ymd(y, qs + 2, lastDay(y, qs + 2)) }
    }
    case 'this_year':
      return { start: ymd(y, 1, 1), end: ymd(y, 12, 31) }
    case 'last_month': {
      const ly = m === 1 ? y - 1 : y
      const lm = m === 1 ? 12 : m - 1
      return { start: ymd(ly, lm, 1), end: ymd(ly, lm, lastDay(ly, lm)) }
    }
    case 'last_quarter': {
      const qs = qStart(m)
      if (qs === 1) return { start: ymd(y - 1, 10, 1), end: ymd(y - 1, 12, 31) }
      const lqs = qs - 3
      return { start: ymd(y, lqs, 1), end: ymd(y, lqs + 2, lastDay(y, lqs + 2)) }
    }
    case 'last_year':
      return { start: ymd(y - 1, 1, 1), end: ymd(y - 1, 12, 31) }
  }
}

export function defaultRange(preset: RangePreset = 'this_month'): DateRange {
  const { start, end } = computeRange(preset)
  return { preset, start, end }
}

const selCls = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500'
const inpCls = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500'

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  function handlePreset(preset: RangePreset) {
    if (preset === 'custom') {
      onChange({ preset, start: value.start, end: value.end })
    } else {
      const { start, end } = computeRange(preset)
      onChange({ preset, start, end })
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={value.preset} onChange={e => handlePreset(e.target.value as RangePreset)} className={selCls}>
        <optgroup label="Current">
          <option value="this_month">This Month</option>
          <option value="this_quarter">This Quarter</option>
          <option value="this_year">This Year</option>
        </optgroup>
        <optgroup label="Previous">
          <option value="last_month">Last Month</option>
          <option value="last_quarter">Last Quarter</option>
          <option value="last_year">Last Year</option>
        </optgroup>
        <option value="custom">Custom Range…</option>
      </select>

      {value.preset === 'custom' ? (
        <>
          <input
            type="date"
            value={value.start}
            onChange={e => onChange({ ...value, start: e.target.value })}
            className={inpCls}
          />
          <span className="text-gray-600 text-sm">—</span>
          <input
            type="date"
            value={value.end}
            onChange={e => onChange({ ...value, end: e.target.value })}
            className={inpCls}
          />
        </>
      ) : (
        <span className="text-xs text-gray-600 font-mono">{value.start} — {value.end}</span>
      )}
    </div>
  )
}
