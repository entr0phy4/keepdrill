import { useSyncExternalStore } from 'react'
import { getCharLog } from '@/capture/capture'

function subscribeCharLogTick(onChange: () => void): () => void {
  let raf = requestAnimationFrame(function tick() {
    onChange()
    raf = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(raf)
}

function getCharLogTickSnapshot(): number {
  return getCharLog().length
}

export function useCharLogTick(): number {
  return useSyncExternalStore(subscribeCharLogTick, getCharLogTickSnapshot, getCharLogTickSnapshot)
}
