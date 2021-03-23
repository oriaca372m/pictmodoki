import { Size } from './primitives'
import { LayerId, LayerDrawCommand, LayerCanvasModel, LayerDrawer } from './layer'
import { ImageCanvasModel, ImageCanvasDrawer, ImageCanvasCommand } from './image-canvas'
import { CanvasProxy, CanvasProxyFactory } from './canvas-proxy'

export { CanvasProxy, CanvasProxyFactory } from './canvas-proxy'
export { ImageCanvasModel, ImageCanvasDrawer } from './image-canvas'
export { LayerDrawCommand } from './layer'
export * from './primitives'

export type EventType =
	| { kind: 'canvasInitialized'; size: Size }
	| { kind: 'layerCreated'; layerId: LayerId }
	| { kind: 'layerRemoved'; layerId: LayerId }
	| { kind: 'eventRevoked'; eventId: EventId }
	| { kind: 'eventRestored'; eventId: EventId }
	| { kind: 'layerDrawn'; layerId: LayerId; drawCommand: LayerDrawCommand }

export type EventId = string

export type UserId = string

export interface Event {
	id: EventId
	userId: UserId
	isRevoked: boolean
	eventType: EventType
}

export class EventPlayer {
	constructor(private readonly _drawer: ImageCanvasDrawer) {
	}

	play(events: readonly Event[]): void {
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
			this._drawer.command({ kind: 'drawLayer', layer: p.layerId, drawCommand: p.drawCommand })
		} else if (p.kind === 'layerCreated') {
			this._drawer.command({ kind: 'createLayer', id: p.layerId })
		}
	}
}

export interface EventManagerPlugin {
	onEvent(event: Event): void
}

export class EventManager {
	_history: Event[] = []
	_plugins: EventManagerPlugin[] = []

	registerPlugin(plugin: EventManagerPlugin): void {
		this._plugins.push(plugin)
	}

	event(event: Event): void {
		this._history.push(event)

		if (event.eventType.kind === 'eventRevoked') {
			const revokedId = event.eventType.eventId
			this._history.find(x => x.id === revokedId)!.isRevoked = true
		}

		for (const plugin of this._plugins) {
			plugin.onEvent(event)
		}
	}

	get history(): readonly Event[] {
		return this._history
	}
}

export class UndoManager implements EventManagerPlugin {
	private readonly _lastRendered: ImageCanvasModel
	private readonly _lastRenderedDrawer: ImageCanvasDrawer
	private readonly _lastRenderedEventId: EventId
	private readonly _lastRenderedEventPlayer: EventPlayer

	constructor(
		private readonly _userId: UserId,
		private readonly _eventManager: EventManager,
		private readonly _canvasProxyFactory: CanvasProxyFactory,
		currentImageCanvasModel: ImageCanvasModel
	) {
		this._lastRendered = currentImageCanvasModel.clone(this._canvasProxyFactory)
		this._lastRenderedDrawer = new ImageCanvasDrawer(this._lastRendered, _canvasProxyFactory)
		this._lastRenderedEventPlayer = new EventPlayer(this._lastRenderedDrawer)

		const lastEventId = this._eventManager.history[this._eventManager.history.length - 1].id
		this._lastRenderedEventId = lastEventId
	}

	onEvent(_event: Event): void {
		this._forwardOne()
	}

	createUndoedImageCanvasModel(): ImageCanvasModel {
		const model = this._lastRendered.clone(this._canvasProxyFactory)
		const drawer = new ImageCanvasDrawer(model, this._canvasProxyFactory)
		const player = new EventPlayer(drawer)
		console.log(this._eventManager.history)
		player.play(this._eventManager.history)
		return model
	}

	private _forwardOne(): void {
		const currentIndex = this._eventManager.history.findIndex(x => x.id === this._lastRenderedEventId)
		if (currentIndex === -1) {
			throw 'breaked undo history...'
		}
		this._lastRenderedEventPlayer.playSingleEvent(this._eventManager.history[currentIndex + 1])
	}

	createUndoEvent(): EventType | undefined {
		const clonedHistory = Array.from(this._eventManager.history)
		const event = clonedHistory.reverse().find(x =>
			x.eventType.kind !== 'eventRevoked' && x.userId === this._userId && !x.isRevoked)
		if (event === undefined) {
			return
		}

		return { kind: 'eventRevoked', eventId: event.id }
	}
}

export interface EventSender {
	command(cmd: ImageCanvasCommand): void
	event(event: EventType): void
}

export class DebugEventSender implements EventSender {
	private _eventId = 0
	constructor(private _manager: EventManager) { }

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({ kind: 'layerDrawn', layerId: cmd.layer, drawCommand: cmd.drawCommand })
		} else if (cmd.kind === 'createLayer') {
			this._pushEvent({ kind: 'layerCreated', layerId: cmd.id })
		}
	}

	event(eventType: EventType): void {
			this._pushEvent(eventType)
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
