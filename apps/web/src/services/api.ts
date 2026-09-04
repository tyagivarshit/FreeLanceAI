export class ApiError extends Error {
  statusCode?: number;
  code?: string;
  errors?: string[];

  constructor(message: string, statusCode?: number, code?: string, errors?: string[]) {
    super(message);
    this.name = "ApiError";
    if (statusCode !== undefined) this.statusCode = statusCode;
    if (code !== undefined) this.code = code;
    if (errors !== undefined) this.errors = errors;
  }
}

export interface FetchOptions extends Omit<RequestInit, "signal"> {
  signal?: AbortSignal | null;
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type") && options?.method && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const fetchInit: RequestInit = {
    ...options,
    headers,
  };
  if (options?.signal) {
    fetchInit.signal = options.signal;
  }

  const response = await fetch(url, fetchInit);

  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || data.error || "Unauthorized", 401, data.code);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(`Request failed with HTTP status ${response.status}`, response.status);
    }
    return {} as T;
  }

  if (!response.ok) {
    const message = data.message || data.error || `HTTP error ${response.status}`;
    throw new ApiError(message, response.status, data.code, data.errors);
  }

  return data as T;
}
