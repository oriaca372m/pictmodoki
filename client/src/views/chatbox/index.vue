<template>
	<div class="bl_chatBox">
		<div class="bl_chatBox_ctrl">
			<input v-model="messageToSend" @keyup.enter="sendChat" />
			<button @click="sendChat">送信</button>
		</div>
		<div class="bl_chatBox_body">
			<div
				class="bl_chatMsg"
				v-for="chat in chatMessages"
				:key="chat.msgId"
				:data-user-id="chat.userId"
			>
				<div class="bl_chatMsg_icon"></div>
				<div class="bl_chatMsg_right">
					<span class="bl_chatMsg_name">{{ chat.name }}</span>
					<div class="bl_chatMsg_body">
						<p class="bl_chatMsg_msg">{{ chat.message }}</p>
						<div v-if="chat.attachments.length !== 0" class="bl_chatMsg_attachments">
							<div
								v-for="(attachment, idx) in chat.attachments"
								:key="idx"
								class="bl_chatMsg_attachment_wrapper"
							>
								<video
									v-if="attachment.kind === 'rec'"
									class="drawing-record-video"
									controls
									:src="
										'/user_generated/drawing_records/' + attachment.id + '.mp4'
									"
								></video>
								<img v-if="attachment.kind === 'image'" :src="attachment.url" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style>
.bl_chatBox {
	display: flex;
	flex-direction: column;
}

.bl_chatBox_body {
	flex-grow: 1;
	height: 0px;
	overflow: auto;

	padding: 5px;
}

.bl_chatMsg {
	display: flex;
	--chatMsg-bg: lightgray;
}

.bl_chatMsg[data-user-id='system'] .bl_chatMsg_body {
	--chatMsg-bg: lightgreen;
}

.bl_chatMsg_icon {
	flex-shrink: 0;
	border-radius: 50%;
	width: 33px;
	height: 33px;
	background-size: cover;
	image-rendering: high-quality;
	background-image: url('/assets/img/icon_default_user.svg');
}

.bl_chatMsg[data-user-id='system'] .bl_chatMsg_icon {
	background-image: url('/assets/img/icon_system.png');
}

.bl_chatMsg_right {
	margin-left: 10px;
}

.bl_chatMsg_name {
	display: block;
	font-size: 0.7em;
}

.bl_chatMsg_body {
	position: relative;
	padding: 0 1ch;
	border-radius: 0.5rem;
	margin-bottom: 5px;
	width: fit-content;
	background-color: var(--chatMsg-bg);
}

.bl_chatMsg_body::before {
	content: '';
	position: absolute;
	display: block;
	width: 0;
	height: 0;
	left: -6px;
	top: -2px;

	width: 0;
	height: 0;
	border-right: 5px solid transparent;
	border-left: 5px solid transparent;
	border-bottom: 10px solid var(--chatMsg-bg);
	transform: rotate(300deg);
}

.bl_chatMsg_attachments {
	display: flex;
	overflow-x: auto;
	column-gap: 1ch;
	padding-bottom: 3px;
}

.bl_chatMsg_attachment_wrapper {
	flex-shrink: 0;
	max-width: 200px;
	border-radius: 0.5rem;
	overflow: hidden;
}
</style>

<script src="./index-script.ts"></script>
