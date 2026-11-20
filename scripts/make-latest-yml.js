#!/usr/bin/env node
// Generates release/latest.yml for electron-updater (GitHub Releases publishing).
// Run after `npm run dist` whenever a new version is built:
//   node scripts/make-latest-yml.js
// Then upload ALL THREE files to a GitHub Release (tag = v<version>):
//   - AVA-Cable-Management-Setup-<version>.exe
//   - AVA-Cable-Management-Setup-<version>.exe.blockmap
//   - latest.yml
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version

const files = fs.readdirSync(path.join(root, 'release')).filter(f => f.endsWith('.exe') && f.includes(version))
if (!files.length) {
  console.error(`No installer EXE for v${version} found in release/. Run "npm run dist" first.`)
  process.exit(1)
}
const exe = files[0]
const exePath = path.join(root, 'release', exe)
const buf = fs.readFileSync(exePath)
const sha512 = crypto.createHash('sha512').update(buf).digest('base64')
const size = buf.length
const releaseDate = new Date().toISOString()

const yaml = `version: ${version}
files:
  - url: ${exe}
    sha512: ${sha512}
    size: ${size}
path: ${exe}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`
fs.writeFileSync(path.join(root, 'release', 'latest.yml'), yaml)
console.log(`release/latest.yml written for v${version} (${exe}, ${size} bytes)`)
