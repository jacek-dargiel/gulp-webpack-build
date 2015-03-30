var path = require('path');
var webpack = require('webpack');
module.exports = {
	entry: {
		// codebase: 	'./js/main.js',
		offer: 		path.join(__dirname, 'index.js')
	},
	output: {
		filename: '[name].js'
	},
	resolve: {
		root: [path.join(__dirname, 'bower_components')]
	},
	plugins: [
		new webpack.ResolverPlugin(
			new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin('bower.json', ['main'])
		)
	],
	devtool: '#source-map',
};
