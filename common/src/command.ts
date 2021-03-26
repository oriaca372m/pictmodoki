import { ImageCanvasCommand } from './image-canvas-command'

export type Command =
	| { kind: 'imageCanvasCommand'; value: ImageCanvasCommand }
	| { kind: 'requestData' }
	| { kind: 'login'; name: string; reconnectionToken: string | undefined }
	| { kind: 'sendChat'; message: string }
