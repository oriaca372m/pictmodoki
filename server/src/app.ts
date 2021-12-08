import { NodeCanvasProxyFactory } from './canvas-proxy'
import { CommandInterpreter } from './command-interpreter'

import { Size } from 'common'
import {
	ImageCanvasModel,
	ImageCanvasDrawer,
	ImageCanvasEventManager,
	ImageCanvasEventExecutor,
} from 'common/dist/image-canvas'

export class App {
	readonly #size: Size = { width: 2000, height: 2000 }
	readonly #factory: NodeCanvasProxyFactory
	#drawer!: ImageCanvasDrawer
	eventMgr: ImageCanvasEventManager
	eventExecutor!: ImageCanvasEventExecutor
	cmdInterpreter: CommandInterpreter

	constructor() {
		this.#factory = new NodeCanvasProxyFactory()

		this.eventMgr = new ImageCanvasEventManager()
		this.cmdInterpreter = new CommandInterpreter(this.eventMgr)
		this.resetCanvas()
	}

	resetCanvas(): void {
		this.eventMgr.breakHistory()
		this.#drawer = new ImageCanvasDrawer(new ImageCanvasModel(this.#size), this.#factory)
		this.eventExecutor = new ImageCanvasEventExecutor(
			this.eventMgr,
			this.#drawer,
			this.#factory
		)
		this.eventMgr.setExecutor(this.eventExecutor)

		this.cmdInterpreter.command('system', { kind: 'createLayer' })
	}

	get canvasSize(): Size {
		return this.#size
	}

	get canvasFactory(): NodeCanvasProxyFactory {
		return this.#factory
	}

	get drawer(): ImageCanvasDrawer {
		return this.#drawer
	}
}
