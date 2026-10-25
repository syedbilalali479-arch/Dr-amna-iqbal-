import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  ...(process.env.DEPLOY_TARGET==='railway'?{output:'standalone',distDir:'.next-railway'}:{}),
  webpack(config,{webpack}){config.resolve.alias['@/lib/runtime-env']=path.resolve(process.cwd(),'lib/node-runtime.ts');config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,path.resolve(process.cwd(),'lib/node-runtime.ts')));return config;},
};

export default nextConfig;
