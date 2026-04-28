/**
 * Inline <script type="application/ld+json"> for schema.org structured data.
 *
 * Why this component instead of inlining the script tag manually:
 *   - Centralises the JSON.stringify so we don't repeat the dangerouslySet
 *     escape every time a page wants a snippet
 *   - Strips characters that would break out of the </script> sandbox
 *     (Google's recommended escape — `<` for `<`)
 *   - Server-rendered (no `'use client'`) → ships zero JS to the browser
 *
 * Usage:
 *   import { JsonLd }    from '@/components/seo/JsonLd'
 *   import { faqPage }   from '@/lib/seo/jsonLd'
 *   <JsonLd schema={faqPage([...])} />
 */

interface Props {
  schema: object
}

export function JsonLd({ schema }: Props) {
  // Escape `<` so an attacker-controlled answer text like "</script><script>..."
  // can't break out of the JSON-LD sandbox. Standard precaution per Google
  // and OWASP.
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
