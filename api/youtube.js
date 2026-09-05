const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const ALLOWED_ENDPOINTS = new Set([
  'search',
  'videos',
  'playlistItems',
  'playlists',
  'channels',
])
const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'dailyLimitExceeded',
  'rateLimitExceeded',
  'userRateLimitExceeded',
])

const getApiKeys = () => (process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || '')
  .split(',')
  .map(key => key.trim().replace(/^["']|["']$/g, ''))
  .filter(Boolean)

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only GET requests are supported.' })
  }

  const { endpoint, ...params } = request.query
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return response.status(400).json({ error: 'BAD_REQUEST', message: 'Unsupported YouTube endpoint.' })
  }

  const apiKeys = getApiKeys()
  if (apiKeys.length === 0) {
    return response.status(500).json({ error: 'NO_API_KEY', message: 'YouTube API key is not configured.' })
  }

  let lastError = null
  for (const apiKey of apiKeys) {
    const url = new URL(`${YOUTUBE_BASE_URL}/${endpoint}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }

    try {
      const upstream = await fetch(url, {
        headers: { 'x-goog-api-key': apiKey },
      })
      const data = await upstream.json()

      if (upstream.ok) {
        response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
        return response.status(200).json(data)
      }

      const reason = data?.error?.errors?.[0]?.reason
      lastError = { status: upstream.status, data }
      if (upstream.status === 403 && QUOTA_REASONS.has(reason)) continue

      return response.status(upstream.status).json({
        error: 'API_ERROR',
        message: data?.error?.message || `YouTube API returned HTTP ${upstream.status}.`,
      })
    } catch (error) {
      lastError = { status: 502, data: { message: error.message } }
    }
  }

  const quotaExceeded = lastError?.status === 403
  return response.status(quotaExceeded ? 429 : 502).json({
    error: quotaExceeded ? 'QUOTA_EXCEEDED' : 'NETWORK_ERROR',
    message: quotaExceeded
      ? 'All configured YouTube API keys have reached their quota limits.'
      : (lastError?.data?.message || 'Could not reach the YouTube API.'),
  })
}
