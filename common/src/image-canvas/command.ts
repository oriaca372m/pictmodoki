import { LayerId, LayerDrawCommand } from './layer.js'
import { ImageCanvasEventId } from './event.js'

export type ImageCanvasCommand =
	| { kind: 'createLayer' }
	| { kind: 'removeLayer'; layer: LayerId }
	| { kind: 'drawLayer'; layer: LayerId; drawCommand: LayerDrawCommand }
	| { kind: 'revokeEvent'; eventId: ImageCanvasEventId }
	| { kind: 'restoreEvent'; eventId: ImageCanvasEventId }
	| { kind: 'setLayerOrder'; order: LayerId[] }
