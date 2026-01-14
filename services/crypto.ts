/**
 * Securely hashes a string using SHA-256 via the Web Crypto API.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Use the built-in SubtleCrypto API for high-performance, non-blocking hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert the buffer to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
