import type { AdminAccessSettings } from '../types'

const ADMIN_TOKEN_STORAGE_KEY = 'amazon-image-studio.admin-token'

export function readAdminToken() {
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function saveAdminToken(token: string) {
  try {
    if (token) window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
  } catch {
    // Admin login still works for the current page even if localStorage is blocked.
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `请求失败：${response.status}`)
  }
  return data as T
}

export async function fetchAdminSettings() {
  return requestJson<{ adminAccess: AdminAccessSettings }>('/admin-api/settings')
}

export async function loginAdmin(username: string, password: string) {
  return requestJson<{ token: string; adminAccess: AdminAccessSettings }>('/admin-api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function logoutAdmin(token: string) {
  if (!token) return
  await requestJson<{ ok: boolean }>('/admin-api/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function saveAdminSettings(token: string, adminAccess: Partial<AdminAccessSettings>) {
  return requestJson<{ adminAccess: AdminAccessSettings }>('/admin-api/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ adminAccess }),
  })
}
