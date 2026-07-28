import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'
import ScrollToTopButton from '../components/ScrollToTopButton'

interface Company {
  id: number
  name: string
  gupy_slug: string | null
  gupy_confirmed_at: string | null
  inhire_slug: string | null
  inhire_confirmed_at: string | null
  interesse: boolean
}

interface JobListing {
  id: number
  company_id: number
  company_name: string
  platform: 'gupy' | 'inhire'
  title: string
  url: string
  location: string | null
  workplace_type: string | null
  published_date: string | null
  fetched_at: string
}

type SortOption = 'date' | 'alpha' | 'company'

interface SearchHistoryItem {
  id: number
  terms: string[]
  status: 'running' | 'done'
  total: number
  completed: number
  created_at: string
  job_count: number
}

const POLL_INTERVAL_MS = 1500

export default function BuscarVagas() {
  const navigate = useNavigate()
  const { notify } = useNotify()

  const [companies, setCompanies] = useState<Company[]>([])
  const [companyFilter, setCompanyFilter] = useState("")
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)
  const [otherVisibleCount, setOtherVisibleCount] = useState(50)

  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<number>>(new Set())
  const [terms, setTerms] = useState<string[]>([])
  const [termInput, setTermInput] = useState("")

  const [cargoInput, setCargoInput] = useState("")
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<{ text: string; selected: boolean }[]>([])
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false)

  const [isSearching, setIsSearching] = useState(false)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchCompleted, setSearchCompleted] = useState(0)
  const [results, setResults] = useState<JobListing[]>([])
  const [activeSearchId, setActiveSearchId] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('date')

  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([])
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    fetchCompanies()
    fetchRecentSearches()
    return () => stopPolling()
  }, [])

  useEffect(() => {
    setOtherVisibleCount(50)
  }, [companyFilter])

  const authHeaders = () => {
    const token = localStorage.getItem("access_token")
    return { "Authorization": `Bearer ${token}` }
  }

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true)
    try {
      const res = await fetch(`${config.API_URL}/vagas/empresas`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to fetch companies")
      const data: Company[] = await res.json()
      setCompanies(data)
      setSelectedCompanyIds(prev => {
        if (prev.size > 0) return prev
        return new Set(data.filter(c => c.interesse).map(c => c.id))
      })
    } catch {
      notify("Erro ao carregar empresas", "error")
    } finally {
      setIsLoadingCompanies(false)
    }
  }

  const fetchRecentSearches = async () => {
    try {
      const res = await fetch(`${config.API_URL}/vagas/buscas`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to fetch searches")
      setRecentSearches(await res.json())
    } catch {
      notify("Erro ao carregar histórico de buscas", "error")
    }
  }

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return
    try {
      const res = await fetch(`${config.API_URL}/vagas/empresas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: newCompanyName.trim() })
      })
      if (!res.ok) throw new Error("Failed to create company")
      notify("Empresa adicionada!", "success")
      setIsAddCompanyModalOpen(false)
      setNewCompanyName("")
      fetchCompanies()
    } catch {
      notify("Erro ao adicionar empresa", "error")
    }
  }

  const handleToggleInterest = async (companyId: number) => {
    try {
      const res = await fetch(`${config.API_URL}/vagas/empresas/${companyId}/interesse`, {
        method: "POST",
        headers: authHeaders()
      })
      if (!res.ok) throw new Error("Failed to toggle interest")
      const { interesse } = await res.json()
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, interesse } : c))
      setSelectedCompanyIds(prev => {
        const next = new Set(prev)
        if (interesse) next.add(companyId)
        else next.delete(companyId)
        return next
      })
    } catch {
      notify("Erro ao atualizar interesse", "error")
    }
  }

  const toggleSelected = (companyId: number) => {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedCompanyIds(prev => {
      const next = new Set(prev)
      filteredCompanies.forEach(c => next.add(c.id))
      return next
    })
  }

  const clearSelection = () => setSelectedCompanyIds(new Set())

  const addTerm = () => {
    const value = termInput.trim()
    if (!value || terms.includes(value)) return
    setTerms([...terms, value])
    setTermInput("")
  }

  const removeTerm = (term: string) => {
    setTerms(terms.filter(t => t !== term))
  }

  const handleSuggestTerms = async () => {
    const cargo = cargoInput.trim()
    if (!cargo) return
    setIsSuggesting(true)
    try {
      const res = await fetch(`${config.API_URL}/vagas/sugerir-termos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ cargo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to suggest terms")
      setSuggestions(data.terms.map((text: string) => ({ text, selected: true })))
      setIsSuggestModalOpen(true)
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erro ao sugerir termos", "error")
    } finally {
      setIsSuggesting(false)
    }
  }

  const toggleAllSuggestions = (selected: boolean) => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected })))
  }

  const updateSuggestionText = (index: number, text: string) => {
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, text } : s))
  }

  const toggleSuggestionSelected = (index: number) => {
    setSuggestions(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s))
  }

  const removeSuggestion = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirmSuggestions = () => {
    const chosen = suggestions
      .filter(s => s.selected && s.text.trim())
      .map(s => s.text.trim())
    const merged = [...terms]
    for (const term of chosen) {
      if (!merged.includes(term)) merged.push(term)
    }
    setTerms(merged)
    setIsSuggestModalOpen(false)
    setSuggestions([])
  }

  const handleDismissSuggestions = () => {
    setIsSuggestModalOpen(false)
    setSuggestions([])
  }

  const stopPolling = () => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const pollStatus = async (searchId: number) => {
    try {
      const res = await fetch(`${config.API_URL}/vagas/buscas/${searchId}/status`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to poll search status")
      const data = await res.json()
      setSearchCompleted(data.completed)
      setSearchTotal(data.total)
      setResults(data.jobs)
      if (data.status === "done") {
        stopPolling()
        setIsSearching(false)
        fetchRecentSearches()
      }
    } catch {
      stopPolling()
      setIsSearching(false)
      notify("Erro ao acompanhar a busca", "error")
    }
  }

  const handleSearch = async () => {
    if (terms.length === 0) {
      notify("Informe ao menos um termo de busca", "error")
      return
    }
    if (selectedCompanyIds.size === 0) {
      notify("Selecione ao menos uma empresa", "error")
      return
    }
    stopPolling()
    setResults([])
    setSearchCompleted(0)
    setIsSearching(true)
    setShowResults(true)
    try {
      const res = await fetch(`${config.API_URL}/vagas/buscar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ terms, companyIds: Array.from(selectedCompanyIds) })
      })
      if (!res.ok) throw new Error("Failed to start search")
      const data = await res.json()
      setActiveSearchId(data.search_id)
      setSearchTotal(data.total)
      pollRef.current = window.setInterval(() => pollStatus(data.search_id), POLL_INTERVAL_MS)
      pollStatus(data.search_id)
    } catch {
      setIsSearching(false)
      notify("Erro ao iniciar busca", "error")
    }
  }

  const handleLoadHistory = async (searchId: number) => {
    stopPolling()
    setIsSearching(false)
    setActiveSearchId(searchId)
    try {
      const res = await fetch(`${config.API_URL}/vagas/buscas/${searchId}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load search")
      const data = await res.json()
      setResults(data.jobs)
      setSearchTotal(data.total)
      setSearchCompleted(data.completed)
      setShowResults(true)
    } catch {
      notify("Erro ao carregar busca anterior", "error")
    }
  }

  const closeResults = () => {
    setShowResults(false)
    setActiveSearchId(null)
  }

  const jobDate = (job: JobListing) => new Date(job.published_date || job.fetched_at)

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'alpha') return a.title.localeCompare(b.title)
    if (sortBy === 'company') return a.company_name.localeCompare(b.company_name)
    return jobDate(b).getTime() - jobDate(a).getTime()
  })

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(companyFilter.toLowerCase())
  )
  const interestCompanies = filteredCompanies.filter(c => c.interesse)
  const otherCompaniesAll = filteredCompanies.filter(c => !c.interesse)
  const otherCompanies = otherCompaniesAll.slice(0, otherVisibleCount)
  const otherCompaniesRemaining = otherCompaniesAll.length - otherCompanies.length

  const pendingCount = Math.max(searchTotal - searchCompleted, 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Buscar Vagas</h1>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Companies panel */}
          <div className="md:col-span-1 bg-slate-900/50 border border-slate-800 rounded-xl p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">Empresas ({companies.length})</h2>
              <button
                onClick={() => setIsAddCompanyModalOpen(true)}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs transition-colors"
              >
                + Empresa
              </button>
            </div>
            <input
              type="text"
              placeholder="Filtrar empresas..."
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white mb-2 focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-3">
                <button onClick={selectAllFiltered} className="text-blue-400 hover:text-blue-300">
                  Selecionar {companyFilter ? "filtradas" : "todas"}
                </button>
                <button onClick={clearSelection} className="text-blue-400 hover:text-blue-300">Limpar seleção</button>
              </div>
              <span className="text-slate-500">{selectedCompanyIds.size} selecionada{selectedCompanyIds.size !== 1 ? 's' : ''}</span>
            </div>

            {isLoadingCompanies ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto space-y-1">
                {interestCompanies.length === 0 && otherCompanies.length === 0 && (
                  <p className="text-sm text-slate-500 py-4 text-center">Nenhuma empresa encontrada.</p>
                )}
                {interestCompanies.map(c => (
                  <CompanyRow
                    key={c.id}
                    company={c}
                    selected={selectedCompanyIds.has(c.id)}
                    onToggleSelected={() => toggleSelected(c.id)}
                    onToggleInterest={() => handleToggleInterest(c.id)}
                  />
                ))}
                {otherCompanies.length > 0 && (
                  <>
                    <p className="text-xs text-slate-500 pt-2 pb-1">Outras empresas ({otherCompaniesAll.length})</p>
                    {otherCompanies.map(c => (
                      <CompanyRow
                        key={c.id}
                        company={c}
                        selected={selectedCompanyIds.has(c.id)}
                        onToggleSelected={() => toggleSelected(c.id)}
                        onToggleInterest={() => handleToggleInterest(c.id)}
                      />
                    ))}
                    {otherCompaniesRemaining > 0 && (
                      <button
                        onClick={() => setOtherVisibleCount(prev => prev + 50)}
                        className="w-full text-center text-xs text-blue-400 hover:text-blue-300 py-2"
                      >
                        + {otherCompaniesRemaining} restante{otherCompaniesRemaining !== 1 ? 's' : ''} · carregar mais
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search + results panel */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold text-white mb-3">Termos de busca</h2>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Cargo desejado (ex: Analista de Dados)"
                  value={cargoInput}
                  onChange={e => setCargoInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSuggestTerms() } }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSuggestTerms}
                  disabled={isSuggesting || !cargoInput.trim()}
                  className="px-3 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {isSuggesting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : "✨ Sugerir termos"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {terms.map(term => (
                  <span key={term} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-900/50 border border-blue-500 text-blue-200">
                    {term}
                    <button onClick={() => removeTerm(term)} className="hover:text-white">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Analista de Dados"
                  value={termInput}
                  onChange={e => setTermInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm() } }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={addTerm}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors border border-slate-700"
                >
                  Adicionar
                </button>
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Buscando... ({pendingCount} pendente{pendingCount !== 1 ? 's' : ''} de {searchTotal})
                  </>
                ) : (
                  `Buscar em ${selectedCompanyIds.size} empresa${selectedCompanyIds.size !== 1 ? 's' : ''}`
                )}
              </button>
              {!showResults && (activeSearchId !== null || results.length > 0) && (
                <button
                  onClick={() => setShowResults(true)}
                  className="mt-2 w-full text-center text-xs text-blue-400 hover:text-blue-300 py-1"
                >
                  Ver resultados ({results.length})
                </button>
              )}
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold text-white mb-3">Buscas recentes</h2>
              {recentSearches.length === 0 ? (
                <p className="text-sm text-slate-500 py-2 text-center">Nenhuma busca realizada ainda.</p>
              ) : (
                <div className="space-y-1">
                  {recentSearches.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleLoadHistory(s.id)}
                      className={`w-full text-left flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                        activeSearchId === s.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-slate-300">{s.terms.join(", ")}</span>
                      <span className="text-xs text-slate-500">{s.job_count} vaga{s.job_count !== 1 ? 's' : ''} · {new Date(s.created_at).toLocaleString('pt-BR')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {showResults && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">Resultados</h2>
                {isSearching && (
                  <span className="flex items-center gap-2 px-2 py-1 rounded-full bg-blue-900/40 border border-blue-700 text-blue-200 text-xs">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-300"></div>
                    {pendingCount} busca{pendingCount !== 1 ? 's' : ''} pendente{pendingCount !== 1 ? 's' : ''} de {searchTotal}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{results.length} vaga{results.length !== 1 ? 's' : ''}</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="date">Mais recentes</option>
                  <option value="alpha">Ordem alfabética</option>
                  <option value="company">Empresa</option>
                </select>
                <button
                  onClick={closeResults}
                  title="Fechar resultados"
                  className="p-1 text-slate-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                {isSearching ? "Aguardando resultados..." : "Nenhum resultado ainda. Selecione empresas, adicione termos e clique em Buscar."}
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto">
                {sortedResults.map(job => (
                  <a
                    key={job.id}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{job.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${job.platform === 'gupy' ? 'bg-purple-900/50 text-purple-200 border border-purple-500' : 'bg-teal-900/50 text-teal-200 border border-teal-500'}`}>
                        {job.platform === 'gupy' ? 'Gupy' : 'InHire'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{job.company_name}</span>
                      {job.workplace_type && <span>· {job.workplace_type}</span>}
                      {job.location && <span>· {job.location}</span>}
                      <span>· {job.published_date ? jobDate(job).toLocaleDateString('pt-BR') : `encontrada em ${jobDate(job).toLocaleDateString('pt-BR')}`}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isSuggestModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl p-6 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-1">Termos sugeridos</h2>
            <p className="text-xs text-slate-500 mb-4">para: {cargoInput}</p>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <button onClick={() => toggleAllSuggestions(true)} className="text-blue-400 hover:text-blue-300">Selecionar todos</button>
              <button onClick={() => toggleAllSuggestions(false)} className="text-blue-400 hover:text-blue-300">Desmarcar todos</button>
            </div>
            <div className="space-y-2 overflow-y-auto mb-4">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={() => toggleSuggestionSelected(i)}
                    className="w-4 h-4 accent-blue-600 shrink-0"
                  />
                  <input
                    type="text"
                    value={s.text}
                    onChange={e => updateSuggestionText(i, e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={() => removeSuggestion(i)} className="text-slate-500 hover:text-white px-1">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={handleDismissSuggestions} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Recusar todas</button>
              <button onClick={handleConfirmSuggestions} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Adicionar termos selecionados</button>
            </div>
          </div>
        </div>
      )}

      {isAddCompanyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Nova Empresa</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCompany() }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsAddCompanyModalOpen(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</button>
                <button onClick={handleAddCompany} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ScrollToTopButton />
    </div>
  )
}

function CompanyRow({ company, selected, onToggleSelected, onToggleInterest }: {
  company: Company
  selected: boolean
  onToggleSelected: () => void
  onToggleInterest: () => void
}) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800/50">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelected}
        className="w-4 h-4 accent-blue-600"
      />
      <span className="flex-1 text-sm text-slate-300 truncate" title={company.name}>{company.name}</span>
      {company.gupy_slug && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-200">G</span>}
      {company.inhire_slug && <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/50 text-teal-200">I</span>}
      <button
        onClick={onToggleInterest}
        title={company.interesse ? "Remover interesse" : "Marcar interesse"}
        className={company.interesse ? "text-yellow-400" : "text-slate-600 hover:text-slate-400"}
      >
        ★
      </button>
    </div>
  )
}
