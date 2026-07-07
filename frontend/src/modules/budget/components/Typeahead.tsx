import { useState, useRef, type KeyboardEvent } from 'react'

interface TypeaheadProps {
  value: string
  onChange: (value: string) => void
  onSuggestionSelect?: (value: string) => void
  suggestions: string[]
  onSearch?: (query: string) => void
  placeholder?: string
  label?: string
  autoFocus?: boolean
  inputClassName?: string
}

export default function Typeahead({
  value,
  onChange,
  onSuggestionSelect,
  suggestions,
  onSearch,
  placeholder,
  label,
  autoFocus,
  inputClassName,
}: TypeaheadProps) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions.slice(0, 8)

  const shown = filtered.length > 0 && open

  function handleInput(v: string) {
    onChange(v)
    onSearch?.(v)
    setOpen(true)
    setCursor(-1)
  }

  function select(s: string) {
    onChange(s)
    onSuggestionSelect?.(s)
    setOpen(false)
    setCursor(-1)
  }

  function handleKey(e: KeyboardEvent) {
    if (!shown) {
      if (e.key === 'ArrowDown') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, -1))
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault()
      select(filtered[cursor])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const base =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500'

  return (
    <div className="relative">
      {label && <label className="block text-xs text-gray-400 mb-1">{label}</label>}
      <input
        ref={inputRef}
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputClassName ?? base}
      />
      {shown && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map((s, i) => (
            <li
              key={s}
              onMouseDown={() => select(s)}
              className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                i === cursor
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
