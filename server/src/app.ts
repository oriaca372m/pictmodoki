import { NodeCanvasProxy, NodeCanvasProxyFactory } from './canvas-proxy'
import { CommandInterpreter } from './command-interpreter'

import {
	Size,
	ImageCanvasEvent,
	ImageCanvasModel,
	ImageCanvasDrawer,
	ImageCanvasEventPlayer,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasUndoManager,
} from 'common'

class EventRenderer implements ImageCanvasEventManagerPlugin {
	private readonly _player: ImageCanvasEventPlayer
	constructor(private readonly _app: App) {
		this._player = new ImageCanvasEventPlayer(_app.drawer)
	}

	onEvent(event: ImageCanvasEvent): void {
		if (event.eventType.kind === 'eventRevoked') {
			return
		}

		this._player.playSingleEvent(event)
	}

	onHistoryChanged(): void {
		const model = this._app.undoMgr.createUndoedImageCanvasModel()
		this._app.drawer.setModel(model)
	}

	onHistoryWiped(): void {
		// pass
	}
}

export class App {
	size: Size
	factory: NodeCanvasProxyFactory
	drawer: ImageCanvasDrawer
	eventMgr: ImageCanvasEventManager
	undoMgr: ImageCanvasUndoManager
	targetCanvas: NodeCanvasProxy
	cmdInterpreter: CommandInterpreter

	constructor() {
		this.size = { width: 2000, height: 2000 }
		this.factory = new NodeCanvasProxyFactory()
		this.targetCanvas = this.factory.createCanvasProxy(this.size)

		// 特に使用されないので小さめのサイズで作る
		const model = new ImageCanvasModel({ width: 256, height: 256 })
		this.drawer = new ImageCanvasDrawer(model, this.factory)

		this.eventMgr = new ImageCanvasEventManager()
		this.eventMgr.registerPlugin(new EventRenderer(this))

		this.undoMgr = new ImageCanvasUndoManager(this.eventMgr, this.factory, model)
		this.eventMgr.registerPlugin(this.undoMgr)

		this.cmdInterpreter = new CommandInterpreter(this.drawer, this.eventMgr)
		this.resetCanvas()
	}

	resetCanvas(): void {
		const model = new ImageCanvasModel(this.size)
		this.undoMgr.setLastRenderedImageModel(model)
		this.eventMgr.setHistory([])

		this.cmdInterpreter.command('system', { kind: 'createLayer' })
		this.cmdInterpreter.command('system', { kind: 'createLayer' })
	}
}
