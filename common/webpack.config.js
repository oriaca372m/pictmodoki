const path = require('path')

module.exports = {
	mode: 'development',
	entry: './src/index.ts',
	output: {
		filename: 'index.js',
		library: 'seekable-unzipper',
		libraryTarget: 'umd',
		globalObject: 'this',
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
	},
}
