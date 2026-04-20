import type { Configuration } from "webpack";
import nodeExternals from "webpack-node-externals";
import process from "process";
import path from "path";
import { fileURLToPath } from "url";
import { merge } from "webpack-merge";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const base: Configuration = {
  mode: process.env.NODE_ENV === "development" ? "development" : "production",
  externals: [nodeExternals()],
  devtool: "source-map",
  node: {
    __dirname: false,
    __filename: false,
  },
  module: {
    rules: [
      {
        test: /\.m?ts$/,
        exclude: /node_modules/,
        use: ["ts-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".mts", ".ts", ".js"],
  },
  watch: false,
};

const main = merge(base, {
  name: "background",
  target: "electron-renderer",
  entry: "./src/background.ts",
  output: {
    filename: "background.js",
    path: path.resolve(__dirname, "app"),
  },
});

const preload = merge(base, {
  name: "bridge",
  target: "electron-preload",
  entry: "./src/bridge.ts",
  output: {
    filename: "bridge.js",
    path: path.resolve(__dirname, "app"),
  },
});

export default [main, preload];
