import { createClient } from '@supabase/supabase-js'

const getConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY,
  secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
})

const getToken = (request) => {
  const authorization = request.headers.authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
}

const publicUser = (user, adminEmail) => ({
  id: user.id,
  email: user.email,
  name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Listener',
  avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
  createdAt: user.created_at,
  lastSignInAt: user.last_sign_in_at,
  isOwner: user.email?.toLowerCase() === adminEmail,
})

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const config = getConfig()
  if (!config.url || !config.publishableKey || !config.secretKey || !config.adminEmail) {
    return response.status(503).json({ error: 'Admin service is not configured.' })
  }

  const token = getToken(request)
  if (!token) return response.status(401).json({ error: 'Authentication required.' })

  const authClient = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await authClient.auth.getUser(token)
  if (userError || !user) return response.status(401).json({ error: 'Your session is no longer valid.' })
  if (user.email?.toLowerCase() !== config.adminEmail) {
    return response.status(403).json({ error: 'Owner access is required.' })
  }

  const adminClient = createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (request.method === 'GET') {
    const page = Math.max(1, Number(request.query.page) || 1)
    const perPage = Math.min(100, Math.max(1, Number(request.query.perPage) || 50))
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) return response.status(500).json({ error: error.message })
    return response.status(200).json({
      users: data.users.map(item => publicUser(item, config.adminEmail)),
      total: data.total,
    })
  }

  if (request.method === 'DELETE') {
    const body = request.body || {}

    if (body.allExceptOwner === true) {
      let deleted = 0
      while (true) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 100 })
        if (error) return response.status(500).json({ error: error.message, deleted })
        const removable = data.users.filter(item => item.email?.toLowerCase() !== config.adminEmail)
        for (const removableUser of removable) {
          const { error: deleteError } = await adminClient.auth.admin.deleteUser(removableUser.id, false)
          if (deleteError) return response.status(500).json({ error: deleteError.message, deleted })
          deleted += 1
        }
        if (data.users.length < 100 || removable.length === 0) break
      }
      return response.status(200).json({ deleted })
    }

    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) return response.status(400).json({ error: 'A user ID is required.' })
    if (userId === user.id) return response.status(400).json({ error: 'The owner account cannot delete itself.' })

    const { data, error: lookupError } = await adminClient.auth.admin.getUserById(userId)
    if (lookupError || !data.user) return response.status(404).json({ error: 'User not found.' })
    if (data.user.email?.toLowerCase() === config.adminEmail) {
      return response.status(400).json({ error: 'The owner account is protected.' })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId, false)
    if (error) return response.status(500).json({ error: error.message })
    return response.status(200).json({ deleted: 1 })
  }

  response.setHeader('Allow', 'GET, DELETE')
  return response.status(405).json({ error: 'Method not allowed.' })
}
