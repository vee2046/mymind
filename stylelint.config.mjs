/** @type {import('stylelint').Config} */
export default {
  extends: 'stylelint-config-standard',
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'layer', 'theme', 'custom-variant'],
      },
    ],
    'color-hex-length': null,
    'hue-degree-notation': null,
    'import-notation': null,
    'lightness-notation': null,
    // -webkit-text-size-adjust / -webkit-user-select 为 iOS 兼容需要，保留前缀
    'property-no-vendor-prefix': null,
    'rule-empty-line-before': null,
    'value-keyword-case': null,
  },
};
