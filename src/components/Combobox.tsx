import {useEffect, useId, useMemo, useRef, useState, type ReactNode} from 'react'
import {Check, ChevronDown, Search} from 'lucide-react'

export type ComboItem = {id: string; label: string; sub?: string; group?: string}

type Props = {
  label: string
  items: ComboItem[]
  value: string
  onChange: (id: string) => void
  /** Returns the filtered items for a query (e.g. Arabic + French search). */
  filter: (query: string) => ComboItem[]
  placeholder: string
  emptyText: string
  icon?: ReactNode
  disabled?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  testId?: string
}

/** Accessible searchable dropdown (ARIA combobox + listbox, keyboard navigation). */
export function Combobox({label, items, value, onChange, filter, placeholder, emptyText, icon, disabled, inputRef, testId}: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const ownInput = useRef<HTMLInputElement>(null)
  const input = inputRef ?? ownInput
  const selected = items.find(x => x.id === value)
  const results = useMemo(() => (open ? filter(query) : items), [open, query, filter, items])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({block: 'nearest'})
  }, [active])

  const close = () => { setOpen(false); setQuery('') }
  const pick = (item: ComboItem) => { onChange(item.id); close(); input.current?.blur() }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setActive(a => Math.min(results.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { if (open && results[active]) { e.preventDefault(); pick(results[active]) } }
    else if (e.key === 'Escape') { close() }
  }

  let lastGroup: string | undefined
  return (
    <div className={`combo ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`} ref={wrap} data-testid={testId}>
      <label htmlFor={id} className="combo-label">{label}</label>
      <div className="combo-field" onClick={() => !disabled && (setOpen(true), input.current?.focus())}>
        <span className="combo-icon">{icon ?? <Search size={17} />}</span>
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (selected?.label ?? '')}
          placeholder={open ? placeholder : (selected?.label ?? placeholder)}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={onKey}
        />
        <ChevronDown size={16} className="combo-chev" />
      </div>
      {open && <ul className="combo-list glass" role="listbox" id={`${id}-list`} ref={listRef}>
        {results.length === 0 && <li className="combo-empty">{emptyText}</li>}
        {results.map((item, i) => {
          const header = item.group && item.group !== lastGroup ? item.group : undefined
          lastGroup = item.group
          return [
            header && <li key={`g-${header}`} className="combo-group" role="presentation">{header}</li>,
            <li
              key={item.id}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={item.id === value}
              className={`${i === active ? 'active' : ''} ${item.id === value ? 'selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => { e.preventDefault(); pick(item) }}
            >
              <span><b>{item.label}</b>{item.sub && <small>{item.sub}</small>}</span>
              {item.id === value && <Check size={16} />}
            </li>,
          ]
        })}
      </ul>}
    </div>
  )
}
