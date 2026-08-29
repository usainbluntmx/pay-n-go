import { PAYNGO_LINKS_ABI, PAYNGO_ROUTER_ABI, PAYNGO_GATEWAY_ABI } from "./constants";
import { PayNGoError } from "./errors";

// Nombres de los custom errors de Solidity definidos en PayNGoLinks.sol,
// PayNGoRouter.sol y PayNGoGateway.sol — usados como `code` de PayNGoError
// cuando se logran decodificar, para que el caller pueda distinguir
// programáticamente (`e.code === "LinkNotActive"`) en vez de tener que
// parsear el mensaje de error crudo de viem.
const KNOWN_CONTRACT_ERRORS = new Set([
    // PayNGoLinks.sol
    "TokenNotSupported", "LinkNotActive", "LinkExpired", "NotLinkCreator",
    "InvalidAmount", "InvalidRecipient", "InvalidExpiry",
    // PayNGoRouter.sol
    "RouteNotFound", "RouteNotActive", "SlippageExceeded", "DeadlineExpired",
    "OrderAlreadyExecuted", "InvalidDeadline",
    // PayNGoGateway.sol
    "InsufficientDeposit", "UserBlacklisted", "UserNotWhitelisted",
    "GasPriceTooHigh", "GasLimitExceeded", "InvalidPolicy", "TransferFailed",
    "TxAlreadyProcessed", "UnauthorizedCaller",
]);

const ALL_ABIS = [...PAYNGO_LINKS_ABI, ...PAYNGO_ROUTER_ABI, ...PAYNGO_GATEWAY_ABI];

interface DecodedRevertShape {
    data?: {
        errorName?: string;
        args?: readonly unknown[];
    };
}

interface WalkableError {
    walk: (fn: (e: unknown) => boolean) => unknown;
}

function isWalkable(error: unknown): error is WalkableError {
    return (
        typeof error === "object" &&
        error !== null &&
        "walk" in error &&
        typeof (error as { walk: unknown }).walk === "function"
    );
}

/**
 * Intenta decodificar un error lanzado por viem (típicamente de
 * writeContract/simulateContract) contra los custom errors definidos en los
 * tres contratos de PayNGo. Si lo reconoce, lanza un PayNGoError con:
 *   - code: el nombre exacto del error de Solidity (ej. "LinkNotActive")
 *   - message: mensaje legible incluyendo los argumentos del error
 *   - details: el error original de viem, para depuración
 *
 * Si no lo reconoce (error de red, revert genérico sin selector conocido,
 * etc.), relanza el error original sin envolverlo — nunca inventa un code
 * genérico que oculte información real.
 *
 * NOTA DE IMPLEMENTACIÓN (fix v0.4.2): tanto el chequeo externo
 * (`instanceof BaseError`) como el interno (`instanceof
 * ContractFunctionRevertedError`) fallaban de forma silenciosa cuando el
 * error venía de un `walletClient` creado en un módulo ESM (el script del
 * caller) mientras este código corre compilado a CommonJS — un "dual
 * package hazard": ambos contextos cargan su propia instancia de las
 * clases de viem, así que `instanceof` contra la clase importada aquí da
 * `false` aunque el objeto real sí sea (estructuralmente) del tipo
 * esperado. La función ahora detecta el error "caminable" únicamente por
 * la presencia de un método `.walk()` invocable (duck typing de punta a
 * punta, sin ningún `instanceof` contra clases de viem), inmune a en qué
 * contexto de módulo se construyó el error originalmente. Verificado
 * contra una transacción real revertida en Sepolia (LinkNotActive).
 */
export function rethrowAsPayNGoError(error: unknown): never {
    if (isWalkable(error)) {
        const revertNode = error.walk((e) => {
            const shaped = e as DecodedRevertShape;
            return typeof shaped?.data?.errorName === "string";
        }) as DecodedRevertShape | undefined;

        const errorName = revertNode?.data?.errorName;
        if (errorName && KNOWN_CONTRACT_ERRORS.has(errorName)) {
            const args = revertNode?.data?.args;
            const argsStr = args && args.length > 0 ? ` (${args.join(", ")})` : "";
            throw new PayNGoError(
                `Contract reverted: ${errorName}${argsStr}`,
                errorName,
                error
            );
        }
    }

    // No reconocido — relanzar tal cual, no inventar un code falso.
    throw error;
}

export { ALL_ABIS as PAYNGO_ALL_ABIS_FOR_ERROR_DECODING };