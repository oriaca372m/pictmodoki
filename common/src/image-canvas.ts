import { Size } from './primitives'
import { CanvasProxy, CanvasProxyFactory, CanvasDrawer } from './canvas-proxy'
import {
	LayerId,
	LayerDrawCommand,
	LayerCanvasModel,
	LayerDrawer,
	SerializedLayerCanvasModel,
} from './layer'

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
		const layerSet = new Set(layer.map((x) => x.id))
		const orderSet = new Set(order)

		for (const id of layerSet) {
			if (!orderSet.has(id)) {
				throw new Error('orderがlayersが持っているIDを持っていない')
			}
		}

		for (const id of orderSet) {
			if (!layerSet.has(id)) {
				throw new Error('orderがlayersが持っていないIDを持っている')
			}
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
	private _model!: ImageCanvasModel
	private readonly _layerControllers = new Map<LayerCanvasModel, LayerController>()
	private readonly _idToControllerMap = new Map<LayerId, LayerController>()

	private _previewOriginalLayer: LayerCanvasModel | undefined
	private _previewLayer: LayerDrawer | undefined

	private _shouldUpdateCache = true
	private _cacheTop!: LayerDrawer
	private _cacheBottom!: LayerDrawer

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
		this._previewOriginalLayer = undefined
		this._previewLayer = undefined

		this._shouldUpdateCache = true
		this._cacheTop = new LayerDrawer(this._canvasProxyFactory.createCanvasProxy(model.size))
		this._cacheBottom = new LayerDrawer(this._canvasProxyFactory.createCanvasProxy(model.size))

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
			this._shouldUpdateCache = true
		}
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
		this._shouldUpdateCache = true
	}

	setLayerOrder(order: LayerId[]): void {
		this._model.setOrder(order)
	}

	drawLayer(id: LayerId, drawCmd: LayerDrawCommand): void {
		this._findLayerById(id).drawer.command(drawCmd)
		this._shouldUpdateCache = true
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

	private _findLayerById(id: LayerId): LayerController {
		const controller = this._idToControllerMap.get(id)
		if (controller === undefined) {
			throw new Error('レイヤーが見つからない')
		}

		return controller
	}

	render(canvas: CanvasProxy): void {
		if (this._previewLayer === undefined) {
			this._fullRender(canvas)
			return
		}

		if (this._shouldUpdateCache) {
			this._updateCache()
		}

		this._cacheRender(canvas)
	}

	private _fullRender(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()

		for (const id of this._model.order) {
			const controller = this._idToControllerMap.get(id)!
			if (!controller.isVisible) {
				continue
			}

			if (this._previewOriginalLayer && this._previewOriginalLayer.id === id) {
				drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
			} else {
				drawer.drawCanvasProxy(controller.drawer.canvasProxy)
			}
		}
	}

	private _cacheRender(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()

		drawer.drawCanvasProxy(this._cacheBottom.canvasProxy)

		const controller = this._layerControllers.get(this._previewOriginalLayer!)!
		if (controller.isVisible) {
			drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
		}
		drawer.drawCanvasProxy(this._cacheTop.canvasProxy)
	}

	private _updateCache(): void {
		const bottomDrawer = new CanvasDrawer(this._cacheBottom.canvasProxy)
		const topDrawer = new CanvasDrawer(this._cacheTop.canvasProxy)
		bottomDrawer.clear()
		topDrawer.clear()

		let isDrawingBottom = true

		for (const id of this._model.order) {
			if (this._previewOriginalLayer!.id === id) {
				isDrawingBottom = false
				continue
			}

			const controller = this._idToControllerMap.get(id)!
			if (!controller.isVisible) {
				continue
			}

			if (isDrawingBottom) {
				bottomDrawer.drawCanvasProxy(controller.drawer.canvasProxy)
			} else {
				topDrawer.drawCanvasProxy(controller.drawer.canvasProxy)
			}
		}

		this._shouldUpdateCache = false
	}
}
