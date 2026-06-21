const OFFLINE_ID_PREFIX = 'OFF'
const RANDOM_PART_LENGTH = 6

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

function randomDigits(length: number) {
  let result = ''
  while (result.length < length) {
    result += Math.floor(Math.random() * 10).toString()
  }
  return result.slice(0, length)
}

// Для пользователя (читаемый ID)
export function generateDisplayId(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const randomPart = randomDigits(RANDOM_PART_LENGTH)
  return `${OFFLINE_ID_PREFIX}-${yyyy}${mm}${dd}-${randomPart}`
}

// Для сервера (уникальный UUID)
export function generateClientGeneratedId(): string {
  return crypto.randomUUID()
}

// Основная функция для обратной совместимости
export function generateOfflineClientGeneratedId(date = new Date()): string {
  return generateDisplayId(date)
}

export function isOfflineClientGeneratedId(value: string | null | undefined): value is string {
  if (!value) return false
  return /^OFF-\d{8}-\d{6}$/.test(value) || /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
}