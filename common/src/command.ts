import { ImageCanvasCommand } from './image-canvas/command.js'

export type Command =
	| { kind: 'imageCanvasCommand'; value: ImageCanvasCommand }
	| { kind: 'requestData' }
	| { kind: 'login'; name: string; reconnectionToken: string | null }
	| { kind: 'sendChat'; message: string }
