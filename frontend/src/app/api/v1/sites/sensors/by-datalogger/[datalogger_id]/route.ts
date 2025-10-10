import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

async function forwardRequest(request: NextRequest, datalogger_id: string) {
  try {
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
      url: `/api/v1/site/sensors/by-datalogger/${datalogger_id}`,
      headers,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('Sensors API Error:', error);

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
  { params }: { params: Promise<{ datalogger_id: string }> }
) {
  const { datalogger_id } = await params;
  return forwardRequest(request, datalogger_id);
}