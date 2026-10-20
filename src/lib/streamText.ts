/**
 * streamText — wrap an already-built string body in a ReadableStream.
 *
 * Vercel Functions reject a BUFFERED response body over 4.5 MB
 * (413 FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE); streamed responses aren't held
 * to that limit. Exports (RGPD JSON, transactions CSV) can now return up to
 * 50k rows per table thanks to `fetchAll`, so a heavy user would otherwise
 * get NO file at all instead of their data. The body is still built in
 * memory — this only changes how it leaves the lambda — and is emitted in
 * 64 KB chunks so the runtime never has to copy it as one giant buffer.
 */
const CHUNK_CHARS = 64 * 1024

export function streamText(body: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let offset = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= body.length) {
        controller.close()
        return
      }
      let end = Math.min(offset + CHUNK_CHARS, body.length)
      // Never split a UTF-16 surrogate pair (emoji in descriptions/icons) —
      // encoding a lone half would emit U+FFFD and corrupt the character.
      const last = body.charCodeAt(end - 1)
      if (end < body.length && last >= 0xd800 && last <= 0xdbff) end -= 1
      controller.enqueue(encoder.encode(body.slice(offset, end)))
      offset = end
    },
  })
}
