
import { NextRequest, NextResponse } from 'next/server';
import { apiServer } from '@/lib/axios-server';
import { cookies } from 'next/headers';
import axios from 'axios';

export async function GET(request: NextRequest) {
    const accessToken = (await cookies()).get('access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Token not found in cookies' }, { status: 401 });
    }

    try {
        const djangoResponse = await apiServer.get('api/v1/user/preferences/', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        return NextResponse.json(djangoResponse.data, { status: djangoResponse.status });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json(error.response.data, {
                status: error.response.status,
            });
        }

        console.error("Error fetching preferences:", error);
        return NextResponse.json(
            { error: 'Internal server error.' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    const accessToken = (await cookies()).get('access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Token not found in cookies' }, { status: 401 });
    }

    try {
        const payload = await request.json();

        const djangoResponse = await apiServer.patch('api/v1/user/preferences/', payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        return NextResponse.json(djangoResponse.data, { status: djangoResponse.status });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            return NextResponse.json(error.response.data, {
                status: error.response.status,
            });
        }

        console.error("Error updating preferences:", error);
        return NextResponse.json(
            { error: 'Internal server error.' },
            { status: 500 }
        );
    }
}
