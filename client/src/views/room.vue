<template>
	<div class="app">
		<div ref="canvasScrollContainer" class="canvas-area">
			<div ref="canvasContainer" class="canvas-container"></div>
		</div>
		<div class="tool-area">
			<div>
				<button @click="undo">一つ戻す</button>
				<input type="checkbox" v-model="shouldSaveCanvas"><label>リセット時にキャンバスを保存</label>
			</div>
			<div>
				<h1>ツール選択</h1>
				<button @click="selectTool('pen')">ペン</button>
				<button @click="selectTool('spuit')">スポイト</button>
				<button @click="selectTool('eraser')">消しゴム</button>
				<button @click="selectTool('moving')">移動</button>
			</div>
			<div>
				<ColorPicker v-model="color"/>
				<button @click="selectColor('#000000')">黒</button>
				<button @click="selectColor('#ff0000')">赤</button>
				<button @click="selectColor('#0000ff')">青</button>
				<button @click="selectColor('#6b503e')">茶</button>
				<button @click="selectColor('#fff6e3')">肌</button>
				<div class="color-history">
					<template  v-for="color in state.colorHistory">
						<ColorPreview :value="color" class="color-preview" @click="selectColor(color)"/>
					</template>
				</div>
			</div>
			<div>
				<h1>ペンの太さ</h1>
				<div>
					<button @click="penSize = 3">3</button>
					<button @click="penSize = 10">10</button>
					<button @click="penSize = 20">20</button>
					<button @click="penSize = 50">50</button>
					<input type="number" v-model="penSize">
				</div>
			</div>
			<div>
				<h1>消しゴムの太さ</h1>
				<div>
					<button @click="eraserSize = 3">3</button>
					<button @click="eraserSize = 10">10</button>
					<button @click="eraserSize = 20">20</button>
					<button @click="eraserSize = 50">50</button>
					<input type="number" v-model="eraserSize">
				</div>
			</div>
			<div>
				<h1>キャンバスの表示</h1>
				<button @click="scale = 100; rotation = 0">原寸大</button>
				<button @click="setCanvasViewEntire">全体を表示</button>
				<div>
					<label>拡大率</label><input type="number" v-model="scale">
				</div>
				<div>
					<label>角度</label><input type="number" v-model="rotation">
				</div>
			</div>
			<div class="layer-selector">
				<button @click="createLayer">レイヤー作成</button>
				<draggable v-model="state.layers" item-key="id" @end="setLayerOrder">
					<template #item="{ element: layer }">
						<div>
							<button @click="selectLayerId(layer.id)">選択</button>
							<button @click="setLayerVisibility(layer.id, true)">表示</button>
							<button @click="setLayerVisibility(layer.id, false)">非表示</button>
							<button @click="removeLayerId(layer.id)">削除</button>
							<label><template v-if="layer.id === state.selectedLayerId">* </template>{{ layer.id }} {{ layer.name }}</label>
						</div>
					</template>
				</draggable>
			</div>
			<div class="chat-box">
				<h1>チャット</h1>
				<div>
					<input v-model="state.messageToSend" @keyup.enter="sendChat">
					<button @click="sendChat">送信</button>
				</div>
				<div v-for="chat in state.chatMessages.slice().reverse()" :key="chat.msgId">
					<p>{{ chat.name }}: {{ chat.msg }}</p>
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
</style>

<script src="./room-script"></script>
