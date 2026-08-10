import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageEditorAnnotation } from '../types'
import {
  buildImageEditPrompt,
  commitImageEditorAnnotationHistory,
  createImageEditorVisualGuideDataUrl,
  drawImageEditorAnnotations,
  findImageEditorAnnotationAtPoint,
  redoImageEditorAnnotationHistory,
  translateImageEditorAnnotation,
  undoImageEditorAnnotationHistory,
} from './imageEditorAnnotations'
import { loadImage } from './canvasImage'

vi.mock('./canvasImage', () => ({
  loadImage: vi.fn(),
}))

function annotation(
  kind: ImageEditorAnnotation['kind'],
  points: ImageEditorAnnotation['points'],
  id: string = kind,
): ImageEditorAnnotation {
  return { id, kind, points, color: '#ef4444', width: 0.0065 }
}

function createContextMock() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    ellipse: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
  } as unknown as CanvasRenderingContext2D
}

describe('image editor annotations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds stable image roles for guide, references, and style', () => {
    const prompt = buildImageEditPrompt({
      instruction: '把圈出的杯子改成蓝色',
      hasVisualGuide: true,
      referenceCount: 2,
      hasStyleReference: true,
    })

    expect(prompt).toContain('图1是必须编辑的原图')
    expect(prompt).toContain('图2是“视觉定位图”')
    expect(prompt).toContain('图3是参考图1')
    expect(prompt).toContain('图4是参考图2')
    expect(prompt).toContain('图5是风格参考图')
    expect(prompt).toContain('用户原始编辑要求：把圈出的杯子改成蓝色')
    expect(prompt).toContain('不得出现任何红、蓝、绿、黄标注线')
  })

  it('numbers references from image 2 when no guide exists', () => {
    const prompt = buildImageEditPrompt({ instruction: '替换主体', hasVisualGuide: false, referenceCount: 1 })
    expect(prompt).toContain('图2是参考图1')
    expect(prompt).not.toContain('视觉定位图')
  })

  it('hit-tests brush, rectangle, ellipse, and arrow using normalized coordinates', () => {
    const annotations = [
      annotation('brush', [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }], 'brush'),
      annotation('rectangle', [{ x: 0.4, y: 0.1 }, { x: 0.7, y: 0.4 }], 'rectangle'),
      annotation('ellipse', [{ x: 0.1, y: 0.5 }, { x: 0.4, y: 0.9 }], 'ellipse'),
      annotation('arrow', [{ x: 0.55, y: 0.65 }, { x: 0.9, y: 0.85 }], 'arrow'),
    ]

    expect(findImageEditorAnnotationAtPoint(annotations, { x: 0.2, y: 0.2 }, 1600, 900)).toBe('brush')
    expect(findImageEditorAnnotationAtPoint(annotations, { x: 0.55, y: 0.1 }, 1600, 900)).toBe('rectangle')
    expect(findImageEditorAnnotationAtPoint(annotations, { x: 0.25, y: 0.5 }, 1600, 900)).toBe('ellipse')
    expect(findImageEditorAnnotationAtPoint(annotations, { x: 0.72, y: 0.75 }, 1600, 900)).toBe('arrow')
    expect(findImageEditorAnnotationAtPoint(annotations, { x: 0.95, y: 0.05 }, 1600, 900)).toBeNull()
  })

  it('keeps moved annotations inside source bounds', () => {
    const source = annotation('rectangle', [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.8 }])
    const moved = translateImageEditorAnnotation(source, { x: 0.8, y: -0.8 })
    expect(moved.points[0].x).toBeCloseTo(0.6)
    expect(moved.points[0].y).toBeCloseTo(0)
    expect(moved.points[1].x).toBeCloseTo(1)
    expect(moved.points[1].y).toBeCloseTo(0.5)
  })

  it('renders all annotation kinds at natural pixel coordinates', () => {
    const ctx = createContextMock()
    drawImageEditorAnnotations(ctx, [
      annotation('brush', [{ x: 0.1, y: 0.2 }, { x: 0.2, y: 0.3 }]),
      annotation('rectangle', [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.7 }]),
      annotation('ellipse', [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }]),
      annotation('arrow', [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }]),
    ], 1000, 500)

    expect(ctx.strokeRect).toHaveBeenCalledWith(200, 100, 400, 250)
    expect(ctx.ellipse).toHaveBeenCalledWith(300, 150, 200, 100, 0, 0, Math.PI * 2)
    expect(ctx.lineTo).toHaveBeenCalledWith(750, 375)
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('creates a PNG guide at the source natural resolution', async () => {
    vi.mocked(loadImage).mockResolvedValue({ naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement)
    const ctx = createContextMock()
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toDataURL: vi.fn(() => 'data:image/png;base64,guide'),
    }
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })

    const result = await createImageEditorVisualGuideDataUrl('data:image/jpeg;base64,source', [
      annotation('arrow', [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }]),
    ])

    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(800)
    expect(ctx.drawImage).toHaveBeenCalled()
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
    expect(result).toBe('data:image/png;base64,guide')
    vi.unstubAllGlobals()
  })

  it('commits, erases, clears, undoes, and redoes annotation history', () => {
    const first = annotation('rectangle', [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }], 'first')
    const second = annotation('ellipse', [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }], 'second')
    let history = { current: [first, second], undoStack: [] as ImageEditorAnnotation[][], redoStack: [] as ImageEditorAnnotation[][] }

    history = commitImageEditorAnnotationHistory(history, history.current.filter((item) => item.id !== first.id))
    expect(history.current).toEqual([second])
    history = commitImageEditorAnnotationHistory(history, [])
    expect(history.current).toEqual([])
    history = undoImageEditorAnnotationHistory(history)
    expect(history.current).toEqual([second])
    history = undoImageEditorAnnotationHistory(history)
    expect(history.current).toEqual([first, second])
    history = redoImageEditorAnnotationHistory(history)
    expect(history.current).toEqual([second])
  })

  it('caps committed undo history at 50 snapshots', () => {
    const snapshots = Array.from({ length: 50 }, (_, index) => [
      annotation('brush', [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }], `snapshot-${index}`),
    ])
    const next = commitImageEditorAnnotationHistory(
      { current: snapshots[49], undoStack: snapshots, redoStack: [[snapshots[0][0]]] },
      [],
    )
    expect(next.undoStack).toHaveLength(50)
    expect(next.undoStack[0][0].id).toBe('snapshot-1')
    expect(next.redoStack).toEqual([])
  })
})
