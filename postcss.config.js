export default {
  plugins: {
    cssnano: {
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: true,
        minifySelectors: true,
      }],
    },
  },
};
