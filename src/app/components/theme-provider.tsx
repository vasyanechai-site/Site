import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Всегда светлая тема — игнорируем localStorage
  const [theme] = useState<Theme>("light")

  useEffect(() => {
    const root = window.document.documentElement
    // Сбрасываем сохранённую тему из localStorage (для всех пользователей)
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem('nechai-ui-theme')
      localStorage.removeItem('vite-ui-theme')
    } catch (e) {}
    root.classList.remove("dark", "system")
    root.classList.add("light")
  }, [])

  const value = {
    theme,
    // setTheme — принудительно всегда light, тёмная тема отключена
    setTheme: (_theme: Theme) => {
      // no-op: тёмная тема отключена
    },
  }

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}