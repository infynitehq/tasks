// Lets bare Node run the app's TypeScript: resolves "@/x" and extension-less
// relative imports to their .ts files.
import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const root = path.resolve(fileURLToPath(import.meta.url), "../..")

export async function resolve(spec, ctx, next) {
  let target = null
  if (spec.startsWith("@/")) target = path.join(root, spec.slice(2))
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:"))
    target = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)
  if (target && !path.extname(target)) {
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(target + ext)) return next(pathToFileURL(target + ext).href, ctx)
    }
  }
  return next(spec, ctx)
}
