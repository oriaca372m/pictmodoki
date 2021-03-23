import * as ws from 'ws'
import { createCanvas, Canvas } from 'canvas'

import {
	CanvasProxy,
	CanvasProxyFactory,
	Size,
	ImageCanvasEvent,
	ImageCanvasEventType,
	ImageCanvasModel,
	ImageCanvasCommand,
	ImageCanvasDrawer,
	ImageCanvasEventPlayer,
	ImageCanvasEventManager,
	ImageCanvasEventManagerPlugin,
	ImageCanvasUndoManager,
} from 'common'

import * as fs from 'fs'

class NodeCanvasProxy implements CanvasProxy {
	private readonly _canvas: Canvas
	constructor(size: Size) {
		this._canvas = createCanvas(size.height, size.width)
	}

	getContext(): CanvasRenderingContext2D {
		return this._canvas.getContext('2d')
	}

	drawSelfTo(ctx: CanvasRenderingContext2D): void {
		ctx.drawImage(this._canvas as unknown as OffscreenCanvas, 0, 0)
	}

	get size(): Size {
		return { width: this._canvas.width, height: this._canvas.height }
	}

	saveFile(path: string): void {
		const out = fs.createWriteStream(path)
		const stream = this._canvas.createPNGStream()
		stream.pipe(out)
	}
}

class NodeCanvasProxyFactory implements CanvasProxyFactory {
	createCanvasProxy(size: Size): NodeCanvasProxy {
		return new NodeCanvasProxy(size)
	}
}

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
		this._app.render()
	}

	onHistoryChanged(): void {
		const model = this._app.undoMgr.createUndoedImageCanvasModel()
		this._app.drawer.setModel(model)
		this._app.render()
	}

	onHistoryWiped(): void {
		// pass
	}
}

class App {
	size: Size
	factory: NodeCanvasProxyFactory
	drawer: ImageCanvasDrawer
	eventMgr: ImageCanvasEventManager
	undoMgr: ImageCanvasUndoManager
	targetCanvas: NodeCanvasProxy
	cmdInterpreter: CommandInterpreter

	numFile = 0

	constructor() {
		this.size = { width: 800, height: 800 }
		this.factory = new NodeCanvasProxyFactory()
		this.targetCanvas = this.factory.createCanvasProxy(this.size)
		const model = new ImageCanvasModel(this.size)
		this.drawer = new ImageCanvasDrawer(model, this.factory)

		this.eventMgr = new ImageCanvasEventManager()
		this.eventMgr.event({
			id: '-1',
			userId: 'system',
			isRevoked: false,
			isVirtual: false,
			eventType: {
				kind: 'canvasInitialized',
				size: this.size,
			},
		})

		this.eventMgr.registerPlugin(new EventRenderer(this))

		this.undoMgr = new ImageCanvasUndoManager('debugUser', this.eventMgr, this.factory, model)
		this.eventMgr.registerPlugin(this.undoMgr)

		this.cmdInterpreter = new CommandInterpreter(this.eventMgr)
	}

	render(): void {
		console.log('onrenderer')
		this.drawer.render(this.targetCanvas)
		this.targetCanvas.saveFile(`${this.numFile}.png`)
		this.numFile++
	}
}

export class CommandInterpreter {
	private _eventId = 0
	private _layerId = 0
	constructor(private _manager: ImageCanvasEventManager) { }

	command(cmd: ImageCanvasCommand): ImageCanvasEvent | undefined {
		if (cmd.kind === 'drawLayer') {
			const event = this._genEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
			this._pushEvent(event)
			return event
		} else if (cmd.kind === 'createLayer') {
			const event = this._genEvent({ kind: 'layerCreated', layerId: this._layerId.toString() })
			this._pushEvent(event)
			this._layerId++
			return event
		} else if (cmd.kind === 'revokeEvent') {
			const event = this._genEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
			this._pushEvent(event)
			return event
		}
	}

	private _genEvent(eventType: ImageCanvasEventType): ImageCanvasEvent {
		return {
			id: this._eventId.toString(),
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
	}

	private _pushEvent(event: ImageCanvasEvent): void {
		console.log('pushevent')
		this._manager.event(event)
		this._eventId++
	}
}

function main() {
	const s = new ws.Server({ port: 5001 })
	const app = new App()

	s.on('connection', ws => {
		ws.on('message', (message: unknown) => {
			console.log(message)
			const cmd = JSON.parse(message as string) as ImageCanvasCommand

			const event = app.cmdInterpreter.command(cmd)

			s.clients.forEach(client => {
				client.send(JSON.stringify(event))
			})
		})
	})
}

main()
