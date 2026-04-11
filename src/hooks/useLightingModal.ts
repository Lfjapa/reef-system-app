import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '../lib/supabase'
import { upsertCloudLightingPhase } from '../lib/cloudStore'
import { timeToMinutes } from '../lib/formatters'
import type { LightingPhase } from '../types'

const parseNumberWithFallback = (raw: string, fallback: number) => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

type Props = {
  lightingPhases: LightingPhase[]
  setLightingPhases: Dispatch<SetStateAction<LightingPhase[]>>
  authUser: User | null
  enqueueCloudWrite: (label: string, fn: () => Promise<void>) => void
}

export function useLightingModal({ lightingPhases, setLightingPhases, authUser, enqueueCloudWrite }: Props) {
  const [isLightingModalOpen, setIsLightingModalOpen] = useState<boolean>(false)
  const [lightingEditingId, setLightingEditingId] = useState<string | null>(null)
  const [lightingEditName, setLightingEditName] = useState<string>('')
  const [lightingEditTime, setLightingEditTime] = useState<string>('08:30')
  const [lightingEditUv, setLightingEditUv] = useState<string>('0')
  const [lightingEditWhite, setLightingEditWhite] = useState<string>('0')
  const [lightingEditBlue, setLightingEditBlue] = useState<string>('0')

  const openEditLightingModal = (phase: LightingPhase) => {
    setLightingEditingId(phase.id)
    setLightingEditName(phase.name)
    setLightingEditTime(phase.time)
    setLightingEditUv(String(phase.uv))
    setLightingEditWhite(String(phase.white))
    setLightingEditBlue(String(phase.blue))
    setIsLightingModalOpen(true)
  }

  const closeLightingModal = () => {
    setIsLightingModalOpen(false)
    setLightingEditingId(null)
  }

  const handleSaveLightingPhase = async () => {
    if (!lightingEditingId) return
    const next: LightingPhase[] = lightingPhases
      .map((item) =>
        item.id === lightingEditingId
          ? {
              ...item,
              name: lightingEditName.trim() || item.name,
              time: lightingEditTime,
              uv: parseNumberWithFallback(lightingEditUv, item.uv),
              white: parseNumberWithFallback(lightingEditWhite, item.white),
              blue: parseNumberWithFallback(lightingEditBlue, item.blue),
            }
          : item,
      )
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))

    setLightingPhases(next)
    setIsLightingModalOpen(false)
    if (isSupabaseEnabled && authUser) {
      const saved = next.find((item) => item.id === lightingEditingId)
      if (!saved) return
      enqueueCloudWrite('Fase de iluminação', async () => {
        await upsertCloudLightingPhase(saved, authUser.id)
      })
    }
  }

  return {
    isLightingModalOpen,
    lightingEditName, setLightingEditName,
    lightingEditTime, setLightingEditTime,
    lightingEditUv, setLightingEditUv,
    lightingEditWhite, setLightingEditWhite,
    lightingEditBlue, setLightingEditBlue,
    openEditLightingModal,
    closeLightingModal,
    handleSaveLightingPhase,
  }
}
