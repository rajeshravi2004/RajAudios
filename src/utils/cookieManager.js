import Cookies from 'js-cookie'

const COOKIE_OPTIONS = {
  expires: 365,
  sameSite: 'strict',
  secure: window.location.protocol === 'https:'
}

export const cookieManager = {
  setPlaylists: (playlists) => {
    try {
      Cookies.set('rajify_playlists', JSON.stringify(playlists), COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving playlists to cookie:', error)
    }
  },

  getPlaylists: () => {
    try {
      const data = Cookies.get('rajify_playlists')
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error reading playlists from cookie:', error)
      return []
    }
  },

  setFavorites: (favorites) => {
    try {
      Cookies.set('rajify_favorites', JSON.stringify(favorites), COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving favorites to cookie:', error)
    }
  },

  getFavorites: () => {
    try {
      const data = Cookies.get('rajify_favorites')
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error reading favorites from cookie:', error)
      return []
    }
  },

  setCurrentPlaylist: (playlistId) => {
    try {
      Cookies.set('rajify_current_playlist', playlistId, COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving current playlist to cookie:', error)
    }
  },

  getCurrentPlaylist: () => {
    try {
      return Cookies.get('rajify_current_playlist') || null
    } catch (error) {
      console.error('Error reading current playlist from cookie:', error)
      return null
    }
  },

  setPlaybackSettings: (settings) => {
    try {
      Cookies.set('rajify_settings', JSON.stringify(settings), COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving settings to cookie:', error)
    }
  },

  getPlaybackSettings: () => {
    try {
      const data = Cookies.get('rajify_settings')
      return data ? JSON.parse(data) : { shuffle: false, repeat: 'off', volume: 1 }
    } catch (error) {
      console.error('Error reading settings from cookie:', error)
      return { shuffle: false, repeat: 'off', volume: 1 }
    }
  },

  setQueue: (queue) => {
    try {
      Cookies.set('rajify_queue', JSON.stringify(queue), COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving queue to cookie:', error)
    }
  },

  getQueue: () => {
    try {
      const data = Cookies.get('rajify_queue')
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error reading queue from cookie:', error)
      return []
    }
  },

  setRecentPlaylists: (playlists) => {
    try {
      Cookies.set('rajify_recent', JSON.stringify(playlists), COOKIE_OPTIONS)
    } catch (error) {
      console.error('Error saving recent playlists to cookie:', error)
    }
  },

  getRecentPlaylists: () => {
    try {
      const data = Cookies.get('rajify_recent')
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error reading recent playlists from cookie:', error)
      return []
    }
  },

  clearAll: () => {
    try {
      Cookies.remove('rajify_playlists')
      Cookies.remove('rajify_favorites')
      Cookies.remove('rajify_current_playlist')
      Cookies.remove('rajify_settings')
      Cookies.remove('rajify_queue')
      Cookies.remove('rajify_recent')
    } catch (error) {
      console.error('Error clearing cookies:', error)
    }
  }
}

