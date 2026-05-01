import { useEffect, type ReactNode } from "react"

type ThemeProviderProps = {
  children: ReactNode
  /** Оставлены для совместимости с App.tsx; всегда светлая тема */
  defaultTheme?: string
  storageKey?: string
}

/** Фиксирует светлую тему: класс на `<html>`, сброс ключей темы в localStorage */
export function ThemeProvider({
  children,
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  useEffect(() => {
    const root = window.document.documentElement
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem("nechai-ui-theme")
      localStorage.removeItem("vite-ui-theme")
    } catch {
      /* ignore */
    }
    root.classList.remove("dark", "system")
    root.classList.add("light")
    root.style.colorScheme = "light"
  }, [storageKey])

  return <>{children}</>
}
