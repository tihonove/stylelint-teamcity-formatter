export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: '18' },
        modules: process.env.BABEL_ENV === 'esm' ? false : 'commonjs',
      },
    ],
  ],
  // Ensure CommonJS build exposes default export via module.exports
  plugins: process.env.BABEL_ENV === 'cjs' ? ['add-module-exports'] : [],
};
