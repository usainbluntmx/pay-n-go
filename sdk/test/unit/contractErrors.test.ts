import { BaseError, ContractFunctionRevertedError } from "viem";
import { rethrowAsPayNGoError } from "../../src/contractErrors";
import { PayNGoError } from "../../src/errors";

// rethrowAsPayNGoError filtra específicamente por
// `e instanceof ContractFunctionRevertedError` dentro de error.walk(...),
// así que el mock debe pasar instancias reales de ambas clases (BaseError
// para el error externo, ContractFunctionRevertedError para el que
// walk() debe encontrar) — no objetos planos con esa forma.
function makeRevertError(errorName: string, args: unknown[] = []): BaseError {
  const revertError = new ContractFunctionRevertedError({
    abi: [],
    functionName: "test",
    data: undefined,
  });
  // .data no es asignable por el constructor público — se fuerza aquí
  // solo para la prueba, simulando lo que viem produce al decodificar
  // un revert conocido.
  Object.defineProperty(revertError, "data", {
    value: { errorName, args, abiItem: undefined },
    writable: true,
  });

  const error = new BaseError("simulated revert");
  (error as unknown as { walk: (fn: (e: unknown) => boolean) => unknown }).walk =
    (fn: (e: unknown) => boolean) => (fn(revertError) ? revertError : undefined);
  return error;
}

describe("rethrowAsPayNGoError", () => {
  it("mapea un custom error reconocido de PayNGoLinks a PayNGoError con el code correcto", () => {
    const error = makeRevertError("LinkNotActive", [5n]);
    try {
      rethrowAsPayNGoError(error);
      fail("debió lanzar");
    } catch (e) {
      expect(e).toBeInstanceOf(PayNGoError);
      expect((e as PayNGoError).code).toBe("LinkNotActive");
      expect((e as PayNGoError).message).toContain("LinkNotActive");
    }
  });

  it("mapea un custom error de PayNGoRouter (SlippageExceeded)", () => {
    const error = makeRevertError("SlippageExceeded", [100n, 200n]);
    try {
      rethrowAsPayNGoError(error);
      fail("debió lanzar");
    } catch (e) {
      expect((e as PayNGoError).code).toBe("SlippageExceeded");
    }
  });

  it("mapea un custom error de PayNGoGateway (UnauthorizedCaller)", () => {
    const error = makeRevertError("UnauthorizedCaller", ["0xabc", "0xdef"]);
    try {
      rethrowAsPayNGoError(error);
      fail("debió lanzar");
    } catch (e) {
      expect((e as PayNGoError).code).toBe("UnauthorizedCaller");
    }
  });

  it("relanza el error original tal cual si el nombre del error no se reconoce", () => {
    const error = makeRevertError("SomeUnknownError", []);
    expect(() => rethrowAsPayNGoError(error)).toThrow();
    try {
      rethrowAsPayNGoError(error);
    } catch (e) {
      expect(e).not.toBeInstanceOf(PayNGoError);
    }
  });

  it("relanza un error que no es de viem (ej. TypeError genérico) sin envolverlo", () => {
    const error = new TypeError("algo genérico falló");
    expect(() => rethrowAsPayNGoError(error)).toThrow(TypeError);
  });
});