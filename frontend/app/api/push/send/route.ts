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

// Mismo set de orígenes permitidos que /api/agent — este endpoint dispara
// notificaciones reales a usuarios reales, así que solo tu propio frontend
// puede llamarlo.
const ALLOWED_ORIGINS = [
  "https://pay-n-go-weld.vercel.app",
  "http://localhost:3000",
];

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Same-origin requests desde el propio servidor (SSR / route-to-route) no
  // mandan origin — permitir. Ver /api/agent para el mismo razonamiento.
  if (!origin && !referer) return true;

  if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed)) return true;
  if (referer && ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed))) return true;

  return false;
}

// POST /api/push/send
// Body: { title, body, address }
// `address` es OBLIGATORIA — el broadcast a todos los suscriptores se eliminó:
// nadie en el producto lo usaba (sendPushNotification siempre pasa address) y
// era un endpoint sin auth capaz de spamear a todos los usuarios de golpe.
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  try {
    const { title, body, address } = await req.json();

    if (!title || typeof title !== "string" || title.length > 100) {
      return NextResponse.json({ error: "title inválido" }, { status: 400 });
    }
    if (!body || typeof body !== "string" || body.length > 300) {
      return NextResponse.json({ error: "body inválido" }, { status: 400 });
    }
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address requerida" }, { status: 400 });
    }

    const payload = JSON.stringify({ title, body });

    const raw = await redis.get(`push:${address.toLowerCase()}`);
    if (!raw) {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    const subscription = typeof raw === "string" ? JSON.parse(raw) : raw;

    try {
      await webpush.sendNotification(subscription, payload);
    } catch (e: unknown) {
      // Suscripción expirada — limpiar
      if ((e as { statusCode?: number }).statusCode === 410) {
        await redis.del(`push:${address.toLowerCase()}`);
      }
      throw e;
    }

    return NextResponse.json({ sent: 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}