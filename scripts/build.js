import { execSync } from 'child_process'
import esbuild from 'esbuild'

import pkg from '../package.json' assert { type: 'json' }

const watch = process.argv[2] === '--watch'

const entryPoints = [
  './src/index.ts',
  './src/mapper/index.ts',
  './src/pg/index.ts',
  './src/runtypes/index.ts',
  './src/sql/index.ts',
  './src/utils/index.ts',
]

const makeConfig = (format) => ({
  entryPoints,
  outdir: `./dist/${format}`,
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
            `tsc --emitDeclarationOnly --declaration ./src/index.ts --outDir ./dist/${format}`
          )
        })
      },
    },
  ],
})

// esbuild.build(makeConfig('esm'))
esbuild.build(makeConfig('cjs'))
