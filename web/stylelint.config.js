// Stylelint config for the Styling rules in web/CLAUDE.md:
// token-only values, nesting at most 3 levels, no IDs, no !important, camelCase
// classes, and no @import.
//
// Dev dependencies (tested together; pinned in package.json):
//   stylelint 17.16.0, stylelint-config-standard-scss 17.0.0, stylelint-declaration-strict-value 1.12.1

// Literals allowed anywhere; every other value of these properties must be a token.
const ALLOWED_LITERALS = ['0', '1px', 'auto', 'none', 'inherit', 'transparent', 'currentColor', '/%$/']

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['stylelint-declaration-strict-value'],
  rules:   {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'fill', 'stroke', 'font-size', 'font-family', 'line-height', '/^margin/', '/^padding/', 'gap', 'border-radius', 'z-index'],
      { ignoreValues: ALLOWED_LITERALS },
    ],
    'max-nesting-depth':        3,
    'selector-max-id':          0,
    'declaration-no-important': true,
    'at-rule-disallowed-list':  ['import'],
    // The global sheet styles Mantine's and Tiptap's own classes (mantine-RichTextEditor-content).
    'selector-class-pattern':   null,
  },
  overrides: [
    {
      // A component's own module: camelCase classes, never bare element selectors.
      files: ['**/*.module.{css,scss}'],
      rules: {
        'selector-class-pattern': ['^[a-z][a-zA-Z0-9]*$', { message: 'Class names in modules are camelCase' }],
        'selector-max-type':      0,
      },
    },
  ],
}
