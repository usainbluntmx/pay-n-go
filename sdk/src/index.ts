// Cliente principal
export { PayNGoClient } from "./client";

// Agente AI
export { PayNGoAgent } from "./agent";
export type { AgentConfig, AgentContext, AgentResult } from "./agent";

// Módulos
export { LinksModule } from "./links";
export { RouterModule } from "./router";
export { GatewayModule } from "./gateway";

// Tipos
export type {
    PayNGoConfig,
    ContractAddresses,
    PaymentLink,
    CreateLinkParams,
    CreateLinkResult,
    PayLinkResult,
    Route,
    RouteQuote,
    ExecutePaymentParams,
    ExecutePaymentResult,
    SponsorPolicy,
    GaslessPaymentParams,
    GaslessPaymentResult,
    GasCostEstimate,
    AgentPaymentSuggestion,
} from "./types";

export {
    LinkStatus,
    RouteType,
    SponsorMode,
} from "./types";

// Constantes
export {
    CONTRACT_ADDRESSES,
    CHAIN_IDS,
    PAYNGO_LINKS_ABI,
    PAYNGO_ROUTER_ABI,
    PAYNGO_GATEWAY_ABI,
} from "./constants";

// Errores
export { PayNGoError, ERRORS } from "./errors";

// Gasless module
export { GaslessModule } from "./gasless";
export type { GaslessConfig, GaslessTransferParams, GaslessTransferResult } from "./gasless";