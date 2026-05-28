import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// POST /api/push/subscribe
// Body: { subscription: PushSubscription, address: string }
export async function POST(req: NextRequest) {
  try {
    const { subscription, address } = await req.json();
    if (!subscription || !address) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    // Guardar suscripción asociada a la Smart Account address
    await redis.set(
      `push:${address.toLowerCase()}`,
      JSON.stringify(subscription),
      { ex: 60 * 60 * 24 * 30 } // 30 días TTL
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error guardando suscripción" }, { status: 500 });
  }
}

// DELETE /api/push/subscribe
// Body: { address: string }
export async function DELETE(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: "Address requerida" }, { status: 400 });
    await redis.del(`push:${address.toLowerCase()}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}
