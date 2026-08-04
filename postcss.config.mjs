/**
 * File: postcss.config.mjs
 * Purpose: Register Tailwind CSS with the PostCSS build pipeline.
 * Problem solved: Compiles project utility styles during development and production builds.
 */
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
