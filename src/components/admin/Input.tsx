import { forwardRef } from 'react'

export const inputCls =
  'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 ' +
  'focus:border-transparent transition'

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${inputCls} ${className}`} {...props} />
  }
)
