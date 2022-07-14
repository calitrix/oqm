const esbuild = require('esbuild')

const pkg = require('../package.json')

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
})

esbuild.build(makeConfig('esm'))
esbuild.build(makeConfig('cjs'))
