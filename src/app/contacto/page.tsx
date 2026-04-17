import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ContactForm } from './ContactForm'
import { LandingFooter } from '@/components/landing/LandingFooter'

export const metadata = {
  title:       'Contacto · XP Money',
  description: 'Envia-nos uma mensagem. Respondemos em menos de 24 horas.',
}

/**
 * /contacto — página pública com formulário de contacto.
 *
 * Design: "sem email visível". O user preenche o formulário, nós recebemos
 * a mensagem em /admin/bugs (reusa a tabela bug_reports com type='contact').
 * O email do admin nunca aparece em lado nenhum — nem no HTML, nem num
 * mailto:. Único ponto de contacto = este formulário + /admin.
 */
export default function ContactoPage() {
  return (
    <main className="min-h-screen bg-[#060b14] text-white">
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-white tracking-tight">XP Money</span>
        </Link>
        <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
          ← Voltar
        </Link>
      </nav>

      <section className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            Resposta em &lt; 24h
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Vamos falar</h1>
          <p className="text-white/60 text-lg">
            Tens uma dúvida, sugestão ou queres reportar alguma coisa?
            Preenche abaixo — chega-nos direto.
          </p>
        </div>

        <ContactForm />

        <p className="text-[10px] text-white/30 text-center mt-6 leading-relaxed">
          Os teus dados (email + mensagem) são usados exclusivamente para te responder.
          Consulta a{' '}
          <Link href="/privacidade" className="underline hover:text-white/50">
            Política de Privacidade
          </Link>{' '}
          para saberes como os tratamos.
        </p>
      </section>

      <LandingFooter />
    </main>
  )
}
