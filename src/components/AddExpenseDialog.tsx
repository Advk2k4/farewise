import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { money, todayISO, uid } from '@/lib/format'
import { addTrips, homeCurrency, useData } from '@/lib/store'

const TYPES = [['taxi', 'Taxi'], ['car', 'Driving'], ['transit', 'Transit'], ['bike', 'Bike'], ['other', 'Other']] as const

export function AddExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const cur = homeCurrency(useData().prefs)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('transit')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = Number(amount)
    if (!(v > 0)) { setErr('Enter an amount above zero.'); return }
    const label = TYPES.find(t => t[0] === mode)![1]
    const undo = addTrips(date, [{ id: uid(), t: '', mode, label, note: note.trim() || label, cost: v, cur, parts: { [mode]: v } }])
    toast(`Added ${money(v, cur)}`, { action: { label: 'Undo', onClick: undo } })
    setAmount(''); setNote(''); setErr(''); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add an expense</DialogTitle>
          <DialogDescription>For a trip you didn’t plan here, like an airport train or a parking fee.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5"><Label htmlFor="exp-date">Date</Label><Input id="exp-date" type="date" value={date} onChange={e => setDate(e.target.value || todayISO())} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="exp-amt">Amount ({cur})</Label>
              <Input id="exp-amt" type="number" min={0} step="any" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setErr('') }} aria-invalid={!!err} aria-describedby={err ? 'exp-err' : undefined} />
              {err && <p id="exp-err" className="text-xs text-bad">{err}</p>}</div>
          </div>
          <div className="flex flex-col gap-1.5"><Label id="exp-type-l">Type</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger aria-labelledby="exp-type-l" className="h-12 w-full rounded-[8px] border-transparent bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="exp-note">Note</Label><Input id="exp-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Airport train…" autoComplete="off" /></div>
          <DialogFooter className="gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Add expense</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
