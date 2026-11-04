import { describe, expect, it } from 'vitest';
import { decodeSvg, findUnsafeSvgContent } from './svg-safety';

const svg = (inner: string, attributes = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"${attributes}>${inner}</svg>`;

describe('findUnsafeSvgContent', () => {
  it('accepts plain vector logos, including typical editor exports', () => {
    expect(findUnsafeSvgContent(svg('<path d="M0 0h10v10z" fill="#E8D3A8"/>'))).toBeNull();
    expect(
      findUnsafeSvgContent(
        `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Illustrator -->\n${svg(
          '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>' +
            '<style><![CDATA[.a{fill:url(#g)}]]></style></defs>' +
            '<g class="a" style="fill: url(\'#g\')"><use xlink:href="#p"/><text x="1" y="8">Meys &amp; Art</text></g>' +
            '<sodipodi:namedview xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" pagecolor="#fff"/>',
        )}`,
      ),
    ).toBeNull();
  });

  it.each([
    ['script element', svg('<script>alert(1)</script>')],
    ['namespaced script', svg('<svg:script>alert(1)</svg:script>')],
    ['event handler', svg('<rect onload="alert(1)"/>')],
    ['event handler on the root', svg('', ' onclick="alert(1)"')],
    ['event handler after a quoted ">"', svg('<rect title="a>b" onmouseover="x()"/>')],
    ['foreignObject', svg('<foreignObject><iframe src="https://evil.test"/></foreignObject>')],
    ['external image', svg('<image href="https://evil.test/x.png"/>')],
    ['data URL image', svg('<image xlink:href="data:image/svg+xml;base64,AAAA"/>')],
    ['external use', svg('<use href="other.svg#a"/>')],
    ['javascript link', svg('<a href="javascript:alert(1)"><text>x</text></a>')],
    ['entity-encoded javascript', svg('<use href="&#106;avascript:alert(1)"/>')],
    ['external url() in style attribute', svg('<rect style="fill:url(https://evil.test/a)"/>')],
    ['entity-encoded url()', svg('<rect style="fill:ur&#108;(https://evil.test/a)"/>')],
    ['external url() in stylesheet', svg('<style>rect{background:url(//evil.test/a)}</style>')],
    ['@import', svg('<style>@import "https://evil.test/a.css";</style>')],
    ['animation that rewrites href', svg('<set attributeName="href" to="#x"/>')],
    ['DOCTYPE with entities', `<!DOCTYPE svg [<!ENTITY x "y">]>${svg('')}`],
    ['processing instruction', `<?xml-stylesheet href="https://evil.test/a.css"?>${svg('')}`],
    ['non-svg root', '<html><body>hi</body></html>'],
    ['malformed markup', svg('<rect <script>')],
    ['empty document', ''],
  ])('rejects %s', (_label, input) => {
    expect(findUnsafeSvgContent(input)).not.toBeNull();
  });
});

describe('decodeSvg', () => {
  it('rejects invalid UTF-8', () => {
    expect(decodeSvg(Buffer.from([0x3c, 0xff, 0xfe]))).toBeNull();
    expect(decodeSvg(Buffer.from('<svg/>'))).toBe('<svg/>');
  });
});
