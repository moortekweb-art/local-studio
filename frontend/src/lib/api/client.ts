/**
 * Default API client singleton for the Local Studio controller.
 */
import { createApiClient } from "./create-api-client";
import { resolveApiServerBaseUrl } from "./connection";

// For client-side calls, use the proxy which handles authentication
// The proxy adds the API key server-side, avoiding CORS and auth issues
// NEXT_PUBLIC_BASE_PATH keeps the proxy path correct under a reverse-proxy
// path prefix (see next.config.ts basePath); unset, this stays "/api/proxy".
const isClient = typeof window !== "undefined";
const clientBaseUrl = isClient
  ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/proxy`
  : resolveApiServerBaseUrl();

const api = createApiClient({ baseUrl: clientBaseUrl, useProxy: isClient });
export default api;
