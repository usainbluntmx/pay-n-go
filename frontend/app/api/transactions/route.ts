import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface Transaction {
  id: string;
  type: "sent" | "received";
  counterpartAddress: string;
  counterpartHandle: string | null;
  amount: string;
  memo: string | null;
  timestamp: number;
}

const MAX_TXS = 50; // máximo por usuario

// GET /api/transactions?address=0x...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address requerida" }, { status: 400 });
  }

  try {
    const raw = await redis.get(`txs:${address.toLowerCase()}`);
    const txs: Transaction[] = raw
      ? (typeof raw === "string" ? JSON.parse(raw) : raw as Transaction[])
      : [];

    // Ordenar por más reciente primero
    txs.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ txs });
  } catch {
    return NextResponse.json({ error: "Error obteniendo historial" }, { status: 500 });
  }
}

// POST /api/transactions
// Body: { address, tx: Transaction }
export async function POST(req: NextRequest) {
  try {
    const { address, tx } = await req.json();

    if (!address || !tx) {
      return NextResponse.json({ error: "address y tx requeridos" }, { status: 400 });
    }

    const key = `txs:${address.toLowerCase()}`;
    const raw = await redis.get(key);
    const txs: Transaction[] = raw
      ? (typeof raw === "string" ? JSON.parse(raw) : raw as Transaction[])
      : [];

    // Agregar al inicio, limitar a MAX_TXS
    txs.unshift(tx);
    if (txs.length > MAX_TXS) txs.splice(MAX_TXS);

    await redis.set(key, JSON.stringify(txs), {
      ex: 60 * 60 * 24 * 90, // 90 días TTL
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error guardando transacción" }, { status: 500 });
  }
}
