import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminAccessSettings } from '../types'
import { saveAdminSettingsAndLogout } from './adminApi'

const allowedAccess: AdminAccessSettings = {
  allowGuestEditApiUrl: true,
  allowGuestViewApiUrl: true,
  allowGuestCreateApiProfile: true,
  allowGuestEditApiProvider: false,
  allowGuestCreateCustomProvider: false,
  unifiedGuestPlannerApiUrlEnabled: false,
  unifiedGuestPlannerApiUrl: '',
  unifiedGuestImageApiUrlEnabled: false,
  unifiedGuestImageApiUrl: '',
  referenceImageUploadLimit: 16,
  modelIds: [],
  plannerModelIds: ['gpt-5.5'],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saveAdminSettingsAndLogout', () => {
  it('persists the latest guest permissions before invalidating the admin session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ adminAccess: allowedAccess }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveAdminSettingsAndLogout('admin-token', allowedAccess)

    expect(result.adminAccess.allowGuestCreateApiProfile).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/admin-api/settings')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      adminAccess: { allowGuestCreateApiProfile: true, plannerModelIds: ['gpt-5.5'] },
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/admin-api/logout')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('does not log out when the final permission save fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'save failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveAdminSettingsAndLogout('admin-token', allowedAccess)).rejects.toThrow('save failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/admin-api/settings')
  })
})
