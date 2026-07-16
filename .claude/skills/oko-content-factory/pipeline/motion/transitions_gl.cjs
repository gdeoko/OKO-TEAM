// Render gl-transitions between frame pairs -> full-frame PNG sequences
// usage: node transitions_gl.js pairs.json
const { chromium } = require(process.env.RM_NODE_MODULES ? process.env.RM_NODE_MODULES + '/playwright' : 'playwright');
const transitions = require(process.env.RM_NODE_MODULES ? process.env.RM_NODE_MODULES + '/gl-transitions' : 'gl-transitions');
const fs = require('fs');

const pairs = JSON.parse(fs.readFileSync(process.argv[2] || 'pairs.json', 'utf8'));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.RM_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.setContent(`<!DOCTYPE html><html><head><style>*{margin:0}body{overflow:hidden}</style></head>
  <body><canvas id="cv" width="1080" height="1920"></canvas></body></html>`);

  await page.evaluate(`window.setupGL = (glslSrc, params, paramsTypes) => {
    const cv = document.getElementById('cv');
    const gl = window.gl = cv.getContext('webgl', { preserveDrawingBuffer: true });
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }');
    gl.compileShader(vs);
    const header = 'precision highp float;\\n' +
      'uniform sampler2D from, to; uniform float progress, ratio;\\n' +
      'vec4 getFromColor(vec2 uv){ return texture2D(from, uv); }\\n' +
      'vec4 getToColor(vec2 uv){ return texture2D(to, uv); }\\n';
    const footer = '\\nvoid main(){ vec2 uv = gl_FragCoord.xy / vec2(1080.0, 1920.0); gl_FragColor = transition(uv); }';
    const fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, header + glslSrc + footer);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) return 'FRAG ERR: ' + gl.getShaderInfoLog(fsh);
    const prog = window.prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fsh); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return 'LINK ERR: ' + gl.getProgramInfoLog(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(prog, 'ratio'), 1080/1920);
    for (const [k, v] of Object.entries(params || {})) {
      const u = gl.getUniformLocation(prog, k);
      if (u === null) continue;
      const ty = (paramsTypes || {})[k];
      if (ty === 'vec2') gl.uniform2fv(u, v);
      else if (ty === 'vec3') gl.uniform3fv(u, v);
      else if (ty === 'vec4') gl.uniform4fv(u, v);
      else if (ty === 'int' || ty === 'bool') gl.uniform1i(u, v|0);
      else gl.uniform1f(u, v);
    }
    return 'OK';
  }`);

  await page.evaluate(`window.loadTex = (name, dataUrl) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const gl = window.gl;
      const tex = gl.createTexture();
      gl.activeTexture(name === 'from' ? gl.TEXTURE0 : gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(window.prog, name), name === 'from' ? 0 : 1);
      res('ok');
    };
    img.src = dataUrl;
  })`);

  for (const job of pairs) {
    const t = transitions.find(x => x.name === job.transition);
    if (!t) { console.log('MISSING', job.transition); continue; }
    const st = await page.evaluate(`window.setupGL(${JSON.stringify(t.glsl)}, ${JSON.stringify(t.defaultParams)}, ${JSON.stringify(t.paramsTypes)})`);
    if (st !== 'OK') { console.log(job.transition, st.slice(0, 300)); continue; }
    const a64 = 'data:image/png;base64,' + fs.readFileSync(job.from).toString('base64');
    const b64 = 'data:image/png;base64,' + fs.readFileSync(job.to).toString('base64');
    await page.evaluate(`window.loadTex('from', ${JSON.stringify(a64)})`);
    await page.evaluate(`window.loadTex('to', ${JSON.stringify(b64)})`);
    fs.mkdirSync(job.out, { recursive: true });
    for (let i = 0; i < job.frames; i++) {
      const p = i / (job.frames - 1);
      await page.evaluate(`(() => {
        const gl = window.gl;
        gl.uniform1f(gl.getUniformLocation(window.prog, 'progress'), ${p});
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      })()`);
      const data = await page.evaluate(`document.getElementById('cv').toDataURL('image/png')`);
      fs.writeFileSync(`${job.out}/${String(i).padStart(3, '0')}.png`, Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log(job.transition, '->', job.out, 'done');
  }
  await b.close();
})();
