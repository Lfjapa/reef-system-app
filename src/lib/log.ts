export const logError = (scope: string, error: unknown) => {
  if (!import.meta.env.DEV) return
  console.error(`[${scope}]`, error)
}

