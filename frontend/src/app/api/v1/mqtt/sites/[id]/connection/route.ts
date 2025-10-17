import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const cookieStore = cookies();

    // Get auth cookies
    const accessToken = cookieStore.get('access_token');
    const refreshToken = cookieStore.get('refresh_token');
    const sessionId = cookieStore.get('sessionid');

    // Prepare headers for Django backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth cookies to the request
    const cookieHeader = [];
    if (accessToken) cookieHeader.push(`access_token=${accessToken.value}`);
    if (refreshToken) cookieHeader.push(`refresh_token=${refreshToken.value}`);
    if (sessionId) cookieHeader.push(`sessionid=${sessionId.value}`);

    if (cookieHeader.length > 0) {
      headers['Cookie'] = cookieHeader.join('; ');
    }

    console.log(`🔧 MQTT Control Proxy: ${body.action} for site ${params.id}`);
    console.log(`🔗 Backend URL: ${process.env.DJANGO_API_URL}`);

    // Forward request to Django backend
    const backendUrl = `${process.env.DJANGO_API_URL}/api/v1/mqtt/sites/${params.id}/connection/`;
    console.log(`📡 Full URL: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    console.log(`📊 Response status: ${response.status}`);

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`❌ MQTT Control Backend Error: ${response.status}`, responseData);
      return NextResponse.json(responseData, { status: response.status });
    }

    console.log(`✅ MQTT Control Success: ${responseData.action} for ${responseData.site_name}`);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ MQTT Control Proxy Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}