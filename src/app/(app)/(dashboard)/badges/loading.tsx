export default function BadgesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse flex flex-col items-center gap-2">
            <div className="h-14 w-14 rounded-xl bg-white/10" />
            <div className="h-3.5 w-20 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
