import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const siteId = resolvedParams.id;

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    const response = await apiServer({
      method: 'GET',
      url: `/api/v1/mqtt/sites/${siteId}/status/`,
      headers,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('MQTT Status API Error:', error);

    if (error.response) {
      return NextResponse.json(
        error.response.data || { error: 'MQTT Status Error' },
        { status: error.response.status }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}