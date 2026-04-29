/**
 * JSON-LD (schema.org) helpers — what unlocks rich Google snippets.
 *
 * Each helper returns a plain object ready to be JSON-stringified into a
 * `<script type="application/ld+json">` tag. Pages that want a snippet
 * just import the helper they need and pass it to <JsonLd schema={...} />.
 *
 * Why JSON-LD over Microdata or RDFa: Google explicitly recommends it,
 * it doesn't pollute the rendered DOM, and it's cleanly server-renderable.
 *
 * Schemas covered:
 *   - organization()        — site-wide identity card (logo, social links)
 *   - softwareApplication() — XP-Money as an app (rating, price, OS)
 *   - faqPage(qas)          — FAQ rich snippet (collapsible Q&A in SERP)
 *   - product(price)        — Premium plan as a Product (price tag in SERP)
 *   - breadcrumb(items)     — breadcrumb trail (legal pages, etc.)
 *
 * All helpers accept a `locale` so EN visitors get EN descriptions on
 * shared links / Twitter cards.
 */

import type { Locale } from '@/lib/i18n/translations'

const SITE_URL = 'https://xp-money.com'
const BRAND    = 'XP-Money'

// ─────────────────────────────────────────────────────────────────────────
// Organization — site-wide. Mounted in the root layout so every page has
// it. Helps Google build the "Knowledge Panel" + brand identity over time.
// ─────────────────────────────────────────────────────────────────────────
export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type':    'Organization',
    name:       BRAND,
    url:        SITE_URL,
    logo:       `${SITE_URL}/logo.svg`,
    // Empty until we have real social profiles — schema.org accepts
    // an empty array but we omit the field rather than mislead crawlers.
    // Add `sameAs: ['https://instagram.com/...', ...]` when handles exist.
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SoftwareApplication — what makes Google show the app as an "app result"
// (rating, OS support, price) in the SERP card. Without this, XP-Money
// just shows as a plain blue link.
// ─────────────────────────────────────────────────────────────────────────
export function softwareApplication(locale: Locale = 'pt') {
  return {
    '@context':    'https://schema.org',
    '@type':       'SoftwareApplication',
    name:          BRAND,
    url:           SITE_URL,
    description:   locale === 'en'
      ? 'Gamified personal finance app. Track expenses, hit goals, level up your mascot. Free + Premium €4.99/mo.'
      : 'App de finanças pessoais gamificada. Controla gastos, atinge objetivos, evolui o teu mascote. Grátis + Premium €4,99/mês.',
    applicationCategory: 'FinanceApplication',
    operatingSystem:     'Web, iOS, Android (PWA)',
    offers: {
      '@type':         'Offer',
      price:           '4.99',
      priceCurrency:   'EUR',
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0],
      availability:    'https://schema.org/InStock',
    },
    // Free tier mentioned so Google understands "freemium". Without this
    // the price-only Offer can rank us as paid-only.
    featureList: locale === 'en'
      ? [
          'Free plan available',
          'Receipt scanning (AI)',
          'Bank statement import (PDF/CSV)',
          'Investment simulator',
          'Personal finance courses',
          'Gamified XP + missions + badges',
          'Bilingual PT/EN',
        ]
      : [
          'Plano gratuito disponível',
          'Scan de recibos (IA)',
          'Importação de extratos bancários (PDF/CSV)',
          'Simulador de investimento',
          'Cursos de finanças pessoais',
          'XP, missões e badges gamificados',
          'Bilingue PT/EN',
        ],
    inLanguage: ['pt-PT', 'en-US'],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FAQPage — the rich snippet that shows expanded Q&A directly in Google
// search results (huge SERP real-estate win when it triggers). Only emit
// if you have ≥3 genuine Q&As; spammy FAQ schemas get manually penalised.
// ─────────────────────────────────────────────────────────────────────────
export function faqPage(qas: ReadonlyArray<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: qas.map(({ q, a }) => ({
      '@type': 'Question',
      name:    q,
      acceptedAnswer: {
        '@type': 'Answer',
        // Strip HTML, schema.org wants plain text. Our FAQ answers are
        // currently plain strings already, but defensive in case future
        // copy adds <strong>/<a>.
        text: a.replace(/<[^>]+>/g, '').trim(),
      },
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Product — pairs the Premium plan with a price tag in the SERP card.
// Only inject on the page where pricing is the primary content (the
// landing's pricing section qualifies because it's a single-page site).
// ─────────────────────────────────────────────────────────────────────────
export function premiumProduct(locale: Locale = 'pt') {
  return {
    '@context':   'https://schema.org',
    '@type':      'Product',
    name:         `${BRAND} Premium`,
    description:  locale === 'en'
      ? 'XP-Money Premium — full access to receipt scanning, statement import, advanced courses, no ads.'
      : 'XP-Money Premium — acesso completo a scan de recibos, import de extratos, cursos avançados, sem anúncios.',
    brand:        { '@type': 'Brand', name: BRAND },
    offers: [
      {
        '@type':       'Offer',
        name:          locale === 'en' ? 'Monthly' : 'Mensal',
        price:         '4.99',
        priceCurrency: 'EUR',
        availability:  'https://schema.org/InStock',
        url:           `${SITE_URL}/settings/billing`,
      },
      {
        '@type':       'Offer',
        name:          locale === 'en' ? 'Yearly (save ~33%)' : 'Anual (poupa ~33%)',
        price:         '39.99',
        priceCurrency: 'EUR',
        availability:  'https://schema.org/InStock',
        url:           `${SITE_URL}/settings/billing`,
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// BreadcrumbList — useful on legal pages and any future blog posts. Lets
// Google show "Home › Privacy" instead of just the URL in the SERP.
// ─────────────────────────────────────────────────────────────────────────
export function breadcrumb(items: ReadonlyArray<{ name: string; href: string }>) {
  return {
    '@context':       'https://schema.org',
    '@type':          'BreadcrumbList',
    itemListElement:  items.map((it, i) => ({
      '@type':    'ListItem',
      position:   i + 1,
      name:       it.name,
      item:       it.href.startsWith('http') ? it.href : `${SITE_URL}${it.href}`,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Article — for blog posts. Pairs with BreadcrumbList on the same page.
// `headline` is what Google shows as the SERP title; keep it ≤ 110 chars
// or it gets truncated.
// ─────────────────────────────────────────────────────────────────────────
export function article(input: {
  slug:         string
  title:        string
  description:  string
  date:         string
  /** Optional ISO date when the post was last edited. Falls back to `date`. */
  modifiedDate?: string
  author?:      string
  /** Absolute or root-relative URL. Falls back to the site OG image. */
  image?:       string
  keywords?:    string[]
  locale?:      Locale
}) {
  const url = `${SITE_URL}/blog/${input.slug}`
  return {
    '@context':       'https://schema.org',
    '@type':          'BlogPosting',
    headline:         input.title,
    description:      input.description,
    datePublished:    input.date,
    dateModified:     input.modifiedDate ?? input.date,
    inLanguage:       input.locale === 'en' ? 'en-US' : 'pt-PT',
    keywords:         input.keywords?.join(', '),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id':   url,
    },
    image:  input.image
      ? (input.image.startsWith('http') ? input.image : `${SITE_URL}${input.image}`)
      : `${SITE_URL}/opengraph-image`,
    author: {
      '@type': 'Person',
      name:    input.author ?? BRAND,
    },
    publisher: {
      '@type': 'Organization',
      name:    BRAND,
      logo: {
        '@type': 'ImageObject',
        url:     `${SITE_URL}/logo.svg`,
      },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// WebSite — declares the site root + a SearchAction so Google can show
// the in-result search box for our brand. Cheap, no downside.
// ─────────────────────────────────────────────────────────────────────────
export function website(locale: Locale = 'pt') {
  return {
    '@context':       'https://schema.org',
    '@type':          'WebSite',
    name:             BRAND,
    url:              SITE_URL,
    inLanguage:       locale === 'en' ? 'en-US' : 'pt-PT',
    potentialAction: {
      '@type':       'SearchAction',
      target: {
        '@type':       'EntryPoint',
        urlTemplate:   `${SITE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}
