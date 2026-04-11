import { useMemo } from 'react'
import type { BioEntry, BioType } from '../types'

type BioDeepDivePreview = {
  reefCompatible: string | null
  lighting: string | null
  flow: string | null
  tempMinC?: number | null
  tempMaxC?: number | null
  sgMin?: number | null
  sgMax?: number | null
  phMin?: number | null
  phMax?: number | null
  dkhMin?: number | null
  dkhMax?: number | null
}

export type AnimalRiskViolation = {
  parameter: string
  label: string
  currentValue: number
  requiredMin: number | null
  requiredMax: number | null
  severity: 'warning' | 'critical'
}

export type AnimalRiskItem = {
  entryId: string
  name: string
  scientificName: string
  type: BioType
  violations: AnimalRiskViolation[]
}

const PARAMETER_MAP: Array<{
  paramKey: string
  label: string
  minField: keyof BioDeepDivePreview
  maxField: keyof BioDeepDivePreview
}> = [
  { paramKey: 'temperatura', label: 'Temperatura', minField: 'tempMinC', maxField: 'tempMaxC' },
  { paramKey: 'salinidade', label: 'Salinidade', minField: 'sgMin', maxField: 'sgMax' },
  { paramKey: 'ph', label: 'pH', minField: 'phMin', maxField: 'phMax' },
  { paramKey: 'kh', label: 'KH', minField: 'dkhMin', maxField: 'dkhMax' },
]

export const useAnimalsAtRisk = (
  bioEntries: BioEntry[],
  bioDeepDivePreviewById: Map<string, BioDeepDivePreview>,
  latestValues: Map<string, number>,
): AnimalRiskItem[] => {
  return useMemo(() => {
    const result: AnimalRiskItem[] = []

    for (const entry of bioEntries) {
      const preview = bioDeepDivePreviewById.get(entry.id)
      if (!preview) continue

      const violations: AnimalRiskViolation[] = []

      for (const { paramKey, label, minField, maxField } of PARAMETER_MAP) {
        const currentValue = latestValues.get(paramKey)
        if (currentValue === undefined) continue

        const reqMin = (preview[minField] as number | null | undefined) ?? null
        const reqMax = (preview[maxField] as number | null | undefined) ?? null

        if (reqMin === null && reqMax === null) continue

        let isViolation = false
        if (reqMin !== null && currentValue < reqMin) isViolation = true
        if (reqMax !== null && currentValue > reqMax) isViolation = true

        if (!isViolation) continue

        const deviation =
          reqMin !== null && currentValue < reqMin
            ? (reqMin - currentValue) / reqMin
            : reqMax !== null && currentValue > reqMax
              ? (currentValue - reqMax) / reqMax
              : 0

        violations.push({
          parameter: paramKey,
          label,
          currentValue,
          requiredMin: reqMin,
          requiredMax: reqMax,
          severity: deviation > 0.1 ? 'critical' : 'warning',
        })
      }

      if (violations.length > 0) {
        result.push({
          entryId: entry.id,
          name: entry.name,
          scientificName: entry.scientificName,
          type: entry.type,
          violations,
        })
      }
    }

    return result.sort((a, b) => {
      const aCritical = a.violations.filter((v) => v.severity === 'critical').length
      const bCritical = b.violations.filter((v) => v.severity === 'critical').length
      if (bCritical !== aCritical) return bCritical - aCritical
      return b.violations.length - a.violations.length
    })
  }, [bioEntries, bioDeepDivePreviewById, latestValues])
}
