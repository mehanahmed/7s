
import { NextResponse } from 'next/server';
import { settleAllDeliveredOrdersAction } from '@/app/(app)/dashboard/actions';

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
            console.warn('[Cron Sync] Unauthorized access attempt.');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron Sync] Starting automated courier status sync...');

        // Call the existing sync logic
        const result = await settleAllDeliveredOrdersAction();

        if (result.success) {
            console.log(`[Cron Sync] Process completed. Settled: ${result.settledCount}`);
            return NextResponse.json({
                success: true,
                message: 'Sync completed successfully',
                settledCount: result.settledCount,
                statusUpdateCount: result.statusUpdateCount
            });
        } else {
            console.error('[Cron Sync] Sync failed:', result.error);
            return NextResponse.json({
                success: false,
                error: result.error || 'Unknown error during sync'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[Cron Sync] Error in cron handler:', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: 'Internal Server Error', details: errorMessage }, { status: 500 });
    }
}
