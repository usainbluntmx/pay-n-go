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
    GaslessEligibility,
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
    TOKEN_ADDRESSES,
    CHAIN_IDS,
    PAYNGO_LINKS_ABI,
    PAYNGO_ROUTER_ABI,
    PAYNGO_GATEWAY_ABI,
} from "./constants";

// Errores
export { PayNGoError, ERRORS } from "./errors";
export { rethrowAsPayNGoError } from "./contractErrors";

// Nota: el gasless sponsorship vive en GatewayModule (client.gateway.*),
// no como módulo separado. GaslessModule nunca se implementó y se
// exportaba roto desde aquí — eliminado. Ver gateway.ts para
// executeGaslessPayment, getPolicyFor, estimateGasCost, etc.