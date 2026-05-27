import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const body = await req.json();
    console.log("[Agent API] body:", JSON.stringify(body).slice(0, 200));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log("[Agent API] response status:", response.status);
    console.log("[Agent API] response:", JSON.stringify(data).slice(0, 300));
    return NextResponse.json(data, { status: response.status });
}