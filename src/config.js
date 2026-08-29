const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is missing.'
  )
}

export const API_BASE_URL =
  apiBaseUrl.replace(/\/+$/, '')