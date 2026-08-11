export interface ImageEditorResultTaskLike {
  id: string
  status: string
  outputImages: string[]
}

export interface ImageEditorResultAutoPreview {
  signature: string
  imageId: string
}

export function getPendingImageEditorResultAutoPreview(
  task: ImageEditorResultTaskLike | null,
  lastPreviewedSignature: string | null,
): ImageEditorResultAutoPreview | null {
  if (!task || task.status !== 'done' || task.outputImages.length === 0) return null

  const signature = JSON.stringify([task.id, ...task.outputImages])
  if (signature === lastPreviewedSignature) return null

  return {
    signature,
    imageId: task.outputImages[0],
  }
}
