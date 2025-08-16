export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: process.env.BABEL_ENV === 'esm' ? false : 'commonjs',
      },
    ],
  ],
};
