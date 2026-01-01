import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useNotify } from '../context/NotificationContext'
import { config } from '../config'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { notify } = useNotify()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch(`${config.API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password }),
      })

      if (!res.ok) {
        throw new Error("Login failed")
      }

      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      localStorage.setItem("username", data.username)
      notify("Login successful", "success")
      navigate("/")
    } catch (error) {
      notify("Login failed. Please check your credentials.", "error")
    }
  }


  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded bg-red-600 hover:bg-red-700 transition font-semibold text-white"
          >
            Sign in
          </button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Don’t have an account?{' '}
          <Link to="/register" className="text-red-500 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
