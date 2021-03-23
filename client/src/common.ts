import { Position, Size, Color } from './primitives'

export type LayerId = string
export type LayerDrawCommand =
	| { kind: 'stroke'; positions: Position[]; color: Color; width: number }
	| { kind: 'erase'; positions: Position[]; width: number }
	| { kind: 'clear' }

export class LayerCanvasModel {
	constructor(readonly id: LayerId, private readonly _canvasProxy: CanvasProxy, private _name: string) {
	}

	get canvasProxy(): CanvasProxy {
		return this._canvasProxy
	}

	get name(): string {
		return this._name
	}
	setName(name: string): void {
		this._name = name
	}

	clone(factory: CanvasProxyFactory): LayerCanvasModel {
		const newCanvas = factory.createCanvasProxy(this._canvasProxy.size)
		this._canvasProxy.drawSelfTo(newCanvas.getContext())
		return new LayerCanvasModel(this.id, newCanvas, this.name)
	}
}

class LayerDrawer {
	private readonly _drawer: CanvasDrawer

	constructor(readonly canvasProxy: CanvasProxy) {
		this._drawer = new CanvasDrawer(this.canvasProxy)
	}

	command(cmd: LayerDrawCommand): void {
		if (cmd.kind === 'stroke') {
			this._drawer.stroke(cmd.positions, cmd.color, cmd.width)
		} else if (cmd.kind === 'erase') {
			this._drawer.erase(cmd.positions, cmd.width)
		} else if (cmd.kind === 'clear') {
			this._drawer.clear()
		}
	}
}

class LayerController {
	readonly drawer: LayerDrawer

	constructor(readonly layer: LayerCanvasModel) {
		this.drawer = new LayerDrawer(layer.canvasProxy)
	}
}

export interface CanvasProxy {
	getContext(): CanvasRenderingContext2D
	drawSelfTo(ctx: CanvasRenderingContext2D): void

	readonly size: Size
}

export interface CanvasProxyFactory {
	createCanvasProxy(size: Size): CanvasProxy
}

class CanvasDrawer {
	private _ctx!: CanvasRenderingContext2D

	constructor(private readonly _canvasProxy: CanvasProxy) {
		this._prepareContext()
	}

	private _prepareContext() {
		const ctx = this._canvasProxy.getContext()

		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		this._ctx = ctx
	}

	get canvasProxy(): CanvasProxy {
		return this._canvasProxy
	}

	stroke(positions: Position[], color: Color, width: number) {
		this._ctx.globalCompositeOperation = 'source-over'
		this._ctx.strokeStyle = color
		this._ctx.lineWidth = width

		this._stroke(positions)
	}

	erase(positions: Position[], width: number) {
		this._ctx.globalCompositeOperation = 'destination-out'
		this._ctx.strokeStyle = '#ffffff'
		this._ctx.lineWidth = width

		this._stroke(positions)
	}

	private _stroke(positions: Position[]) {
		this._ctx.beginPath()

		const { x, y } = positions[0]
		this._ctx.moveTo(x, y)

		for (let i = 1; i < positions.length; i++) {
			const { x, y } = positions[i]
			this._ctx.lineTo(x, y)
		}

		this._ctx.stroke()
	}

	clear() {
		const { width, height } = this._canvasProxy.size
		this._ctx.clearRect(0, 0, width, height)
	}

	drawCanvasProxy(canvas: CanvasProxy) {
		this._ctx.globalCompositeOperation = 'source-over'
		canvas.drawSelfTo(this._ctx)
	}
}

export type ImageCanvasCommand =
	| { kind: 'createLayer'; id: LayerId }
	| { kind: 'removeLayer'; layer: LayerId }
	| { kind: 'drawLayer'; layer: LayerId; drawCommand: LayerDrawCommand }

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

export function findById<T, U extends { id: T }>(arr: readonly U[], id: T): U | undefined {
	return arr.find(x => x.id === id)
}

export function findByIdError<T, U extends { id: T }>(arr: readonly U[], id: T): U {
	return arr.find(x => x.id === id) ?? throwError(new Error('Could not found id'))
}

class EventManager {
	_history: Event[] = []

	event(event: Event) {
		this._history.push(event)

		if (event.eventType.kind === 'eventRevoked') {
			const revokedId = event.eventType.eventId
			findByIdError(this._history, revokedId).isRevoked = true
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

export class ImageCanvasModel {
	layers: LayerCanvasModel[] = []
	constructor(readonly size: Size) { }

	clone(factory: CanvasProxyFactory): ImageCanvasModel {
		const newImageCanvas = new ImageCanvasModel(this.size)
		newImageCanvas.layers = this.layers.map(x => x.clone(factory))
		return newImageCanvas
	}
}

export class ImageCanvasDrawer {
	private _model!: ImageCanvasModel
	private _layerControllers = new Map<LayerCanvasModel, LayerController>()

	private _previewOriginalLayer: LayerCanvasModel | undefined
	private _previewLayer: LayerDrawer | undefined

	constructor(model: ImageCanvasModel, private readonly _canvasProxyFactory: CanvasProxyFactory) {
		this.setModel(model)
	}

	get model(): ImageCanvasModel {
		return this._model
	}

	get canvasProxyFactory(): CanvasProxyFactory {
		return this._canvasProxyFactory
	}

	setModel(model: ImageCanvasModel): void {
		this._layerControllers.clear()
		this._previewOriginalLayer = undefined
		this._previewLayer = undefined

		this._model = model
		for (const layer of model.layers) {
			this._layerControllers.set(layer, new LayerController(layer))
		}
	}

	cloneModel(): ImageCanvasModel {
		return this._model.clone(this._canvasProxyFactory)
	}

	get layers(): readonly LayerCanvasModel[] {
		return this._model.layers
	}

	private _createLayer(id: LayerId): LayerController {
		const foundLayer = this.layers.find((x) => x.id === id)
		if (foundLayer !== undefined) {
			return this._layerControllers.get(foundLayer)!
		}

		const canvas = this._canvasProxyFactory.createCanvasProxy(this._model.size)
		const layerModel = new LayerCanvasModel(id, canvas, '新規レイヤー')
		const controller = new LayerController(layerModel)

		this._model.layers.push(layerModel)
		this._layerControllers.set(layerModel, controller)

		return controller
	}

	removeLayer(id: LayerId): void {
		const controller = this._findLayerById(id)
		this._model.layers = this._model.layers.filter(x => x.id === controller.layer.id)
		this._layerControllers.delete(controller.layer)
	}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'createLayer') {
			this._createLayer(cmd.id)
		}

		if (cmd.kind === 'drawLayer') {
			this._findLayerById(cmd.layer).drawer.command(cmd.drawCommand)
		}
	}

	startPreview(layer: LayerId): void {
		if (this._previewOriginalLayer !== undefined && this._previewOriginalLayer.id === layer) {
			return
		}

		this._previewOriginalLayer = this._findLayerById(layer).layer

		const canvas = this._canvasProxyFactory.createCanvasProxy(this._model.size)
		this._previewLayer = new LayerDrawer(canvas)
	}

	drawPreview(drawCmd: LayerDrawCommand): void {
		if (this._previewLayer === undefined) {
			throw new Error('startPreview() must be called before calling drawPreview().')
		}

		const drawer = new CanvasDrawer(this._previewLayer.canvasProxy)
		drawer.clear()
		drawer.drawCanvasProxy(this._previewOriginalLayer!.canvasProxy)
		this._previewLayer.command(drawCmd)
	}

	endPreview(): void {
		this._previewOriginalLayer = undefined
		this._previewLayer = undefined
	}

	render(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()
		for (const layer of this._model.layers) {
			if (this._previewOriginalLayer && this._previewOriginalLayer.id === layer.id) {
				drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
			} else {
				drawer.drawCanvasProxy(layer.canvasProxy)
			}
		}
	}

	private _findLayerById(id: LayerId): LayerController {
		const model = this._model.layers.find((x) => x.id === id)
		if (model === undefined) {
			throw new Error('レイヤーが見つからない')
		}

		return this._layerControllers.get(model)!
	}
}

function throwError(error: Error): never {
	throw error
}
