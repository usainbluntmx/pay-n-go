// ─── Cifrado de identidad ───────────────────────────────────────
// Usa Web Crypto API nativa (AES-GCM + PBKDF2) para cifrar mnemonic/privateKey
// antes de guardarlos en localStorage. Sin esto, cualquier XSS puede leer la
// identidad completa en texto plano y drenar la wallet.
//
// La contraseña del usuario NUNCA se guarda — solo se usa para derivar la key
// de cifrado en el momento. La key derivada vive solo en memoria (React state)
// durante la sesión, nunca en localStorage.

const PBKDF2_ITERATIONS = 250_000; // costo alto a propósito — dificulta fuerza bruta
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // recomendado para AES-GCM

export interface EncryptedPayload {
  ciphertext: string; // base64
  salt: string;       // base64
  iv: string;          // base64
  version: 1;
}

// ─── Helpers de codificación ─────────────────────────────────────

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Derivación de key desde password ────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // no extraíble — la key nunca sale del contexto de crypto.subtle
    ["encrypt", "decrypt"]
  );
}

// ─── Cifrar ───────────────────────────────────────────────────────

export async function encryptWithPassword(
  plaintext: string,
  password: string
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuf),
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    version: 1,
  };
}

// ─── Descifrar ────────────────────────────────────────────────────
// Lanza un error si la contraseña es incorrecta (AES-GCM falla la
// verificación de integridad) — el caller debe capturarlo y mostrar
// un mensaje claro, nunca asumir éxito silencioso.

export async function decryptWithPassword(
  payload: EncryptedPayload,
  password: string
): Promise<string> {
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.ciphertext);
  const key = await deriveKey(password, salt);

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBuf);
}

// ─── Validación de fuerza mínima ───────────────────────────────────
// No es un validador de fuerza real (eso requeriría zxcvbn o similar),
// solo un piso razonable para no permitir contraseñas triviales.

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return "Mínimo 8 caracteres";
  if (password.length > 128) return "Máximo 128 caracteres";
  return null;
}