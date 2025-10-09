import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
      url: '/api/v1/site/sites/user_sites/',
      headers,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error('User Sites API Error:', error);

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