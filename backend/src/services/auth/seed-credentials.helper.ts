import { Email } from '../../domain/auth/email';
import { Password } from '../../domain/auth/password';
import { InvalidEmailError } from '../../domain/auth/errors/invalid-email.error';
import { InvalidPasswordError } from '../../domain/auth/errors/invalid-password.error';

export function parseSeedEmail(rawEmail: string): Email | null {
  try {
    return Email.create(rawEmail);
  } catch (error) {
    if (error instanceof InvalidEmailError) return null;
    throw error;
  }
}

export function parseSeedPassword(rawPassword: string): Password | null {
  try {
    return Password.create(rawPassword);
  } catch (error) {
    if (error instanceof InvalidPasswordError) return null;
    throw error;
  }
}
