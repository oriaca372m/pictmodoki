import { Size } from './primitives'
import { LayerId, LayerDrawCommand } from './layer'
import { UserId } from './user'
import { ImageCanvasModel, ImageCanvasDrawer, ImageCanvasCommand } from './image-canvas'
import { CanvasProxyFactory } from './canvas-proxy'

export type EventType =
	| { kind: 'canvasInitialized'; size: Size }
	| { kind: 'layerCreated'; layerId: LayerId }
	| { kind: 'layerRemoved'; layerId: LayerId }
	| { kind: 'eventRevoked'; eventId: EventId }
	| { kind: 'eventRestored'; eventId: EventId }
	| { kind: 'layerDrawn'; layerId: LayerId; drawCommand: LayerDrawCommand }

export type EventId = string

export interface Event {
	id: EventId
	userId: UserId
	isRevoked: boolean
	isVirtual: boolean
	eventType: EventType
}

// virtual eventとreal eventの等価性を確認する
export function isEqualVirtualRealEvent(real: Event, virtual: Event): boolean {
	if (real.userId !== virtual.userId) {
		return false
	}

	return JSON.stringify(real.eventType) === JSON.stringify(virtual.eventType)
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
	onHistoryWiped(wipedEvents: Event[]): void
}

export class EventManager {
	private _history: Event[] = []
	private _plugins: EventManagerPlugin[] = []
	private _lastRealEvent = -1
	private _isClean = true
	private _numRealEventToPreserve = 50

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

	private _wipeHistoryIfnecessary(): void {
		if (!this._isClean) {
			return
		}

		const numToWipe = this._history.length - this._numRealEventToPreserve
		if (numToWipe < 1) {
			return
		}

		const wiped = this._history.splice(0, numToWipe)
		this._lastRealEvent -= numToWipe
		this._plugins.forEach(x => { x.onHistoryWiped(wiped) })
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
			this._history.push(event)
			this._isClean = false
		} else {
			const shouldExit = this._pushRealEvent(event)
			this._wipeHistoryIfnecessary()
			if (shouldExit) {
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
	}

	onEvent(): void {
		// pass
	}

	onHistoryChanged(): void {
		// pass
	}

	onHistoryWiped(events: Event[]): void {
		this._lastRenderedEventPlayer.play(events)
	}

	createUndoedImageCanvasModel(): ImageCanvasModel {
		const model = this._lastRendered.clone(this._canvasProxyFactory)
		const drawer = new ImageCanvasDrawer(model, this._canvasProxyFactory)
		const player = new EventPlayer(drawer)
		player.play(this._eventManager.history)
		return model
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
