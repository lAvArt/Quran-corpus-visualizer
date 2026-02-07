import { NextResponse } from 'next/server';

type FeedbackBody = {
    name?: unknown;
    email?: unknown;
    message?: unknown;
};

function normalizeField(value: unknown, maxLength: number): string {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as FeedbackBody;
        const name = normalizeField(body.name, 120);
        const email = normalizeField(body.email, 254);
        const message = normalizeField(body.message, 5000);

        // Validate
        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email address' },
                { status: 400 }
            );
        }

        const brevoApiKey = process.env.BREVO_API_KEY;
        const feedbackToEmail = process.env.FEEDBACK_TO_EMAIL || process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;
        const feedbackFromEmail = process.env.FEEDBACK_FROM_EMAIL;
        const feedbackFromName = process.env.FEEDBACK_FROM_NAME || 'Quran Corpus Visualizer';

        if (!brevoApiKey || !feedbackToEmail || !feedbackFromEmail) {
            console.error('Feedback email is not configured. Missing BREVO_API_KEY, FEEDBACK_TO_EMAIL, or FEEDBACK_FROM_EMAIL.');
            return NextResponse.json(
                { error: 'Feedback service is not configured' },
                { status: 500 }
            );
        }

        const senderName = name || 'Anonymous user';
        const textContent = [
            'New feedback submission',
            '',
            `Name: ${name || 'Anonymous'}`,
            `Email: ${email || 'Not provided'}`,
            '',
            'Message:',
            message,
        ].join('\n');

        const payload = {
            sender: { email: feedbackFromEmail, name: feedbackFromName },
            to: [{ email: feedbackToEmail }],
            subject: `Feedback from ${senderName}`,
            textContent,
            ...(email ? { replyTo: { email, name: senderName } } : {}),
        };

        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'api-key': brevoApiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!brevoResponse.ok) {
            const brevoError = await brevoResponse.text();
            console.error('Brevo email send failed:', brevoError);
            return NextResponse.json(
                { error: 'Failed to send feedback' },
                { status: 502 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Feedback error:', error);
        return NextResponse.json(
            { error: 'Failed to send feedback' },
            { status: 500 }
        );
    }
}
