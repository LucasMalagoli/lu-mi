import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'
import ScrollToTopButton from '../components/ScrollToTopButton'

interface BudgetSummaryItem {
  category_id: number
  category_name: string
  planned: number
  confirmed: number
  expected: number
}

interface FinancialRecord {
  id: number
  title: string
  description?: string
  value: number
  type: 'income' | 'expense'
  bill_date: string
  status: 'pending' | 'completed'
  categories: { id: number; name: string }[]
  created_at: string
}

export default function Orcamento() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useNotify()
  const [isLoading, setIsLoading] = useState(true)
  const [summary, setSummary] = useState<BudgetSummaryItem[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [hideZeroCategories, setHideZeroCategories] = useState(false)
  const [areValuesVisible, setAreValuesVisible] = useState(true)
  
  // Details expansion
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [categoryDetails, setCategoryDetails] = useState<Record<number, FinancialRecord[]>>({})
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set())

  // Edit Record Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null)
  const [recordFormData, setRecordFormData] = useState({
    title: '',
    description: '',
    value: '',
    type: 'expense' as 'income' | 'expense',
    billDate: '',
    selectedCategories: [] as string[],
    status: 'pending' as 'pending' | 'completed'
  })

  // New Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  useEffect(() => {
    fetchSummary()
  }, [currentDate])

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const dateStr = `${year}-${month}-01`
      
      const res = await fetch(`${config.API_URL}/budgets/summary?month=${dateStr}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch budget summary")
      const data = await res.json()
      setSummary(data)
    } catch (error) {
      notify("Erro ao carregar orçamento", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategoryDetails = async (categoryId: number) => {
    if (categoryDetails[categoryId]) return

    setLoadingDetails(prev => new Set(prev).add(categoryId))
    try {
      const token = localStorage.getItem("access_token")
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(year, currentDate.getMonth() + 1, 0).getDate()
      
      const params = new URLSearchParams({
        start_date: `${year}-${month}-01`,
        end_date: `${year}-${month}-${lastDay}`,
        category_ids: categoryId.toString(),
        limit: "1000"
      })

      const res = await fetch(`${config.API_URL}/financial-records?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch details")
      const data = await res.json()
      setCategoryDetails(prev => ({ ...prev, [categoryId]: data.items }))
    } catch (error) {
      notify("Erro ao carregar detalhes", "error")
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev)
        next.delete(categoryId)
        return next
      })
    }
  }

  const toggleExpand = (categoryId: number) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
      fetchCategoryDetails(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const handleCopyBudget = async (categoryId?: number) => {
    try {
      const token = localStorage.getItem("access_token")
      const targetDate = new Date(currentDate)
      const sourceDate = new Date(currentDate)
      sourceDate.setMonth(sourceDate.getMonth() - 1)

      const formatDate = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${m}-01`
      }

      const res = await fetch(`${config.API_URL}/budgets/copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          source_month: formatDate(sourceDate),
          target_month: formatDate(targetDate),
          category_id: categoryId
        })
      })

      if (!res.ok) throw new Error("Failed to copy budget")
      notify("Orçamento copiado com sucesso!", "success")
      fetchSummary()
    } catch (error) {
      notify("Erro ao copiar orçamento", "error")
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newCategoryName })
      })
      if (!res.ok) throw new Error("Failed to create category")
      notify("Categoria criada!", "success")
      setIsCategoryModalOpen(false)
      setNewCategoryName("")
      fetchSummary()
    } catch (error) {
      notify("Erro ao criar categoria", "error")
    }
  }

  const handleSaveBudget = async (categoryId: number) => {
    try {
      const token = localStorage.getItem("access_token")
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, '0')
      const dateStr = `${year}-${month}-01`

      const res = await fetch(`${config.API_URL}/budgets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          category_id: categoryId,
          month: dateStr,
          planned_value: parseFloat(editValue) || 0
        })
      })

      if (!res.ok) throw new Error("Failed to save budget")
      
      setSummary(summary.map(item => 
        item.category_id === categoryId 
          ? { ...item, planned: parseFloat(editValue) || 0 }
          : item
      ))
      setEditingId(null)
      notify("Orçamento atualizado!", "success")
    } catch (error) {
      notify("Erro ao salvar orçamento", "error")
    }
  }

  const openEditModal = (record: FinancialRecord) => {
    setEditingRecord(record)
    setRecordFormData({
      title: record.title,
      description: record.description || '',
      value: record.value.toString(),
      type: record.type,
      billDate: record.bill_date,
      selectedCategories: record.categories.map(c => c.name),
      status: record.status
    })
    setIsRecordModalOpen(true)
  }

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRecord) return

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/financial-records/${editingRecord.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: recordFormData.title,
          description: recordFormData.description,
          value: parseFloat(recordFormData.value),
          type: recordFormData.type,
          billDate: recordFormData.billDate,
          categoryNames: recordFormData.selectedCategories,
          status: recordFormData.status
        })
      })

      if (!res.ok) throw new Error("Failed to update record")
      
      notify("Registro atualizado!", "success")
      setIsRecordModalOpen(false)
      // Refresh details for all expanded categories to ensure consistency
      fetchSummary()
      setCategoryDetails({}) 
      setExpandedCategories(new Set())
    } catch (error) {
      notify("Erro ao atualizar registro", "error")
    }
  }

  const formatCurrency = (val: number) => {
    if (!areValuesVisible) return 'R$ ****'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + delta)
    setCurrentDate(newDate)
  }

  const handleBack = () => {
    if (location.state?.from === "/financeiro") {
      navigate("/financeiro")
    } else {
      navigate("/")
    }
  }

  const filteredSummary = summary.filter(item => {
    if (hideZeroCategories) {
      return item.planned !== 0 || item.confirmed !== 0 || item.expected !== 0
    }
    return true
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Orçamento</h1>
            <button
              onClick={() => setAreValuesVisible(!areValuesVisible)}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              title={areValuesVisible ? "Ocultar valores" : "Mostrar valores"}
            >
              {areValuesVisible ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              )}
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setHideZeroCategories(!hideZeroCategories)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  hideZeroCategories 
                    ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {hideZeroCategories ? 'Mostrar Zerados' : 'Ocultar Zerados'}
              </button>
              <button
                onClick={() => handleCopyBudget()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
              >
                Copiar do Mês Anterior
              </button>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Nova Categoria
              </button>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-lg font-bold min-w-[140px] text-center capitalize">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSummary.map((item) => {
              const maxVal = Math.max(Math.abs(item.planned), Math.abs(item.expected), Math.abs(item.confirmed), 1)
              const plannedPct = (Math.abs(item.planned) / maxVal) * 100
              const expectedPct = (Math.abs(item.expected) / maxVal) * 100
              const confirmedPct = (Math.abs(item.confirmed) / maxVal) * 100
              
              const isExpense = item.planned < 0 || item.expected < 0
              const barColor = isExpense ? 'bg-red-500' : 'bg-green-500'
              const bgColor = isExpense ? 'bg-red-900/20' : 'bg-green-900/20'

              return (
                <div key={item.category_id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleExpand(item.category_id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors"
                      >
                        <svg className={`w-5 h-5 transition-transform ${expandedCategories.has(item.category_id) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      <h3 className="font-semibold text-lg text-white">{item.category_name}</h3>
                    </div>
                    <div className="text-right">
                      {editingId === item.category_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveBudget(item.category_id)}
                          />
                          <button onClick={() => handleSaveBudget(item.category_id)} className="text-green-500 hover:text-green-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleCopyBudget(item.category_id)}
                            className="text-slate-600 hover:text-blue-400 transition-colors"
                            title="Copiar do mês anterior"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </button>
                          <div 
                            onClick={() => { setEditingId(item.category_id); setEditValue(item.planned.toString()); }}
                            className="cursor-pointer hover:text-blue-400 transition-colors"
                            title="Clique para editar o planejado"
                          >
                            <span className="text-xs text-slate-500 block">Planejado</span>
                            <span className="font-bold">{formatCurrency(item.planned)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative h-8 bg-slate-950 rounded-full overflow-hidden mb-2">
                    {/* Planned Marker (Background) */}
                    <div 
                      className={`absolute top-0 bottom-0 left-0 ${bgColor} border-r-2 border-dashed border-slate-600 opacity-50`} 
                      style={{ width: `${plannedPct}%` }} 
                    />
                    
                    {/* Expected (Lighter) */}
                    <div 
                      className={`absolute top-2 bottom-2 left-0 ${barColor} opacity-40 rounded-full`} 
                      style={{ width: `${expectedPct}%` }} 
                    />
                    
                    {/* Confirmed (Solid) */}
                    <div 
                      className={`absolute top-2 bottom-2 left-0 ${barColor} rounded-full`} 
                      style={{ width: `${confirmedPct}%` }} 
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <div>
                      Confirmado: <span className="text-white">{formatCurrency(item.confirmed)}</span>
                    </div>
                    <div>
                      Previsto: <span className="text-white">{formatCurrency(item.expected)}</span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCategories.has(item.category_id) && (
                    <div className="mt-4 pt-4 border-t border-slate-800">
                      {loadingDetails.has(item.category_id) ? (
                        <div className="text-center text-slate-500 text-sm py-2">Carregando detalhes...</div>
                      ) : categoryDetails[item.category_id]?.length > 0 ? (
                        <div className="space-y-2">
                          {categoryDetails[item.category_id].map(record => (
                            <div 
                              key={record.id} 
                              onClick={() => openEditModal(record)}
                              className="flex justify-between items-center text-sm p-2 hover:bg-slate-800/50 rounded cursor-pointer group"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${record.status === 'completed' ? 'bg-green-500' : 'bg-slate-600'}`} />
                                <span className="text-slate-300 group-hover:text-white transition-colors">{record.title}</span>
                              </div>
                              <span className={record.type === 'income' ? 'text-green-400' : 'text-red-400'}>
                                {record.type === 'expense' ? '-' : ''}{formatCurrency(record.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-2">Nenhum registro encontrado.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Record Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Editar Registro</h2>
            <form onSubmit={handleSaveRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={recordFormData.title}
                  onChange={e => setRecordFormData({...recordFormData, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={recordFormData.value}
                    onChange={e => setRecordFormData({...recordFormData, value: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={recordFormData.billDate}
                    onChange={e => setRecordFormData({...recordFormData, billDate: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Categorias</label>
                <div className="flex flex-wrap gap-2">
                  {summary.map(cat => (
                    <button
                      key={cat.category_id}
                      type="button"
                      onClick={() => {
                        const current = recordFormData.selectedCategories
                        const newCats = current.includes(cat.category_name)
                          ? current.filter(c => c !== cat.category_name)
                          : [...current, cat.category_name]
                        setRecordFormData({...recordFormData, selectedCategories: newCats})
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${
                        recordFormData.selectedCategories.includes(cat.category_name)
                          ? 'bg-blue-900/50 border-blue-500 text-blue-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.category_name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsRecordModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Nova Categoria</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsCategoryModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</button>
                <button onClick={handleCreateCategory} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ScrollToTopButton />
    </div>
  )
}
