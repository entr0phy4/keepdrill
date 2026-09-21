import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface NativeSelectOption {
  value: string
  label: string
}

export interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: readonly NativeSelectOption[]
}

/**
 * Native `<select>` styled with Fluid tokens.
 * @fluid/select is a popup combobox and would break D-14 plus CorpusInput tests.
 */
export function NativeSelect({ id, label, options, className, ...props }: NativeSelectProps) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      <select id={id} className={cn('control', className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
