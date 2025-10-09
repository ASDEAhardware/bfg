import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Proxying MQTT subscriber start request to backend')

    const backendUrl = 'http://backend:8000/api/v1/mqtt/subscriber/start/'

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error) {
    console.error('❌ Proxy error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Proxy error' },
      { status: 500 }
    )
  }
}