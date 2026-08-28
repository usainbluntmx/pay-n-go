/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  // Solo corre tests unitarios por default — los de integración (contra
  // Sepolia real, requieren wallet fondeada) viven en test/integration/ y
  // se corren aparte con `npm run test:integration`.
  testMatch: ["**/test/unit/**/*.test.ts"],
  clearMocks: true,
};
