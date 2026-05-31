import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import webpush from "web-push";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { sepolia, arbitrumSepolia } from "viem/chains";

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
const MXNB = "0x82B9e52b26A2954E113F94Ff26647754d5a4247D" as Address;

const TOKEN_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getUsdcBalance(address: Address): Promise<string> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""),
  });
  const balance = await client.readContract({
    address: USDC, abi: TOKEN_ABI, functionName: "balanceOf", args: [address],
  }) as bigint;
  return formatUnits(balance, 6);
}

async function getMxnbBalance(address: Address): Promise<string> {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc"),
  });
  const balance = await client.readContract({
    address: MXNB, abi: TOKEN_ABI, functionName: "balanceOf", args: [address],
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

        // Obtener balances actuales de ambas chains en paralelo
        const [currentUsdc, currentMxnb] = await Promise.all([
          getUsdcBalance(address).catch(() => "0"),
          getMxnbBalance(address).catch(() => "0"),
        ]);

        // Obtener últimos balances conocidos
        const [lastUsdc, lastMxnb] = await Promise.all([
          redis.get(`balance:${address}`) as Promise<string | null>,
          redis.get(`balance_mxnb:${address}`) as Promise<string | null>,
        ]);

        // Guardar balances actuales para la próxima comparación
        await Promise.all([
          redis.set(`balance:${address}`, currentUsdc, { ex: 60 * 60 * 24 * 7 }),
          redis.set(`balance_mxnb:${address}`, currentMxnb, { ex: 60 * 60 * 24 * 7 }),
        ]);

        // Verificar si algún balance aumentó
        const usdcIncreased = lastUsdc && parseFloat(currentUsdc) > parseFloat(lastUsdc);
        const mxnbIncreased = lastMxnb && parseFloat(currentMxnb) > parseFloat(lastMxnb);

        if (!usdcIncreased && !mxnbIncreased) return;

        // Obtener suscripción push
        const rawSub = await redis.get(key);
        if (!rawSub) return;
        const subscription = typeof rawSub === "string" ? JSON.parse(rawSub) : rawSub;

        try {
          if (usdcIncreased) {
            const received = (parseFloat(currentUsdc) - parseFloat(lastUsdc!)).toFixed(4);
            await sendPush(subscription, "💸 Pago recibido", `Recibiste ${received} USDC en tu cuenta Pay'n Go`);
            notified++;
          }
          if (mxnbIncreased) {
            const received = (parseFloat(currentMxnb) - parseFloat(lastMxnb!)).toFixed(4);
            await sendPush(subscription, "💸 Pago recibido", `Recibiste ${received} MXNB en tu cuenta Pay'n Go`);
            notified++;
          }
        } catch (e: unknown) {
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
