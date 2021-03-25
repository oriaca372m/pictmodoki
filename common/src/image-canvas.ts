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
}

export class ImageCanvasModel {
	layers: LayerCanvasModel[] = []
	constructor(readonly size: Size) {}

	clone(factory: CanvasProxyFactory): ImageCanvasModel {
		const newImageCanvas = new ImageCanvasModel(this.size)
		newImageCanvas.layers = this.layers.map((x) => x.clone(factory))
		return newImageCanvas
	}

	async serialize(): Promise<SerializedImageCanvasModel> {
		return {
			size: this.size,
			layers: await Promise.all(this.layers.map((x) => x.serialize())),
		}
	}
}

class LayerController {
	readonly drawer: LayerDrawer

	constructor(readonly layer: LayerCanvasModel) {
		this.drawer = new LayerDrawer(layer.canvasProxy)
	}
}

export class ImageCanvasDrawer {
	private _model!: ImageCanvasModel
	private _layerControllers = new Map<LayerCanvasModel, LayerController>()

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

	setModel(model: ImageCanvasModel): void {
		this._layerControllers.clear()
		this._previewOriginalLayer = undefined
		this._previewLayer = undefined

		this._shouldUpdateCache = true
		this._cacheTop = new LayerDrawer(this._canvasProxyFactory.createCanvasProxy(model.size))
		this._cacheBottom = new LayerDrawer(this._canvasProxyFactory.createCanvasProxy(model.size))

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

	createLayer(id: LayerId): LayerController {
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
		this._model.layers = this._model.layers.filter((x) => x.id !== controller.layer.id)
		this._layerControllers.delete(controller.layer)
		this._shouldUpdateCache = true
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
		const model = this._model.layers.find((x) => x.id === id)
		if (model === undefined) {
			throw new Error('レイヤーが見つからない')
		}

		return this._layerControllers.get(model)!
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

		for (const layer of this._model.layers) {
			if (this._previewOriginalLayer && this._previewOriginalLayer.id === layer.id) {
				drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
			} else {
				drawer.drawCanvasProxy(layer.canvasProxy)
			}
		}
	}

	private _cacheRender(canvas: CanvasProxy): void {
		const drawer = new CanvasDrawer(canvas)
		drawer.clear()

		drawer.drawCanvasProxy(this._cacheBottom.canvasProxy)
		drawer.drawCanvasProxy(this._previewLayer!.canvasProxy)
		drawer.drawCanvasProxy(this._cacheTop.canvasProxy)
	}

	private _updateCache(): void {
		const bottomDrawer = new CanvasDrawer(this._cacheBottom.canvasProxy)
		const topDrawer = new CanvasDrawer(this._cacheTop.canvasProxy)
		bottomDrawer.clear()
		topDrawer.clear()

		let isDrawingBottom = true

		for (const layer of this._model.layers) {
			if (this._previewOriginalLayer!.id === layer.id) {
				isDrawingBottom = false
				continue
			}

			if (isDrawingBottom) {
				bottomDrawer.drawCanvasProxy(layer.canvasProxy)
			} else {
				topDrawer.drawCanvasProxy(layer.canvasProxy)
			}
		}

		this._shouldUpdateCache = false
	}
}
