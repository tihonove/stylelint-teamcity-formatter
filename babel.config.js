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
};
