/* eslint-disable @typescript-eslint/no-require-imports */
import "./interfaces.js";

import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Extension } from "interpret";
import { jsVariants } from "interpret";

const extensions = Object.keys(jsVariants);

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    } else {
      throw e;
    }
  }
}

async function registerLoader(loader: Extension | null): Promise<void> {
  if (loader === null) {
    // noop
  } else if (Array.isArray(loader)) {
    let firstError;
    for (const entry of loader) {
      try {
        await registerLoader(entry);
        return;
      } catch (e) {
        if (!firstError) {
          firstError = e;
        }
      }
    }
    throw firstError ?? new Error(`Empty array handler`);
  } else if (typeof loader === "string") {
    require(loader);
  } else if (typeof loader === "object" && loader != null) {
    const loaderModule = require(loader.module);
    loader.register(loaderModule);
  } else {
    throw new Error("Unsupported loader");
  }
}

function fixESMShenanigans(requiredModule: any): any {
  if (
    typeof requiredModule.default === "object" &&
    requiredModule.default !== null &&
    !Array.isArray(requiredModule.default)
  ) {
    return requiredModule.default;
  }
  return requiredModule;
}

async function loadDefaultExport(resolvedPath: string, extension: string) {
  // Attempt to import using native TypeScript support if appropriate
  if (process.features.typescript && /\.[cm]?tsx?$/.test(extension)) {
    try {
      // Node has `require(esm)` support, but also for a `.cjsx` file it should
      // still use `require()`
      return fixESMShenanigans(require(resolvedPath));
    } catch (e) {
      if (e.code === "ERR_REQUIRE_ESM") {
        // This is the most likely result, since TypeScript uses ESM syntax.
        try {
          return (await import(pathToFileURL(resolvedPath).href)).default;
        } catch {
          // Nevermind; try a loader
        }
      }
      // Nevermind; try a loader
    }
  }

  // No luck? Let's try loading the loaders
  try {
    registerLoader(jsVariants[extension]);
  } catch (e) {
    console.error(`No loader could be loaded for ${extension} files: ${e}`);
  }

  // And now lets attempt to import
  try {
    return fixESMShenanigans(require(resolvedPath));
  } catch (e) {
    if (e.code === "ERR_REQUIRE_ESM") {
      // It's an ESModule, so `require()` won't work. Let's use `import()`!
      return (await import(pathToFileURL(resolvedPath).href)).default;
    } else {
      throw e;
    }
  }
}

export async function loadConfig(
  configPath?: string | null,
): Promise<GraphileConfig.Preset | null> {
  if (configPath != null) {
    // Explicitly load the file the user has indicated

    const resolvedPath = resolve(process.cwd(), configPath);

    // First try one of the supported loaders.
    for (const extension of extensions) {
      if (resolvedPath.endsWith(extension)) {
        try {
          return await loadDefaultExport(resolvedPath, extension);
        } catch {
          // Multiple extensions might match - e.g. both `.swc.tsx` and `.tsx`;
          // continue to the next one.
        }
      }
    }

    // Fallback to direct import
    return (await import(pathToFileURL(resolvedPath).href)).default;
  } else {
    // There's no config path; look for a `graphile.config.*`

    const basePath = resolve(process.cwd(), "graphile.config");
    for (const extension of extensions) {
      const resolvedPath = basePath + extension;
      if (await exists(resolvedPath)) {
        // This file exists; whatever happens, we will try this file only.
        try {
          return await loadDefaultExport(resolvedPath, extension);
        } catch {
          // Fallback to direct import
          return (await import(pathToFileURL(resolvedPath).href)).default;
        }
      }
    }
  }

  // No config found
  return null;
}
