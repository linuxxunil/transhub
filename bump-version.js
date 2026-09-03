#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'manifest.json');
const level = process.argv.includes('--major') ? 'major' : process.argv.includes('--minor') ? 'minor' : 'patch';

const m = JSON.parse(fs.readFileSync(file, 'utf8'));
let [x, y, z] = m.version.split('.').map(Number);

if (level === 'major') { x += 1; y = 0; z = 0; }
else if (level === 'minor') { y += 1; z = 0; }
else { z += 1; }

m.version = `${x}.${y}.${z}`;
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
console.log(`version (${level}) -> ${m.version}`);
