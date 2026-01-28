import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Plotly.js into its own chunk (very large library)
          plotly: ['plotly.js'],
          'react-plotly': ['react-plotly.js']
        }
      }
    },
    // Increase chunk size warning limit since we're intentionally chunking
    chunkSizeWarningLimit: 1000
  },
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      // Extensive polyfills for full Plotly.js compatibility
      buffer: 'buffer',
      stream: 'stream-browserify',
      process: 'process/browser',
      util: 'util',
      events: 'events',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      url: 'url',
      punycode: 'punycode',
      querystring: 'querystring-es3',
      stream$http: 'stream-http',
      _stream_duplex: 'readable-stream/duplex',
      _stream_passthrough: 'readable-stream/passthrough',
      _stream_readable: 'readable-stream/readable',
      _stream_writable: 'readable-stream/writable',
      _stream_transform: 'readable-stream/transform',
      timers: 'timers-browserify',
      console: 'console-browserify',
      vm: 'vm-browserify',
      zlib: 'browserify-zlib',
      assert: 'assert',
      fs: 'memfs',
      tls: 'tls-browserify',
      net: 'net-browserify',
      http: 'stream-http',
      https: 'https-browserify',
      os: 'os-browserify',
      constants: 'constants-browserify',
      tty: 'tty-browserify',
      domain: 'domain-browser',
    },
  },
  optimizeDeps: {
    include: [
      'buffer',
      'stream-browserify',
      'process',
      'util',
      'events',
      'crypto-browserify',
      'plotly.js'
    ],
    esbuildOptions: {
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  }
})
