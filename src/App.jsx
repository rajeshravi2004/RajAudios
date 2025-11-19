import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { 
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  ArrowLeftIcon,
  HeartIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  QueueListIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon
} from '@heroicons/react/24/solid'
import { cookieManager } from './utils/cookieManager'

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const shuffleArray = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [playlists, setPlaylists] = useState([])
  const [currentTracks, setCurrentTracks] = useState([])
  const [originalTracks, setOriginalTracks] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [language, setLanguage] = useState('tamil')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  
  const languages = [
    { value: 'tamil', label: 'Tamil' },
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'telugu', label: 'Telugu' },
    { value: 'malayalam', label: 'Malayalam' },
    { value: 'kannada', label: 'Kannada' },
    { value: 'bengali', label: 'Bengali' },
    { value: 'marathi', label: 'Marathi' },
    { value: 'gujarati', label: 'Gujarati' },
    { value: 'punjabi', label: 'Punjabi' },
    { value: 'urdu', label: 'Urdu' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'korean', label: 'Korean' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'italian', label: 'Italian' }
  ]
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const playerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState('home')
  const [cachedPlaylists, setCachedPlaylists] = useState(new Map())
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off')
  const [favorites, setFavorites] = useState(new Set())
  const [savedPlaylists, setSavedPlaylists] = useState([])
  const [recentPlaylists, setRecentPlaylists] = useState([])
  const [queue, setQueue] = useState([])
  const [showQueue, setShowQueue] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  const currentIndexRef = useRef(currentIndex)
  const currentTracksRef = useRef(currentTracks)
  const shuffledTracksRef = useRef([])
  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])
  
  useEffect(() => {
    currentTracksRef.current = currentTracks
  }, [currentTracks])

  useEffect(() => {
    const savedFavorites = cookieManager.getFavorites()
    setFavorites(new Set(savedFavorites))
    
    const savedPlaylistsData = cookieManager.getPlaylists()
    setSavedPlaylists(savedPlaylistsData)
    
    const recentData = cookieManager.getRecentPlaylists()
    setRecentPlaylists(recentData)
    
    const settings = cookieManager.getPlaybackSettings()
    setShuffle(settings.shuffle || false)
    setRepeat(settings.repeat || 'off')
    setVolume(settings.volume || 1)
    
    const savedQueue = cookieManager.getQueue()
    if (savedQueue.length > 0) {
      setQueue(savedQueue)
    }
  }, [])

  useEffect(() => {
    cookieManager.setPlaybackSettings({ shuffle, repeat, volume })
  }, [shuffle, repeat, volume])

  useEffect(() => {
    cookieManager.setFavorites(Array.from(favorites))
  }, [favorites])

  useEffect(() => {
    cookieManager.setQueue(queue)
  }, [queue])

  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initializePlayer()
        return
      }

      if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        return
      }

      const tag = document.createElement('script')
      tag.src = "https://www.youtube.com/iframe_api"
      tag.async = true
      
      tag.onerror = () => {
        console.error('Failed to load YouTube iframe API')
      }

      const firstScriptTag = document.getElementsByTagName('script')[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      } else {
        document.head.appendChild(tag)
      }

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready')
        initializePlayer()
      }
    }

    const initializePlayer = () => {
      const playerElement = document.getElementById('player')
      if (!playerElement) {
        console.error('Player element not found, retrying...')
        setTimeout(initializePlayer, 100)
        return
      }

      if (playerRef.current) {
        console.log('Player already initialized')
        return
      }

      if (!window.YT || !window.YT.Player) {
        console.error('YouTube API not loaded yet')
        setTimeout(initializePlayer, 100)
        return
      }

      try {
        let origin = window.location.origin
        if (!origin || origin === 'null' || origin.includes('file://')) {
          origin = 'http://localhost'
        }
        
        console.log('Initializing YouTube Player with origin:', origin)
        
        playerRef.current = new window.YT.Player('player', {
          height: '1',
          width: '1',
          playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'enablejsapi': 1,
            'playsinline': 1,
            'origin': origin,
            'modestbranding': 1,
            'rel': 0,
            'fs': 0,
            'iv_load_policy': 3
          },
          events: {
            'onReady': (event) => {
              console.log('YouTube Player Ready')
              onPlayerReady(event)
            },
            'onStateChange': (event) => {
              onPlayerStateChange(event)
            },
            'onError': (event) => {
              console.error('YouTube Player Error:', event.data)
              if (event.data === 150 || event.data === 101) {
                console.warn('Video playback restricted, trying alternative method')
              }
            }
          }
        })
        console.log('YouTube Player initialized successfully')
      } catch (error) {
        console.error('Error initializing YouTube Player:', error)
        setTimeout(initializePlayer, 1000)
      }
    }

    loadYouTubeAPI()

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy()
        } catch (error) {
          console.error('Error destroying player:', error)
        }
        playerRef.current = null
      }
    }
  }, [])

  const onPlayerReady = (event) => {
    if (event.target) {
      event.target.setVolume(volume * 100)
    }
  }

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.ENDED) {
      handleTrackEnd()
    }
    setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
  }

  const handleTrackEnd = () => {
    if (repeat === 'one') {
      playTrack(currentIndex)
      return
    }

    if (queue.length > 0) {
      const nextTrack = queue[0]
      setQueue(queue.slice(1))
      playTrackById(nextTrack.id, nextTrack)
      return
    }

    if (currentIndexRef.current < currentTracksRef.current.length - 1) {
      playTrack(currentIndexRef.current + 1)
    } else if (repeat === 'all') {
      playTrack(0)
    }
  }

  const fetchPopularPlaylists = async (lang = language) => {
    const query = `${lang} music playlists`
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: query,
            type: 'playlist',
            maxResults: 20,
            key: YOUTUBE_API_KEY
          }
        }
      )
      setPlaylists(data.items)
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
    }
  }

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage)
    setShowLanguageDropdown(false)
    setViewMode('home')
    setSearchTerm('')
    setPlaylists([])
    setCurrentTracks([])
    setCurrentTrack(null)
    setIsPlaying(false)
    if (playerRef.current?.stopVideo) {
      playerRef.current.stopVideo()
    }
    fetchPopularPlaylists(newLanguage)
  }

  useEffect(() => {
    if (viewMode === 'home') {
      fetchPopularPlaylists()
    }
  }, [language, YOUTUBE_API_KEY, viewMode])

  const handlePlaylistSelect = async (playlistId, playlistInfo = null) => {
    if (cachedPlaylists.has(playlistId)) {
      const tracks = cachedPlaylists.get(playlistId)
      setOriginalTracks(tracks)
      setCurrentTracks(tracks)
      setViewMode('playlist')
      updateRecentPlaylists(playlistId, playlistInfo)
      cookieManager.setCurrentPlaylist(playlistId)
      return
    }

    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/playlistItems', {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: 50,
            key: YOUTUBE_API_KEY
          }
        }
      )

      const tracks = data.items.map(item => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        playlistId
      }))

      setCachedPlaylists(new Map(cachedPlaylists.set(playlistId, tracks)))
      setOriginalTracks(tracks)
      setCurrentTracks(tracks)
      setViewMode('playlist')
      updateRecentPlaylists(playlistId, playlistInfo || playlists.find(p => p.id?.playlistId === playlistId))
      cookieManager.setCurrentPlaylist(playlistId)
    } catch (error) {
      console.error('Failed to fetch playlist tracks:', error)
    }
  }

  const updateRecentPlaylists = (playlistId, playlistInfo) => {
    if (!playlistInfo) return
    const newRecent = recentPlaylists.filter(p => p.id !== playlistId)
    const playlistData = {
      id: playlistId,
      title: playlistInfo.snippet?.title || playlistInfo.title,
      thumbnail: playlistInfo.snippet?.thumbnails?.medium?.url || playlistInfo.thumbnail,
      channelTitle: playlistInfo.snippet?.channelTitle || playlistInfo.channelTitle
    }
    newRecent.unshift(playlistData)
    const limited = newRecent.slice(0, 10)
    setRecentPlaylists(limited)
    cookieManager.setRecentPlaylists(limited)
  }

  const handlePlayAll = () => {
    if (currentTracks.length === 0) return
    if (shuffle) {
      const shuffled = shuffleArray(currentTracks)
      shuffledTracksRef.current = shuffled
      setCurrentTracks(shuffled)
      playTrack(0)
    } else {
      playTrack(0)
    }
  }

  const toggleShuffle = () => {
    const newShuffle = !shuffle
    setShuffle(newShuffle)
    if (newShuffle && currentTracks.length > 0) {
      const shuffled = shuffleArray(originalTracks)
      shuffledTracksRef.current = shuffled
      const currentTrackId = currentTrack?.id
      const newIndex = shuffled.findIndex(t => t.id === currentTrackId)
      if (newIndex !== -1) {
        setCurrentTracks(shuffled)
        setCurrentIndex(newIndex)
      } else {
        setCurrentTracks(shuffled)
      }
    } else if (!newShuffle && originalTracks.length > 0) {
      const currentTrackId = currentTrack?.id
      const newIndex = originalTracks.findIndex(t => t.id === currentTrackId)
      setCurrentTracks(originalTracks)
      if (newIndex !== -1) {
        setCurrentIndex(newIndex)
      }
    }
  }

  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one']
    const currentIndex = modes.indexOf(repeat)
    setRepeat(modes[(currentIndex + 1) % modes.length])
  }

  const playTrack = (index) => {
    if (index < 0 || index >= currentTracks.length) return
    setCurrentIndex(index)
    const track = currentTracks[index]
    setCurrentTrack(track)
    
    if (!playerRef.current) {
      console.warn('Player not initialized yet, waiting...')
      setTimeout(() => playTrack(index), 500)
      return
    }

    try {
      if (playerRef.current.loadVideoById) {
        playerRef.current.loadVideoById(track.id)
        setTimeout(() => {
          if (playerRef.current && playerRef.current.playVideo) {
            playerRef.current.playVideo()
          }
        }, 100)
      } else {
        console.error('Player loadVideoById method not available')
      }
    } catch (error) {
      console.error('Error playing track:', error)
    }
  }

  const playTrackById = (trackId, track = null) => {
    const index = currentTracks.findIndex(t => t.id === trackId)
    if (index !== -1) {
      playTrack(index)
    } else if (track) {
      setCurrentTrack(track)
      if (!playerRef.current) {
        console.warn('Player not initialized yet, waiting...')
        setTimeout(() => playTrackById(trackId, track), 500)
        return
      }
      try {
        if (playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(track.id)
          setTimeout(() => {
            if (playerRef.current && playerRef.current.playVideo) {
              playerRef.current.playVideo()
            }
          }, 100)
        }
      } catch (error) {
        console.error('Error playing track by ID:', error)
      }
    }
  }

  const playNext = () => {
    if (queue.length > 0) {
      const nextTrack = queue[0]
      setQueue(queue.slice(1))
      playTrackById(nextTrack.id, nextTrack)
      return
    }

    if (currentIndex < currentTracks.length - 1) {
      playTrack(currentIndex + 1)
    } else if (repeat === 'all') {
      playTrack(0)
    }
  }

  const playPrevious = () => {
    if (currentIndex > 0) {
      playTrack(currentIndex - 1)
    } else if (repeat === 'all') {
      playTrack(currentTracks.length - 1)
    }
  }

  const toggleFavorite = (trackId) => {
    const newFavorites = new Set(favorites)
    if (newFavorites.has(trackId)) {
      newFavorites.delete(trackId)
    } else {
      newFavorites.add(trackId)
    }
    setFavorites(newFavorites)
  }

  const addToQueue = (track) => {
    setQueue([...queue, track])
  }

  const savePlaylist = () => {
    if (currentTracks.length === 0) return
    const playlistData = {
      id: `saved_${Date.now()}`,
      title: `Saved Playlist ${new Date().toLocaleDateString()}`,
      tracks: currentTracks,
      thumbnail: currentTracks[0]?.thumbnail,
      createdAt: new Date().toISOString()
    }
    const newSaved = [...savedPlaylists, playlistData]
    setSavedPlaylists(newSaved)
    cookieManager.setPlaylists(newSaved)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
        try {
          const current = playerRef.current.getCurrentTime()
          const total = playerRef.current.getDuration()
          if (current && total) {
            setProgress((current / total) * 100)
            setCurrentTime(formatDuration(current))
            setDuration(formatDuration(total))
          }
        } catch (error) {
          console.error('Error getting player time:', error)
        }
      }
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm) return

    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/search', 
        {
          params: {
            part: 'snippet',
            q: `${searchTerm} ${language} music playlist`,
            type: 'playlist',
            maxResults: 20,
            key: YOUTUBE_API_KEY
          }
        }
      )
      setPlaylists(data.items)
      setViewMode('search')
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const seekTo = (percent) => {
    if (playerRef.current?.getDuration) {
      const duration = playerRef.current.getDuration()
      playerRef.current.seekTo(percent * duration)
    }
  }

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        fixed md:static
        w-64 h-full
        bg-gray-900 flex-shrink-0 flex flex-col border-r border-gray-800
        z-50 md:z-auto
        transition-transform duration-300 ease-in-out
      `}>
          <div className="p-6 border-b border-gray-800">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MusicalNoteIcon className="h-8 w-8 text-green-500" />
              Rajify
            </h1>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4">
            <button
              onClick={() => setViewMode('home')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition ${
                viewMode === 'home' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <HomeIcon className="h-6 w-6" />
              <span>Home</span>
            </button>
            
            <button
              onClick={() => setViewMode('search')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition ${
                viewMode === 'search' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <MagnifyingGlassIcon className="h-6 w-6" />
              <span>Search</span>
            </button>

            <div className="mt-6 mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">Your Library</h3>
              
              {savedPlaylists.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-300 px-3 mb-2">Saved Playlists</h4>
                  {savedPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        setCurrentTracks(playlist.tracks)
                        setOriginalTracks(playlist.tracks)
                        setViewMode('playlist')
                      }}
                      className="w-full flex items-center gap-3 p-2 px-3 rounded-lg mb-1 text-gray-400 hover:text-white hover:bg-gray-800/50 transition text-left"
                    >
                      <img src={playlist.thumbnail} alt={playlist.title} className="w-10 h-10 rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{playlist.title}</p>
                        <p className="text-xs text-gray-500">Playlist</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recentPlaylists.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 px-3 mb-2">Recently Played</h4>
                  {recentPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handlePlaylistSelect(playlist.id, playlist)}
                      className="w-full flex items-center gap-3 p-2 px-3 rounded-lg mb-1 text-gray-400 hover:text-white hover:bg-gray-800/50 transition text-left"
                    >
                      <img src={playlist.thumbnail} alt={playlist.title} className="w-10 h-10 rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{playlist.title}</p>
                        <p className="text-xs text-gray-500">Playlist</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-gray-800 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 bg-gray-900/50">
          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
            {viewMode === 'playlist' && (
              <button 
                onClick={() => setViewMode('home')}
                className="p-2 hover:bg-white/10 rounded-full active:bg-white/20 touch-manipulation"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
            )}
            
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-full active:bg-white/20 touch-manipulation"
            >
              <ArrowsRightLeftIcon className="h-6 w-6" />
            </button>

            {(viewMode === 'home' || viewMode === 'search') && (
              <div className="flex-1">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Search ${language} playlists...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 p-2 md:p-3 rounded-lg bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 text-white text-sm md:text-base"
                  />
                  <button 
                    type="submit"
                    className="px-4 md:px-6 py-2 md:py-3 bg-green-500 rounded-lg hover:bg-green-600 active:bg-green-700 transition font-semibold text-sm md:text-base touch-manipulation"
                  >
                    Search
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="relative w-full md:w-auto">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="w-full md:w-auto px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 active:bg-gray-600 transition flex items-center gap-2 text-sm font-medium min-w-[140px] justify-between touch-manipulation"
            >
              <span>{languages.find(l => l.value === language)?.label || 'Select Language'}</span>
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showLanguageDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowLanguageDropdown(false)}
                />
                <div className="absolute right-0 md:right-0 left-0 md:left-auto top-full mt-2 bg-gray-800 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto min-w-[200px]">
                  {languages.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => handleLanguageChange(lang.value)}
                      className={`w-full text-left px-4 py-3 active:bg-gray-600 transition flex items-center gap-2 touch-manipulation ${
                        language === lang.value ? 'bg-green-500/20 text-green-500' : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {language === lang.value && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-gradient-to-b from-gray-900 to-black pb-24 md:pb-6">
          {viewMode === 'playlist' && currentTracks.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 mb-4">
                <button
                  onClick={handlePlayAll}
                  className="p-3 md:p-4 bg-green-500 rounded-full hover:scale-105 active:scale-95 transition shadow-lg shadow-green-500/50 touch-manipulation"
                >
                  <PlayIcon className="h-6 w-6 md:h-8 md:w-8 text-black" />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 truncate">Playlist</h2>
                  <p className="text-gray-400 text-sm md:text-base">{currentTracks.length} songs</p>
                </div>
                <button
                  onClick={savePlaylist}
                  className="w-full md:w-auto px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700 active:bg-gray-600 transition text-sm md:text-base touch-manipulation"
                >
                  Save Playlist
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {viewMode !== 'playlist' ? (
              playlists.map((playlist) => (
                <div
                  key={playlist.id.playlistId}
                  onClick={() => handlePlaylistSelect(playlist.id.playlistId, playlist)}
                  className="bg-gray-800/50 p-3 md:p-4 rounded-xl hover:bg-gray-800 active:bg-gray-700 transition cursor-pointer group touch-manipulation"
                >
                  <div className="relative mb-3 md:mb-4">
                    <img
                      src={playlist.snippet.thumbnails?.medium?.url}
                      alt={playlist.snippet.title}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    <div className="absolute bottom-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePlaylistSelect(playlist.id.playlistId, playlist)
                          setTimeout(() => handlePlayAll(), 500)
                        }}
                        className="p-2 md:p-3 bg-green-500 rounded-full shadow-lg hover:scale-110 active:scale-95 transition touch-manipulation"
                      >
                        <PlayIcon className="h-5 w-5 md:h-6 md:w-6 text-black" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold truncate mb-1 text-sm md:text-base">{playlist.snippet.title}</h3>
                  <p className="text-gray-400 text-xs md:text-sm truncate">
                    {playlist.snippet.channelTitle}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-full">
                <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                  {currentTracks.map((track, index) => (
                    <div
                      key={track.id}
                      className={`p-2 md:p-3 flex items-center gap-2 md:gap-4 hover:bg-gray-800/50 active:bg-gray-800 transition touch-manipulation ${
                        currentTrack?.id === track.id ? 'bg-green-500/20' : ''
                      }`}
                    >
                      <span className="text-gray-400 w-6 md:w-8 text-center text-xs md:text-sm">{index + 1}</span>
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-md flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate text-sm md:text-base">{track.title}</h4>
                        <p className="text-xs md:text-sm text-gray-400 truncate">{track.channel}</p>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleFavorite(track.id)}
                          className={`p-2 rounded-full transition active:scale-95 touch-manipulation ${
                            favorites.has(track.id) ? 'text-red-500' : 'text-gray-400 active:text-white'
                          }`}
                        >
                          <HeartIcon className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <button
                          onClick={() => addToQueue(track)}
                          className="p-2 text-gray-400 active:text-white rounded-full transition active:scale-95 touch-manipulation"
                        >
                          <QueueListIcon className="h-4 w-4 md:h-5 md:w-5" />
                        </button>
                        <button
                          onClick={() => playTrack(index)}
                          className="p-2 text-gray-400 active:text-white rounded-full transition active:scale-95 touch-manipulation"
                        >
                          {currentTrack?.id === track.id && isPlaying ? (
                            <PauseIcon className="h-4 w-4 md:h-5 md:w-5" />
                          ) : (
                            <PlayIcon className="h-4 w-4 md:h-5 md:w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Player Controls - Only show when track is selected */}
        {currentTrack && (
          <div className="fixed md:static bottom-0 left-0 right-0 h-auto md:h-24 border-t border-gray-800 bg-gray-900 p-3 md:p-4 z-30">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
              {/* Track Info */}
              <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1 w-full md:w-auto order-2 md:order-1">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-md flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold truncate text-sm md:text-base">{currentTrack.title}</h4>
                  <p className="text-xs md:text-sm text-gray-400 truncate">{currentTrack.channel}</p>
                </div>
                <button
                  onClick={() => toggleFavorite(currentTrack.id)}
                  className={`p-2 rounded-full transition flex-shrink-0 active:scale-95 touch-manipulation ${
                    favorites.has(currentTrack.id) ? 'text-red-500' : 'text-gray-400 active:text-white'
                  }`}
                >
                  <HeartIcon className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>

              {/* Playback Controls */}
              <div className="flex flex-col items-center flex-1 max-w-2xl w-full md:w-auto order-1 md:order-2">
                <div className="flex items-center gap-1 md:gap-2 mb-2">
                  <button
                    onClick={toggleShuffle}
                    className={`p-2 rounded-full transition active:scale-95 touch-manipulation ${
                      shuffle ? 'text-green-500' : 'text-gray-400 active:text-white'
                    }`}
                  >
                    <ArrowPathIcon className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                  
                  <button
                    onClick={playPrevious}
                    className="p-2 active:bg-white/20 rounded-full transition active:scale-95 touch-manipulation"
                  >
                    <BackwardIcon className="h-5 w-5 md:h-6 md:w-6" />
                  </button>
                  
                  <button
                    onClick={() => {
                      if (playerRef.current) {
                        try {
                          if (isPlaying) {
                            playerRef.current.pauseVideo()
                          } else {
                            playerRef.current.playVideo()
                          }
                        } catch (error) {
                          console.error('Error toggling play/pause:', error)
                        }
                      }
                    }}
                    className="p-2 md:p-3 bg-white rounded-full hover:scale-105 active:scale-95 transition touch-manipulation"
                  >
                    {isPlaying ? (
                      <PauseIcon className="h-5 w-5 md:h-6 md:w-6 text-black" />
                    ) : (
                      <PlayIcon className="h-5 w-5 md:h-6 md:w-6 text-black" />
                    )}
                  </button>

                  <button
                    onClick={playNext}
                    className="p-2 active:bg-white/20 rounded-full transition active:scale-95 touch-manipulation"
                  >
                    <ForwardIcon className="h-5 w-5 md:h-6 md:w-6" />
                  </button>

                  <button
                    onClick={toggleRepeat}
                    className={`p-2 rounded-full transition relative active:scale-95 touch-manipulation ${
                      repeat !== 'off' ? 'text-green-500' : 'text-gray-400 active:text-white'
                    }`}
                    title={repeat === 'off' ? 'Repeat Off' : repeat === 'all' ? 'Repeat All' : 'Repeat One'}
                  >
                    <ArrowPathIcon className="h-4 w-4 md:h-5 md:w-5" />
                    {repeat === 'one' && <span className="absolute top-0 right-0 text-xs bg-green-500 text-black rounded-full w-3 h-3 md:w-4 md:h-4 flex items-center justify-center text-[8px] md:text-xs">1</span>}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full flex items-center gap-2 md:gap-3">
                  <span className="text-xs text-gray-400 w-8 md:w-10 text-right text-[10px] md:text-xs">{currentTime}</span>
                  <div 
                    className="flex-1 h-1.5 md:h-1 bg-gray-700 rounded-full cursor-pointer group touch-manipulation"
                    onClick={(e) => {
                      const rect = e.target.getBoundingClientRect()
                      const percent = (e.clientX - rect.left) / rect.width
                      seekTo(percent)
                    }}
                  >
                    <div 
                      className="h-full bg-white rounded-full group-hover:bg-green-500 transition"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 md:w-10 text-[10px] md:text-xs">{duration}</span>
                </div>
              </div>

              {/* Volume & Queue - Desktop */}
              <div className="hidden md:flex items-center gap-3 flex-1 justify-end min-w-[180px]">
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className={`p-2 rounded-full transition relative ${
                    showQueue ? 'text-green-500' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <QueueListIcon className="h-5 w-5" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {queue.length}
                    </span>
                  )}
                </button>
                <SpeakerWaveIcon className="h-5 w-5 flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value)
                    setVolume(newVolume)
                    playerRef.current?.setVolume(newVolume * 100)
                  }}
                  className="w-24 accent-white cursor-pointer"
                />
              </div>

              {/* Queue Button - Mobile */}
              <div className="md:hidden order-3">
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className={`p-2 rounded-full transition relative active:scale-95 touch-manipulation ${
                    showQueue ? 'text-green-500' : 'text-gray-400 active:text-white'
                  }`}
                >
                  <QueueListIcon className="h-5 w-5" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-green-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {queue.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue Sidebar */}
        {showQueue && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowQueue(false)}
            />
            <div className={`fixed md:absolute right-0 top-0 w-full md:w-80 bg-gray-900 border-l border-gray-800 overflow-y-auto p-4 z-50 ${currentTrack ? 'bottom-20 md:bottom-24' : 'bottom-0'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Queue</h3>
              <button
                onClick={() => setShowQueue(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            {queue.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Queue is empty</p>
            ) : (
              <div className="space-y-2">
                {queue.map((track, index) => (
                  <div
                    key={`${track.id}-${index}`}
                    className="p-3 bg-gray-800/50 rounded-lg flex items-center gap-3"
                  >
                    <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.title}</p>
                      <p className="text-xs text-gray-400 truncate">{track.channel}</p>
                    </div>
                    <button
                      onClick={() => setQueue(queue.filter((_, i) => i !== index))}
                      className="text-gray-400 hover:text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </>
        )}
      </div>

      <div id="player" className="hidden" />
    </div>
  )
}
