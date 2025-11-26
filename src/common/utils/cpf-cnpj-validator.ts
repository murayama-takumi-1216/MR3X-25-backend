/**
 * CPF/CNPJ Validator with 2026 Alphanumeric CNPJ Support
 * Supports traditional numeric CNPJs and new alphanumeric format (IN RFB 2.229/2024)
 */

export interface ValidationResult {
  isValid: boolean;
  formatted: string;
  type: 'CPF' | 'CNPJ' | 'CNPJ_ALPHANUMERIC' | 'UNKNOWN';
  error?: string;
}

// Clean document - remove formatting characters
function cleanDocument(doc: string): string {
  return doc.replace(/[.\-\/\s]/g, '').toUpperCase();
}

// Check if all characters are the same (invalid documents)
function allSameDigits(str: string): boolean {
  return str.split('').every(char => char === str[0]);
}

// CPF Validation (11 numeric digits)
export function validateCPF(cpf: string): ValidationResult {
  const cleaned = cleanDocument(cpf);

  if (cleaned.length !== 11) {
    return { isValid: false, formatted: cpf, type: 'CPF', error: 'CPF must have 11 digits' };
  }

  if (!/^\d{11}$/.test(cleaned)) {
    return { isValid: false, formatted: cpf, type: 'CPF', error: 'CPF must contain only numbers' };
  }

  if (allSameDigits(cleaned)) {
    return { isValid: false, formatted: cpf, type: 'CPF', error: 'Invalid CPF (repeated digits)' };
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) {
    return { isValid: false, formatted: cpf, type: 'CPF', error: 'Invalid CPF check digit' };
  }

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) {
    return { isValid: false, formatted: cpf, type: 'CPF', error: 'Invalid CPF check digit' };
  }

  return {
    isValid: true,
    formatted: formatCPF(cleaned),
    type: 'CPF',
  };
}

// Traditional CNPJ Validation (14 numeric digits)
function validateTraditionalCNPJ(cnpj: string): ValidationResult {
  const cleaned = cleanDocument(cnpj);

  if (cleaned.length !== 14) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ', error: 'CNPJ must have 14 digits' };
  }

  if (!/^\d{14}$/.test(cleaned)) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ', error: 'Traditional CNPJ must contain only numbers' };
  }

  if (allSameDigits(cleaned)) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ', error: 'Invalid CNPJ (repeated digits)' };
  }

  // Weights for CNPJ calculation
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (digit1 !== parseInt(cleaned[12])) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ', error: 'Invalid CNPJ check digit' };
  }

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  if (digit2 !== parseInt(cleaned[13])) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ', error: 'Invalid CNPJ check digit' };
  }

  return {
    isValid: true,
    formatted: formatCNPJ(cleaned),
    type: 'CNPJ',
  };
}

// Convert alphanumeric character to numeric value (ASCII-48 for letters)
function alphanumericToValue(char: string): number {
  const code = char.charCodeAt(0);
  // Numbers 0-9 (ASCII 48-57) -> 0-9
  if (code >= 48 && code <= 57) {
    return code - 48;
  }
  // Letters A-Z (ASCII 65-90) -> 17-42 (65-48=17)
  if (code >= 65 && code <= 90) {
    return code - 48;
  }
  return 0;
}

// Alphanumeric CNPJ Validation (2026 Format)
// Format: 12 alphanumeric chars + 2 numeric check digits
function validateAlphanumericCNPJ(cnpj: string): ValidationResult {
  const cleaned = cleanDocument(cnpj);

  if (cleaned.length !== 14) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ_ALPHANUMERIC', error: 'CNPJ must have 14 characters' };
  }

  // First 12 chars can be alphanumeric, last 2 must be numeric
  const base = cleaned.substring(0, 12);
  const checkDigits = cleaned.substring(12, 14);

  if (!/^[A-Z0-9]{12}$/.test(base)) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ_ALPHANUMERIC', error: 'Invalid alphanumeric CNPJ format' };
  }

  if (!/^\d{2}$/.test(checkDigits)) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ_ALPHANUMERIC', error: 'Check digits must be numeric' };
  }

  // Weights for alphanumeric CNPJ (same as traditional)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += alphanumericToValue(base[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (digit1 !== parseInt(checkDigits[0])) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ_ALPHANUMERIC', error: 'Invalid CNPJ check digit' };
  }

  // Calculate second check digit (include first check digit)
  sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += alphanumericToValue(base[i]) * weights2[i];
  }
  sum += digit1 * weights2[12];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  if (digit2 !== parseInt(checkDigits[1])) {
    return { isValid: false, formatted: cnpj, type: 'CNPJ_ALPHANUMERIC', error: 'Invalid CNPJ check digit' };
  }

  return {
    isValid: true,
    formatted: formatAlphanumericCNPJ(cleaned),
    type: 'CNPJ_ALPHANUMERIC',
  };
}

// Main CNPJ validator - auto-detects format
export function validateCNPJ(cnpj: string): ValidationResult {
  const cleaned = cleanDocument(cnpj);

  if (cleaned.length !== 14) {
    return { isValid: false, formatted: cnpj, type: 'UNKNOWN', error: 'CNPJ must have 14 characters' };
  }

  // Check if it's traditional (all numeric) or alphanumeric
  const isAllNumeric = /^\d{14}$/.test(cleaned);

  if (isAllNumeric) {
    return validateTraditionalCNPJ(cnpj);
  } else {
    return validateAlphanumericCNPJ(cnpj);
  }
}

// Auto-detect and validate document (CPF or CNPJ)
export function validateDocument(document: string): ValidationResult {
  const cleaned = cleanDocument(document);

  if (cleaned.length === 11 && /^\d{11}$/.test(cleaned)) {
    return validateCPF(document);
  }

  if (cleaned.length === 14) {
    return validateCNPJ(document);
  }

  return {
    isValid: false,
    formatted: document,
    type: 'UNKNOWN',
    error: 'Document must be a valid CPF (11 digits) or CNPJ (14 characters)',
  };
}

// Formatting functions
export function formatCPF(cpf: string): string {
  const cleaned = cleanDocument(cpf);
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
}

export function formatAlphanumericCNPJ(cnpj: string): string {
  const cleaned = cleanDocument(cnpj);
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
}

// Test data generators
export function generateTestCPF(): string {
  // Generate 9 random digits
  const digits: number[] = [];
  for (let i = 0; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  digits.push(remainder === 10 || remainder === 11 ? 0 : remainder);

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  remainder = (sum * 10) % 11;
  digits.push(remainder === 10 || remainder === 11 ? 0 : remainder);

  return formatCPF(digits.join(''));
}

export function generateTestCNPJ(): string {
  // Generate 8 random digits + 0001 (branch)
  const digits: number[] = [];
  for (let i = 0; i < 8; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }
  digits.push(0, 0, 0, 1); // Standard branch number

  // Weights for CNPJ
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * weights1[i];
  }
  let remainder = sum % 11;
  digits.push(remainder < 2 ? 0 : 11 - remainder);

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += digits[i] * weights2[i];
  }
  remainder = sum % 11;
  digits.push(remainder < 2 ? 0 : 11 - remainder);

  return formatCNPJ(digits.join(''));
}

export function generateTestAlphanumericCNPJ(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let base = '';

  // Generate 12 random alphanumeric characters
  for (let i = 0; i < 12; i++) {
    base += chars[Math.floor(Math.random() * chars.length)];
  }

  // Weights for CNPJ
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += alphanumericToValue(base[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += alphanumericToValue(base[i]) * weights2[i];
  }
  sum += digit1 * weights2[12];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return formatAlphanumericCNPJ(base + digit1.toString() + digit2.toString());
}
