import { chromium } from 'playwright-core';
const INIT = `
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1');
    localStorage.removeItem('oko-market-v3'); }catch(e){}
`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(INIT);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8211/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1800);
await p.evaluate(`okoSkipAuth(); showTab('mini'); openMa('market');`);
await p.waitForTimeout(700);

const cdp = await ctx.newCDPSession(p);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const doc = await cdp.send('DOM.getDocument');
const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#ma-market .mk2-back' });
const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId });
const hits = [];
for (const r of (m.matchedCSSRules || [])) {
  const txt = r.rule.style.cssText || '';
  if (/display\s*:/.test(txt)) hits.push({ sel: r.rule.selectorList.text, origin: r.rule.origin, href: r.rule.styleSheetId, css: txt.slice(0, 160) });
}
console.log(JSON.stringify(hits, null, 2));
console.log('inline:', JSON.stringify(m.inlineStyle && m.inlineStyle.cssText));
await b.close();
