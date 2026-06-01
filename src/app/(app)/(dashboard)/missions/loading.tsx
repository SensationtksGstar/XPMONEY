export default function MissionsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 bg-white/10 rounded" />
              <div className="h-3 w-56 bg-white/10 rounded" />
            </div>
            <div className="h-5 w-16 bg-white/10 rounded-full" />
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full" />
        </div>
      ))}
    </div>
  )
}
