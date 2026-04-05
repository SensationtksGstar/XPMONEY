import { NextResponse } from 'next/server'

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

export function demoResponse(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}
