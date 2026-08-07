/**
 * Validates that an email matches basic RFC 5322 format requirements.
 */
export declare function isValidEmailFormat(email: string): boolean;
interface NormalizationOptions {
    stripSubaddress?: boolean;
    stripDots?: boolean;
    subaddressDomains?: string[];
}
/**
 * Normalizes email address to prevent duplicate registrations.
 */
export declare function normalizeEmailAddress(email: string, options?: NormalizationOptions): string;
interface PasswordValidationOptions {
    minLength: number;
    maxLength: number;
    complexityRequired: boolean;
}
/**
 * Validates a password against length and complexity parameters.
 */
export declare function validatePasswordStrength(password: string, options: PasswordValidationOptions): {
    isValid: boolean;
    errors: string[];
};
export {};
//# sourceMappingURL=validation.d.ts.map