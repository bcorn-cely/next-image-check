import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

// Function to truncate URL for display
export function truncateUrl(url: string, maxLength = 50) {
  if (url.length <= maxLength) return url

  // Extract domain from URL
  let domain = ""
  try {
    domain = new URL(url).hostname
  } catch (e) {
    // If URL parsing fails, just use simple truncation
    return url.substring(0, maxLength - 3) + "..."
  }

  // If the URL is very long, show domain + beginning and end
  const urlWithoutProtocol = url.replace(/^https?:\/\//, "")
  if (urlWithoutProtocol.length > maxLength) {
    return domain + "/..." + urlWithoutProtocol.slice(-20)
  }

  return url
}
