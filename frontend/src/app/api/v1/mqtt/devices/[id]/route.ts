import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

async function forwardRequest(request: NextRequest, datalogger_id: string, endpoint: string = '') {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const fullEndpoint = searchParams ? `${endpoint}?${searchParams}` : endpoint;

    let body;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      body = await request.text();
    }

    const response = await apiServer({
      method: request.method,
      url: `/api/v1/mqtt/devices/${datalogger_id}/${fullEndpoint}`,
      headers,
      data: body,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('MQTT Device API Error:', error);

    if (error.response) {
      return NextResponse.json(
        error.response.data || { error: 'MQTT Device API Error' },
        { status: error.response.status }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardRequest(request, id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardRequest(request, id);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardRequest(request, id);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardRequest(request, id);
}