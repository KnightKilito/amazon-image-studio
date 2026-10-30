import { describe, expect, it } from 'vitest'
import { createDefaultOpenAIProfile } from './apiProfiles'
import { validateManagedProfileDrafts } from './managedProfileValidation'

const draft = () => ({ ...createDefaultOpenAIProfile({ baseUrl: 'https://relay.example/v1', apiKey: 'test-only', model: 'image-test' }), purpose: 'image' as const, name: '管理员配置' })
describe('administrator assignment validation', () => {
  it('explains an invalid URL without including the key', () => {
    const message = validateManagedProfileDrafts([{ ...draft(), baseUrl: '123' }])
    expect(message).toContain('第 1 份生图配置')
    expect(message).toContain('完整的 HTTPS API URL')
    expect(message).not.toContain('test-only')
  })
  it.each(['http://relay.example', 'https://user:pass@relay.example', 'https://relay.example?key=secret', 'https://relay.example/#fragment'])('rejects unsafe URL %s', baseUrl => {
    expect(validateManagedProfileDrafts([{ ...draft(), baseUrl }])).toContain('API URL 必须为 HTTPS')
  })
  it('identifies incomplete other profiles, not just the selected one', () => {
    expect(validateManagedProfileDrafts([draft(), { ...draft(), purpose: 'planner', apiKey: '' }])).toContain('第 2 份策划配置')
  })
  it('requires a model and allows retaining a previously saved key', () => {
    expect(validateManagedProfileDrafts([{ ...draft(), model: ' ' }])).toContain('模型')
    expect(validateManagedProfileDrafts([{ ...draft(), apiKey: '', hasKey: true }])).toBeNull()
  })
  it('allows valid assignments and intentional revocation of all profiles', () => {
    expect(validateManagedProfileDrafts([draft()])).toBeNull()
    expect(validateManagedProfileDrafts([])).toBeNull()
  })
})
