/**
 * Validates that an email matches basic RFC 5322 format requirements.
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

interface NormalizationOptions {
  stripSubaddress?: boolean;
  stripDots?: boolean;
  subaddressDomains?: string[];
}

/**
 * Normalizes email address to prevent duplicate registrations.
 */
export function normalizeEmailAddress(email: string, options: NormalizationOptions = {}): string {
  const trimmed = email.trim();
  if (!isValidEmailFormat(trimmed)) {
    return trimmed.toLowerCase();
  }

  const parts = trimmed.split("@");
  let localPart = parts[0]!.toLowerCase();
  const domainPart = parts[1]!.toLowerCase();

  const stripSubaddress = options.stripSubaddress ?? true;
  const stripDots = options.stripDots ?? true;
  const subaddressDomains = options.subaddressDomains ?? ["gmail.com", "googlemail.com"];

  // Apply sub-addressing rule if enabled and the domain matches
  if (stripSubaddress && subaddressDomains.includes(domainPart)) {
    const plusIndex = localPart.indexOf("+");
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }
  }

  // Apply dot removal rule if enabled and the domain matches
  if (stripDots && subaddressDomains.includes(domainPart)) {
    localPart = localPart.replace(/\./g, "");
  }

  return `${localPart}@${domainPart}`;
}

interface PasswordValidationOptions {
  minLength: number;
  maxLength: number;
  complexityRequired: boolean;
}

/**
 * Validates a password against length and complexity parameters.
 */
export function validatePasswordStrength(
  password: string,
  options: PasswordValidationOptions,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < options.minLength) {
    errors.push(`Password must be at least ${options.minLength} characters long.`);
  }

  if (password.length > options.maxLength) {
    errors.push(`Password must not exceed ${options.maxLength} characters.`);
  }

  if (options.complexityRequired) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase) {
      errors.push("Password must contain at least one uppercase letter.");
    }
    if (!hasLowercase) {
      errors.push("Password must contain at least one lowercase letter.");
    }
    if (!hasDigit) {
      errors.push("Password must contain at least one number.");
    }
    if (!hasSpecial) {
      errors.push("Password must contain at least one special character.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
