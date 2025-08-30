import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix lockfile warning by setting the output file tracing root
  outputFileTracingRoot: undefined,
  
  // Add headers for WASM files
  async headers() {
    return [
      {
        source: '/artifacts/:path*.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
    ];
  },
  
  // Suppress webpack warnings for web-worker dynamic imports
  webpack: (config, { isServer }) => {
    // Ignore the critical dependency warnings from snarkjs/ffjavascript
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };
    
    // Add fallbacks for node modules that aren't available in the browser
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          fs: false,
          net: false,
          tls: false,
          crypto: false,
        },
      };
    }

    // Ignore specific warnings
    config.ignoreWarnings = [
      {
        module: /node_modules\/web-worker/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/ffjavascript/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/@iden3/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/snarkjs/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
};

export default nextConfig;