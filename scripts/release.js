import { execSync } from 'child_process'

import pkg from '../package.json' assert { type: 'json' }

const version = process.argv[2]
if (!['major', 'minor', 'patch'].includes(version)) {
  console.error('usage: node scripts/publish.js major|minor|patch')
}

// 1. ensure that the workspace is in a clean state
try {
  execSync('git diff-index --quiet HEAD')
} catch (error) {
  const out = error.stderr.toString()
  if (out) {
    console.error(out)
  } else {
    console.error(
      'You have uncommitted changes. Please commit and re-run this command.'
    )
  }
  process.exit()
}

// 2. lint, test and build
run('yarn pre-release')

// 3. bump versions
run(`yarn version ${version}`)
const appliedVersion = pkg.version

// 4. create release commit & tag
run('git add .')
run(`git commit -m v${appliedVersion}`)
run(`git tag v${appliedVersion}`)

// 5. publish
run('yarn npm publish')

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}
