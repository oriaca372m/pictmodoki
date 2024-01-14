import { LayerId, LayerDrawCommand } from './layer.js'
import { UserId } from '../user.js'

export type ImageCanvasEventType =
	| { kind: 'layerCreated'; layerId: LayerId }
	| { kind: 'layerRemoved'; layerId: LayerId }
	| { kind: 'eventRevoked'; eventId: ImageCanvasEventId }
	| { kind: 'eventRestored'; eventId: ImageCanvasEventId }
	| { kind: 'layerDrawn'; layerId: LayerId; drawCommand: LayerDrawCommand }
	| { kind: 'layerOrderChanged'; order: LayerId[] }

export type ImageCanvasEventId = string

export interface ImageCanvasEvent {
	id: ImageCanvasEventId
	userId: UserId
	isRevoked: boolean
	eventType: ImageCanvasEventType
}
