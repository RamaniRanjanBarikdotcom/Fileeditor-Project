# Complex Markdown Document

This document tests advanced Markdown features including tables, code blocks, and blockquotes.

## Table Support

| Header 1     | Header 2     | Header 3     |
| ------------ | ------------ | ------------ |
| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |
| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |
| **Bold Row** | _Italic Row_ | `Code Row`   |

## Code Blocks

Below is a standard JavaScript code block.

```javascript
function greet(name) {
  return `Hello, ${name}!`;
}
console.log(greet('World'));
```

## Blockquotes

> This is a blockquote. It should be indented and styled appropriately in the output format.
> It can span multiple lines.
>
> And have multiple paragraphs.

## Images

This tests inline base64 image rendering (a 1x1 red pixel).

![Red Pixel](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==)
