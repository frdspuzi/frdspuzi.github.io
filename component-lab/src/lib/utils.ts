import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Display-only transform for category labels (medium.json's are lowercase, youtube.json's are
// Title Case — this normalizes both to one consistent look wherever a category is shown: filter
// tabs, card badges). Never applied to the underlying value used for filtering/matching, only to
// what's rendered as text.
export function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
