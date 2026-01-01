import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'

interface Resolution {
  id: number
  title: string
  description: string
  targetDate: string
  status: 'pending' | 'completed'
}

export default function Resolucoes() {
  const navigate = useNavigate()
  const { notify } = useNotify()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  
  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  useEffect(() => {
    fetchResolutions()
  }, [])

  const fetchResolutions = async () => {
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/resolutions`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setResolutions(data.map((r: any) => ({ ...r, targetDate: r.target_date })))
    } catch (error) {
      notify("Erro ao carregar resoluções", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const [newRes, setNewRes] = useState({ title: '', description: '', targetDate: '' })
  const [editingId, setEditingId] = useState<number | null>(null)

  const getDateColorClass = (dateString: string, status: string) => {
    if (status === 'completed') return 'text-green-500'

    const target = new Date(dateString)
    const now = new Date()
    const diffTime = target.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return 'text-red-700'
    if (diffDays <= 7) return 'text-red-500'
    if (diffDays <= 30) return 'text-yellow-500'
    return 'text-slate-400'
  }

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newRes.title.length > 20) {
      notify("O título deve ter no máximo 20 caracteres", "error")
      return
    }

    if (parseInt(newRes.targetDate.split('-')[0]) < 2026) {
      notify("A data deve ser a partir de 2026", "error")
      return
    }

    setIsSaving(true)

    const token = localStorage.getItem("access_token")
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }

    try {
      if (editingId) {
        const currentRes = resolutions.find(r => r.id === editingId)
        const res = await fetch(`${config.API_URL}/resolutions/${editingId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ 
            title: newRes.title, 
            description: newRes.description, 
            targetDate: newRes.targetDate,
            status: currentRes?.status 
          })
        })
        
        if (!res.ok) throw new Error("Failed to update")
        
        const updated = await res.json()
        setResolutions(resolutions.map(r => r.id === editingId ? { ...updated, targetDate: updated.target_date } : r))
        notify("Resolução atualizada com sucesso!", "success")
      } else {
        const res = await fetch(`${config.API_URL}/resolutions`, {
          method: "POST",
          headers,
          body: JSON.stringify({ 
            title: newRes.title, 
            description: newRes.description, 
            targetDate: newRes.targetDate, 
            status: 'pending' 
          })
        })

        if (!res.ok) throw new Error("Failed to create")

        const created = await res.json()
        setResolutions([...resolutions, { ...created, targetDate: created.target_date }])
        notify("Resolução criada com sucesso!", "success")
      }
      setNewRes({ title: '', description: '', targetDate: '' })
      setEditingId(null)
      setIsModalOpen(false)
    } catch (error) {
      notify("Erro ao salvar resolução", "error")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteResolution = async () => {
    if (deletingId) {
      setIsDeleting(true)
      try {
        const token = localStorage.getItem("access_token")
        const res = await fetch(`${config.API_URL}/resolutions/${deletingId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        if (!res.ok) throw new Error("Failed to delete")
        
        setResolutions(resolutions.filter(r => r.id !== deletingId))
        notify("Resolução removida com sucesso!", "success")
        setIsDeleteModalOpen(false)
        setDeletingId(null)
      } catch (error) {
        notify("Erro ao remover resolução", "error")
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const toggleStatus = async (id: number) => {
    const resolution = resolutions.find(r => r.id === id)
    if (!resolution) return
    const newStatus = resolution.status === 'pending' ? 'completed' : 'pending'

    setTogglingId(id)
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`${config.API_URL}/resolutions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ ...resolution, status: newStatus, targetDate: resolution.targetDate })
      })
      if (!res.ok) throw new Error("Failed to update status")
      
      const updated = await res.json()
      setResolutions(resolutions.map(r => r.id === id ? { ...updated, targetDate: updated.target_date } : r))
      notify("Status alterado com sucesso!", "success")
    } catch (error) {
      notify("Erro ao alterar status", "error")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/")}
              className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Resoluções</h1>
          </div>
          <button
            onClick={() => {
              setNewRes({ title: '', description: '', targetDate: '' })
              setEditingId(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="cursor-pointer hidden md:inline">Nova Resolução</span>
          </button>
        </header>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : resolutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <div className="bg-slate-800/50 p-4 rounded-full mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Nenhuma resolução encontrada</h3>
            <p className="text-slate-400 max-w-sm">
              Clique no botão acima para criar sua primeira resolução e começar a acompanhar suas metas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resolutions.map((res) => (
            <div 
              key={res.id} 
              className={`bg-slate-900/50 border ${res.status === 'completed' ? 'border-green-900/50 opacity-75' : 'border-slate-800'} p-6 rounded-xl hover:border-blue-500/30 transition-all duration-300 flex flex-col`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className={`text-xl font-semibold ${res.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {res.title}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewRes({ title: res.title, description: res.description, targetDate: res.targetDate })
                      setEditingId(res.id)
                      setIsModalOpen(true)
                    }}
                    className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setDeletingId(res.id)
                      setIsDeleteModalOpen(true)
                    }}
                    className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Excluir"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <p className="text-slate-400 mb-6 flex-grow line-clamp-3">
                {res.description}
              </p>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-2 text-sm">
                  <svg className={`w-4 h-4 ${getDateColorClass(res.targetDate, res.status)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={getDateColorClass(res.targetDate, res.status)}>
                    Meta: {new Date(res.targetDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                  </span>
                </div>
                <button
                  onClick={() => toggleStatus(res.id)}
                  disabled={togglingId === res.id}
                  className={`p-2 rounded-full transition-colors ${
                    res.status === 'completed' 
                      ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                      : 'bg-slate-800 text-slate-400 hover:bg-blue-500/20 hover:text-blue-400'
                  } ${togglingId === res.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={res.status === 'completed' ? "Reabrir" : "Concluir"}
                >
                  {togglingId === res.id ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-white mb-6">{editingId ? 'Editar Resolução' : 'Nova Resolução'}</h2>
              <form onSubmit={handleSaveResolution} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={newRes.title}
                    onChange={e => setNewRes({...newRes, title: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder="Ex: Aprender Guitarra"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                  <textarea
                    required
                    value={newRes.description}
                    onChange={e => setNewRes({...newRes, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors h-32 resize-none"
                    placeholder="Detalhes sobre sua meta..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Data Alvo</label>
                  <input
                    type="date"
                    required
                    min="2026-01-01"
                    value={newRes.targetDate}
                    onChange={e => setNewRes({...newRes, targetDate: e.target.value})}
                    className="cursor-pointer w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="cursor-pointer flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`cursor-pointer flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium flex justify-center items-center ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      "Salvar"
                    )}
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
              <p className="text-slate-400 mb-8">Tem certeza que deseja excluir esta resolução? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="cursor-pointer flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteResolution}
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
      </div>
    </div>
  )
}