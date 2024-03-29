import { Position, Color, Size } from '../primitives'
import { CanvasProxy, CanvasProxyFactory, CanvasDrawer } from '../canvas-proxy'
import * as u from '../utils'

export type LayerId = string
export type LayerDrawCommand =
	| { kind: 'stroke'; positions: Position[]; color: Color; width: number }
	| { kind: 'erase'; positions: Position[]; opacity: number; width: number }
	| { kind: 'clear' }
	| { kind: 'fillRect'; position: Position; size: Size; color: Color }

export interface SerializedLayerCanvasModel {
	id: LayerId
	name: string
	image: Uint8Array
}

export class LayerCanvasModel {
	constructor(
		readonly id: LayerId,
		private readonly _canvasProxy: CanvasProxy,
		private _name: string
	) {}

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

	async serialize(): Promise<SerializedLayerCanvasModel> {
		return {
			id: this.id,
			name: this._name,
			image: await this._canvasProxy.serialize(),
		}
	}
}

export class LayerDrawer {
	private readonly _drawer: CanvasDrawer

	constructor(readonly canvasProxy: CanvasProxy) {
		this._drawer = new CanvasDrawer(this.canvasProxy)
	}

	command(cmd: LayerDrawCommand): void {
		if (cmd.kind === 'stroke') {
			this._drawer.stroke(cmd.positions, cmd.color, cmd.width)
		} else if (cmd.kind === 'erase') {
			this._drawer.erase(cmd.positions, -cmd.opacity + 1, cmd.width)
		} else if (cmd.kind === 'clear') {
			this._drawer.clear()
		} else if (cmd.kind === 'fillRect') {
			this._drawer.fillRect(cmd.position, cmd.size, cmd.color)
		} else {
			u.unreachable(cmd)
		}
	}

	get canvasDrawer(): CanvasDrawer {
		return this._drawer
	}
}
