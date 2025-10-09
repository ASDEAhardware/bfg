import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    const body = await request.text();

    const response = await apiServer({
      method: 'POST',
      url: `/api/v1/site/sites/${id}/grant_access/`,
      headers,
      data: body,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('Grant Access API Error:', error);

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