import { defineComponent, ref, PropType, onUnmounted } from 'vue'
import { ChatManager, ChatMessage } from 'Src/app'

type ChatAttachment = {
	kind: 'rec'
	id: string
}

type ChatBoxMessage = ChatMessage & {
	msgId: number
	attachments: ChatAttachment[]
}

export default defineComponent({
	props: {
		serverAddr: { required: true, type: String },
		userName: { required: true, type: String },
		chatManager: { required: true, type: Object as PropType<ChatManager> },
	},

	setup(props) {
		const chatManager = props.chatManager
		const chatMessages = ref<ChatBoxMessage[]>([])
		const messageToSend = ref('')

		function onMessage(msg: ChatMessage): void {
			const attachments: ChatAttachment[] = []

			const recIdPattern =
				/\brec#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g

			for (const match of msg.message.matchAll(recIdPattern)) {
				console.log(match)
				console.log(match[1])
				attachments.push({ kind: 'rec', id: match[1] })
			}

			chatMessages.value.unshift({
				...msg,
				msgId: chatMessages.value.length,
				attachments,
			})
		}

		chatManager.message.on(onMessage)
		onUnmounted(() => {
			chatManager.message.off(onMessage)
		})

		function sendChat() {
			if (messageToSend.value === '') {
				return
			}

			chatManager.sendMessage(messageToSend.value)
			messageToSend.value = ''
		}

		return { chatMessages, messageToSend, sendChat }
	},
})
