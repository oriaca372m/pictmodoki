import { Size } from './primitives'
import { LayerId, LayerDrawCommand } from './layer'
import { ImageCanvasModel, ImageCanvasDrawer, ImageCanvasCommand } from './image-canvas'
import { CanvasProxyFactory } from './canvas-proxy'

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
	isVirtual: boolean
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
	onHistoryChanged(): void
}

// virtual eventとreal eventの等価性を確認する
function isEqualVirtualRealEvent(real: Event, virtual: Event): boolean {
	if (real.userId !== virtual.userId) {
		return false
	}

	return JSON.stringify(real.eventType) === JSON.stringify(virtual.eventType)
}

export class EventManager {
	private _history: Event[] = []
	private _plugins: EventManagerPlugin[] = []
	private _lastRealEvent = -1
	private _isClean = true

	registerPlugin(plugin: EventManagerPlugin): void {
		this._plugins.push(plugin)
	}

	get isClean(): boolean {
		return this._isClean
	}

	// toIndexは最後の正しいエントリのインデックス
	private _rewindHistory(toIndex: number): void {
		this._history = this._history.splice(toIndex + 1)
		this._plugins.forEach(x => { x.onHistoryChanged() })
	}

	// historyの最後の要素のインデックス
	private get _lastIndex(): number {
		return this._history.length - 1
	}

	// 戻り値: 処理を終了するべきか
	private _pushRealEvent(event: Event): boolean {
		if (this._lastRealEvent === this._lastIndex) {
			this._history.push(event)
			this._lastRealEvent++
			this._isClean = true
			return false
		}

		const vevent = this._history[this._lastRealEvent + 1]
		if (isEqualVirtualRealEvent(event, vevent)) {
			vevent.id = event.id
			vevent.isVirtual = false
			this._lastRealEvent++
			this._isClean = this._lastRealEvent === this._lastIndex
			return true
		} else {
			this._rewindHistory(this._lastRealEvent)
			this._history.push(event)
			this._lastRealEvent = this._lastIndex
			this._isClean = true
			return false
		}
	}

	event(event: Event): void {
		if (event.isVirtual) {
			this._isClean = false
			this._history.push(event)
		} else {
			if (this._pushRealEvent(event)) {
				return
			}
		}

		let historyChanged = false
		if (event.eventType.kind === 'eventRevoked') {
			const revokedId = event.eventType.eventId
			this._history.find(x => x.id === revokedId)!.isRevoked = true
			historyChanged = true
		}

		this._plugins.forEach(x => { x.onEvent(event) })

		if (historyChanged) {
			this._plugins.forEach(x => { x.onHistoryChanged() })
		}
	}

	get history(): readonly Event[] {
		return this._history
	}

	getReversedHistory(): Event[] {
		return Array.from(this._history).reverse()
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
		// this._forwardOne()
	}

	onHistoryChanged(): void {
		// pass
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

	private _canCreateUndoEvent(): boolean {
		if (this._eventManager.isClean) {
			return true
		}

		for (const event of this._eventManager.getReversedHistory()) {
			if (event.isVirtual) {
				if (event.eventType.kind !== 'eventRevoked') {
					return false
				}
			} else {
				return true
			}
		}

		return true
	}

	createUndoEvent(): EventType | undefined {
		if (!this._canCreateUndoEvent()) {
			return
		}
		const event = this._eventManager.getReversedHistory().find(x =>
			!x.isVirtual && x.eventType.kind !== 'eventRevoked' && x.userId === this._userId && !x.isRevoked)
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
			id: 'virtual',
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: true,
			eventType
		})

		setTimeout(() => {
			this._manager.event({
				id: this._eventId.toString(),
				userId: 'debugUser',
				isRevoked: false,
				isVirtual: false,
				eventType
			})

			this._eventId++
		}, 1000)
	}
}

export class User { }
