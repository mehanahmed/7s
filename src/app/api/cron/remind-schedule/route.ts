import { NextResponse } from 'next/server';
import { remindActiveCrmSchedulesAction } from '@/app/(app)/dashboard/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');

        // Security check
        if (
            !process.env.CRON_SECRET ||
            secret !== process.env.CRON_SECRET &&
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            console.warn('[Cron Schedule Reminder] Unauthorized access attempt.');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron Schedule Reminder] Starting automated CR schedule reminder cron...');

        const result = await remindActiveCrmSchedulesAction();

        if (result.success) {
            console.log(`[Cron Schedule Reminder] Process completed. Reminders sent: ${result.totalRemindersSent}`);
            return NextResponse.json({
                success: true,
                message: 'Schedule reminders sent successfully',
                totalRemindersSent: result.totalRemindersSent,
                details: result.details
            });
        } else {
            console.error('[Cron Schedule Reminder] Failed:', result.error);
            return NextResponse.json({
                success: false,
                error: result.error || 'Unknown error during schedule reminder cron'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[Cron Schedule Reminder] Error in route handler:', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
