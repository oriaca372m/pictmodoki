import { Size } from '../primitives.js'
import { CanvasProxy, CanvasProxyFactory, CanvasDrawer } from '../canvas-proxy.js'
import {
	LayerId,
	LayerDrawCommand,
	LayerCanvasModel,
	LayerDrawer,
	SerializedLayerCanvasModel,
} from './layer.js'
import * as u from '../utils.js'

export interface SerializedImageCanvasModel {
	size: Size
	layers: SerializedLayerCanvasModel[]
	order: LayerId[]
}

export class ImageCanvasModel {
	private _layers: LayerCanvasModel[] = []
	private _order: LayerId[] = []

	constructor(readonly size: Size) {}

	get layers(): readonly LayerCanvasModel[] {
		return this._layers
	}

	get order(): readonly LayerId[] {
		return this._order
	}

	private _validateOrder(layer: readonly LayerCanvasModel[], order: readonly LayerId[]): void {
		if (!u.isSetsEqual(new Set(layer.map((x) => x.id)), new Set(order))) {
			throw new Error('orderとlayersのIDの集合が違う')
		}
	}

	// 引数に与えた配列を変更しないでね
	// (cloneするべき?)
	setLayers(layers: LayerCanvasModel[], order: LayerId[]): void {
		this._validateOrder(layers, order)
		this._layers = layers
		this._order = order
	}

	// 引数に与えた配列を変更しないでね
	// (cloneするべき?)
	setOrder(order: LayerId[]): void {
		this._validateOrder(this._layers, order)
		this._order = order
	}

	addLayer(layerModel: LayerCanvasModel): void {
		this._layers.push(layerModel)
		this._order.push(layerModel.id)
	}

	removeLayer(id: LayerId): void {
		this._layers = this._layers.filter((x) => x.id !== id)
		this._order = this._order.filter((x) => x !== id)
	}

	clone(factory: CanvasProxyFactory): ImageCanvasModel {
		const newImageCanvas = new ImageCanvasModel(this.size)
		newImageCanvas._layers = this._layers.map((x) => x.clone(factory))
		newImageCanvas._order = Array.from(this._order)
		return newImageCanvas
	}

	async serialize(): Promise<SerializedImageCanvasModel> {
		return {
			size: this.size,
			layers: await Promise.all(this._layers.map((x) => x.serialize())),
			order: this._order,
		}
	}
}

class LayerController {
	readonly drawer: LayerDrawer
	isVisible = true

	constructor(readonly layer: LayerCanvasModel) {
		this.drawer = new LayerDrawer(layer.canvasProxy)
	}
}

export class ImageCanvasDrawer {
	protected _model!: ImageCanvasModel
	protected readonly _layerControllers = new Map<LayerCanvasModel, LayerController>()
	protected readonly _idToControllerMap = new Map<LayerId, LayerController>()

	constructor(model: ImageCanvasModel, private readonly _canvasProxyFactory: CanvasProxyFactory) {
		this.setModel(model)
	}

	get model(): ImageCanvasModel {
		return this._model
	}

	get canvasProxyFactory(): CanvasProxyFactory {
		return this._canvasProxyFactory
	}

	private _setLayerController(
		model: LayerCanvasModel,
		controller?: LayerController
	): LayerController {
		if (controller === undefined) {
			controller = new LayerController(model)
		}

		this._layerControllers.set(model, controller)
		this._idToControllerMap.set(model.id, controller)
		return controller
	}

	setModel(model: ImageCanvasModel): void {
		this._layerControllers.clear()
		this._idToControllerMap.clear()

		this._model = model
		for (const layer of model.layers) {
			this._setLayerController(layer)
		}
	}

	cloneModel(): ImageCanvasModel {
		return this._model.clone(this._canvasProxyFactory)
	}

	get layers(): readonly LayerCanvasModel[] {
		return this._model.layers
	}

	setLayerVisibility(layerId: LayerId, isVisible: boolean): void {
		const layer = this._findLayerById(layerId)
		if (layer.isVisible !== isVisible) {
			layer.isVisible = isVisible
		}
	}

	getLayerVisibility(layerId: LayerId): boolean {
		const layer = this._findLayerById(layerId)
		return layer.isVisible
	}

	createLayer(id: LayerId): LayerController {
		const foundLayer = this._idToControllerMap.get(id)
		if (foundLayer !== undefined) {
			return foundLayer
		}

		const canvas = this._canvasProxyFactory.createCanvasProxy(this._model.size)

		const layerModel = new LayerCanvasModel(id, canvas, '新規レイヤー')
		this._model.addLayer(layerModel)
		return this._setLayerController(layerModel)
	}

	removeLayer(id: LayerId): void {
		const controller = this._findLayerById(id)

		this._model.removeLayer(id)
		this._layerControllers.delete(controller.layer)
		this._idToControllerMap.delete(id)
	}

	setLayerOrder(order: readonly LayerId[]): void {
		this._model.setOrder(Array.from(order))
	}

	drawLayer(id: LayerId, drawCmd: LayerDrawCommand): void {
		this._findLayerById(id).drawer.command(drawCmd)
	}

	protected _findLayerById(id: LayerId): LayerController {
		const controller = this._idToControllerMap.get(id)
		if (controller === undefined) {
			throw new Error('レイヤーが見つからない')
		}

		return controller
	}

	findLayerModelById(id: LayerId): LayerCanvasModel | undefined {
		return this._idToControllerMap.get(id)?.layer
	}

	render(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()

		for (const id of this._model.order) {
			const controller = this._idToControllerMap.get(id)!
			if (!controller.isVisible) {
				continue
			}

			drawer.drawCanvasProxy(controller.drawer.canvasProxy)
		}
	}
}
