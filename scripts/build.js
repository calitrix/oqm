import { execSync } from 'child_process'
import esbuild from 'esbuild'

import pkg from '../package.json' assert { type: 'json' }

const watch = process.argv[2] === '--watch'

const makeConfig = (format) => ({
  entryPoints: ['./src/index.ts'],
  outfile: `./dist/index.${format}.js`,
  bundle: true,
  platform: 'node',
  format,
  watch,
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  plugins: [
    {
      name: 'TypeScriptDeclarationsPlugin',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) return
          execSync(
            'tsc --emitDeclarationOnly --declaration ./src/index.ts --outDir ./dist/types'
          )
        })
      },
    },
  ],
})

esbuild.build(makeConfig('esm'))
esbuild.build(makeConfig('cjs'))
