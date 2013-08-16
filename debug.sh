#!/bin/sh
node-inspector&
node --debug-brk tests/pul_composition_test.js
