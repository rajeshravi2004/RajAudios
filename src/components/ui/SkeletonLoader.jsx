/**
 * SkeletonLoader.jsx — Skeleton loading states
 */

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`flex-shrink-0 w-44 ${className}`}>
      <div className="skeleton w-full aspect-square rounded-xl mb-3" />
      <div className="skeleton h-4 w-3/4 mb-2" />
      <div className="skeleton h-3 w-1/2" />
    </div>
  )
}

export function SkeletonTrackRow() {
  return (
    <div className="track-row pointer-events-none">
      <div className="skeleton w-8 h-4 rounded flex-shrink-0" />
      <div className="skeleton w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="skeleton h-4 w-2/3 mb-2" />
        <div className="skeleton h-3 w-1/3" />
      </div>
      <div className="skeleton h-3 w-12 flex-shrink-0" />
    </div>
  )
}

export function SkeletonSection() {
  return (
    <div className="mb-10">
      <div className="skeleton h-6 w-48 mb-1 rounded" />
      <div className="skeleton h-4 w-32 mb-5 rounded" />
      <div className="section-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonPlaylistHeader() {
  return (
    <div className="flex items-end gap-6 mb-8">
      <div className="skeleton w-48 h-48 rounded-2xl flex-shrink-0" />
      <div className="flex-1">
        <div className="skeleton h-3 w-20 mb-3 rounded" />
        <div className="skeleton h-10 w-64 mb-3 rounded" />
        <div className="skeleton h-4 w-48 rounded" />
      </div>
    </div>
  )
}
