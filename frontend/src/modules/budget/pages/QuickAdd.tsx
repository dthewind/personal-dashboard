import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { TransactionTag } from '../types'
import { todayStr } from '../utils'
import Typeahead from '../components/Typeahead'
import CardPickerModal from '../components/CardPickerModal'

const TAGS: { value: TransactionTag; label: string }[] = [
  { value: 'variable', label: 'Variable' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'one_off', label: 'One-off' },
]

export default function QuickAdd() {
  const qc = useQueryClient()
  const amountRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [merchant, setMerchant] = useState('')
  const [merchantQuery, setMerchantQuery] = useState('')
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState<TransactionTag>('variable')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
  })

  const { data: merchantSuggestions } = useQuery({
    queryKey: ['merchants', merchantQuery],
    queryFn: () => api.merchants(merchantQuery),
    enabled: merchantQuery.length > 0,
    staleTime: 30_000,
  })

  const sorted = [...(accounts ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const creditCards = sorted.filter(a => a.type === 'credit_card')
  const otherAccounts = sorted.filter(a => a.type !== 'credit_card')

  useEffect(() => {
    if (accounts?.length && !accountId) {
      const firstCC = sorted.find(a => a.type === 'credit_card')
      setAccountId(firstCC?.id ?? sorted[0].id)
    }
  }, [accounts, accountId])

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const mutation = useMutation({
    mutationFn: () =>
      api.ledger.create({
        type: 'expense',
        date,
        account_id: accountId,
        amount: parseFloat(amount),
        category: category.trim(),
        merchant: merchant.trim(),
        tag,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['merchants'] })
      setAmount('')
      setMerchant('')
      setMerchantQuery('')
      setCategory('')
      setNotes('')
      setTag('variable')
      // keep historical mode sticky so bulk entry stays in the same mode
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
      amountRef.current?.focus()
    },
  })

  const merchantNames = merchantSuggestions?.map(m => m.name) ?? []

  function handleMerchantSuggestionSelect(name: string) {
    const m = merchantSuggestions?.find(m => m.name === name)
    if (m?.default_category && !category) setCategory(m.default_category)
  }

  const canSubmit =
    !!amount &&
    parseFloat(amount) > 0 &&
    !!accountId &&
    merchant.trim().length > 0 &&
    category.trim().length > 0

  return (
    <div className="max-w-lg mx-auto">
      {showCardPicker && <CardPickerModal onClose={() => setShowCardPicker(false)} />}
      {success && (
        <div className="mb-4 px-4 py-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-400 text-sm">
          Transaction saved ✓
        </div>
      )}

      {mutation.isError && (
        <div className="mb-4 px-4 py-3 bg-red-950 border border-red-800 rounded-xl text-red-400 text-sm">
          Failed to save — check all fields are filled.
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-mono">
              $
            </span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && mutation.mutate()}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-4 text-white text-3xl font-mono placeholder-gray-700 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Account */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Account</label>
          {accounts?.length === 0 && (
            <span className="text-xs text-gray-600">No accounts — add one on Dashboard first</span>
          )}
          <div className="space-y-2">
            {/* Credit cards — primary row */}
            {creditCards.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {creditCards.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      accountId === a.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
            {/* Other accounts — secondary row */}
            {otherAccounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {otherAccounts.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      accountId === a.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Merchant */}
        <Typeahead
          label="Merchant"
          value={merchant}
          onChange={v => { setMerchant(v); setMerchantQuery(v) }}
          onSuggestionSelect={handleMerchantSuggestionSelect}
          suggestions={merchantNames}
          placeholder="Where did you spend?"
        />

        {/* Category */}
        <Typeahead
          label="Category"
          value={category}
          onChange={setCategory}
          suggestions={categories ?? []}
          placeholder="e.g. Groceries, Dining, Gas"
        />

        {/* Date */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Tag */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">Type</label>
          <div className="flex gap-2">
            {TAGS.map(t => (
              <button
                key={t.value}
                onClick={() => setTag(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tag === t.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Notes <span className="text-gray-600">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional note"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Submit row */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowCardPicker(true)}
            title="Card Picker — find the best card for this category"
            className="px-4 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-colors text-sm font-medium shrink-0"
          >
            Best card
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-colors text-base"
          >
            {mutation.isPending ? 'Saving…' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  )
}
