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

export function generateOfflineClientGeneratedId(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const randomPart = randomDigits(RANDOM_PART_LENGTH)

  return `${OFFLINE_ID_PREFIX}-${yyyy}${mm}${dd}-${randomPart}`
}

export function isOfflineClientGeneratedId(value: string | null | undefined): value is string {
  if (!value) return false

  return /^OFF-\d{8}-\d{6}$/.test(value)
}

