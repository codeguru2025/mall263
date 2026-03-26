import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

export function formatPhone(phone: string) {
  if (phone.startsWith('+263')) {
    return phone.replace(/(\+263)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  }
  return phone;
}

export function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
