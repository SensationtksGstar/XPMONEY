export default function SettingsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-7 w-32 bg-white/10 rounded animate-pulse" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-5 animate-pulse space-y-3">
          <div className="h-4 w-36 bg-white/10 rounded" />
          <div className="h-px w-full bg-white/5" />
          <div className="space-y-2">
            <div className="h-10 w-full bg-white/10 rounded-xl" />
            <div className="h-10 w-full bg-white/10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
