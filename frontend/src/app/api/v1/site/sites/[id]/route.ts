import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

async function forwardRequest(request: NextRequest, id: string, action?: string) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    const endpoint = action ? `/api/v1/site/sites/${id}/${action}/` : `/api/v1/site/sites/${id}/`;

    let body;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      body = await request.text();
    }

    const response = await apiServer({
      method: request.method,
      url: endpoint,
      headers,
      data: body,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('Site API Error:', error);

    if (error.response) {
      return NextResponse.json(
        error.response.data || { error: 'API Error' },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return forwardRequest(request, id);
}