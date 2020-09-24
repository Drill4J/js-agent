const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { CheckerPlugin } = require('awesome-typescript-loader');
console.log(process.env.NODE_ENV);
module.exports = {
  mode: process.env.NODE_ENV,
  target: 'node',
  externals: [nodeExternals()],
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'awesome-typescript-loader',
        exclude: /node_modules/,
      },
    ],
  },
  devtool: process.env.NODE_ENV === 'development' ? 'eval-source-map' : undefined,
  watch: process.env.NODE_ENV === 'development',
  plugins: [new CheckerPlugin()],
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
