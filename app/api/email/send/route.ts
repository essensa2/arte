import { NextResponse } from 'next/server';
import { sendEmail, SendEmailOptions } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json() as SendEmailOptions;
    
    // Validate required fields
    if (!body.to || !body.subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to and subject are required' },
        { status: 400 }
      );
    }

    // Send email
    const result = await sendEmail(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

