// IP del cliente, para el rate limiting por IP.
//
// ⚠️ De qué nos podemos fiar: el navegador puede mandar CUALQUIER encabezado, incluido un
// X-Forwarded-For falso. En Vercel no importa: la plataforma sobrescribe ese encabezado con la IP
// real antes de que llegue a la app. Si algún día la app corre detrás de otro proxy, hay que
// revisar qué encabezado escribe ese proxy. En local no hay proxy: llega vacío o "::1".
//
// Por eso la IP es una capa EXTRA: el límite principal es por usuario, y ese sale de la sesión,
// que el cliente no puede falsificar.
export function clientIp(headers: Headers): string | null {
  // "cliente, proxy1, proxy2": el primero es el cliente original.
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}
