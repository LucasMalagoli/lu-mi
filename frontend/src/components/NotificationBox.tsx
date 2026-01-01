import { useEffect, useState } from "react"
import { useNotify, type Notification } from "../context/NotificationContext"

function NotificationItem({
  notification,
  remove,
}: {
  notification: Notification
  remove: (id: number) => void
}) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const [isPaused, setIsPaused] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isPaused || isExiting) return

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - 100 / (3000 / 10)
        if (next <= 0) {
          setIsExiting(true)
          return 0
        }
        return next
      })
    }, 10)

    return () => clearTimeout(timer)
  }, [isPaused, isExiting])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        remove(notification.id)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isExiting, notification.id, remove])

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative overflow-hidden rounded p-3 text-sm shadow border flex justify-between items-start transition-all duration-300 transform pointer-events-auto ${
        !isMounted
          ? "translate-x-full opacity-0"
          : isExiting
          ? "translate-x-full opacity-0"
          : "translate-x-0 opacity-100"
      } ${
        notification.type === "error"
          ? "bg-red-900 border-red-700 text-red-200"
          : notification.type === "success"
          ? "bg-green-900 border-green-700 text-green-200"
          : "bg-gray-800 border-gray-700 text-gray-200"
      }`}
    >
      <span>{notification.message}</span>
      <button
        onClick={() => remove(notification.id)}
        className="ml-3 text-xs opacity-70 hover:opacity-100"
      >
        ✕
      </button>
      <div
        style={{ width: `${progress}%` }}
        className="absolute bottom-0 left-0 h-1 bg-white opacity-30"
      />
    </div>
  )
}

export default function NotificationBox() {
  const { notifications, remove } = useNotify()

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-50 space-y-2 md:left-auto md:right-4 md:w-96 pointer-events-none">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} remove={remove} />
      ))}
    </div>
  )
}
