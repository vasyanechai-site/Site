module.exports = {
  apps: [
    {
      name: "site-api",
      script: "server/src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 8787,
      },
    },
  ],
};
