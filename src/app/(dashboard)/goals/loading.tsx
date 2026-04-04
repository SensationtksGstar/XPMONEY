export default function GoalsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-36 bg-white/10 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 animate-pulse space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-5 w-14 bg-white/10 rounded-full" />
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-white/10 rounded" />
              <div className="h-3 w-20 bg-white/10 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
