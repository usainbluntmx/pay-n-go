import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Configuración ────────────────────────────────────────────

// Dominios de producción permitidos para llamar este endpoint.
// El desarrollo local (cualquier puerto de localhost/127.0.0.1) se
// maneja aparte en isAllowedOrigin() y nunca se activa en producción.
const ALLOWED_ORIGINS = [
  "https://pay-n-go-weld.vercel.app",
];

// Rate limit: máximo N requests por IP cada ventana de tiempo
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Único modelo permitido — nunca confiar en el modelo que mande el cliente.
// claude-sonnet-4-20250514 fue descontinuado por Anthropic (devolvía 404
// "not_found_error" en /v1/messages, no un 404 de ruta). Actualizado a un
// snapshot con fecha fija — evita romperse otra vez si Anthropic libera
// nuevas versiones bajo un alias que sí se mueve solo.
const ALLOWED_MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS_CAP = 1024;

// ─── Helpers ──────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Same-origin requests desde el propio servidor (SSR) no mandan origin — permitir
  if (!origin && !referer) return true;

  // En desarrollo local, Next.js puede elegir cualquier puerto libre
  // (3000, 3001, ...) si el 3000 está ocupado por otro proceso — aceptar
  // cualquier localhost/127.0.0.1 evita tener que perseguir el puerto
  // exacto cada vez. Esto NUNCA se activa en producción (NODE_ENV
  // "production" en Vercel), donde ALLOWED_ORIGINS sigue siendo estricto.
  if (process.env.NODE_ENV !== "production") {
    const isLocalOrigin = (value: string | null) =>
      !!value && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(value);
    if (isLocalOrigin(origin) || isLocalOrigin(referer)) return true;
  }

  if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed)) return true;
  if (referer && ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed))) return true;

  return false;
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `ratelimit:agent:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count <= RATE_LIMIT_MAX;
}

// Valida que el body tenga EXACTAMENTE la forma que useAgent.ts envía —
// nunca reenviar el body del cliente tal cual a Anthropic
function buildSafePayload(body: unknown): { system?: string; messages: unknown[] } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.messages) || b.messages.length === 0) return null;
  if (b.messages.length > 1) return null; // el frontend solo manda 1 mensaje de usuario

  const msg = b.messages[0];
  if (
    typeof msg !== "object" || msg === null ||
    (msg as Record<string, unknown>).role !== "user" ||
    typeof (msg as Record<string, unknown>).content !== "string"
  ) {
    return null;
  }

  // Límite de tamaño razonable para una instrucción de pago
  const content = (msg as Record<string, unknown>).content as string;
  if (content.length > 2000) return null;

  if (typeof b.system !== "string" || b.system.length > 8000) return null;

  return {
    system: b.system,
    messages: [{ role: "user", content }],
  };
}

// ─── Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Verificar origen
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  // 2. Rate limit por IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      { status: 429 }
    );
  }

  // 3. Validar y sanear el payload — nunca confiar en el body del cliente
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const safePayload = buildSafePayload(rawBody);
  if (!safePayload) {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  // 4. Llamar a Anthropic con parámetros fijos por el servidor, no por el cliente
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        max_tokens: MAX_TOKENS_CAP,
        system: safePayload.system,
        messages: safePayload.messages,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 502 });
  }
}