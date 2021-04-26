import { defineComponent, reactive, ref, watch, onMounted } from 'vue'
import ColorPicker from '../components/color-picker/index.vue'
import Draggable from 'vuedraggable'

import { LayerId } from 'common'
import { App } from '../app'

interface ChatMessage {
	msgId: number
	id: string
	name: string
	msg: string
}

interface LayerInfo {
	id: LayerId
	name: string
}

interface State {
	layers: LayerInfo[]
	size: number
	eraserSize: number
	color: string
	selectedLayerId: string | undefined
	messageToSend: string
	chatMessages: ChatMessage[]
	scale: number
	rotation: number
}

export default defineComponent({
	props: {
		serverAddr: { required: true, type: String },
		userName: { required: true, type: String },
	},

	components: {
		ColorPicker,
		Draggable,
	},

	setup(props) {
		let app: App | undefined

		const state = reactive<State>({
			layers: [],
			size: 10,
			eraserSize: 20,
			color: '#ff0000',
			selectedLayerId: undefined,
			messageToSend: '',
			chatMessages: [],
			scale: 100,
			rotation: 0,
		})

		const canvasContainer = ref<HTMLDivElement>()
		const canvasScrollContainer = ref<HTMLDivElement>()

		onMounted(() => {
			console.log('test')
			canvasScrollContainer.value!.scrollTop = 5000
			canvasScrollContainer.value!.scrollLeft = 5000

			app = new App(
				canvasScrollContainer.value!,
				canvasContainer.value!,
				props.serverAddr,
				props.userName
			)
			console.log(app)

			app.ready.once(() => {
				app!.chatManager!.addMessageRecievedHandler((id, name, msg) => {
					state.chatMessages.push({ msgId: state.chatMessages.length, id, name, msg })
				})

				const layerUpdated = () => {
					state.layers = app!.paintApp!.drawer.model.order.map((x) => {
						const layer = app!.paintApp!.drawer.findLayerModelById(x)
						return { id: layer!.id, name: layer!.name }
					})
					state.selectedLayerId = app!.paintApp!.layerManager.selectedLayerId
				}

				app!.paintApp!.layerManager.updated.on(layerUpdated)
				layerUpdated()
			})
		})

		const setLayerOrder = () => {
			app!.paintApp!.layerManager.setLayerOrder(state.layers.map((x) => x.id))
		}

		const selectLayerId = (id: LayerId) => {
			const succeeded = app!.paintApp!.layerManager.selectLayerId(id)
			if (succeeded) {
				state.selectedLayerId = id
			}
		}

		const removeLayerId = (id: LayerId) => {
			app!.paintApp!.layerManager.removeLayer(id)
		}

		const createLayer = () => {
			app!.paintApp!.layerManager.createLayer()
		}

		const selectTool = (name: string) => {
			app!.paintApp!.toolManager.selectTool(name)
		}

		const selectColor = (color: string) => {
			state.color = color
			selectTool('pen')
		}

		const undo = () => {
			app!.paintApp!.undo()
		}

		const setLayerVisibility = (id: LayerId, isVisible: boolean) => {
			app!.paintApp!.layerManager.setLayerVisibility(id, isVisible)
		}

		const sendChat = () => {
			if (state.messageToSend === '') {
				return
			}
			app!.chatManager!.sendMessage(state.messageToSend)
			state.messageToSend = ''
		}

		watch(
			state,
			() => {
				if (app === undefined) {
					return
				}

				const paintApp = app.paintApp
				if (paintApp === undefined) {
					return
				}

				const color = state.color as { rgbCode?: string }
				if (color.rgbCode) {
					app.paintApp!.penTool.color = color.rgbCode
				}

				paintApp.penTool.width = state.size
				paintApp.eraserTool.width = state.eraserSize
				paintApp.canvasScale = state.scale / 100
				paintApp.canvasRotation = (Math.PI * state.rotation) / 180
			},
			{ deep: true }
		)

		return {
			state,
			canvasContainer,
			canvasScrollContainer,
			setLayerOrder,
			selectLayerId,
			removeLayerId,
			createLayer,
			selectTool,
			selectColor,
			undo,
			setLayerVisibility,
			sendChat,
		}
	},
})
