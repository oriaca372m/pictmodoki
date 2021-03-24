import { LayerId, LayerDrawCommand } from './layer'
import { ImageCanvasEventId } from './image-canvas-event'

export type ImageCanvasCommand =
	| { kind: 'createLayer' }
	| { kind: 'removeLayer'; layer: LayerId }
	| { kind: 'drawLayer'; layer: LayerId; drawCommand: LayerDrawCommand }
	| { kind: 'revokeEvent'; eventId: ImageCanvasEventId }
	| { kind: 'restoreEvent'; eventId: ImageCanvasEventId }
