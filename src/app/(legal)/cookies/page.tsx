import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { breadcrumb } from '@/lib/seo/jsonLd'

export const metadata: Metadata = {
  title:       'Política de Cookies',
  description: 'Cookies usados pelo XP-Money: essenciais (Clerk, locale), analytics opt-in (PostHog) e como gerir o consentimento.',
  alternates:  { canonical: '/cookies' },
  openGraph:   {
    type:        'article',
    title:       'Política de Cookies · XP-Money',
    description: 'Cookies essenciais, analytics opt-in e gestão de consentimento (ePrivacy / RGPD).',
    url:         'https://xp-money.com/cookies',
  },
  robots:      { index: true, follow: true },
}

/**
 * Política de Cookies — obrigatória pela Diretiva ePrivacy se o site usar
 * cookies além das estritamente necessárias. O XP-Money usa cookies de
 * sessão (Clerk), preferências (locale, tema) e analytics (PostHog), logo
 * precisa de divulgar.
 */
export default function CookiesPage() {
  return (
    <>
      <JsonLd schema={breadcrumb([
        { name: 'Início', href: '/' },
        { name: 'Política de Cookies', href: '/cookies' },
      ])} />
      <h1>Política de Cookies</h1>
      <p className="updated">Última atualização: 17 de abril de 2026</p>

      <div className="tldr">
        <strong>TL;DR:</strong> Usamos cookies essenciais (sem escolha — a app
        precisa) e cookies analíticos (que podes recusar). Nunca usamos cookies
        publicitários de terceiros. Podes apagar tudo nas definições do browser.
      </div>

      <h2>1. O que são cookies</h2>
      <p>
        Cookies são pequenos ficheiros de texto que o teu browser guarda quando visitas um
        site. Servem para lembrar preferências, manter-te com sessão iniciada, ou medir
        utilização anónima.
      </p>
      <p>
        Além de cookies, o XP-Money também usa <strong>localStorage</strong> e{' '}
        <strong>IndexedDB</strong> para guardar preferências e cache offline. Para
        efeitos desta política, são tratados como &quot;cookies&quot;.
      </p>

      <h2>2. Que cookies usamos</h2>

      <h3>2.1. Estritamente necessários (sempre ativos)</h3>
      <ul>
        <li><strong>Clerk session</strong> (<code>__session</code>, <code>__client_uat</code>) — mantém a tua sessão iniciada. Sem estes, a app não funciona.</li>
        <li><strong>CSRF tokens</strong> — proteção contra ataques cross-site.</li>
        <li><strong>localStorage <code>xpmoney:locale</code></strong> — lembra o idioma que escolheste.</li>
        <li><strong>localStorage <code>xpmoney:mascot_last_evo</code></strong> — anima transições do mascote.</li>
        <li><strong>localStorage <code>xpm_course_*</code></strong> — progresso dos cursos da Academia.</li>
      </ul>

      <h3>2.2. Analytics (podem ser recusados)</h3>
      <ul>
        <li><strong>PostHog</strong> (<code>ph_*</code>) — regista eventos anónimos (ex. &quot;clicou em X&quot;) para sabermos o que é útil. Sem nome nem email.</li>
      </ul>

      <h3>2.3. Pagamentos (só quando compras)</h3>
      <ul>
        <li><strong>Stripe</strong> (<code>__stripe_mid</code>, <code>__stripe_sid</code>) — prevenção de fraude no checkout. Só ativados quando inicias uma subscrição paga.</li>
      </ul>

      <h3>2.4. O que NÃO usamos</h3>
      <ul>
        <li>Cookies publicitários de terceiros (Google Ads, Meta, etc.).</li>
        <li>Pixeis de tracking cross-site.</li>
        <li>Fingerprinting de browser.</li>
      </ul>

      <h2>3. Como controlar cookies</h2>
      <p>
        No teu browser podes bloquear ou apagar cookies a qualquer momento:
      </p>
      <ul>
        <li><strong>Chrome:</strong> <code>chrome://settings/cookies</code></li>
        <li><strong>Firefox:</strong> <code>about:preferences#privacy</code></li>
        <li><strong>Safari:</strong> Preferências &gt; Privacidade &gt; Gerir dados de sites</li>
        <li><strong>Edge:</strong> <code>edge://settings/siteData</code></li>
      </ul>
      <p>
        <strong>Nota:</strong> se bloqueares os cookies estritamente necessários, partes da app
        (como o login) não vão funcionar.
      </p>

      <h2>4. Alterações</h2>
      <p>
        Atualizamos esta política quando adicionamos ou removemos serviços que usam cookies.
        A data de última atualização está no topo.
      </p>

      <hr />
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
        Mais detalhes sobre tratamento de dados: <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </>
  )
}
