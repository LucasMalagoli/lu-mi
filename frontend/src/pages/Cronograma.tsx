import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'
import ScrollToTopButton from '../components/ScrollToTopButton'
import { IMPORT_DAYS } from '../data/cronogramaImport'

interface Topic { id: number; label: string; order: number }
interface Check { id: number; key: string; label: string; color: string | null; is_checked: boolean; order: number }
interface Day {
  id: number
  day_number: number
  week_number: number
  type: 'study' | 'sim' | 'rev' | 'noc' | 'prova'
  mat: string
  study_date: string | null
  topics: Topic[]
  checks: Check[]
}

type DayForm = {
  type: Day['type']
  mat: string
  study_date: string
  day_number: string
  week_number: string
  topics: string[]
}

const TYPE_META = {
  study: { label: 'Estudo',   cls: 'bg-blue-900/50 border-blue-500 text-blue-200' },
  sim:   { label: 'Simulado', cls: 'bg-pink-900/50 border-pink-500 text-pink-200' },
  rev:   { label: 'Revisão',  cls: 'bg-green-900/50 border-green-600 text-green-200' },
  noc:   { label: 'Nocaute',  cls: 'bg-orange-900/50 border-orange-500 text-orange-200' },
  prova: { label: 'Prova',    cls: 'bg-violet-900/50 border-violet-400 text-violet-200' },
}

const PROGRESS_SEGMENTS = [
  { keys: ['estudo'],              color: '#3b82f6', label: 'Estudo' },
  { keys: ['r1'],                  color: '#E24B4A', label: '24h' },
  { keys: ['r3'],                  color: '#EF9F27', label: '3 dias' },
  { keys: ['r7'],                  color: '#BA7517', label: '7 dias' },
  { keys: ['r14'],                 color: '#1D9E75', label: '14 dias' },
  { keys: ['r30'],                 color: '#378ADD', label: '30 dias' },
  { keys: ['realizar', 'gabarito'],color: '#D4537E', label: 'Simulado' },
  { keys: ['ok'],                  color: '#a855f7', label: 'Rev/Noc' },
]

const REV_OFFSETS = [
  { key: 'r1',  label: '24h',     color: '#E24B4A' },
  { key: 'r3',  label: '3 dias',  color: '#EF9F27' },
  { key: 'r7',  label: '7 dias',  color: '#BA7517' },
  { key: 'r14', label: '14 dias', color: '#1D9E75' },
  { key: 'r30', label: '30 dias', color: '#378ADD' },
]

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  return `${d}/${months[parseInt(m) - 1]}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function sortDays(ds: Day[]): Day[] {
  return [...ds].sort((a, b) => {
    if (!a.study_date && !b.study_date) return a.day_number - b.day_number
    if (!a.study_date) return 1
    if (!b.study_date) return -1
    const dc = a.study_date.localeCompare(b.study_date)
    return dc !== 0 ? dc : a.day_number - b.day_number
  })
}

function Checkbox({ checked, color, onClick }: { checked: boolean; color?: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-all mt-0.5
        ${checked ? 'border-transparent' : 'border-slate-600 bg-slate-950 hover:border-slate-400'}`}
      style={checked ? { background: color ?? '#3b82f6', borderColor: color ?? '#3b82f6' } : {}}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 9">
          <path d="M1 4l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

function TypeTag({ type }: { type: Day['type'] }) {
  const m = TYPE_META[type]
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>
}

function RevPreview({ studyDate }: { studyDate: string }) {
  if (!studyDate) return null
  return (
    <div className="mt-2 p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Revisões geradas</p>
      {REV_OFFSETS.map(r => (
        <div key={r.key} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
          <span style={{ color: r.color }}>{r.label}</span>
          <span className="text-slate-500">→</span>
          <span className="text-slate-300">{fmtDate(addDays(studyDate, parseInt(r.key.slice(1))))}</span>
        </div>
      ))}
    </div>
  )
}

function DayFormFields({
  form, setForm, showDayNum = false,
}: {
  form: DayForm
  setForm: React.Dispatch<React.SetStateAction<DayForm>>
  showDayNum?: boolean
}) {
  return (
    <div className="space-y-4">
      {showDayNum && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Dia nº</label>
            <input
              type="number" required min={1}
              value={form.day_number}
              onChange={e => {
                const dn = parseInt(e.target.value) || ''
                setForm(f => ({ ...f, day_number: String(dn), week_number: dn ? String(Math.ceil(Number(dn) / 7)) : '' }))
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Semana</label>
            <input
              type="number" required min={1}
              value={form.week_number}
              onChange={e => setForm(f => ({ ...f, week_number: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
        <select
          value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value as Day['type'], topics: [''] }))}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="study">Estudo</option>
          <option value="sim">Simulado</option>
          <option value="rev">Revisão</option>
          <option value="noc">Nocaute</option>
          <option value="prova">Prova</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Matéria / título</label>
        <input
          type="text" required
          value={form.mat}
          onChange={e => setForm(f => ({ ...f, mat: e.target.value }))}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Data de estudo</label>
        <input
          type="date"
          value={form.study_date}
          onChange={e => setForm(f => ({ ...f, study_date: e.target.value }))}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 [color-scheme:dark]"
        />
        {form.type === 'study' && form.study_date && <RevPreview studyDate={form.study_date} />}
      </div>

      {form.type === 'study' && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Conteúdo</label>
          <div className="space-y-2">
            {form.topics.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={t}
                  onChange={e => setForm(f => ({ ...f, topics: f.topics.map((x, j) => j === i ? e.target.value : x) }))}
                  placeholder={`Tópico ${i + 1}`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                {form.topics.length > 1 && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, topics: f.topics.filter((_, j) => j !== i) }))} className="text-slate-600 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setForm(f => ({ ...f, topics: [...f.topics, ''] }))} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              + Adicionar tópico
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const BLANK_FORM: DayForm = { type: 'study', mat: '', study_date: '', day_number: '', week_number: '', topics: [''] }

export default function Cronograma() {
  const navigate = useNavigate()
  const { notify } = useNotify()
  const [days, setDays] = useState<Day[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [curWeek, setCurWeek] = useState(0)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<DayForm>(BLANK_FORM)

  const [editingDay, setEditingDay] = useState<Day | null>(null)
  const [editForm, setEditForm] = useState<DayForm>(BLANK_FORM)

  const token = () => localStorage.getItem("access_token")

  useEffect(() => { fetchDays() }, [])

  const fetchDays = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${config.API_URL}/cronograma/days`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) throw new Error()
      setDays(sortDays(await res.json()))
    } catch {
      notify("Erro ao carregar cronograma", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (checkId: number) => {
    setDays(prev => prev.map(d => ({
      ...d,
      checks: d.checks.map(c => c.id === checkId ? { ...c, is_checked: !c.is_checked } : c)
    })))
    try {
      const res = await fetch(`${config.API_URL}/cronograma/checks/${checkId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) throw new Error()
    } catch {
      setDays(prev => prev.map(d => ({
        ...d,
        checks: d.checks.map(c => c.id === checkId ? { ...c, is_checked: !c.is_checked } : c)
      })))
      notify("Erro ao atualizar", "error")
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const res = await fetch(`${config.API_URL}/cronograma/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ days: IMPORT_DAYS })
      })
      if (!res.ok) throw new Error((await res.json()).detail)
      notify("Cronograma importado com sucesso!", "success")
      fetchDays()
    } catch (e: any) {
      notify(e?.message ?? "Erro ao importar", "error")
    } finally {
      setIsImporting(false)
    }
  }

  const handleDeleteDay = async (dayId: number) => {
    try {
      const res = await fetch(`${config.API_URL}/cronograma/days/${dayId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) throw new Error()
      setDays(prev => prev.filter(d => d.id !== dayId))
      notify("Dia removido", "info")
    } catch {
      notify("Erro ao remover", "error")
    }
  }

  const handleCreateDay = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${config.API_URL}/cronograma/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          day_number: parseInt(createForm.day_number),
          week_number: parseInt(createForm.week_number),
          type: createForm.type,
          mat: createForm.mat,
          study_date: createForm.study_date || null,
          topics: createForm.type === 'study' ? createForm.topics.filter(t => t.trim()) : [],
        })
      })
      if (!res.ok) throw new Error()
      const newDay: Day = await res.json()
      setDays(prev => sortDays([...prev, newDay]))
      setIsCreateOpen(false)
      setCreateForm(BLANK_FORM)
      notify("Dia criado!", "success")
    } catch {
      notify("Erro ao criar dia", "error")
    }
  }

  const openEdit = (day: Day) => {
    setEditingDay(day)
    setEditForm({
      type: day.type,
      mat: day.mat,
      study_date: day.study_date ?? '',
      day_number: String(day.day_number),
      week_number: String(day.week_number),
      topics: day.topics.length > 0 ? day.topics.map(t => t.label) : [''],
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDay) return
    try {
      const res = await fetch(`${config.API_URL}/cronograma/days/${editingDay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          mat: editForm.mat,
          type: editForm.type,
          study_date: editForm.study_date || null,
          topics: editForm.type === 'study' ? editForm.topics.filter(t => t.trim()) : [],
        })
      })
      if (!res.ok) throw new Error()
      const updated: Day = await res.json()
      setDays(prev => sortDays(prev.map(d => d.id === updated.id ? updated : d)))
      setEditingDay(null)
      notify("Dia atualizado!", "success")
    } catch {
      notify("Erro ao salvar", "error")
    }
  }

  const weeks = [...new Set(days.map(d => d.week_number))].sort((a, b) => a - b)
  const filtered = curWeek === 0 ? days : days.filter(d => d.week_number === curWeek)
  const weekGroups = weeks
    .filter(w => curWeek === 0 || w === curWeek)
    .map(w => ({ week: w, days: filtered.filter(d => d.week_number === w) }))

  const allChecks = days.flatMap(d => d.checks)
  const totalChecks = allChecks.length
  const checkedCount = allChecks.filter(c => c.is_checked).length
  const pct = totalChecks ? Math.round(checkedCount / totalChecks * 100) : 0
  const isDone = (d: Day) => d.checks.length > 0 && d.checks.every(c => c.is_checked)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24">
      {/* Header */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Cronograma OAB 47</h1>
            <p className="text-xs text-slate-500">05 mai → 27 ago 2025 · 115 dias · VDE + Revisões</p>
          </div>
        </div>
        <div className="flex gap-2">
          {days.length === 0 && !isLoading && (
            <button onClick={handleImport} disabled={isImporting} className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
              {isImporting ? 'Importando...' : 'Importar cronograma'}
            </button>
          )}
          <button onClick={() => setIsCreateOpen(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
            + Novo dia
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 md:px-8 py-3">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
          {PROGRESS_SEGMENTS.map(seg => {
            const w = totalChecks
              ? (allChecks.filter(c => seg.keys.includes(c.key) && c.is_checked).length / totalChecks) * 100
              : 0
            return w > 0 ? (
              <div key={seg.label} className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full" style={{ width: `${w}%`, background: seg.color }} />
            ) : null
          })}
        </div>
        <p className="text-xs text-slate-500 text-right mt-1">{checkedCount} / {totalChecks} concluídos ({pct}%)</p>
      </div>

      {/* Legend */}
      <div className="bg-slate-900/30 border-b border-slate-800 px-4 md:px-8 py-2 flex flex-wrap gap-4">
        {[
          { color: '#3b82f6', label: 'Estudo' },
          { color: '#E24B4A', label: 'Revisão 24h' },
          { color: '#EF9F27', label: 'Revisão 3 dias' },
          { color: '#BA7517', label: 'Revisão 7 dias' },
          { color: '#1D9E75', label: 'Revisão 14 dias' },
          { color: '#378ADD', label: 'Revisão 30 dias' },
          { color: '#D4537E', label: 'Simulado' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Week filter */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 md:px-8 py-2 flex gap-2 flex-wrap">
        <button onClick={() => setCurWeek(0)} className={`text-xs px-3 py-1 rounded-full border transition-all ${curWeek === 0 ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
          Todas
        </button>
        {weeks.map(w => (
          <button key={w} onClick={() => setCurWeek(w)} className={`text-xs px-3 py-1 rounded-full border transition-all ${curWeek === w ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}>
            Semana {w}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          </div>
        ) : days.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <p className="text-lg mb-2">Nenhum dia cadastrado.</p>
            <p className="text-sm">Clique em "Importar cronograma" para carregar os 115 dias da OAB 47.</p>
          </div>
        ) : (
          weekGroups.map(({ week, days: wdays }) => {
            const first = wdays[0]?.study_date
            const last = wdays[wdays.length - 1]?.study_date
            return (
              <div key={week} className="mb-8">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Semana {week}
                  {first && last && <span className="font-normal normal-case tracking-normal ml-2 text-slate-600">— {fmtDate(first)} a {fmtDate(last)}</span>}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {wdays.map(day => (
                    <DayCard
                      key={day.id}
                      day={day}
                      isDone={isDone(day)}
                      onToggle={handleToggle}
                      onDelete={handleDeleteDay}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create modal */}
      {isCreateOpen && (
        <Modal title="Novo dia" onClose={() => { setIsCreateOpen(false); setCreateForm(BLANK_FORM) }}>
          <form onSubmit={handleCreateDay} className="space-y-4">
            <DayFormFields form={createForm} setForm={setCreateForm} showDayNum />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setIsCreateOpen(false); setCreateForm(BLANK_FORM) }} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">Criar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editingDay && (
        <Modal title={`Editar — Dia ${editingDay.day_number}`} onClose={() => setEditingDay(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <DayFormFields form={editForm} setForm={setEditForm} />
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditingDay(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancelar</button>
              <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      <ScrollToTopButton />
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-5">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function DayCard({ day, isDone, onToggle, onDelete, onEdit }: {
  day: Day
  isDone: boolean
  onToggle: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (day: Day) => void
}) {
  const [hovered, setHovered] = useState(false)
  const estudoCheck = day.checks.find(c => c.key === 'estudo')
  const revChecks = day.checks.filter(c => c.key !== 'estudo')

  const cardBorder = day.type === 'prova'
    ? 'border-violet-500/60'
    : isDone ? 'border-slate-700/50' : 'border-slate-800'

  return (
    <div
      className={`bg-slate-900/50 border rounded-xl p-4 transition-all ${cardBorder} ${isDone ? 'opacity-60' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-semibold text-slate-500">Dia {day.day_number}</span>
        <div className="flex items-center gap-1.5">
          {day.study_date && <span className="text-xs text-slate-600">{fmtDate(day.study_date)}</span>}
          {hovered && (
            <>
              <button onClick={() => onEdit(day)} className="text-slate-600 hover:text-blue-400 transition-colors" title="Editar">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onClick={() => onDelete(day.id)} className="text-slate-600 hover:text-red-500 transition-colors" title="Remover">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <TypeTag type={day.type} />
        <p className={`text-sm font-semibold mt-1.5 leading-snug ${isDone ? 'text-slate-500' : 'text-white'}`}>{day.mat}</p>
      </div>

      {/* Study: topics + reviews */}
      {day.type === 'study' && estudoCheck && (
        <>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Conteúdo</p>
          <ul className="space-y-1.5 mb-3">
            {day.topics.map(t => (
              <li key={t.id} className="flex items-start gap-2 cursor-pointer" onClick={() => onToggle(estudoCheck.id)}>
                <Checkbox checked={estudoCheck.is_checked} color="#3b82f6" onClick={() => onToggle(estudoCheck.id)} />
                <span className={`text-xs leading-snug ${estudoCheck.is_checked ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{t.label}</span>
              </li>
            ))}
          </ul>
          {revChecks.length > 0 && (
            <>
              <div className="border-t border-slate-800 my-2" />
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Revisões programadas</p>
              <ul className="space-y-1.5">
                {revChecks.map(c => (
                  <li key={c.id} className="flex items-start gap-2 cursor-pointer" onClick={() => onToggle(c.id)}>
                    <Checkbox checked={c.is_checked} color={c.color} onClick={() => onToggle(c.id)} />
                    <span className="text-xs leading-snug" style={{ color: c.is_checked ? '#475569' : (c.color ?? '#94a3b8') }}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* Sim / rev / noc */}
      {(day.type === 'sim' || day.type === 'rev' || day.type === 'noc') && (
        <ul className="space-y-1.5">
          {day.checks.map(c => (
            <li key={c.id} className="flex items-start gap-2 cursor-pointer" onClick={() => onToggle(c.id)}>
              <Checkbox
                checked={c.is_checked}
                color={day.type === 'sim' ? '#D4537E' : day.type === 'noc' ? '#f97316' : '#22c55e'}
                onClick={() => onToggle(c.id)}
              />
              <span className={`text-xs leading-snug ${c.is_checked ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
