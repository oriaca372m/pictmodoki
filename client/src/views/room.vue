<template>
	<div class="app">
		<div ref="canvasScrollContainer" class="canvas-area">
			<div ref="canvasContainer" class="canvas-container"></div>
		</div>
		<div class="tool-area">
			<div class="tab-selector">
				<ul>
					<li @click="activeTab = 1" :class="{ active: activeTab === 1 }">メイン</li>
					<li @click="activeTab = 2" :class="{ active: activeTab === 2 }">その他</li>
				</ul>
			</div>
			<div>
				<div v-if="activeTab === 1">
					<div></div>
					<div>
						<h1>ツール</h1>
						<button @click="undo">一つ戻す</button>
						<button @click="selectTool('pen')">ペン</button>
						<button @click="selectTool('smooth-pen')">ペン(手ブレ補正)</button>
						<button @click="selectTool('spuit')">スポイト</button>
						<button @click="selectTool('eraser')">消しゴム</button>
						<button @click="selectTool('moving')">移動</button>
					</div>
					<div>
						<ColorPicker v-model="color" />
						<button @click="selectColor('#000000')">黒</button>
						<button @click="selectColor('#ff0000')">赤</button>
						<button @click="selectColor('#0000ff')">青</button>
						<button @click="selectColor('#6b503e')">茶</button>
						<button @click="selectColor('#fff6e3')">肌</button>
						<div class="color-history">
							<template v-for="color in state.colorHistory">
								<ColorPreview
									:value="color"
									class="color-preview"
									@click="selectColor(color)"
								/>
							</template>
						</div>
					</div>
					<div class="width-selector">
						<div>
							<h1>ペンの太さ</h1>
							<div>
								<div>
									<button @click="penSize = 3">3</button>
									<button @click="penSize = 10">10</button>
									<button @click="penSize = 20">20</button>
									<button @click="penSize = 50">50</button>
								</div>
								<div><input type="number" v-model="penSize" /></div>
							</div>
						</div>
						<div>
							<h1>消しゴムの太さ</h1>
							<div>
								<div>
									<button @click="eraserSize = 3">3</button>
									<button @click="eraserSize = 10">10</button>
									<button @click="eraserSize = 20">20</button>
									<button @click="eraserSize = 50">50</button>
								</div>
								<div><input type="number" v-model="eraserSize" /></div>
							</div>
						</div>
					</div>
					<div>
						<h1>キャンバスの表示</h1>
						<button @click="setCanvasViewOriginal">原寸大</button>
						<button @click="setCanvasViewEntire">全体を表示</button>
						<div class="canvas-view-inner">
							<div><label>拡大率</label><input type="number" v-model="scale" /></div>
							<div><label>角度</label><input type="number" v-model="rotation" /></div>
						</div>
					</div>
					<div class="layer-selector">
						<h1>レイヤー</h1>
						<button @click="createLayer">レイヤー作成</button>
						<draggable v-model="state.layers" item-key="id" @end="setLayerOrder">
							<template #item="{ element: layer }">
								<div>
									<button @click="selectLayerId(layer.id)">選択</button>
									<template v-if="layer.isVisible">
										<button @click="setLayerVisibility(layer.id, false)">
											隠す
										</button>
									</template>
									<template v-else>
										<button @click="setLayerVisibility(layer.id, true)">
											表示
										</button>
									</template>
									<button @click="removeLayerId(layer.id)">削除</button>
									<label
										><template v-if="layer.id === state.selectedLayerId"
											>* </template
										>{{ layer.id }} {{ layer.name }}</label
									>
								</div>
							</template>
						</draggable>
					</div>
					<div class="chat-box">
						<h1>チャット</h1>
						<div>
							<input v-model="state.messageToSend" @keyup.enter="sendChat" />
							<button @click="sendChat">送信</button>
						</div>
						<div v-for="chat in state.chatMessages" :key="chat.msgId">
							<p>{{ chat.name }}: {{ chat.msg }}</p>
							<div v-for="(attachment, idx) in chat.attachments" :key="idx">
								<div v-if="(attachment.kind = 'rec')">
									<video
										class="drawing-record-video"
										controls
										:src="
											'/user_generated/drawing_records/' +
											attachment.id +
											'.mp4'
										"
									></video>
								</div>
							</div>
						</div>
					</div>
				</div>
				<div v-else-if="activeTab === 2">
					<div>
						<h1>音</h1>
						<div><label>音量</label><input type="number" v-model="volume" /></div>
					</div>
					<div>
						<h1>保存</h1>
						<button @click="saveCanvas">今のキャンバスをpngで保存</button>
						<input type="checkbox" v-model="shouldSaveCanvas" /><label>自動保存</label>
					</div>
					<div>
						<h1>ユーザー情報</h1>
						<table>
							<thead>
								<tr>
									<th>ID</th>
									<th>名前</th>
									<th>スコア</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="user in state.users" :key="user.id">
									<td>{{ user.id }}</td>
									<td>{{ user.name }}</td>
									<td>{{ user.score }}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style>
.app {
	display: flex;
	width: 100%;
	height: 100%;
	overflow: auto;
}

.layer-selector {
	overflow: auto;
}

.canvas-area {
	flex: 1;
	overflow: auto;
}

.canvas-container {
	display: flex;
	width: 10000px;
	height: 10000px;
	align-items: center;
	justify-content: center;
	background-color: lightgray;
}

.canvas-container canvas {
	background-color: white;
}

.tool-area {
	width: 350px;
	overflow: auto;
}

.tool-area h1 {
	font-size: 1rem;
	margin: 0;
}

.chat-box p {
	white-space: pre-line;
}
</style>

<style scoped>
.color-history {
	display: flex;
	flex-wrap: wrap;
	margin: 0 5px;
}

.color-preview {
	width: 30px;
	height: 30px;
	margin: 2px;
}

.width-selector {
	display: flex;
}

.width-selector > * {
	width: 100%;
}

.width-selector input {
	width: 100px;
}

.canvas-view-inner {
	display: flex;
}

.canvas-view-inner > * {
	width: 100%;
}

.canvas-view-inner input {
	width: 100px;
}

.tab-selector ul {
	display: flex;
	margin: 0;
	padding: 0;
	border-bottom: solid;
}

.tab-selector ul li {
	display: block;
	padding: 3px;

	list-style: none;
	border: solid;
	border-bottom: none;
}

.tab-selector ul li.active {
	background-color: #63aeff;
}

.drawing-record-video {
	width: 100%;
}
</style>

<script src="./room-script"></script>
