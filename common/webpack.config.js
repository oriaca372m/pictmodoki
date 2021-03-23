const path = require('path')

module.exports = {
	mode: 'development',
	target: 'web',
	entry: './src/index.ts',
	output: {
		filename: 'index.js',
		library: 'seekable-unzipper',
		libraryTarget: 'umd',
		path: path.resolve(__dirname, 'dist'),
	},
	devtool: 'inline-source-map',
	devServer: {
		contentBase: './dist',
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader',
			},
		],
	},
	resolve: {
		extensions: ['.wasm', '.ts', '.mjs', '.js', '.json'],
		alias: {
			Src: path.resolve(__dirname, 'src/'),
		},
	},
}
