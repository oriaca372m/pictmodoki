<template>
	<div
		class="bl_numSlider_wrapper"
		@mouseenter="isPopupShown = true"
		@mouseleave="isPopupShown = false"
	>
		<div class="bl_numSlider" ref="numSlider" @contextmenu.prevent @wheel="wheel">
			<div class="bl_numSlider_body" ref="numSliderBody" @mousedown="mousedown">
				<div class="bl_numSlider_filled" :style="{ width: filledWidthStyle }"></div>
				<span v-if="!isRawEditMode" class="bl_numSlider_txt"
					>{{ name }}: {{ value.toFixed() }}{{ unit }}</span
				>
				<input
					v-else
					class="bl_numSlider_rawInput"
					ref="rawInput"
					@keypress.enter="isRawEditMode = false"
					@blur="isRawEditMode = false"
					type="number"
					v-model="value"
					:min="min"
					:max="max"
				/>
			</div>
			<div class="bl_numSlider_ctrl">
				<div class="bl_numSlider_ctrl_up" @click="value -= 1">
					<div
						class="el_triangleUp"
						style="--triangle-size: 10px; --triangle-color: white"
					></div>
				</div>
				<div class="bl_numSlider_ctrl_down" @click="value += 1">
					<div
						class="el_triangleDown"
						style="--triangle-size: 10px; --triangle-color: white"
					></div>
				</div>
			</div>
		</div>
		<div v-if="isPopupShown" class="bl_numSlider_popup">
			<button v-for="(v, idx) in quickValues" :key="idx" @click="value = v">
				{{ v }}
			</button>
		</div>
	</div>
</template>

<style>
.bl_numSlider_wrapper {
	display: inline-block;
	position: relative;
	border: solid thin;

	width: 170px;
	height: 30px;
}

.bl_numSlider {
	display: flex;
	height: 100%;
}

.bl_numSlider_ctrl {
	display: flex;
	flex-direction: column;
}

.bl_numSlider_ctrl_up,
.bl_numSlider_ctrl_down {
	flex-grow: 1;
	display: flex;
	align-items: center;
	user-select: none;
}

.bl_numSlider_ctrl_up:hover,
.bl_numSlider_ctrl_down:hover {
	background-color: #888;
}

.bl_numSlider_ctrl_up {
	background-color: #444;
}

.bl_numSlider_ctrl_down {
	background-color: #333;
}

.bl_numSlider_body {
	flex-grow: 1;
	position: relative;
	background-color: #555;
}

.bl_numSlider_filled {
	position: absolute;
	top: 0;
	left: 0;
	background-color: var(--color-primary);
	height: 100%;
}

.bl_numSlider_txt {
	color: white;
	position: absolute;
	z-index: 0;
	width: fit-content;
	top: 50%;
	left: 50%;
	transform: translateX(-50%) translateY(-50%);
	pointer-events: none;
	user-select: none;
	white-space: nowrap;
}

.bl_numSlider_rawInput {
	color: black;
	position: absolute;
	z-index: 0;
	text-align: center;
	width: 100px;
	top: 50%;
	left: 50%;
	transform: translateX(-50%) translateY(-50%);
}

.bl_numSlider_popup {
	z-index: 100;
	background-color: #444;
	top: 100%;
	position: absolute;
	width: 100%;
	padding: 10px;
}

.bl_numSlider_popup button {
	margin-right: 5px;
}
</style>

<script src="./index-script.ts"></script>
