<template>
	<div ref="bar" :class="['color-bar', `${type}-color-bar`]"
		@mouseenter="mouseenter"
		@mouseleave="mouseleave"
		@mousedown="mousedown($event)"
	>
		<div class="color-bar-cursor" :style="{ left: '10px', top: `${cursory}px` }"></div>
	</div>
</template>

<style scoped>
.color-bar {
	position: relative;
	width: 20px;
	height: 150px;
}

.hue-color-bar {
	background-image: linear-gradient(
		to bottom,
		hsl(0,100%,50%),
		hsl(60,100%,50%),
		hsl(120,100%,50%),
		hsl(180,100%,50%),
		hsl(240,100%,50%),
		hsl(300,100%,50%),
		hsl(360,100%,50%)
	);
}

.opacity-color-bar {
	background-image:
		linear-gradient(to bottom, #000000, transparent),
		url("data:image/svg+xml;charset=utf-8,%3csvg version='1.1' xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 2 2' preserveAspectRatio='none'%3e%3cpath fill='%23FFFFFF' d='M-1-1v4h4v-4z'/%3e%3cpath fill='%23DCDCDC' d='M0 0H1V1H0zM1 1H2V2H1z'/%3e%3c/svg%3e");
}

.color-bar-cursor {
	position: absolute;
	transform: translate(-50%, -50%);
	width: 10px;
	height: 4px;
	background-color: black;
	pointer-events: none;
}

.opacity-color-bar .color-bar-cursor {
	background-color: red;
}
</style>

<script src="./color-bar-script"></script>
