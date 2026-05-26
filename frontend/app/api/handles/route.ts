import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Reglas de validación de handle
function validateHandle(handle: string): string | null {
  if (!handle) return "El handle no puede estar vacío";
  if (handle.length < 3) return "Mínimo 3 caracteres";
  if (handle.length > 20) return "Máximo 20 caracteres";
  if (!/^[a-z0-9_]+$/.test(handle)) return "Solo letras minúsculas, números y _";
  if (handle.startsWith("_") || handle.endsWith("_")) return "No puede empezar ni terminar con _";
  return null;
}

// GET /api/handles?handle=richi
// GET /api/handles?address=0x123...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  const address = searchParams.get("address");

  try {
    if (handle) {
      // Buscar address por handle
      const addr = await redis.get(`handle:${handle.toLowerCase()}`);
      if (!addr) {
        return NextResponse.json({ available: true });
      }
      return NextResponse.json({ available: false, address: addr });
    }

    if (address) {
      // Buscar handle por address
      const h = await redis.get(`address:${address.toLowerCase()}`);
      return NextResponse.json({ handle: h || null });
    }

    return NextResponse.json({ error: "Parámetro requerido: handle o address" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/handles
// Body: { handle, address }
export async function POST(req: NextRequest) {
  try {
    const { handle, address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: "Address requerida" }, { status: 400 });
    }

    const normalHandle = handle?.toLowerCase().trim();

    const validationError = validateHandle(normalHandle);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Verificar que no esté tomado
    const existing = await redis.get(`handle:${normalHandle}`);
    if (existing) {
      return NextResponse.json({ error: "Este handle ya está en uso" }, { status: 409 });
    }

    // Verificar si el address ya tiene un handle — liberarlo primero
    const normalAddress = address.toLowerCase();
    const oldHandle = await redis.get(`address:${normalAddress}`) as string | null;
    if (oldHandle) {
      await redis.del(`handle:${oldHandle}`);
    }

    // Registrar handle ↔ address (bidireccional)
    await redis.set(`handle:${normalHandle}`, address);
    await redis.set(`address:${normalAddress}`, normalHandle);

    return NextResponse.json({ success: true, handle: normalHandle, address });
  } catch (e) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/handles
// Body: { address }
export async function DELETE(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Address requerida" }, { status: 400 });
    }

    const normalAddress = address.toLowerCase();
    const handle = await redis.get(`address:${normalAddress}`) as string | null;

    if (handle) {
      await redis.del(`handle:${handle}`);
    }
    await redis.del(`address:${normalAddress}`);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
