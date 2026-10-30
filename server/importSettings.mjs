import { readFileSync } from 'node:fs'
import { createPlatformStore } from './platformStore.mjs'
import { readPlatformConfig } from './platformServer.mjs'

const filename = process.argv[2]
if (!filename) throw new Error('Usage: npm run platform:import-settings -- path/to/admin-access.json (stop the platform service first)')
const config = readPlatformConfig()
const input = JSON.parse(readFileSync(filename, 'utf8'))
const source = input.adminAccess || input
const permitted = ['allowGuestEditApiUrl', 'allowGuestViewApiUrl', 'allowGuestCreateApiProfile', 'allowGuestEditApiProvider', 'allowGuestCreateCustomProvider', 'unifiedGuestPlannerApiUrlEnabled', 'unifiedGuestPlannerApiUrl', 'unifiedGuestImageApiUrlEnabled', 'unifiedGuestImageApiUrl', 'referenceImageUploadLimit', 'modelIds', 'plannerModelIds']
if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Expected an admin_access JSON object')
const settings = Object.fromEntries(Object.entries(source).filter(([key]) => permitted.includes(key)))
if (!Object.keys(settings).length) throw new Error('No recognized settings; nothing imported')
const store = createPlatformStore(config.database, config.encryptionKey)
try {
  if (Object.keys(store.settings()).length) throw new Error('Existing settings found; refusing to overwrite. Back up and use the authenticated administrator UI.')
  store.setSettings(settings)
  store.audit(0, 'settings.import')
  console.log('Settings imported. Old database and credentials were not modified.')
} finally { store.close() }
