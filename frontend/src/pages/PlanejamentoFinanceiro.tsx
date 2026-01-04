import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'
import ScrollToTopButton from '../components/ScrollToTopButton'

interface FinancialRecord {
  id: number
  title: string
  description?: string
  value: number
  type: 'income' | 'expense'
  bill_date: string
  status: 'pending' | 'completed'
  categories: Category[]
  created_at: string
}

interface Category {
  id: number
  name: string
}

interface PaginationControlsProps {
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  itemsPerPage: number
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>
  totalRecords: number
  isLoading: boolean
}

function PaginationControls({ 
  currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalRecords, isLoading 
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [tempPage, setTempPage] = useState(currentPage.toString())
  const [isCustomItems, setIsCustomItems] = useState(![10, 20, 50, 100, 200, 500].includes(itemsPerPage))
  const [tempItemsPerPage, setTempItemsPerPage] = useState(itemsPerPage.toString())

  useEffect(() => {
    setTempPage(currentPage.toString())
  }, [currentPage])

  useEffect(() => {
      const isStandard = [10, 20, 50, 100, 200, 500].includes(itemsPerPage)
      if (!isStandard) setIsCustomItems(true)
      setTempItemsPerPage(itemsPerPage.toString())
  }, [itemsPerPage])

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let p = parseInt(tempPage)
    if (isNaN(p)) p = 1
    if (p < 1) p = 1
    if (p > totalPages) p = totalPages
    setCurrentPage(p)
    setIsEditingPage(false)
  }

  const handleItemsPerPageSubmit = () => {
    let val = parseInt(tempItemsPerPage)
    if (isNaN(val) || val < 1) val = 1
    setItemsPerPage(val)
    setTempItemsPerPage(val.toString())
  }

  if (isLoading || totalRecords === 0) return null

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 my-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>Itens por página:</span>
        {isCustomItems ? (
           <div className="flex items-center gap-2">
              <input 
                type="number"
                value={tempItemsPerPage}
                onChange={(e) => setTempItemsPerPage(e.target.value)}
                onBlur={handleItemsPerPageSubmit}
                onKeyDown={(e) => { if(e.key === 'Enter') handleItemsPerPageSubmit() }}
                className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:border-blue-500 outline-none"
              />
              <button onClick={() => setIsCustomItems(false)} className="text-xs text-blue-400 hover:underline">Lista</button>
           </div>
        ) : (
          <div className="relative flex items-center">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomItems(true)
                } else {
                  setItemsPerPage(Number(e.target.value))
                }
              }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white focus:border-blue-500 outline-none appearance-none pr-8"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value="custom">Outro...</option>
            </select>
            <div className="absolute right-2 pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        )}
        {itemsPerPage > 100 && <span className="text-yellow-500 text-xs ml-2">(Pode ser lento)</span>}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm text-slate-300 flex items-center gap-1">
          Página 
          {isEditingPage ? (
            <form onSubmit={handlePageSubmit} className="inline-block">
                <input 
                    type="number" 
                    value={tempPage}
                    onChange={(e) => setTempPage(e.target.value)}
                    onBlur={handlePageSubmit}
                    autoFocus
                    className="w-16 text-center bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-white text-sm outline-none"
                />
            </form>
          ) : (
            <span 
                onClick={() => { setTempPage(currentPage.toString()); setIsEditingPage(true); }}
                className="font-bold text-white cursor-pointer hover:text-blue-400 hover:underline px-1"
                title="Clique para ir para uma página"
            >
                {currentPage}
            </span>
          )}
          de <span className="font-bold text-white">{totalPages}</span>
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  )
}

export default function PlanejamentoFinanceiro() {
  const navigate = useNavigate()
  const { notify } = useNotify()
  
  const [records, setRecords] = useState<FinancialRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null)
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false)
  const [monthPickerYear, setMonthPickerYear] = useState(new Date().getFullYear())
  const [areValuesVisible, setAreValuesVisible] = useState(true)
  
  // Operations State
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const getCurrentMonthRange = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const format = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return { start: format(firstDay), end: format(lastDay) }
  }

  const [initialFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('finance_filters')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      sortBy: 'billDate',
      typeFilter: 'all',
      categoryFilter: 'all',
      dateRange: getCurrentMonthRange(),
      searchTerm: ''
    }
  })
  
  // Filters
  const [sortBy, setSortBy] = useState<'billDate' | 'value' | 'created'>(initialFilters.sortBy as any)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>(initialFilters.typeFilter as any)
  const [categoryFilter, setCategoryFilter] = useState<string[]>(Array.isArray(initialFilters.categoryFilter) ? initialFilters.categoryFilter : [])
  const [dateRange, setDateRange] = useState(initialFilters.dateRange)
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm || '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialFilters.searchTerm || '')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [totalRecords, setTotalRecords] = useState(0)
  const [serverTotals, setServerTotals] = useState({ income: 0, expense: 0 })

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: '',
    type: 'expense' as 'income' | 'expense',
    billDate: '',
    selectedCategories: [] as string[],
    status: 'pending' as 'pending' | 'completed',
    isInstallment: false,
    installments: 2
  })
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [showAllCategories, setShowAllCategories] = useState(false)

  useEffect(() => {
    Promise.all([fetchRecords(), fetchCategories()])
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('finance_filters', JSON.stringify({
      sortBy, typeFilter, categoryFilter, dateRange, searchTerm
    }))
  }, [sortBy, typeFilter, categoryFilter, dateRange, searchTerm])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 1000)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy, typeFilter, categoryFilter, dateRange, debouncedSearchTerm, itemsPerPage])

  useEffect(() => {
    fetchRecords()
  }, [currentPage, itemsPerPage, sortBy, typeFilter, categoryFilter, dateRange, debouncedSearchTerm])

  const fetchRecords = async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      
      const params = new URLSearchParams({
        skip: ((currentPage - 1) * itemsPerPage).toString(),
        limit: itemsPerPage.toString(),
        sort_by: sortBy
      })

      if (typeFilter !== 'all') params.append('type', typeFilter)
      if (categoryFilter.length > 0) {
        categoryFilter.forEach(id => params.append('category_ids', id))
      }
      if (dateRange.start) params.append('start_date', dateRange.start)
      if (dateRange.end) params.append('end_date', dateRange.end)
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)

      const res = await fetch(`${config.API_URL}/financial-records?${params.toString()}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      
      setRecords(Array.isArray(data.items) ? data.items : [])
      setTotalRecords(data.total)
      setServerTotals({
        income: data.total_income,
        expense: data.total_expense
      })
    } catch (error) {
      notify("Erro ao carregar registros", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/categories`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to fetch categories")
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    }
  }

  const handleOpenModal = (record?: FinancialRecord) => {
    if (record) {
      setEditingId(record.id)
      setFormData({
        title: record.title,
        description: record.description ? record.description : '',
        value: record.value.toString(),
        type: record.type,
        billDate: record.bill_date,
        selectedCategories: record.categories.map(c => c.name),
        status: record.status,
        isInstallment: false,
        installments: 2
      })
      setNewCategoryInput('')
    } else {
      setEditingId(null)
      setFormData({
        title: '',
        description: '',
        value: '',
        type: 'expense',
        billDate: (() => {
          const d = new Date()
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })(),
        selectedCategories: [],
        status: 'pending',
        isInstallment: false,
        installments: 2
      })
      setNewCategoryInput('')
    }
    setIsModalOpen(true)
  }

  const handleDuplicate = (record: FinancialRecord) => {
    setEditingId(null)
    setFormData({
      title: record.title,
      description: record.description ? record.description : '',
      value: record.value.toString(),
      type: record.type,
      billDate: '',
      selectedCategories: record.categories.map(c => c.name),
      status: 'pending',
      isInstallment: false,
      installments: 2
    })
    setNewCategoryInput('')
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    if (formData.selectedCategories.length === 0) {
      notify("Selecione ou crie uma categoria", "error")
      setIsSaving(false)
      return
    }

    try {
      const token = localStorage.getItem("access_token")
      
      if (!editingId && formData.isInstallment && formData.installments > 1) {
        const promises = []
        const [year, month, day] = formData.billDate.split('-').map(Number)
        
        for (let i = 1; i <= formData.installments; i++) {
          const date = new Date(year, month - 1 + (i - 1), day)
          const y = date.getFullYear()
          const m = String(date.getMonth() + 1).padStart(2, '0')
          const d = String(date.getDate()).padStart(2, '0')
          const billDate = `${y}-${m}-${d}`
          
          const title = `${formData.title} (${i}/${formData.installments})`
          
          promises.push(fetch(`${config.API_URL}/financial-records`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              title: title,
              description: formData.description,
              value: parseFloat(formData.value),
              type: formData.type,
              billDate: billDate,
              categoryNames: formData.selectedCategories,
              status: formData.status
            })
          }))
        }
        
        await Promise.all(promises)
        notify(`${formData.installments} registros criados!`, "success")
        setRecords([]) // Clear to force refresh or just append? Fetching is safer.
        fetchRecords()
        fetchCategories()
        setIsModalOpen(false)
      } else {
        const url = editingId 
          ? `${config.API_URL}/financial-records/${editingId}`
          : `${config.API_URL}/financial-records`
        
        const method = editingId ? "PATCH" : "POST"

        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            value: parseFloat(formData.value),
            type: formData.type,
            billDate: formData.billDate,
            categoryNames: formData.selectedCategories,
            status: formData.status
          })
        })

        if (!res.ok) throw new Error("Failed to save")
        
        const savedRecord = await res.json()
        
        if (editingId) {
          setRecords(records.map(r => r.id === editingId ? savedRecord : r))
          notify("Registro atualizado!", "success")
        } else {
          setRecords([...records, savedRecord])
          notify("Registro criado!", "success")
        }
        
        fetchCategories()
        setIsModalOpen(false)
      }
    } catch (error) {
      notify("Erro ao salvar registro", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/financial-records/${deletingId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete")
      
      setRecords(records.filter(r => r.id !== deletingId))
      notify("Registro removido!", "success")
      setIsDeleteModalOpen(false)
    } catch (error) {
      notify("Erro ao remover registro", "error")
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }


  const confirmDeleteCategory = async () => {
    if (!deletingCategoryId) return
    setIsDeleting(true)

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/categories/${deletingCategoryId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Failed to delete category")
      
      setCategories(categories.filter(c => c.id !== deletingCategoryId))
      
      if (Array.isArray(categoryFilter) && categoryFilter.includes(deletingCategoryId.toString())) {
        setCategoryFilter(categoryFilter.filter(id => id !== deletingCategoryId.toString()))
      }
      
      const deletedCatName = categories.find(c => c.id === deletingCategoryId)?.name
      if (deletedCatName && formData.selectedCategories.includes(deletedCatName)) {
        setFormData({ ...formData, selectedCategories: formData.selectedCategories.filter(n => n !== deletedCatName) })
      }

      fetchRecords()
      notify("Categoria removida!", "success")
      setIsDeleteCategoryModalOpen(false)
    } catch (error) {
      notify("Erro ao remover categoria", "error")
    } finally {
      setIsDeleting(false)
      setDeletingCategoryId(null)
    }
  }

  const handleMonthSelect = (monthIndex: number) => {
    const year = monthPickerYear
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    
    const format = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    
    setDateRange({ start: format(firstDay), end: format(lastDay) })
    setIsMonthModalOpen(false)
  }

  const handleYearSelect = () => {
    const year = monthPickerYear
    setDateRange({ start: `${year}-01-01`, end: `${year}-12-31` })
    setIsMonthModalOpen(false)
  }

  const handleClearFilters = () => {
    setSortBy('billDate')
    setTypeFilter('all')
    setCategoryFilter([])
    setDateRange(getCurrentMonthRange())
    setSearchTerm('')
    setDebouncedSearchTerm('')
  }

  // Derived State
  // Filtering is now server-side
  const totalIncome = serverTotals.income
  const totalExpense = serverTotals.expense
  const totalOverall = totalIncome - totalExpense

  const formatCurrency = (val: number) => {
    if (!areValuesVisible) return 'R$ ****'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const toggleCategoryFilter = (catId: string) => {
    if (Array.isArray(categoryFilter) && categoryFilter.includes(catId)) {
      setCategoryFilter(categoryFilter.filter(id => id !== catId))
    } else {
      const current = Array.isArray(categoryFilter) ? categoryFilter : []
      setCategoryFilter([...current, catId])
    }
  }

  const toggleRecordStatus = async (record: FinancialRecord) => {
    const newStatus = record.status === 'pending' ? 'completed' : 'pending'
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/financial-records/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error("Failed to update status")
      const updated = await res.json()
      setRecords(records.map(r => r.id === record.id ? updated : r))
    } catch (e) {
      notify("Erro ao atualizar status", "error")
    }
  }

  const removeCategoryFromRecord = async (record: FinancialRecord, catName: string) => {
    const newCategories = record.categories?.filter(c => c.name !== catName).map(c => c.name) || []
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/financial-records/${record.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ categoryNames: newCategories })
      })
      if (!res.ok) throw new Error("Failed to update categories")
      const updated = await res.json()
      setRecords(records.map(r => r.id === record.id ? updated : r))
    } catch (e) {
      notify("Erro ao remover categoria", "error")
    }
  }

  const handleAddCategory = () => {
    const val = newCategoryInput.trim()
    if (val && !formData.selectedCategories.includes(val)) {
      setFormData(prev => ({...prev, selectedCategories: [...prev.selectedCategories, val]}))
      setNewCategoryInput('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/")}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Planejamento Financeiro</h1>
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Novo Lançamento</span>
            </button>
          </div>
        </header>

        {/* Totals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <p className="text-slate-400 text-sm mb-1">Receitas</p>
            <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <p className="text-slate-400 text-sm mb-1">Despesas</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <p className="text-slate-400 text-sm mb-1">Total Geral</p>
            <p className={`text-2xl font-bold ${totalOverall >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(totalOverall)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-start gap-4 mb-6 bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-xs text-slate-500 uppercase font-bold">Buscar</label>
            <div className="flex items-center relative">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Título ou descrição..."
                className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-l px-3 py-1 text-sm text-slate-300 focus:border-blue-500 outline-none"
              />
              <button
                onClick={() => setDebouncedSearchTerm(searchTerm)}
                className="bg-slate-800 border border-l-0 border-slate-800 rounded-r px-3 py-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-xs text-slate-500 uppercase font-bold">Ordenar por</label>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full md:w-auto bg-slate-950 border border-slate-800 rounded px-3 py-1 text-sm text-slate-300 focus:border-blue-500 outline-none"
            >
              <option value="billDate">Data do Vencimento</option>
              <option value="value">Valor</option>
              <option value="created">Data de Registro</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-xs text-slate-500 uppercase font-bold">Tipo</label>
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full md:w-auto bg-slate-950 border border-slate-800 rounded px-3 py-1 text-sm text-slate-300 focus:border-blue-500 outline-none"
            >
              <option value="all">Todos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-xs text-slate-500 uppercase font-bold">Categoria</label>
            <div className="flex flex-wrap gap-2 max-w-md">
              {(showAllCategories ? categories : categories.slice(0, 10)).map(cat => {
                const isSelected = Array.isArray(categoryFilter) && categoryFilter.includes(cat.id.toString())
                return (
                  <div
                    key={cat.id}
                    onClick={() => toggleCategoryFilter(cat.id.toString())}
                    className={`group flex items-center gap-1 px-3 py-1 rounded text-sm border transition-colors cursor-pointer select-none ${isSelected ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                  >
                    <span>{cat.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingCategoryId(cat.id)
                        setIsDeleteCategoryModalOpen(true)
                      }}
                      className="hidden group-hover:block text-slate-500 hover:text-red-500 -mr-1"
                      title="Excluir Categoria"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )
              })}
              {categories.length > 10 && (
                <button 
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="px-2 py-0.5 rounded text-xs border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  {showAllCategories ? "Ver menos" : "Ver mais"}
                </button>
              )}
              {categoryFilter.length > 0 && (
                <button 
                  onClick={() => setCategoryFilter([])}
                  className="px-2 py-0.5 rounded text-xs border border-red-900/30 text-red-400 hover:bg-red-900/20"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-xs text-slate-500 uppercase font-bold">Período (Vencimento)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="flex-1 md:flex-none bg-slate-950 border border-slate-800 rounded px-3 py-1 text-sm text-slate-300 focus:border-blue-500 outline-none [color-scheme:dark]"
                title="Data Inicial"
              />
              <input 
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="flex-1 md:flex-none bg-slate-950 border border-slate-800 rounded px-3 py-1 text-sm text-slate-300 focus:border-blue-500 outline-none [color-scheme:dark]"
                title="Data Final"
              />
              <button 
                onClick={() => setIsMonthModalOpen(true)}
                className="w-full md:w-auto px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                title="Selecionar Período"
              >
                Selecionar Período
              </button>
            </div>
          </div>
          <div className="md:ml-auto w-full md:w-auto text-right mt-2 md:mt-0">
            <button 
              onClick={handleClearFilters}
              className="text-xs text-slate-400 hover:text-white underline decoration-slate-700 hover:decoration-white underline-offset-2 transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        <PaginationControls 
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          totalRecords={totalRecords}
          isLoading={isLoading}
        />

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
            Nenhum registro encontrado.
          </div>
        ) : (
          <div className="grid gap-4">
            {records.map((record) => (
              <div key={record.id} className={`bg-slate-900/50 border p-4 rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${record.status === 'completed' ? 'border-green-500/30 opacity-75' : 'border-slate-800 hover:border-blue-500/30'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <button 
                      onClick={() => toggleRecordStatus(record)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${record.status === 'completed' ? 'bg-green-500 border-green-500 text-black' : 'border-slate-600 hover:border-slate-400 group'}`}
                      title={record.status === 'completed' ? 'Marcar como pendente' : 'Marcar como concluído'}
                    >
                      <svg className={`w-3.5 h-3.5 transition-opacity ${record.status === 'completed' ? 'opacity-100' : 'opacity-10 group-hover:opacity-50 text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </button>
                    <h3 className="text-lg font-semibold text-white break-words">{record.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      record.type === 'income' ? 'bg-green-900/30 border-green-800 text-green-400' : 'bg-red-900/30 border-red-800 text-red-400'
                    }`}>
                      {record.type === 'income' ? 'Receita' : 'Despesa'}
                    </span>
                    <div className="flex flex-wrap gap-1 items-center">
                      {record.categories.map(cat => (
                        <span key={cat.id} className="group flex items-center gap-1 text-xs text-slate-400 border border-slate-800 bg-slate-950 px-2 py-0.5 rounded-full">
                          {cat.name}
                          <button onClick={() => removeCategoryFromRecord(record, cat.name)} className="hidden group-hover:block text-red-400 hover:text-red-300"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-2 [overflow-wrap:anywhere] whitespace-pre-wrap">{record.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Vencimento: {new Date(record.bill_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                    <span>Registrado em: {new Date(record.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-6 min-w-[200px]">
                  <span className={`text-xl font-bold ${record.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {record.type === 'expense' ? '-' : ''}{formatCurrency(record.value)}
                  </span>
                  <button 
                    onClick={() => handleDuplicate(record)}
                    className="text-slate-600 hover:text-green-500 transition-colors"
                    title="Duplicar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  </button>
                  <button 
                    onClick={() => handleOpenModal(record)}
                    className="text-slate-600 hover:text-blue-500 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button 
                    onClick={() => { setDeletingId(record.id); setIsDeleteModalOpen(true); }}
                    className="text-slate-600 hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        <PaginationControls 
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          totalRecords={totalRecords}
          isLoading={isLoading}
        />

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Tipo</label>
                    <div className="relative">
                      <select
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value as any})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 appearance-none"
                      >
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.value}
                      onChange={e => setFormData({...formData, value: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                    <div className="relative">
                      <select
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value as any})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 appearance-none"
                      >
                        <option value="pending">Pendente</option>
                        <option value="completed">Concluído</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Conta de Luz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Categorias</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.selectedCategories.map(catName => (
                        <span key={catName} className="flex items-center gap-1 bg-blue-900/30 border border-blue-800 text-blue-200 px-2 py-1 rounded-full text-sm">
                          {catName}
                          <button 
                            type="button"
                            onClick={() => setFormData({...formData, selectedCategories: formData.selectedCategories.filter(c => c !== catName)})}
                            className="hover:text-white"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <select
                          value=""
                          onChange={e => {
                            if (e.target.value && !formData.selectedCategories.includes(e.target.value)) {
                              setFormData({...formData, selectedCategories: [...formData.selectedCategories, e.target.value]})
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 appearance-none"
                        >
                          <option value="">Adicionar existente...</option>
                          {categories.filter(c => !formData.selectedCategories?.includes(c.name)).map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                        placeholder="Ou criar nova..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCategory()
                          }
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCategory}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                {!editingId && (
                  <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isInstallment"
                        checked={formData.isInstallment}
                        onChange={e => setFormData({...formData, isInstallment: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="isInstallment" className="text-sm font-medium text-slate-400 select-none cursor-pointer">Parcelado?</label>
                    </div>
                    {formData.isInstallment && (
                      <div className="flex items-center gap-2 flex-1">
                        <label className="text-sm text-slate-400">Nº Parcelas:</label>
                        <input
                          type="number"
                          min="2"
                          max="120"
                          value={formData.installments}
                          onChange={e => setFormData({...formData, installments: parseInt(e.target.value) || 2})}
                          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={formData.billDate}
                    onChange={e => setFormData({...formData, billDate: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
                    placeholder="Detalhes..."
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  >
                    {isSaving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Confirmar Exclusão</h2>
              <p className="text-slate-400 mb-8">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="cursor-pointer flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={`cursor-pointer flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium flex justify-center items-center ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    "Excluir"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Modal */}
        {isDeleteCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-4">Excluir Categoria</h2>
              <p className="text-slate-400 mb-6">
                Tem certeza que deseja excluir a categoria <span className="text-white font-semibold">{categories.find(c => c.id === deletingCategoryId)?.name}</span>?
              </p>
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-lg mb-8">
                Atenção: Os registros associados a esta categoria não serão excluídos, mas ficarão sem categoria definida.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteCategoryModalOpen(false)}
                  className="cursor-pointer flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteCategory}
                  disabled={isDeleting}
                  className={`cursor-pointer flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium flex justify-center items-center ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isDeleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    "Excluir"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Month Picker Modal */}
        {isMonthModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Selecionar Período</h2>
                <button onClick={() => setIsMonthModalOpen(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={() => setMonthPickerYear(y => y - 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button 
                  onClick={handleYearSelect}
                  className="text-lg font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-blue-600 transition-colors px-4 py-1 rounded-lg"
                  title="Selecionar todo o ano"
                >
                  {monthPickerYear}
                </button>
                <button onClick={() => setMonthPickerYear(y => y + 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                  <button
                    key={m}
                    onClick={() => handleMonthSelect(i)}
                    className="py-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <ScrollToTopButton />
      </div>
    </div>
  )
}
