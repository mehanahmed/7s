
// /src/app/api/webhooks/packzy/route.ts

import { NextResponse } from 'next/server';
import { getOrderByTrackingCode, autoSettleOrderIfDelivered } from '@/lib/order-service';
import { getUsers } from '@/lib/user-service';


export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const secret = process.env.PACKZY_WEBHOOK_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      console.warn('[Packzy Webhook] Unauthorized access attempt.');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('[Packzy Webhook] Received payload:', payload);

    const { tracking_code, delivery_status, consignment_id } = payload;

    if (!tracking_code || !delivery_status) {
      return NextResponse.json({ success: false, error: 'Missing tracking_code or delivery_status in payload' }, { status: 400 });
    }

    const order = await getOrderByTrackingCode(tracking_code);

    if (!order) {
      console.log(`[Packzy Webhook] Order with tracking code ${tracking_code} not found.`);
      return NextResponse.json({ success: true, message: 'Webhook acknowledged, order not found.' });
    }

    if (delivery_status.toLowerCase() === 'delivered') {
      const allUsers = await getUsers();
      const systemAdmin = allUsers.find(u => u.role === 'SYSTEM_ADMIN');
      if (!systemAdmin) {
        console.error(`[Packzy Webhook] CRITICAL: System Admin user not found. Cannot perform settlement for order ${order.id}.`);
        return NextResponse.json({ success: false, error: 'System configuration error: admin user not found.' }, { status: 500 });
      }

      console.log(`[Packzy Webhook] Order ${order.id} is delivered. Triggering auto-settlement.`);
      
      const settlementReason = `Order delivered. Status updated via SteadFast webhook. Consignment ID: ${consignment_id || 'N/A'}.`;
      
      const success = await autoSettleOrderIfDelivered(
        order.id, 
        settlementReason, 
        { id: systemAdmin.id, name: systemAdmin.name }
      );

      if (!success) {
         console.error(`[Packzy Webhook] Auto-settlement failed for order ${order.id}.`);
      }
    } else {
      console.log(`[Packzy Webhook] Received non-delivered status '${delivery_status}' for order ${order.id}. No action taken.`);
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('[Packzy Webhook] Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ success: false, error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
