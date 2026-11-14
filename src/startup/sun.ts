/** Sun position over central Helsinki, from the NOAA solar position approximation. */
const LAT = 60.1699
const LON = 24.9384
const rad = Math.PI / 180

export function sunPosition(date: Date) {
  const day = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const g = (2 * Math.PI / 365) * (day - 1 + (hours - 12) / 24)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const solarMinutes = hours * 60 + eqTime + 4 * LON
  const hourAngle = (solarMinutes / 4 - 180) * rad
  const lat = LAT * rad
  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)))
  const elevation = 90 - zenith / rad
  // Azimuth measured clockwise from north.
  let azimuth = Math.acos(Math.max(-1, Math.min(1, (Math.sin(lat) * Math.cos(zenith) - Math.sin(decl)) / (Math.cos(lat) * Math.sin(zenith))))) / rad
  azimuth = hourAngle > 0 ? (azimuth + 180) % 360 : (540 - azimuth) % 360
  const e = elevation * rad, a = azimuth * rad
  // Map space: x east, y up, z south.
  return { elevation, azimuth, x: Math.cos(e) * Math.sin(a), y: Math.sin(e), z: -Math.cos(e) * Math.cos(a) }
}

const HELSINKI = 'Europe/Helsinki'

/** Minutes past midnight in Helsinki for a given instant. */
export function helsinkiMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: HELSINKI, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

/** The instant at a given Helsinki clock time on the Helsinki calendar day of `base`. */
export function atHelsinkiTime(base: Date, minutes: number) {
  const offset = helsinkiMinutes(base) - (base.getUTCHours() * 60 + base.getUTCMinutes())
  const utcMinutes = minutes - ((offset + 1440 * 2) % 1440 > 720 ? ((offset + 1440 * 2) % 1440) - 1440 : (offset + 1440 * 2) % 1440)
  const day = new Date(base)
  day.setUTCHours(0, 0, 0, 0)
  return new Date(day.getTime() + utcMinutes * 60_000)
}

export const formatClock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export type Phase = 'morning' | 'afternoon' | 'evening' | 'night'
export function phaseOf(minutes: number, elevation: number): Phase {
  if (elevation < -8) return 'night'
  const m = ((minutes % 1440) + 1440) % 1440
  if (m < 11 * 60) return 'morning'
  if (elevation > 0 && m < 17 * 60) return 'afternoon'
  return m < 23 * 60 ? 'evening' : 'night'
}
