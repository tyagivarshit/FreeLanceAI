export class ApiError extends Error {
    statusCode;
    code;
    errors;
    constructor(message, statusCode, code, errors) {
        super(message);
        this.name = "ApiError";
        if (statusCode !== undefined)
            this.statusCode = statusCode;
        if (code !== undefined)
            this.code = code;
        if (errors !== undefined)
            this.errors = errors;
    }
}
export async function fetchJson(url, options) {
    const headers = new Headers(options?.headers);
    if (!headers.has("Content-Type") && options?.method && options.method !== "GET") {
        headers.set("Content-Type", "application/json");
    }
    const fetchInit = {
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
    let data;
    try {
        data = await response.json();
    }
    catch {
        if (!response.ok) {
            throw new ApiError(`Request failed with HTTP status ${response.status}`, response.status);
        }
        return {};
    }
    if (!response.ok) {
        const message = data.message || data.error || `HTTP error ${response.status}`;
        throw new ApiError(message, response.status, data.code, data.errors);
    }
    return data;
}
