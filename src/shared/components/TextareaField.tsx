import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  labelClassName?: string
}

/** Native textarea — @fluid/input-message is a chat composer, not a paste field. */
export function TextareaField({
  id,
  label,
  labelClassName,
  className,
  ...props
}: TextareaFieldProps) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className={cn('text-label', labelClassName)}>
        {label}
      </label>
      <textarea id={id} className={className} {...props} />
    </div>
  )
}
