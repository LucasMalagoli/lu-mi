import { Outlet } from 'react-router-dom'
import NotificationBox from "../NotificationBox"

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Outlet />
      <NotificationBox />
    </div>
  )
}
