<template>
	<div class="chat-box">
		<h1>チャット</h1>
		<div>
			<input v-model="messageToSend" @keyup.enter="sendChat" />
			<button @click="sendChat">送信</button>
		</div>
		<div v-for="chat in chatMessages" :key="chat.msgId">
			<p>{{ chat.name }}: {{ chat.message }}</p>
			<div v-for="(attachment, idx) in chat.attachments" :key="idx">
				<div v-if="(attachment.kind = 'rec')">
					<video
						class="drawing-record-video"
						controls
						:src="'/user_generated/drawing_records/' + attachment.id + '.mp4'"
					></video>
				</div>
			</div>
		</div>
	</div>
</template>

<style></style>

<script src="./index-script.ts"></script>
