import { LayerId, LayerDrawCommand, LayerCanvasModel, LayerDrawer } from './layer'
import { ImageCanvasDrawer, ImageCanvasCommand } from './image-canvas'

export { CanvasProxy, CanvasProxyFactory } from './canvas-proxy'
export { ImageCanvasModel, ImageCanvasDrawer } from './image-canvas'
export { LayerDrawCommand } from './layer'
export * from './primitives'

type EventType =
	| { kind: 'layerCreated'; layerId: LayerId }
	| { kind: 'layerRemoved'; layerId: LayerId }
	| { kind: 'eventRevoked'; eventId: EventId }
	| { kind: 'eventRestored'; eventId: EventId }
	| { kind: 'layerDrawn'; layerId: LayerId; drawCommand: LayerDrawCommand }

type EventId = string

interface Event {
	id: EventId
	userId: string
	isRevoked: boolean
	eventType: EventType
}

class EventPlayer {
	constructor(private imageCanvas: ImageCanvasDrawer) {
	}

	play(events: Event[]): void {
		for (const event of events) {
			this.playSingleEvent(event)
		}
	}

	playSingleEvent(event: Event): void {
		if (event.isRevoked) {
			return
		}

		const p = event.eventType
		if (p.kind === 'layerDrawn') {
			this.imageCanvas.command({ kind: 'drawLayer', layer: p.layerId, drawCommand: p.drawCommand })
		}
	}
}

class EventManager {
	_history: Event[] = []

	event(event: Event) {
		this._history.push(event)

		if (event.eventType.kind === 'eventRevoked') {
			const revokedId = event.eventType.eventId
			this._history.find(x => x.id === revokedId)!.isRevoked = true
		}
	}

	get history(): Event[] {
		return this._history
	}
}

interface EventSender {
	command(cmd: ImageCanvasCommand): void
}

class DebugEventSender implements EventSender {
	private _eventId = 0
	constructor(private _manager: EventManager) { }

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({ kind: 'layerDrawn', layerId: cmd.layer, drawCommand: cmd.drawCommand })
		}
	}

	private _pushEvent(eventType: EventType) {
		this._manager.event({
			id: this._eventId.toString(),
			userId: 'debugUser',
			isRevoked: false,
			eventType
		})

		this._eventId++
	}
}

export class User { }

export class CommandHistory {
	push(cmd: ImageCanvasCommand, sender: User): void { }
}
