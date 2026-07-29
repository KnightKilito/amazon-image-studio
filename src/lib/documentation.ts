import { parse } from 'yaml'

export interface DocumentationDocument {
  id: string
  title: string
  navTitle: string
  description: string
  eyebrow: string
  icon: string
  order: number
  tags: string[]
  content: string
  sourcePath: string
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(metadata: Record<string, unknown>, key: string, sourcePath: string) {
  const value = metadata[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Documentation file ${sourcePath} requires a non-empty "${key}" field.`)
  }
  return value.trim()
}

function optionalString(metadata: Record<string, unknown>, key: string, fallback: string, sourcePath: string) {
  const value = metadata[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') {
    throw new Error(`Documentation file ${sourcePath} field "${key}" must be a string.`)
  }
  return value.trim() || fallback
}

export function parseDocumentationFile(source: string, sourcePath: string): DocumentationDocument {
  const match = source.match(FRONT_MATTER_PATTERN)
  if (!match) {
    throw new Error(`Documentation file ${sourcePath} must start with YAML Front Matter.`)
  }

  const parsedMetadata: unknown = parse(match[1])
  if (!isRecord(parsedMetadata)) {
    throw new Error(`Documentation file ${sourcePath} Front Matter must be a YAML object.`)
  }

  const id = requiredString(parsedMetadata, 'id', sourcePath)
  const title = requiredString(parsedMetadata, 'title', sourcePath)
  const description = requiredString(parsedMetadata, 'description', sourcePath)
  const orderValue = parsedMetadata.order
  const tagsValue = parsedMetadata.tags

  if (typeof orderValue !== 'number' || !Number.isFinite(orderValue)) {
    throw new Error(`Documentation file ${sourcePath} field "order" must be a number.`)
  }
  if (tagsValue !== undefined && (!Array.isArray(tagsValue) || tagsValue.some((tag) => typeof tag !== 'string'))) {
    throw new Error(`Documentation file ${sourcePath} field "tags" must be a string array.`)
  }

  return {
    id,
    title,
    navTitle: optionalString(parsedMetadata, 'navTitle', title, sourcePath),
    description,
    eyebrow: optionalString(parsedMetadata, 'eyebrow', '使用文档', sourcePath),
    icon: optionalString(parsedMetadata, 'icon', 'book', sourcePath),
    order: orderValue,
    tags: tagsValue ? tagsValue.map((tag) => tag.trim()).filter(Boolean) : [],
    content: source.slice(match[0].length).trim(),
    sourcePath,
  }
}

const markdownModules = import.meta.glob<string>('../docs/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const documentationDocuments = Object.entries(markdownModules)
  .map(([sourcePath, source]) => parseDocumentationFile(source, sourcePath))
  .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, 'zh-CN'))

const duplicateIds = documentationDocuments
  .map((document) => document.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index)

if (duplicateIds.length > 0) {
  throw new Error(`Documentation ids must be unique. Duplicates: ${[...new Set(duplicateIds)].join(', ')}`)
}

if (documentationDocuments.length === 0) {
  throw new Error('No documentation files were found in src/docs.')
}
