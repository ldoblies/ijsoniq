#!/bin/sh
node-inspector&
node --debug-brk tests/pul_test.js
