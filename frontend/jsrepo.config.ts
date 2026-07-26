import { defineConfig } from 'jsrepo'

export default defineConfig({
  registries: ['https://reactbits.dev/r'],
  paths: {
    component: 'src/components/reactbits',
    block: 'src/components/reactbits',
    lib: 'src/lib',
    hook: 'src/hooks',
    util: 'src/utils',
  },
})
