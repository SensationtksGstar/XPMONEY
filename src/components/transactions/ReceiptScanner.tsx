'use client'

import { useRef, useState }   from 'react'
import {
  Camera, Upload, X, Loader2, CheckCircle2,
  ReceiptText, ChevronRight, AlertCircle,
} from 'lucide-react'
import type { ReceiptScanResult } from '@/app/api/scan-receipt/route'

interface Props {
  onResult: (data: ReceiptScanResult) => void
  onClose:  () => void
}

type ScanState = 'idle' | 'scanning' | 'done' | 'error'

const MESSAGES = [
  'A analisar a imagem…',
  'A extrair o valor…',
  'A identificar o comerciante…',
  'A reconhecer os produtos…',
  'Quase pronto…',
]

export function ReceiptScanner({ onResult, onClose }: Props) {
  const fileRef               = useRef<HTMLInputElement>(null)
  const cameraRef             = useRef<HTMLInputElement>(null)
  const [state, setState]     = useState<ScanState>('idle')
  const [msgIdx, setMsgIdx]   = useState(0)
  const [result, setResult]   = useState<ReceiptScanResult | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errMsg, setErrMsg]   = useState<string>('')

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrMsg('Por favor seleciona uma imagem.')
      setState('error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrMsg('Imagem demasiado grande. Máximo 10MB.')
      setState('error')
      return
    }

    // Generate preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setState('scanning')

    // Cycle through messages
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % MESSAGES.length
      setMsgIdx(idx)
    }, 900)

    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/scan-receipt', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType: file.type }),
      })

      clearInterval(interval)

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Erro ao processar a fatura.')
      }

      const { data } = await res.json()
      setResult(data)
      setState('done')
    } catch (err: unknown) {
      clearInterval(interval)
      setErrMsg(err instanceof Error ? err.message : 'Erro desconhecido.')
      setState('error')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleUseResult() {
    if (result) onResult(result)
  }

  function reset() {
    setState('idle')
    setResult(null)
    setPreview(null)
    setErrMsg('')
    setMsgIdx(0)
    if (fileRef.current)   fileRef.current.value   = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

        {/* ── IDLE: choose method ── */}
        {state === 'idle' && (
          <div className="space-y-3 animate-fade-in">
            <div className="text-center pb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center mx-auto mb-3">
                <ReceiptText className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-white text-base">Scanner de Fatura</h3>
              <p className="text-white/50 text-xs mt-1">
                A IA extrai automaticamente valor, data, loja e produtos
              </p>
            </div>

            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center gap-3 bg-green-500/15 border border-green-500/30 hover:bg-green-500/25 text-white px-4 py-3.5 rounded-2xl transition-all active:scale-98"
            >
              <Camera className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-sm">Tirar Foto</p>
                <p className="text-white/40 text-xs">Usa a câmara do telemóvel</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 ml-auto" />
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 bg-white/5 border border-white/15 hover:bg-white/10 text-white px-4 py-3.5 rounded-2xl transition-all active:scale-98"
            >
              <Upload className="w-5 h-5 text-white/60 flex-shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-sm">Carregar Imagem</p>
                <p className="text-white/40 text-xs">Galeria ou ficheiro (JPG, PNG, WebP)</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 ml-auto" />
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 text-white/40 hover:text-white text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── SCANNING: AI processing ── */}
        {state === 'scanning' && (
          <div className="text-center py-4 space-y-5 animate-fade-in">
            {/* Receipt preview */}
            {preview && (
              <div className="relative mx-auto w-32 h-44 rounded-xl overflow-hidden border border-white/15 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Fatura" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                  <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full">A analisar…</span>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden mx-4">
              <div className="absolute top-0 left-0 h-full bg-purple-400/60 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>

            <div>
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p key={msgIdx} className="text-white/70 text-sm font-medium animate-fade-in">
                {MESSAGES[msgIdx]}
              </p>
              <p className="text-white/30 text-xs mt-1">Claude AI · Processamento seguro</p>
            </div>
          </div>
        )}

        {/* ── DONE: show result ── */}
        {state === 'done' && result && (
          <div className="space-y-3 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <h3 className="font-bold text-white text-sm">Dados extraídos com sucesso!</h3>
            </div>

            {/* Extracted data card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              {/* Amount */}
              {result.amount !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">Valor total</span>
                  <span className="text-green-400 font-bold text-lg tabular-nums">
                    {result.currency ?? 'EUR'} {result.amount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Merchant */}
              {result.merchant && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">Comerciante</span>
                  <span className="text-white font-semibold text-sm">{result.merchant}</span>
                </div>
              )}

              {/* Date */}
              {result.date && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">Data</span>
                  <span className="text-white/80 text-sm">
                    {new Date(result.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}

              {/* Category */}
              {result.category_hint && (
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">Categoria sugerida</span>
                  <span className="text-purple-300 text-xs font-semibold bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    {result.category_hint}
                  </span>
                </div>
              )}

              {/* Items */}
              {result.items && result.items.length > 0 && (
                <div>
                  <p className="text-white/50 text-xs mb-2">Produtos detectados</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.items.slice(0, 8).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white/70 truncate flex-1 mr-2">{item.name}</span>
                        {item.price > 0 && (
                          <span className="text-white/50 tabular-nums flex-shrink-0">
                            €{item.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                    {result.items.length > 8 && (
                      <p className="text-white/30 text-xs">+{result.items.length - 8} produtos</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleUseResult}
              className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-2xl text-sm transition-all active:scale-95"
            >
              ✓ Usar estes dados
            </button>
            <button
              onClick={reset}
              className="w-full py-2 text-white/40 hover:text-white text-xs transition-colors"
            >
              Digitalizar outra fatura
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === 'error' && (
          <div className="text-center py-4 space-y-4 animate-fade-in">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <h3 className="font-bold text-white">Não foi possível processar</h3>
              <p className="text-white/50 text-xs mt-1">{errMsg}</p>
            </div>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-sm transition-all"
            >
              Tentar novamente
            </button>
            <button
              onClick={onClose}
              className="block w-full text-white/40 text-xs hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
    </div>
  )
}
