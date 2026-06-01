export default function VoltixLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
      <div className="glass-card p-6 animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-white/10 shrink-0" />
          <div className="space-y-2">
            <div className="h-5 w-28 bg-white/10 rounded" />
            <div className="h-3 w-40 bg-white/10 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-white/10 rounded" />
          <div className="h-3 w-5/6 bg-white/10 rounded" />
          <div className="h-3 w-4/6 bg-white/10 rounded" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass-card p-4 animate-pulse">
          <div className="h-4 w-48 bg-white/10 rounded mb-2" />
          <div className="h-3 w-full bg-white/10 rounded" />
        </div>
      ))}
    </div>
  )
}
