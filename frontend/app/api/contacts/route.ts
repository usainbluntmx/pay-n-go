import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface Contact {
  alias: string;
  handle: string;
}

// GET /api/contacts?address=0x...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address requerida" }, { status: 400 });
  }

  try {
    const raw = await redis.get(`contacts:${address.toLowerCase()}`);
    const contacts: Contact[] = raw
      ? (typeof raw === "string" ? JSON.parse(raw) : raw as Contact[])
      : [];
    return NextResponse.json({ contacts });
  } catch {
    return NextResponse.json({ error: "Error obteniendo contactos" }, { status: 500 });
  }
}

// POST /api/contacts
// Body: { address, contacts: Contact[] }
export async function POST(req: NextRequest) {
  try {
    const { address, contacts } = await req.json();

    if (!address || !Array.isArray(contacts)) {
      return NextResponse.json({ error: "address y contacts requeridos" }, { status: 400 });
    }

    await redis.set(
      `contacts:${address.toLowerCase()}`,
      JSON.stringify(contacts),
      { ex: 60 * 60 * 24 * 365 } // 1 año TTL
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error guardando contactos" }, { status: 500 });
  }
}
