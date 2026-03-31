'use client'

import { IMaskInput } from 'react-imask'

interface PhoneInputProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

export function PhoneInput({
  value,
  onChange,
  className,
}: PhoneInputProps) {
  return (
    <IMaskInput
      mask="+7 (000) 000-00-00"
      value={value}
      unmask={false}
      onAccept={(value) => onChange(String(value))}
      placeholder="+7 (___) ___-__-__"
      className={className}
    />
  )
}