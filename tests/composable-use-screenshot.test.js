// Screenshot exports preserve per-element privacy masks and recover from
// cross-origin font embedding errors without retrying unrelated failures.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPngWithFontFallback, slugifyForFilename, freezeInfoMaskForCapture } from '../frontend/composables/use-screenshot.js';

const securityError = () => {
    const err = new Error("Failed to read the 'cssRules' property from 'CSSStyleSheet': Cannot access rules");
    err.name = 'SecurityError';
    return err;
};

describe('toPngWithFontFallback', () => {
    it('returns the first result when toPng succeeds', async () => {
        const calls = [];
        const toPng = async (el, opts) => { calls.push(opts); return 'data:png'; };
        const result = await toPngWithFontFallback(toPng, {}, { pixelRatio: 2 });
        assert.equal(result, 'data:png');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].skipFonts, undefined);
    });

    it('retries with skipFonts on SecurityError, keeping other options', async () => {
        const calls = [];
        const toPng = async (el, opts) => {
            calls.push(opts);
            if (calls.length === 1) throw securityError();
            return 'data:png-nofonts';
        };
        const result = await toPngWithFontFallback(toPng, {}, { pixelRatio: 2, cacheBust: true });
        assert.equal(result, 'data:png-nofonts');
        assert.equal(calls.length, 2);
        assert.deepEqual(calls[1], { pixelRatio: 2, cacheBust: true, skipFonts: true });
    });

    it('propagates non-SecurityError failures without retrying', async () => {
        let calls = 0;
        const toPng = async () => { calls += 1; throw new Error('render failed'); };
        await assert.rejects(
            () => toPngWithFontFallback(toPng, {}, {}),
            { message: 'render failed' },
        );
        assert.equal(calls, 1);
    });

    it('propagates a SecurityError thrown again by the retry', async () => {
        let calls = 0;
        const toPng = async () => { calls += 1; throw securityError(); };
        await assert.rejects(
            () => toPngWithFontFallback(toPng, {}, {}),
            { name: 'SecurityError' },
        );
        assert.equal(calls, 2);
    });
});

describe('slugifyForFilename', () => {
    it('lowercases and hyphenates arbitrary text', () => {
        assert.equal(slugifyForFilename('My IP — Report! 2026'), 'my-ip-report-2026');
    });

    it('falls back when nothing usable remains', () => {
        assert.equal(slugifyForFilename('***', 'image'), 'image');
        assert.equal(slugifyForFilename('', 'shot'), 'shot');
    });
});

it('image capture preserves stronger hero masking beside normal IPs and restores the page afterwards', () => {
    const originalDocument=globalThis.document,originalWindow=globalThis.window;
    const element=(tag,style=null)=>({
        tag,children:[],attributes:new Map(style===null?[]:[['style',style]]),
        getAttribute(name){return this.attributes.get(name)??null;},
        setAttribute(name,value){this.attributes.set(name,value);},
        removeAttribute(name){this.attributes.delete(name);},
        appendChild(child){this.children.push(child);child.parent=this;},
        remove(){this.parent.children=this.parent.children.filter(child=>child!==this);},
    });
    const hero=element('h1','color:red'),normal=element('span'),root=element('section');
    root.querySelectorAll=()=>[hero,normal];
    globalThis.document={documentElement:{hasAttribute:()=>true},createElementNS:(_namespace,tag)=>element(tag)};
    globalThis.window={getComputedStyle:target=>({getPropertyValue:()=>target===hero?'32px':''})};
    try {
        const restore=freezeInfoMaskForCapture(root),filters=root.children[0].children;
        assert.deepEqual(filters.map(filter=>filter.children[0].getAttribute('stdDeviation')),['32','7']);
        assert.notEqual(hero.getAttribute('style').match(/url\(([^)]+)\)/)[1],normal.getAttribute('style').match(/url\(([^)]+)\)/)[1]);
        restore();
        assert.equal(hero.getAttribute('style'),'color:red');assert.equal(normal.getAttribute('style'),null);
        assert.equal(root.children.length,0);
    } finally {
        if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
        if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
    }
});
