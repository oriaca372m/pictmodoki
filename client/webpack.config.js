const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = {
	mode: 'development',
	target: 'web',
	entry: './src/main.ts',
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist'),
	},
	devtool: 'inline-source-map',
	devServer: {
		port: 25566,
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
				options: {
					appendTsSuffixTo: [/\.vue$/],
				},
			},
			{
				test: /\.css/,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.vue$/,
				loader: 'vue-loader',
			},
		],
	},
	resolve: {
		extensions: ['.wasm', '.ts', '.vue', '.mjs', '.js', '.json'],
		alias: {
			Src: path.resolve(__dirname, 'src/'),
		},
	},
	plugins: [
		new VueLoaderPlugin(),
		new HtmlWebpackPlugin({
			template: 'src/index.html.ejs',
			inject: 'head',
		}),
	],
}
