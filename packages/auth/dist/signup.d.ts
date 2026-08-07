import { SessionMetadata } from "./session.js";
export interface SignupInput {
    email: string;
    password: string;
    sessionMetadata?: SessionMetadata;
}
export declare class SignupError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class DuplicateEmailError extends SignupError {
    constructor();
}
export declare class ValidationError extends SignupError {
    readonly errors: string[];
    constructor(errors: string[]);
}
export declare class UserCreationError extends SignupError {
    constructor(message: string);
}
export declare class CredentialCreationError extends SignupError {
    constructor(message: string);
}
export declare class VerificationCreationError extends SignupError {
    constructor(message: string);
}
export declare class SignupTransactionError extends SignupError {
    constructor(message: string);
}
export interface RegistrationResult {
    user: {
        id: string;
        email: string;
        status: string;
        createdAt: Date;
    };
    tokens?: {
        signedAccessToken: string;
        refreshToken: string;
    };
    verificationTriggered: boolean;
}
/**
 * Orchestrates user registration according to the frozen Signup blueprint.
 */
export declare function signupUser(input: SignupInput): Promise<RegistrationResult>;
//# sourceMappingURL=signup.d.ts.map