import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Compiler, Configuration, Resolver } from "webpack";
import webpack from "webpack";
// import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JSX_REGEXP = /\.jsx?$/;
const NODE_MODULES_REGEXP = /[/\\]node_modules(?:[/\\]|$)/;

/**
 * Support for resolving `.js` / `.jsx` paths to `.ts` / `.tsx` files,
 * @see {@link https://github.com/TypeStrong/ts-loader/issues/1110#issuecomment-631018701}
 */
class TsResolvePlugin {
  apply(resolver: Resolver): void {
    const file = resolver.ensureHook("file");
    // Look for matching extension, giving preference to `.ts` over `.tsx`
    for (const ext of [".ts", ".tsx"]) {
      resolver
        .getHook("raw-file")
        .tapAsync("TsResolvePlugin", (req, ctx, cb) => {
          // If it's in node_modules, abort
          if (!req.path || NODE_MODULES_REGEXP.test(req.path)) {
            return cb();
          }

          // Generate new path by replacing extension
          const newPath = req.path.replace(JSX_REGEXP, ext);

          // If unchanged, abort
          if (newPath === req.path) {
            return cb();
          }

          // Hand over to resolver with new path
          resolver.doResolve(
            file,
            // Replace the request with our tweaked path
            {
              ...req,
              path: newPath,
              relativePath: req.relativePath?.replace(JSX_REGEXP, ext),
            },
            `trying '${newPath}'`,
            ctx,
            cb,
          );
        });
    }
  }
}

function backtickEscape(string: string) {
  return string.replace(/([`\\]|\$\{)/g, `\\$&`);
}

class OutputDataToSrcPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.emit.tap("OutputDataToSrcPlugin", (compilation) => {
      //const code = readFileSync(`${__dirname}/bundle/ruru.min.js`, null);
      const code = compilation.assets["ruru.min.js"].source();
      writeFileSync(
        `${__dirname}/src/bundleData.ts`,
        `\
/* eslint-disable */
export const graphiQLContent: string = \`\\
${backtickEscape(code.toString("utf8").trim())}
\`;
`,
      );
    });
  }
}

const config: Configuration = {
  entry: "./src/bundle.mtsx",
  output: {
    // @ts-ignore
    path: `${__dirname}/bundle`,
    filename: "ruru.min.js",
    library: "RuruBundle",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          configFile: "tsconfig.build.json",
        },
        resolve: { plugins: [new TsResolvePlugin()] },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
        sideEffects: true,
      },
      {
        test: /\.svg$/,
        use: [{ loader: "svg-inline-loader" }],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: ["file-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".json", ".jsx", ".css", ".mjs"],
  },
  plugins: [
    // new BundleAnalyzerPlugin(),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new OutputDataToSrcPlugin(),
  ],
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  //stats: "detailed",
};

export default config;
