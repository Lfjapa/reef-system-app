import { useCallback, useEffect, useRef, useState } from 'react'
import { logError } from '../lib/log'

type CloudWriteTask = { label: string; run: () => Promise<void> }

type Options = {
  enabled: boolean
  userId: string | null
  formatError: (error: unknown) => string
  onError: (detail: string) => void
  onOnline: () => void
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, ms)))

export const useCloudWriteQueue = ({ enabled, userId, formatError, onError, onOnline }: Options) => {
  const [pendingWrites, setPendingWrites] = useState<number>(0)
  const queueRef = useRef<CloudWriteTask[]>([])
  const runningRef = useRef<boolean>(false)

  const clear = useCallback(() => {
    queueRef.current = []
    setPendingWrites(0)
  }, [])

  useEffect(() => {
    clear()
  }, [clear, userId])

  const process = useCallback(async () => {
    if (!enabled || !userId) return
    if (runningRef.current) return
    runningRef.current = true
    try {
      while (queueRef.current.length > 0) {
        const task = queueRef.current[0]
        const maxAttempts = 3
        let attempt = 0
        for (;;) {
          try {
            await task.run()
            break
          } catch (error) {
            attempt += 1
            if (attempt >= maxAttempts) {
              logError('cloud-write', error)
              onError(`Falha ao enviar: ${task.label}: ${formatError(error)}`)
              return
            }
            const baseDelayMs = 600 * 2 ** (attempt - 1)
            const jitterMs = Math.floor(Math.random() * 250)
            await sleep(baseDelayMs + jitterMs)
          }
        }
        queueRef.current.shift()
        setPendingWrites((current) => Math.max(0, current - 1))
      }
      onOnline()
    } finally {
      runningRef.current = false
    }
  }, [enabled, formatError, onError, onOnline, userId])

  const enqueue = useCallback(
    (label: string, run: () => Promise<void>) => {
      if (!enabled || !userId) return
      queueRef.current.push({ label, run })
      setPendingWrites((current) => current + 1)
      void process()
    },
    [enabled, process, userId],
  )

  const retry = useCallback(() => {
    void process()
  }, [process])

  return { pendingWrites, enqueue, retry, clear }
}
