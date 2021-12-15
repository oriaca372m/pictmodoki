<template>
	<div id="root-view">
		<router-view></router-view>
	</div>
</template>

<style>
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

:root {
	--color-primary: #63aeff;
}

#root-view {
	width: 100%;
	height: 100%;
}

.el_triangleUp {
	width: 0;
	height: 0;
	border-style: solid;
	border-width: 0 calc(var(--triangle-size) / 2) var(--triangle-size)
		calc(var(--triangle-size) / 2);
	border-color: transparent transparent var(--triangle-color) transparent;
}

.el_triangleDown {
	width: 0;
	height: 0;
	border-style: solid;
	border-color: transparent transparent var(--triangle-color) transparent;
	border-width: var(--triangle-size) calc(var(--triangle-size) / 2) 0
		calc(var(--triangle-size) / 2);
	border-color: var(--triangle-color) transparent transparent transparent;
}

.el_center {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1ch;

	width: 100%;
	height: 100%;
}
</style>
