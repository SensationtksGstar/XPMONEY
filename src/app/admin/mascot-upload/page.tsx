'use client'

/**
 * /admin/mascot-upload — local-only tool for dropping the 11 mascot renders
 * (6 Voltix evos + 5 Penny evos) into place. Each tile uploads its own file
 * to /api/admin/upload-mascot and shows the processed WebP result.
 *
 * Uploads to public/mascot/{gender}/{n}.webp which the MascotCreature
 * component will prefer over the SVG fallback on next render.
 */

import { useCallback, useState } from 'react'
import { Upload, Check, AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'

type Gender = 'voltix' | 'penny'
type Status = 'idle' | 'uploading' | 'success' | 'error'

interface SlotState {
  status:  Status
  previewUrl?: string
  serverUrl?:  string
  warning?:    string
  errorMsg?:   string
  sizeKb?:     number
  bust?:       number  // cache-buster for re-uploads
}

const VOLTIX_NAMES = ['Voltini', 'Voltito', 'Voltix', 'Voltaryon', 'Magnavoltix', 'Imperivoltix']
const PENNY_NAMES  = ['Pennini', 'Pennito', 'Penny', 'Pennyara', 'Pennael', 'Seraphenny']

function Tile({
  gender, evo, label, state, onFile,
}: {
  gender: Gender
  evo:    number
  label:  string
  state:  SlotState
  onFile: (gender: Gender, evo: number, file: File) => void
}) {
  const [isDrag, setIsDrag] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(gender, evo, file)
  }, [gender, evo, onFile])

  const bg = gender === 'voltix'
    ? (state.status === 'success' ? 'border-cyan-400/60 bg-cyan-500/10'
      : isDrag ? 'border-cyan-400 bg-cyan-500/20'
      : 'border-white/10 bg-white/5 hover:border-cyan-500/40')
    : (state.status === 'success' ? 'border-pink-400/60 bg-pink-500/10'
      : isDrag ? 'border-pink-400 bg-pink-500/20'
      : 'border-white/10 bg-white/5 hover:border-pink-500/40')

  return (
    <label
      onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
      onDragLeave={() => setIsDrag(false)}
      onDrop={onDrop}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${bg}`}
    >
      {/* Image / placeholder */}
      <div className="w-28 h-28 relative flex items-center justify-center rounded-lg bg-black/30">
        {state.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.previewUrl}
            alt={`${gender} evo ${evo}`}
            className="w-full h-full object-contain rounded-lg"
          />
        )}
        {!state.previewUrl && (
          <Upload className="w-8 h-8 text-white/25" />
        )}

        {/* Status overlay */}
        {state.status === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {state.status === 'success' && (
          <span className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-green-500 text-black">
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        )}
        {state.status === 'error' && (
          <span className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-xs text-white/40">EVO {evo}</p>
        <p className="text-sm font-bold text-white">{label}</p>
        {state.sizeKb != null && (
          <p className="text-[10px] text-white/40 mt-0.5">{state.sizeKb} KB WebP</p>
        )}
        {state.warning && (
          <p className="text-[10px] text-yellow-400 mt-1 leading-tight">{state.warning}</p>
        )}
        {state.errorMsg && (
          <p className="text-[10px] text-red-400 mt-1 leading-tight">{state.errorMsg}</p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(gender, evo, f)
          e.currentTarget.value = ''
        }}
      />
    </label>
  )
}

export default function MascotUploadPage() {
  const [slots, setSlots] = useState<Record<string, SlotState>>({})

  function key(gender: Gender, evo: number) { return `${gender}-${evo}` }

  async function handleFile(gender: Gender, evo: number, file: File) {
    const k = key(gender, evo)
    const previewUrl = URL.createObjectURL(file)
    setSlots(s => ({ ...s, [k]: { status: 'uploading', previewUrl } }))

    try {
      const form = new FormData()
      form.append('gender', gender)
      form.append('evo', String(evo))
      form.append('file', file)

      const res = await fetch('/api/admin/upload-mascot', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setSlots(s => ({
          ...s,
          [k]: { ...s[k], status: 'error', errorMsg: json.error ?? 'Upload falhou' },
        }))
        return
      }

      // Use the processed webp URL with cache-buster so the preview shows the cleaned version
      const bust = Date.now()
      setSlots(s => ({
        ...s,
        [k]: {
          status:      'success',
          previewUrl:  `${json.webp}?v=${bust}`,
          serverUrl:   json.webp,
          warning:     json.warning,
          sizeKb:      json.size_kb,
          bust,
        },
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSlots(s => ({ ...s, [k]: { ...s[k], status: 'error', errorMsg: msg } }))
    }
  }

  const voltixSlots = [1, 2, 3, 4, 5, 6]
  const pennySlots  = [1, 2, 3, 4, 5, 6]

  const allVoltix = voltixSlots.every(n => slots[key('voltix', n)]?.status === 'success')
  const allPenny  = pennySlots.every(n => slots[key('penny', n)]?.status === 'success')

  return (
    <main className="min-h-screen bg-[#060b14] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Upload das mascotes</h1>
          <p className="text-white/50 mt-2 max-w-2xl">
            Arrasta cada render (PNG com fundo transparente, idealmente 1024×1024) para a caixa
            correspondente. O pipeline recorta, centra, redimensiona e converte para WebP 512×512
            automaticamente.
          </p>
          <p className="text-yellow-400 text-sm mt-2">
            ⚠ Ferramenta só-dev — a gravação na pasta public/ não funciona em produção.
            Depois de carregares todas as imagens, faz commit de public/mascot/ para o git.
          </p>
        </div>

        {/* Voltix */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-cyan-300">Voltix (6 evoluções)</h2>
              <p className="text-sm text-white/40">Volt → Legendrix — dragão-trovão azul</p>
            </div>
            {allVoltix && (
              <span className="text-sm text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Tudo carregado
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {voltixSlots.map(n => (
              <Tile
                key={n}
                gender="voltix"
                evo={n}
                label={VOLTIX_NAMES[n - 1] ?? `Evo ${n}`}
                state={slots[key('voltix', n)] ?? { status: 'idle' }}
                onFile={handleFile}
              />
            ))}
          </div>
        </section>

        {/* Penny */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-pink-300">Penny (6 evoluções)</h2>
              <p className="text-sm text-white/40">Pennini → Seraphenny — gata-anjo creme</p>
            </div>
            {allPenny && (
              <span className="text-sm text-green-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> Tudo carregado
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {pennySlots.map(n => (
              <Tile
                key={n}
                gender="penny"
                evo={n}
                label={PENNY_NAMES[n - 1] ?? `Evo ${n}`}
                state={slots[key('penny', n)] ?? { status: 'idle' }}
                onFile={handleFile}
              />
            ))}
          </div>
        </section>

        {/* Next-step tip */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2 text-sm">
          <h3 className="font-bold text-white flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" /> Depois de carregar todas
          </h3>
          <ol className="list-decimal list-inside text-white/60 space-y-1">
            <li>Vai a <code className="bg-white/10 px-1 rounded">/voltix</code> — o componente carrega
              automaticamente os WebP (/mascot/&lt;gender&gt;/&lt;n&gt;.webp) e faz fallback para SVG
              se faltar algum.</li>
            <li>Commit: <code className="bg-white/10 px-1 rounded">git add public/mascot && git commit -m &quot;assets: mascotes Voltix + Penny&quot;</code></li>
            <li>Push → deploy do Vercel → mascotes aparecem em produção.</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
