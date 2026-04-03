import { auth }         from '@clerk/nextjs/server'
import { VoltixWidget }  from '@/components/voltix/VoltixWidget'

export const metadata = { title: 'Voltix' }

export default async function VoltixPage() {
  const { userId } = await auth()
  if (!userId) return null

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Voltix</h1>
        <p className="text-white/50 text-sm mt-0.5">O teu copiloto financeiro pessoal</p>
      </div>

      <div className="max-w-lg mx-auto">
        <VoltixWidget userId={userId} expanded />
      </div>

      {/* Histórico de interações */}
      <div className="max-w-lg mx-auto">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
          O Voltix disse recentemente
        </h2>
        <div className="space-y-3">
          {[
            { msg: 'Parabéns! Poupaste €120 este mês comparado ao mês passado. 🎉', time: 'Hoje' },
            { msg: 'Gastaste €85 em Lazer esta semana. O orçamento é de €100. Ainda bem!', time: 'Ontem' },
            { msg: 'Nova missão disponível: "7 dias seguidos". +300 XP se conseguires!', time: 'Há 2 dias' },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3">
              <span className="text-2xl flex-shrink-0">⚡</span>
              <div>
                <p className="text-sm text-white/80">{item.msg}</p>
                <p className="text-xs text-white/30 mt-1">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
