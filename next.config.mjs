/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    // Headers are not supported with 'output: export', but I'll keep them here for reference or if the user switches back.
    // Actually, Next.js will warn if headers are present with output: export.
    return [];
  },
  webpack: config => {
    config.module.rules.forEach(rule => {
      if (rule.oneOf) {
        rule.oneOf.forEach(oneOfRule => {
          if (
            oneOfRule.test &&
            oneOfRule.test.toString().includes('ts') &&
            oneOfRule.type === 'asset/resource'
          ) {
            oneOfRule.exclude = [/src\/workers/];
          }
        });
      }
    });
    return config;
  },
};

export default nextConfig;
