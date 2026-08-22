import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { verifyMessage } from "viem";

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

// Mensaje canónico que el owner (EOA) debe firmar para probar que controla
// la Safe Account a la que se apunta el handle. Se firma con la EOA porque
// las Safe Accounts no pueden hacer personal_sign directo (requerirían
// verificación EIP-1271 on-chain) — el mismo patrón que ya usa PayNGoGateway,
// donde el owner firma y la Safe es solo el destino de fondos.
function buildRegisterMessage(handle: string, smartAccountAddress: string, timestamp: number): string {
  return `payngo:register-handle\nhandle: ${handle}\nsmartAccount: ${smartAccountAddress.toLowerCase()}\ntimestamp: ${timestamp}`;
}

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos

// GET /api/handles?handle=richi
// GET /api/handles?address=0x123...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  const address = searchParams.get("address");

  try {
    if (handle) {
      const addr = await redis.get(`handle:${handle.toLowerCase()}`);
      if (!addr) {
        return NextResponse.json({ available: true });
      }
      return NextResponse.json({ available: false, address: addr });
    }

    if (address) {
      const h = await redis.get(`address:${address.toLowerCase()}`);
      return NextResponse.json({ handle: h || null });
    }

    return NextResponse.json({ error: "Parámetro requerido: handle o address" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/handles
// Body: { handle, address, ownerAddress, signature, timestamp }
// `address` = Safe Smart Account (destino final de los pagos, se guarda en Redis)
// `ownerAddress` = EOA derivada del mnemónico, la que realmente firma
// `signature` debe ser la firma (personal_sign / EIP-191) de `ownerAddress`
// sobre el mensaje canónico. Sin ella, no se registra.
export async function POST(req: NextRequest) {
  try {
    const { handle, address, ownerAddress, signature, timestamp } = await req.json();

    if (!address) {
      return NextResponse.json({ error: "Address requerida" }, { status: 400 });
    }
    if (!ownerAddress) {
      return NextResponse.json({ error: "ownerAddress requerida" }, { status: 400 });
    }
    if (!signature || typeof signature !== "string") {
      return NextResponse.json({ error: "Firma requerida" }, { status: 400 });
    }
    if (!timestamp || typeof timestamp !== "number") {
      return NextResponse.json({ error: "Timestamp requerido" }, { status: 400 });
    }

    const normalHandle = handle?.toLowerCase().trim();

    const validationError = validateHandle(normalHandle);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Ventana de validez — evita reutilizar una firma capturada hace tiempo
    if (Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
      return NextResponse.json({ error: "Firma expirada, intenta de nuevo" }, { status: 401 });
    }

    // Verificar que quien firma es el owner de la Safe Account `address`
    const message = buildRegisterMessage(normalHandle, address, timestamp);
    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: ownerAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      return NextResponse.json({ error: "Firma inválida — no controlas esta cuenta" }, { status: 401 });
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
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/handles
// Body: { address, ownerAddress, signature, timestamp }
// También requiere firma del owner — sin esto, cualquiera podía liberar el handle de otro usuario.
export async function DELETE(req: NextRequest) {
  try {
    const { address, ownerAddress, signature, timestamp } = await req.json();
    if (!address) {
      return NextResponse.json({ error: "Address requerida" }, { status: 400 });
    }
    if (!ownerAddress) {
      return NextResponse.json({ error: "ownerAddress requerida" }, { status: 400 });
    }
    if (!signature || typeof signature !== "string" || !timestamp) {
      return NextResponse.json({ error: "Firma requerida" }, { status: 400 });
    }

    if (Math.abs(Date.now() - timestamp) > SIGNATURE_MAX_AGE_MS) {
      return NextResponse.json({ error: "Firma expirada, intenta de nuevo" }, { status: 401 });
    }

    const normalAddress = address.toLowerCase();
    const message = `payngo:unregister-handle\nsmartAccount: ${normalAddress}\ntimestamp: ${timestamp}`;

    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: ownerAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      return NextResponse.json({ error: "Firma inválida — no controlas esta cuenta" }, { status: 401 });
    }

    const handle = await redis.get(`address:${normalAddress}`) as string | null;

    if (handle) {
      await redis.del(`handle:${handle}`);
    }
    await redis.del(`address:${normalAddress}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}