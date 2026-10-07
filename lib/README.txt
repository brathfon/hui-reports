WARNING: this library is used by several scripts (create-web-export, aqualink, wqx, and the test
directory). If you make changes here, you need to test them in all of those scripts.

The modules are TypeScript. Run scripts that use them with tsx (node_modules/.bin/tsx), or
directly (./script.ts), since the scripts start with "#!/usr/bin/env -S npx tsx".
Type-check everything with: npx tsc --noEmit
