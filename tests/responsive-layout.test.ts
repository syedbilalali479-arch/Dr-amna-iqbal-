import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../app/responsive.css',import.meta.url),'utf8');
const globals=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');

test('loads the final responsive stylesheet after feature styles',()=>{
 assert.match(globals,/@import "\.\/enhancements\.css";\s*@import "\.\/responsive\.css";/);
});

test('supports compact laptops, tablets, and phones',()=>{
 for(const breakpoint of ['1366px','1100px','900px','700px','430px'])assert.ok(css.includes(`max-width:${breakpoint}`),`missing ${breakpoint} breakpoint`);
 assert.match(css,/max-height:calc\(100dvh - 20px\)/);
 assert.match(css,/\.tableWrap\{width:100%;overflow-x:auto\}/);
});

test('mobile pharmacy and scanner controls use single-column layouts',()=>{
 assert.match(css,/\.barcodeBox\{grid-template-columns:1fr/);
 assert.match(css,/\.scanActions\{grid-template-columns:1fr\}/);
 assert.match(css,/\.simpleMedicine\{grid-template-columns:1fr\}/);
});
