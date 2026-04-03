'use client'

// Toaster minimalista — substituir por shadcn/ui Toast quando instalado
export function Toaster() {
  return <div id="toast-portal" className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" />
}
