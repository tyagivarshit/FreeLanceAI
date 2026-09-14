// Authoritative extension configuration
// Manages environmental origins and blocks credential packaging.
const API_ENDPOINTS = {
    development: "http://localhost:4000",
    staging: "https://staging-api.freelanceos.com",
    production: "https://api.freelanceos.com",
};
// Authoritative environment pointer
// Build validations will block this from referencing localhost if env is not development
const CURRENT_ENV = "development";
export const config = {
    env: CURRENT_ENV,
    apiUrl: API_ENDPOINTS[CURRENT_ENV],
};
