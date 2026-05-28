import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import webpush from "web-push";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { sepolia } from "viem/chains";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;

const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getUsdcBalance(address: Address): Promise<string> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""),
  });

  const balance = await publicClient.readContract({
    address: USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  }) as bigint;

  return formatUnits(balance, 6);
}

async function sendPush(subscription: object, title: string, body: string) {
  await webpush.sendNotification(
    subscription as webpush.PushSubscription,
    JSON.stringify({ title, body })
  );
}

// GET /api/cron/balance-check
// Llamado por Vercel Cron cada minuto
export async function GET(req: NextRequest) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Obtener todas las suscripciones push registradas
    const pushKeys = await redis.keys("push:*");

    if (pushKeys.length === 0) {
      return NextResponse.json({ checked: 0 });
    }

    let notified = 0;
    const results = await Promise.allSettled(
      pushKeys.map(async (key) => {
        // Extraer address del key (push:0x123...)
        const address = key.replace("push:", "") as Address;

        // Obtener balance actual de la chain
        const currentBalance = await getUsdcBalance(address);

        // Obtener último balance conocido desde Redis
        const lastBalanceKey = `balance:${address}`;
        const lastBalance = await redis.get(lastBalanceKey) as string | null;

        // Guardar balance actual para la próxima comparación
        await redis.set(lastBalanceKey, currentBalance, {
          ex: 60 * 60 * 24 * 7, // 7 días TTL
        });

        // Si no hay balance previo, es la primera vez — no notificar
        if (!lastBalance) return;

        const current = parseFloat(currentBalance);
        const previous = parseFloat(lastBalance);

        // Solo notificar si el balance aumentó
        if (current <= previous) return;

        const received = (current - previous).toFixed(4);

        // Obtener suscripción push
        const rawSub = await redis.get(key);
        if (!rawSub) return;

        const subscription = typeof rawSub === "string"
          ? JSON.parse(rawSub)
          : rawSub;

        try {
          await sendPush(
            subscription,
            "💸 Pago recibido",
            `Recibiste ${received} USDC en tu cuenta Pay'n Go`
          );
          notified++;
        } catch (e: unknown) {
          // Suscripción expirada — limpiar
          if ((e as { statusCode?: number }).statusCode === 410) {
            await redis.del(key);
          }
        }
      })
    );

    return NextResponse.json({
      checked: pushKeys.length,
      notified,
      timestamp: new Date().toISOString(),
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
