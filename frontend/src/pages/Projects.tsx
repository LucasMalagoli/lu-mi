import { useNavigate } from "react-router-dom"

export default function Projects() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-blue-500 mb-4">Projects</h1>
      <p className="text-slate-400 text-center max-w-md">
        Manage your ongoing tasks and track project progress here.
      </p>
      <button
        onClick={() => navigate("/")}
        className="mt-8 px-6 py-2 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all duration-300"
      >
        Back to Home
      </button>
    </div>
  )
}