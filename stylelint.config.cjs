module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    // यह स्टाइलशीट जानबूझकर compact one-line format में लिखी गई है —
    // formatting rules को उसी house style के हिसाब से relax किया गया है,
    // जबकि असली गलतियाँ पकड़ने वाले rules on रहते हैं।
    "declaration-block-single-line-max-declarations": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "comment-empty-line-before": null,
    // legacy rgba()/hex-with-alpha notation is used throughout the design tokens
    "color-function-notation": null,
    "color-function-alias-notation": null,
    "alpha-value-notation": null,
    "color-hex-length": null,
    // (min-width:640px) colon-style is used everywhere
    "media-feature-range-notation": null,
    // selector order follows the UI, not specificity order
    "no-descending-specificity": null,
    // compact one-line declarations are the existing house style
    "declaration-block-no-redundant-longhand-properties": null,
    "shorthand-property-no-redundant-values": null
  }
};
