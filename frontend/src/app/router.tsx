import { createBrowserRouter } from 'react-router-dom'
import Home from '../pages/Home'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Resolucoes from '../pages/Resolucoes'
// import Projects from '../pages/Projects'
import PlanejamentoFinanceiro from '../pages/PlanejamentoFinanceiro'
import Settings from '../pages/Settings'
import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from '../routes/ProtectedRoute'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },

      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/resolucoes', element: <Resolucoes /> },
          // { path: '/projects', element: <Projects /> },
          { path: '/financeiro', element: <PlanejamentoFinanceiro /> },
          { path: '/configuracoes', element: <Settings /> },
        ],
      },
    ],
  },
])
