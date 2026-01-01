import { createContext, useContext, useState, type ReactNode } from "react"


export type Notification = {
  id: number
  message: string
  type?: "info" | "success" | "error"
}

type NotificationContextType = {
  notify: (message: string, type?: Notification["type"]) => void
  notifications: Notification[]
  remove: (id: number) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const notify = (message: string, type: Notification["type"] = "info") => {
    const id = Date.now()
    setNotifications((prev) => {
      if (prev.length >= 3) {
        return [...prev.slice(1), { id, message, type }]
      }
      return [...prev, { id, message, type }]
    })
  }

  const remove = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <NotificationContext.Provider
      value={{ notify, notifications, remove }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotify() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error("useNotify must be used inside NotificationProvider")
  }
  return ctx
}
