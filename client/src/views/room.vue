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
			<div v-if="activeTab === 1" class="tab-body">
				<div>
					<h1>ツール</h1>
					<button @click="undo">一つ戻す</button>
					<button @click="selectTool('pen')">ペン</button>
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
					<slider
						style="margin-right: 5px"
						v-model="penSize"
						name="ペン"
						unit="px"
						:min="1"
						:max="400"
						:quick-values="[1, 3, 10, 20, 50, 200]"
						:scaler="penScaler"
					/>
					<slider
						v-model="eraserSize"
						name="消しゴム"
						unit="px"
						:min="1"
						:max="400"
						:quick-values="[1, 3, 10, 20, 50, 200]"
						:scaler="penScaler"
					/>
				</div>
				<div>
					<button @click="setCanvasViewEntire">全体を表示</button>
					<div>
						<slider
							style="margin-right: 5px"
							v-model="scale"
							name="拡大率"
							unit="%"
							:min="1"
							:max="500"
							:quick-values="[50, 100, 200, 500]"
						/>
						<slider
							v-model="rotation"
							name="回転"
							unit="°"
							:min="0"
							:max="359"
							:quick-values="[0, 90, 180, 270]"
						/>
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
				<ChatBox
					v-if="chatManager !== undefined"
					style="min-height: 200px; flex-grow: 1"
					:chatManager="chatManager"
				/>
			</div>
			<div v-else-if="activeTab === 2" class="tab-body">
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
</template>

<style>
.app {
	display: flex;
	width: 100%;
	height: 100%;
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

.tool-area {
	display: flex;
	flex-direction: column;
	width: 360px;
	overflow: auto;
}

.tab-body {
	flex-grow: 1;
	display: flex;
	flex-direction: column;
}

.tool-area h1 {
	font-size: 1rem;
	margin: 0;
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
	background-color: var(--color-primary);
}

.drawing-record-video {
	width: 100%;
}
</style>

<script src="./room-script"></script>
