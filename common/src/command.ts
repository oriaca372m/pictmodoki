import { ImageCanvasCommand } from './image-canvas-command'

export type Command =
	| { kind: 'imageCanvasCommand'; value: ImageCanvasCommand }
	| { kind: 'requestData' }
