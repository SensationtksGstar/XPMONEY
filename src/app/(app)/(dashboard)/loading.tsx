// Fallback generico para as rotas do dashboard sem loading.tsx proprio
// (contas, orcamento, dividas, perspetiva, simulador, cursos...). Sem isto,
// um toque na navegacao nao dava qualquer feedback ate a pagina chegar.
export default function DashboardGroupLoading() {
  return (
    <div className="space-y-4 pb-2" aria-busy="true">
      <div className="h-7 w-48 bg-white/10 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card p-4 h-28 rounded-2xl animate-pulse">
            <div className="h-3 w-20 bg-white/10 rounded mb-3" />
            <div className="h-7 w-24 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
