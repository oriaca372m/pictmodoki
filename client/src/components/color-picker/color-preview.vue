<template>
	<div class="wrapper">
		<div class="body" :style="{ 'background-color': rgbCode }"></div>
	</div>
</template>

<style scoped>
.wrapper {
	width: 30px;
	height: 30px;
	background: url("data:image/svg+xml;charset=utf-8,%3csvg version='1.1' xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 2 2' preserveAspectRatio='none'%3e%3cpath fill='%23FFFFFF' d='M-1-1v4h4v-4z'/%3e%3cpath fill='%23DCDCDC' d='M0 0H1V1H0zM1 1H2V2H1z'/%3e%3c/svg%3e");
}

.body {
	width: 100%;
	height: 100%;
}
</style>

<script src="./color-preview-script"></script>
