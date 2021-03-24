import { ImageCanvasEvent } from './image-canvas-event'
import { SerializedImageCanvasModel } from './image-canvas'

export type Event =
	| { kind: 'imageCanvasEvent'; value: ImageCanvasEvent }
	| { kind: 'dataSent'; value: SerializedImageCanvasModel }
