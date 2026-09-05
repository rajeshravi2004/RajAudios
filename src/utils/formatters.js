/**
 * formatters.js — Utility functions for formatting display values
 */

/**
 * Decode HTML entities from YouTube titles (e.g. &amp; -> &, &#39; -> ')
 */
export const decodeHtml = (html) => {
  if (!html) return ''
  if (typeof document === 'undefined') return html.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  const txt = document.createElement('textarea')
  txt.innerHTML = html
  return txt.value
}

/**
 * Format seconds to M:SS or H:MM:SS
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Parse ISO 8601 duration (PT4M13S) to seconds
 */
export const parseISO8601Duration = (iso) => {
  if (!iso) return 0
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] || '0', 10)
  const m = parseInt(match[2] || '0', 10)
  const s = parseInt(match[3] || '0', 10)
  return h * 3600 + m * 60 + s
}

/**
 * Format large numbers: 1234567 → "1.2M"
 */
export const formatCount = (count) => {
  if (!count) return '0'
  const n = parseInt(count, 10)
  if (isNaN(n)) return '0'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

/**
 * Relative time: "2 hours ago", "3 days ago"
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = Date.now()
  const diff = now - date.getTime()
  
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  if (months < 12) return `${months}mo ago`
  return `${years}y ago`
}

/**
 * Truncate text to n characters with ellipsis
 */
export const truncate = (text, maxLen = 50) => {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
}

/**
 * Shuffle an array (Fisher-Yates)
 */
export const shuffleArray = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Debounce a function
 */
export const debounce = (fn, delay = 300) => {
  let timeout
  const debounced = (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
  debounced.cancel = () => clearTimeout(timeout)
  return debounced
}

/**
 * Get best thumbnail URL from YouTube snippet thumbnails
 */
export const getBestThumbnail = (thumbnails, prefer = 'medium') => {
  if (!thumbnails) return ''
  const order = [prefer, 'high', 'maxres', 'medium', 'standard', 'default']
  for (const key of order) {
    if (thumbnails[key]?.url) return thumbnails[key].url
  }
  return ''
}
