import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Exercise } from '@/ingestion/types'
import type { FilePlan, PlanUnit } from '@/parse/types'
import type { Session } from '@/capture/types'
import { assembleSessionFromLogs, buildSession } from '@/session'
import { getCharLog, getEvents, getMarkers, resetCapture } from '@/capture/capture'
import { computeSessionMetrics, type MetricsResult } from '@/metrics/metrics'
import { probeTimerResolutionUs, readCrossOriginIsolated } from '@/platform/isolation'
import { saveSession } from '@/persistence/repository'
import { flattenSnapshots, type UnitSnapshot } from '@/scaffold/flatten'
import { joinUnitSlices } from '@/scaffold/slice'

declare global {
  interface Window {
    __keebdrillSession?: Session
  }
}

const SESSION_REFRESH_MS = 250

export interface TrainerSession {
  exercise: Exercise | null
  filePlan: FilePlan | null
  curriculum: PlanUnit[] | null
  unitIndex: number
  loadToken: number
  scaffoldComplete: boolean
  metrics: MetricsResult | null
  saveFailed: boolean
  crossOriginIsolated: boolean
  timingResolutionUs: number
  handleLoad: (loaded: Exercise) => void
  startScaffold: (plan: FilePlan) => void
  handleComplete: (completedAt: number) => void
  handleRestart: () => void
  dismissSaveFailed: () => void
}

export function useTrainerSession(): TrainerSession {
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [filePlan, setFilePlan] = useState<FilePlan | null>(null)
  const [curriculum, setCurriculum] = useState<PlanUnit[] | null>(null)
  const [unitIndex, setUnitIndex] = useState(0)
  const [scaffoldComplete, setScaffoldComplete] = useState(false)
  const snapshotsRef = useRef<UnitSnapshot[]>([])
  const curriculumRef = useRef(curriculum)
  const unitIndexRef = useRef(unitIndex)
  const scaffoldCompleteRef = useRef(scaffoldComplete)
  curriculumRef.current = curriculum
  unitIndexRef.current = unitIndex
  scaffoldCompleteRef.current = scaffoldComplete
  const [loadToken, setLoadToken] = useState(0)

  const crossOriginIsolated = useMemo(() => readCrossOriginIsolated(), [])
  const [timingResolutionUs, setTimingResolutionUs] = useState(() => probeTimerResolutionUs())

  const sessionRef = useRef<Session | null>(null)
  const loadRef = useRef<{ exercise: Exercise; startedAt: number } | null>(null)
  const [metrics, setMetrics] = useState<MetricsResult | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const handleLoad = useCallback((loaded: Exercise) => {
    snapshotsRef.current = []
    setCurriculum(null)
    setUnitIndex(0)
    setFilePlan(null)
    setScaffoldComplete(false)
    resetCapture()
    setExercise(loaded)
    setLoadToken((token) => token + 1)
    setMetrics(null)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: loaded, startedAt }
    const session = buildSession(loaded, startedAt)
    sessionRef.current = session
    setTimingResolutionUs(session.timingResolutionUs)
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }, [])

  const startScaffold = useCallback((plan: FilePlan) => {
    snapshotsRef.current = []
    resetCapture()
    setFilePlan(plan)
    setExercise(plan.exercise)
    setCurriculum(plan.units)
    setUnitIndex(0)
    setScaffoldComplete(false)
    setLoadToken((token) => token + 1)
    setMetrics(null)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: plan.exercise, startedAt }
    sessionRef.current = null
  }, [])

  const handleComplete = useCallback((completedAt: number) => {
    const units = curriculumRef.current
    if (units !== null) {
      if (scaffoldCompleteRef.current) return
      snapshotsRef.current.push({
        events: getEvents(),
        charLog: getCharLog(),
        markers: getMarkers(),
      })
      resetCapture()
      const idx = unitIndexRef.current
      if (idx < units.length - 1) {
        setUnitIndex(idx + 1)
        setLoadToken((token) => token + 1)
        return
      }
      const current = loadRef.current
      if (!current) return
      const logs = flattenSnapshots(snapshotsRef.current)
      const session = assembleSessionFromLogs(current.exercise, logs, current.startedAt)
      const typedTarget = joinUnitSlices(current.exercise.text, units)
      const result = computeSessionMetrics(typedTarget, session.charLog, session.markers, completedAt)
      setMetrics(result)
      setSaveFailed(false)
      setScaffoldComplete(true)
      scaffoldCompleteRef.current = true
      void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
        console.warn('[keebdrill] session not persisted:', err)
        setSaveFailed(true)
      })
      return
    }

    const current = loadRef.current
    if (!current) return
    const session = buildSession(current.exercise, current.startedAt)
    const result = computeSessionMetrics(current.exercise.text, session.charLog, session.markers, completedAt)
    setMetrics(result)
    setSaveFailed(false)
    void saveSession({ session, completedAt, metricsSnapshot: result }).catch((err: unknown) => {
      console.warn('[keebdrill] session not persisted:', err)
      setSaveFailed(true)
    })
  }, [])

  const handleRestart = useCallback(() => {
    const current = loadRef.current
    if (!current) return
    if (curriculumRef.current !== null) {
      if (scaffoldCompleteRef.current) return
      resetCapture()
      setLoadToken((token) => token + 1)
      setSaveFailed(false)
      return
    }
    resetCapture()
    setLoadToken((token) => token + 1)
    setMetrics(null)
    setSaveFailed(false)
    const startedAt = Date.now()
    loadRef.current = { exercise: current.exercise, startedAt }
    const session = buildSession(current.exercise, startedAt)
    sessionRef.current = session
    setTimingResolutionUs(session.timingResolutionUs)
    if (import.meta.env.DEV) {
      window.__keebdrillSession = session
    }
  }, [])

  const dismissSaveFailed = useCallback(() => {
    setSaveFailed(false)
  }, [])

  useEffect(() => {
    if (exercise === null || curriculum !== null) return
    const id = setInterval(() => {
      const current = loadRef.current
      if (!current) return
      const session = buildSession(current.exercise, current.startedAt)
      sessionRef.current = session
      setTimingResolutionUs(session.timingResolutionUs)
      if (import.meta.env.DEV) {
        window.__keebdrillSession = session
      }
    }, SESSION_REFRESH_MS)
    return () => clearInterval(id)
  }, [exercise, curriculum])

  return {
    exercise,
    filePlan,
    curriculum,
    unitIndex,
    loadToken,
    scaffoldComplete,
    metrics,
    saveFailed,
    crossOriginIsolated,
    timingResolutionUs,
    handleLoad,
    startScaffold,
    handleComplete,
    handleRestart,
    dismissSaveFailed,
  }
}
