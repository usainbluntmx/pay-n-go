export class PayNGoError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown
    ) {
        super(message);
        this.name = "PayNGoError";
    }
}

export const ERRORS = {
    NO_WALLET_CLIENT: "NO_WALLET_CLIENT",
    NO_ACCOUNT: "NO_ACCOUNT",
    LINK_NOT_FOUND: "LINK_NOT_FOUND",
    LINK_NOT_PAYABLE: "LINK_NOT_PAYABLE",
    INSUFFICIENT_ALLOWANCE: "INSUFFICIENT_ALLOWANCE",
    UNSUPPORTED_CHAIN: "UNSUPPORTED_CHAIN",
    ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
    TX_FAILED: "TX_FAILED",
} as const;