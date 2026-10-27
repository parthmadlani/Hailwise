// Small formatting helpers shared by every page.
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // index = Spark day_of_week - 1
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']

export const int = (n) => Math.round(n).toLocaleString('en-US')
export const money = (n, digits = 2) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const millions = (n, digits = 1) => (n / 1e6).toFixed(digits) + 'M'
export const thousands = (n) => Math.round(n / 1000).toLocaleString('en-US') + 'k'
export const pct = (n, digits = 1) => n.toFixed(digits) + '%'
export const hourName = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`
export const monthLabel = (m) => `${MONTHS[m.month - 1]} ${m.year}`

export function bigMoney(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M'
  return money(n, 0)
}
