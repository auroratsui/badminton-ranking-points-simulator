import type { NextConfig } from 'next';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesPath = process.env.GITHUB_PAGES === 'true' && repositoryName ? `/${repositoryName}` : '';

const nextConfig: NextConfig = {
  basePath: githubPagesPath,
  assetPrefix: githubPagesPath,
};

export default nextConfig;
