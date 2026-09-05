import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../stores/authStore.jsx'
import { useToastContext } from '../../components/ui/Toast.jsx'
import { useDialog } from '../../components/ui/Dialog.jsx'

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Never'

export function AdminPage() {
  const { session, isAdmin } = useAuth()
  const { toast } = useToastContext()
  const { confirm: showConfirm } = useDialog()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState('')
  const [search, setSearch] = useState('')
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkConfirmation, setBulkConfirmation] = useState('')

  const request = useCallback(async (options = {}) => {
    const response = await fetch('/api/admin-users', {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
        ...options.headers,
      },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Admin request failed.')
    return data
  }, [session?.access_token])

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    try {
      const data = await request()
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, request, toast])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query))
  }, [search, users])

  const deleteUser = async (user) => {
    if (user.isOwner) return
    const confirmed = await showConfirm({
      title: 'Delete user account?',
      message: `${user.email} and all associated profile and preference data will be permanently removed.`,
      confirmLabel: 'Delete user',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyUserId(user.id)
    try {
      await request({ method: 'DELETE', body: JSON.stringify({ userId: user.id }) })
      setUsers(current => current.filter(item => item.id !== user.id))
      setTotal(current => Math.max(1, current - 1))
      toast(`${user.email} was removed.`, 'success')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusyUserId('')
    }
  }

  const deleteEveryoneElse = async () => {
    if (bulkConfirmation !== 'DELETE EVERYONE') return
    setBusyUserId('all')
    try {
      const data = await request({ method: 'DELETE', body: JSON.stringify({ allExceptOwner: true }) })
      setUsers(current => current.filter(user => user.isOwner))
      setTotal(1)
      setBulkConfirmation('')
      setShowBulkDelete(false)
      toast(`${data.deleted} user account${data.deleted === 1 ? '' : 's'} removed.`, 'success')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setBusyUserId('')
    }
  }

  if (!isAdmin) {
    return <div className="empty-state"><ShieldCheckIcon className="h-12 w-12" /><p>Owner access is required.</p></div>
  }

  return (
    <div className="page-scroll fade-in">
      <div className="admin-page">
        <header className="admin-hero">
          <div>
            <span className="eyebrow"><ShieldCheckIcon /> Protected owner workspace</span>
            <h1>User administration</h1>
            <p>Review accounts and remove users with their associated profile and preference data.</p>
          </div>
          <div className="admin-count"><UserGroupIcon /><strong>{total}</strong><span>Total users</span></div>
        </header>

        <section className="admin-table-card">
          <div className="admin-toolbar">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users by name or email" />
            <button className="secondary-button" onClick={loadUsers} disabled={loading}>
              <ArrowPathIcon className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Joined</th><th>Last sign in</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="admin-loading">Loading accounts...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="5" className="admin-loading">No matching users.</td></tr>
                ) : filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td><div className="admin-user-cell">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1).toUpperCase()}</span>}
                      <div><strong>{user.name}</strong><small>{user.email}</small></div>
                    </div></td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>{formatDate(user.lastSignInAt)}</td>
                    <td>{user.isOwner ? <span className="owner-badge"><ShieldCheckIcon /> Owner</span> : <span className="member-badge">Member</span>}</td>
                    <td className="admin-actions">
                      <button onClick={() => deleteUser(user)} disabled={user.isOwner || busyUserId === user.id} title={user.isOwner ? 'Owner account is protected' : 'Delete user'}>
                        {busyUserId === user.id ? <ArrowPathIcon className="spin" /> : <TrashIcon />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-danger-zone">
          <div className="admin-danger-copy">
            <ExclamationTriangleIcon />
            <div><h2>Remove all other users</h2><p>Permanently deletes every account except the protected owner account. Related profile and preference records are removed automatically.</p></div>
          </div>
          {!showBulkDelete ? (
            <button className="danger-button" onClick={() => setShowBulkDelete(true)}>Review action</button>
          ) : (
            <div className="bulk-confirm">
              <label htmlFor="bulk-confirm">Type <strong>DELETE EVERYONE</strong> to continue</label>
              <div><input id="bulk-confirm" value={bulkConfirmation} onChange={event => setBulkConfirmation(event.target.value)} /><button className="danger-button" disabled={bulkConfirmation !== 'DELETE EVERYONE' || busyUserId === 'all'} onClick={deleteEveryoneElse}>{busyUserId === 'all' ? 'Deleting...' : 'Delete everyone else'}</button></div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
