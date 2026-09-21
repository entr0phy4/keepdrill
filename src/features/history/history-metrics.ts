// Re-export so HistoryView's `import { resolveMetrics } from './history-metrics'`
// path does not change. The schema-guard body lives in metrics/resolve-metrics
// so analytics never imports ui/ (ANLY-05).

export { resolveMetrics } from '@/metrics/resolve-metrics'
