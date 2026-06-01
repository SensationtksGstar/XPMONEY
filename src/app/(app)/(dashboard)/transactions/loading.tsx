export default function TransactionsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-40 bg-white/10 rounded animate-pulse" />
      <div className="glass-card divide-y divide-white/5 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-full bg-white/10 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 bg-white/10 rounded" />
              <div className="h-3 w-24 bg-white/10 rounded" />
            </div>
            <div className="h-4 w-16 bg-white/10 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card p-4 h-24 animate-pulse">
            <div className="h-3 w-16 bg-white/10 rounded mb-2" />
            <div className="h-7 w-20 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
