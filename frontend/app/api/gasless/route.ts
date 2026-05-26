import { NextRequest, NextResponse } from "next/server";
import { http } from "viem";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        const pimlicoApiKey = process.env.PIMLICO_API_KEY;
        if (!pimlicoApiKey) {
            return NextResponse.json({ error: "Missing PIMLICO_API_KEY" }, { status: 500 });
        }

        const bundlerUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${pimlicoApiKey}`;

        const pimlicoClient = createPimlicoClient({
            transport: http(bundlerUrl),
            entryPoint: {
                address: entryPoint07Address,
                version: "0.7",
            },
        });

        if (action === "getGasPrice") {
            const gasPrice = await pimlicoClient.getUserOperationGasPrice();
            return NextResponse.json({ gasPrice });
        }

        if (action === "sendUserOp") {
            const { userOp } = body;
            const userOpHash = await pimlicoClient.sendUserOperation({
                ...userOp,
                entryPoint: entryPoint07Address,
            });
            return NextResponse.json({ userOpHash });
        }

        if (action === "getReceipt") {
            const { userOpHash } = body;
            const receipt = await pimlicoClient.waitForUserOperationReceipt({
                hash: userOpHash,
            });
            return NextResponse.json({
                txHash: receipt.receipt.transactionHash,
            });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}