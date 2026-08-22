import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Configuración ────────────────────────────────────────────

// Dominios desde los que se permite llamar este endpoint
const ALLOWED_ORIGINS = [
  "https://pay-n-go-weld.vercel.app",
  "http://localhost:3000",
];

// Rate limit: máximo N requests por IP cada ventana de tiempo
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Único modelo permitido — nunca confiar en el modelo que mande el cliente
const ALLOWED_MODEL = "claude-sonnet-4-20250514";
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