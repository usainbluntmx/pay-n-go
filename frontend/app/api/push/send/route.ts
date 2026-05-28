import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import webpush from "web-push";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// POST /api/push/send
// Body: { title, body, address? }
// Si no hay address, se envía a todos los suscriptores (broadcast)
export async function POST(req: NextRequest) {
  try {
    const { title, body, address } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "title y body son requeridos" }, { status: 400 });
    }

    const payload = JSON.stringify({ title, body });

    if (address) {
      // Enviar a un usuario específico
      const raw = await redis.get(`push:${address.toLowerCase()}`);
      if (!raw) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 });
      }

      const subscription = typeof raw === "string" ? JSON.parse(raw) : raw;
      await webpush.sendNotification(subscription, payload);
      return NextResponse.json({ sent: 1 });
    }

    // Broadcast a todos los suscriptores
    const keys = await redis.keys("push:*");
    let sent = 0;

    await Promise.allSettled(
      keys.map(async (key) => {
        const raw = await redis.get(key);
        if (!raw) return;
        const subscription = typeof raw === "string" ? JSON.parse(raw) : raw;
        try {
          await webpush.sendNotification(subscription, payload);
          sent++;
        } catch (e: unknown) {
          // Suscripción expirada — limpiar
          if ((e as { statusCode?: number }).statusCode === 410) {
            await redis.del(key);
          }
        }
      })
    );

    return NextResponse.json({ sent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
