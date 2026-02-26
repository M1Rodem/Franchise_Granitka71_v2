import { clsx } from 'clsx';

export function cn(...inputs: Array<string | false | null | undefined>): string {
  return clsx(inputs);
}
