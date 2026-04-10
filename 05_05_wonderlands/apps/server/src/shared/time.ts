export interface Clock {
  now: () => Date
  nowIso: () => string
}

export const formatDateTimeInTimeZone = (value: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(value)

  const lookup = Object.fromEntries(
    parts
      .filter(
        (part): part is Intl.DateTimeFormatPart & {
          type: 'day' | 'hour' | 'minute' | 'month' | 'year'
        } =>
          part.type === 'day' ||
          part.type === 'hour' ||
          part.type === 'minute' ||
          part.type === 'month' ||
          part.type === 'year',
      )
      .map((part) => [part.type, part.value]),
  )

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}`
}

export const createSystemClock = (): Clock => ({
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
})
