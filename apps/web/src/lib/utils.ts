import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "₹449", "₹449.10" — never "₹449.1". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
