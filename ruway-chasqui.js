/* GENERADO POR construir.js desde lib/chasqui/ · NO EDITAR A MANO */
/* El Chasqui del Mar — prototipo.
   cielo.js: utilidades comunes, el cielo y el CICLO DE LUZ (atardecer dorado → sol rojo que se
   hunde → hora azul → noche con luna grande, vía láctea y estrellas fugaces).

   El ciclo es un número h de 0 a 1 que el juego sube según el avance hacia el muelle.
   De h salen, interpolando entre "fotos" del cielo (CICLO), los colores del cielo, la luz del sol
   y de la luna, la neblina y la exposición. Todo lo demás (agua, costa, aves, avatar) lee esos
   mismos uniforms, así cambian juntos.

   El reflejo del agua sale de un cubemap del cielo (CubeCamera, 64–256 px según la calidad) que
   se vuelve a pintar cada medio segundo mientras el ciclo avanza: es más barato que calcular el
   cielo en cada píxel del agua. */
(function () {
'use strict';
var C = window.Chasqui = window.Chasqui || {};

/* ---------- utilidades ---------- */
C.azar = function (sem) { var s = sem >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
C.suave = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* ruido de valor que se repite cada "per" celdas (texturas sin costuras) */
C.ruidoPer = function (per, rnd) {
  var g = new Float32Array(per * per); for (var i = 0; i < g.length; i++) g[i] = rnd();
  return function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    var x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = g[y0 * per + x0], b = g[y0 * per + x1], c = g[y1 * per + x0], d = g[y1 * per + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
};
/* une geometrías en una sola (una llamada de dibujo); conserva uv si todas la tienen */
C.mezclar = function (geos) {
  var pos = [], nor = [], col = [], uv = [], conUV = geos.every(function (g) { return !!g.attributes.uv; });
  geos.forEach(function (g) {
    var gg = g.index ? g.toNonIndexed() : g, p = gg.attributes.position, n = gg.attributes.normal, c = gg.attributes.color, u = gg.attributes.uv;
    for (var i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) col.push(c.getX(i), c.getY(i), c.getZ(i)); else col.push(1, 1, 1);
      if (conUV) uv.push(u.getX(i), u.getY(i));
    }
    if (gg !== g) gg.dispose(); g.dispose();
  });
  var r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  r.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (conUV) r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  r.computeBoundingSphere(); return r;
};
C.pintar = function (g, hex) {
  var c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
};
C.lienzo = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
C.texDe = function (c, srgb, rep) {
  var t = new THREE.CanvasTexture(c); if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};
/* la orilla de Huanchaco: recta por la raíz del muelle; "b" = metros tierra adentro (negativo = mar).
   La arena queda a nivel del agua en b ≈ 13; el muro del malecón está en b = 20. */
C.ORILLA = { x: 150, z: -620, ux: -0.331, uz: -0.944 };
C.HACIA_MAR = { x: -0.944, z: 0.331 };
C.bOrilla = function (x, z) { return -((x - C.ORILLA.x) * C.HACIA_MAR.x + (z - C.ORILLA.z) * C.HACIA_MAR.z); };
C.aOrilla = function (x, z) { return (x - C.ORILLA.x) * C.ORILLA.ux + (z - C.ORILLA.z) * C.ORILLA.uz; };
C.reducido = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- calidad del equipo ----------
   Por núcleos, memoria y el nombre de la tarjeta de video: el que ya averiguó la página (nombre)
   o el del contexto del juego (gl); así no se abre otro contexto. ?q=bajo|medio|alto la fuerza.
   x.html lo averigua en su prueba de WebGL (antes de bajar el juego) y lo pasa como o.gpu. */
C.nombreGPU = function (gl) {
  try { var ext = gl.getExtension('WEBGL_debug_renderer_info'); return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); }
  catch (e) { return ''; }
};
C.calidad = function (gl, nombre) {
  var q = (location.search.match(/[?&]q=(bajo|medio|alto)/) || [])[1];
  if (q) return q;
  var nucleos = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  var gpu = typeof nombre === 'string' && nombre ? nombre : gl ? C.nombreGPU(gl) : '';
  C.gpu = gpu;
  if (/Mali-[4T]|Mali-G31|Mali-G51|Adreno \(TM\) [34]\d\d|Adreno \(TM\) 50\d|PowerVR SGX|PowerVR Rogue GE|SwiftShader/i.test(gpu)) return 'bajo';
  if (mem <= 2 || nucleos <= 4) return 'bajo';
  if (mem <= 4 || /Mali-G5|Mali-G6|Adreno \(TM\) 5|Adreno \(TM\) 6[01]\d/i.test(gpu)) return 'medio';
  return 'alto';
};
/* malla: celdas del mar · olas: cuántas de la lista · cubo: lado del cubemap · aves · rocas */
C.AJUSTES = {
  bajo:  { nombre: 'bajo',  malla: 96,  olas: 5,  pr: 1.0, aa: false, cubo: 64,  aves: 7,  gaviotas: 6,  destellos: 40,  casas: 140, detalle: 0 },
  medio: { nombre: 'medio', malla: 140, olas: 7,  pr: 1.5, aa: false, cubo: 128, aves: 9,  gaviotas: 10, destellos: 80,  casas: 220, detalle: 1 },
  alto:  { nombre: 'alto',  malla: 200, olas: 10, pr: 2.0, aa: true,  cubo: 256, aves: 11, gaviotas: 14, destellos: 140, casas: 300, detalle: 2 }
};

/* ---------- el ciclo de luz ----------
   Cada foto: h, altura del sol (grados), colores del cielo (lineales), luces y exposición. */
function v3(r, g, b) { return [r, g, b]; }
var CICLO = [
  { h: 0,   sol: 7,   zen: v3(.05, .075, .21), alto: v3(.25, .17, .31), hzSol: v3(1.75, .82, .27), hzLej: v3(.62, .44, .48), halo: v3(1.3, .55, .16),
    nubLuz: v3(1.8, .78, .3), nubSom: v3(.2, .12, .15), solI: 1, luzSol: v3(1, .72, .45), luzSolI: 2.2, hemiC: v3(1, .82, .7), hemiS: v3(.16, .22, .25), hemiI: .9, luna: 0, noche: 0, exp: .9, agua: 1 },
  { h: .3,  sol: 1.6, zen: v3(.03, .04, .14), alto: v3(.24, .1, .25), hzSol: v3(1.7, .42, .1), hzLej: v3(.5, .22, .36), halo: v3(1.5, .36, .07),
    nubLuz: v3(2.0, .52, .18), nubSom: v3(.2, .07, .12), solI: 1, luzSol: v3(1, .5, .28), luzSolI: 1.9, hemiC: v3(1, .66, .58), hemiS: v3(.15, .14, .2), hemiI: .78, luna: .05, noche: 0, exp: .95, agua: .9 },
  { h: .45, sol: -1.6, zen: v3(.018, .024, .1), alto: v3(.15, .06, .2), hzSol: v3(1.1, .24, .08), hzLej: v3(.3, .13, .3), halo: v3(.9, .18, .05),
    nubLuz: v3(1.6, .3, .14), nubSom: v3(.12, .05, .1), solI: 0, luzSol: v3(.95, .4, .32), luzSolI: .65, hemiC: v3(.8, .5, .62), hemiS: v3(.1, .1, .16), hemiI: .62, luna: .25, noche: .05, exp: 1.05, agua: .75 },
  { h: .62, sol: -7, zen: v3(.01, .018, .065), alto: v3(.035, .045, .13), hzSol: v3(.34, .13, .15), hzLej: v3(.075, .085, .17), halo: v3(.2, .06, .04),
    nubLuz: v3(.3, .12, .16), nubSom: v3(.035, .035, .065), solI: 0, luzSol: v3(.6, .4, .55), luzSolI: .12, hemiC: v3(.42, .5, .78), hemiS: v3(.05, .06, .1), hemiI: .5, luna: .65, noche: .4, exp: 1.25, agua: .55 },
  { h: .8,  sol: -14, zen: v3(.0015, .003, .013), alto: v3(.004, .007, .024), hzSol: v3(.04, .045, .08), hzLej: v3(.03, .04, .08), halo: v3(0, 0, 0),
    nubLuz: v3(.05, .055, .085), nubSom: v3(.012, .014, .026), solI: 0, luzSol: v3(.5, .5, .7), luzSolI: 0, hemiC: v3(.38, .46, .78), hemiS: v3(.03, .04, .07), hemiI: .42, luna: 1, noche: 1, exp: 1.3, agua: .4 },
  { h: 1,   sol: -18, zen: v3(.0015, .003, .013), alto: v3(.004, .007, .024), hzSol: v3(.04, .045, .08), hzLej: v3(.03, .04, .08), halo: v3(0, 0, 0),
    nubLuz: v3(.05, .055, .085), nubSom: v3(.012, .014, .026), solI: 0, luzSol: v3(.5, .5, .7), luzSolI: 0, hemiC: v3(.38, .46, .78), hemiS: v3(.03, .04, .07), hemiI: .42, luna: 1, noche: 1, exp: 1.3, agua: .4 }
];
var AZ_SOL = Math.atan2(-.62, -.78);                 /* el sol se pone adelante a la izquierda (mar adentro) */
var LUNA_DIR = new THREE.Vector3(.42, .12, -.9).normalize();   /* la luna sale sobre la tierra, adelante a la derecha */

C.U = {
  uT: { value: 0 }, uSol: { value: new THREE.Vector3() }, uLuna: { value: LUNA_DIR.clone() },
  uZen: { value: new THREE.Vector3() }, uAlto: { value: new THREE.Vector3() }, uHzSol: { value: new THREE.Vector3() }, uHzLej: { value: new THREE.Vector3() },
  uHalo: { value: new THREE.Vector3() }, uNubLuz: { value: new THREE.Vector3() }, uNubSom: { value: new THREE.Vector3() },
  uSolI: { value: 1 }, uLunaI: { value: 0 }, uNoche: { value: 0 }, uAguaLuz: { value: 1 },
  uNubes: { value: null }, uLunaTex: { value: null }, uEstrellas: { value: null }
};
/* une los uniforms del cielo con los propios de un material */
C.unif = function (extra) { var u = {}, k; for (k in C.U) u[k] = C.U[k]; for (k in extra) u[k] = extra[k]; return u; };

var LUZ = { sol: new THREE.Color(), hemiC: new THREE.Color(), hemiS: new THREE.Color(), solI: 0, hemiI: 0, luna: 0, exp: 1, h: -1 };
C.LUZ = LUZ;
function mezcla(a, b, k, nom, out) { var x = a[nom], y = b[nom]; out.set(x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k); }
C.ponerCiclo = function (h) {
  h = Math.max(0, Math.min(1, h)); LUZ.h = h;
  var i = 0; while (i < CICLO.length - 2 && h > CICLO[i + 1].h) i++;
  var a = CICLO[i], b = CICLO[i + 1], k = C.suave(a.h, b.h, h), U = C.U;
  var alt = (a.sol + (b.sol - a.sol) * k) * Math.PI / 180;
  U.uSol.value.set(Math.cos(alt) * Math.sin(AZ_SOL), Math.sin(alt), Math.cos(alt) * Math.cos(AZ_SOL));
  ['zen', 'alto', 'hzSol', 'hzLej', 'halo', 'nubLuz', 'nubSom'].forEach(function (n) { mezcla(a, b, k, n, U['u' + n.charAt(0).toUpperCase() + n.slice(1)].value); });
  function f(n) { return a[n] + (b[n] - a[n]) * k; }
  U.uSolI.value = f('solI'); U.uNoche.value = f('noche'); U.uAguaLuz.value = f('agua');
  /* la luna (disco, halo, camino en el agua) recién aparece cuando el sol se hunde: de día vale 0 */
  var bajoSol = C.suave(.5, -4, a.sol + (b.sol - a.sol) * k);
  U.uLunaI.value = f('luna') * bajoSol;
  /* la luna sube un poco mientras anochece */
  var la = (11 + 6 * C.suave(.45, 1, h)) * Math.PI / 180;
  U.uLuna.value.set(Math.cos(la) * .42, Math.sin(la), -Math.cos(la) * .9).normalize();
  LUZ.sol.setRGB(a.luzSol[0] + (b.luzSol[0] - a.luzSol[0]) * k, a.luzSol[1] + (b.luzSol[1] - a.luzSol[1]) * k, a.luzSol[2] + (b.luzSol[2] - a.luzSol[2]) * k);
  LUZ.hemiC.setRGB(a.hemiC[0] + (b.hemiC[0] - a.hemiC[0]) * k, a.hemiC[1] + (b.hemiC[1] - a.hemiC[1]) * k, a.hemiC[2] + (b.hemiC[2] - a.hemiC[2]) * k);
  LUZ.hemiS.setRGB(a.hemiS[0] + (b.hemiS[0] - a.hemiS[0]) * k, a.hemiS[1] + (b.hemiS[1] - a.hemiS[1]) * k, a.hemiS[2] + (b.hemiS[2] - a.hemiS[2]) * k);
  LUZ.solI = f('luzSolI'); LUZ.hemiI = f('hemiI'); LUZ.luna = U.uLunaI.value; LUZ.exp = f('exp'); LUZ.noche = f('noche');
};

/* ---------- GLSL del cielo ----------
   cielo(dir, detalle): detalle 1 = domo (estrellas, discos del sol y la luna); 0 = reflejo y neblina. */
C.GLSL_CIELO = [
  'uniform vec3 uSol, uLuna, uZen, uAlto, uHzSol, uHzLej, uHalo, uNubLuz, uNubSom;',
  'uniform float uSolI, uLunaI, uNoche, uT, uAguaLuz;',
  'uniform sampler2D uNubes, uLunaTex;',
  'uniform samplerCube uEstrellas;',
  'float hash3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
  'vec3 cielo(vec3 d, float detalle){',
  '  float y = d.y, h = max(y, 0.0);',
  '  float mu = dot(d, uSol), m = max(mu, 0.0);',
  '  vec2 hd = normalize(d.xz + vec2(1e-5)), hs = normalize(uSol.xz + vec2(1e-5));',
  '  float az = dot(hd, hs) * .5 + .5;',
  '  vec3 hz = mix(uHzLej, uHzSol, pow(az, 2.2));',
  '  vec3 c = mix(hz, uAlto, smoothstep(0.0, .2, h));',
  '  c = mix(c, uZen, smoothstep(.14, .62, h));',
  '  c += uHalo * (pow(m, 6.0) * .55 + pow(m, 70.0) * .9 * (.3 + .7 * uSolI) + pow(m, 700.0) * 1.4 * uSolI);',
  '  float ml = max(dot(d, uLuna), 0.0);',
  '  c += vec3(.5, .58, .78) * uLunaI * (pow(ml, 24.0) * .1 + pow(ml, 300.0) * .25);',
  '  if (y < 0.0) c = mix(c, hz * .62, smoothstep(0.0, -.06, y));',
  '  float nubA = 0.0;',
  '  if (y > .004) {',
  '    vec2 uv = d.xz / (y + .06) * .085;',
  '    uv.x *= .55; uv += vec2(uT * .0016, uT * .0004);',
  '    float den = texture2D(uNubes, uv).r;',
  '    float den2 = texture2D(uNubes, uv - hs * .035).r;',
  '    nubA = smoothstep(.40 + .14 * uNoche, .80, den) * smoothstep(.004, .09, y) * (1.0 - smoothstep(.35, .8, y) * .7) * (1.0 - .45 * uNoche);',
  '    float borde = clamp(.55 + (den - den2) * 4.0, 0.0, 1.0);',
  '    vec3 luz = uNubLuz * (.3 + .9 * pow(az, 3.0)) + uHalo * pow(m, 8.0) + vec3(.4, .45, .6) * uLunaI * (pow(ml, 6.0) * .5 + .05);',
  '    c = mix(c, mix(uNubSom, luz, borde * (.35 + .65 * pow(az, 1.5))), nubA * .92);',
  '  }',
  '  if (detalle > .5) {',
  '    float corte = smoothstep(-.004, .006, y);',
  /* estrellas: una por celda de una grilla 3D, pocas encendidas; titilan */
  /* estrellas tenues y vía láctea: pintadas una sola vez en un cubemap (las brillantes van aparte, en Points) */
  '    if (uNoche > .01 && y > -.02) {',
  '      vec3 cs = textureCube(uEstrellas, d).rgb;',
  '      float ext = smoothstep(-.01, .3, y);',
  '      float lun = 1.0 - smoothstep(.9, .995, dot(d, uLuna)) * .7 * uLunaI;',
      '      c += cs * uNoche * ext * lun * (1.0 - nubA * .8);',
  '    }',
  '    if (uSolI > .01) { float disco = smoothstep(.99968, .99984, mu); c = mix(c, vec3(12.0, 4.4, 1.1) * mix(.55, 1.0, smoothstep(0.0, .1, uSol.y)), disco * corte * uSolI); }',
  /* la luna grande, con sus mares */
  '    if (uLunaI > .01) {',
  '      float md = dot(d, uLuna); float disc = smoothstep(.99926, .99930, md);',
  '      vec3 ax = normalize(cross(uLuna, vec3(0.0, 1.0, 0.0))); vec3 ay = cross(ax, uLuna);',
  '      vec2 q = vec2(dot(d, ax), dot(d, ay)) / .0378;',
  '      vec3 tex = texture2D(uLunaTex, q * .49 + .5).rgb;',
  /* oscurece hacia el borde (limb darkening) y es más cálida cerca del horizonte */
  '      float ld = pow(max(0.0, 1.0 - dot(q, q)), .3);',
  '      vec3 tinte = mix(vec3(1.0, .86, .68), vec3(.95, .96, 1.0), smoothstep(.04, .22, uLuna.y));',
  '      vec3 lc = tex * tinte * (.55 + .45 * ld) * 1.55;',
  /* solo se atenúa un poco si está muy baja (la bruma del horizonte); las nubes no la tapan */
  '      c = mix(c, lc * mix(.55, 1.0, smoothstep(.02, .15, uLuna.y)), disc * corte * min(1.0, uLunaI * 1.6));',
  '    }',
  '  }',
  '  return c;',
  '}'
].join('\n');

/* ---------- textura de nubes (fbm repetible) ---------- */
function texNubes(N) {
  var rnd = C.azar(7), oct = [], i, x, y;
  for (i = 0; i < 6; i++) oct.push(C.ruidoPer(4 << i, rnd));
  var d = new Uint8Array(N * N * 4);
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var v = 0, a = .5, tot = 0;
    for (i = 0; i < 6; i++) { v += oct[i](x / N * (4 << i), y / N * (4 << i)) * a; tot += a; a *= .5; }
    v /= tot; var k = (y * N + x) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.max(0, Math.min(255, (v - .18) * 1.6 * 255)); d[k + 3] = 255;
  }
  var t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true; return t;
}
/* resplandor radial (para sol, luna, faroles, destellos: el "bloom" barato con sprites aditivos) */
C.texResplandor = (function () {
  var t = null;
  return function () {
    if (t) return t;
    var c = C.lienzo(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,255,255,.55)'); g.addColorStop(.35, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); t = new THREE.CanvasTexture(c); return t;
  };
})();

/* ---------- la luna (procedural): mares, cráteres con borde iluminado, rayos de un cráter brillante ---------- */
function texLuna(N) {
  var c = C.lienzo(N, N), x = c.getContext('2d'), rnd = C.azar(211), k = N / 512;
  var o = [C.ruidoPer(6, rnd), C.ruidoPer(12, rnd), C.ruidoPer(24, rnd), C.ruidoPer(48, rnd)];
  var im = x.createImageData(N, N), d = im.data, i, px, py;
  /* mares: manchas oscuras de borde irregular (ruido deformado), más en la mitad de arriba */
  var mares = [[.36, .3, .17], [.55, .26, .13], [.62, .45, .15], [.3, .55, .11], [.45, .62, .09], [.7, .66, .08]];
  for (py = 0; py < N; py++) for (px = 0; px < N; px++) {
    var u = px / N, v = py / N, f = o[0](u * 6, v * 6) * .5 + o[1](u * 12, v * 12) * .25 + o[2](u * 24, v * 24) * .15 + o[3](u * 48, v * 48) * .1;
    var mar = 0;
    for (i = 0; i < mares.length; i++) { var m = mares[i], dd = Math.hypot(u - m[0], v - m[1]) / m[2] + (o[1](u * 9 + i, v * 9) - .5) * 1.1 + (o[2](u * 20, v * 20 + i) - .5) * .5; mar = Math.max(mar, (1 - C.suave(.55, 1.15, dd)) * (.75 + .25 * o[0](u * 5 + i, v * 5))); }
    var b = 214 + (f - .5) * 70 - mar * 150, j = (py * N + px) * 4;
    d[j] = b; d[j + 1] = b * .985; d[j + 2] = b * .96 + mar * 6; d[j + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  /* cráteres: dentro del círculo, una media luna oscura (la pared en sombra) y otra clara (la pared con luz) */
  for (i = 0; i < 220; i++) {
    var r = (1 + Math.pow(rnd(), 3.5) * 18) * k, cx = rnd() * N, cy = rnd() * N, al = .08 + rnd() * .1;
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.clip();
    x.fillStyle = 'rgba(40,36,34,' + al * 1.6 + ')'; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.fillStyle = 'rgba(232,228,220,' + al * 1.4 + ')'; x.beginPath(); x.arc(cx + r * .32, cy + r * .32, r * .95, 0, 6.3); x.fill();
    x.restore();
    if (r > 8 * k) { x.strokeStyle = 'rgba(240,236,228,' + al + ')'; x.lineWidth = r * .12; x.beginPath(); x.arc(cx, cy, r * 1.04, .2, 1.9); x.stroke(); }
  }
  /* un cráter joven muy brillante con rayos */
  var tx = N * .42, ty = N * .8;
  for (i = 0; i < 26; i++) {
    var a = rnd() * 6.283, l = (60 + rnd() * 160) * k;
    var g = x.createLinearGradient(tx, ty, tx + Math.cos(a) * l, ty + Math.sin(a) * l);
    g.addColorStop(0, 'rgba(255,255,250,.16)'); g.addColorStop(1, 'rgba(255,255,250,0)');
    x.strokeStyle = g; x.lineWidth = (1 + rnd() * 2.5) * k; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + Math.cos(a) * l, ty + Math.sin(a) * l); x.stroke();
  }
  x.fillStyle = 'rgba(255,255,252,.85)'; x.beginPath(); x.arc(tx, ty, 6 * k, 0, 6.3); x.fill();
  x.fillStyle = 'rgba(60,58,55,.6)'; x.beginPath(); x.arc(tx + 1.5 * k, ty + 1.5 * k, 3 * k, 0, 6.3); x.fill();
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.LinearEncoding; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t;
}
/* estrellas tenues + vía láctea (con polvo oscuro y brillo difuso) pintadas una vez en un cubemap */
function hornearEstrellas(R, lado) {
  var esc = new THREE.Scene();
  var m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'varying vec3 vDir;',
      'float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),',
      '             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }',
      'float fbm(vec3 p){ float s = 0.0, a = .5; for (int i = 0; i < 6; i++){ s += vn(p) * a; p *= 2.07; a *= .5; } return s; }',
      'vec3 capa(vec3 d, float g, float dens){ vec3 p = d * g; vec3 cel = floor(p); vec3 f = fract(p) - .5; float h = h3(cel + g);',
      '  float s = step(1.0 - dens, h) * smoothstep(.45, .0, length(f)) * (.35 + 2.0 * pow(fract(h * 91.7), 4.0));',
      '  vec3 col = mix(vec3(.7, .8, 1.0), vec3(1.0, .86, .66), fract(h * 37.3)); return col * s; }',
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  vec3 mwN = normalize(vec3(.42, .5, -.76)); float b = dot(d, mwN);',
      '  float banda = exp(-b * b * 16.0), nucleo = exp(-b * b * 60.0);',
      '  float n = fbm(d * 3.5), polvo = fbm(d * 8.0 + 4.0);',
      /* en la banda hay más estrellas */
      '  vec3 st = capa(d, 420.0, .006 + .04 * banda) * .9 + capa(d, 760.0, .004 + .09 * banda) * .55 + capa(d, 1300.0, .02 * banda) * .45 + capa(d, 230.0, .004) * 1.2;',
      '  float mw = banda * (.45 + .9 * n) * (1.0 - smoothstep(.42, .7, polvo) * .8 * nucleo - smoothstep(.5, .75, polvo) * .4 * banda);',
      '  vec3 col = st * .12 * (1.0 - smoothstep(.42, .7, polvo) * banda * .7) + vec3(.36, .4, .6) * mw * .17 + vec3(.75, .62, .48) * nucleo * n * mw * .2;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  esc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), m));
  var rt = new THREE.WebGLCubeRenderTarget(lado, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  var cc = new THREE.CubeCamera(.1, 100, rt); esc.add(cc);
  var tm = R.toneMapping, enc = R.outputEncoding; R.toneMapping = THREE.NoToneMapping; R.outputEncoding = THREE.LinearEncoding;
  cc.update(R, esc);
  R.toneMapping = tm; R.outputEncoding = enc;
  esc.children[0].geometry.dispose(); m.dispose();
  return rt;
}
/* las estrellas brillantes: puntos nítidos que titilan (las muy brillantes destellan en cruz) */
var MW = new THREE.Vector3(.42, .5, -.76).normalize();
function puntosEstrellas(n) {
  var rnd = C.azar(307), pos = [], mag = [], col = [], fas = [], i = 0, v = new THREE.Vector3();
  while (pos.length < n * 3) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); var l = v.length(); if (l > 1 || l < .1) continue; v.divideScalar(l);
    /* la mitad se acerca a la banda de la vía láctea */
    if (rnd() < .45) { var bb = v.dot(MW); v.addScaledVector(MW, -bb * (.75 + rnd() * .2)).normalize(); }
    if (v.y < -.03) continue;
    pos.push(v.x * 900, v.y * 900, v.z * 900);
    var mg = Math.pow(rnd(), 3.2); mag.push(mg);
    var tt = rnd(); col.push(tt < .25 ? .72 : tt < .7 ? 1 : 1, tt < .25 ? .82 : tt < .7 ? .97 : .86, tt < .25 ? 1 : tt < .7 ? .95 : .68); fas.push(rnd() * 6.283);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('mag', new THREE.Float32BufferAttribute(mag, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('fase', new THREE.Float32BufferAttribute(fas, 1));
  var m = new THREE.ShaderMaterial({
    uniforms: C.unif({ uPr: { value: 1 } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float mag; attribute float fase; uniform float uPr, uT; varying vec3 vC; varying float vM; varying vec3 vD; varying float vTw; void main(){ vC = color; vM = mag; vD = normalize(position); vTw = .65 + .35 * sin(uT * (3.0 + fase) + fase * 7.0) * sin(uT * 1.7 + fase); if (mag > .93) vC *= vec3(1.0 + .25 * sin(uT * 9.0 + fase), 1.0 + .2 * sin(uT * 7.0 + fase * 3.0), 1.0 + .25 * sin(uT * 11.0 + fase * 5.0)); gl_PointSize = (3.0 + mag * mag * 9.0) * uPr * (mag > .93 ? 2.4 : 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uLuna; uniform float uNoche, uLunaI, uT; uniform sampler2D uNubes;',
      'varying vec3 vC; varying float vM; varying vec3 vD; varying float vTw;',
      'void main(){',
      '  vec2 c = gl_PointCoord - .5; float r = length(c);',
      /* núcleo chico muy brillante + halo suave (caída gaussiana: nada de cuadraditos) */
      '  float a = exp(-r * r * 90.0) * 1.6 + exp(-r * r * 16.0) * .22;',
      '  if (vM > .93) a += (max(0.0, 1.0 - abs(c.x) * 22.0) + max(0.0, 1.0 - abs(c.y) * 22.0)) * max(0.0, 1.0 - r * 2.0) * .55;',
      '  float y = vD.y; vec2 uv = vD.xz / (y + .06) * .085; uv.x *= .55; uv += vec2(uT * .0016, uT * .0004);',
      '  float nub = smoothstep(.40, .80, texture2D(uNubes, uv).r) * smoothstep(.004, .09, y);',
      '  float k = (.3 + vM * 2.2) * vTw * uNoche * smoothstep(-.01, .18, y) * (1.0 - smoothstep(.93, .997, dot(vD, uLuna)) * uLunaI * .95) * (1.0 - nub * .8);',
      '  gl_FragColor = vec4(vC * a * k, 1.0);',
      '}'
    ].join('\n')
  });
  var p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9;
  return p;
}

C.armarCielo = function (escena, R, ajuste) {
  C.U.uNubes.value = texNubes(256);
  C.U.uLunaTex.value = texLuna(ajuste.detalle >= 1 ? 512 : 256);
  var rtEstrellas = hornearEstrellas(R, ajuste.detalle >= 1 ? 512 : 256);
  C.U.uEstrellas.value = rtEstrellas.texture;
  var estrellas = puntosEstrellas(ajuste.detalle >= 2 ? 5500 : ajuste.detalle >= 1 ? 4000 : 2500);
  escena.add(estrellas); C.mEstrellas = estrellas.material;
  C.ponerCiclo(0);
  var vs = 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }';
  function matCielo(detalle) {
    return new THREE.ShaderMaterial({
      uniforms: C.unif({}), side: THREE.BackSide, depthWrite: false,
      vertexShader: vs,
      fragmentShader: C.GLSL_CIELO + '\nvarying vec3 vDir;\nvoid main(){ gl_FragColor = vec4(cielo(normalize(vDir), ' + detalle + '), 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
    });
  }
  var domo = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), matCielo('1.0'));
  domo.frustumCulled = false; domo.renderOrder = -10; escena.add(domo);

  /* cubemap del cielo para el reflejo del agua: escena aparte con un domo sin estrellas.
     Se pinta SIN tonemapping (el agua lo hace al final), en LDR: se comprime con /(1+c). */
  var escCubo = new THREE.Scene();
  var mCubo = new THREE.ShaderMaterial({
    uniforms: C.unif({}), side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: C.GLSL_CIELO + '\nvarying vec3 vDir;\nvoid main(){ vec3 c = cielo(normalize(vDir), 0.0); gl_FragColor = vec4(c / (1.0 + c), 1.0); }'
  });
  escCubo.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mCubo));
  var rtCubo = new THREE.WebGLCubeRenderTarget(ajuste.cubo, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  var camCubo = new THREE.CubeCamera(.1, 100, rtCubo);
  escCubo.add(camCubo);
  function pintarCubo() {
    var tm = R.toneMapping, enc = R.outputEncoding; R.toneMapping = THREE.NoToneMapping; R.outputEncoding = THREE.LinearEncoding;
    camCubo.update(R, escCubo);
    R.toneMapping = tm; R.outputEncoding = enc;
  }
  pintarCubo();

  /* sol y luna: resplandor aditivo (bloom barato) */
  var mGlSol = new THREE.SpriteMaterial({ map: C.texResplandor(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#FFB46A', fog: false });
  var glSol = new THREE.Sprite(mGlSol); glSol.scale.set(520, 520, 1); escena.add(glSol);
  /* halo de la luna: un anillo luminoso que empieza en el borde del disco (no lava sus mares) */
  var cH = C.lienzo(256, 256), xH = cH.getContext('2d'), gH = xH.createRadialGradient(128, 128, 0, 128, 128, 128);
  gH.addColorStop(0, 'rgba(255,255,255,0)'); gH.addColorStop(.145, 'rgba(255,255,255,0)'); gH.addColorStop(.16, 'rgba(255,255,255,.55)');
  gH.addColorStop(.28, 'rgba(255,255,255,.16)'); gH.addColorStop(.55, 'rgba(255,255,255,.04)'); gH.addColorStop(1, 'rgba(255,255,255,0)');
  xH.fillStyle = gH; xH.fillRect(0, 0, 256, 256);
  var mGlLuna = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cH), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, color: '#AFC0EA', fog: false });
  var glLuna = new THREE.Sprite(mGlLuna); glLuna.scale.set(760, 760, 1); glLuna.renderOrder = -8; escena.add(glLuna);

  /* estrella fugaz: un trazo que cruza el cielo de vez en cuando (solo de noche) */
  var gF = new THREE.PlaneGeometry(1, 1); gF.translate(-.5, 0, 0);
  var mF = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y * 2.0 - 1.0)); gl_FragColor = vec4(vec3(.9, .95, 1.0) * a * uA * 2.0, 1.0); }'
  });
  var fugaz = new THREE.Mesh(gF, mF); fugaz.visible = false; fugaz.frustumCulled = false; escena.add(fugaz);
  var fz = { t: 0, prox: 5, dur: 1.2, a: new THREE.Vector3(), b: new THREE.Vector3() }, vt = new THREE.Vector3();
  /* lo que usa la estrella fugaz en cada cuadro, creado una sola vez */
  var X1 = new THREE.Vector3(1, 0, 0), Z1 = new THREE.Vector3(0, 0, 1), fDir = new THREE.Vector3(), fN = new THREE.Vector3(), fOjo = new THREE.Vector3(), fCruz = new THREE.Vector3(), fQ = new THREE.Quaternion();
  C.forzarFugaz = function () { fz.prox = 0; };

  var cuboT = 0, hCubo = -1;
  return {
    domo: domo, cubo: rtCubo.texture,
    /* lo que no cuelga de la escena: los dos cubos (reflejo y estrellas) y la escena del reflejo */
    liberar: function () {
      rtCubo.dispose(); rtEstrellas.dispose();
      escCubo.children.forEach(function (o) { if (o.geometry) o.geometry.dispose(); });
      mCubo.dispose();
      [C.U.uNubes.value, C.U.uLunaTex.value].forEach(function (t) { if (t) t.dispose(); });
    },
    cuadro: function (dt, cam) {
      C.U.uT.value += dt;
      domo.position.copy(cam.position); estrellas.position.copy(cam.position); estrellas.visible = C.U.uNoche.value > .01;
      /* el reflejo se repinta solo si el cielo cambió */
      cuboT -= dt;
      if (cuboT <= 0 && Math.abs(LUZ.h - hCubo) > .002) { cuboT = .5; hCubo = LUZ.h; pintarCubo(); }
      var U = C.U;
      glSol.position.copy(cam.position).addScaledVector(U.uSol.value, 1500);
      mGlSol.opacity = U.uSolI.value * (.55 + .45 * C.suave(-.03, .05, U.uSol.value.y)) * .85;
      glSol.visible = mGlSol.opacity > .01;
      glLuna.position.copy(cam.position).addScaledVector(U.uLuna.value, 1500);
      mGlLuna.opacity = U.uLunaI.value * .45; glLuna.visible = mGlLuna.opacity > .01;
      /* fugaz */
      if (U.uNoche.value > .6 && !C.reducido) {
        fz.prox -= dt;
        if (fz.prox <= 0 && !fugaz.visible) {
          fz.prox = 6 + Math.random() * 8; fz.t = 0; fugaz.visible = true;
          var az = Math.atan2(-cam.getWorldDirection(vt).x, -vt.z) + Math.PI + (Math.random() - .5) * .45, el = .2 + Math.random() * .1;
          fz.a.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(90);
          var dz = (Math.random() < .5 ? -1 : 1);
          fz.b.set(Math.sin(az + dz * .35) * Math.cos(el - .08), Math.sin(el - .08), Math.cos(az + dz * .35) * Math.cos(el - .08)).multiplyScalar(90);
        }
      }
      if (fugaz.visible) {
        fz.t += dt; var k = fz.t / fz.dur;
        if (k >= 1) fugaz.visible = false;
        else {
          var cab = vt.copy(fz.a).lerp(fz.b, k);
          fugaz.position.copy(cam.position).add(cab);
          var dir = fDir.copy(fz.b).sub(fz.a).normalize(), largo = 14 * Math.min(1, k * 4);
          fugaz.scale.set(largo, .18, 1);
          fugaz.quaternion.setFromUnitVectors(X1, dir);
          /* que mire a la cámara: girar alrededor de su eje hasta que la normal apunte al ojo */
          var n = fN.copy(Z1).applyQuaternion(fugaz.quaternion), aOjo = fOjo.copy(cab).negate().normalize();
          var proy = aOjo.addScaledVector(dir, -aOjo.dot(dir)).normalize();
          var ang = Math.atan2(fCruz.crossVectors(n, proy).dot(dir), n.dot(proy));
          fugaz.quaternion.premultiply(fQ.setFromAxisAngle(dir, ang));
          mF.uniforms.uA.value = Math.sin(k * Math.PI);
        }
      }
    }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   mar.js: el agua. Olas Gerstner de varias escalas (oleaje de fondo + medianas + finas),
   ondas de detalle en tres capas, espuma que se queda un rato y se deshace en encaje, reflejo
   del cielo (cubemap), caminos de luz del sol y de la luna y destellos.

   La MISMA función de olas vive dos veces: en el vertex shader (para dibujar) y en
   Chasqui.altura() (para que el caballito, las cartas y los obstáculos floten donde está el agua).
   Si se cambia una, se cambia la otra. */
(function () {
'use strict';
var C = window.Chasqui;

/* L: largo (m) · A: alto (m) · ang: hacia dónde avanzan (−π/2 = hacia −Z, hacia la orilla) · Q: cuánto se afilan */
var OLAS = [
  { L: 62, A: .40, ang: -1.62, Q: .42 },
  { L: 41, A: .27, ang: -1.33, Q: .5 },
  { L: 27, A: .17, ang: -1.9, Q: .55 },
  { L: 18, A: .105, ang: -1.12, Q: .55 },
  { L: 12.5, A: .068, ang: -2.12, Q: .5 },
  { L: 8.6, A: .044, ang: -1.48, Q: .5 },
  { L: 6.1, A: .034, ang: -0.95, Q: .75 },
  { L: 4.3, A: .024, ang: -1.78, Q: .8 },
  { L: 3.1, A: .017, ang: -2.32, Q: .8 },
  { L: 2.2, A: .012, ang: -1.22, Q: .8 }
];
var NO = 5, K = [], W = [], DX = [], DZ = [], AA = [], QH = [], LL = [];
function prepararOlas(n) {
  NO = n;
  for (var i = 0; i < OLAS.length; i++) {
    var o = OLAS[i], k = 2 * Math.PI / o.L, amp = o.A * (C.reducido ? .55 : 1);
    K[i] = k; W[i] = Math.sqrt(9.8 * k); DX[i] = Math.cos(o.ang); DZ[i] = Math.sin(o.ang); AA[i] = amp; LL[i] = o.L;
    QH[i] = o.Q / (k * amp * n);
  }
}
/* la serie: una ola grande que viene de atrás y se puede "correr" */
var SERIE = { dx: 0, dz: -1, c: -9999, A: 0, W: 7.5 };
C.serie = SERIE;
var T = 0, CAM = { x: 0, z: 0 };
var D = { x: 0, y: 0, z: 0 };
function desplazar(px, pz) {
  var dist = Math.sqrt((px - CAM.x) * (px - CAM.x) + (pz - CAM.z) * (pz - CAM.z));
  var x = 0, y = 0, z = 0, bw = C.bOrilla(px, pz), costa = 1 - .85 * C.suave(-45, 10, bw);
  for (var i = 0; i < NO; i++) {
    /* cada ola se apaga lejos según su largo (las chicas antes): sin parpadeo en la malla gruesa */
    var fade = 1 - C.suave(LL[i] * 2 + 5, LL[i] * 6 + 20, dist);
    if (fade <= 0) continue;
    var f = K[i] * (DX[i] * px + DZ[i] * pz) - W[i] * T, c = Math.cos(f), s = Math.sin(f), a = AA[i] * fade * costa;
    x += QH[i] * a * DX[i] * c; z += QH[i] * a * DZ[i] * c; y += a * s;
  }
  if (SERIE.A > 0) { var sd = SERIE.dx * px + SERIE.dz * pz - SERIE.c; y += SERIE.A * Math.exp(-sd * sd / (SERIE.W * SERIE.W)); }
  D.x = x; D.y = y; D.z = z; return D;
}
C.altura = function (x, z) {
  var px = x, pz = z;
  for (var it = 0; it < 3; it++) { desplazar(px, pz); px = x - D.x; pz = z - D.z; }
  return desplazar(px, pz).y;
};

/* ---------- texturas (una vez) ---------- */
/* ondas chicas: un espectro de muchas ondas (más energía en las cortas, como el mar picado);
   normales en RGB, ruido para espuma en A. Repetible. */
function texOndas(N) {
  var rnd = C.azar(11), h = new Float32Array(N * N), ondas = [], i, x, y;
  var M = N >= 512 ? 72 : 48;
  for (i = 0; i < M; i++) {
    var f = 6 + Math.floor(Math.pow(rnd(), 1.2) * (N >= 512 ? 44 : 28)), ang = -Math.PI / 2 + (rnd() - .5) * 2.6;
    var fx = Math.round(Math.cos(ang) * f), fy = Math.round(Math.sin(ang) * f);
    if (!fx && !fy) fy = 1;
    var ff = Math.sqrt(fx * fx + fy * fy);
    ondas.push({ fx: fx, fy: fy, a: 1 / Math.pow(ff, 1.1), p: rnd() * 6.283, c: rnd() < .5 });
  }
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var v = 0;
    for (i = 0; i < ondas.length; i++) {
      var o = ondas[i], ph = 6.2832 * (o.fx * x + o.fy * y) / N + o.p, sn = Math.sin(ph);
      v += o.a * (o.c ? sn - .35 * sn * sn : sn);       /* crestas un poco más agudas que los valles */
    }
    h[y * N + x] = v;
  }
  var esp = [C.ruidoPer(8, rnd), C.ruidoPer(16, rnd), C.ruidoPer(32, rnd)];
  var d = new Uint8Array(N * N * 4), fuerza = 1.1 * N / 256;
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var hx = h[y * N + (x + 1) % N] - h[y * N + (x - 1 + N) % N], hy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    var nx = -hx * fuerza, ny = -hy * fuerza, l = Math.sqrt(nx * nx + ny * ny + 1), k = (y * N + x) * 4;
    d[k] = (nx / l * .5 + .5) * 255; d[k + 1] = (ny / l * .5 + .5) * 255; d[k + 2] = (1 / l * .5 + .5) * 255;
    var e = esp[0](x / N * 8, y / N * 8) * .5 + esp[1](x / N * 16, y / N * 16) * .3 + esp[2](x / N * 32, y / N * 32) * .2;
    d[k + 3] = Math.max(0, Math.min(255, (e - .3) * 2.2 * 255));
  }
  var t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t;
}
/* espuma: encaje de Voronoi (bordes de celdas) en R, burbujas en G; repetible */
function texEspuma(N) {
  var rnd = C.azar(23), P = [], n = 46, i, x, y;
  for (i = 0; i < n; i++) P.push([rnd() * N, rnd() * N]);
  var ruido = C.ruidoPer(16, rnd), d = new Uint8Array(N * N * 4);
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var f1 = 1e9, f2 = 1e9;
    for (i = 0; i < n; i++) {
      var dx = Math.abs(x - P[i][0]), dy = Math.abs(y - P[i][1]); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy;
      var dd = dx * dx + dy * dy; if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
    }
    var borde = Math.sqrt(f2) - Math.sqrt(f1), k = (y * N + x) * 4;
    var r = ruido(x / N * 16, y / N * 16);
    d[k] = Math.max(0, Math.min(255, (1 - C.suave(0, 7, borde)) * 255 * (.55 + .45 * r)));
    d[k + 1] = rnd() < .03 ? 255 : (r * 200) | 0; d[k + 2] = (r * 255) | 0; d[k + 3] = 255;
  }
  var t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
}
C.texEspuma = null; C.texOndas = null;

C.armarMar = function (escena, ajuste, cubo) {
  prepararOlas(ajuste.olas);
  C.texOndas = texOndas(ajuste.detalle >= 1 ? 512 : 256); C.texEspuma = texEspuma(256);
  var N = ajuste.malla, cerca = N * .3;
  var g = new THREE.PlaneGeometry(2, 2, N, N); g.rotateX(-Math.PI / 2);
  var pa = g.attributes.position;
  for (var i = 0; i < pa.count; i++) {
    var u = pa.getX(i), v = pa.getZ(i);
    pa.setX(i, (u < 0 ? -1 : 1) * (cerca * Math.abs(u) + 2600 * Math.pow(Math.abs(u), 5)));
    pa.setZ(i, (v < 0 ? -1 : 1) * (cerca * Math.abs(v) + 2600 * Math.pow(Math.abs(v), 5)));
  }
  g.computeBoundingSphere();
  var uOla = [], uOlaB = [];
  for (i = 0; i < 10; i++) { uOla.push(new THREE.Vector4(DX[i], DZ[i], K[i], AA[i])); uOlaB.push(new THREE.Vector3(QH[i], W[i], LL[i])); }
  var UA = C.unif({
    uCubo: { value: cubo }, uOndas: { value: C.texOndas }, uEspuma: { value: C.texEspuma },
    uOla: { value: uOla }, uOlaB: { value: uOlaB },
    uSerie: { value: new THREE.Vector4(0, -1, -9999, 0) }, uSerieW: { value: SERIE.W },
    uSolCol: { value: new THREE.Vector3(2.7, 1.12, .4) }, uLunaCol: { value: new THREE.Vector3(.8, .86, 1) },
    uHondo: { value: new THREE.Vector3(.006, .026, .04) }, uClaro: { value: new THREE.Vector3(.03, .11, .115) },
    uBote: { value: new THREE.Vector4(0, 0, 0, 0) }, uOrilla: { value: new THREE.Vector4(C.ORILLA.x, C.ORILLA.z, C.HACIA_MAR.x, C.HACIA_MAR.z) }, uRocas: { value: [] }, uNRocas: { value: 0 }, uAmb: { value: new THREE.Vector3(.3, .2, .25) }
  });
  for (i = 0; i < 6; i++) UA.uRocas.value.push(new THREE.Vector4(0, 0, 1, -1));
  C.rocasTodas = [];   /* obstaculos.js las llena; aquí se mandan al shader solo las 6 más cercanas */
  var VERT = [
    'uniform float uT;',
    'uniform vec4 uOla[10];',
    'uniform vec3 uOlaB[10];',
    'uniform vec4 uSerie;',
    'uniform float uSerieW;',
    'uniform vec4 uOrilla;',
    'varying vec3 vPos; varying vec3 vN; varying float vAlt; varying float vEsp; varying float vEdad;',
    /* cuánto se aprietan las crestas en el tiempo t (para la espuma) */
    'float apriete(vec2 p, float t, float dist){',
    '  float j = 0.0;',
    '  for (int i = 0; i < 3; i++) { vec4 o = uOla[i]; float fade = 1.0 - smoothstep(uOlaB[i].z * 2.0 + 5.0, uOlaB[i].z * 6.0 + 20.0, dist);',
    '    j += uOlaB[i].x * o.z * o.w * fade * sin(o.z * dot(o.xy, p) - uOlaB[i].y * t); }',
    '  return j;',
    '}',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vec2 p = wp.xz;',
    '  float dist = length(p - cameraPosition.xz);',
    '  float bw = -dot(p - uOrilla.xy, uOrilla.zw); float costa = 1.0 - .85 * smoothstep(-45.0, 10.0, bw);',
    '  vec3 d = vec3(0.0); vec3 n = vec3(0.0, 1.0, 0.0); float jac = 0.0;',
    '  for (int i = 0; i < NOLAS; i++) {',
    '    vec4 o = uOla[i]; vec3 b = uOlaB[i];',
    '    float fade = 1.0 - smoothstep(b.z * 2.0 + 5.0, b.z * 6.0 + 20.0, dist);',
    '    float f = o.z * dot(o.xy, p) - b.y * uT;',
    '    float c = cos(f), s = sin(f), A = o.w * fade * costa, q = b.x;',
    '    d.x += q * A * o.x * c; d.z += q * A * o.y * c; d.y += A * s;',
    '    float wa = o.z * A;',
    '    n.x -= o.x * wa * c; n.z -= o.y * wa * c; n.y -= q * wa * s;',
    '    jac += q * wa * s;',
    '  }',
    '  float sd = dot(uSerie.xy, p) - uSerie.z;',
    '  float gs = exp(-sd * sd / (uSerieW * uSerieW));',
    '  float hs = uSerie.w * gs;',
    '  d.y += hs;',
    '  float dh = -2.0 * sd / (uSerieW * uSerieW) * hs;',
    '  n.x -= uSerie.x * dh; n.z -= uSerie.y * dh;',
    '  wp.xyz += d;',
    '  vPos = wp.xyz; vN = n; vAlt = d.y;',
    /* espuma: la de ahora, y la que dejaron las crestas que pasaron hace 0,8 s y 1,7 s (más rala) */
    '  float f0 = clamp(jac * 1.5 - .6, 0.0, 1.0);',
    '#if NOLAS > 5',
    '  float f1 = clamp(apriete(p, uT - .8, dist) * 1.5 - .6, 0.0, 1.0) * .8;',
    '  float f2 = clamp(apriete(p, uT - 1.7, dist) * 1.5 - .6, 0.0, 1.0) * .55;',
    '#else',
    '  float f1 = 0.0, f2 = 0.0;',
    '#endif',
    '  float fv = max(f1, f2);',
    '  vEsp = max(f0, fv) + smoothstep(.7, 1.0, gs) * smoothstep(.5, 1.2, uSerie.w) * .9;',
    '  vEdad = f0 >= fv ? 0.0 : (f1 >= f2 ? .5 : 1.0);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');
  var FRAG = [
    'uniform vec3 uSol, uLuna; uniform float uSolI, uLunaI, uT, uAguaLuz;',
    'uniform samplerCube uCubo;',
    'uniform sampler2D uOndas, uEspuma, uNubes;',
    'uniform vec3 uSolCol, uLunaCol, uHondo, uClaro;',
    'uniform vec4 uBote; uniform vec4 uRocas[6]; uniform int uNRocas; uniform vec3 uAmb;',
    'varying vec3 vPos; varying vec3 vN; varying float vAlt; varying float vEsp; varying float vEdad;',
    /* el cubemap guarda el cielo comprimido c/(1+c); el sesgo (LOD) lo vuelve borroso con la distancia */
    'vec3 cubo(vec3 r, float b){ vec3 c = textureCube(uCubo, r, b).rgb; return c / max(vec3(.02), 1.0 - c); }',
    'vec2 nm(vec2 u){ return texture2D(uOndas, u).xy * 2.0 - 1.0; }',
    'void main(){',
    '  vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist;',
    '  vec2 uv = vPos.xz;',
    /* manchas grandes que cambian la fuerza del oleaje y el color: rompen el mosaico */
    '  float mac = texture2D(uNubes, uv * .0021 + vec2(uT * .0007, 0.0)).r;',
    '  float mac2 = texture2D(uNubes, uv * .0063 - vec2(0.0, uT * .001)).r;',
    /* cuatro escalas de ondas, cada una girada y corriendo en otra dirección */
    '  vec2 u1 = mat2(.96, .28, -.28, .96) * uv * .021 + uT * vec2(.003, -.011);',
    '  vec2 u2 = mat2(.4, .92, -.92, .4) * uv * .057 + uT * vec2(-.011, -.016);',
    '  vec2 u3 = mat2(-.6, .8, -.8, -.6) * uv * .16 + uT * vec2(.025, -.03);',
    '  vec2 u4 = mat2(.17, -.98, .98, .17) * uv * .43 + uT * vec2(-.045, -.06);',
    '  vec4 o1 = texture2D(uOndas, u1);',
    '  float cerca = 1.0 - smoothstep(10.0, 70.0, dist), medio = 1.0 - smoothstep(40.0, 260.0, dist);',
    '  vec2 dn = (o1.xy * 2.0 - 1.0) * .38 + nm(u2) * .5 * (.4 + .6 * medio);',
    '#if NOLAS > 5',
    '  dn += nm(u3) * .95 * (.25 + .75 * medio);',
    '#endif',
    '#if NOLAS > 6',
    '  dn += nm(u4) * .85 * cerca;',
    '#elif NOLAS < 6',
    '  dn += nm(u2 * 2.83) * .8 * (.25 + .75 * medio);',   /* en bajo: la misma textura a otra escala, una lectura menos */     /* "capilares" que el viento levanta cerca */
    '#endif',
    '  dn *= .85 + .3 * mac;',
    '  float det = (.13 + .09 * cerca) * mix(1.0, .55, smoothstep(60.0, 500.0, dist));',
    '  vec3 N = normalize(normalize(vN) + vec3(dn.x, 0.0, dn.y) * det);',
    /* Fresnel con una normal suavizada: con las finas, en vista rasante salían manchones claros y oscuros */
    '  vec3 Nf = normalize(normalize(vN) + vec3(dn.x, 0.0, dn.y) * det * .3);',
    '  float NdV = max(dot(Nf, V), 0.0);',
    '  float fres = .02 + .98 * pow(1.0 - NdV, 5.0);',   /* Schlick, F0 del agua */
    '  vec3 R = reflect(-V, N); R.y = abs(R.y) + .002; R = normalize(R);',
    '  float rug = clamp(log2(1.0 + dist * .02), 0.0, 5.0);',
    '  vec3 refl = cubo(R, rug);',
    /* el agua: azul verdoso profundo del Pacífico; en las crestas a contraluz, turquesa */
    '  vec3 hondo = mix(vec3(.0035, .016, .024), vec3(.004, .022, .022), mac2);',
    '  vec3 cuerpo = hondo * (uAmb * 3.0 + uSolCol * max(dot(N, uSol), 0.0) * .35 * uSolI) + vec3(.002, .006, .01) * uLunaI;',
    '  vec3 hacia = normalize(vec3(uSol.x, -.1, uSol.z));',
    '  float cresta = smoothstep(-.05, .45, vAlt);',
    '  float sss = pow(max(dot(-V, hacia), 0.0), 4.0) * cresta * (.4 + .6 * max(dot(N, -hacia), 0.0)) + cresta * .12;',
    '  cuerpo += vec3(.012, .085, .07) * (uSolCol * uSolI * .9 + uAmb) * sss;',
    '  vec3 col = mix(cuerpo, refl, fres);',
    /* sol y luna: muchos destellos chicos (normales finas, exponente alto) y un halo tenue */
    '  vec3 Hs = normalize(uSol + V), Hl = normalize(uLuna + V);',
    '  float ns = max(dot(N, Hs), 0.0), nl = max(dot(N, Hl), 0.0);',
    '  float brillo = mix(1.0, .35, smoothstep(0.0, 400.0, dist));',
    '  col += uSolCol * uSolI * (pow(ns, 2400.0) * 260.0 * brillo + pow(ns, 380.0) * 5.0 + pow(ns, 40.0) * .05) * fres * 12.0;',
    '  col += uLunaCol * uLunaI * smoothstep(.01, -.06, uSol.y) * (pow(nl, 2400.0) * 160.0 * brillo + pow(nl, 380.0) * 3.5 + pow(nl, 40.0) * .03) * fres * 12.0;',
    /* espuma: crestas que rompen (borreguitos dispersos) y la que dejan, en encaje */
    '  vec2 ue = uv * .16 + vec2(uT * .006, -uT * .01);',
    '  float lace = texture2D(uEspuma, ue).r * .7 + texture2D(uEspuma, ue * 2.3 + .4).r * .45;',
    '  float borrego = smoothstep(.55, .8, texture2D(uNubes, uv * .021 + vec2(uT * .004, -uT * .007)).r);',
    '  float e = smoothstep(.12, .45, vEsp) * borrego;',
    '  float umbral = mix(.15, .62, vEdad) + (1.0 - e) * .55;',
    '  float f = smoothstep(umbral, umbral + .18, lace + o1.a * .25) * e;',
    '  vec3 colEsp = uAmb * 2.4 + uSolCol * uSolI * .35 + uLunaCol * uLunaI * .1;',
    '  col = mix(col, colEsp, f * .92);',
    '  vec2 db = vPos.xz - uBote.xy; float cr = cos(uBote.z), sr = sin(uBote.z);',
    '  vec2 lb = vec2(cr * db.x - sr * db.y, sr * db.x + cr * db.y);',
    '  float eb = length(vec2(lb.x / .5, (lb.y + .2) / 1.9));',
    '  col *= mix(.6, 1.0, smoothstep(.7, 1.15, eb));',
    '  float anillo = smoothstep(.9, 1.0, eb) * (1.0 - smoothstep(1.0, 1.12 + uBote.w * .03, eb));',
    '  col = mix(col, colEsp * .8, anillo * smoothstep(.2, .6, lace) * .5);',
    '  for (int i = 0; i < 6; i++) { if (i >= uNRocas) break; vec4 r = uRocas[i];',
    '    float dr = length(vPos.xz - r.xy) / r.z;',
    '    float ar = (1.0 - smoothstep(1.0, 1.9 + .25 * sin(uT * 1.3 + r.x), dr)) * smoothstep(.85, 1.05, dr);',
    '    col = mix(col, colEsp, smoothstep(.3, .75, lace * .6 + o1.a * .6) * ar * .8); }',
    '  vec3 hz = cubo(normalize(vec3(-V.x, .012, -V.z)), 2.0);',
    '  col = mix(col, hz, smoothstep(220.0, 2400.0, dist) * .9);',
    '  gl_FragColor = vec4(col, 1.0);',
    '#if DEPURA == 1',
    '  gl_FragColor = vec4(vec3(fres), 1.0);',
    '#elif DEPURA == 2',
    '  gl_FragColor = vec4(refl * .5, 1.0);',
    '#elif DEPURA == 3',
    '  gl_FragColor = vec4(f, e, vEsp, 1.0);',
    '#elif DEPURA == 4',
    '  gl_FragColor = vec4(normalize(vN) * .5 + .5, 1.0);',
    '#endif',
    '#include <tonemapping_fragment>',
    '#include <encodings_fragment>',
    '}'
  ].join('\n');
  var mAgua = new THREE.ShaderMaterial({ uniforms: UA, defines: { NOLAS: ajuste.olas, DEPURA: +((location.search.match(/[?&]depura=(\d)/) || [])[1] || 0) }, vertexShader: VERT, fragmentShader: FRAG });
  var agua = new THREE.Mesh(g, mAgua);
  agua.frustumCulled = false; agua.renderOrder = -5;
  escena.add(agua);
  C.UA = UA;

  /* destellos: chispitas aditivas sobre el camino de luz (el "bloom" del agua, sin postproceso) */
  var ND = ajuste.destellos, gD = new THREE.BufferGeometry(), dPos = new Float32Array(ND * 3), dA = new Float32Array(ND), dV = [];
  for (i = 0; i < ND; i++) { dV.push({ t: Math.random(), d: .2 + Math.random() * .3, x: 0, y: -99, z: 0, s: 1 }); dPos[i * 3 + 1] = -99; }
  gD.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  gD.setAttribute('alfa', new THREE.BufferAttribute(dA, 1));
  var mD = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uPr: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float alfa; uniform float uPr; varying float vA; void main(){ vA = alfa; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(260.0 / -mv.z, 1.5, 9.0) * uPr * (.6 + alfa); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); float x = max(0.0, 1.0 - abs(c.x) * 9.0) * max(0.0, 1.0 - abs(c.y) * 2.2) + max(0.0, 1.0 - abs(c.y) * 9.0) * max(0.0, 1.0 - abs(c.x) * 2.2); float a = (exp(-r * r * 40.0) + x * .5) * vA; gl_FragColor = vec4(uCol * a, 1.0); }'
  });
  var destellos = new THREE.Points(gD, mD); destellos.frustumCulled = false; destellos.renderOrder = 4; escena.add(destellos);
  C.mDestellos = mD;
  var vDir = new THREE.Vector3();
  /* para ordenar las rocas por distancia sin crear funciones en cada cuadro */
  function porCerca(a, b) { return a.d - b.d; }

  return {
    agua: agua,
    cuadro: function (dt, cam) {
      T = C.U.uT.value;   /* el mismo reloj que el shader (lo avanza el cielo) */
      CAM.x = cam.position.x; CAM.z = cam.position.z;
      var paso = 1 / (N / 2) * cerca;
      agua.position.set(Math.round(cam.position.x / paso) * paso, 0, Math.round(cam.position.z / paso) * paso);
      UA.uSerie.value.set(SERIE.dx, SERIE.dz, SERIE.c, SERIE.A);
      var L = C.LUZ, U0 = C.U; UA.uSolCol.value.set(L.sol.r * 2.7, L.sol.g * 2.7 * .95, L.sol.b * 2.7 * .85);
      /* luz ambiente del agua (antes eran dos lecturas del cubemap por píxel) */
      UA.uAmb.value.copy(U0.uAlto.value).multiplyScalar(.3).addScaledVector(U0.uHzLej.value, .2).addScaledVector(U0.uHzSol.value, .06);
      /* espuma de rocas: solo las 6 más cercanas a la cámara */
      var rs = C.rocasTodas, n = 0;
      if (rs.length) {
        for (var j0 = 0; j0 < rs.length; j0++) { var r0 = rs[j0]; r0.d = (r0[0] - CAM.x) * (r0[0] - CAM.x) + (r0[1] - CAM.z) * (r0[1] - CAM.z); }
        rs.sort(porCerca);
        for (var j = 0; j < 6 && j < rs.length; j++) if (rs[j].d < 200 * 200) UA.uRocas.value[n++].set(rs[j][0], rs[j][1], rs[j][2] * 1.05, 0);
      }
      UA.uNRocas.value = n;
      /* destellos: van hacia la luz que más brilla (sol o luna) */
      var U = C.U, conSol = U.uSolI.value > U.uLunaI.value * .6, luz = conSol ? U.uSol.value : U.uLuna.value, fuerza = conSol ? U.uSolI.value : U.uLunaI.value;
      if (conSol) mD.uniforms.uCol.value.setRGB(1.6, .9, .45); else mD.uniforms.uCol.value.setRGB(.75, .82, 1.05);
      var az = Math.atan2(luz.x, luz.z);
      for (var i = 0; i < ND; i++) {
        var p = dV[i]; p.t += dt / p.d;
        if (p.t >= 1) {
          p.t = 0; p.d = .12 + Math.random() * .35;
          var r = 6 + Math.pow(Math.random(), 1.6) * 180, a = az + (Math.random() - .5) * (.05 + 2.5 / r);
          p.x = cam.position.x + Math.sin(a) * r; p.z = cam.position.z + Math.cos(a) * r; p.s = Math.random();
          p.y = C.altura(p.x, p.z) + .05;   /* duran un instante: la altura se toma al nacer */
        }
        dPos[i * 3] = p.x; dPos[i * 3 + 1] = p.y; dPos[i * 3 + 2] = p.z;
        dA[i] = Math.sin(p.t * Math.PI) * fuerza * (p.s > .3 ? 1 : .4) * (.5 + .5 * C.suave(-.05, .04, luz.y + .04));
      }
      gD.attributes.position.needsUpdate = true; gD.attributes.alfa.needsUpdate = true;
    }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   pueblo.js: los edificios del malecón de Huanchaco (genéricos, procedurales, sin copiar ninguno real).

   - Un atlas de fachada (canvas) con 8 módulos: ventanas con marco y postigos, con balcón, en arco,
     con toldo; puerta; y tres tiendas con letreros genéricos. Más una máscara: R vidrio,
     G elemento (conserva su color), B interior que se ve de noche.
   - Un shader reparte los módulos por piso y por vano en cada cara (las casas son cajas
     instanciadas con escala distinta): planta baja con puertas y tiendas, pisos de arriba con
     ventanas; estuco con manchas de humedad, cornisa clara y pretil; techo de cemento.
     De noche se prenden ventanas al azar, cálidas, con cortinas y lámparas sugeridas.
   - En "alto" se agregan tanques de agua y casetas en las azoteas (instancias).
   En "bajo" se usa la versión simple de costa.js (ventanas pintadas en el shader). */
(function () {
'use strict';
var C = window.Chasqui;

function atlas() {
  var W = 1024, H = 512, cw = 256, ch = 256;
  var col = C.lienzo(W, H), x = col.getContext('2d'), mas = C.lienzo(W, H), m = mas.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
  var rnd = C.azar(131);
  function caja(px, py, w, h, color, glass, interior) {
    x.fillStyle = color; x.fillRect(px, py, w, h);
    m.fillStyle = glass ? 'rgb(255,255,' + (interior || 0) + ')' : 'rgb(0,255,0)'; m.fillRect(px, py, w, h);
  }
  function vidrio(px, py, w, h, cortina) {
    var g = x.createLinearGradient(px, py, px + w, py + h); g.addColorStop(0, '#2E3A48'); g.addColorStop(.5, '#1A222C'); g.addColorStop(1, '#3A4656');
    x.fillStyle = g; x.fillRect(px, py, w, h);
    m.fillStyle = 'rgb(255,0,40)'; m.fillRect(px, py, w, h);
    /* interior sugerido en B: cortinas a los lados, lámpara arriba, un mueble abajo */
    m.fillStyle = 'rgb(255,0,200)'; m.fillRect(px + w * .3, py + h * .1, w * .4, h * .55);
    m.fillStyle = 'rgb(255,0,255)'; m.beginPath(); m.arc(px + w * .5, py + h * .2, w * .12, 0, 6.3); m.fill();
    if (cortina) { m.fillStyle = 'rgb(255,0,110)'; m.fillRect(px, py, w * .22, h); m.fillRect(px + w * .78, py, w * .22, h); x.fillStyle = 'rgba(200,170,140,.35)'; x.fillRect(px, py, w * .22, h); x.fillRect(px + w * .78, py, w * .22, h); }
    m.fillStyle = 'rgb(255,0,60)'; m.fillRect(px + w * .1, py + h * .78, w * .8, h * .22);
  }
  function marco(px, py, w, h, color, g) { x.strokeStyle = color; x.lineWidth = g; x.strokeRect(px, py, w, h); m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = g; m.strokeRect(px, py, w, h); }
  function sombra(px, py, w, h) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(px, py, w, h); }
  var MADERA = ['#2F5F7A', '#6B3B26', '#3E6B4A', '#7A2E2E'];
  for (var k = 0; k < 8; k++) {
    var cx = (k % 4) * cw, cy = Math.floor(k / 4) * ch, ox, oy, w, h;
    var mad = MADERA[k % 4];
    if (k === 0) { /* ventana con marco, alféizar y postigos */
      ox = cx + 78; oy = cy + 60; w = 100; h = 120;
      vidrio(ox, oy, w, h, true); marco(ox, oy, w, h, '#EDE6D8', 8);
      x.fillStyle = '#EDE6D8'; x.fillRect(ox + w / 2 - 3, oy, 6, h); m.fillStyle = 'rgb(0,255,0)'; m.fillRect(ox + w / 2 - 3, oy, 6, h);
      caja(ox - 34, oy - 4, 30, h + 8, mad); caja(ox + w + 4, oy - 4, 30, h + 8, mad);
      for (var l = 0; l < 10; l++) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(ox - 34, oy + 6 + l * 12, 30, 3); x.fillRect(ox + w + 4, oy + 6 + l * 12, 30, 3); }
      caja(ox - 10, oy + h + 2, w + 20, 10, '#E2DACB'); sombra(ox - 10, oy + h + 12, w + 20, 6);
    } else if (k === 1) { /* ventana alta con balcón de fierro y macetas */
      ox = cx + 70; oy = cy + 40; w = 116; h = 170;
      vidrio(ox, oy, w, h, true); marco(ox, oy, w, h, '#F1ECE2', 8);
      caja(ox - 26, oy + h - 8, w + 52, 12, '#C9BFAE'); sombra(ox - 26, oy + h + 4, w + 52, 10);
      x.strokeStyle = '#1E1E22'; x.lineWidth = 4; m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = 4;
      [x, m].forEach(function (c) { c.beginPath(); c.moveTo(ox - 24, oy + h - 70); c.lineTo(ox + w + 24, oy + h - 70); c.stroke(); for (var b = 0; b <= 14; b++) { c.beginPath(); c.moveTo(ox - 24 + b * (w + 48) / 14, oy + h - 70); c.lineTo(ox - 24 + b * (w + 48) / 14, oy + h - 8); c.stroke(); } });
      ['#C0392B', '#E67E22', '#8E44AD'].forEach(function (fl, i) { caja(ox - 12 + i * 52, oy + h - 30, 22, 20, '#9A5B3A'); x.fillStyle = '#3D7A3A'; x.beginPath(); x.arc(ox - 1 + i * 52, oy + h - 34, 12, 0, 6.3); x.fill(); x.fillStyle = fl; x.beginPath(); x.arc(ox + 2 + i * 52, oy + h - 40, 5, 0, 6.3); x.fill(); m.fillStyle = 'rgb(0,255,0)'; m.beginPath(); m.arc(ox - 1 + i * 52, oy + h - 34, 13, 0, 6.3); m.fill(); });
    } else if (k === 2) { /* ventana doble en arco con moldura */
      ox = cx + 66; oy = cy + 58; w = 124; h = 130;
      x.save(); x.beginPath(); x.moveTo(ox, oy + h); x.lineTo(ox, oy + 40); x.arc(ox + w / 2, oy + 40, w / 2, Math.PI, 0); x.lineTo(ox + w, oy + h); x.closePath(); x.clip(); vidrio(ox, oy - 30, w, h + 30, false); x.restore();
      m.save(); m.beginPath(); m.moveTo(ox, oy + h); m.lineTo(ox, oy + 40); m.arc(ox + w / 2, oy + 40, w / 2, Math.PI, 0); m.lineTo(ox + w, oy + h); m.closePath(); m.clip(); m.fillStyle = 'rgb(255,0,90)'; m.fillRect(ox, oy - 30, w, h + 30); m.restore();
      x.strokeStyle = '#EFE8DA'; x.lineWidth = 10; x.beginPath(); x.moveTo(ox, oy + h); x.lineTo(ox, oy + 40); x.arc(ox + w / 2, oy + 40, w / 2, Math.PI, 0); x.lineTo(ox + w, oy + h); x.stroke();
      m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = 10; m.beginPath(); m.moveTo(ox, oy + h); m.lineTo(ox, oy + 40); m.arc(ox + w / 2, oy + 40, w / 2, Math.PI, 0); m.lineTo(ox + w, oy + h); m.stroke();
      caja(ox + w / 2 - 3, oy - 10, 6, h + 10, '#EFE8DA'); caja(ox - 12, oy + h, w + 24, 12, '#E6DECF');
    } else if (k === 3) { /* ventana con toldo a rayas */
      ox = cx + 76; oy = cy + 80; w = 104; h = 110;
      vidrio(ox, oy, w, h, true); marco(ox, oy, w, h, '#ECE5D7', 7);
      for (var r = 0; r < 8; r++) { x.fillStyle = r % 2 ? '#F2EADB' : '#1F6E8C'; x.beginPath(); x.moveTo(ox - 14 + r * (w + 28) / 8, oy - 46); x.lineTo(ox - 14 + (r + 1) * (w + 28) / 8, oy - 46); x.lineTo(ox - 14 + (r + 1) * (w + 28) / 8 + 4, oy - 8); x.lineTo(ox - 14 + r * (w + 28) / 8 + 4, oy - 8); x.fill(); }
      m.fillStyle = 'rgb(0,255,0)'; m.fillRect(ox - 14, oy - 46, w + 32, 40); sombra(ox, oy, w, 16);
    } else if (k === 4) { /* puerta de madera con montante y farolito */
      ox = cx + 82; oy = cy + 70; w = 92; h = 186;
      caja(ox, oy, w, h, mad); marco(ox, oy, w, h, '#EFE8DA', 10);
      for (var p2 = 0; p2 < 2; p2++) for (var q2 = 0; q2 < 3; q2++) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.strokeRect(ox + 10 + p2 * 38, oy + 40 + q2 * 46, 34, 40); }
      vidrio(ox + 6, oy + 6, w - 12, 26, false);
      caja(ox + w + 14, oy + 20, 10, 18, '#2A2624'); x.fillStyle = '#FFD58A'; x.fillRect(ox + w + 15, oy + 24, 8, 10); m.fillStyle = 'rgb(255,0,255)'; m.fillRect(ox + w + 15, oy + 24, 8, 10);
      caja(ox - 8, oy + h - 4, w + 16, 8, '#B9AE9C');
    } else { /* tiendas con letrero genérico */
      var NOM = ['BODEGA', 'CEVICHERÍA', 'HOSPEDAJE', 'PANADERÍA'][k - 5], FONDO = ['#1F5F8B', '#B83A2E', '#2E6B4A', '#8A5A2B'][k - 5];
      ox = cx + 22; oy = cy + 92; w = 212; h = 150;
      vidrio(ox, oy, w, h, false); marco(ox, oy, w, h, '#2A2624', 8);
      caja(ox + w * .38, oy + 10, 4, h - 10, '#2A2624');
      caja(cx + 14, cy + 30, 228, 46, FONDO); marco(cx + 14, cy + 30, 228, 46, '#F2EADB', 4);
      x.fillStyle = '#FFF4DE'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(NOM, cx + 128, cy + 54);
      sombra(cx + 14, cy + 76, 228, 8);
    }
  }
  var tc = C.texDe(col, true, false), tm = C.texDe(mas, false, false);
  [tc, tm].forEach(function (t) { t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; });
  return { color: tc, masc: tm };
}

C.armarPueblo = function (grupo, ajuste, enOrilla, giroOrilla) {
  var AT = atlas();
  /* la caja de cada casa: cuerpo + cornisa + pretil (una geometría, atributo "parte") */
  var geos = [], partes = [];
  function pieza(g0, parte) { var g = g0.toNonIndexed(); g0.dispose(); var n = g.attributes.position.count; geos.push(g); for (var i = 0; i < n; i++) partes.push(parte); }
  pieza(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), 0);
  pieza(new THREE.BoxGeometry(1.04, .035, 1.04).translate(0, .955, 0), 1);
  pieza(new THREE.BoxGeometry(1.03, .06, .03).translate(0, 1.03, .5), 1);
  pieza(new THREE.BoxGeometry(1.03, .06, .03).translate(0, 1.03, -.5), 1);
  pieza(new THREE.BoxGeometry(.03, .06, 1.03).translate(.5, 1.03, 0), 1);
  pieza(new THREE.BoxGeometry(.03, .06, 1.03).translate(-.5, 1.03, 0), 1);
  var g = C.mezclar(geos.map(function (gg) { return C.pintar(gg, '#ffffff'); }));
  g.setAttribute('parte', new THREE.Float32BufferAttribute(partes, 1));

  var mat = new THREE.ShaderMaterial({
    uniforms: C.unif({ uFach: { value: AT.color }, uMasc: { value: AT.masc } }), vertexColors: true,
    vertexShader: [
      'attribute float parte;',
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl; varying float vParte; varying float vY;',
      'void main(){',
      '  vec4 p = instanceMatrix * vec4(position, 1.0);',
      '  vEsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
      '  vSem = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
      '  vCol = instanceColor; vUv = uv; vNl = normal; vParte = parte; vY = position.y;',
      '  vec4 wp = modelMatrix * p; vPos = wp.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: C.GLSL_CIELO + [
      '',
      'uniform sampler2D uFach, uMasc;',
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl; varying float vParte; varying float vY;',
      'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  vec3 V = vPos - cameraPosition; float d = length(V); V /= d;',
      '  vec3 n = normalize(vN);',
      /* estuco: manchas grandes y humedad abajo */
      '  float est = texture2D(uNubes, vPos.xy * .045 + vPos.zy * .045).r;',
      '  float est2 = texture2D(uNubes, vPos.xz * .21 + vPos.y * .17).r;',
      '  vec3 muro = vCol * (.78 + .3 * est) * (.92 + .12 * est2);',
      '  float alto = vY * vEsc.y;',
      '  muro *= 1.0 - (1.0 - smoothstep(0.0, 1.4, alto)) * .3;',
      '  vec3 base = muro; float vid = 0.0, inter = 0.0, lit = 0.0;',
      '  if (vParte > .5) base = mix(vCol, vec3(.95, .93, .88), .6) * (.9 + .1 * est);',
      '  else if (abs(vNl.y) > .5) base = vec3(.42, .41, .4) * (.7 + .4 * est) * (.9 + .2 * est2);',
      '  else {',
      '    float an = abs(vNl.x) > .5 ? vEsc.z : vEsc.x;',
      '    vec2 q = vec2(vUv.x * an, vUv.y * vEsc.y);',
      '    float pisos = max(1.0, floor(vEsc.y / 2.9)), vanos = max(1.0, floor(an / 3.3 + .5));',
      '    vec2 tam = vec2(an / vanos, vEsc.y / pisos);',
      '    vec2 cel = floor(q / tam); vec2 f = fract(q / tam);',
      '    float hh = h2(cel + vSem * 31.0);',
      '    float frente = step(.5, -vNl.z);',                 /* la cara que mira al mar */
      '    float idx = cel.y < .5 && frente > .5 ? 4.0 + floor(hh * 3.99) : floor(hh * 3.99);',
      '    if (cel.y < .5 && frente < .5) idx = 0.0;',
      '    float vacio = step(hh, .12) * step(.5, cel.y);',
      '    vec2 at = (vec2(mod(idx, 4.0), 1.0 - floor(idx / 4.0)) + f) / vec2(4.0, 2.0);',
      '    vec4 ac = texture2D(uFach, at), am = texture2D(uMasc, at);',
      '    float el = am.g * (1.0 - vacio); vid = am.r * (1.0 - vacio); inter = am.b;',
      '    base = mix(muro, ac.rgb * (.85 + .2 * est2), el);',
      /* bajo cada ventana, una lágrima de humedad */
      '    base *= 1.0 - smoothstep(.0, .25, f.y) * (1.0 - smoothstep(.35, .65, abs(f.x - .5) * 2.0)) * .08 * (1.0 - el);',
      '    float prende = step(hh, .1 + .55 * smoothstep(.15, .9, uNoche) + .1 * (1.0 - uSolI));',
      '    lit = vid * prende;',
      '    vec3 reflejo = cielo(normalize(reflect(V, n)), 0.0) * .55;',
      '    base = mix(base, ac.rgb * .8 + reflejo * .6, vid * (1.0 - lit));',
      '  }',
      '  vec3 l = (uHalo * 1.2 + uHzSol * .4) * max(dot(n, uSol), 0.0) * 1.25 * uSolI + cielo(vec3(0.0, 1.0, 0.0), 0.0) * (.85 + max(n.y, 0.0) * .4) + uHzLej * .2 + vec3(.22, .27, .42) * uLunaI * max(dot(n, uLuna), 0.0) * .7;',
      '  vec3 c = base * l;',
      /* de noche, el resplandor cálido de los faroles del malecón lava la parte baja de las fachadas */
      '  c += base * vec3(1.0, .62, .32) * .32 * smoothstep(.2, .9, uNoche) * (1.0 - smoothstep(2.0, 9.0, alto)) * (.6 + .4 * est);',
      /* ventana encendida: cálida, con el interior (cortinas, lámpara) */
      '  vec3 calido = vec3(1.0, .55, .22) * (.25 + .8 * inter) + vec3(.3, .14, .06) * (1.0 - inter);',
      '  c = mix(c, calido * (.45 + .85 * smoothstep(0.0, .6, uNoche) + .25 * (1.0 - uSolI)), lit);',
      '  vec3 hz = cielo(normalize(vec3(V.x, max(V.y, .015), V.z)), 0.0);',
      '  c = mix(c, hz, clamp(1.0 - exp(-d * .0016), 0.0, 1.0));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });

  /* colores de la costa peruana: ocres, terracota, celeste, verde agua, salmón, blanco, amarillo */
  var PAL = ['#E8C98A', '#D98C5F', '#9CC3D5', '#A8D5BA', '#F2A97F', '#F1ECE0', '#F2D16B', '#C9786A', '#7FB0C9', '#E9DCC3', '#B5C98E', '#E6B8A2'];
  var rnd = C.azar(17), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color();
  var lista = [];
  /* primera fila: frente continuo sobre el malecón, de 1 a 4 pisos */
  var a = -330;
  while (a < 290) {
    var w = 6 + rnd() * 7, pisos = 1 + Math.floor(rnd() * rnd() * 4.2), prof = 9 + rnd() * 5;
    lista.push({ a: a + w / 2, b: 31 + prof / 2, w: w, h: pisos * 2.9 + .3, d: prof });
    a += w + (rnd() < .12 ? 3 + rnd() * 4 : 0);
  }
  /* filas de atrás, más sueltas */
  var nAtras = Math.max(0, ajuste.casas - lista.length);
  for (var i = 0; i < nAtras; i++) {
    var b = 48 + rnd() * 80 + (rnd() < .3 ? rnd() * 70 : 0);
    lista.push({ a: -650 + rnd() * 1100, b: b, w: 6 + rnd() * 7, h: (1 + Math.floor(rnd() * 3.5)) * 2.9 + .3, d: 7 + rnd() * 6, suelo: b > 110 ? (b - 110) * .15 : 0 });
  }
  var casas = new THREE.InstancedMesh(g, mat, lista.length);
  var techos = [];
  lista.forEach(function (c, k) {
    var o = enOrilla(c.a, c.b);
    p.set(o.x, 2.6 + (c.suelo || 0), o.z); eu.set(0, giroOrilla, 0); q.setFromEuler(eu); s.set(c.w, c.h, c.d);
    m4.compose(p, q, s); casas.setMatrixAt(k, m4);
    col.set(PAL[(rnd() * PAL.length) | 0]).convertSRGBToLinear(); casas.setColorAt(k, col);
    if (rnd() < .45) techos.push({ x: o.x, y: p.y + c.h, z: o.z, w: c.w, d: c.d });
  });
  grupo.add(casas);
  /* azoteas: tanques de agua y casetas (solo en alto) */
  if (ajuste.detalle >= 2 && techos.length) {
    var mT = C.matLejos({ niebla: .0016 });
    var tq = new THREE.InstancedMesh(C.pintar(new THREE.CylinderGeometry(.55, .55, 1.1, 10).translate(0, .55, 0), '#5E6B78'), mT, techos.length);
    var cs = new THREE.InstancedMesh(C.pintar(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), '#CFC4B2'), mT, techos.length);
    techos.forEach(function (t, k) {
      var dx = (rnd() - .5) * t.w * .5, dz = (rnd() - .2) * t.d * .4;
      p.set(t.x + dx, t.y, t.z + dz); m4.compose(p, q.identity(), s.set(1, 1, 1)); tq.setMatrixAt(k, m4);
      p.set(t.x - dx * .6, t.y, t.z - dz); eu.set(0, giroOrilla, 0); q.setFromEuler(eu); m4.compose(p, q, s.set(2.2, 2.1, 2.4)); cs.setMatrixAt(k, m4); q.identity();
    });
    grupo.add(tq); grupo.add(cs);
  }
  return casas;
};
})();

;
/* El Chasqui del Mar — prototipo.
   costa.js: la costa de Huanchaco con siluetas y texturas propias (todo procedural con canvas):
   - el muelle: pilotes de madera con veta, percebes y verdín en la línea del agua; tablas, vigas,
     barandas y faroles de luz cálida que de noche se reflejan en el agua;
   - el embarcadero al pie del muelle, donde se deja el cofre (la meta);
   - el malecón con su paseo, muro de piedra, baranda y postes de luz;
   - el pueblo: casas con ventanas que se van encendiendo al anochecer;
   - cerros en la bruma, la iglesia en la loma, la playa con su rompiente y caballitos parados.

   La orilla es una recta que pasa por la raíz del muelle (150, −620) con dirección (−0,331, −0,944).
   El muelle sale hacia el mar 150 m y termina cerca de (8, −570). */
(function () {
'use strict';
var C = window.Chasqui;
var ORILLA = C.ORILLA;
var MAR = C.HACIA_MAR;
var LADO = { x: 0.331, z: 0.944 };        /* perpendicular al muelle, hacia donde viene el caballito */
var LARGO_MUELLE = 150, ALTO_MUELLE = 6.2, ANCHO_MUELLE = 4.6;
C.PUNTA_MUELLE = { x: ORILLA.x + MAR.x * LARGO_MUELLE, z: ORILLA.z + MAR.z * LARGO_MUELLE };
/* el embarcadero (al costado de la punta del muelle) y el lugar marcado donde se deja el cofre */
C.EMBARCADERO = { x: C.PUNTA_MUELLE.x + LADO.x * 13 - MAR.x * 7, z: C.PUNTA_MUELLE.z + LADO.z * 13 - MAR.z * 7, rumbo: Math.atan2(-LADO.x, -LADO.z) };
C.META = { x: C.EMBARCADERO.x + LADO.x * 5.2, z: C.EMBARCADERO.z + LADO.z * 5.2 };
function enOrilla(a, b) { return { x: ORILLA.x + ORILLA.ux * a - MAR.x * b, z: ORILLA.z + ORILLA.uz * a - MAR.z * b }; }
C.enOrilla = enOrilla;

/* ---------- texturas procedurales ---------- */
function grano(x, w, h, base, oscuro, claro, rnd, vertical) {
  /* veta de madera: muchas líneas largas que ondulan, con nudos */
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  var n = vertical ? w / 2 : h / 2;
  for (var i = 0; i < n; i++) {
    var p = rnd() * (vertical ? w : h), a = .05 + rnd() * .2, col = rnd() < .5 ? oscuro : claro;
    x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = .6 + rnd() * 1.8; x.beginPath();
    var fase = rnd() * 6, amp = 1 + rnd() * 3;
    for (var k = 0; k <= 40; k++) {
      var t = k / 40 * (vertical ? h : w), off = Math.sin(t * .01 + fase) * amp + Math.sin(t * .043 + fase * 2) * amp * .4;
      if (vertical) { if (k) x.lineTo(p + off, t); else x.moveTo(p + off, t); } else { if (k) x.lineTo(t, p + off); else x.moveTo(t, p + off); }
    }
    x.stroke();
  }
  x.globalAlpha = 1;
  for (i = 0; i < 4; i++) {   /* nudos */
    var cx = rnd() * w, cy = rnd() * h, r = 3 + rnd() * 7;
    for (var j = 4; j > 0; j--) { x.strokeStyle = oscuro; x.globalAlpha = .25; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, r * j * .5 * (vertical ? 1 : 2.4), r * j * .5 * (vertical ? 2.4 : 1), 0, 0, 6.3); x.stroke(); }
    x.globalAlpha = .6; x.fillStyle = oscuro; x.beginPath(); x.ellipse(cx, cy, r * .5, r * .5, 0, 0, 6.3); x.fill();
  }
  x.globalAlpha = 1;
}
function texPilote(res) {
  var w = res / 4, h = res, c = C.lienzo(w, h), x = c.getContext('2d'), rnd = C.azar(31);
  grano(x, w, h, '#6E5E50', '#3A2E26', '#9A8B7C', rnd, true);
  /* desgaste: manchas grises claras (sal y sol) */
  for (var i = 0; i < 60; i++) { x.fillStyle = 'rgba(190,185,175,' + (.04 + rnd() * .08) + ')'; x.fillRect(rnd() * w, rnd() * h * .65, 2 + rnd() * 10, 10 + rnd() * 60); }
  /* línea del agua (v ≈ 0,33 desde abajo): debajo mojado y con algas, encima percebes y verdín */
  var agua = h * (1 - .326);
  var g = x.createLinearGradient(0, agua - h * .12, 0, h);
  g.addColorStop(0, 'rgba(40,60,30,0)'); g.addColorStop(.25, 'rgba(48,70,34,.75)'); g.addColorStop(.4, 'rgba(26,40,26,.92)'); g.addColorStop(1, 'rgba(14,22,18,.97)');
  x.fillStyle = g; x.fillRect(0, agua - h * .12, w, h);
  for (i = 0; i < w * 2; i++) {    /* percebes: conitos blancos grisáceos alrededor de la línea */
    var px = rnd() * w, py = agua + (rnd() - .55) * h * .07, r = .6 + rnd() * 1.6 * (res / 1024);
    x.fillStyle = 'rgba(' + (120 + rnd() * 40 | 0) + ',' + (116 + rnd() * 36 | 0) + ',' + (104 + rnd() * 30 | 0) + ',.85)';
    x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill();
    x.fillStyle = 'rgba(40,40,40,.7)'; x.beginPath(); x.arc(px, py, r * .35, 0, 6.3); x.fill();
  }
  for (i = 0; i < 120; i++) {   /* verdín que chorrea hacia arriba */
    x.fillStyle = 'rgba(' + (70 + rnd() * 40 | 0) + ',' + (110 + rnd() * 40 | 0) + ',' + (50 + rnd() * 20 | 0) + ',' + (.15 + rnd() * .3) + ')';
    x.fillRect(rnd() * w, agua - h * (.06 + rnd() * .1), 1 + rnd() * 3, h * (.02 + rnd() * .1));
  }
  return C.texDe(c, true, true);
}
function texTablas(res) {
  var w = res, h = res / 4, c = C.lienzo(w, h), x = c.getContext('2d'), rnd = C.azar(37);
  grano(x, w, h, '#7A6656', '#463A30', '#A08D7A', rnd, false);
  /* tablas cruzadas (a lo ancho del muelle), con su junta y clavos */
  var n = 8, a = w / n;
  for (var i = 0; i < n; i++) {
    x.fillStyle = 'rgba(' + (rnd() < .5 ? '255,240,220' : '20,12,8') + ',' + (rnd() * .12) + ')'; x.fillRect(i * a, 0, a, h);
    x.fillStyle = 'rgba(15,10,8,.85)'; x.fillRect(i * a, 0, Math.max(1.5, a * .05), h);
    x.fillStyle = 'rgba(40,40,45,.8)'; [.15, .85].forEach(function (f) { x.beginPath(); x.arc(i * a + a * .5, h * f, 1.8 * res / 1024, 0, 6.3); x.fill(); });
  }
  return C.texDe(c, true, true);
}
function texPiedra(res) {
  var w = res, h = res / 2, c = C.lienzo(w, h), x = c.getContext('2d'), rnd = C.azar(41);
  x.fillStyle = '#5E5650'; x.fillRect(0, 0, w, h);
  var filas = 8, alto = h / filas;
  for (var f = 0; f < filas; f++) {
    var px = -rnd() * 40;
    while (px < w) {
      var an = alto * (1.2 + rnd() * 1.4), v = 95 + rnd() * 50;
      x.fillStyle = 'rgb(' + (v | 0) + ',' + (v * .94 | 0) + ',' + (v * .86 | 0) + ')';
      x.beginPath(); x.moveTo(px + 3, f * alto + 3); x.lineTo(px + an - 2, f * alto + 2 + rnd() * 3); x.lineTo(px + an - 3, (f + 1) * alto - 3); x.lineTo(px + 2, (f + 1) * alto - 2 - rnd() * 3); x.fill();
      for (var k = 0; k < 18; k++) { x.fillStyle = 'rgba(0,0,0,' + rnd() * .12 + ')'; x.fillRect(px + rnd() * an, f * alto + rnd() * alto, 2 + rnd() * 6, 2 + rnd() * 4); }
      px += an;
    }
  }
  var g = x.createLinearGradient(0, h * .7, 0, h); g.addColorStop(0, 'rgba(30,45,30,0)'); g.addColorStop(1, 'rgba(30,45,30,.7)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  return C.texDe(c, true, true);
}

/* material de lo lejano: luz del cielo + neblina del mismo cielo; ventanas que se encienden */
C.matLejos = function (op) {
  op = op || {};
  return new THREE.ShaderMaterial({
    uniforms: C.unif({ uNiebla: { value: op.niebla || .0022 }, uBrillo: { value: op.brillo || 1 }, uVentanas: { value: op.ventanas ? 1 : 0 }, uNocheLuz: { value: op.nocheLuz || 0 } }),
    vertexColors: true,
    vertexShader: [
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl;',
      'void main(){',
      '  vec4 p = vec4(position, 1.0); vec3 n = normal; vEsc = vec3(1.0); vSem = 0.0; vNl = normal;',
      '#ifdef USE_INSTANCING',
      '  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;',
      '  vEsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
      '  vSem = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
      '#endif',
      '  vCol = color;',
      '#ifdef USE_INSTANCING_COLOR',
      '  vCol *= instanceColor;',
      '#endif',
      '  vUv = uv;',
      '  vec4 wp = modelMatrix * p; vPos = wp.xyz; vN = mat3(modelMatrix) * n;',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: [
      C.GLSL_CIELO,
      'uniform float uNiebla, uBrillo, uVentanas, uNocheLuz;',
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl;',
      'void main(){',
      '  vec3 V = vPos - cameraPosition; float d = length(V); V /= d;',
      '  vec3 n = normalize(vN);',
      '  vec3 cieloArr = cielo(vec3(0.0, 1.0, 0.0), 0.0);',
      '  vec3 luzSol = uHalo * 1.2 + uHzSol * .4;',
      '  vec3 l = luzSol * max(dot(n, uSol), 0.0) * 1.2 * uSolI + cieloArr * (.9 + max(n.y, 0.0) * .5) + uHzLej * .25 + vec3(.25, .3, .45) * uLunaI * max(dot(n, uLuna), 0.0) * .5;',
      '  vec3 c = vCol * l * uBrillo + vCol * uNocheLuz * uNoche * .5;',
      /* ventanas: grilla en las caras de las casas; de noche se prenden algunas (cálidas) */
      '  if (uVentanas > .5 && abs(vNl.y) < .5) {',
      '    float an = abs(vNl.x) > .5 ? vEsc.z : vEsc.x;',
      '    vec2 q = vec2(vUv.x * an, vUv.y * vEsc.y);',
      '    vec2 cel = floor(q / vec2(2.6, 2.8)); vec2 f = fract(q / vec2(2.6, 2.8));',
      '    float ven = step(.3, f.x) * step(f.x, .72) * step(.32, f.y) * step(f.y, .78) * step(q.y, vEsc.y - .8) * step(.9, q.y);',
      '    float h = fract(sin(dot(cel + vSem * 17.0, vec2(127.1, 311.7))) * 43758.5453);',
      '    float prende = step(h, .12 + .5 * smoothstep(.2, .9, uNoche) + .1 * (1.0 - uSolI));',
      '    vec3 vidrio = cielo(reflect(V, n), 0.0) * .5;',
      '    c = mix(c, vidrio, ven * .6);',
      '    c += ven * prende * vec3(1.0, .62, .28) * (.25 + 1.6 * smoothstep(.0, .6, uNoche) + .3 * (1.0 - uSolI)) * (.7 + .6 * h);',
      '  }',
      '  vec3 hz = cielo(normalize(vec3(V.x, max(V.y, .015), V.z)), 0.0);',
      '  c = mix(c, hz, clamp(1.0 - exp(-d * uNiebla), 0.0, 1.0));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
};

/* textura de arena: granos claros y oscuros, conchitas y ondulitas (marcas que deja el agua) */
function texArena(N) {
  var c = C.lienzo(N, N), x = c.getContext('2d'), rnd = C.azar(171), im = x.createImageData(N, N), d = im.data;
  var o = C.ruidoPer(16, rnd), o2 = C.ruidoPer(64, rnd);
  for (var y = 0; y < N; y++) for (var xx = 0; xx < N; xx++) {
    var u = xx / N, v = y / N, rip = Math.sin((u * 26 + o(u * 16, v * 16) * 1.6) * Math.PI * 2) * .5 + .5;
    var g = 200 + (rnd() - .5) * 70 + (o2(u * 64, v * 64) - .5) * 30 + rip * 14, k = (y * N + xx) * 4;
    if (rnd() < .012) g += 60; if (rnd() < .01) g -= 90;
    d[k] = g; d[k + 1] = g * .94; d[k + 2] = g * .82; d[k + 3] = Math.max(0, Math.min(255, rip * 255));
  }
  x.putImageData(im, 0, 0);
  for (var i = 0; i < N * .12; i++) { x.fillStyle = 'rgba(' + (230 + rnd() * 25 | 0) + ',' + (220 + rnd() * 25 | 0) + ',' + (205 + rnd() * 30 | 0) + ',.8)'; x.beginPath(); x.ellipse(rnd() * N, rnd() * N, 1 + rnd() * 2.5, .8 + rnd() * 1.5, rnd() * 3, 0, 6.3); x.fill(); }
  var t = C.texDe(c, true, true); return t;
}
function matPlaya(res) {
  return new THREE.ShaderMaterial({
    uniforms: C.unif({ uArena: { value: texArena(res >= 1024 ? 512 : 256) }, uEspuma: { value: C.texEspuma }, uOrilla: { value: new THREE.Vector4(C.ORILLA.x, C.ORILLA.z, C.HACIA_MAR.x, C.HACIA_MAR.z) } }),
    vertexShader: 'varying vec3 vPos; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: C.GLSL_CIELO + [
      '', 'uniform sampler2D uArena, uEspuma; uniform vec4 uOrilla; varying vec3 vPos; varying vec3 vN;',
      'void main(){',
      '  vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist; vec3 n = normalize(vN);',
      '  vec2 r = vPos.xz - uOrilla.xy; float b = -dot(r, uOrilla.zw); float a = dot(r, vec2(-uOrilla.w, uOrilla.z));',
      '  vec4 ar = texture2D(uArena, vPos.xz * .22), ar2 = texture2D(uArena, vPos.xz * .043);',
      '  float ondul = texture2D(uArena, vPos.xz * .07).a;',
      '  vec3 seca = vec3(.78, .66, .48) * (ar.rgb * .9 + .15) * (.8 + .3 * ar2.r) * (.9 + .2 * ondul);',
      '  vec3 mojada = vec3(.3, .23, .15) * (ar.rgb * .7 + .35) * (.9 + .15 * ondul);',
      /* el agua sube por la arena y baja (mismo ciclo que la rompiente) */
      '  float var = texture2D(uNubes, vec2(a * .004, .3)).r;',
      '  float s = fract(uT / 7.0 + var * .25);',
      '  float bf = 6.2 + 5.0 * (s < .3 ? sin(s / .3 * 1.5708) : 1.0 - smoothstep(.3, .95, s));',
      '  float hum = 1.0 - smoothstep(9.5, 13.0 + var * 2.0, b);',           /* hasta dónde llegó el agua: arena mojada */
      '  vec3 col = mix(seca, mojada, hum);',
      '  float lam = 1.0 - smoothstep(bf - .4, bf, b);',                     /* la lámina de agua */
      '  vec3 refl = cielo(normalize(reflect(-V, vec3(0.0, 1.0, 0.0)) + vec3(0.0, .02, 0.0)), 0.0);',
      '  float fres = .02 + .98 * pow(1.0 - max(V.y, 0.0), 5.0);',
      '  vec3 luz = (uHalo * 1.2 + uHzSol * .4) * max(dot(n, uSol), 0.0) * 1.2 * uSolI + cielo(vec3(0.0, 1.0, 0.0), 0.0) * 1.1 + uHzLej * .25 + vec3(.25, .3, .45) * uLunaI * .6;',
      '  col *= luz;',
      /* arena mojada: brilla un poco (refleja el cielo) */
      '  col = mix(col, refl, hum * (fres * .6 + .08));',
      '  col = mix(col, mix(vec3(.01, .05, .06) * luz + col * .5, refl, fres), lam * .85);',
      /* espuma del borde que avanza y la que queda al retirarse: el encaje (bordes de celdas) se
         mezcla con manchas suaves y se apaga de cerca, para que no parezca una red */
      '  float red0 = texture2D(uEspuma, vPos.xz * .3).r * .7 + texture2D(uEspuma, vPos.xz * .7 + .3).r * .4;',
      '  float suave = texture2D(uEspuma, vPos.xz * .13).b * .6 + texture2D(uEspuma, vPos.xz * .33 + .5).b * .4;',
      '  float lace = mix(red0, suave * 1.1, .55 + .3 * (1.0 - smoothstep(4.0, 22.0, dist)));',
      '  float borde = smoothstep(bf - 1.8, bf - .1, b) * (1.0 - smoothstep(bf - .1, bf + .08, b));',
      '  float resto = lam * smoothstep(.5, .95, lace) * .45;',
      '  col = mix(col, cielo(vec3(0.0, 1.0, 0.0), 0.0) * 1.9 + uHalo * .2 * uSolI + vec3(.1, .12, .18) * uLunaI, clamp(borde * (.5 + .6 * lace) + resto, 0.0, 1.0));',
      '  vec3 hz = cielo(normalize(vec3(-V.x, .015, -V.z)), 0.0);',
      '  col = mix(col, hz, clamp(1.0 - exp(-dist * .0016), 0.0, 1.0));',
      '  gl_FragColor = vec4(col, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'].join('\n')
  });
}

C.armarCosta = function (escena, ajuste) {
  var grupo = new THREE.Group(); escena.add(grupo);
  var rnd = C.azar(3), res = ajuste.detalle >= 1 ? 1024 : 512;
  var giroOrilla = Math.atan2(-ORILLA.uz, ORILLA.ux);   /* así el X local va por la orilla y el Z local tierra adentro */
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), eu = new THREE.Euler();
  var matLejos = C.matLejos;

  /* ---- la playa: arena con granos y marcas de olas; mojada y brillante en la orilla, seca más arriba.
     Las olas llegan cada 7 s: la espuma avanza sobre la arena con una lámina de agua y se retira. ---- */
  var largo = 1800, pl = new THREE.PlaneGeometry(largo, 120, 160, 24); pl.rotateX(-Math.PI / 2);
  var pp = pl.attributes.position;
  for (var i = 0; i < pp.count; i++) { var bz = pp.getZ(i) + 20;   /* = b: la franja está centrada en b = 20 */ pp.setY(i, Math.min(1.25, -0.6 + bz * .09) + (bz > 10 ? Math.sin(pp.getX(i) * .05) * .1 * C.suave(10, 20, bz) : 0)); }
  pl.computeVertexNormals();
  var playa = new THREE.Mesh(pl, matPlaya(res));
  var cP = enOrilla(-250, 20); playa.position.set(cP.x, 0, cP.z); playa.rotation.y = giroOrilla; grupo.add(playa);
  /* la rompiente sobre el agua: bandas de espuma que avanzan hacia la orilla (mismo ritmo que la arena) */
  var rg = new THREE.PlaneGeometry(largo, 44, 120, 8); rg.rotateX(-Math.PI / 2);
  var rompe = new THREE.Mesh(rg, new THREE.ShaderMaterial({
    uniforms: C.unif({ uEspuma: { value: C.texEspuma }, uOrilla: { value: new THREE.Vector4(ORILLA.x, ORILLA.z, MAR.x, MAR.z) } }), transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vPos; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: C.GLSL_CIELO + [
      '', 'uniform sampler2D uEspuma; uniform vec4 uOrilla; varying vec3 vPos;',
      'void main(){',
      '  vec2 r = vPos.xz - uOrilla.xy; float b = -dot(r, uOrilla.zw); float a = dot(r, vec2(-uOrilla.w, uOrilla.z));',
      '  float var = texture2D(uNubes, vec2(a * .004, .3)).r;',
      /* la cresta viaja de b = -30 a b = 13 en un ciclo de 7 s */
      '  float s = fract(uT / 7.0 + var * .25);',
      '  float bc = -30.0 + 36.5 * pow(s, .8);',
      '  float tras = bc - b;',
      '  float lace0 = texture2D(uEspuma, vPos.xz * .09 + vec2(0.0, uT * .02)).r;',               /* metros detrás de la cresta */
      '  float frente = smoothstep(-.8, 0.0, tras) * (1.0 - smoothstep(0.0, 2.2, tras)) * (.6 + .5 * lace0);',
      '  float estela = smoothstep(0.0, .5, tras) * (1.0 - smoothstep(.5, 4.5, tras)) * .45;',
      '  float red0 = texture2D(uEspuma, vPos.xz * .12).r * .7 + texture2D(uEspuma, vPos.xz * .31 + .2).r * .5;',
      '  float suave = texture2D(uEspuma, vPos.xz * .07 + vec2(0.0, uT * .01)).b * .6 + texture2D(uEspuma, vPos.xz * .19 + .3).b * .4;',
      '  float dCam = distance(vPos, cameraPosition);',
      '  float lace = mix(red0, suave * 1.15, .5 + .35 * (1.0 - smoothstep(5.0, 30.0, dCam)));',
      '  float k = smoothstep(-28.0, -8.0, b) * (1.0 - smoothstep(6.0, 7.5, b));',
      '  float al = max(frente, estela * smoothstep(.35, .75, lace)) * k * smoothstep(-30.0, -24.0, bc);',
      '  vec3 V = normalize(vPos - cameraPosition);',
      '  vec3 c = cielo(vec3(0.0, 1.0, 0.0), 0.0) * 1.6 + cielo(normalize(vec3(V.x, .05, V.z)), 0.0) * .4 + uHalo * .15 * uSolI + vec3(.12, .14, .2) * uLunaI;',
      '  gl_FragColor = vec4(c * 1.15, min(1.0, al * 1.1));',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'].join('\n')
  }));
  var cR = enOrilla(-250, -8); rompe.position.set(cR.x, .32, cR.z); rompe.rotation.y = giroOrilla; rompe.renderOrder = 1; grupo.add(rompe);

  /* ---- el malecón: muro de piedra, paseo y baranda (de −300 a +300 m de la raíz del muelle) ---- */
  var mLargo = 620, cM = enOrilla(-20, 20);
  var tPiedra = texPiedra(res); tPiedra.repeat.set(mLargo / 12, 1);
  var muro = new THREE.Mesh(new THREE.BoxGeometry(mLargo, 3.6, 2), new THREE.MeshStandardMaterial({ map: tPiedra, roughness: .95 }));
  muro.position.set(cM.x, 1.2, cM.z); muro.rotation.y = giroOrilla; grupo.add(muro);
  var paseo = new THREE.Mesh(new THREE.BoxGeometry(mLargo, .3, 9), new THREE.MeshStandardMaterial({ color: '#A79C8E', roughness: .9 }));
  var cPa = enOrilla(-20, 25.5); paseo.position.set(cPa.x, 2.9, cPa.z); paseo.rotation.y = giroOrilla; grupo.add(paseo);
  var baranda = new THREE.Mesh(new THREE.BoxGeometry(mLargo, .08, .08), new THREE.MeshStandardMaterial({ color: '#E8E2D6', roughness: .5 }));
  baranda.position.set(cM.x, 4, cM.z); baranda.rotation.y = giroOrilla; grupo.add(baranda);
  var nBal = Math.floor(mLargo / 2.2), bal = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, 1, .08), baranda.material, nBal);
  for (i = 0; i < nBal; i++) { var ob = enOrilla(-20 - mLargo / 2 + i * 2.2, 20); p.set(ob.x, 3.5, ob.z); m4.compose(p, q.identity(), s.set(1, 1, 1)); bal.setMatrixAt(i, m4); }
  grupo.add(bal);

  /* ---- el pueblo: en medio y alto, fachadas con detalle (pueblo.js); en bajo, cajas con ventanas pintadas ---- */
  if (ajuste.detalle >= 1 && C.armarPueblo) C.armarPueblo(grupo, ajuste, enOrilla, giroOrilla);
  else {
  var nCasas = ajuste.casas;
  var casa = C.pintar(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), '#ffffff');
  var casas = new THREE.InstancedMesh(casa, matLejos({ niebla: .0017, brillo: .7, ventanas: true }), nCasas);
  var PAL = ['#D9C7A8', '#E3B7A0', '#C9D2C2', '#E9DCC3', '#B9C4D6', '#D6A98E', '#F0E6D2', '#C2B39A', '#8FB3C0', '#E2C46E'];
  for (i = 0; i < nCasas; i++) {
    var a = -650 + rnd() * 1100, b = 32 + rnd() * 70 + (rnd() < .3 ? rnd() * 80 : 0);
    var o = enOrilla(a, b), alto = 3 + rnd() * (rnd() < .25 ? 8 : 4.5);
    p.set(o.x, 2.6 + (b > 110 ? (b - 110) * .15 : 0), o.z);
    eu.set(0, giroOrilla + (rnd() < .85 ? 0 : (rnd() - .5) * .3), 0); q.setFromEuler(eu);
    s.set(5 + rnd() * 7, alto, 5 + rnd() * 7);
    m4.compose(p, q, s); casas.setMatrixAt(i, m4);
    col.set(PAL[(rnd() * PAL.length) | 0]); casas.setColorAt(i, col);
  }
  grupo.add(casas);
  }

  /* cerros */
  function cerro(dist, alto, color, sem, niebla) {
    var r2 = C.azar(sem), nn = 110, g2 = new THREE.PlaneGeometry(3600, 1, nn, 1), pa = g2.attributes.position, ruido = C.ruidoPer(32, r2);
    for (var k = 0; k < pa.count; k++) {
      var x = pa.getX(k), arriba = pa.getY(k) > 0, hh = alto * (.35 + .65 * ruido(x / 3600 * 12 + 3, 1.5) + .25 * ruido(x / 3600 * 40, 7.2));
      pa.setY(k, arriba ? hh : -5); pa.setZ(k, arriba ? -hh * .6 : 0);
    }
    g2.computeVertexNormals(); C.pintar(g2, color);
    var m = new THREE.Mesh(g2, matLejos({ niebla: niebla })), c = enOrilla(-400, dist);
    m.position.set(c.x, 0, c.z); m.rotation.y = giroOrilla + Math.PI; grupo.add(m);
  }
  cerro(300, 40, '#6E5A52', 5, .0011);
  cerro(750, 125, '#5E5566', 9, .0007);
  cerro(1800, 350, '#615C78', 13, .00045);
  /* la iglesia en la loma (genérica), iluminada de noche */
  var cI = enOrilla(-330, 150);
  var loma = C.pintar(new THREE.SphereGeometry(60, 20, 10, 0, 6.283, 0, 1.2).scale(1.4, .45, 1), '#7B6555');
  var mLoma = new THREE.Mesh(loma, matLejos({ niebla: .0012 })); mLoma.position.set(cI.x, -6, cI.z); grupo.add(mLoma);
  var piezas = [];
  piezas.push(C.pintar(new THREE.BoxGeometry(10, 9, 26).translate(0, 4.5, 0), '#EFE6D6'));
  piezas.push(C.pintar(new THREE.CylinderGeometry(0, 7.6, 4, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 2.4).translate(0, 11, 0), '#C9A58A'));
  [-1, 1].forEach(function (l) {
    piezas.push(C.pintar(new THREE.BoxGeometry(4.2, 16, 4.2).translate(l * 4.4, 8, 11), '#F2EADB'));
    piezas.push(C.pintar(new THREE.CylinderGeometry(.2, 2.6, 4, 8).translate(l * 4.4, 18, 11), '#D8CBB4'));
  });
  piezas.push(C.pintar(new THREE.SphereGeometry(4, 12, 8, 0, 6.283, 0, 1.6).translate(0, 9, -6), '#E9DDC8'));
  var igl = new THREE.Mesh(C.mezclar(piezas), matLejos({ niebla: .0012, brillo: 1.1, nocheLuz: 1.4 }));
  igl.position.set(cI.x, 19, cI.z); igl.rotation.y = giroOrilla + .4; grupo.add(igl);

  /* ---- el muelle ---- */
  var muelle = new THREE.Group(); var ra = enOrilla(0, 0); muelle.position.set(ra.x, 0, ra.z);
  muelle.rotation.y = Math.atan2(-MAR.x, -MAR.z); grupo.add(muelle);   /* su −Z apunta al mar */
  var tTablas = texTablas(res); tTablas.repeat.set(1, LARGO_MUELLE / 4); tTablas.rotation = 0;
  var mTablas = new THREE.MeshStandardMaterial({ map: tTablas, roughness: .85 });
  if (ajuste.detalle >= 1) { mTablas.bumpMap = tTablas; mTablas.bumpScale = .02; }
  var tablero = new THREE.Mesh(new THREE.BoxGeometry(ANCHO_MUELLE, .35, LARGO_MUELLE).translate(0, ALTO_MUELLE, -LARGO_MUELLE / 2), mTablas);
  muelle.add(tablero);
  var tCabeza = texTablas(res); tCabeza.repeat.set(2, 2);
  var cabeza = new THREE.Mesh(new THREE.BoxGeometry(12, .4, 9).translate(0, ALTO_MUELLE, -LARGO_MUELLE - 2), new THREE.MeshStandardMaterial({ map: tCabeza, roughness: .85 }));
  muelle.add(cabeza);
  /* madera de vigas, barandas y postes */
  var mMadera = new THREE.MeshStandardMaterial({ color: '#8A7A6A', map: texTablas(256), roughness: .9 });
  var vigas = [];
  for (var z = 2; z <= LARGO_MUELLE; z += 6) vigas.push(new THREE.BoxGeometry(ANCHO_MUELLE + .6, .4, .3).translate(0, ALTO_MUELLE - .35, -z));
  [-1, 1].forEach(function (l) {
    vigas.push(new THREE.BoxGeometry(.16, .14, LARGO_MUELLE).translate(l * ANCHO_MUELLE / 2, ALTO_MUELLE + 1.05, -LARGO_MUELLE / 2));
    vigas.push(new THREE.BoxGeometry(.1, .1, LARGO_MUELLE).translate(l * ANCHO_MUELLE / 2, ALTO_MUELLE + .6, -LARGO_MUELLE / 2));
    for (var zz = 0; zz <= LARGO_MUELLE; zz += 2.5) vigas.push(new THREE.BoxGeometry(.12, 1.1, .12).translate(l * ANCHO_MUELLE / 2, ALTO_MUELLE + .55, -zz));
    /* baranda de la cabeza */
    vigas.push(new THREE.BoxGeometry(.16, .14, 9).translate(l * 6, ALTO_MUELLE + 1.05, -LARGO_MUELLE - 2));
  });
  vigas.push(new THREE.BoxGeometry(12, .14, .16).translate(0, ALTO_MUELLE + 1.05, -LARGO_MUELLE - 6.5));
  var mVigas = new THREE.Mesh(C.mezclar(vigas.map(function (g) { return C.pintar(g, '#ffffff'); })), mMadera);
  muelle.add(mVigas);
  /* pilotes con veta, percebes y verdín */
  var mPil = new THREE.MeshStandardMaterial({ map: texPilote(res), roughness: .9 });
  if (ajuste.detalle >= 1) { mPil.bumpMap = mPil.map; mPil.bumpScale = .03; }
  var pils = [];
  for (z = 0; z <= LARGO_MUELLE; z += 6) [-1, 1].forEach(function (l) { pils.push([l * (ANCHO_MUELLE / 2 - .3), -z, .3]); });
  [-5, 0, 5].forEach(function (xx) { [-1, 1].forEach(function (l) { pils.push([xx, -LARGO_MUELLE - 2 + l * 3.5, .36]); }); });
  var pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 1, 10, 1).translate(0, .5, 0), mPil, pils.length);
  pils.forEach(function (d, k) { p.set(d[0], -3, d[1]); eu.set(0, k * 1.7, 0); q.setFromEuler(eu); m4.compose(p, q, s.set(d[2], ALTO_MUELLE + 3, d[2])); pil.setMatrixAt(k, m4); });
  muelle.add(pil);

  /* el embarcadero: una plataforma baja junto a la punta, con escalera y el lugar marcado */
  var emb = new THREE.Group(); emb.position.set(C.EMBARCADERO.x, 0, C.EMBARCADERO.z); emb.rotation.y = C.EMBARCADERO.rumbo; grupo.add(emb);
  var tEmb = texTablas(res); tEmb.repeat.set(2, 2);
  var plat = new THREE.Mesh(new THREE.BoxGeometry(7, .35, 6).translate(0, .75, 0), new THREE.MeshStandardMaterial({ map: tEmb, roughness: .85 })); emb.add(plat);
  var pe = [];
  [[-3.2, -2.7], [3.2, -2.7], [-3.2, 2.7], [3.2, 2.7]].forEach(function (d) { pe.push([d[0], d[1]]); });
  var pilE = new THREE.InstancedMesh(pil.geometry, mPil, 4);
  pe.forEach(function (d, k) { p.set(d[0], -3, d[1]); m4.compose(p, q.identity(), s.set(.25, ALTO_MUELLE + 3, .25)); pilE.setMatrixAt(k, m4); }); emb.add(pilE);
  /* pasarela baja hasta el pilote de la cabeza del muelle, y una escalera de gato pegada a él */
  var esc = [];
  esc.push(new THREE.BoxGeometry(1.1, .12, 4.2).translate(-2.2, .85, 5.1));
  [-2.7, -1.7].forEach(function (xx) { for (var zz = 3.4; zz <= 7; zz += 1.8) esc.push(new THREE.BoxGeometry(.12, 1.6, .12).translate(xx, .2, zz)); });
  [-2.45, -1.95].forEach(function (xx) { esc.push(new THREE.BoxGeometry(.07, 5.6, .07).translate(xx, 3.6, 7.25)); });
  for (i = 0; i < 14; i++) esc.push(new THREE.BoxGeometry(.5, .05, .05).translate(-2.2, 1.2 + i * .38, 7.25));
  emb.add(new THREE.Mesh(C.mezclar(esc.map(function (g) { return C.pintar(g, '#ffffff'); })), mMadera));
  /* el lugar marcado: un aro dorado que late */
  var mMarca = new THREE.ShaderMaterial({
    uniforms: { uT: C.U.uT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float r = length(vUv - .5) * 2.0; float a = smoothstep(.72, .86, r) * (1.0 - smoothstep(.9, 1.0, r)) + smoothstep(.4, .0, r) * .25; a *= .7 + .3 * sin(uT * 3.0); gl_FragColor = vec4(vec3(1.0, .75, .35) * a * 1.4, 1.0); }'
  });
  var marca = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), mMarca); marca.position.set(.42, .94, .12); emb.add(marca);
  C.marcaCofre = marca; C.embarcadero = emb;

  /* ---- faroles: postes de fierro, farol con vidrio cálido, resplandor y reflejo en el agua ---- */
  var faroles = [];   /* [x, y, z] mundo de cada luz */
  muelle.updateMatrixWorld(true);
  var postes = [], cabezas = [];
  for (z = 8; z <= LARGO_MUELLE + 4; z += 12) {
    var l = (Math.round(z / 12)) % 2 ? 1 : -1;
    postes.push(new THREE.CylinderGeometry(.05, .08, 3.2, 6).translate(l * (ANCHO_MUELLE / 2 - .15), ALTO_MUELLE + 1.6, -z));
    postes.push(new THREE.BoxGeometry(.5, .05, .05).translate(l * (ANCHO_MUELLE / 2 - .4), ALTO_MUELLE + 3.15, -z));
    cabezas.push(new THREE.CylinderGeometry(.13, .1, .32, 6).translate(l * (ANCHO_MUELLE / 2 - .62), ALTO_MUELLE + 2.95, -z));
    p.set(l * (ANCHO_MUELLE / 2 - .62), ALTO_MUELLE + 2.95, -z).applyMatrix4(muelle.matrixWorld); faroles.push([p.x, p.y, p.z, 1]);
  }
  muelle.add(new THREE.Mesh(C.mezclar(postes.map(function (g) { return C.pintar(g, '#ffffff'); })), new THREE.MeshStandardMaterial({ color: '#25211F', roughness: .5, metalness: .4 })));
  var mFarol = new THREE.MeshStandardMaterial({ color: '#FFE2A8', emissive: '#FFB45A', emissiveIntensity: .3, roughness: .3 });
  muelle.add(new THREE.Mesh(C.mezclar(cabezas.map(function (g) { return C.pintar(g, '#ffffff'); })), mFarol));
  /* postes del malecón */
  for (i = 0; i < 30; i++) { var om = enOrilla(-20 - mLargo / 2 + 10 + i * (mLargo - 20) / 29, 22); faroles.push([om.x, 7.6, om.z, .8]); }
  var pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .09, 4.6, 6).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: '#2A2624', roughness: .5 }), 30);
  for (i = 0; i < 30; i++) { p.set(faroles[faroles.length - 30 + i][0], 3, faroles[faroles.length - 30 + i][2]); m4.compose(p, q.identity(), s.set(1, 1, 1)); pm.setMatrixAt(i, m4); }
  grupo.add(pm);

  /* resplandores (puntos aditivos) de faroles + luces sueltas del pueblo */
  var lp = [], lt = [];
  faroles.forEach(function (f) { lp.push(f[0], f[1], f[2]); lt.push(f[3]); });
  for (i = 0; i < 120; i++) { var aa = -600 + rnd() * 1000, bb = 34 + rnd() * 80, oo = enOrilla(aa, bb); lp.push(oo.x, 3.5 + rnd() * 6, oo.z); lt.push(.35 + rnd() * .35); }
  var lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute('tam', new THREE.Float32BufferAttribute(lt, 1));
  var mLuz = new THREE.ShaderMaterial({
    uniforms: { uPr: { value: 1 }, uNoche: C.U.uNoche, uSolI: C.U.uSolI }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float tam; uniform float uPr; varying float vT; void main(){ vT = tam; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(tam * 1500.0 / -mv.z, 2.0, 60.0) * uPr; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uNoche, uSolI; varying float vT; void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); float k = .25 + .75 * clamp(uNoche * 1.4 + (1.0 - uSolI) * .3, 0.0, 1.0); float a = (exp(-r * r * 60.0) * 1.3 + exp(-r * r * 9.0) * .35 * k) * k; gl_FragColor = vec4(vec3(1.0, .7, .36) * a * (vT > .9 ? 1.5 : 1.0), 1.0); }'
  });
  var puntos = new THREE.Points(lg, mLuz); puntos.frustumCulled = false; grupo.add(puntos);
  C.mLuz = mLuz;

  /* reflejos de los faroles en el agua: estelas verticales que tiemblan (solo los cercanos al agua) */
  var refl = faroles.filter(function (f) { return f[3] > .9; });
  var gRef = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, .5);
  var mRef = new THREE.ShaderMaterial({
    uniforms: { uT: C.U.uT, uNoche: C.U.uNoche, uSolI: C.U.uSolI }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; varying float vI; void main(){ vUv = uv; vI = float(gl_VertexID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }'.replace('vI = float(gl_VertexID);', 'vI = instanceMatrix[3].x;'),
    fragmentShader: 'uniform float uT, uNoche, uSolI; varying vec2 vUv; varying float vI; void main(){ float x = abs(vUv.x - .5) * 2.0; float y = 1.0 - vUv.y; float ondas = .5 + .5 * sin(y * 70.0 - uT * 3.0 + vI) * sin(y * 23.0 + uT * 1.7 + vI * 2.0); float a = (1.0 - smoothstep(.0, 1.0, x + y * .2)) * pow(1.0 - y, 1.3) * smoothstep(.3, .8, ondas + .3) * clamp(uNoche * 1.3 + (1.0 - uSolI) * .3, 0.0, 1.0); gl_FragColor = vec4(vec3(1.0, .62, .3) * a * 1.3, 1.0); }'
  });
  var reflejos = new THREE.InstancedMesh(gRef, mRef, refl.length); reflejos.frustumCulled = false; reflejos.renderOrder = 3; grupo.add(reflejos);

  /* caballitos de totora secándose en la arena, como en Huanchaco: en filas de a cuatro, parados
     sobre la popa, la punta curva hacia el mar y apoyados un poco hacia atrás (hacia el malecón) */
  var FILAS = [-50, -79, -113, -151, -192], POR_FILA = ajuste.detalle >= 1 ? 5 : 4, yawMar = Math.atan2(MAR.x, MAR.z), kc = 0;
  var cabs = new THREE.InstancedMesh(C.geoCaballitoParado(ajuste), C.matCaballitoParado(), FILAS.length * POR_FILA);
  for (i = 0; i < FILAS.length; i++) for (var j2 = 0; j2 < POR_FILA; j2++) {
    var bc2 = 16.2 + rnd() * .7, oc = enOrilla(FILAS[i] + j2 * .98 + (rnd() - .5) * .14, bc2);
    p.set(oc.x, -0.6 + bc2 * .09 - .22, oc.z);
    eu.set(-(.15 + rnd() * .1), yawMar + (rnd() - .5) * .26, (rnd() - .5) * .06, 'YXZ'); q.setFromEuler(eu);
    m4.compose(p, q, s.set(1, .93 + rnd() * .14, 1)); cabs.setMatrixAt(kc++, m4);
  }
  grupo.add(cabs);

  var vA = new THREE.Vector3();
  /* para chocar: el muelle como cápsula (raíz → punta), su cabeza y el embarcadero */
  C.CHOQUES_MUELLE = { a: enOrilla(0, 0), b: C.PUNTA_MUELLE, r: 3.0, cabeza: enOrilla(0, 0), emb: { x: C.EMBARCADERO.x, z: C.EMBARCADERO.z, r: 4.2 } };
  var cab0 = new THREE.Vector3(0, 0, -LARGO_MUELLE - 2).applyMatrix4(muelle.matrixWorld); C.CHOQUES_MUELLE.cabeza = { x: cab0.x, z: cab0.z, r: 7 };
  return {
    muelle: muelle, faroles: faroles,
    cuadro: function (dt, cam) {
      mFarol.emissiveIntensity = .3 + 2.6 * Math.min(1, C.U.uNoche.value * 1.3 + (1 - C.U.uSolI.value) * .3);
      /* cada reflejo va del pie del farol hacia la cámara */
      for (var k = 0; k < refl.length; k++) {
        var f = refl[k], dx = cam.position.x - f[0], dz = cam.position.z - f[2], d = Math.sqrt(dx * dx + dz * dz) || 1;
        var largoR = Math.min(d * .9, 14 + f[1] * 2.2), ang = Math.atan2(dx, dz);
        p.set(f[0], .06, f[2]); eu.set(0, ang, 0); q.setFromEuler(eu); m4.compose(p, q, s.set(.9, 1, largoR)); reflejos.setMatrixAt(k, m4);
      }
      reflejos.instanceMatrix.needsUpdate = true;
    }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   aves.js: pelícanos y gaviotas procedurales (sin modelos de nadie).

   Pelícano peruano: cuerpo gris pardo, cabeza blanca con corona amarilla, cuello recogido en S
   (así vuelan), pico largo con bolsa, alas anchas con las primarias separadas como dedos.
   Vuelan en fila baja sobre el agua: el primero aletea y la fila lo sigue con retraso, luego planean.
   Gaviotas: blancas, alas grises en "M" con puntas negras, dan vueltas más alto.

   Cada especie es UNA malla instanciada; el aleteo (hombro y muñeca) va en el vertex shader. */
(function () {
'use strict';
var C = window.Chasqui;

/* textura de plumas (gris) que se multiplica por el color de cada parte */
function texPlumas() {
  var c = C.lienzo(256, 256), x = c.getContext('2d'), rnd = C.azar(51);
  x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, 256, 256);
  for (var fila = 0; fila < 16; fila++) for (var k = 0; k < 18; k++) {
    var px = k * 15 + (fila % 2) * 7 + rnd() * 3, py = fila * 16 + rnd() * 3, v = 150 + rnd() * 90;
    x.fillStyle = 'rgb(' + (v | 0) + ',' + (v | 0) + ',' + (v | 0) + ')';
    x.beginPath(); x.ellipse(px, py, 8, 13, 0, 0, Math.PI); x.fill();
    x.strokeStyle = 'rgba(60,60,60,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 12); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(px, py, 8, 13, 0, .2, Math.PI - .2); x.stroke();
  }
  return C.texDe(c, false, true);
}

/* --- constructor de mallas con atributos: ala (0 cuerpo, 1 ala), color, uv --- */
function Malla() { this.p = []; this.c = []; this.u = []; this.a = []; }
Malla.prototype.tri = function (A, B, Cc, col, ala, uA, uB, uC) {
  this.p.push(A[0], A[1], A[2], B[0], B[1], B[2], Cc[0], Cc[1], Cc[2]);
  for (var i = 0; i < 3; i++) { this.c.push(col[0], col[1], col[2]); this.a.push(ala); }
  this.u.push(uA[0], uA[1], uB[0], uB[1], uC[0], uC[1]);
};
Malla.prototype.quad = function (A, B, Cc, Dd, col, ala, u0, u1) {
  u0 = u0 || [0, 0]; u1 = u1 || [1, 1];
  this.tri(A, B, Cc, col, ala, [u0[0], u0[1]], [u1[0], u0[1]], [u1[0], u1[1]]);
  this.tri(A, Cc, Dd, col, ala, [u0[0], u0[1]], [u1[0], u1[1]], [u0[0], u1[1]]);
};
Malla.prototype.geo = function () {
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
  g.setAttribute('ala', new THREE.Float32BufferAttribute(this.a, 1));
  g.computeVertexNormals(); return g;
};
function hex(h) { var c = new THREE.Color(h); return [c.r, c.g, c.b]; }
/* un cuerpo hecho de anillos (elipses) a lo largo de z; colorDe(z) da el color */
function puntoAnillo(r, t) { return [Math.cos(t) * r[1], r[3] + Math.sin(t) * r[2], r[0]]; }
function loft(M, anillos, n, colorDe) {
  var P = puntoAnillo;
  for (var i = 0; i < anillos.length - 1; i++) {
    var a = anillos[i], b = anillos[i + 1];
    for (var k = 0; k < n; k++) {
      var t0 = k / n * 6.2832, t1 = (k + 1) / n * 6.2832;
      var col = colorDe(a[0], Math.sin((t0 + t1) / 2));
      M.quad(P(a, t0), P(a, t1), P(b, t1), P(b, t0), col, 0, [k / n, i / anillos.length], [(k + 1) / n, (i + 1) / anillos.length]);
    }
  }
}
/* un ala: lista de puntos del borde de ataque y de fuga a lo largo de la envergadura; + dedos */
function ala(M, lado, borde, col, colPunta, dedos, colDedos) {
  for (var i = 0; i < borde.length - 1; i++) {
    var a = borde[i], b = borde[i + 1];   /* [x, y, zAtaque, zFuga] */
    var A = [lado * a[0], a[1], a[2]], B = [lado * b[0], b[1], b[2]], Cc = [lado * b[0], b[1], b[3]], Dd = [lado * a[0], a[1], a[3]];
    var cc = i >= borde.length - 3 ? colPunta : col;
    if (lado > 0) M.quad(A, B, Cc, Dd, cc, 1, [a[0] / 3, 0], [b[0] / 3, 1]); else M.quad(B, A, Dd, Cc, cc, 1, [b[0] / 3, 0], [a[0] / 3, 1]);
  }
  /* primarias separadas: triángulos finos desde la punta */
  var u = borde[borde.length - 1];
  for (var d = 0; d < dedos; d++) {
    var f = d / Math.max(1, dedos - 1), z0 = u[2] + (u[3] - u[2]) * f, largo = .32 - Math.abs(f - .35) * .18;
    var base1 = [lado * u[0], u[1], z0 + .035], base2 = [lado * u[0], u[1], z0 - .035], punta = [lado * (u[0] + largo), u[1] - .02, z0 - .08 * f - .02];
    if (lado > 0) M.tri(base1, punta, base2, colDedos, 1, [1, 0], [1, .5], [1, 1]); else M.tri(base1, base2, punta, colDedos, 1, [1, 0], [1, 1], [1, .5]);
  }
}
function pelicano() {
  var M = new Malla();
  var gris = hex('#6E6A66'), oscuro = hex('#3E3A38'), blanco = hex('#EDE8DC'), amarillo = hex('#E8C25A'), pico = hex('#C9935A'), bolsa = hex('#8E5E48');
  /* cuerpo (z, rx, ry, y) de la cola al pecho, y el cuello recogido */
  loft(M, [[-.95, .02, .02, .02], [-.75, .12, .07, .03], [-.4, .2, .15, 0], [0, .22, .17, 0], [.3, .19, .17, .03], [.48, .14, .15, .1], [.58, .11, .11, .2], [.66, .085, .085, .22]], 8,
    function (z, s) { return z > .45 ? (s > -.2 ? blanco : hex('#5A4438')) : (s > .3 ? gris : hex('#8A8580')); });
  /* cabeza blanca con corona amarilla */
  loft(M, [[.6, .02, .02, .22], [.66, .08, .08, .23], [.74, .085, .08, .23], [.8, .05, .05, .22]], 8, function (z, s) { return s > .5 ? amarillo : blanco; });
  /* pico: mandíbula de arriba plana y larga, bolsa que cuelga abajo */
  var b0 = .78, b1 = 1.62;
  M.quad([-.035, .23, b0], [.035, .23, b0], [.012, .2, b1], [-.012, .2, b1], pico, 0);
  M.quad([.035, .23, b0], [.035, .2, b0], [.012, .19, b1], [.012, .2, b1], pico, 0);
  M.quad([-.035, .2, b0], [-.035, .23, b0], [-.012, .2, b1], [-.012, .19, b1], pico, 0);
  M.tri([.03, .2, b0], [0, .07, .98], [.012, .19, b1 - .1], bolsa, 0, [0, 0], [0, 1], [1, 1]);
  M.tri([-.03, .2, b0], [-.012, .19, b1 - .1], [0, .07, .98], bolsa, 0, [0, 0], [1, 1], [0, 1]);
  M.tri([0, .07, .98], [.012, .19, b1 - .1], [-.012, .19, b1 - .1], bolsa, 0, [0, 0], [1, 0], [1, 1]);
  /* alas anchas: [x, y, zAtaque, zFuga] */
  var borde = [[.18, .05, .32, -.3], [.6, .07, .34, -.36], [1.1, .06, .3, -.34], [1.32, .05, .26, -.2], [1.8, .02, .16, -.12], [2.15, -.01, .08, -.08]];
  [-1, 1].forEach(function (l) { ala(M, l, borde, gris, oscuro, 5, hex('#2A2624')); });
  /* cola corta */
  M.quad([-.12, .03, -.9], [.12, .03, -.9], [.15, .02, -1.12], [-.15, .02, -1.12], oscuro, 0);
  return M.geo();
}
function gaviota() {
  var M = new Malla();
  var blanco = hex('#F2F2EE'), gris = hex('#9AA1A8'), negro = hex('#1E1E22'), pico = hex('#E8C04A');
  loft(M, [[-.5, .02, .02, .02], [-.35, .08, .06, .02], [0, .11, .1, 0], [.25, .1, .1, .03], [.38, .07, .07, .06], [.45, .02, .02, .07]], 8, function () { return blanco; });
  M.tri([-.02, .07, .44], [.02, .07, .44], [0, .055, .6], pico, 0, [0, 0], [1, 0], [.5, 1]);
  /* alas en "M": el codo sube */
  var borde = [[.1, .03, .14, -.14], [.45, .12, .18, -.16], [.75, .1, .14, -.1], [1.05, .02, .06, -.06], [1.25, -.02, .02, -.02]];
  [-1, 1].forEach(function (l) { ala(M, l, borde, gris, negro, 2, negro); });
  M.quad([-.08, .02, -.48], [.08, .02, -.48], [.1, .01, -.66], [-.1, .01, -.66], blanco, 0);
  return M.geo();
}

function material() {
  return new THREE.ShaderMaterial({
    uniforms: C.unif({ uPlumas: { value: texPlumas() }, uMuneca: { value: 1.3 } }), vertexColors: true, side: THREE.DoubleSide,
    vertexShader: [
      'attribute float ala; attribute float fase; attribute float amp;',
      'uniform float uT, uMuneca;',
      'varying vec3 vPos; varying vec3 vCol; varying vec2 vUv; varying vec3 vN;',
      'vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }',
      'void main(){',
      '  vec3 p = position; vec3 n = normal;',
      /* aleteo: el hombro y la muñeca (la punta va con retraso) */
      '  float ph = uT * 6.0 + fase;',
      '  float a1 = amp * sin(ph) - .06 + (1.0 - amp) * .05;',
      '  float a2 = amp * .7 * sin(ph - .9) - (1.0 - amp) * .12;',
      '  if (ala > .5) {',
      '    float lado = sign(p.x); float xs = abs(p.x) - .18;',
      '    vec2 q;',
      '    if (xs < uMuneca) q = rot(vec2(xs, p.y), a1);',
      '    else q = rot(vec2(uMuneca, 0.0), a1) + rot(vec2(xs - uMuneca, p.y), a1 + a2);',
      '    p.x = lado * (.18 + q.x); p.y = q.y;',
      '    n.xy = rot(n.xy * vec2(lado, 1.0), xs < uMuneca ? a1 : a1 + a2) * vec2(lado, 1.0);',
      '  }',
      '  p.y -= sin(ph) * .035 * amp;',
      '  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0); vPos = w.xyz;',
      '  vN = normalize(mat3(modelMatrix * instanceMatrix) * n); vCol = color; vUv = uv;',
      '  gl_Position = projectionMatrix * viewMatrix * w;',
      '}'
    ].join('\n'),
    fragmentShader: C.GLSL_CIELO + [
      '',
      'uniform sampler2D uPlumas;',
      'varying vec3 vPos; varying vec3 vCol; varying vec2 vUv; varying vec3 vN;',
      'void main(){',
      '  vec3 V = vPos - cameraPosition; float d = length(V); V /= d;',
      '  vec3 n = normalize(vN); if (dot(n, V) > 0.0) n = -n;',
      '  float pl = texture2D(uPlumas, vUv * vec2(6.0, 3.0)).r;',
      '  vec3 amb = cielo(vec3(0.0, 1.0, 0.0), 0.0) * .9 + uHzLej * .3;',
      '  vec3 sol = (uHalo * 1.4 + uHzSol * .5) * uSolI;',
      '  float dif = max(dot(n, uSol), 0.0);',
      '  float borde = pow(1.0 - abs(dot(n, -V)), 3.0) * max(dot(-V, uSol), 0.0);',   /* contraluz: borde dorado */
      '  vec3 c = vCol * (amb + sol * dif * 1.3 + vec3(.3, .35, .5) * uLunaI * .25) * (.75 + .5 * pl) + sol * borde * .8;',
      '  vec3 hz = cielo(normalize(vec3(V.x, max(V.y, .02), V.z)), 0.0);',
      '  c = mix(c, hz, clamp(1.0 - exp(-d * .0035), 0.0, .92));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
}

C.armarAves = function (escena, ajuste) {
  var nP = ajuste.aves, nG = ajuste.gaviotas;
  function bandada(geo, n, muneca) {
    var fase = new Float32Array(n), amp = new Float32Array(n);
    geo.setAttribute('fase', new THREE.InstancedBufferAttribute(fase, 1));
    geo.setAttribute('amp', new THREE.InstancedBufferAttribute(amp, 1));
    var m = material(); m.uniforms.uMuneca.value = muneca;
    var mesh = new THREE.InstancedMesh(geo, m, n); mesh.frustumCulled = false; escena.add(mesh);
    return { mesh: mesh, fase: fase, amp: amp };
  }
  var P = bandada(pelicano(), nP, 1.14), G = bandada(gaviota(), nG, .3);
  var t = 0, t0 = 0, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  var ancla = new THREE.Vector3(0, 0, -60), objetivo = new THREE.Vector3(), prev = new THREE.Vector3();
  /* la fila de pelícanos sigue la ruta del primero, con retraso */
  function ruta(tt, out) {
    var a = tt * .05;
    out.set(ancla.x - 15 + Math.cos(a) * 130, 3.2 + Math.sin(tt * .21) * 1.2 + Math.max(0, Math.sin(a * 2.0)) * 5, ancla.z + Math.sin(a) * 85);
    return out;
  }
  var gav = []; for (var i = 0; i < nG; i++) gav.push({ r: 14 + Math.random() * 30, w: (.25 + Math.random() * .25) * (Math.random() < .5 ? -1 : 1), a: Math.random() * 6.28, h: 9 + Math.random() * 14, dx: (Math.random() - .5) * 60, dz: -20 - Math.random() * 60 });
  return {
    cuadro: function (dt, foco) {
      t += dt;
      /* el centro de la bandada sigue al caballito despacio (al empezar, ya está donde él) */
      objetivo.set(foco.x, 0, foco.z - 70);
      if (!t0) { t0 = 1; ancla.copy(objetivo); } else ancla.lerp(objetivo, Math.min(1, dt * .08));
      var visible = C.LUZ.h < .78;           /* de noche se van a dormir */
      P.mesh.visible = G.mesh.visible = visible;
      if (!visible) return;
      for (var i = 0; i < nP; i++) {
        var tt = t - i * .9;
        ruta(tt, p); ruta(tt - .1, prev);
        var dx = p.x - prev.x, dz = p.z - prev.z, dy = p.y - prev.y;
        p.x += (i % 2 ? 1 : -1) * .6;
        e.set(-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)), Math.atan2(dx, dz), Math.sin(tt * .3) * .1, 'YXZ'); q.setFromEuler(e);
        m4.compose(p, q, s.set(.95, .95, .95)); P.mesh.setMatrixAt(i, m4);
        /* aletean unas 5 veces y planean; la ola de aleteo baja por la fila */
        var ciclo = (tt * .16) % 1; P.amp[i] = ciclo < .35 ? Math.sin(ciclo / .35 * Math.PI) * .55 : 0;
        P.fase[i] = -i * .9 * 6.0;
      }
      P.mesh.instanceMatrix.needsUpdate = true; P.mesh.geometry.attributes.amp.needsUpdate = true; P.mesh.geometry.attributes.fase.needsUpdate = true;
      for (i = 0; i < nG; i++) {
        var g = gav[i]; g.a += g.w * dt;
        p.set(ancla.x + g.dx + Math.cos(g.a) * g.r, g.h + Math.sin(t * .4 + i) * 1.5, ancla.z + 50 + g.dz + Math.sin(g.a) * g.r);
        e.set(0, Math.atan2(-Math.sin(g.a) * g.w, Math.cos(g.a) * g.w), (g.w > 0 ? -1 : 1) * .35, 'YXZ'); q.setFromEuler(e);
        m4.compose(p, q, s.set(.75, .75, .75)); G.mesh.setMatrixAt(i, m4);
        var cg = (t * .35 + i * .37) % 1; G.amp[i] = cg < .45 ? .75 : .05; G.fase[i] = i * 2.1;
      }
      G.mesh.instanceMatrix.needsUpdate = true; G.mesh.geometry.attributes.amp.needsUpdate = true; G.mesh.geometry.attributes.fase.needsUpdate = true;
    }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   obstaculos.js: lo que hay que esquivar para llegar a las fotos.
   - rocas (procedurales) con espuma alrededor; en un grupo rompen olas;
   - redes de pesca: boyas naranjas y blancas con su soga y la red flotando;
   - troncos a la deriva;
   - pescadores en sus caballitos, que reman despacio.
   Chocar no castiga: se pierde impulso, salpica y el caballito se mece (lo arregla chasqui.js).
   choque(x, z, radio) devuelve el empujón para sacar al caballito, o null. */
(function () {
'use strict';
var C = window.Chasqui;

/* dónde va cada cosa (x, z en metros; el muelle queda hacia −Z). Las fotos las reparte
   Chasqui.recorrido (juego.js) según cuántas trae el regalo, sin caer encima de nada de esto. */
var ROCAS = [
  [-21, -58, 1.8], [-4, -118, 1.2],
  [5, -147, 2.1], [10, -153, 1.5], [15.5, -148, 2.4], [20, -154, 1.4],
  [26, -300, 2.2],
  [-15, -431, 2.6], [-8, -436, 1.7], [6, -429, 2.3], [11.5, -434, 1.6], [-24, -520, 2.0]
];
var REDES = [[[-36, -240], [-3, -240]], [[4, -500], [30, -503]]];
var TRONCOS = [[-12, -108, .2], [-6, -322, .4], [15, -342, -.7], [3, -368, 1.2]];
var ROMPIENTES = [[-11, -433], [8, -431], [16, -150]];
C.ROMPIENTES = ROMPIENTES;
C.OBSTACULOS = { rocas: ROCAS, redes: REDES, troncos: TRONCOS };

/* ruido 3D barato para deformar rocas */
function hash(x, y, z) { var s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function ruido3(x, y, z) {
  var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  function l(a, b, t) { return a + (b - a) * t; }
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), fx), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), fx), fy),
           l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), fx), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
/* roca: icosaedro deformado con ruido de varias octavas, crestas (ridged), grietas y salientes
   en estratos. En el color de vértice va la "cavidad" (más oscuro en grietas y huecos). */
function geoRoca(sem, det) {
  var g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position, v = new THREE.Vector3(), cav = [];
  var i, fb, k;
  for (i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fb = 0; var amp = .5, f = 1.3, tot = 0;
    for (k = 0; k < 5; k++) { fb += ruido3(v.x * f + sem, v.y * f + k * 3.1, v.z * f) * amp; tot += amp; amp *= .5; f *= 2.1; }
    fb /= tot;
    var cr = 1 - Math.abs(ruido3(v.x * 3.2 + sem, v.y * 3.2, v.z * 3.2 + 5) * 2 - 1);      /* cresta */
    var grieta = Math.pow(1 - Math.abs(ruido3(v.x * 6 + 9, v.y * 6 + sem, v.z * 6) * 2 - 1), 10);
    var r = .62 + fb * .8 + cr * cr * .14 - grieta * .09;
    v.multiplyScalar(r);
    /* salientes: el alto se escalona un poco (estratos) */
    var esc = Math.floor(v.y * 5 + ruido3(v.x * 2, sem, v.z * 2)) / 5;
    v.y += (esc - v.y) * .28;
    v.y = v.y > 0 ? v.y * (1.05 + ruido3(v.x, sem, v.z) * .55) : v.y * .55;
    p.setXYZ(i, v.x, v.y, v.z);
    cav.push(Math.max(0, Math.min(1, (r - .55) * 1.4 - grieta * .6)));
  }
  var acc = {}, key = function (x, y, z) { return Math.round(x * 1e3) + ',' + Math.round(y * 1e3) + ',' + Math.round(z * 1e3); };
  g.computeVertexNormals(); var nn = g.attributes.normal;
  for (i = 0; i < p.count; i++) { var kk = key(p.getX(i), p.getY(i), p.getZ(i)), aa = acc[kk] || (acc[kk] = [0, 0, 0]); aa[0] += nn.getX(i); aa[1] += nn.getY(i); aa[2] += nn.getZ(i); }
  for (i = 0; i < p.count; i++) { var bb = acc[key(p.getX(i), p.getY(i), p.getZ(i))], l = Math.hypot(bb[0], bb[1], bb[2]) || 1; nn.setXYZ(i, bb[0] / l, bb[1] / l, bb[2] / l); }
  var col = new Float32Array(p.count * 3); for (i = 0; i < p.count; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = cav[i];
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/* textura de roca (repetible, datos sin canvas para controlar los 4 canales):
   R grano y grietas · G manchas de líquen/musgo · B percebes · A variación para estratos */
function texRoca(N) {
  var rnd = C.azar(97), o = [C.ruidoPer(8, rnd), C.ruidoPer(16, rnd), C.ruidoPer(32, rnd), C.ruidoPer(64, rnd)], q = C.ruidoPer(12, rnd), w = C.ruidoPer(6, rnd);
  var d = new Uint8Array(N * N * 4), x, y, i;
  var perc = []; for (i = 0; i < N * .9; i++) perc.push([rnd() * N, rnd() * N, (1 + rnd() * 2.2) * N / 256]);
  var B = new Float32Array(N * N);
  perc.forEach(function (c) { for (var yy = -4; yy <= 4; yy++) for (var xx = -4; xx <= 4; xx++) { var px = ((Math.round(c[0]) + xx) % N + N) % N, py = ((Math.round(c[1]) + yy) % N + N) % N, dd = Math.hypot(xx, yy) / c[2]; if (dd < 1) B[py * N + px] = Math.max(B[py * N + px], dd < .45 ? .55 : 1 - dd * .3); } });
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var u = x / N, v = y / N, k = (y * N + x) * 4;
    var g = o[0](u * 8, v * 8) * .45 + o[1](u * 16, v * 16) * .28 + o[2](u * 32, v * 32) * .17 + o[3](u * 64, v * 64) * .1;
    var gr = Math.pow(1 - Math.abs(q(u * 12, v * 12) * 2 - 1), 14);           /* grietas finas */
    d[k] = Math.max(0, Math.min(255, (g * 1.2 - .1 - gr * .55) * 255));
    d[k + 1] = Math.max(0, Math.min(255, (o[1](u * 16 + 3, v * 16) * .7 + o[3](u * 64, v * 64 + 5) * .3) * 255));
    d[k + 2] = B[y * N + x] * 255;
    d[k + 3] = w(u * 6, v * 6) * 255;
  }
  var t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
}
function matRoca(N) {
  return new THREE.ShaderMaterial({
    uniforms: C.unif({ uRoca: { value: texRoca(N) } }), vertexColors: true,
    vertexShader: [
      'varying vec3 vPos; varying vec3 vN; varying float vCav;',
      'void main(){',
      '  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vPos = w.xyz;',
      '  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vCav = color.r;',
      '  gl_Position = projectionMatrix * viewMatrix * w;',
      '}'
    ].join('\n'),
    fragmentShader: C.GLSL_CIELO + [
      '',
      'uniform sampler2D uRoca;',
      'varying vec3 vPos; varying vec3 vN; varying float vCav;',
      'void main(){',
      '  vec3 n = normalize(vN); vec3 V = cameraPosition - vPos; float dist = length(V); V /= dist;',
      /* triplanar: la textura se proyecta desde los tres ejes según hacia dónde mira la cara */
      '  vec3 bw = pow(abs(n), vec3(4.0)); bw /= dot(bw, vec3(1.0));',
      '  vec3 P = vPos * .5;',
      '  vec4 tx = texture2D(uRoca, P.zy) * bw.x + texture2D(uRoca, P.xz) * bw.y + texture2D(uRoca, P.xy) * bw.z;',
      '  vec4 tf = texture2D(uRoca, P.zy * 3.1) * bw.x + texture2D(uRoca, P.xz * 3.1) * bw.y + texture2D(uRoca, P.xy * 3.1) * bw.z;',
      '  float y = vPos.y;',
      '  float estr = sin(y * 6.5 + tx.a * 7.0) * .5 + .5;',
      '  vec3 base = mix(vec3(.11, .1, .09), vec3(.36, .31, .26), clamp(estr * .4 + tx.r * .55 + tf.r * .55 - .22, 0.0, 1.0));',
      '  base *= mix(.45, 1.05, vCav);',
      /* líquenes en lo alto y seco; guano arriba */
      '  float liq = smoothstep(.58, .72, tx.g) * smoothstep(.5, 1.3, y) * smoothstep(-.1, .5, n.y);',
      '  base = mix(base, mix(vec3(.6, .45, .16), vec3(.42, .47, .36), tx.a), liq * .75);',
      '  base = mix(base, vec3(.74, .72, .66), smoothstep(.7, .95, n.y) * smoothstep(1.2, 2.0, y) * smoothstep(.45, .7, tf.a) * .8);',
      /* musgo y verdín donde salpica el mar; percebes en la línea del agua */
      '  float lin = .3 + .12 * sin(uT * 1.2 + vPos.x * .6 + vPos.z * .4);',
      '  float musgo = smoothstep(-.35, .05, y) * (1.0 - smoothstep(lin, lin + .5, y)) * smoothstep(.35, .6, tx.g + tf.g * .3);',
      '  base = mix(base, vec3(.09, .17, .06), musgo * .9);',
      '  float perc = smoothstep(.5, .8, max(tx.b, tf.b)) * smoothstep(-.5, -.1, y) * (1.0 - smoothstep(.15, .45, y));',
      '  base = mix(base, vec3(.5, .48, .43) * (.7 + .3 * tf.r), perc);',
      /* mojado: más oscuro y con brillo */
      '  float moj = 1.0 - smoothstep(lin - .05, lin + .4, y);',
      '  base *= mix(1.0, .5, moj);',
      '  vec3 sol = (uHalo * 1.25 + uHzSol * .45) * uSolI;',
      '  vec3 amb = (cielo(vec3(0.0, 1.0, 0.0), 0.0) * .5 + vec3(.06, .055, .05)) * (.6 + .4 * n.y) + uHzLej * .12;',
      '  vec3 luna = vec3(.32, .37, .55) * uLunaI;',
      '  float dif = max(dot(n, uSol), 0.0), difL = max(dot(n, uLuna), 0.0);',
      '  float esp = pow(max(dot(n, normalize(uSol + V)), 0.0), 36.0), espL = pow(max(dot(n, normalize(uLuna + V)), 0.0), 36.0);',
      '  vec3 c = base * (amb + sol * dif * 1.7 + luna * difL * 1.2) + (sol * esp * .7 + luna * espL * 1.0) * moj;',
      '  vec3 hz = cielo(normalize(vec3(-V.x, .015, -V.z)), 0.0);',
      '  c = mix(c, hz, clamp(1.0 - exp(-dist * .0018), 0.0, 1.0));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
}
function texCorteza() {
  var c = C.lienzo(256, 128), x = c.getContext('2d'), rnd = C.azar(81);
  x.fillStyle = '#5C4A3A'; x.fillRect(0, 0, 256, 128);
  for (var i = 0; i < 160; i++) { x.strokeStyle = 'rgba(' + (rnd() < .5 ? '30,22,16' : '150,135,115') + ',' + (.2 + rnd() * .4) + ')'; x.lineWidth = 1 + rnd() * 2; x.beginPath(); var y = rnd() * 128; x.moveTo(0, y); for (var k = 1; k <= 8; k++) x.lineTo(k * 32, y + (rnd() - .5) * 6); x.stroke(); }
  for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(170,160,140,' + rnd() * .35 + ')'; x.fillRect(rnd() * 256, rnd() * 128, 10 + rnd() * 40, 3 + rnd() * 6); }
  return C.texDe(c, true, true);
}
function texRed() {
  var c = C.lienzo(128, 128), x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128); x.strokeStyle = 'rgba(40,70,60,.95)'; x.lineWidth = 2;
  for (var i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i + 128, 0); x.lineTo(i, 128); x.stroke(); }
  var t = C.texDe(c, true, true); return t;
}
/* pescador sentado con sombrero de paja y poncho (silueta simple, propia) */
function pescador(col) {
  var pz = [];
  pz.push(C.pintar(new THREE.CylinderGeometry(.16, .26, .55, 10).translate(0, .3, 0), col));
  pz.push(C.pintar(new THREE.SphereGeometry(.12, 12, 10).translate(0, .7, 0), '#9C6A4A'));
  pz.push(C.pintar(new THREE.CylinderGeometry(.3, .3, .02, 16).translate(0, .78, 0), '#C9A86A'));
  pz.push(C.pintar(new THREE.CylinderGeometry(.08, .14, .14, 12).translate(0, .85, 0), '#BF9C5E'));
  pz.push(C.pintar(new THREE.CylinderGeometry(.04, .04, .36, 6).rotateZ(1.1).translate(.2, .42, .12), col));
  pz.push(C.pintar(new THREE.CylinderGeometry(.04, .04, .36, 6).rotateZ(-1.1).translate(-.2, .42, .12), col));
  pz.push(C.pintar(new THREE.BoxGeometry(.3, .12, .5).translate(0, .06, .25), '#3A3430'));
  return C.mezclar(pz);
}

C.armarObstaculos = function (escena, ajuste, bote) {
  var grupo = new THREE.Group(); escena.add(grupo);
  var lista = [];            /* círculos para chocar: {x, z, r, tipo} */
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  var det = ajuste.detalle >= 2 ? 9 : ajuste.detalle >= 1 ? 6 : 3;   /* 20·(det+1)² caras */

  /* --- rocas: 3 formas, instanciadas --- */
  var formas = [geoRoca(1.3, det), geoRoca(7.7, det), geoRoca(4.1, det)];
  var mRoca = matRoca(ajuste.detalle >= 1 ? 512 : 256);   /* una textura compartida por todas las rocas */
  var porForma = [[], [], []];
  ROCAS.forEach(function (r, i) { porForma[i % 3].push(r); lista.push({ x: r[0], z: r[1], r: r[2] * .95, tipo: 'roca' }); });
  porForma.forEach(function (rs, f) {
    if (!rs.length) return;
    var im = new THREE.InstancedMesh(formas[f], mRoca, rs.length);
    rs.forEach(function (r, k) { p.set(r[0], -r[2] * .3, r[1]); e.set(0, r[0] * 1.7, 0); q.setFromEuler(e); m4.compose(p, q, s.set(r[2], r[2] * (.9 + (k % 3) * .2), r[2] * 1.1)); im.setMatrixAt(k, m4); });
    grupo.add(im);
  });
  /* espuma alrededor de las rocas: en el shader del agua */
  C.rocasTodas = ROCAS.map(function (r) { return [r[0], r[1], r[2]]; });

  /* --- redes con boyas --- */
  var nBoyas = 0, segs = [];
  REDES.forEach(function (r) { var n = Math.max(4, Math.round(Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) / 4)); segs.push({ a: r[0], b: r[1], n: n }); nBoyas += n + 1; });
  var gBoya = new THREE.SphereGeometry(.24, 14, 10); gBoya.scale(1, .85, 1);
  var boyas = new THREE.InstancedMesh(gBoya, new THREE.MeshStandardMaterial({ roughness: .4 }), nBoyas);
  var sogas = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .025, 1, 5).rotateX(Math.PI / 2).translate(0, 0, .5), new THREE.MeshStandardMaterial({ color: '#C9B48A', roughness: .9 }), nBoyas);
  var tRed = texRed(); tRed.repeat.set(4, 1);
  var redes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.4).rotateX(-Math.PI / 2).translate(0, 0, .5).rotateY(0), new THREE.MeshStandardMaterial({ map: tRed, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .9, depthWrite: false }), nBoyas);
  var col = new THREE.Color(), pBoyas = [];
  segs.forEach(function (sg) {
    for (var i = 0; i <= sg.n; i++) {
      var f = i / sg.n; pBoyas.push({ x: sg.a[0] + (sg.b[0] - sg.a[0]) * f, z: sg.a[1] + (sg.b[1] - sg.a[1]) * f, ultima: i === sg.n });
      col.set(i % 2 ? '#F2EEE6' : '#E8622A'); boyas.setColorAt(pBoyas.length - 1, col);
    }
    var L = Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]);
    for (var k = 0; k <= Math.ceil(L / 1.5); k++) { var ff = k / Math.ceil(L / 1.5); lista.push({ x: sg.a[0] + (sg.b[0] - sg.a[0]) * ff, z: sg.a[1] + (sg.b[1] - sg.a[1]) * ff, r: .7, tipo: 'red' }); }
  });
  grupo.add(boyas); grupo.add(sogas); grupo.add(redes);

  /* --- troncos a la deriva --- */
  var gTronco = new THREE.CylinderGeometry(.26, .3, 6, 12, 1).rotateZ(Math.PI / 2);
  var mTronco = new THREE.MeshStandardMaterial({ map: texCorteza(), roughness: .95 });
  var troncos = TRONCOS.map(function (d) {
    var m = new THREE.Mesh(gTronco, mTronco); grupo.add(m);
    var o = { m: m, x0: d[0], z0: d[1], ang: d[2], x: d[0], z: d[1], c: [] };
    for (var k = 0; k < 4; k++) { var c = { x: 0, z: 0, r: .55, tipo: 'tronco' }; o.c.push(c); lista.push(c); }
    return o;
  });

  /* --- pescadores en sus caballitos --- */
  var nPes = ajuste.detalle >= 1 ? 3 : 2;
  var gPes = pescador('#8E3B2E'), mPes = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  var colores = ['#8E3B2E', '#3B5E8E', '#6B7B3A'];
  var rutas = [{ tipo: 'linea', z: -205, x0: -30, x1: 32, v: 1.3 }, { tipo: 'circulo', cx: 22, cz: -385, r: 13, v: .1 }, { tipo: 'linea', z: -478, x0: 28, x1: -26, v: 1.1 }];
  var pescadores = [];
  for (var i = 0; i < nPes; i++) {
    var g = C.clonarCaballito(bote); g.rotation.order = 'YXZ';
    var pz = new THREE.Mesh(i === 0 ? gPes : pescador(colores[i]), mPes);
    pz.position.set(0, .3, .85); pz.rotation.y = Math.PI; g.add(pz);
    var remo = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.2, 6).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#CDBB72', roughness: .6 }));
    remo.position.set(0, .75, .6); g.add(remo);
    grupo.add(g);
    var o = { g: g, remo: remo, ruta: rutas[i], s: Math.random(), dir: 1, x: 0, z: 0, rumbo: 0, c: { x: 0, z: 0, r: 1.7, tipo: 'caballito' } };
    lista.push(o.c); pescadores.push(o);
  }

  var t = 0;
  return {
    lista: lista,
    cuadro: function (dt) {
      t += dt;
      /* boyas que suben y bajan con las olas; sogas y red entre ellas */
      var prev = null;
      for (var i = 0; i < pBoyas.length; i++) {
        var b = pBoyas[i], h = C.altura(b.x, b.z);
        p.set(b.x, h + .08, b.z); m4.compose(p, q.identity(), s.set(1, 1, 1)); boyas.setMatrixAt(i, m4);
        if (prev && !prev.ultima) {
          var dx = b.x - prev.x, dz = b.z - prev.z, dy = (h - prev.h), L = Math.sqrt(dx * dx + dz * dz + dy * dy);
          e.set(-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)), Math.atan2(dx, dz), 0, 'YXZ'); q.setFromEuler(e);
          p.set(prev.x, prev.h + .1, prev.z); m4.compose(p, q, s.set(1, 1, L)); sogas.setMatrixAt(i, m4);
          p.set(prev.x, (prev.h + h) * .5 + .02, prev.z); m4.compose(p, q, s.set(1.4, 1, L)); redes.setMatrixAt(i, m4);
          q.identity();
        } else { m4.makeScale(0, 0, 0); sogas.setMatrixAt(i, m4); redes.setMatrixAt(i, m4); }
        b.h = h; prev = b;
      }
      boyas.instanceMatrix.needsUpdate = true; sogas.instanceMatrix.needsUpdate = true; redes.instanceMatrix.needsUpdate = true;
      /* troncos: derivan un poco y ruedan con las olas */
      for (var k = 0; k < troncos.length; k++) {
        var o = troncos[k];
        o.x = o.x0 + Math.sin(t * .05 + k) * 3; o.z = o.z0 + Math.cos(t * .04 + k * 2) * 2;
        var ca = Math.cos(o.ang), sa = Math.sin(o.ang), h1 = C.altura(o.x - ca * 2.5, o.z + sa * 2.5), h2 = C.altura(o.x + ca * 2.5, o.z - sa * 2.5);
        o.m.position.set(o.x, (h1 + h2) / 2 - .05, o.z);
        o.m.rotation.set(Math.sin(t * .7 + k) * .3, o.ang, Math.atan2(h2 - h1, 5), 'YXZ');
        for (var j = 0; j < 4; j++) { var f = (j / 3 - .5) * 5; o.c[j].x = o.x + ca * f; o.c[j].z = o.z - sa * f; }
      }
      /* pescadores: reman despacio por su ruta */
      for (k = 0; k < pescadores.length; k++) {
        o = pescadores[k];
        var r = o.ruta, x, z, rumbo;
        if (r.tipo === 'linea') {
          o.s += dt * r.v * o.dir / Math.abs(r.x1 - r.x0); if (o.s > 1) { o.s = 1; o.dir = -1; } if (o.s < 0) { o.s = 0; o.dir = 1; }
          x = r.x0 + (r.x1 - r.x0) * o.s; z = r.z + Math.sin(t * .2 + k) * 2; rumbo = Math.atan2(-(r.x1 - r.x0) * o.dir, 0);
        } else { o.s += dt * r.v; x = r.cx + Math.cos(o.s * 6.28) * r.r; z = r.cz + Math.sin(o.s * 6.28) * r.r; rumbo = Math.atan2(Math.sin(o.s * 6.28), -Math.cos(o.s * 6.28)); }
        o.x = x; o.z = z; o.c.x = x; o.c.z = z;
        var h = C.altura(x, z);
        o.g.visible = Math.abs(z - (C.focoZ || 0)) < 190;
        o.g.position.set(x, h - .17, z); o.g.rotation.set(Math.sin(t * 1.1 + k) * .05, rumbo, Math.sin(t * .9 + k) * .06);
        o.remo.rotation.set(0, Math.sin(t * 2.2 + k) * .4, Math.sin(t * 4.4 + k) * .5);
      }
    },
    /* empujón para sacar un círculo (x, z, radio) de los obstáculos */
    choque: function (x, z, rad) {
      var peor = null, pen = 0;
      for (var i = 0; i < lista.length; i++) {
        var o = lista[i], dx = x - o.x, dz = z - o.z, d = Math.sqrt(dx * dx + dz * dz), pp = o.r + rad - d;
        if (pp > pen) { pen = pp; peor = { nx: dx / (d || 1), nz: dz / (d || 1), pen: pp, tipo: o.tipo }; }
      }
      return peor;
    }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   avatar.js: Ruway y Killa (VRoid). Carga, materiales, pose por huesos e IK de brazos, y el
   traje de chasqui de Ruway.

   Reglas (§23): los GLB se usan tal cual. No se cambian nombres de huesos J_Bip_*, ni los índices
   de morph (0 ojos, 1 alegría, 2 boca), ni las zonas del atlas: solo se LEEN para repintar la
   polera. Killa lleva la cabeza al 70 % como en Experiencias.

   Piel: los materiales vienen "sin luz" (unlit). Se cambian por Lambert (barato) con un brillo
   propio tibio y bajo: así la cara toma el color del atardecer o de la luna sin verse pálida. */
(function () {
'use strict';
var C = window.Chasqui;

C.cargarGLB = function (url, listo) {
  var hecho = false, reloj = setTimeout(function () { fin(null); }, 30000);
  function fin(x) { if (hecho) return; hecho = true; clearTimeout(reloj); listo(x); }
  try { new THREE.GLTFLoader().load(url, function (gl) { fin(gl.scene); }, null, function () { fin(null); }); }
  catch (e) { fin(null); }
};

/* ---------- texturas de tejido (procedurales) ---------- */
/* trama: hilos que se cruzan, con leve variación (se ve de cerca, no estorba de lejos) */
function trama(x, w, h, base, rnd, fuerza) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (var yy = 0; yy < h; yy += 2) { x.fillStyle = 'rgba(0,0,0,' + (.05 + rnd() * .05) * fuerza + ')'; x.fillRect(0, yy, w, 1); }
  for (var xx = 0; xx < w; xx += 2) { x.fillStyle = 'rgba(255,255,255,' + (.03 + rnd() * .04) * fuerza + ')'; x.fillRect(xx, 0, 1, h); }
}
/* un tocapu: cuadrado con una greca escalonada (diseño propio inspirado en los textiles andinos) */
function tocapu(x, px, py, s, fondo, linea, punto, tipo) {
  x.fillStyle = fondo; x.fillRect(px, py, s, s);
  x.fillStyle = linea; var u = s / 8;
  if (tipo === 0) {        /* escalera con gancho */
    x.fillRect(px + u, py + u, u * 6, u); x.fillRect(px + u * 6, py + u, u, u * 3); x.fillRect(px + u * 3, py + u * 3, u * 4, u);
    x.fillRect(px + u * 3, py + u * 3, u, u * 3); x.fillRect(px + u, py + u * 6, u * 3, u);
  } else if (tipo === 1) { /* rombo escalonado */
    x.fillRect(px + u * 3, py + u, u * 2, u); x.fillRect(px + u * 2, py + u * 2, u * 4, u); x.fillRect(px + u, py + u * 3, u * 6, u * 2);
    x.fillRect(px + u * 2, py + u * 5, u * 4, u); x.fillRect(px + u * 3, py + u * 6, u * 2, u);
    x.fillStyle = punto; x.fillRect(px + u * 3.5, py + u * 3.5, u, u);
  } else {                 /* cuadros en diagonal */
    for (var i = 0; i < 4; i++) x.fillRect(px + u + i * u * 1.5, py + u + i * u * 1.5, u, u);
    x.fillStyle = punto; x.fillRect(px + u * 5.5, py + u, u, u); x.fillRect(px + u, py + u * 5.5, u, u);
  }
  x.strokeStyle = linea; x.lineWidth = Math.max(1, u * .5); x.strokeRect(px + .5, py + .5, s - 1, s - 1);
}
var ROJO = '#7E1C22', ORO = '#D9A441', CREMA = '#EFE2C6', CAFE = '#4A2E20';
/* el unku: rojo con trama, con filas de tocapus (rojo, dorado, crema y café) */
function pintarUnku(x, x0, y0, w, h, k, rnd) {
  var c = C.lienzo(w, h), g = c.getContext('2d');
  trama(g, w, h, ROJO, rnd, 1.4);
  var s = Math.round(18 * k), paso = Math.round(64 * k);
  for (var fy = Math.round(20 * k); fy < h; fy += paso) {
    g.fillStyle = ORO; g.fillRect(0, fy - Math.round(3 * k), w, Math.max(1, Math.round(2 * k)));
    for (var fx = 0, n = 0; fx < w; fx += s + Math.round(2 * k), n++) {
      var pal = [[CREMA, CAFE, ROJO], [ORO, ROJO, CREMA], [CAFE, ORO, CREMA]][n % 3];
      tocapu(g, fx, fy, s, pal[0], pal[1], pal[2], (n + (fy / paso | 0)) % 3);
    }
    g.fillStyle = ORO; g.fillRect(0, fy + s + Math.round(1 * k), w, Math.max(1, Math.round(2 * k)));
  }
  /* trama encima de los tocapus también */
  for (var yy = 0; yy < h; yy += 2) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, yy, w, 1); }
  return c;
}
function texYacolla() {
  var w = 512, h = 512, c = C.lienzo(w, h), x = c.getContext('2d'), rnd = C.azar(61);
  trama(x, w, h, '#D9C7A4', rnd, 1.2);
  /* listas verticales finas y bordes con grecas */
  for (var i = 0; i < 14; i++) { x.fillStyle = i % 3 ? 'rgba(120,80,50,.22)' : 'rgba(126,28,34,.35)'; x.fillRect(i * 38 + 12, 0, 3, h); }
  x.fillStyle = ROJO; x.fillRect(0, h - 70, w, 70);
  for (var fx = 0, n = 0; fx < w; fx += 30, n++) tocapu(x, fx + 2, h - 58, 26, n % 2 ? ORO : CREMA, CAFE, ROJO, n % 3);
  x.fillStyle = ORO; x.fillRect(0, h - 74, w, 4);
  x.fillStyle = CAFE; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h);
  /* flecos */
  for (fx = 0; fx < w; fx += 4) { x.fillStyle = 'rgba(80,40,25,.9)'; x.fillRect(fx, h - 8, 2, 8); }
  return C.texDe(c, true, false);
}
function texFaja(base, motivo) {
  var c = C.lienzo(256, 32), x = c.getContext('2d'), rnd = C.azar(67);
  trama(x, 256, 32, base, rnd, 1.3);
  for (var i = 0; i < 16; i++) {
    x.fillStyle = motivo; x.beginPath(); x.moveTo(i * 16, 26); x.lineTo(i * 16 + 8, 6); x.lineTo(i * 16 + 16, 26); x.lineTo(i * 16 + 12, 26); x.lineTo(i * 16 + 8, 14); x.lineTo(i * 16 + 4, 26); x.fill();
  }
  x.fillStyle = CREMA; x.fillRect(0, 0, 256, 3); x.fillRect(0, 29, 256, 3);
  return C.texDe(c, true, true);
}
function texChuspa() {
  var c = C.lienzo(128, 128), x = c.getContext('2d'), rnd = C.azar(71);
  trama(x, 128, 128, '#B8862E', rnd, 1.3);
  var cols = [ROJO, CREMA, CAFE, ROJO, ORO];
  for (var i = 0; i < 10; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(0, i * 13, 128, 5); }
  for (i = 0; i < 4; i++) tocapu(x, 14 + i * 26, 52, 22, CREMA, ROJO, CAFE, i % 3);
  return C.texDe(c, true, false);
}

/* ---------- armar un avatar ---------- */
C.armarAvatar = function (escena3d, op) {
  op = op || {};
  var H = {}, cara = null, mallas = [];
  escena3d.traverse(function (o) {
    if (o.isBone) H[o.name.replace(/^J_Bip_/, '')] = o;
    if (o.isMesh) {
      o.frustumCulled = false; mallas.push(o);
      if (o.morphTargetInfluences && o.morphTargetInfluences.length >= 3) cara = o;
    }
  });
  mallas.forEach(function (o) {
    var viejo = o.material, esCara = o === cara;
    var m = new THREE.MeshLambertMaterial({
      map: viejo.map, alphaTest: .5, skinning: !!o.isSkinnedMesh, morphTargets: !!o.morphTargetInfluences,
      color: esCara ? '#FFE6DA' : '#FFFFFF', emissive: esCara ? '#FFC6A8' : '#E8D6CC', emissiveMap: viejo.map, emissiveIntensity: esCara ? .13 : .12
    });
    if (viejo.map) viejo.map.anisotropy = 4;
    o.material = m; viejo.dispose();
  });
  /* Killa: cabeza al 70 % (desde el cuello), como en Experiencias */
  var caja = new THREE.Box3().setFromObject(escena3d), v = new THREE.Vector3();
  if (op.cabeza && H.C_Head) { H.C_Head.scale.setScalar(op.cabeza); escena3d.updateMatrixWorld(true); }
  caja.setFromObject(escena3d);
  var altoArchivo = caja.max.y - caja.min.y || 1.82;
  var raiz = new THREE.Group(), k = (op.alto || 1.45) / altoArchivo;
  raiz.scale.setScalar(k); raiz.add(escena3d);
  escena3d.position.y = -caja.min.y;
  escena3d.updateMatrixWorld(true);
  var base = {}; Object.keys(H).forEach(function (n) { base[n] = H[n].quaternion.clone(); });
  var kCab = H.C_Head ? (caja.max.y - H.C_Head.getWorldPosition(v).y) / .5265 : 1; kCab = Math.min(3, Math.max(.15, kCab || 1));
  if (op.cabeza) kCab /= op.cabeza;     /* lo que cuelga de la cabeza ya se achica con ella */
  var cadera0 = H.C_Hips ? H.C_Hips.position.clone() : new THREE.Vector3();
  function largo(a, b) { return H[a].getWorldPosition(new THREE.Vector3()).distanceTo(H[b].getWorldPosition(new THREE.Vector3())); }
  var LA = {};

  var e = new THREE.Euler(), q = new THREE.Quaternion();
  function rot(n, x, y, z) { if (!H[n]) return; e.set(x || 0, y || 0, z || 0); H[n].quaternion.copy(base[n]).multiply(q.setFromEuler(e)); }
  function reposo() { for (var n in base) H[n].quaternion.copy(base[n]); if (H.C_Hips) H.C_Hips.position.copy(cadera0); }
  /* IK de dos huesos (hombro → codo → mano). Destino y polo en el mundo. */
  var vS = new THREE.Vector3(), vE = new THREE.Vector3(), vT = new THREE.Vector3(), vU = new THREE.Vector3(), vP = new THREE.Vector3(), vQ = new THREE.Vector3(),
      vH = new THREE.Vector3(), d1 = new THREE.Vector3(), d2 = new THREE.Vector3(), qd = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
  function apuntar(hueso, hijo, destino) {
    hueso.getWorldPosition(vH); hijo.getWorldPosition(d1);
    d1.sub(vH).normalize(); d2.copy(destino).sub(vH).normalize();
    qd.setFromUnitVectors(d1, d2);
    hueso.getWorldQuaternion(qw); qw.premultiply(qd);
    hueso.parent.getWorldQuaternion(qp); qp.invert();
    hueso.quaternion.copy(qp.multiply(qw));
    hueso.updateMatrixWorld(true);
  }
  function ik(lado, destino, polo) {
    if (!LA[lado]) LA[lado] = [largo(lado + '_UpperArm', lado + '_LowerArm'), largo(lado + '_LowerArm', lado + '_Hand')];
    var sup = H[lado + '_UpperArm'], inf = H[lado + '_LowerArm'], mano = H[lado + '_Hand'], a = LA[lado][0], b = LA[lado][1];
    sup.getWorldPosition(vS);
    vU.copy(destino).sub(vS); var d = Math.max(.001, Math.min(vU.length(), (a + b) * .999)); vU.normalize();
    var x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    vQ.copy(vU).multiplyScalar(polo.dot(vU)); vP.copy(polo).sub(vQ).normalize();
    vE.copy(vS).addScaledVector(vU, x).addScaledVector(vP, h);
    vT.copy(vS).addScaledVector(vU, d);
    apuntar(sup, inf, vE);
    apuntar(inf, mano, vT);
  }
  /* los huesos de los dedos, nombrados una vez (puños se llama en cada cuadro) */
  var DEDOS = []; ['Index', 'Middle', 'Ring', 'Little'].forEach(function (dd) { for (var j = 1; j <= 3; j++) DEDOS.push(['L_' + dd + j, 'R_' + dd + j, j === 1 ? .9 : 1.1]); });
  function puños(f) { for (var i = 0; i < DEDOS.length; i++) { var d = DEDOS[i]; rot(d[0], 0, 0, -d[2] * f); rot(d[1], 0, 0, d[2] * f); } rot('L_Thumb1', 0, -.4 * f, 0); rot('R_Thumb1', 0, .4 * f, 0); }
  var parpa = 2 + Math.random() * 2;
  function cara_(dt, alegria, boca, ojos) {
    if (!cara) return;
    parpa -= dt; var bl = 0; if (parpa < .14) bl = Math.sin(Math.max(0, parpa) / .14 * Math.PI); if (parpa <= 0) parpa = 2 + Math.random() * 3;
    cara.morphTargetInfluences[0] = Math.max(bl, ojos || 0);
    cara.morphTargetInfluences[1] += ((alegria === undefined ? .35 : alegria) - cara.morphTargetInfluences[1]) * Math.min(1, dt * 5);
    cara.morphTargetInfluences[2] = boca || 0;
  }
  var A = { raiz: raiz, escena: escena3d, H: H, cara: cara, mallas: mallas, kCab: kCab, k: k, rot: rot, reposo: reposo, ik: ik, puños: puños, gesto: cara_, cadera0: cadera0 };
  if (op.traje === 'chasqui') vestirChasqui(A);
  return A;
};

/* ---------- el traje de chasqui ---------- */
function vestirChasqui(A) {
  var H = A.H, kc = A.kCab;
  /* 1. unku: se repinta SOLO lo rojo de la zona de la polera (0–512 arriba a la izquierda del atlas) */
  A.mallas.forEach(function (m) {
    if (m === A.cara) return;
    var map = m.material.map; if (!map || !map.image) return;
    var W = map.image.width, Hh = map.image.height, c = C.lienzo(W, Hh), x = c.getContext('2d'); x.drawImage(map.image, 0, 0);
    var k = W / 1024, Z = Math.round(512 * k), im = x.getImageData(0, 0, Z, Z), d = im.data;
    var pat = pintarUnku(x, 0, 0, Z, Z, k, C.azar(5)).getContext('2d').getImageData(0, 0, Z, Z).data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;
      var r = d[i], g = d[i + 1], b = d[i + 2];
      if (!(r > 130 && r > g + 50 && r > b + 45)) continue;
      var f = Math.min(1.25, (.3 * r + .59 * g + .11 * b) / 105);    /* conserva la luz y sombra del original */
      d[i] = Math.min(255, pat[i] * f); d[i + 1] = Math.min(255, pat[i + 1] * f); d[i + 2] = Math.min(255, pat[i + 2] * f);
    }
    x.putImageData(im, 0, 0);
    var t = new THREE.CanvasTexture(c); t.flipY = map.flipY; t.encoding = map.encoding; t.anisotropy = 4; t.wrapS = map.wrapS; t.wrapT = map.wrapT;
    m.material.map = t; m.material.emissiveMap = t; m.material.needsUpdate = true;
    map.dispose();
  });
  A.raiz.updateMatrixWorld(true);
  var v = new THREE.Vector3(), w = new THREE.Vector3(), kw = kc * A.k;   /* kw: medidas de la cabeza en el mundo */
  /* 2. yacolla: manta corta sobre los hombros que cae por la espalda, con pliegues.
        Se arma en el mundo con el cuerpo en reposo y se cuelga del pecho (attach conserva la posición). */
  if (H.C_UpperChest && H.L_UpperArm && H.R_UpperArm && H.C_Neck) {
    var hL = H.L_UpperArm.getWorldPosition(new THREE.Vector3()), hR = H.R_UpperArm.getWorldPosition(new THREE.Vector3());
    var cu = H.C_Neck.getWorldPosition(new THREE.Vector3()), cad = H.C_Hips.getWorldPosition(new THREE.Vector3());
    var ancho = hL.distanceTo(hR) * 1.7, caida = (cu.y - cad.y) * .9, centro = hL.clone().add(hR).multiplyScalar(.5);
    var cols = 18, filas = 12, pos = [], uv = [], idx = [];
    /* la espalda real: rayos desde atrás contra la malla en reposo (una vez, ~60 rayos);
       así la manta cae justo sobre el cuerpo, sin hundirse ni quedar lejos */
    var W = hL.distanceTo(hR) * 1.45, largo = caida, ray = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3(0, 0, 1);
    var NX = 5, NY = 7, espalda = [];
    for (var ry = 0; ry < NY; ry++) { espalda.push([]); for (var rx = 0; rx < NX; rx++) {
      var fx = (rx / (NX - 1) - .5) * 2, fy = ry / (NY - 1);
      o3.set(centro.x + fx * W * .42, centro.y + .14 * kw - fy * largo, centro.z - 2);
      ray.set(o3, d3); var hit = ray.intersectObjects(A.mallas, false)[0];
      espalda[ry].push(hit ? hit.point.z : centro.z - W * .3);
    } }
    function zEspalda(u, vv) {
      var fx = u * (NX - 1), fy = vv * (NY - 1), x0 = Math.min(NX - 2, Math.floor(fx)), y0 = Math.min(NY - 2, Math.floor(fy)), tx = fx - x0, ty = fy - y0;
      var a1 = espalda[y0][x0] + (espalda[y0][x0 + 1] - espalda[y0][x0]) * tx, a2 = espalda[y0 + 1][x0] + (espalda[y0 + 1][x0 + 1] - espalda[y0 + 1][x0]) * tx;
      return a1 + (a2 - a1) * ty;
    }
    for (var j = 0; j <= filas; j++) for (var i2 = 0; i2 <= cols; i2++) {
      var u = i2 / cols, vv = j / filas, xs = (u - .5) * 2, ax = Math.abs(xs);
      var px = xs * W * .5 * (1 + vv * .08);
      var py = centro.y + .14 * kw - ax * ax * .06 * kw * (1 - vv) - vv * largo;
      var pz = Math.min(zEspalda(Math.min(1, Math.max(0, u * 1.2 - .1)), vv) - .025 * kw, centro.z - .02);
      pz -= (Math.sin(u * Math.PI * 8) * .02 + Math.sin(u * Math.PI * 3 + 1) * .014) * kw * C.suave(.08, 1, vv) + vv * vv * .04 * kw;
      pos.push(centro.x + px, py, pz); uv.push(u, 1 - vv);
    }
    for (j = 0; j < filas; j++) for (i2 = 0; i2 < cols; i2++) { var a0 = j * (cols + 1) + i2, a1 = a0 + cols + 1; idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); }
    var gY = new THREE.BufferGeometry();
    gY.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gY.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gY.setIndex(idx); gY.computeVertexNormals();
    var yac = new THREE.Mesh(gY, new THREE.MeshLambertMaterial({ map: texYacolla(), side: THREE.DoubleSide, emissive: '#3A2C22', emissiveIntensity: .25 }));
    yac.frustumCulled = false;
    /* el pivote (para que se mueva con el viento) va en la nuca */
    var piv = new THREE.Group(); piv.position.copy(centro); piv.updateMatrixWorld(true);
    yac.geometry.translate(-centro.x, -centro.y, -centro.z); piv.add(yac);
    H.C_UpperChest.attach(piv);
    A.yacolla = piv;
    /* nudo de la manta adelante, sobre el pecho */
    var nudo = new THREE.Mesh(new THREE.SphereGeometry(.05 * kw, 10, 8), new THREE.MeshLambertMaterial({ color: '#D9A441', emissive: '#5a3a10', emissiveIntensity: .3 }));
    nudo.scale.set(1.3, 1, .7); nudo.position.copy(centro).add(w.set(0, -.04 * kw, ancho * .3)); nudo.updateMatrixWorld(true); H.C_UpperChest.attach(nudo);
  }
  /* 3. vincha tejida con un disco dorado (sol) adelante; sin penacho */
  if (H.C_Head) {
    var tV = texFaja(ROJO, ORO); tV.repeat.set(3, 1);
    var vin = new THREE.Mesh(new THREE.CylinderGeometry(.395, .405, .085, 36, 1, true), new THREE.MeshLambertMaterial({ map: tV, side: THREE.DoubleSide, emissive: '#2a1010', emissiveIntensity: .3 }));
    vin.scale.set(1, 1, 1.08); vin.rotation.x = -.18;
    var g = new THREE.Group(); g.position.set(0, .2 * kc, -.02 * kc); g.scale.setScalar(kc); g.add(vin);
    var disco = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .015, 20), new THREE.MeshStandardMaterial({ color: '#E8B64A', metalness: .8, roughness: .3, emissive: '#5a3a08', emissiveIntensity: .4 }));
    disco.rotation.x = Math.PI / 2 - .18; disco.position.set(0, .01, .43); g.add(disco);
    var rayos = new THREE.Mesh(new THREE.RingGeometry(.06, .085, 12, 1), disco.material); rayos.position.set(0, .01, .432); rayos.rotation.x = -.18; g.add(rayos);
    H.C_Head.add(g); A.vincha = g;
  }
  /* 4. chuspa tejida al costado izquierdo, con su correa; y el pututo al derecho */
  if (H.C_Hips) {
    var ch = new THREE.Group(); ch.position.set(.21 * kc, -.06 * kc, .02 * kc); ch.scale.setScalar(kc);
    /* bolsa, correa y flecos en una sola malla (una llamada de dibujo) */
    var piezas = [new THREE.BoxGeometry(.15, .17, .045).rotateZ(.12), new THREE.BoxGeometry(.025, .3, .01).rotateZ(.5).translate(-.05, .2, 0)];
    for (var fl = 0; fl < 7; fl++) piezas.push(new THREE.BoxGeometry(.006, .05, .006).translate(-.06 + fl * .02, -.1, 0));
    var bolsa = new THREE.Mesh(C.mezclar(piezas), new THREE.MeshLambertMaterial({ map: texChuspa(), emissive: '#2a1a10', emissiveIntensity: .25 }));
    ch.add(bolsa);
    H.C_Hips.add(ch);
    var pts = []; for (var p = 0; p <= 12; p++) { var f = p / 12; pts.push(new THREE.Vector2(Math.sin(f * Math.PI) * .07 * (1 - f * .5) + .004, f * .24)); }
    var gp = new THREE.LatheGeometry(pts, 10); gp.rotateZ(1.2);
    var put = new THREE.Mesh(gp, new THREE.MeshLambertMaterial({ color: '#EBCDBA', emissive: '#3a2620', emissiveIntensity: .3 }));
    put.position.set(-.21 * kc, -.03 * kc, -.04 * kc); put.scale.setScalar(kc * .85); H.C_Hips.add(put);
  }
}
})();

;
/* El Chasqui del Mar — etapa 1 (prototipo).
   caballito.js: el caballito de totora (procedural), el remo de caña y Ruway remando.

   El caballito: dos haces de juncos amarrados, más gruesos atrás (con el hueco donde se
   sienta el pescador) y que se juntan adelante en una punta curvada hacia arriba.
   Cada junco es un tubo; todos van en UNA malla (una llamada de dibujo). Los amarres, en otra.

   Ruway: se usa lib/ruway-avatar.glb tal cual (mismos huesos J_Bip_*, mismos morphs 0–2,
   mismas zonas del atlas). La pose de remar se arma por código: piernas y torso a mano, y los
   brazos con IK de dos huesos para que las manos queden pegadas al remo. En la etapa 2 esto se
   puede "hornear" como clips nuevos 'remar' y 'equilibrio' en el mismo formato de ruway-movs.json. */
(function () {
'use strict';
var C = window.Chasqui = window.Chasqui || {};

/* ---------- el caballito ---------- */
var LARGO_MUESTRAS = 160;
function eje() {
  /* línea central, de la popa (s=0, +Z) a la punta (s=1, −Z y arriba) */
  var P = [[0, .20, 1.55], [0, .13, 1.0], [0, .08, .2], [0, .09, -.6], [0, .16, -1.35], [0, .34, -1.9], [0, .7, -2.3], [0, 1.12, -2.5], [0, 1.52, -2.53]];
  var curva = new THREE.CatmullRomCurve3(P.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, 'centripetal');
  var pts = [], nor = [], X = new THREE.Vector3(1, 0, 0);
  for (var i = 0; i <= LARGO_MUESTRAS; i++) {
    var s = i / LARGO_MUESTRAS, p = curva.getPointAt(s), t = curva.getTangentAt(s);
    pts.push(p); nor.push(new THREE.Vector3().crossVectors(X, t).normalize());
  }
  return { pts: pts, nor: nor };
}
function suave(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function radio(s) { return .235 * (1 - Math.pow(suave(.42, 1, s), .85)) + .02 - (s < .04 ? (.04 - s) * .5 : 0); }
function separacion(s) { return radio(s) * .86 * (1 - suave(.6, .95, s)); }

C.armarCaballito = function (ajuste) {
  var E = eje(), g = new THREE.Group();
  var tmp = new THREE.Vector3();
  function enEje(s, lat, vert, out) {   /* punto del caballito: s a lo largo, lat a los lados, vert hacia arriba */
    var f = s * LARGO_MUESTRAS, i = Math.min(LARGO_MUESTRAS - 1, Math.floor(f)), k = f - i;
    var a = E.pts[i], b = E.pts[i + 1], na = E.nor[i], nb = E.nor[i + 1];
    out.set(a.x + (b.x - a.x) * k + lat, 0, 0);
    var nx = na.y + (nb.y - na.y) * k, nz = na.z + (nb.z - na.z) * k;   /* normal en el plano YZ */
    out.y = a.y + (b.y - a.y) * k + nx * vert;
    out.z = a.z + (b.z - a.z) * k + nz * vert;
    return out;
  }
  var rnd = (function () { var s = 99; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

  /* --- juncos --- */
  var bajo = ajuste.olas < 4, SEG = bajo ? 30 : 44, RAD = bajo ? 5 : 6;
  var pos = [], nor = [], uv = [], col = [], idx = [];
  var paja = [new THREE.Color('#C9A45E'), new THREE.Color('#B8924C'), new THREE.Color('#D6B672'), new THREE.Color('#A68A4A'), new THREE.Color('#BFA060'), new THREE.Color('#9C8A52')];
  function junco(lado, ang, anillo, grosor, s0, giro) {
    var base = pos.length / 3, c0 = paja[(rnd() * paja.length) | 0].clone().multiplyScalar(.85 + rnd() * .3), cc = new THREE.Color();
    var p = new THREE.Vector3(), q = new THREE.Vector3();
    for (var j = 0; j <= SEG; j++) {
      var s = s0 + (1 - s0) * j / SEG, r = radio(s), a = ang + s * giro;
      var lat = lado * separacion(s) + Math.cos(a) * anillo * r, ver = Math.sin(a) * anillo * r * .82;
      var rr = r * grosor;
      for (var k = 0; k <= RAD; k++) {
        var b = k / RAD * Math.PI * 2, cx = Math.cos(b), sy = Math.sin(b);
        enEje(s, lat + cx * rr, ver + sy * rr, p);
        enEje(s, lat, ver, q);
        pos.push(p.x, p.y, p.z);
        var nx = p.x - q.x, ny = p.y - q.y, nz = p.z - q.z, l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nor.push(nx / l, ny / l, nz / l);
        uv.push(k / RAD, s * 9);
        /* mojado abajo (más oscuro y verdoso), un poco más claro arriba */
        var moj = 1 - suave(-.06, .12, p.y);
        cc.copy(c0).multiplyScalar(1 - moj * .5 + Math.max(0, sy) * .08); cc.g *= 1 - moj * .05; cc.b *= 1 - moj * .2;
        col.push(cc.r, cc.g, cc.b);
      }
    }
    for (j = 0; j < SEG; j++) for (k = 0; k < RAD; k++) {
      var a0 = base + j * (RAD + 1) + k, a1 = a0 + RAD + 1;
      idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1);
    }
  }
  [-1, 1].forEach(function (lado) {
    var n = bajo ? 15 : 22, giro = lado * 1.3;
    for (var i = 0; i < n; i++) {
      var ang = i / n * Math.PI * 2 + (rnd() - .5) * .2;
      /* el hueco de atrás: los juncos de arriba y hacia adentro empiezan más adelante */
      var adentro = Math.cos(ang) * -lado > .25 && Math.sin(ang) > .1;
      junco(lado, ang, .8, (bajo ? .2 : .145) + rnd() * .04, adentro ? .2 + rnd() * .05 : rnd() * .02, giro);
    }
    for (i = 0; i < (bajo ? 3 : 5); i++) junco(lado, i / 5 * 6.28, .35, .36, .03 + rnd() * .02, giro * .5);
  });
  var gj = new THREE.BufferGeometry();
  gj.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gj.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  gj.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  gj.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  gj.setIndex(idx); gj.computeBoundingSphere();
  var mJunco = new THREE.MeshStandardMaterial({ vertexColors: true, map: texFibra(), roughness: .82, metalness: 0 });
  var juncos = new THREE.Mesh(gj, mJunco); g.add(juncos);

  /* tapas de atrás: se ven las puntas cortadas de los juncos */
  var tapas = [];
  [-1, 1].forEach(function (lado) {
    var t = new THREE.CircleGeometry(radio(0) * 1.02, 18), p = new THREE.Vector3();
    enEje(0.004, lado * separacion(0), 0, p);
    t.scale(1, .82, 1); t.translate(p.x, p.y, p.z + .01);
    tapas.push(t);
  });
  var mT = new THREE.MeshStandardMaterial({ map: texPuntas(), roughness: .95 });
  tapas.forEach(function (t) { g.add(new THREE.Mesh(t, mT)); });

  /* --- amarres: vueltas de soga alrededor de los dos haces, y una espiral en la punta --- */
  var cuerdas = [];
  function soga(puntos, grosor, color) {
    var cur = new THREE.CatmullRomCurve3(puntos, false);
    var t = new THREE.TubeGeometry(cur, Math.max(8, puntos.length * 2), grosor, 4, false);
    return C.pintar(t, color);
  }
  var lugares = [.07, .17, .3, .43, .55, .65, .73, .8];
  lugares.forEach(function (s0) {
    for (var v = 0; v < 3; v++) {
      var s = s0 + v * .006, r = radio(s) * 1.03, sep = separacion(s), pts = [], p;
      for (var k = 0; k <= 26; k++) {
        var f = k / 26, ang, lat, ver;
        /* contorno de "estadio": media vuelta por la derecha, media por la izquierda */
        if (f < .5) { ang = -Math.PI / 2 + f * 2 * Math.PI; lat = sep + Math.cos(ang) * r; ver = Math.sin(ang) * r * .84; }
        else { ang = Math.PI / 2 + (f - .5) * 2 * Math.PI; lat = -sep + Math.cos(ang) * r; ver = Math.sin(ang) * r * .84; }
        p = new THREE.Vector3(); enEje(s, lat, ver, p); pts.push(p);
      }
      cuerdas.push(soga(pts, .012, v === 1 ? '#4A3220' : '#3A2616'));
    }
  });
  var esp = [];
  for (var k = 0; k <= 150; k++) { var s = .82 + k / 150 * .165, a = k * .55, r = radio(s) * 1.06 + .004, p = new THREE.Vector3(); enEje(s, Math.cos(a) * r, Math.sin(a) * r * .9, p); esp.push(p); }
  cuerdas.push(soga(esp, .01, '#3A2616'));
  var amarres = new THREE.Mesh(C.mezclar(cuerdas), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
  g.add(amarres);

  /* --- el remo: caña de Guayaquil gruesa partida a lo largo por la mitad ---
     sección en U con pared de verdad (cara de afuera, de adentro y cantos), nudos que abultan por
     fuera y su tabique a la vista por dentro; los extremos se abren y se gastan (entran al agua). */
  var remo = new THREE.Mesh(geoMediaCaña(), new THREE.MeshStandardMaterial({ map: texCaña(), vertexColors: true, roughness: .5, side: THREE.DoubleSide }));
  g.add(remo);

  /* asiento: ahí va el jinete (mira hacia −Z, igual que el caballito) */
  var jinete = new THREE.Group(); jinete.position.set(0, .26, .8); jinete.rotation.y = Math.PI; g.add(jinete);
  return { g: g, juncos: juncos, amarres: amarres, remo: remo, jinete: jinete };
};

/* ---------- el remo de media caña ---------- */
var LARGO_REMO = 2.5, NUDOS = [-1.04, -.66, -.27, .12, .51, .9];
function radioCaña(x) { var e = C.suave(.72, 1.22, Math.abs(x)); return .047 + e * .02; }
function geoMediaCaña() {
  var SX = 72, SA = 12, gr = .007, pos = [], uv = [], col = [], idx = [], i, j;
  function vert(x, ang, r, u, v, moj) { pos.push(x, -Math.cos(ang) * r, Math.sin(ang) * r); uv.push(u, v); var k = 1 - moj * .42; col.push(k, k * .97, k * .9); }
  /* dos capas: afuera (r) y adentro (r - grosor) */
  for (var capa = 0; capa < 2; capa++) {
    var base = pos.length / 3;
    for (i = 0; i <= SX; i++) {
      var x = -LARGO_REMO / 2 + LARGO_REMO * i / SX, ax = Math.abs(x), r = radioCaña(x);
      var bulto = 0; NUDOS.forEach(function (n) { bulto = Math.max(bulto, 1 - Math.abs(x - n) / .02); });
      var abre = C.suave(.8, 1.25, ax) * .55;                   /* en la punta la U se abre (se gasta y se aplana) */
      var moj = C.suave(.6, 1.0, ax);
      for (j = 0; j <= SA; j++) {
        var ang = (j / SA - .5) * (Math.PI + abre);
        var rr = capa ? r - gr : r + bulto * .004;
        vert(x, ang, rr, i / SX, capa ? .5 + j / SA * .5 : j / SA * .5, moj);
      }
    }
    for (i = 0; i < SX; i++) for (j = 0; j < SA; j++) {
      var a0 = base + i * (SA + 1) + j, a1 = a0 + SA + 1;
      if (capa) idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); else idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1);
    }
  }
  /* cantos: unen afuera y adentro en los dos bordes de la U */
  var n1 = (SX + 1) * (SA + 1);
  [0, SA].forEach(function (jj) { for (i = 0; i < SX; i++) { var o0 = i * (SA + 1) + jj, o1 = o0 + SA + 1, i0 = n1 + o0, i1 = n1 + o1; idx.push(o0, o1, i0, o1, i1, i0); } });
  /* tabiques de los nudos, a la vista por dentro (media luna) */
  NUDOS.forEach(function (n) {
    var c0 = pos.length / 3, r = radioCaña(n) - gr;
    pos.push(n, 0, 0); uv.push(.02, .97); col.push(.8, .74, .58);
    for (j = 0; j <= SA; j++) { var ang = (j / SA - .5) * Math.PI; pos.push(n, -Math.cos(ang) * r, Math.sin(ang) * r); uv.push(.02, .97); col.push(.8, .74, .58); }
    for (j = 0; j < SA; j++) idx.push(c0, c0 + 1 + j, c0 + 2 + j);
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* textura: mitad de arriba = cara de afuera (pajiza, vetas, manchas, anillos de los nudos);
   mitad de abajo = cara de adentro (más clara y fibrosa) */
function texCaña() {
  var W = 1024, H = 256, c = C.lienzo(W, H), x = c.getContext('2d'), rnd = C.azar(151);
  var g = x.createLinearGradient(0, 0, 0, H / 2); g.addColorStop(0, '#B89B55'); g.addColorStop(.5, '#D2BC78'); g.addColorStop(1, '#B4964F');
  x.fillStyle = g; x.fillRect(0, 0, W, H / 2);
  x.fillStyle = '#E3D3A6'; x.fillRect(0, H / 2, W, H / 2);
  for (var i = 0; i < 260; i++) {        /* vetas finas a lo largo */
    var y = rnd() * H, v = rnd() < .5 ? 'rgba(120,96,48,' : 'rgba(250,236,190,';
    x.strokeStyle = v + (.08 + rnd() * .18) + ')'; x.lineWidth = .5 + rnd() * 1.2;
    x.beginPath(); x.moveTo(0, y); for (var k = 1; k <= 16; k++) x.lineTo(k * W / 16, y + (rnd() - .5) * 1.5); x.stroke();
  }
  for (i = 0; i < 90; i++) {             /* manchas y desgaste */
    var px = rnd() * W, py = rnd() * H / 2, r = 3 + rnd() * 14;
    var gm = x.createRadialGradient(px, py, 0, px, py, r); gm.addColorStop(0, 'rgba(92,70,36,' + (.15 + rnd() * .25) + ')'); gm.addColorStop(1, 'rgba(92,70,36,0)');
    x.fillStyle = gm; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  /* los anillos de los nudos: una franja oscura con un borde claro, cada 128 px (8 repeticiones de u) */
  NUDOS.forEach(function (nd) {
    var nx = (nd + LARGO_REMO / 2) / LARGO_REMO * W - 4;
    x.fillStyle = 'rgba(96,74,36,.75)'; x.fillRect(nx, 0, 5, H / 2);
    x.fillStyle = 'rgba(240,226,180,.6)'; x.fillRect(nx + 5, 0, 3, H / 2);
    x.fillStyle = 'rgba(150,126,74,.35)'; x.fillRect(nx - 8, 0, 8, H / 2);
    x.fillStyle = 'rgba(170,150,100,.6)'; x.fillRect(nx, H / 2, 6, H / 2);
  });
  var t = C.texDe(c, true, false); return t;
}
/* puntas cortadas de los juncos (la popa): muchos circulitos apretados */
function texPuntas() {
  var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
  x.fillStyle = '#4A3A22'; x.fillRect(0, 0, 128, 128);
  for (var i = 0; i < 260; i++) {
    var a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 60, px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r, rr = 3 + Math.random() * 3;
    var v = 120 + Math.random() * 70;
    x.fillStyle = 'rgb(' + (v | 0) + ',' + ((v * .82) | 0) + ',' + ((v * .52) | 0) + ')'; x.beginPath(); x.arc(px, py, rr, 0, 6.3); x.fill();
    x.fillStyle = 'rgba(60,45,25,.8)'; x.beginPath(); x.arc(px, py, rr * .4, 0, 6.3); x.fill();
  }
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
/* textura de fibras: rayas finas a lo largo del junco (procedural) */
function texFibra() {
  var c = document.createElement('canvas'); c.width = 64; c.height = 256; var x = c.getContext('2d');
  x.fillStyle = '#d8d0c0'; x.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 64; i++) { var v = 170 + Math.random() * 85; x.fillStyle = 'rgba(' + (v | 0) + ',' + ((v * .95) | 0) + ',' + ((v * .82) | 0) + ',.7)'; x.fillRect(i, 0, 1, 256); }
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}


/* ---------- caballito parado en la arena ----------
   En Huanchaco, cuando no salen al mar, los caballitos se secan parados sobre la popa, en fila,
   con la punta curva hacia arriba. Es el mismo caballito (mismo eje, mismo grosor, los dos haces
   de juncos con su canal al medio y el hueco de atrás), en una malla liviana con sus amarres
   pintados, para instanciarlo. Queda de pie: la popa en y = 0, la punta arriba y su curva hacia +Z
   (el lado del hueco). Con C.matCaballitoParado se ve con la misma fibra que el que rema Ruway. */
C.geoCaballitoParado = function (ajuste) {
  var E = eje(), bajo = ajuste.olas < 6, SEG = bajo ? 22 : 32, RAD = bajo ? 7 : 10;
  var pos = [], col = [], uv = [], idx = [], i, j, k;
  var paja = new THREE.Color('#C2A262'), cuerda = new THREE.Color('#5A3E26'), puntas = new THREE.Color('#6A5430'), c = new THREE.Color(), p = new THREE.Vector3();
  var AMARRES = [.07, .17, .3, .43, .55, .65, .73, .8];
  function enEje(s, lat, vert, out) {
    var f = s * LARGO_MUESTRAS, n = Math.min(LARGO_MUESTRAS - 1, Math.floor(f)), t = f - n;
    var a = E.pts[n], b = E.pts[n + 1], na = E.nor[n], nb = E.nor[n + 1];
    out.x = a.x + (b.x - a.x) * t + lat;
    out.y = a.y + (b.y - a.y) * t + (na.y + (nb.y - na.y) * t) * vert;
    out.z = a.z + (b.z - a.z) * t + (na.z + (nb.z - na.z) * t) * vert;
    return out;
  }
  for (var lado = -1; lado <= 1; lado += 2) {
    var base = pos.length / 3;
    for (j = 0; j <= SEG; j++) {
      var s = Math.pow(j / SEG, .9);        /* un poco más de anillos hacia la punta, donde se curva */
      var r = radio(s) * 1.04, sep = separacion(s);
      var amarre = false;
      for (i = 0; i < AMARRES.length; i++) if (Math.abs(s - AMARRES[i]) < .006) amarre = true;
      if (s > .82 && Math.sin(s * 150) > .55) amarre = true;          /* la espiral de soga de la punta */
      var hueco = 1 - C.suave(.1, .24, s);                            /* atrás, arriba y hacia adentro faltan juncos */
      for (k = 0; k <= RAD; k++) {
        var a = k / RAD * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        var dentro = Math.min(1, Math.max(0, sa) * Math.max(0, -ca * lado) * 2.4) * hueco;
        var rr = r * (1 - .5 * dentro);
        enEje(s, lado * sep + ca * rr, sa * rr * .82, p); pos.push(p.x, p.y, p.z);
        c.copy(amarre ? cuerda : paja).multiplyScalar(1 - .45 * dentro);
        col.push(c.r, c.g, c.b); uv.push(k / RAD, s * 9);
      }
    }
    for (j = 0; j < SEG; j++) for (k = 0; k < RAD; k++) {
      var a0 = base + j * (RAD + 1) + k, a1 = a0 + RAD + 1;
      idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1);
    }
    /* la popa de este haz: las puntas cortadas de los juncos (abajo, contra la arena) */
    var centro = pos.length / 3; enEje(0, lado * separacion(0), 0, p); pos.push(p.x, p.y, p.z); col.push(puntas.r, puntas.g, puntas.b); uv.push(.5, 0);
    for (k = 0; k <= RAD; k++) { pos.push(pos[(base + k) * 3], pos[(base + k) * 3 + 1], pos[(base + k) * 3 + 2]); col.push(puntas.r, puntas.g, puntas.b); uv.push(k / RAD, 0); }
    for (k = 0; k < RAD; k++) idx.push(centro, centro + 1 + k, centro + 2 + k);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.rotateX(Math.PI / 2);                 /* la punta (−Z) arriba; su curva (+Y) mira a +Z */
  g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0);
  g.computeBoundingSphere();
  return g;
};
C.matCaballitoParado = function () { return new THREE.MeshStandardMaterial({ vertexColors: true, map: texFibra(), roughness: .85, metalness: 0 }); };

/* copia liviana de un caballito (comparte geometrías y materiales): para los pescadores */
C.clonarCaballito = function (bote) {
  var g = new THREE.Group();
  bote.g.children.forEach(function (o) { if (o.isMesh && o !== bote.remo) g.add(new THREE.Mesh(o.geometry, o.material)); });
  return g;
};

/* ---------- el cofre: madera con herrajes; se abre, brilla por dentro y se ve llenar ---------- */
function texMaderaCofre() {
  var c = C.lienzo(256, 256), x = c.getContext('2d'), rnd = C.azar(91);
  x.fillStyle = '#6A3F22'; x.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 5; i++) {   /* tablas */
    x.fillStyle = 'rgba(' + (rnd() < .5 ? '255,220,180' : '0,0,0') + ',' + rnd() * .1 + ')'; x.fillRect(0, i * 51, 256, 51);
    for (var k = 0; k < 40; k++) { x.strokeStyle = 'rgba(40,20,8,' + (.1 + rnd() * .25) + ')'; x.lineWidth = .5 + rnd(); x.beginPath(); var y = i * 51 + rnd() * 51; x.moveTo(0, y); x.bezierCurveTo(80, y + rnd() * 6 - 3, 170, y + rnd() * 6 - 3, 256, y + rnd() * 4 - 2); x.stroke(); }
    x.fillStyle = 'rgba(20,10,4,.8)'; x.fillRect(0, i * 51, 256, 2);
  }
  return C.texDe(c, true, true);
}
C.armarCofre = function () {
  var g = new THREE.Group(), W = .46, Hc = .26, D = .32;
  var mMad = new THREE.MeshStandardMaterial({ map: texMaderaCofre(), roughness: .75 });
  var mHierro = new THREE.MeshStandardMaterial({ color: '#2E2A28', roughness: .45, metalness: .75 });
  var mOro = new THREE.MeshStandardMaterial({ color: '#D9A441', roughness: .3, metalness: .85, emissive: '#3a2808', emissiveIntensity: .4 });
  var caja = new THREE.Mesh(new THREE.BoxGeometry(W, Hc, D).translate(0, Hc / 2, 0), mMad); g.add(caja);
  /* el interior: un plano que brilla más mientras más fotos hay */
  var mBrillo = new THREE.MeshBasicMaterial({ color: '#FFD08A', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  var brillo = new THREE.Mesh(new THREE.PlaneGeometry(W * .9, D * .9).rotateX(-Math.PI / 2).translate(0, Hc + .002, 0), mBrillo); g.add(brillo);
  var hs = [];
  [-.15, .15].forEach(function (x) { hs.push(new THREE.BoxGeometry(.035, Hc + .01, D + .012).translate(x, Hc / 2, 0)); });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { hs.push(new THREE.BoxGeometry(.05, Hc + .012, .05).translate(c[0] * (W / 2 - .02), Hc / 2, c[1] * (D / 2 - .02))); });
  var herr = new THREE.Mesh(C.mezclar(hs.map(function (h) { return C.pintar(h, '#ffffff'); })), mHierro); g.add(herr);
  var cerr = new THREE.Mesh(new THREE.BoxGeometry(.07, .08, .02).translate(0, Hc - .05, D / 2 + .008), mOro); g.add(cerr);
  /* la tapa curva, con bisagra atrás */
  var piv = new THREE.Group(); piv.position.set(0, Hc, -D / 2); g.add(piv);
  var tapa = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, W, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, D / 2), mMad);
  tapa.scale.set(1, .55, 1); piv.add(tapa);
  var th = [];
  [-.15, .15].forEach(function (x) { th.push(new THREE.CylinderGeometry(D / 2 + .008, D / 2 + .008, .035, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(x, 0, D / 2)); });
  var tHerr = new THREE.Mesh(C.mezclar(th.map(function (h) { return C.pintar(h, '#ffffff'); })), new THREE.MeshStandardMaterial({ color: '#2E2A28', roughness: .45, metalness: .75, side: THREE.DoubleSide }));
  tHerr.scale.set(1, .55, 1); piv.add(tHerr);
  /* cartas adentro (se ven por la rendija) */
  var cartas = [], mSobre = new THREE.MeshStandardMaterial({ color: '#F6EAD2', emissive: '#FFD08A', emissiveIntensity: .2, roughness: .6 });
  for (var i = 0; i < 5; i++) { var s = new THREE.Mesh(new THREE.BoxGeometry(W * .7, .012, D * .55), mSobre); s.position.set((i % 2 - .5) * .04, Hc - .07 + i * .018, (i % 3 - 1) * .02); s.rotation.y = (i - 2) * .12; s.visible = false; g.add(s); cartas.push(s); }
  var abre = .12, abreObj = .12, n = 0, pulso = 0;
  return {
    g: g, tapa: piv, ancho: W, alto: Hc,
    llenar: function (k) { n = k; for (var j = 0; j < 5; j++) cartas[j].visible = j < k; pulso = 1; },
    abrir: function (a) { abreObj = a; },
    cuadro: function (dt) {
      abre += (abreObj + pulso * .5 - abre) * Math.min(1, dt * 6); pulso = Math.max(0, pulso - dt * 1.4);
      piv.rotation.x = -abre;
      mBrillo.opacity = Math.min(1, .15 + n * .17 + pulso) * Math.min(1, abre * 4);
    }
  };
};

/* ---------- Ruway en el caballito, remando ----------
   A: avatar de avatar.js. Sentado con las piernas en el hueco, el torso gira con cada remada y
   los brazos van con IK hasta la caña. */
C.armarJinete = function (A, bote) {
  var H = A.H, raiz = A.raiz;
  bote.jinete.add(raiz);
  raiz.position.set(0, 0, 0);
  raiz.updateMatrixWorld(true);
  var hy = H.C_Hips.getWorldPosition(new THREE.Vector3()).y, ry = bote.jinete.getWorldPosition(new THREE.Vector3()).y;
  raiz.position.y = -(hy - ry) + .06;    /* la cadera a la altura del asiento */
  var cRemo = new THREE.Vector3(0, .5, .32), aRemo = new THREE.Vector3(1, 0, 0);
  var cObj = new THREE.Vector3(), aObj = new THREE.Vector3(), tmp = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  var poloL = new THREE.Vector3(), poloR = new THREE.Vector3(), mI = new THREE.Vector3(), mD = new THREE.Vector3();
  var t = 0, punta = new THREE.Vector3();
  function cuadro(dt, est) {
    t += dt;
    var p = est.fase, s = est.lado, act = est.activo, T = est.inclina || 0;
    var tiron = p < .55 ? suave(0, .55, p) : 1 - suave(.55, 1, p), dentro = p < .55 ? Math.sin(p / .55 * Math.PI) : 0;
    var beta = (.42 + .5 * dentro) * act + .06 * (1 - act);
    var barrido = (.55 - 1.0 * tiron) * act;
    cObj.set(s * .1 * act, .5 - .06 * act + Math.sin(t * 1.7) * .01 * (1 - act), .36 - .16 * tiron * act - (1 - act) * .04);
    aObj.set(s * Math.cos(beta), -Math.sin(beta), 0).normalize();
    aObj.applyAxisAngle(Y, -s * barrido * .9);
    var kk = 1 - Math.exp(-dt * 14);
    cRemo.lerp(cObj, kk); aRemo.lerp(aObj, kk).normalize();
    bote.remo.position.copy(cRemo); bote.remo.quaternion.setFromUnitVectors(X, aRemo);
    if (bote.remo.parent !== bote.jinete) bote.jinete.add(bote.remo);
    punta.copy(aRemo).multiplyScalar(s * 1.2).add(cRemo); bote.jinete.localToWorld(punta);
    A.reposo();
    var rot = A.rot;
    rot('C_Hips', 0, 0, -T * .12);
    rot('C_Spine', .16 + .14 * tiron * act, s * .22 * (tiron - .3) * act, s * .07 * dentro * act + T * .2);
    rot('C_Chest', .05 + .06 * dentro * act, s * .16 * (tiron - .3) * act, T * .1);
    rot('C_Neck', -.12, 0, 0);
    rot('C_Head', -.08 + Math.sin(t * .6) * .03, -s * .28 * (tiron - .3) * act + Math.sin(t * .37) * .12 * (1 - act), -T * .15);
    rot('L_UpperLeg', -1.42, .12, .2); rot('R_UpperLeg', -1.42, -.12, -.2);
    rot('L_LowerLeg', 1.05, 0, 0); rot('R_LowerLeg', 1.05, 0, 0);
    rot('L_Foot', -.25, 0, 0); rot('R_Foot', -.25, 0, 0);
    rot('L_Shoulder', 0, 0, -.05); rot('R_Shoulder', 0, 0, .05);
    A.puños(1);
    bote.jinete.updateMatrixWorld(true);
    mI.copy(aRemo).multiplyScalar(s * .3).add(cRemo);
    mD.copy(aRemo).multiplyScalar(-s * .3).add(cRemo);
    if (mI.x < mD.x) { tmp.copy(mI); mI.copy(mD); mD.copy(tmp); }
    bote.jinete.localToWorld(mI); bote.jinete.localToWorld(mD);
    poloL.set(.9, -1, -.6).transformDirection(bote.jinete.matrixWorld);
    poloR.set(-.9, -1, -.6).transformDirection(bote.jinete.matrixWorld);
    A.ik('L', mI, poloL); A.ik('R', mD, poloR);
    /* la manta se mece con el viento y la velocidad */
    if (A.yacolla) A.yacolla.rotation.x = -.08 - Math.min(.35, (est.vel || 0) * .05) + Math.sin(t * 2.3) * .03;
    A.gesto(dt, est.alegria, est.alegria > .8 ? .35 : 0);
  }
  return { cuadro: cuadro, punta: punta, A: A };
};
})();

;
/* El Chasqui del Mar — prototipo.
   fuegos.js: fuegos artificiales del final. Cohetes que suben con su estela y estallan en
   corazones (rojo, rosa, dorado), palmeras y crisantemos; chispas que caen con gravedad y se
   apagan, destellos, la luz que ilumina un poco la escena, su reflejo en el agua y el sonido
   lejano (sintetizado).

   Todo va en UN BufferGeometry de puntos con su shader (un dibujo) y otro dibujo para el reflejo,
   que reusa la misma geometría: cada chispa se refleja en el plano del agua y se pega a su superficie
   (así el caballito y los personajes la tapan bien). En "bajo" hay menos chispas. */
(function () {
'use strict';
var C = window.Chasqui;

C.armarFuegos = function (escena, ajuste, sonar) {
  var N = ajuste.detalle >= 2 ? 3600 : ajuste.detalle >= 1 ? 2400 : 1000;
  var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tam = new Float32Array(N), alfa = new Float32Array(N);
  var P = [];
  for (var i = 0; i < N; i++) { P.push({ v: 0 }); pos[i * 3 + 1] = -999; }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  g.setAttribute('alfa', new THREE.BufferAttribute(alfa, 1));
  var U = { uPr: { value: 1 }, uAlto: { value: 800 }, uT: C.U.uT };
  var frag = 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); float a = (exp(-r * 40.0) + exp(-r * 9.0) * .35) * vA; gl_FragColor = vec4(vC * a * 1.8, 1.0); }';
  var m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float tam; attribute float alfa; uniform float uPr, uAlto; varying vec3 vC; varying float vA; void main(){ vC = color; vA = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, tam * uAlto * .02 / -mv.z) * uPr; gl_Position = projectionMatrix * mv; }',
    fragmentShader: frag
  });
  /* el reflejo: la chispa espejada bajo el agua, llevada sobre la superficie a lo largo del rayo de la cámara */
  var mR = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: [
      'attribute float tam; attribute float alfa; uniform float uPr, uAlto, uT; varying vec3 vC; varying float vA;',
      'void main(){',
      '  vec3 p = position; p.y = -p.y;',
      '  vec3 d = p - cameraPosition; float k = (.04 - cameraPosition.y) / min(d.y, -.001);',
      '  vec3 q = cameraPosition + d * k;',
      '  q.x += sin(uT * 3.0 + q.z * .7) * .25 * min(k, 1.0); q.z += sin(uT * 2.3 + q.x * .5) * .25 * min(k, 1.0);',
      '  vC = color; vA = alfa * .6;',
      '  vec4 mv = viewMatrix * vec4(q, 1.0); gl_PointSize = max(1.0, tam * uAlto * .02 / -mv.z * 1.6) * uPr;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: frag
  });
  var puntos = new THREE.Points(g, m), reflejo = new THREE.Points(g, mR);
  puntos.frustumCulled = reflejo.frustumCulled = false; puntos.renderOrder = 6; reflejo.renderOrder = 5;
  puntos.visible = reflejo.visible = false;
  escena.add(puntos); escena.add(reflejo);
  /* una sola luz, siempre presente (para no recompilar shaders), apagada hasta que estalla algo */
  var luz = new THREE.PointLight('#ffffff', 0, 0); escena.add(luz);
  var luzI = 0;

  /* con movimiento reducido: menos cohetes, sin destellos fuertes ni chisporroteo */
  var suave = C.reducido;
  var sig = 0;
  /* una chispa: todo por argumentos (nada de objetos nuevos por chispa) */
  function chispa(x, y, z, vx, vy, vz, d, ta, r, gg, b, gr, drag, rastro, parpa) {
    var p = P[sig]; sig = (sig + 1) % N;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.d = d; p.tam = ta; p.r = r; p.g = gg; p.b = b;
    p.gr = gr; p.drag = drag; p.rastro = rastro; p.parpa = !!parpa && !suave; p.v = 1; p.t = 0; return p;
  }

  var COLORES = { rojo: [1.0, .16, .22], rosa: [1.0, .42, .7], oro: [1.0, .72, .3], blanco: [1, .95, .85], violeta: [.75, .45, 1], verde: [.4, 1, .55] };
  var cam = null, vr = new THREE.Vector3(), vu = new THREE.Vector3(), vf = new THREE.Vector3();
  var cohetes = [];
  function lanzar(origen, alto, tipo, color) {
    cohetes.push({ x: origen.x, y: 0, z: origen.z, vy: 26 + alto * .25, ap: alto, tipo: tipo, col: color, t: 0, deriva: (Math.random() - .5) * 2 });
    if (sonar) sonar('silbido', 0);
  }
  function estallar(c) {
    var col = COLORES[c.col], esc = .8 + Math.random() * .3, i, k;
    luz.position.set(c.x, c.y, c.z); luz.color.setRGB(col[0], col[1], col[2]); luzI = suave ? .5 : 1.3;
    /* destello */
    if (!suave) chispa(c.x, c.y, c.z, 0, 0, 0, .25, 60, 1, .95, .85, 0, 0, 0);
    if (cam) { cam.getWorldDirection(vf); vr.crossVectors(vf, cam.up).normalize(); vu.crossVectors(vr, vf).normalize(); }
    var mult = N >= 3000 ? 1 : N >= 2000 ? .75 : .4;
    if (c.tipo === 'corazon') {
      /* la curva del corazón en el plano que mira a la cámara: se mantiene porque todas las chispas se frenan igual */
      var m2 = Math.round(150 * mult);
      for (i = 0; i < m2; i++) {
        var t = i / m2 * Math.PI * 2, hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        var s = 1.05 * esc, jit = .97 + Math.random() * .06;
        chispa(c.x, c.y, c.z, (vr.x * hx + vu.x * hy) * s * jit, (vr.y * hx + vu.y * hy) * s * jit, (vr.z * hx + vu.z * hy) * s * jit,
          2.4 + Math.random() * .5, 30, col[0], col[1], col[2], 1.2, 1.25, 0, c.col === 'oro');
      }
      /* un corazón interior más chico, del otro color */
      var col2 = COLORES[c.col === 'oro' ? 'rojo' : 'oro'];
      for (i = 0; i < m2 * .45; i++) {
        var t2 = i / (m2 * .45) * Math.PI * 2, x2 = 16 * Math.pow(Math.sin(t2), 3), y2 = 13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2), s2 = .5 * esc;
        chispa(c.x, c.y, c.z, (vr.x * x2 + vu.x * y2) * s2, (vr.y * x2 + vu.y * y2) * s2, (vr.z * x2 + vu.z * y2) * s2, 2, 24, col2[0], col2[1], col2[2], 1.2, 1.25, 0, true);
      }
    } else if (c.tipo === 'palmera') {
      for (i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2, el = .35 + Math.random() * .3, v = 24 * esc;
        chispa(c.x, c.y, c.z, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(a) * Math.cos(el) * v, 2.6, 38, col[0], col[1], col[2], 6, .9, .03);
      }
    } else {
      /* crisantemo: esfera de chispas que dejan estela */
      var m3 = Math.round(170 * mult);
      for (i = 0; i < m3; i++) {
        var u = Math.random() * 2 - 1, f = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u), vv = 22 * esc * (.92 + Math.random() * .08);
        chispa(c.x, c.y, c.z, rr * Math.cos(f) * vv, u * vv, rr * Math.sin(f) * vv, 2 + Math.random() * .6, 24, col[0], col[1], col[2], 3, 1.4, N >= 2000 ? .06 : 0);
      }
    }
    if (sonar) sonar('estallido', Math.hypot(c.x - (cam ? cam.position.x : c.x), c.z - (cam ? cam.position.z : c.z)) / 343);
  }

  var activo = false, T = 0, prox = 0, centro = new THREE.Vector3(), ladoV = new THREE.Vector3(), orden = 0;
  var SEC = [['corazon', 'rojo'], ['crisantemo', 'oro'], ['corazon', 'rosa'], ['palmera', 'oro'], ['corazon', 'oro'], ['crisantemo', 'violeta'], ['corazon', 'rojo'], ['crisantemo', 'rosa'], ['corazon', 'rosa'], ['palmera', 'blanco']];
  var o = new THREE.Vector3();
  return {
    puntos: puntos,
    /* centro: dónde se ven (sobre el mar); lado: hacia dónde se reparten */
    empezar: function (c, l, camara) { activo = true; T = 0; prox = .2; centro.copy(c); ladoV.copy(l).normalize(); cam = camara; puntos.visible = reflejo.visible = true; },
    parar: function () { activo = false; },
    cuadro: function (dt) {
      if (!puntos.visible) return;
      T += dt;
      if (activo) {
        prox -= dt;
        if (prox <= 0) {
          var s = SEC[orden++ % SEC.length];
          o.copy(centro).addScaledVector(ladoV, (Math.random() - .5) * 60);
          o.x += (Math.random() - .5) * 20; o.z += (Math.random() - .5) * 20;
          lanzar(o, 30 + Math.random() * 22, s[0], s[1]);
          prox = suave ? 1.1 + Math.random() * .8 : .55 + Math.random() * .7;
          if (!suave && Math.random() < .3) prox = .15;   /* a veces de a dos */
        }
      }
      /* cohetes: suben dejando estela y estallan arriba */
      for (var k = cohetes.length - 1; k >= 0; k--) {
        var c = cohetes[k]; c.t += dt; c.vy -= 9.8 * dt * .35; c.y += c.vy * dt; c.x += c.deriva * dt;
        if (Math.random() < .9) chispa(c.x, c.y, c.z, (Math.random() - .5) * .6, -1, (Math.random() - .5) * .6, .6, 9, 1, .75, .45, 2, 1, 0);
        if (c.y >= c.ap || c.vy < 3) { estallar(c); cohetes.splice(k, 1); }
      }
      /* chispas */
      var vivas = 0;
      for (var i = 0; i < N; i++) {
        var p = P[i];
        if (!p.v) { alfa[i] = 0; continue; }
        p.t += dt; if (p.t >= p.d) { p.v = 0; alfa[i] = 0; pos[i * 3 + 1] = -999; continue; }
        vivas++;
        var dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vy = p.vy * dr - p.gr * dt; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.rastro && Math.random() < p.rastro * 60 * dt) chispa(p.x, p.y, p.z, 0, 0, 0, .5, p.tam * .6, p.r, p.g * .8, p.b * .6, 1, 2, 0);
        var kk = p.t / p.d, a = kk < .08 ? kk / .08 : Math.pow(1 - kk, 1.4);
        if (p.parpa && kk > .5) a *= .4 + .6 * (Math.random() < .5 ? 1 : 0);   /* las doradas chisporrotean al final */
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r; col[i * 3 + 1] = p.g; col[i * 3 + 2] = p.b;
        tam[i] = p.tam * (1 - kk * .35); alfa[i] = a;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.tam.needsUpdate = true; g.attributes.alfa.needsUpdate = true;
      luzI = Math.max(0, luzI - dt * 2.2); luz.intensity = luzI * .9;
      if (!activo && !vivas && !cohetes.length) puntos.visible = reflejo.visible = false;
    },
    medir: function (pr, alto) { U.uPr.value = pr; U.uAlto.value = alto; }
  };
};
})();

;
/* El Chasqui del Mar — prototipo.
   final.js: el "regalo mayor". Al dejar el cofre en el embarcadero:
   Ruway sube con el cofre, camina hacia Killa, se lo entrega, ella lo deja en el piso, se abrazan,
   el cofre se abre con luz y las fotos salen volando; al final, la galería.

   Todo procedural con los huesos (mismo esqueleto VRoid): pose de pie, caminar, sostener con IK,
   abrazo con IK alrededor de la espalda del otro y las cabezas ladeadas. Sin clips nuevos.
   Coordenadas: las del embarcadero (C.embarcadero). Su −Z mira hacia donde llega el caballito.

   Las fotos del regalo (de 1 a 12) salen del cofre y se acomodan en una grilla delante de la
   cámara. Cada una se pinta en un lienzo chico (4:3); si la foto no se puede usar en WebGL
   (otro dominio sin permiso, o no llegó), va una tarjeta con un corazón.
   o.evento(nombre) avisa cada momento: 'cofre', 'killa', 'abrazo', 'fuegos'. */
(function () {
'use strict';
var C = window.Chasqui;
var S = C.suave;
var PISO = .925;

function texCorazon() {
  var c = C.lienzo(64, 64), x = c.getContext('2d');
  x.fillStyle = '#FF5C8A'; x.beginPath(); x.moveTo(32, 56); x.bezierCurveTo(4, 36, 6, 10, 24, 12); x.bezierCurveTo(30, 13, 32, 18, 32, 22); x.bezierCurveTo(32, 18, 34, 13, 40, 12); x.bezierCurveTo(58, 10, 60, 36, 32, 56); x.fill();
  x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(22, 22, 5, 3, -.6, 0, 7); x.fill();
  return new THREE.CanvasTexture(c);
}

/* llaves de cámara: [t, posición, mira] en coordenadas del embarcadero */
var CAM = [
  [0, [-.6, 2.4, -7.0], [.6, .75, -1.2]],
  [3, [-2.9, 1.3, -2.9], [.05, .72, .05]],
  [6.5, [-2.5, 1.1, -1.6], [-.05, .72, .2]],
  [10.2, [-2.3, 1.0, -.95], [-.3, .8, .45]],
  [11.6, [-1.2, 1.45, -1.6], [.3, .35, .1]],
  [14.5, [-1.5, 1.6, -2.1], [.2, .75, .2]],
  /* los fuegos: detrás de Ruway y Killa, sobre el mar (el mar es +X del embarcadero) */
  [16.5, [-3.4, .85, 2.3], [40, 17, -21]],
  [30, [-3.7, .8, 2.5], [40, 19, -22]]
];

/* la foto en un lienzo de 320×240, recortada para llenar (como object-fit: cover) */
function lienzoFoto(f, i) {
  var c = C.lienzo(320, 240), x = c.getContext('2d'), im = null;
  try { im = f && f.imagen ? f.imagen() : null; } catch (e) { im = null; }
  if (im) {
    try {
      var w = im.naturalWidth || im.videoWidth || im.width, h = im.naturalHeight || im.videoHeight || im.height;
      if (w && h) { var k = Math.max(320 / w, 240 / h), dw = w * k, dh = h * k; x.drawImage(im, (320 - dw) / 2, (240 - dh) / 2, dw, dh); return c; }
    } catch (e) {}
  }
  var g = x.createLinearGradient(0, 0, 320, 240); g.addColorStop(0, '#FFB49A'); g.addColorStop(1, '#C9A2E8');
  x.fillStyle = g; x.fillRect(0, 0, 320, 240);
  x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.moveTo(160, 168); x.bezierCurveTo(96, 124, 104, 64, 146, 70); x.bezierCurveTo(154, 72, 160, 82, 160, 90);
  x.bezierCurveTo(160, 82, 166, 72, 174, 70); x.bezierCurveTo(216, 64, 224, 124, 160, 168); x.fill();
  x.fillStyle = 'rgba(90,40,60,.75)'; x.font = 'italic 22px Georgia,serif'; x.textAlign = 'center'; x.fillText('Foto ' + (i + 1), 160, 210);
  return c;
}
/* dónde va cada foto delante de la cámara (a 1,9 m), según cuántas son: en el celular parado
   caben dos columnas grandes hasta 6 fotos; con más, tres columnas más chicas */
function grilla(n) {
  var cols = n <= 1 ? 1 : n <= 6 ? 2 : 3, filas = Math.ceil(n / cols);
  var esc = Math.min(.95, .93 / (cols * .5), 1.62 / (filas * .42)), anchoC = .5 * esc, altoF = .41 * esc, L = [];
  for (var i = 0; i < n; i++) {
    var f = Math.floor(i / cols), enFila = Math.min(cols, n - f * cols), c = i - f * cols;
    L.push([(c - (enFila - 1) / 2) * anchoC, ((filas - 1) / 2 - f) * altoF + .02, esc]);
  }
  return L;
}

C.armarFinal = function (o) {
  var emb = C.embarcadero, cam = o.cam, A = null, K = null, cofre = o.cofre;
  var t = -1, activo = false, listo = false, fotosMesh = [], corazones = [], luz = null, luzCofre = null, haz = null, POS = [];
  var avisado = {};
  function evento(nom) { if (avisado[nom]) return; avisado[nom] = 1; if (o.evento) o.evento(nom); }
  var cFuegos = new THREE.Vector3(), lFuegos = new THREE.Vector3();
  var v = new THREE.Vector3(), w = new THREE.Vector3(), u = new THREE.Vector3(), pR = new THREE.Vector3(), pK = new THREE.Vector3(),
      fR = new THREE.Vector3(), fK = new THREE.Vector3(), xR = new THREE.Vector3(), xK = new THREE.Vector3(), cR = new THREE.Vector3(), cK = new THREE.Vector3(),
      t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), polo = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), cPos = new THREE.Vector3(), cMira = new THREE.Vector3();
  var INI_R = [1.7, -2.4], ENT_R = [.32, -.12], ABR_R = [-.2, .38], KIL = [-.45, .62];

  /* de pie: brazos abajo, respiración; caminar si fase >= 0 */
  function dePie(Av, tt, paso, inclina) {
    Av.reposo(); var r = Av.rot, resp = Math.sin(tt * 2.1);
    r('C_Spine', .02 + resp * .01 + (inclina || 0), 0, 0); r('C_UpperChest', resp * .012, 0, 0);
    r('L_UpperArm', 0, 0, -1.22); r('R_UpperArm', 0, 0, 1.22); r('L_LowerArm', 0, -.2, 0); r('R_LowerArm', 0, .2, 0);
    r('L_Hand', 0, 0, -.12); r('R_Hand', 0, 0, .12);
    if (paso > 0) {
      var s = Math.sin(tt * 7.5), c = Math.cos(tt * 7.5), a = .5 * paso;
      r('C_Hips', 0, s * .1 * a, c * .04 * a);
      r('L_UpperLeg', -s * a * 1.05, 0, .02); r('R_UpperLeg', s * a * 1.05, 0, -.02);
      r('L_LowerLeg', Math.max(0, c) * a * 1.5 + .03, 0, 0); r('R_LowerLeg', Math.max(0, -c) * a * 1.5 + .03, 0, 0);
      r('L_UpperArm', -s * a * .6, 0, -1.22); r('R_UpperArm', s * a * .6, 0, 1.22);
    }
  }
  function ubicar(Av, x, z, mx, mz) { Av.raiz.position.set(x, PISO, z); Av.raiz.rotation.set(0, Math.atan2(mx - x, mz - z), 0); }
  function mundo(x, y, z, out) { return emb.localToWorld(out.set(x, y, z)); }
  function lerp2(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }

  function preparar() {
    A = o.ruway(); K = o.killa();
    emb.add(A.raiz); A.raiz.scale.setScalar(A.k);
    if (K) emb.add(K.raiz);
    emb.add(cofre.g); cofre.g.scale.setScalar(1);
    luz = new THREE.PointLight('#FFC27A', 1.4, 14, 1.6); luz.position.set(2.6, 3.4, 2.4); emb.add(luz);
    luzCofre = new THREE.PointLight('#FFD38A', 0, 6, 1.5); emb.add(luzCofre);
    var tc = texCorazon();
    for (var i = 0; i < 10; i++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tc, transparent: true, depthWrite: false })); sp.visible = false; emb.add(sp); corazones.push({ s: sp, t: -1, vx: 0, vy: 0, vz: 0 }); }
    /* haz de luz que sale del cofre */
    var gH = new THREE.CylinderGeometry(.14, .32, 2.2, 20, 1, true).translate(0, 1.1, 0);
    haz = new THREE.Mesh(gH, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uT: C.U.uT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA, uT; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.2) * (.5 + .5 * sin(vUv.x * 25.0 + uT * 3.0)) * uA * .35; gl_FragColor = vec4(vec3(1.0, .8, .45) * a, 1.0); }'
    })); haz.visible = false; emb.add(haz);
    /* las fotos que salen del cofre */
    POS = grilla(o.fotos.length);
    o.fotos.forEach(function (f, i) {
      var tx = new THREE.CanvasTexture(lienzoFoto(f, i)); tx.encoding = THREE.sRGBEncoding;
      var marco = new THREE.Group();
      var m = new THREE.Mesh(new THREE.PlaneGeometry(.42, .32), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide }));
      var bor = new THREE.Mesh(new THREE.PlaneGeometry(.47, .37), new THREE.MeshBasicMaterial({ color: '#FFF4DC', transparent: true, opacity: 0, side: THREE.DoubleSide })); bor.position.z = -.003;
      marco.add(bor); marco.add(m); marco.visible = false; emb.add(marco); fotosMesh.push({ g: marco, m: m, b: bor });
    });
    listo = true;
  }
  function soltarCorazon(p) {
    for (var i = 0; i < corazones.length; i++) { var c = corazones[i]; if (c.t < 0) { c.t = 0; c.s.visible = true; c.s.position.copy(p); c.vx = (Math.random() - .5) * .25; c.vy = .35 + Math.random() * .2; c.vz = (Math.random() - .5) * .25; return; } }
  }

  var corT = 0, terminado = false, fuegosYa = false;
  function cuadro(dt) {
    if (!activo) return;
    if (!listo) preparar();
    t += dt;
    evento('cofre');
    if (K && t >= 3) evento('killa');
    if (K && t >= 7) evento('abrazo');
    /* --- dónde está cada uno --- */
    var kCamina = S(0, 3, t), kAcerca = S(6, 7.2, t), kSuelta = S(10.4, 11.4, t);
    var posR = lerp2(INI_R, ENT_R, kCamina); posR = lerp2(posR, ABR_R, kAcerca - kSuelta * .6);
    var posK = KIL;
    ubicar(A, posR[0], posR[1], posK[0], posK[1]);
    if (K) ubicar(K, posK[0], posK[1], posR[0], posR[1]);
    var camina = (t < 3 ? Math.sin(Math.min(1, t / 3) * Math.PI) : 0) + (t > 6 && t < 7.2 ? Math.sin((t - 6) / 1.2 * Math.PI) * .6 : 0);
    var agacha = t > 4.4 && t < 6 ? Math.sin((t - 4.4) / 1.6 * Math.PI) * .45 : 0;
    dePie(A, t, camina, 0);
    if (K) dePie(K, t + 1.3, 0, agacha);
    /* mirar al cofre al final */
    if (t > 11) { var kc = S(11, 12, t); A.rot('C_Head', .35 * kc, .45 * kc, 0); A.rot('C_Spine', .1 * kc, .2 * kc, 0); if (K) { K.rot('C_Head', .35 * kc, -.45 * kc, 0); K.rot('C_Spine', .1 * kc, -.2 * kc, 0); } }
    emb.updateMatrixWorld(true);
    /* vectores de cada uno: adelante y su izquierda (+X del modelo) */
    A.raiz.getWorldDirection(fR); xR.set(fR.z, 0, -fR.x);
    A.H.C_UpperChest.getWorldPosition(cR); A.H.C_Hips.getWorldPosition(pR);
    if (K) { K.raiz.getWorldDirection(fK); xK.set(fK.z, 0, -fK.x); K.H.C_UpperChest.getWorldPosition(cK); K.H.C_Hips.getWorldPosition(pK); }
    /* --- el cofre: en manos de Ruway → entre los dos → en manos de Killa → al piso --- */
    var enR = v.copy(pR).addScaledVector(fR, .3).addScaledVector(UP, -.08);
    var enK = K ? w.copy(pK).addScaledVector(fK, .3).addScaledVector(UP, -.08) : enR;
    var piso = mundo(.42, PISO, .12, u);
    var kPasa = S(3, 4.2, t), kPiso = S(4.6, 5.8, t);
    t1.copy(enR).lerp(enK, kPasa).lerp(piso, kPiso);
    emb.worldToLocal(t2.copy(t1).addScaledVector(UP, -cofre.alto * .5 * (1 - kPiso)));
    cofre.g.position.copy(t2);
    cofre.g.rotation.set(0, Math.atan2(fR.x, fR.z) - emb.rotation.y + (K ? kPasa * Math.PI : 0), 0);
    emb.updateMatrixWorld(true);
    /* manos al cofre */
    var anchoC = cofre.ancho * .5 + .02;
    if (kPasa < .95) {
      polo.copy(xR).multiplyScalar(1).addScaledVector(UP, -1);
      A.ik('L', t2.copy(t1).addScaledVector(xR, anchoC), polo);
      polo.copy(xR).multiplyScalar(-1).addScaledVector(UP, -1);
      A.ik('R', t2.copy(t1).addScaledVector(xR, -anchoC), polo);
      A.puños(.6);
    }
    if (K && kPasa > .05 && kPiso < .9) {
      polo.copy(xK).addScaledVector(UP, -1); K.ik('L', t2.copy(t1).addScaledVector(xK, anchoC), polo);
      polo.copy(xK).multiplyScalar(-1).addScaledVector(UP, -1); K.ik('R', t2.copy(t1).addScaledVector(xK, -anchoC), polo);
      K.puños(.6);
    }
    /* --- el abrazo --- */
    var kAbr = S(7, 7.8, t) * (1 - S(10.2, 10.9, t));
    if (K && kAbr > .01) {
      /* las manos de Ruway en la espalda de Killa (y al revés); cabezas ladeadas a su izquierda */
      var espK = t1.copy(cK).addScaledVector(fK, -.12);
      polo.copy(xR).addScaledVector(UP, -.4);
      A.ik('L', t2.copy(cR).addScaledVector(fR, .25).lerp(u.copy(espK).addScaledVector(xK, -.1).addScaledVector(UP, .04), kAbr), polo);
      polo.copy(xR).multiplyScalar(-1).addScaledVector(UP, -.4);
      A.ik('R', t2.copy(cR).addScaledVector(fR, .25).lerp(u.copy(espK).addScaledVector(xK, .1).addScaledVector(UP, -.08), kAbr), polo);
      var espR = t1.copy(cR).addScaledVector(fR, -.12);
      polo.copy(xK).addScaledVector(UP, -.4);
      K.ik('L', t2.copy(cK).addScaledVector(fK, .25).lerp(u.copy(espR).addScaledVector(xR, -.1).addScaledVector(UP, .06), kAbr), polo);
      polo.copy(xK).multiplyScalar(-1).addScaledVector(UP, -.4);
      K.ik('R', t2.copy(cK).addScaledVector(fK, .25).lerp(u.copy(espR).addScaledVector(xR, .1).addScaledVector(UP, -.02), kAbr), polo);
      A.rot('C_Neck', 0, .25 * kAbr, .12 * kAbr); A.rot('C_Head', .1 * kAbr, .45 * kAbr, .25 * kAbr);
      K.rot('C_Neck', 0, .25 * kAbr, .12 * kAbr); K.rot('C_Head', .1 * kAbr, .45 * kAbr, .25 * kAbr);
      corT -= dt; if (corT < 0 && kAbr > .8) { corT = .35; soltarCorazon(emb.worldToLocal(u.copy(cR).add(cK).multiplyScalar(.5).addScaledVector(UP, .45))); }
    }
    /* caras */
    A.gesto(dt, kAbr > .5 ? 1 : .5, t > 7 && t < 10 ? .2 : 0, 0);
    if (K) K.gesto(dt, kAbr > .5 ? 1 : .55, t > 3 && t < 4.5 ? .3 : 0, 0);
    if (A.yacolla) A.yacolla.rotation.x = -.06 + Math.sin(t * 1.7) * .03;
    /* --- el cofre se abre con luz y salen las fotos --- */
    var kAbre = S(11.5, 12.6, t);
    cofre.abrir(.12 + kAbre * 1.75); cofre.cuadro(dt);
    luzCofre.position.copy(cofre.g.position).add(u.set(0, .6, 0)); luzCofre.intensity = kAbre * 1.1;
    haz.visible = kAbre > .01; haz.position.copy(cofre.g.position).add(u.set(0, cofre.alto, 0)); haz.material.uniforms.uA.value = kAbre * (1 - S(14.5, 16, t));
    if (kAbre > .3 && Math.random() < dt * 30) o.chispa(mundo(cofre.g.position.x + (Math.random() - .5) * .3, PISO + .35, cofre.g.position.z + (Math.random() - .5) * .3, u), .5);
    /* las fotos: salen del cofre una tras otra y se acomodan en su grilla delante de la cámara */
    var paso = Math.min(.35, 1.75 / Math.max(1, fotosMesh.length));
    for (var fi = 0; fi < fotosMesh.length; fi++) {
      var f = fotosMesh[fi], k = S(12.3 + fi * paso, 13.6 + fi * paso, t);
      f.g.visible = k > 0 && t <= 15.4;
      if (!f.g.visible) continue;
      var pos = POS[fi];
      cam.getWorldDirection(fR); xR.crossVectors(fR, UP).normalize(); w.crossVectors(xR, fR);
      var dest = t2.copy(cam.position).addScaledVector(fR, 1.9).addScaledVector(xR, pos[0]).addScaledVector(w, pos[1]);
      emb.worldToLocal(dest);
      f.g.position.copy(cofre.g.position).add(u.set(0, cofre.alto, 0)).lerp(dest, k);
      f.g.scale.setScalar((.3 + .7 * k) * pos[2]);
      f.g.lookAt(cam.position);   /* lookAt ya descuenta el giro del embarcadero */
      f.m.material.opacity = f.b.material.opacity = Math.min(1, k * 1.5) * (1 - S(14.6, 15.4, t));
    }
    /* corazones */
    for (var ci = 0; ci < corazones.length; ci++) {
      var c = corazones[ci];
      if (c.t < 0) continue; c.t += dt; if (c.t > 2) { c.t = -1; c.s.visible = false; continue; }
      c.s.position.x += c.vx * dt; c.s.position.y += c.vy * dt; c.s.position.z += c.vz * dt;
      c.s.scale.setScalar(.12 + c.t * .05); c.s.material.opacity = Math.min(1, (2 - c.t) * 1.5);
    }
    /* --- cámara --- */
    var i = 0; while (i < CAM.length - 2 && t > CAM[i + 1][0]) i++;
    var a = CAM[i], b = CAM[i + 1], kk = S(a[0], b[0], t);
    /* las alturas de las llaves se miden desde el piso del embarcadero */
    mundo(a[1][0] + (b[1][0] - a[1][0]) * kk, PISO + a[1][1] + (b[1][1] - a[1][1]) * kk, a[1][2] + (b[1][2] - a[1][2]) * kk, cPos);
    mundo(a[2][0] + (b[2][0] - a[2][0]) * kk, PISO + a[2][1] + (b[2][1] - a[2][1]) * kk, a[2][2] + (b[2][2] - a[2][2]) * kk, cMira);
    cam.position.copy(cPos); cam.lookAt(cMira);
    /* fuegos artificiales: empiezan cuando el cofre ya está abierto */
    if (t > 14.8 && !fuegosYa && o.fuegos) { fuegosYa = true; o.fuegos.empezar(mundo(95, 0, -45, cFuegos), mundo(0, 0, 1, lFuegos).sub(emb.position), cam); evento('fuegos'); }
    if (t > 15.5) {
      /* los dos se voltean al mar y miran arriba, juntos */
      var km = S(15.5, 16.8, t);
      ubicar(A, posR[0], posR[1], posR[0] + 10 * km + (posK[0] - posR[0]) * (1 - km), posR[1] + (posK[1] - posR[1]) * (1 - km));
      if (K) ubicar(K, posK[0], posK[1], posK[0] + 10 * km + (posR[0] - posK[0]) * (1 - km), posK[1] + (posR[1] - posK[1]) * (1 - km));
      A.rot('C_Head', -.35 * km, 0, 0); if (K) K.rot('C_Head', -.35 * km, 0, .1 * km);
    }
    if (t > 27 && !terminado) { terminado = true; if (o.fuegos) o.fuegos.parar(); o.alTerminar(); }
  }
  return {
    iniciar: function (desde) { activo = true; terminado = false; t = desde || 0; },
    /* saltar: se corta aquí (la galería la abre quien llama) */
    parar: function () { activo = false; terminado = true; if (o.fuegos) o.fuegos.parar(); },
    cuadro: cuadro,
    activo: function () { return activo; },
    tiempo: function () { return t; }
  };
};
})();

;
/* El Chasqui del Mar — juego.js: el juego entero, como una función que se abre y se cierra.

   Ruway rema en su caballito de totora de la tarde a la noche hacia el muelle de Huanchaco,
   esquiva rocas, redes, troncos y otros caballitos, y guarda en su cofre las fotos del regalo
   (cada una flota en un sobre que brilla). En el muelle viene el final (final.js): el cofre,
   Killa, el abrazo, los fuegos y la galería.

   Lo usan la experiencia 'cartas' de x.html (Experiencias.html) y la maqueta (maquetas/chasqui).

     var j = Chasqui.jugar({
       contenedor: <div> de pantalla completa donde van el lienzo y los mandos,
       fotos:      [{frase, src, poner(img), imagen()}] — poner pone la foto en un <img> (aunque
                   llegue tarde); imagen() da una imagen que se puede pintar en WebGL, o null,
       guardadas:  {0:1, 3:1…} las que ya están en el cofre (el regalo se abrió antes),
       visto:      true si ya vio el final (sale "Ver el final otra vez"),
       glbRuway, glbKilla, conMusica, auto (piloto: solo capturas),
       gpu:        el nombre de la tarjeta de video, si la página ya lo sabe (elige la calidad),
       tapado():   true si algo de la página tapa el mar (entonces no se dibuja),
       al: { listo(), recoger(i, seguir), final(), galeria(), seguir(), fallo(motivo), bajo() }
     });
     j.cerrar();   // libera todo: geometrías, materiales, texturas, sonido y el contexto WebGL

   Las frases son del cliente: siempre van como texto (textContent), nunca como HTML.

   Celulares de gama baja primero: una sola WebGLRenderer; calidad automática (bajo, medio o alto
   según el equipo y su tarjeta de video) y menos resolución si va lento; el bucle se para si la
   página no se ve o si hay una tarjeta encima; nada se crea por cuadro. Si el contexto WebGL se
   pierde, avisa con al.fallo('perdido') y la página sigue con el álbum en 2D.

   Para pruebas y capturas deja window.__chasqui (estado, recoger, irMuelle, velocidad, saltar,
   historia, y los ganchos de cámara de la maqueta). Se quita al cerrar. */
(function () {
'use strict';
var C = window.Chasqui;

/* ---------- el recorrido según cuántas fotos hay ----------
   Con pocas fotos se sale más cerca del muelle; con muchas, más lejos (de 200 m con una hasta
   700 m con doce). Las fotos se reparten a lo largo, una a cada lado del camino, sin caer encima
   de una roca, una red o un tronco, y lejos de la orilla y del muelle. Sin azar: el mismo número
   de fotos da siempre el mismo recorrido. */
function distSeg(px, pz, a, b) {
  var bx = b[0] - a[0], bz = b[1] - a[1], L2 = bx * bx + bz * bz || 1, u = Math.max(0, Math.min(1, ((px - a[0]) * bx + (pz - a[1]) * bz) / L2));
  return Math.hypot(px - a[0] - bx * u, pz - a[1] - bz * u);
}
C.recorrido = function (n) {
  n = Math.max(0, Math.min(12, n | 0));
  var M = C.META, O = C.OBSTACULOS || { rocas: [], redes: [], troncos: [] };
  var D = n >= 5 ? 560 + 20 * (n - 5) : 200 + 90 * (Math.max(1, n) - 1);
  var raiz = [C.ORILLA.x, C.ORILLA.z], punta = [C.PUNTA_MUELLE.x, C.PUNTA_MUELLE.z];
  function libre(x, z, holgura, otros) {
    var i;
    if (C.bOrilla(x, z) > -40) return false;
    for (i = 0; i < O.rocas.length; i++) if (Math.hypot(x - O.rocas[i][0], z - O.rocas[i][1]) < O.rocas[i][2] + 5 + holgura) return false;
    for (i = 0; i < O.redes.length; i++) if (distSeg(x, z, O.redes[i][0], O.redes[i][1]) < 7 + holgura) return false;
    for (i = 0; i < O.troncos.length; i++) if (Math.hypot(x - O.troncos[i][0], z - O.troncos[i][1]) < 9 + holgura) return false;
    if (distSeg(x, z, raiz, punta) < 14 || Math.hypot(x - C.EMBARCADERO.x, z - C.EMBARCADERO.z) < 14 || Math.hypot(x - M.x, z - M.z) < 30) return false;
    for (i = 0; otros && i < otros.length; i++) if (Math.hypot(x - otros[i][0], z - otros[i][1]) < 20) return false;
    return true;
  }
  function acomodar(x, z, holgura, otros) {
    var dx = [0, 3, -3, 6, -6, 9, -9, 12, -12, 16, -16, 20, -20, 25, -25, 30, -30], dz = [0, 4, -4, 8, -8];
    for (var b = 0; b < dz.length; b++) for (var a = 0; a < dx.length; a++) if (libre(x + dx[a], z + dz[b], holgura, otros)) return [x + dx[a], z + dz[b]];
    return [x, z];
  }
  var p0 = acomodar(0, M.z + D, 6, null);
  var inicio = { x: p0[0], z: p0[1], rumbo: 0 };
  var zA = inicio.z - 50, zB = M.z + 70, fotos = [], rnd = C.azar(97 + n);
  for (var i = 0; i < n; i++) {
    var f = n === 1 ? .5 : i / (n - 1), z = zA + (zB - zA) * f;
    var centro = inicio.x + (M.x - inicio.x) * Math.max(0, Math.min(1, (inicio.z - z) / D));
    var x = centro + (i % 2 ? 1 : -1) * (7 + rnd() * 9);
    fotos.push(acomodar(x, z, 0, fotos));
  }
  return { inicio: inicio, fotos: fotos, largo: D };
};

/* ---------- estilos de los mandos (van con el juego: x.html no carga nada de esto si no se juega) ---------- */
var ESTILO = [
  '#cq{position:fixed;inset:0;z-index:1;background:#2A1B33;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}',
  '#cq [hidden],#cq-galeria[hidden]{display:none!important}',
  '#cq .cq-lienzo{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
  '#cq button,#cq-galeria button{font-family:inherit}',
  '.cq-hud{position:absolute;inset:0;pointer-events:none;z-index:4;font-family:Nunito,system-ui,sans-serif;color:#FFF1DA}',
  '.cq-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;background:rgba(30,18,38,.45);border:1px solid rgba(255,227,163,.28);font:700 13px Nunito,system-ui,sans-serif;color:#FFF1DA;text-shadow:0 1px 2px rgba(0,0,0,.35);white-space:nowrap}',
  /* debajo del título, los puntos y la mochila de la página */
  '#cq-rumbo{position:absolute;left:50%;top:calc(136px + env(safe-area-inset-top,0px));transform:translateX(-50%)}',
  '.cq-flecha{display:inline-block;color:#F2C46D;font-size:15px;transition:transform .15s linear}',
  '#cq-aviso{position:absolute;left:50%;top:calc(182px + env(safe-area-inset-top,0px));transform:translate(-50%,-8px);width:max-content;max-width:86%;text-align:center;padding:10px 18px;border-radius:14px;background:rgba(30,18,38,.5);border:1px solid rgba(255,227,163,.28);font:700 14px/1.35 Nunito,system-ui,sans-serif;opacity:0;transition:opacity .35s,transform .35s}',
  '#cq-aviso.ver{opacity:1;transform:translate(-50%,0)}',
  '#cq-aviso.oro{background:linear-gradient(180deg,rgba(255,214,140,.94),rgba(242,170,80,.94));color:#3A2410;border-color:#FFE3A3}',
  '#cq-aviso.ola{background:rgba(20,52,64,.66);border-color:rgba(160,230,230,.4)}',
  '#cq-aviso.alerta{background:rgba(120,30,40,.62);border-color:rgba(255,160,160,.45)}',
  '#cq-ahora{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(.8);font:italic 600 34px Georgia,"Times New Roman",serif;color:#FFF3D6;text-shadow:0 0 24px rgba(255,190,100,.9),0 2px 4px rgba(0,0,0,.4);opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap}',
  '#cq-ahora.ver{opacity:1;transform:translate(-50%,-50%) scale(1);animation:cq-late .55s ease-in-out infinite alternate}',
  '@keyframes cq-late{to{transform:translate(-50%,-50%) scale(1.08)}}',
  '.cq-abajo{position:absolute;left:0;right:0;bottom:calc(22px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:8px}',
  '.cq-ritmo{display:flex;gap:6px}',
  '.cq-ritmo i{width:7px;height:7px;border-radius:50%;background:rgba(255,227,163,.25);transition:background .2s,box-shadow .2s}',
  '.cq-ritmo i.on{background:#F2C46D;box-shadow:0 0 8px #F2C46D}',
  '.cq-nivel{position:relative;width:120px;height:14px;border-radius:999px;background:rgba(30,18,38,.45);border:1px solid rgba(255,227,163,.28);overflow:hidden}',
  '.cq-nivel::before{content:"";position:absolute;left:50%;top:2px;bottom:2px;width:2px;margin-left:-1px;background:rgba(255,227,163,.5)}',
  '.cq-nivel.calma{opacity:.35}',
  '.cq-burbuja{position:absolute;left:50%;top:2px;width:20px;height:8px;margin-left:-10px;border-radius:999px;background:#BFF0E6;box-shadow:0 0 8px rgba(190,240,230,.8);transition:background .2s}',
  '.cq-nivel.peligro .cq-burbuja{background:#FF9C8A;box-shadow:0 0 10px rgba(255,120,100,.9)}',
  '.cq-lbl{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;opacity:.7}',
  '.cq-bt{pointer-events:auto;border:1px solid rgba(255,227,163,.3);border-radius:999px;padding:10px 15px;background:rgba(30,18,38,.55);color:#FFF1DA;font:700 14px Nunito,system-ui,sans-serif;cursor:pointer}',
  '.cq-bt:focus-visible,#cq-seguir:focus-visible{outline:3px solid #fff;outline-offset:3px}',
  '#cq-mirar{position:absolute;right:14px;bottom:calc(22px + env(safe-area-inset-bottom,0px))}',
  '#cq-mirar[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,214,140,.94),rgba(242,170,80,.94));color:#3A2410}',
  '#cq-sonido{position:absolute;right:14px;bottom:calc(74px + env(safe-area-inset-bottom,0px));width:42px;height:42px;padding:0;display:grid;place-items:center}',
  '#cq-sonido svg{width:20px;height:20px}',
  '#cq-sonido[aria-pressed=true] .onda{display:none}#cq-sonido .tache{display:none}#cq-sonido[aria-pressed=true] .tache{display:inline}',
  '#cq-verfin{position:absolute;left:14px;bottom:calc(22px + env(safe-area-inset-bottom,0px))}',
  '#cq-saltar{position:absolute;right:14px;bottom:calc(22px + env(safe-area-inset-bottom,0px));z-index:7}',
  '#cq-palanca{position:fixed;left:0;top:0;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;border:2px solid rgba(255,241,218,.38);background:radial-gradient(circle,rgba(255,241,218,.05),rgba(255,241,218,.14));pointer-events:none;display:none;z-index:5}',
  '#cq-palanca.ver{display:block}',
  '#cq-perilla{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFF6E4,#E9D2A6);box-shadow:0 4px 14px rgba(0,0,0,.35)}',
  '#cq-velo{position:absolute;inset:0;background:#07050c;opacity:0;transition:opacity .7s ease;pointer-events:none;z-index:6}',
  '#cq-velo.ver{opacity:1}',
  '#cq-fps{position:absolute;left:8px;bottom:calc(70px + env(safe-area-inset-bottom,0px));font:11px/1.3 ui-monospace,Consolas,monospace;color:#CFFFD8;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:6px;pointer-events:none;z-index:5}',
  /* durante el final, el título y los puntos de la página se apartan */
  'body.cq-cine .hud{opacity:0;transition:opacity .5s}',
  '#cq-galeria{position:fixed;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:24px 16px;overflow-y:auto;background:radial-gradient(ellipse at 50% 40%,rgba(42,27,51,.4),rgba(20,12,26,.86));opacity:0;transition:opacity .45s;font-family:Nunito,system-ui,sans-serif}',
  '#cq-galeria.ver{opacity:1}',
  '.cq-gal{width:min(360px,100%);margin:auto;text-align:center;color:#FFF3DE;padding-bottom:12px}',
  '.cq-mini{letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#FFE3A3;margin:0 0 8px}',
  '.cq-gal h2{font:600 26px/1.15 Georgia,"Times New Roman",serif;margin:0 0 16px;text-shadow:0 2px 18px rgba(255,170,90,.45)}',
  '.cq-lista{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.cq-lista.impar .cq-foto:first-child{grid-column:1/3}',
  '.cq-foto{appearance:none;border:0;padding:6px 6px 8px;border-radius:12px;background:linear-gradient(180deg,#FFF9EC,#F4E6CB);color:#3A2410;cursor:pointer;text-align:left}',
  '.cq-foto .cq-im{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:linear-gradient(145deg,#FFB49A,#C9A2E8)}',
  '.cq-foto span{display:block;font:italic 13px/1.3 Georgia,"Times New Roman",serif;margin:6px 2px 0;white-space:pre-line;overflow-wrap:anywhere}',
  '.cq-vacio{font:italic 17px/1.4 Georgia,serif;color:#FFE9C6}',
  '#cq-seguir{margin-top:18px;border:0;border-radius:999px;padding:14px 32px;font:700 17px Fredoka,Nunito,sans-serif;color:#3A2410;background:linear-gradient(180deg,#FFE3A3,#F2B55A);box-shadow:0 10px 26px rgba(242,150,70,.4);cursor:pointer}',
  '#cq-grande{position:fixed;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,6,14,.9)}',
  '#cq-grande figure{margin:0;width:min(380px,100%)}',
  '#cq-grande img{display:block;width:100%;border-radius:12px}',
  '#cq-grande figcaption{font:italic 19px/1.35 Georgia,serif;color:#FFF3DE;margin-top:10px;text-align:center;white-space:pre-line;overflow-wrap:anywhere}',
  '@media (prefers-reduced-motion: reduce){#cq *,#cq-galeria,#cq-galeria *{transition:none!important;animation:none!important}}'
].join('\n');
function estilos() {
  if (document.getElementById('cq-estilo')) return;
  var s = document.createElement('style'); s.id = 'cq-estilo'; s.textContent = ESTILO; document.head.appendChild(s);
}
function el(tag, cls, padre, txt) {
  var e = document.createElement(tag); if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (padre) padre.appendChild(e); return e;
}
/* libera todo lo que cuelga de un objeto: geometrías, materiales y sus texturas (también las de los uniforms) */
function liberar(raiz) {
  if (!raiz) return;
  var geos = new Set(), mats = new Set(), texs = new Set();
  raiz.traverse(function (x) {
    if (x.geometry) geos.add(x.geometry);
    if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach(function (m) { mats.add(m); });
    if (x.skeleton && x.skeleton.boneTexture) texs.add(x.skeleton.boneTexture);
  });
  mats.forEach(function (m) {
    for (var k in m) { var v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (var u in m.uniforms) {
      var val = m.uniforms[u] && m.uniforms[u].value;
      if (val && val.isTexture) texs.add(val);
      else if (Array.isArray(val)) for (var j = 0; j < val.length; j++) if (val[j] && val[j].isTexture) texs.add(val[j]);
    }
    m.dispose();
  });
  geos.forEach(function (g) { g.dispose(); });
  texs.forEach(function (t) { t.dispose(); });
}
C.liberar = liberar;

/* ====================================================================== */
/* Si algo lanza mientras se arma el juego, se cierra lo que alcanzó a abrirse (el lienzo, el
   contexto WebGL, los oyentes) y se relanza: la página sigue con el álbum sin dejar nada vivo. */
C.jugar = function (o) {
  var cerrarLoAbierto = null;
  try { return jugarAdentro(o, function (c) { cerrarLoAbierto = c; }); }
  catch (e) { if (cerrarLoAbierto) { try { cerrarLoAbierto(); } catch (x) {} } throw e; }
};
function jugarAdentro(o, registrar) {
registrar(cerrar);
estilos();
o = o || {};
var al = o.al || {};
var caja = o.contenedor;
var FOTOS = o.fotos || [], N = Math.min(12, FOTOS.length);
var Q = location.search;
var VER_FPS = /[?&]fps=1/.test(Q), AUTO = !!o.auto;
var red = C.reducido;
var vivo = true, listo = false;
var relojes = [], escuchas = [], propios = [];
function luego(fn, ms) {
  var id = setTimeout(function () { var k = relojes.indexOf(id); if (k >= 0) relojes.splice(k, 1); if (vivo) fn(); }, ms || 0);
  relojes.push(id); return id;
}
function escuchar(t, ev, fn, op) { t.addEventListener(ev, fn, op); escuchas.push([t, ev, fn, op]); }
function poner(f, im) { if (!f) return; if (f.poner) f.poner(im); else if (f.src) im.src = f.src; }

/* ---------- los mandos (DOM propio, todo con textContent) ---------- */
var lienzo = el('canvas', 'cq-lienzo', caja); lienzo.setAttribute('aria-label', 'El mar de Huanchaco: Ruway rema en su caballito de totora');
var hudEl = el('div', 'cq-hud', caja); hudEl.hidden = true;
var rumbo = el('div', 'cq-pill', hudEl); rumbo.id = 'cq-rumbo';
var flecha = el('span', 'cq-flecha', rumbo, '➤'); flecha.setAttribute('aria-hidden', 'true');
var rumboTxt = el('span', '', rumbo, 'Foto');
var avisoEl = el('div', '', hudEl); avisoEl.id = 'cq-aviso'; avisoEl.setAttribute('role', 'status');
var ahoraEl = el('div', '', hudEl, '¡Ahora, rema!'); ahoraEl.id = 'cq-ahora';
var abajo = el('div', 'cq-abajo', hudEl);
var ritmoEl = el('div', 'cq-ritmo', abajo); ritmoEl.setAttribute('aria-hidden', 'true');
for (var ii = 0; ii < 4; ii++) el('i', '', ritmoEl);
var nivelEl = el('div', 'cq-nivel', abajo); nivelEl.setAttribute('aria-hidden', 'true');
var burbuja = el('div', 'cq-burbuja', nivelEl);
el('div', 'cq-lbl', abajo, 'equilibrio');
var bMirar = el('button', 'cq-bt', hudEl, '👀 Mirar'); bMirar.id = 'cq-mirar'; bMirar.type = 'button'; bMirar.setAttribute('aria-pressed', 'false');
var bSonido = el('button', 'cq-bt', hudEl); bSonido.id = 'cq-sonido'; bSonido.type = 'button'; bSonido.setAttribute('aria-label', 'Silenciar el mar'); bSonido.setAttribute('aria-pressed', 'false');
bSonido.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFE3A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="#FFE3A3" stroke="none"/><path class="onda" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="tache" d="M17 9l5 6M22 9l-5 6"/></svg>';
var bVerFin = el('button', 'cq-bt', hudEl, '🎬 Ver el final otra vez'); bVerFin.id = 'cq-verfin'; bVerFin.type = 'button'; bVerFin.hidden = !o.visto;
var bSaltar = el('button', 'cq-bt', caja, 'Saltar ⏭'); bSaltar.id = 'cq-saltar'; bSaltar.type = 'button'; bSaltar.hidden = true;
var palanca = el('div', '', caja); palanca.id = 'cq-palanca'; palanca.setAttribute('aria-hidden', 'true');
var perilla = el('i', '', palanca); perilla.id = 'cq-perilla';
var velo = el('div', '', caja); velo.id = 'cq-velo'; velo.hidden = true;
var fpsEl = null; if (VER_FPS) { fpsEl = el('div', '', caja); fpsEl.id = 'cq-fps'; }
propios.push(lienzo, hudEl, bSaltar, palanca, velo); if (fpsEl) propios.push(fpsEl);
var galeria = null, grande = null, galeriaAbierta = false;
var historia = [];

/* ---------- escena ----------
   La calidad se decide ANTES de crear el lienzo (el antialias no se puede cambiar después): con el
   nombre de la tarjeta de video que averiguó la página (o.gpu), si lo trae. */
var calidad = C.calidad(null, o.gpu), AJ = C.AJUSTES[calidad];
var R = null;
try { R = new THREE.WebGLRenderer({ canvas: lienzo, antialias: AJ.aa, powerPreference: 'high-performance', alpha: false, stencil: false }); } catch (e) { R = null; }
if (!R || !R.getContext()) {
  /* sin WebGL: la página sigue con el álbum en 2D */
  quitarPropios();
  luego(function () { vivo = false; if (al.fallo) al.fallo('sin3d'); }, 0);
  return { cerrar: function () { vivo = false; relojes.forEach(clearTimeout); }, fallo: true };
}
/* la tarjeta de video manda: si es de las sencillas, se baja la calidad (sin abrir otro contexto) */
var ORDEN = { bajo: 0, medio: 1, alto: 2 }, cal2 = C.calidad(R.getContext());
if (ORDEN[cal2] < ORDEN[calidad]) { calidad = cal2; AJ = C.AJUSTES[calidad]; }
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9;
R.outputEncoding = THREE.sRGBEncoding;
var prMax = Math.min(window.devicePixelRatio || 1, AJ.pr), pr = prMax, prMin = Math.min(prMax, .7);
R.setPixelRatio(pr);
var escena = new THREE.Scene();
var cam = new THREE.PerspectiveCamera(58, 1, .1, 4000);
C.serie.c = -9999; C.serie.A = 0;                     /* la ola grande, como nueva */
var cielo = C.armarCielo(escena, R, AJ);
var mar = C.armarMar(escena, AJ, cielo.cubo);
var costa = C.armarCosta(escena, AJ);
var aves = C.armarAves(escena, AJ);
escena.fog = new THREE.Fog('#806070', 90, 1200);
var hemi = new THREE.HemisphereLight('#FFC9B0', '#20343A', .85); escena.add(hemi);
var luzSol = new THREE.DirectionalLight('#FFB37A', 2.1); escena.add(luzSol); escena.add(luzSol.target);
var luzLuna = new THREE.DirectionalLight('#9FB4E8', 0); escena.add(luzLuna); escena.add(luzLuna.target);
var luzCara = new THREE.DirectionalLight('#FFE6D2', .35); escena.add(luzCara); escena.add(luzCara.target);

/* ---------- el caballito, su cofre y los obstáculos ---------- */
var bote = C.armarCaballito(AJ);
bote.g.rotation.order = 'YXZ';
escena.add(bote.g);
var cofre = C.armarCofre();
cofre.g.position.set(0, .26, -.22); cofre.g.rotation.y = Math.PI; bote.g.add(cofre.g);
var obst = C.armarObstaculos(escena, AJ, bote);
var jinete = null, ruwayA = null, killaA = null;

/* ---------- el recorrido y el estado ---------- */
var RUTA = C.recorrido(N), ini = RUTA.inicio;
var B = { x: ini.x, z: ini.z, rumbo: ini.rumbo, v: 0, w: 0, alto: 0, T: 0, surf: 0, uy: 0, choque: 0 };
C.focoZ = B.z;
var remada = { fase: 1, lado: 1, activo: 0, cola: false, ultima: -9, combo: 0, dur: .78, salpico: false, salio: false, fuerza: 1 };
var ctrl = { c: 0 };
var jugando = false, t = 0, tJuego = 0, fin = false, pausa = false, enFinal = false, enTarjeta = false, escalaT = 1;
var cartas = [], recogidas = 0;
var serie = { prox: 20, activa: false, vel: 7.6, Amax: red ? .6 : 1.15, avisada: false, ventana: false };
var meta = { x: C.META.x, z: C.META.z };
var guard = o.guardadas || {};
for (ii = 0; ii < N; ii++) if (guard[ii]) recogidas++;

/* ---------- el ciclo de luz: avanza con el camino (y algo con el tiempo) ---------- */
var hCiclo = 0, hForzado = -1, vCara = new THREE.Vector3();
function cicloCuadro(dt) {
  var prog = Math.max(0, Math.min(1, (ini.z - B.z) / (ini.z - meta.z)));
  var obj = enFinal ? .93 : hForzado >= 0 ? hForzado : Math.max(prog * 1.02, jugando ? Math.min(.85, tJuego / 300) : 0);
  hCiclo += (obj - hCiclo) * Math.min(1, dt * (hForzado >= 0 ? 20 : enFinal ? 1.5 : .6));
  C.ponerCiclo(hCiclo);
  var L = C.LUZ, U = C.U;
  hemi.color.copy(L.hemiC); hemi.groundColor.copy(L.hemiS); hemi.intensity = L.hemiI;
  luzSol.color.copy(L.sol); luzSol.intensity = L.solI;
  luzSol.position.copy(bote.g.position).addScaledVector(U.uSol.value, 50); luzSol.target.position.copy(bote.g.position);
  luzLuna.intensity = L.luna * .75; luzLuna.position.copy(bote.g.position).addScaledVector(U.uLuna.value, 50); luzLuna.target.position.copy(bote.g.position);
  luzCara.position.copy(cam.position).add(vCara.set(0, 2, 0)); luzCara.target.position.copy(enFinal ? C.embarcadero.position : bote.g.position);
  luzCara.intensity = .28 + .2 * L.noche;
  R.toneMappingExposure = L.exp;
  escena.fog.color.setRGB(U.uHzLej.value.x * .7 + U.uHzSol.value.x * .3, U.uHzLej.value.y * .7 + U.uHzSol.value.y * .3, U.uHzLej.value.z * .7 + U.uHzSol.value.z * .3);
}

/* ---------- las fotos que flotan (en sobres que brillan) ---------- */
var texHalo = C.texResplandor();
function texSobre(n) {
  var c = C.lienzo(256, 176), x = c.getContext('2d');
  var g = x.createLinearGradient(0, 0, 0, 176); g.addColorStop(0, '#FBF3E2'); g.addColorStop(1, '#EADBC0');
  x.fillStyle = g; x.fillRect(0, 0, 256, 176);
  x.strokeStyle = 'rgba(150,110,70,.55)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(4, 4); x.lineTo(128, 100); x.lineTo(252, 4); x.stroke();
  x.beginPath(); x.moveTo(4, 172); x.lineTo(104, 84); x.moveTo(252, 172); x.lineTo(152, 84); x.stroke();
  x.strokeStyle = 'rgba(200,150,60,.9)'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 170);
  x.fillStyle = '#A8242E'; x.beginPath(); x.arc(128, 100, 24, 0, 6.3); x.fill();
  x.fillStyle = '#C8414A'; for (var i = 0; i < 5; i++) { var a = i / 5 * 6.283; x.beginPath(); x.ellipse(128 + Math.cos(a) * 9, 100 + Math.sin(a) * 9, 7, 4.5, a, 0, 6.3); x.fill(); }
  x.fillStyle = '#F2C46D'; x.beginPath(); x.arc(128, 100, 4.5, 0, 6.3); x.fill();
  x.fillStyle = 'rgba(120,80,40,.6)'; x.font = 'italic 18px Georgia,serif'; x.fillText('n.º ' + n, 18, 160);
  return C.texDe(c, true, false);
}
var gHaz = new THREE.CylinderGeometry(.3, .6, 16, 16, 1, true); gHaz.translate(0, 8, 0);
var mHaz = new THREE.ShaderMaterial({
  uniforms: { uT: C.U.uT, uNoche: C.U.uNoche }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; varying float vD; varying float vB; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vD = distance(w.xyz, cameraPosition); vec3 n = normalize(mat3(modelMatrix) * normal); vB = abs(dot(n, normalize(cameraPosition - w.xyz))); gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'uniform float uT, uNoche; varying vec2 vUv; varying float vD; varying float vB; void main(){ float a = pow(1.0 - vUv.y, 2.0) * (.6 + .2 * sin(uT * 2.0 + vUv.x * 12.566)) * smoothstep(0.0,.05,vUv.y) * smoothstep(8.0, 40.0, vD) * vB * vB * (.55 + .45 * uNoche); gl_FragColor = vec4(vec3(1.0,.72,.34) * a * .7, 1.0); }'
});
function crearCarta(i, x, z) {
  var g = new THREE.Group(), tx = texSobre(i + 1);
  var borde = new THREE.MeshStandardMaterial({ color: '#E8D6B4', roughness: .7 });
  var cara = new THREE.MeshStandardMaterial({ map: tx, roughness: .6, emissive: '#FFE2A8', emissiveIntensity: .55, emissiveMap: tx });
  var sobre = new THREE.Mesh(new THREE.BoxGeometry(1.5, .05, 1.05), [borde, borde, cara, borde, borde, borde]);
  sobre.rotation.order = 'YXZ'; sobre.position.y = .5; g.add(sobre);
  var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#FFC98A', fog: false }));
  halo.scale.set(3, 3, 1); halo.position.y = .45; halo.material.opacity = .6; g.add(halo);
  var haz = new THREE.Mesh(gHaz, mHaz); g.add(haz);
  g.position.set(x, 0, z); escena.add(g);
  var k = { i: i, g: g, sobre: sobre, halo: halo, haz: haz, x: x, z: z, viva: true, vuelo: -1, tx: tx, mats: [borde, cara, halo.material] };
  cartas.push(k); return k;
}
for (ii = 0; ii < N; ii++) if (!guard[ii]) crearCarta(ii, RUTA.fotos[ii][0], RUTA.fotos[ii][1]);
cofre.llenar(recogidas);
function flotando() { var n = 0; for (var i = 0; i < cartas.length; i++) if (cartas[i].viva && cartas[i].vuelo < 0) n++; return n; }

/* ---------- estela (encaje de espuma con brazos en V) y salpicaduras ---------- */
var NE = 50, estela = [], gE = new THREE.BufferGeometry();
var ePos = new Float32Array(NE * 2 * 3), eA = new Float32Array(NE * 2), eUV = new Float32Array(NE * 2 * 2), eIdx = [];
for (ii = 0; ii < NE - 1; ii++) { var a0 = ii * 2; eIdx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
gE.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
gE.setAttribute('alfa', new THREE.BufferAttribute(eA, 1));
gE.setAttribute('uv', new THREE.BufferAttribute(eUV, 2));
gE.setIndex(eIdx);
var mEstela = new THREE.ShaderMaterial({
  uniforms: C.unif({ uOndas: { value: C.texOndas }, uEspuma: { value: C.texEspuma } }), transparent: true, depthWrite: false,
  vertexShader: 'attribute float alfa; varying float vA; varying vec2 vUv; varying vec3 vPos; void main(){ vA = alfa; vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: C.GLSL_CIELO + '\nuniform sampler2D uOndas, uEspuma; varying float vA; varying vec2 vUv; varying vec3 vPos;\nvoid main(){\n float lace = texture2D(uEspuma, vPos.xz * .3).r * .7 + texture2D(uEspuma, vPos.xz * .7 + .3).r * .4 + texture2D(uOndas, vPos.xz * .1).a * .3;\n float x = abs(vUv.x * 2.0 - 1.0);\n float brazos = smoothstep(.55, .9, x) * (1.0 - smoothstep(.92, 1.0, x));\n float centro = (1.0 - smoothstep(0.0, .35, x)) * smoothstep(8.0, 1.0, vUv.y) * .8;\n float a = vA * smoothstep(.45 - vA * .3, .75 - vA * .3, lace * (brazos + centro + .15));\n vec3 c = cielo(vec3(0.0,1.0,0.0),0.0) * 1.3 + uHalo * .25 * uSolI + vec3(.15,.17,.22) * uLunaI;\n gl_FragColor = vec4(c, a * .85);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
});
var mallaEstela = new THREE.Mesh(gE, mEstela); mallaEstela.frustumCulled = false; mallaEstela.renderOrder = 2; escena.add(mallaEstela);

var NP = red ? 110 : 260, P = [], gP = new THREE.BufferGeometry();
var pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3), pTam = new Float32Array(NP), pA = new Float32Array(NP);
for (ii = 0; ii < NP; ii++) { P.push({ v: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, t: 0, d: 1, tam: 1, r: 1, g: 1, b: 1, gr: 1 }); pPos[ii * 3 + 1] = -99; }
gP.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
gP.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
gP.setAttribute('tam', new THREE.BufferAttribute(pTam, 1));
gP.setAttribute('alfa', new THREE.BufferAttribute(pA, 1));
var mP = new THREE.ShaderMaterial({
  uniforms: { uPr: { value: pr }, uAlto: { value: 800 }, uLuz: { value: new THREE.Color(1, 1, 1) } }, transparent: true, depthWrite: false, vertexColors: true,
  vertexShader: 'attribute float tam; attribute float alfa; uniform float uPr, uAlto; uniform vec3 uLuz; varying vec3 vC; varying float vA; void main(){ vC = color * uLuz; vA = alfa; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = tam * uAlto * .05 / -mv.z * uPr; gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c,c); float a = smoothstep(.25, .0, r) * vA; gl_FragColor = vec4(vC, a); }'
});
var puntos = new THREE.Points(gP, mP); puntos.frustumCulled = false; puntos.renderOrder = 3; escena.add(puntos);
var pSig = 0;
function chispa(x, y, z, vx, vy, vz, dur, tam, r, g, b, gr) {
  var p = P[pSig]; pSig = (pSig + 1) % NP;
  p.v = 1; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.t = 0; p.d = dur; p.tam = tam; p.r = r; p.g = g; p.b = b; p.gr = gr === undefined ? 9.8 : gr;
}
function salpicar(x, z, n, fuerza, alto) {
  var y = C.altura(x, z) + .05;
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.283, r = Math.random() * fuerza;
    chispa(x + Math.cos(a) * .15, y, z + Math.sin(a) * .15, Math.cos(a) * r, (1.2 + Math.random() * 2.2) * fuerza * (alto || 1), Math.sin(a) * r, .5 + Math.random() * .6, .9 + Math.random() * 1.4, 1, .93, .86);
  }
}

/* ---------- sonido (sintetizado con WebAudio) ---------- */
var A = null, mudo = false;
function audioIniciar() {
  if (A || !vivo) return;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    var ac = new Ctx(), maestro = ac.createGain(); maestro.gain.value = o.conMusica ? .5 : .8; maestro.connect(ac.destination);
    var n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * .1848) * .18; }
    var fuente = ac.createBufferSource(); fuente.buffer = buf; fuente.loop = true;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    var gMar = ac.createGain(); gMar.gain.value = .35;
    fuente.connect(lp); lp.connect(gMar); gMar.connect(maestro); fuente.start();
    var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    var gSilbo = ac.createGain(); gSilbo.gain.value = .05; fuente.connect(hp); hp.connect(gSilbo); gSilbo.connect(maestro);
    A = { ac: ac, maestro: maestro, buf: buf, gMar: gMar, lp: lp, gSilbo: gSilbo, gav: 6, fr0: 1 };
    if (document.hidden || enTarjeta) ac.suspend();
  } catch (e) { A = null; }
}
function ruidoCorto(f, q, vol, dur, rate) {
  if (!A || mudo) return; var ac = A.ac, t0 = ac.currentTime;
  var s = ac.createBufferSource(); s.buffer = A.buf; s.playbackRate.value = rate || 1.3;
  var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
  var g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .03); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  s.connect(bp); bp.connect(g); g.connect(A.maestro); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05);
}
function sonarRemo() { ruidoCorto(700 + Math.random() * 300, .8, .55, .42); }
function sonarChoque() { ruidoCorto(260, .6, .7, .5, .8); }
function sonarRompe(vol) { ruidoCorto(500, .5, vol, 1.3, .7); }
function sonarGaviota() {
  if (!A || mudo || C.LUZ.h > .75) return; var ac = A.ac, t0 = ac.currentTime + .05, veces = 2 + (Math.random() * 2 | 0);
  var pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.value = Math.random() * 1.6 - .8; pan.connect(A.maestro); }
  for (var k = 0; k < veces; k++) {
    var os = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain(), a = t0 + k * .32, f = 1300 + Math.random() * 400;
    os.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 4;
    os.frequency.setValueAtTime(f, a); os.frequency.linearRampToValueAtTime(f * 1.55, a + .07); os.frequency.exponentialRampToValueAtTime(f * .8, a + .26);
    g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.05, a + .03); g.gain.exponentialRampToValueAtTime(.001, a + .28);
    os.connect(bp); bp.connect(g); g.connect(pan || A.maestro); os.start(a); os.stop(a + .3);
  }
}
function sonarCarta() {
  if (!A || mudo) return; var ac = A.ac, t0 = ac.currentTime, F = [1046.5, 1318.5, 1568, 2093];
  for (var k = 0; k < F.length; k++) {
    var os = ac.createOscillator(), g = ac.createGain(), a = t0 + k * .09; os.type = 'sine'; os.frequency.value = F[k];
    g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(.12, a + .01); g.gain.exponentialRampToValueAtTime(.001, a + 1.2);
    os.connect(g); g.connect(A.maestro); os.start(a); os.stop(a + 1.25);
  }
}
function audioCuadro(dt) {
  if (!A) return;
  var ac = A.ac, ola = .3 + .1 * Math.sin(t * .5) + .06 * Math.sin(t * .23);
  if (serie.activa) { var dd = Math.abs(sBote() - C.serie.c); ola += Math.max(0, 1 - dd / 40) * .35; }
  A.gMar.gain.setTargetAtTime(mudo ? 0 : ola, ac.currentTime, .3);
  A.lp.frequency.setTargetAtTime(420 + ola * 500 + B.v * 40, ac.currentTime, .3);
  A.gSilbo.gain.setTargetAtTime(mudo ? 0 : .03 + B.v * .012, ac.currentTime, .3);
  A.gav -= dt; if (A.gav < 0) { A.gav = 7 + Math.random() * 9; sonarGaviota(); }
  /* las olas que revientan en la orilla, al mismo ritmo que la espuma (cada 7 s) */
  var fr = (C.U.uT.value / 7) % 1;
  if (fr < A.fr0) { var bB = C.bOrilla(B.x, B.z), vol = Math.max(0, 1 - (-bB) / 120); if (vol > 0) sonarRompe(.75 * vol * vol); }
  A.fr0 = fr;
}
/* fuegos artificiales del final, con su sonido lejano */
function sonarFuego(tipo, retraso) {
  if (!A || mudo) return; var ac = A.ac, t0 = ac.currentTime + (retraso || 0);
  if (tipo === 'silbido') {
    var os = ac.createOscillator(), g = ac.createGain(); os.type = 'sine'; os.frequency.setValueAtTime(900, t0); os.frequency.exponentialRampToValueAtTime(2200, t0 + 1.2);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.025, t0 + .1); g.gain.exponentialRampToValueAtTime(.001, t0 + 1.3); os.connect(g); g.connect(A.maestro); os.start(t0); os.stop(t0 + 1.35); return;
  }
  /* estallido: golpe grave filtrado + crepitar */
  var s = ac.createBufferSource(); s.buffer = A.buf; s.playbackRate.value = .5;
  var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  var g2 = ac.createGain(); g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(.9, t0 + .02); g2.gain.exponentialRampToValueAtTime(.001, t0 + 1.6);
  s.connect(lp); lp.connect(g2); g2.connect(A.maestro); s.start(t0, Math.random()); s.stop(t0 + 1.7);
  var s2 = ac.createBufferSource(); s2.buffer = A.buf; s2.playbackRate.value = 2;
  var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  var g3 = ac.createGain(); g3.gain.setValueAtTime(0, t0 + .3); g3.gain.linearRampToValueAtTime(.08, t0 + .5); g3.gain.exponentialRampToValueAtTime(.001, t0 + 1.8);
  s2.connect(hp); hp.connect(g3); g3.connect(A.maestro); s2.start(t0 + .3, Math.random()); s2.stop(t0 + 1.9);
}

/* ---------- entrada ----------
   - un dedo: aparece una palanca donde se apoya; adelante rema, a los lados gira, atrás frena;
   - un toque corto: impulso extra (o recoge una carta si la tocas);
   - dos dedos, o el modo "Mirar": girar la cámara alrededor del caballito y pellizcar para acercar. */
function sBote() { return C.serie.dx * B.x + C.serie.dz * B.z; }
function remar() {
  if (!jugando || pausa || mirando) return;
  audioIniciar();
  if (remada.fase < .62) { remada.cola = true; return; }
  empezarRemada();
}
/* auto: la remada la pide la palanca (fuerza 0–1); si no, es un toque y cuenta el ritmo */
function empezarRemada(auto) {
  var dt = t - remada.ultima;
  if (auto) remada.fuerza = .5 + .6 * auto;
  else { if (dt > .42 && dt < 1.15) remada.combo = Math.min(4, remada.combo + 1); else if (dt >= 1.15) remada.combo = 0; remada.fuerza = 1 + remada.combo * .14; }
  remada.ultima = t; remada.fase = 0; remada.lado = -remada.lado; remada.salpico = false; remada.salio = false;
  remada.dur = auto ? 1.05 - .35 * auto : .8 - remada.combo * .03;
  pintarRitmo();
  if (serie.ventana && B.surf <= 0) { B.surf = 3.2; B.v = Math.max(B.v, 5.2); aviso('¡Corriendo la ola!', 'oro', 1800); serie.ventana = false; vibrar(40); }
}
function vibrar(ms) { try { if (navigator.vibrate && !red) navigator.vibrate(ms); } catch (e) {} }
var rayo = new THREE.Raycaster(), vec2 = new THREE.Vector2();
var PAL_R = 48;
var joy = { x: 0, y: 0, id: null, x0: 0, y0: 0, t0: 0, mov: false };
var dedos = {}, mirando = false, orb = { yaw: 0, pitch: 0, dist: 1, quieto: 9 };
function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }
function nDedos() { var n = 0; for (var k in dedos) n++; return n; }
function separacion() { var k = Object.keys(dedos); if (k.length < 2) return 0; var a = dedos[k[0]], b = dedos[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
function soltarPalanca() { joy.id = null; joy.x = joy.y = 0; palanca.className = ''; perilla.style.transform = ''; }
function girarVista(dx, dy) { orb.yaw -= dx * .009; orb.pitch = lim(orb.pitch + dy * .006, -.3, 1.05); orb.quieto = 0; }
function ponerMirar(m, callado) {
  mirando = m; bMirar.textContent = m ? '🚣 Remar' : '👀 Mirar'; bMirar.setAttribute('aria-pressed', m ? 'true' : 'false'); soltarPalanca();
  if (m && !callado) aviso('Arrastra para mirar alrededor · pellizca para acercar', '', 2600); else orb.quieto = 9;
}
escuchar(bMirar, 'click', function () { ponerMirar(!mirando); });
escuchar(lienzo, 'pointerdown', function (e) {
  if (!jugando || fin) return;
  e.preventDefault();
  audioIniciar(); if (A && A.ac.state === 'suspended' && !document.hidden) A.ac.resume();
  dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
  try { lienzo.setPointerCapture(e.pointerId); } catch (er) {}
  if (mirando || nDedos() >= 2) { soltarPalanca(); return; }
  joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY; joy.t0 = performance.now(); joy.mov = false;
  palanca.style.left = joy.x0 + 'px'; palanca.style.top = joy.y0 + 'px'; palanca.className = 'ver';
});
escuchar(lienzo, 'pointermove', function (e) {
  var d = dedos[e.pointerId]; if (!d) return;
  var n = nDedos();
  if (mirando || n >= 2) {
    var ant = separacion(); girarVista((e.clientX - d.x) / n, (e.clientY - d.y) / n); d.x = e.clientX; d.y = e.clientY;
    var nue = separacion(); if (n >= 2 && ant > 0 && nue > 0) orb.dist = lim(orb.dist * ant / nue, .45, 2.4);
    return;
  }
  d.x = e.clientX; d.y = e.clientY;
  if (joy.id !== e.pointerId) return;
  var dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, l = Math.hypot(dx, dy), m = Math.min(l, PAL_R);
  if (l > 10) joy.mov = true;
  if (l > 0) { dx = dx / l * m; dy = dy / l * m; }
  perilla.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
  joy.x = dx / PAL_R; joy.y = -dy / PAL_R;
});
function soltarDedo(e) {
  var toque = joy.id === e.pointerId && !joy.mov && performance.now() - joy.t0 < 320 && !mirando;
  delete dedos[e.pointerId];
  if (joy.id === e.pointerId) soltarPalanca();
  if (!toque || pausa) return;
  var r = lienzo.getBoundingClientRect();
  vec2.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); rayo.setFromCamera(vec2, cam);
  var hit = null;
  for (var i = 0; i < cartas.length; i++) { var c = cartas[i]; if (c.viva && c.vuelo < 0 && Math.hypot(c.x - B.x, c.z - B.z) < 30 && rayo.ray.distanceSqToPoint(c.g.position) < 2.6 * 2.6) hit = c; }
  if (hit) recoger(hit); else remar();
}
escuchar(lienzo, 'pointerup', soltarDedo);
escuchar(lienzo, 'pointercancel', soltarDedo);
escuchar(lienzo, 'wheel', function (e) { e.preventDefault(); orb.dist = lim(orb.dist * (1 + e.deltaY * .0012), .45, 2.4); orb.quieto = 0; }, { passive: false });
var teclas = {};
function enBoton(e) { var tg = e.target; return tg && /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(tg.tagName); }
escuchar(window, 'keydown', function (e) {
  if (!jugando || fin || enTarjeta || enBoton(e)) return;
  if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Space') remar();
  if (e.code === 'KeyM') ponerMirar(!mirando);
  teclas[e.code] = 1;
});
escuchar(window, 'keyup', function (e) { teclas[e.code] = 0; });

/* ---------- HUD ---------- */
var avisoT = 0;
function aviso(txt, tipo, ms) { avisoEl.textContent = txt; avisoEl.className = 'ver ' + (tipo || ''); avisoT = (ms || 1800) / 1000; }
function pintarRitmo() { var e = ritmoEl.children; for (var i = 0; i < e.length; i++) e[i].className = i < remada.combo ? 'on' : ''; }
escuchar(bSonido, 'click', function () {
  audioIniciar(); mudo = !mudo; bSonido.setAttribute('aria-pressed', mudo ? 'true' : 'false');
  bSonido.setAttribute('aria-label', mudo ? 'Activar el sonido del mar' : 'Silenciar el mar');
});
escuchar(bVerFin, 'click', function () { if (jugando && !fin) empezarFinal(.01); });
escuchar(bSaltar, 'click', function () { saltar(); });

/* ---------- recoger: la carta vuela al cofre del caballito y la página muestra su foto ---------- */
function recoger(k) {
  if (!k.viva || k.vuelo >= 0 || fin) return;
  k.vuelo = 0; sonarCarta(); vibrar(25);
  for (var i = 0; i < 26; i++) { var a = Math.random() * 6.283; chispa(k.g.position.x, k.g.position.y + .4, k.g.position.z, Math.cos(a) * 1.4, 1 + Math.random() * 2, Math.sin(a) * 1.4, 1 + Math.random() * .6, 1.4, 1, .82, .45, 1.5); }
  if (recogidas + 1 >= Math.min(2, N)) cargarKilla();      /* Killa se trae con tiempo, antes de llegar */
}
function pedirRecuerdo(i) {
  /* la tarjeta va encima: el mar se queda quieto (ahorra batería) hasta que la cierre */
  pausa = true; enTarjeta = true; soltarPalanca(); parar(); if (A) A.ac.suspend();
  var hecho = false;
  function seguir() {
    if (hecho || !vivo) return; hecho = true; enTarjeta = false; pausa = false; arrancar();
    if (A && !mudo && !document.hidden) A.ac.resume();
    if (recogidas >= N) aviso('¡El cofre está lleno! Llévalo al muelle', 'oro', 3200);
  }
  if (al.recoger) al.recoger(i, seguir); else seguir();
}
function soltarCarta(k) {
  escena.remove(k.g);
  k.sobre.geometry.dispose(); k.mats.forEach(function (m) { m.dispose(); }); k.tx.dispose();
  k.viva = false;
}

/* ---------- física del caballito ---------- */
function puntoBote(lx, lz, out) { var c = Math.cos(B.rumbo), s = Math.sin(B.rumbo); out.x = B.x + lx * c + lz * s; out.z = B.z - lx * s + lz * c; return out; }
var pr1 = { x: 0, z: 0 }, pr2 = { x: 0, z: 0 }, pr3 = { x: 0, z: 0 }, pr4 = { x: 0, z: 0 };
var rollOla = 0, rollOla0 = 0, pitch = 0, roll = 0;
var NOMBRE = { roca: 'la roca', red: 'la red', tronco: 'el tronco', caballito: 'el otro caballito' };
function fisica(dt) {
  /* palanca (o teclado): x gira, y adelante rema / atrás frena */
  var jx = joy.x, jy = joy.y;
  var kx = (teclas.ArrowRight || teclas.KeyD ? 1 : 0) - (teclas.ArrowLeft || teclas.KeyA ? 1 : 0), ky = (teclas.ArrowUp || teclas.KeyW ? 1 : 0) - (teclas.ArrowDown || teclas.KeyS ? 1 : 0);
  if (mirando) { orb.yaw -= kx * dt * 1.6; orb.pitch = lim(orb.pitch + ky * dt * .8, -.3, 1.05); if (kx || ky) orb.quieto = 0; jx = jy = 0; }
  else { if (kx) jx = kx; if (ky) jy = ky; }
  var c = Math.abs(jx) < .12 ? 0 : (jx - (jx > 0 ? .12 : -.12)) / .88;
  if (AUTO && jugando) c = piloto(dt);
  if (jugando && !mirando && !pausa) {
    if (jy > .15 && remada.fase >= .62 && !remada.cola) empezarRemada(Math.min(1, (jy - .15) / .85));
    if (jy < -.15) { B.v -= 1.8 * -jy * dt; if (B.v < -1.2) B.v = -1.2; }
  }
  if (mirando) B.v *= Math.exp(-dt * .5);         /* mirando: el caballito sigue a la deriva y se va frenando */
  if (remada.fase < 1) {
    remada.fase = Math.min(1, remada.fase + dt / remada.dur);
    var f = remada.fase;
    if (f > .1 && f < .52) { B.v += 3.1 * (remada.fuerza || 1) * dt * (B.surf > 0 ? .5 : 1); B.w += remada.lado * .09 * dt; }
    if (!remada.salpico && f > .1 && jinete) { remada.salpico = true; salpicar(jinete.punta.x, jinete.punta.z, red ? 8 : 18, 1.1, 1.2); sonarRemo(); }
    if (!remada.salio && f > .55 && jinete) { remada.salio = true; salpicar(jinete.punta.x, jinete.punta.z, red ? 3 : 6, .5); }
    /* gotas que caen de la pala al sacarla del agua */
    if (jinete && f > .55 && f < .95 && Math.random() < dt * (red ? 12 : 30)) { var pt = jinete.punta; chispa(pt.x + (Math.random() - .5) * .08, pt.y, pt.z + (Math.random() - .5) * .08, (Math.random() - .5) * .3, -.2, (Math.random() - .5) * .3, .7, .55, .9, .95, 1); }
    if (remada.cola && f >= .62) { remada.cola = false; empezarRemada(); }
  }
  remada.activo += ((t - remada.ultima < 1.6 ? 1 : 0) - remada.activo) * Math.min(1, dt * 3);
  B.w += (-c * 1.05 - B.w) * Math.min(1, dt * 2.6);
  B.rumbo += B.w * dt;
  puntoBote(0, -2.2, pr1); puntoBote(0, 1.4, pr2); puntoBote(-.6, .2, pr3); puntoBote(.6, .2, pr4);
  var hp = C.altura(pr1.x, pr1.z), hs = C.altura(pr2.x, pr2.z), hb = C.altura(pr3.x, pr3.z), ht = C.altura(pr4.x, pr4.z);
  B.alto += ((hp + hs + hb + ht) / 4 - .17 - B.alto) * Math.min(1, dt * 7);
  pitch += (Math.atan2(hp - hs, 3.6) - pitch) * Math.min(1, dt * 5); rollOla += (Math.atan2(ht - hb, 1.25) - rollOla) * Math.min(1, dt * 5);
  B.v += -9.8 * Math.sin(pitch) * (B.surf > 0 ? .8 : .22) * dt;
  B.v -= (B.v * (B.surf > 0 ? .1 : .28) + B.v * Math.abs(B.v) * .055) * dt;
  B.v = Math.max(-1.2, Math.min(B.surf > 0 ? 8.5 : 5.5, B.v));
  if (B.surf > 0) { B.surf -= dt; if (Math.random() < dt * 30) { var lado = Math.random() < .5 ? -1 : 1; puntoBote(lado * .5, -1.6, pr3); chispa(pr3.x, B.alto + .25, pr3.z, lado * Math.cos(B.rumbo) * 1.8, 1.5 + Math.random(), 0, .6, 1.4, 1, .93, .86); } }
  B.x += -Math.sin(B.rumbo) * B.v * dt; B.z += -Math.cos(B.rumbo) * B.v * dt; C.focoZ = B.z;
  /* choques: se pierde impulso y salpica; nada más (que pueda jugar cualquiera) */
  B.choque -= dt;
  puntoBote(0, -1.5, pr1);
  var ch = obst.choque(pr1.x, pr1.z, .6) || obst.choque(B.x, B.z, .9);
  if (ch) {
    B.x += ch.nx * ch.pen; B.z += ch.nz * ch.pen;
    if (B.choque < 0 && Math.abs(B.v) > .5) {
      B.choque = 1.3; B.v *= .35; B.T += (Math.random() < .5 ? -1 : 1) * .35; vibrar(60); sonarChoque();
      salpicar(pr1.x, pr1.z, red ? 10 : 22, 1.3, 1.2);
      aviso('¡Cuidado con ' + (NOMBRE[ch.tipo] || 'eso') + '! Rodéalo', 'alerta', 1600);
      /* gira un poco para despegarse */
      B.w += (ch.nx * Math.cos(B.rumbo) - ch.nz * Math.sin(B.rumbo)) * -.8;
    } else B.v *= Math.max(0, 1 - dt * 3);
  }
  var dRoll = (rollOla - rollOla0) / Math.max(dt, 1e-3); rollOla0 = rollOla;
  var k = red ? .5 : 1;
  /* el equilibrio solo cuenta con la ola grande; el resto del tiempo es una ayuda visual */
  if (jugando && serie.activa) B.T += (B.T * .38 * k + dRoll * .3 * k + Math.sin(t * .9) * .06 * k - c * 1.15 + B.w * .2) * dt;
  else B.T += (rollOla * 1.5 - B.T) * Math.min(1, dt * 2);
  B.T = Math.max(-1.25, Math.min(1.25, B.T));
  B.uy -= dt;
  if (Math.abs(B.T) > 1 && B.uy < 0 && serie.activa) {
    B.uy = 2.5; B.v *= .55; aviso('¡Uy! Endereza: desliza al otro lado', 'alerta', 1800); vibrar(80);
    puntoBote(B.T > 0 ? .7 : -.7, 0, pr3); salpicar(pr3.x, pr3.z, 14, 1.4); B.T *= .5;
  }
  roll = rollOla + B.T * .26;
  limites(dt);
  var lejos = B.x < -95 || B.z > ini.z + 32 || B.z < meta.z - 60;
  if (lejos) { var hacia = Math.atan2(-(meta.x - B.x), -(meta.z - B.z)), dif = ((hacia - B.rumbo + Math.PI * 3) % (Math.PI * 2)) - Math.PI; B.w += dif * dt * 1.5; if (Math.random() < dt) aviso('El muelle está por allá', '', 1500); }
  bote.g.position.set(B.x, B.alto, B.z);
  bote.g.rotation.set(pitch, B.rumbo, roll);
  C.UA.uBote.value.set(B.x, B.z, B.rumbo, Math.abs(B.v));
}

/* ---------- límites: la orilla, el muelle, el embarcadero y el borde del mapa ----------
   Nada castiga: el caballito frena, la ola lo devuelve y aparece un aviso amable. */
var avisoOrilla = 0;
var PUNTOS_BOTE = [[0, 0, .9], [0, -2.1, .5]];
function empujar(px, pz, rad, cx, cz, r) {   /* saca el punto (px,pz) de un círculo; devuelve true si chocó */
  var dx = px - cx, dz = pz - cz, d = Math.sqrt(dx * dx + dz * dz), pen = r + rad - d;
  if (pen <= 0) return false;
  B.x += dx / (d || 1) * pen; B.z += dz / (d || 1) * pen;
  /* se pierde la velocidad que iba contra el obstáculo */
  var fx = -Math.sin(B.rumbo), fz = -Math.cos(B.rumbo), contra = -(fx * dx + fz * dz) / (d || 1);
  if (contra > 0) B.v *= 1 - contra * .6;
  return true;
}
function limites(dt) {
  avisoOrilla -= dt;
  /* la orilla: b = metros tierra adentro. Desde b = 1 frena; desde b = 4 la ola lo devuelve; nunca pasa de b = 7 */
  puntoBote(0, -2.3, pr1);
  var bB = Math.max(C.bOrilla(B.x, B.z), C.bOrilla(pr1.x, pr1.z) - 1.5);
  if (bB > 1) {
    var M = C.HACIA_MAR, fx = -Math.sin(B.rumbo), fz = -Math.cos(B.rumbo), hacia = -(fx * M.x + fz * M.z);   /* > 0: avanza hacia la arena */
    if (hacia > 0) B.v *= Math.exp(-dt * (bB - 1) * 1.1 * hacia);
    if (bB > 4) { var emp = (bB - 4) * 1.6 * dt; B.x += M.x * emp; B.z += M.z * emp; }
    if (bB > 7) { B.x += M.x * (bB - 7); B.z += M.z * (bB - 7); if (B.v > 0 && hacia > 0) B.v = -.4; }
    if (avisoOrilla < 0 && bB > 3) { avisoOrilla = 5; aviso('La orilla está aquí. Sigue la flecha hacia el muelle', 'ola', 2600); }
  }
  /* el muelle (cápsula de la raíz a la punta), su cabeza y el embarcadero */
  var Qm = C.CHOQUES_MUELLE;
  if (Qm) {
    var ax = Qm.a.x, az = Qm.a.z, bx = Qm.b.x - ax, bz = Qm.b.z - az, L2 = bx * bx + bz * bz;
    for (var j = 0; j < PUNTOS_BOTE.length; j++) {
      var pt = PUNTOS_BOTE[j];
      puntoBote(pt[0], pt[1], pr2);
      var u = Math.max(0, Math.min(1, ((pr2.x - ax) * bx + (pr2.z - az) * bz) / L2));
      var hit = empujar(pr2.x, pr2.z, pt[2], ax + bx * u, az + bz * u, Qm.r);
      hit = empujar(pr2.x, pr2.z, pt[2], Qm.cabeza.x, Qm.cabeza.z, Qm.cabeza.r) || hit;
      hit = empujar(pr2.x, pr2.z, pt[2], Qm.emb.x, Qm.emb.z, Qm.emb.r) || hit;
      if (hit && B.choque < 0 && Math.abs(B.v) > .6) { B.choque = 1.2; B.v *= .4; salpicar(pr2.x, pr2.z, red ? 8 : 18, 1.1); sonarChoque(); vibrar(40); aviso('¡Uy, el muelle! Rodéalo por un costado', 'alerta', 1600); }
    }
  }
  /* el borde del mapa: no hay cómo escaparse */
  var minZ = meta.z - 70;
  if (B.z > ini.z + 39) { B.z = ini.z + 39; B.v *= .9; }
  if (B.z < minZ) { B.z = minZ; B.v *= .9; }
  if (B.x < -110) { B.x = -110; B.v *= .9; }
}

/* piloto automático (solo capturas): va a la foto más cercana rodeando lo que choca */
var pilotoRemo = 0;
function objetivo() {
  var obj = null, dm = 1e9;
  for (var i = 0; i < cartas.length; i++) { var c = cartas[i]; var d = Math.hypot(c.x - B.x, c.z - B.z) + (c.z > B.z + 5 ? 400 : 0); if (c.viva && c.vuelo < 0 && d < dm) { dm = d; obj = c; } }
  return obj || meta;
}
function piloto(dt) {
  var obj = objetivo();
  var hacia = Math.atan2(-(obj.x - B.x), -(obj.z - B.z)), dif = ((hacia - B.rumbo + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  pilotoRemo -= dt; if (pilotoRemo < 0 && !pausa) { pilotoRemo = .72; remar(); }
  return Math.max(-1, Math.min(1, Math.max(-1, Math.min(1, -dif * 2.2)) * .45 + Math.max(-1, Math.min(1, B.T * 2.2)) * .7));
}

/* ---------- la ola grande ---------- */
function serieCuadro(dt) {
  var S = C.serie;
  if (!serie.activa) {
    serie.prox -= dt;
    if (serie.prox <= 0 && jugando && !fin) { serie.activa = true; S.c = sBote() - 75; S.A = 0; serie.avisada = false; }
    return;
  }
  S.c += serie.vel * dt;
  var d = sBote() - S.c;
  var crece = Math.min(1, (75 - Math.max(0, d)) / 25 + .1);
  S.A += (serie.Amax * Math.max(.1, Math.min(1, crece)) - S.A) * Math.min(1, dt * 1.5);
  if (!serie.avisada && d < 42 && d > 0) { serie.avisada = true; aviso('Viene una ola grande… ¡rema cuando te levante!', 'ola', 2600); }
  serie.ventana = d > S.W * .15 && d < S.W * 1.5;
  ahoraEl.className = serie.ventana && B.surf <= 0 && !fin ? 'ver' : '';
  if (d < -110) { S.A *= Math.max(0, 1 - dt * 1.5); if (S.A < .02) { serie.activa = false; S.A = 0; S.c = -9999; serie.prox = 26 + Math.random() * 10; ahoraEl.className = ''; } }
}

/* ---------- cartas: flotan, se recogen y vuelan al cofre ---------- */
var vC = new THREE.Vector3();
function cartasCuadro(dt) {
  for (var j = 0; j < cartas.length; j++) {
    var k = cartas[j];
    if (!k.viva) continue;
    k.g.visible = Math.abs(k.z - B.z) < 260;
    if (k.vuelo < 0) {
      var h = C.altura(k.x, k.z), hx = C.altura(k.x + .6, k.z), hz = C.altura(k.x, k.z + .6);
      k.g.position.set(k.x, h, k.z);
      k.sobre.rotation.set(1.05 + Math.atan2(hz - h, .6) * .5 + Math.sin(t * 1.3 + k.i) * .08, Math.atan2(cam.position.x - k.x, cam.position.z - k.z), -Math.atan2(hx - h, .6) * .5);
      var lat = .85 + .15 * Math.sin(t * 2.4 + k.i * 2);
      k.halo.scale.set(3 * lat, 3 * lat, 1); k.halo.material.opacity = (.45 + .2 * lat) * (.6 + .5 * C.LUZ.noche);
      if (Math.random() < dt * 5) chispa(k.x + (Math.random() - .5) * 1.4, h + .3, k.z + (Math.random() - .5) * 1.4, 0, .5 + Math.random() * .6, 0, 1.4, 1.1, 1, .85, .5, -.2);
      puntoBote(0, -.8, pr1);
      if (Math.hypot(pr1.x - k.x, pr1.z - k.z) < 2.6 && jugando && !pausa) recoger(k);
    } else {
      k.vuelo += dt;
      var v = k.vuelo;
      if (v < .6) { k.g.position.y += dt * 2.2 * (1 - v); k.sobre.rotation.y += dt * 10; k.sobre.rotation.x *= .9; k.haz.scale.y = Math.max(.01, 1 - v * 1.6); }
      else {
        cofre.g.getWorldPosition(vC); vC.y += .3;
        k.g.position.lerp(vC, Math.min(1, dt * 6)); k.sobre.rotation.y += dt * 10;
        k.haz.visible = false;
        var s = Math.max(.02, 1 - (v - .6) * 1.6); k.g.scale.setScalar(s); k.halo.material.opacity = s;
        if (v > .6 && v < .7) cofre.abrir(.9);
      }
      if (v > 1.2) { recogidas++; cofre.llenar(recogidas); cofre.abrir(.12); soltarCarta(k); pedirRecuerdo(k.i); return; }
    }
  }
  /* llegar al muelle */
  if (jugando && !fin && !pausa && Math.hypot(B.x - meta.x, B.z - meta.z) < 7) {
    if (recogidas < N) { if (B.uy < 0) { B.uy = 4; var falta = N - recogidas; aviso('Aún ' + (falta === 1 ? 'falta 1 foto' : 'faltan ' + falta + ' fotos') + ' en el mar. Sigue la flecha', 'ola', 3000); } }
    else empezarFinal();
  }
  hazMeta.scale.y = 1.6 + Math.sin(t * 1.5) * .1;
  hazMeta.visible = recogidas >= N && !enFinal;
}
var hazMeta = new THREE.Mesh(gHaz, mHaz); hazMeta.scale.set(2, 1.6, 2); hazMeta.position.set(meta.x, 0, meta.z); escena.add(hazMeta);

/* ---------- estela ---------- */
var eT = 0, cuadroN = 0;
function estelaCuadro(dt) {
  eT -= dt; cuadroN++;
  if (eT <= 0 && Math.abs(B.v) > .25 && !enFinal) {
    eT = .1; puntoBote(0, 1.5, pr2);
    var nuevo = estela.length >= NE ? estela.pop() : {};       /* se reusa el más viejo: nada nuevo por cuadro */
    nuevo.x = pr2.x; nuevo.z = pr2.z; nuevo.e = 0; nuevo.f = Math.min(1, Math.abs(B.v) / 3.5); nuevo.r = B.rumbo; nuevo.y = undefined;
    estela.unshift(nuevo);
  }
  for (var i = 0; i < NE; i++) {
    var p = estela[i] || estela[estela.length - 1];
    if (!p) { eA[i * 2] = eA[i * 2 + 1] = 0; continue; }
    if (estela[i]) p.e += dt;
    var ancho = .45 + p.e * (.55 + p.f * .5), c = Math.cos(p.r), s = Math.sin(p.r);   /* se abre en V */
    if (estela[i] && (p.y === undefined || ((i + cuadroN) & 1))) p.y = C.altura(p.x, p.z) + .04;   /* la altura cada 2 cuadros */
    var y = p.y === undefined ? 0 : p.y;
    ePos[i * 6] = p.x - c * ancho; ePos[i * 6 + 1] = y; ePos[i * 6 + 2] = p.z + s * ancho;
    ePos[i * 6 + 3] = p.x + c * ancho; ePos[i * 6 + 4] = y; ePos[i * 6 + 5] = p.z - s * ancho;
    var a = estela[i] ? Math.max(0, 1 - p.e / 5) * p.f * Math.min(1, i / 2) : 0;
    eA[i * 2] = eA[i * 2 + 1] = a;
    eUV[i * 4] = 0; eUV[i * 4 + 1] = i; eUV[i * 4 + 2] = 1; eUV[i * 4 + 3] = i;
  }
  gE.attributes.position.needsUpdate = true; gE.attributes.alfa.needsUpdate = true; gE.attributes.uv.needsUpdate = true;
  if (B.v > 2.4 && Math.random() < dt * (B.v - 1.8) * 7) { var l = Math.random() < .5 ? -1 : 1; puntoBote(l * .45, -1.9, pr3); chispa(pr3.x, B.alto + .15, pr3.z, l * Math.cos(B.rumbo) * 1.2, .8 + Math.random() * .8, -l * Math.sin(B.rumbo) * 1.2, .5, 1, 1, .93, .86); }
}
/* olas que rompen contra las rocas */
var rompeT = [1, 2.2, .4];
function rompientesCuadro(dt) {
  var L = C.ROMPIENTES;
  for (var i = 0; i < L.length; i++) {
    var r = L[i];
    rompeT[i] -= dt;
    if (rompeT[i] < 0) {
      rompeT[i] = 2.4 + Math.random() * 2;
      var d = Math.hypot(r[0] - B.x, r[1] - B.z);
      if (d < 120) { salpicar(r[0] + (Math.random() - .5) * 3, r[1] + 2, red ? 14 : 34, 1.6, 1.5); if (d < 50) sonarRompe(.5 * (1 - d / 50)); }
    }
  }
}
function chispasCuadro(dt) {
  var L = C.LUZ; mP.uniforms.uLuz.value.setRGB(.55 + L.hemiI * .5 + L.solI * .1, .55 + L.hemiI * .45 + L.solI * .06, .6 + L.hemiI * .45);
  for (var i = 0; i < NP; i++) {
    var p = P[i];
    if (!p.v) { pA[i] = 0; continue; }
    p.t += dt; if (p.t >= p.d) { p.v = 0; pA[i] = 0; pPos[i * 3 + 1] = -99; continue; }
    p.vy -= p.gr * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    var k = p.t / p.d;
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    pCol[i * 3] = p.r; pCol[i * 3 + 1] = p.g; pCol[i * 3 + 2] = p.b;
    pTam[i] = p.tam * (1 - k * .4); pA[i] = Math.min(1, (1 - k) * 2) * .85;
  }
  gP.attributes.position.needsUpdate = true; gP.attributes.color.needsUpdate = true; gP.attributes.tam.needsUpdate = true; gP.attributes.alfa.needsUpdate = true;
}

/* ---------- cámara ---------- */
var camRumbo = B.rumbo, camPos = new THREE.Vector3(B.x, 4, B.z + 10), mira = new THREE.Vector3(), miraS = new THREE.Vector3(B.x, 1, B.z - 6), fov = 58;
var portadaAng = 0, camFija = null, camLibre = null, vMira = new THREE.Vector3();
function camaraCuadro(dt) {
  if (camLibre) { cam.position.fromArray(camLibre[0]); cam.lookAt(camLibre[1][0], camLibre[1][1], camLibre[1][2]); return; }   /* solo capturas */
  if (!jugando) {
    portadaAng += dt * .05;
    var su = C.U.uSol.value, a = Math.atan2(-su.x, -su.z) + .16 + Math.sin(portadaAng) * .08;
    camPos.set(B.x + Math.sin(a) * 6.4, B.alto + 1.35, B.z + Math.cos(a) * 6.4);
    mira.set(B.x - Math.sin(a) * 5, B.alto + .55, B.z - Math.cos(a) * 5);
  } else {
    var d = ((B.rumbo - camRumbo + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    camRumbo += d * Math.min(1, dt * 2.2);
    /* sin dedos encima un rato, la órbita vuelve sola detrás de Ruway */
    orb.quieto += dt;
    if (!mirando && nDedos() < 2 && orb.quieto > .8) { var kv = Math.min(1, dt * 2.2); orb.yaw *= 1 - kv; orb.pitch *= 1 - kv; orb.dist += (1 - orb.dist) * kv; }
    var ko = Math.min(1, Math.abs(orb.yaw) * 1.5 + Math.abs(orb.pitch) * 2 + Math.abs(orb.dist - 1) * 1.5 + (mirando ? 1 : 0));
    var lejos = 5.7 + B.v * .22, alto = 2.35 + B.v * .06;
    var D = Math.hypot(lejos, alto) * orb.dist, el2 = lim(Math.atan2(alto, lejos) + orb.pitch, -.05, 1.35), ang = camRumbo + orb.yaw;
    var cx = B.x + Math.sin(ang) * Math.cos(el2) * D, cz = B.z + Math.cos(ang) * Math.cos(el2) * D;
    var cy = Math.max(C.altura(cx, cz) + (ko > .5 ? .8 : 2.1), B.alto * .55 + Math.sin(el2) * D);
    var kp = Math.min(1, dt * (ko > .05 ? 9 : 4));
    camPos.x += (cx - camPos.x) * kp; camPos.z += (cz - camPos.z) * kp; camPos.y += (cy - camPos.y) * Math.min(1, dt * (cy > camPos.y || ko > .05 ? 7 : 2.5));
    mira.set(B.x - Math.sin(camRumbo) * 7, B.alto * .5 + 1.05, B.z - Math.cos(camRumbo) * 7);
    mira.lerp(vMira.set(B.x, B.alto + .85, B.z), ko);
  }
  if (camFija) { camPos.set(B.x + camFija[0], B.alto + camFija[1], B.z + camFija[2]); mira.set(B.x, B.alto + camFija[3], B.z); miraS.copy(mira); }
  miraS.lerp(mira, Math.min(1, dt * 5));
  cam.position.copy(camPos); cam.lookAt(miraS);
  if (!red && jugando && !mirando) cam.rotateZ(-roll * .12);
  var fObj = 58 + (B.surf > 0 && !red ? 7 : 0) + (innerWidth > innerHeight ? -8 : 0);
  fov += (fObj - fov) * Math.min(1, dt * 3);
  if (Math.abs(cam.fov - fov) > .01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
/* brújula: apunta a la foto más cercana (o al muelle con el cofre lleno) */
var flechaAng = null, rumboDist = -1, rumboMuelle = null;
function brujulaCuadro() {
  if (!jugando || fin) return;
  var obj = objetivo(), tb = Math.atan2(-(obj.x - B.x), -(obj.z - B.z)), rel = ((tb - camRumbo + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  var ang = Math.round(-rel * 180 / Math.PI - 90);                    /* se toca el DOM solo si cambió */
  if (ang !== flechaAng) { flechaAng = ang; flecha.style.transform = 'rotate(' + ang + 'deg)'; }
  var dist = Math.round(Math.hypot(obj.x - B.x, obj.z - B.z)), esMuelle = obj === meta;
  if (dist !== rumboDist || esMuelle !== rumboMuelle) { rumboDist = dist; rumboMuelle = esMuelle; rumboTxt.textContent = (esMuelle ? 'Muelle' : 'Foto') + ' · ' + dist + ' m'; }
}

/* ---------- el final ---------- */
var fuegos = C.armarFuegos(escena, AJ, sonarFuego);
var final = C.armarFinal({
  cam: cam, cofre: cofre, fotos: FOTOS.slice(0, N), fuegos: fuegos,
  ruway: function () { return ruwayA; }, killa: function () { return killaA; },
  chispa: function (p, f) { chispa(p.x, p.y, p.z, (Math.random() - .5) * .6, .8 + Math.random() * 1.2 * f, (Math.random() - .5) * .6, 1.2, 1.1, 1, .85, .5, -.1); },
  evento: function (nom) { historia.push(nom); },
  alTerminar: abrirGaleria
});
var killaPedida = false, killaLista = null, killaFallo = false;
function cargarKilla(cb) {
  if (killaA || killaFallo) { if (cb) cb(); return; }
  if (cb) killaLista = cb;
  if (killaPedida) return; killaPedida = true;
  C.cargarGLB(o.glbKilla || 'killa-avatar.glb', function (sc) {
    if (!vivo) { liberar(sc); return; }
    if (sc) { try { killaA = C.armarAvatar(sc, { alto: 1.36, cabeza: .7 }); } catch (e) { killaFallo = true; liberar(sc); } }
    else killaFallo = true;
    if (killaLista) { var f = killaLista; killaLista = null; f(); }
  });
}
function empezarFinal(desde) {
  if (fin) return;
  fin = true; pausa = true; ctrl.c = 0; soltarPalanca(); if (mirando) ponerMirar(false, true);
  document.body.classList.add('cq-cine');
  hudEl.hidden = true; bVerFin.hidden = true; ahoraEl.className = '';
  velo.hidden = false; requestAnimationFrame(function () { velo.classList.add('ver'); });
  if (al.final) al.final();
  luego(function () {
    cargarKilla(function () {
      if (!vivo || galeriaAbierta) return;
      enFinal = true;
      /* el caballito queda amarrado junto al embarcadero */
      B.x = meta.x; B.z = meta.z; B.v = 0; B.rumbo = C.EMBARCADERO.rumbo + Math.PI / 2;
      bote.g.position.set(B.x, B.alto, B.z); bote.g.rotation.set(0, B.rumbo, 0);
      bote.remo.position.set(.25, .45, .2); bote.remo.rotation.set(0, .2, 0);
      final.iniciar(desde || 0);
      bSaltar.hidden = false;
      luego(function () { velo.classList.remove('ver'); luego(function () { velo.hidden = true; }, 700); }, 250);
    });
  }, desde ? 0 : 700);
}
function saltar() {
  if (!fin || galeriaAbierta) return;
  final.parar(); fuegos.parar();
  abrirGaleria();
}
function cerrarGrande() { if (grande && grande.parentNode) grande.parentNode.removeChild(grande); grande = null; }
function verGrande(f) {
  cerrarGrande();
  grande = el('div', '', document.body); grande.id = 'cq-grande'; grande.setAttribute('role', 'dialog'); grande.setAttribute('aria-label', 'La foto en grande');
  var fig = el('figure', '', grande), im = el('img', '', fig); im.alt = ''; poner(f, im);
  el('figcaption', '', fig, f.frase || '');
  grande.addEventListener('click', cerrarGrande);
}
function abrirGaleria() {
  if (galeriaAbierta || !vivo) return; galeriaAbierta = true;
  historia.push('galeria');
  bSaltar.hidden = true; velo.classList.remove('ver'); velo.hidden = true;
  galeria = el('div', '', document.body); galeria.id = 'cq-galeria';
  galeria.setAttribute('role', 'dialog'); galeria.setAttribute('aria-modal', 'true'); galeria.setAttribute('aria-labelledby', 'cq-gal-tit');
  var g = el('div', 'cq-gal', galeria);
  el('p', 'cq-mini', g, 'El regalo mayor');
  var h2 = el('h2', '', g, 'Todo lo que traje para ti'); h2.id = 'cq-gal-tit';
  var lista = el('div', 'cq-lista' + (N % 2 ? ' impar' : ''), g);
  FOTOS.slice(0, N).forEach(function (f, i) {
    var b = el('button', 'cq-foto', lista); b.type = 'button'; b.setAttribute('aria-label', 'Ver la foto ' + (i + 1) + ' en grande');
    var im = el('img', 'cq-im', b); im.alt = ''; poner(f, im);
    el('span', '', b, f.frase || '');
    b.addEventListener('click', function () { verGrande(f); });
  });
  if (!N) el('p', 'cq-vacio', g, 'Te traje todo mi cariño en este cofre.');
  var seg = el('button', '', g, 'Seguir'); seg.id = 'cq-seguir'; seg.type = 'button';
  seg.addEventListener('click', function () { if (al.seguir) al.seguir(); });
  requestAnimationFrame(function () { if (galeria) galeria.classList.add('ver'); });
  try { seg.focus({ preventScroll: true }); } catch (e) {}
  /* la galería tapa el mar: se deja de dibujar (queda el último cuadro de fondo) */
  luego(function () { if (galeriaAbierta) { parar(); if (A) A.ac.suspend(); } }, 600);
  if (al.galeria) al.galeria();
}

/* ---------- tamaño, fluidez, visibilidad ---------- */
function medir() {
  if (!vivo) return;
  var w = innerWidth, h = innerHeight;
  R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  mP.uniforms.uAlto.value = h; mP.uniforms.uPr.value = pr; C.mLuz.uniforms.uPr.value = pr; C.mDestellos.uniforms.uPr.value = pr; C.mEstrellas.uniforms.uPr.value = pr;
  fuegos.medir(pr, h);
}
escuchar(window, 'resize', medir); medir();
var fpsAcum = 0, fpsN = 0, fpsVent = 0, fpsBueno = 0, fpsVisto = 60, fpsMin = 999;
/* En calidad baja se dibuja a 30 cuadros por segundo: la mitad de trabajo (menos batería y menos
   calor en los celulares sencillos) y un paso más parejo. El resto, a lo que dé la pantalla. */
var CUADROS = calidad === 'bajo' ? 30 : 60, minMs = CUADROS === 30 ? 1000 / 30 - 4 : 0;
function fluidez(dt) {
  fpsAcum += dt; fpsN++;
  if (fpsAcum >= 1) {
    var fps = fpsN / fpsAcum; fpsVisto = fps; fpsAcum = 0; fpsN = 0; fpsVent++;
    if (fpsVent > 2) fpsMin = Math.min(fpsMin, fps);
    if (fps < CUADROS * .7 && pr > prMin) { pr = Math.max(prMin, pr * .85); R.setPixelRatio(pr); medir(); fpsBueno = 0; if (al.bajo) al.bajo(); }
    else if (fps > CUADROS * .95) { if (++fpsBueno > 4 && pr < prMax) { pr = Math.min(prMax, pr + .1); R.setPixelRatio(pr); medir(); fpsBueno = 0; } }
    else fpsBueno = 0;
    if (fpsEl) { var inf = R.info.render; fpsEl.textContent = Math.round(fps) + ' fps · ' + (1000 / fps).toFixed(1) + ' ms · pr ' + pr.toFixed(2) + ' · ' + calidad + ' · ' + inf.calls + ' dib · ' + (inf.triangles / 1000).toFixed(1) + 'k tri'; }
  }
}
var corriendo = false, antes = 0, raf = 0, tapadoT = 0, tapado = false;
var estJinete = { fase: 1, lado: 1, activo: 0, inclina: 0, vel: 0, alegria: .45 }, burbujaX = null, nivelCls = '';
function bucle(ahora) {
  if (!corriendo || !vivo) return;
  raf = requestAnimationFrame(bucle);
  /* si la página tapa el mar (la mochila, una tarjeta…), no se dibuja ni corre el tiempo:
     dibujar debajo de una capa con desenfoque cuesta mucho y el celular se pone lento */
  if (o.tapado && ahora - tapadoT > 250) { tapadoT = ahora; try { tapado = !!o.tapado(); } catch (e) { tapado = false; } }
  if (tapado) { antes = ahora; return; }
  if (minMs && ahora - antes < minMs) return;          /* calidad baja: un cuadro sí y otro no */
  var dtReal = Math.min(.05, Math.max(.001, (ahora - antes) / 1000)); antes = ahora;
  var dt = dtReal * escalaT;
  t += dt; if (jugando && !pausa) tJuego += dt;
  if (enFinal) { var a = C.altura(B.x, B.z) - .17; B.alto += (a - B.alto) * Math.min(1, dt * 5); bote.g.position.y = B.alto; }
  else if (!pausa || !jugando) fisica(dt);
  else { var a2 = C.altura(B.x, B.z) - .17; B.alto += (a2 - B.alto) * Math.min(1, dt * 5); bote.g.position.y = B.alto; }
  serieCuadro(dt);
  cicloCuadro(dt);
  cielo.cuadro(dt, cam);
  mar.cuadro(dt, cam);
  costa.cuadro(dt, cam);
  aves.cuadro(dt, B);
  obst.cuadro(dt);
  if (jinete && !enFinal) {
    estJinete.fase = remada.fase; estJinete.lado = remada.lado; estJinete.activo = remada.activo; estJinete.inclina = B.T; estJinete.vel = B.v;
    estJinete.alegria = pausa ? 1 : .45 + Math.min(.4, B.v * .08);
    jinete.cuadro(dt, estJinete);
  }
  if (!enFinal) cofre.cuadro(dt);
  cartasCuadro(dt);
  estelaCuadro(dt);
  rompientesCuadro(dt);
  chispasCuadro(dt);
  if (enFinal) final.cuadro(dt); else camaraCuadro(dt);
  fuegos.cuadro(dt);
  brujulaCuadro();
  audioCuadro(dt);
  if (avisoT > 0) { avisoT -= dtReal; if (avisoT <= 0) avisoEl.className = ''; }
  /* el nivel del equilibrio: se toca el DOM solo si cambió */
  var bx = Math.round(Math.max(-1.2, Math.min(1.2, B.T)) * 46);
  if (bx !== burbujaX) { burbujaX = bx; burbuja.style.transform = 'translateX(' + bx + 'px)'; }
  var cls = Math.abs(B.T) > .7 ? (serie.activa ? 'cq-nivel peligro' : 'cq-nivel peligro calma') : (serie.activa ? 'cq-nivel' : 'cq-nivel calma');
  if (cls !== nivelCls) { nivelCls = cls; nivelEl.className = cls; }
  R.render(escena, cam);
  fluidez(dtReal);
}
function arrancar() {
  if (corriendo || !vivo || document.hidden || enTarjeta) return;
  corriendo = true; antes = performance.now(); raf = requestAnimationFrame(bucle);
}
function parar() { corriendo = false; cancelAnimationFrame(raf); }
escuchar(document, 'visibilitychange', function () {
  if (document.hidden) { parar(); if (A) A.ac.suspend(); }
  else if (!galeriaAbierta) { arrancar(); if (A && !mudo && !enTarjeta) A.ac.resume(); }
});
escuchar(lienzo, 'webglcontextlost', function (e) {
  e.preventDefault(); if (!vivo) return;
  parar();
  /* la página decide: sigue con el álbum en 2D (lo guardado no se pierde) */
  luego(function () { var f = al.fallo; cerrar(); if (f) f('perdido'); }, 0);
});

/* ---------- Ruway ---------- */
var cargaRuway = 'esperando';
C.cargarGLB(o.glbRuway || 'ruway-avatar.glb', function (sc) {
  if (!vivo) { liberar(sc); return; }
  if (sc) { try { ruwayA = C.armarAvatar(sc, { alto: 1.45, traje: 'chasqui' }); jinete = C.armarJinete(ruwayA, bote); cargaRuway = 'listo'; } catch (e) { cargaRuway = 'error'; if (window.console) console.error(e); } }
  else cargaRuway = 'error';
  empezar();
});
function empezar() {
  if (!vivo || jugando) return;
  jugando = true; listo = true;
  hudEl.hidden = false; bVerFin.hidden = !o.visto;
  if (cargaRuway === 'error') aviso('No pudimos traer a Ruway, pero igual puedes remar', '', 3600);
  else if (N && recogidas >= N) aviso('Tu cofre ya está lleno: llévalo al muelle', 'oro', 4200);
  else aviso('Arrastra el dedo: adelante rema, a los lados gira · dos dedos para mirar', '', 4200);
  if (N && recogidas >= N) cargarKilla();
  if (al.listo) al.listo();
}

/* ---------- cerrar: se libera todo ---------- */
function quitarPropios() { propios.forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); }); propios = []; }
function cerrar() {
  if (!vivo) return; vivo = false; listo = false;
  parar();
  relojes.forEach(clearTimeout); relojes = [];
  escuchas.forEach(function (e) { e[0].removeEventListener(e[1], e[2], e[3]); }); escuchas = [];
  if (A) { try { A.ac.close(); } catch (e) {} A = null; }
  document.body.classList.remove('cq-cine');
  if (galeria && galeria.parentNode) galeria.parentNode.removeChild(galeria); galeria = null;
  cerrarGrande();
  /* paso por paso: si el juego se armó a medias, puede faltar alguna pieza */
  try { if (cielo && cielo.liberar) cielo.liberar(); } catch (e) {}
  try { if (ruwayA && !ruwayA.raiz.parent) liberar(ruwayA.raiz); if (killaA && !killaA.raiz.parent) liberar(killaA.raiz); } catch (e) {}
  try { if (escena) liberar(escena); } catch (e) {}
  try { if (R) { R.dispose(); R.forceContextLoss(); } } catch (e) {}
  quitarPropios();
  if (api && window.__chasqui === api) window.__chasqui = null;
}

/* ---------- para pruebas, la maqueta y sus capturas ---------- */
var api = {
  estado: function () { return { listo: listo, modo: '3d', corriendo: corriendo, tapado: tapado, cartas: N, recogidas: recogidas, flotando: flotando(), final: enFinal ? final.tiempo() : -1, galeria: galeriaAbierta, killa: !!killaA, jinete: cargaRuway, calidad: calidad, pr: pr, fps: fpsVisto, fpsMin: fpsMin === 999 ? null : fpsMin, x: B.x, z: B.z, v: B.v, T: B.T, ciclo: hCiclo, serie: C.serie.A, surf: B.surf, pausa: pausa, fin: fin, choque: B.choque > 0, gpu: C.gpu || '' }; },
  historia: historia,
  recoger: function (i) { for (var j = 0; j < cartas.length; j++) if (cartas[j].i === i && cartas[j].viva) { recoger(cartas[j]); return true; } return false; },
  irMuelle: function () { B.x = meta.x; B.z = meta.z; B.v = 0; B.rumbo = C.EMBARCADERO.rumbo + Math.PI / 2; camRumbo = B.rumbo; camPos.set(B.x + Math.sin(B.rumbo) * 6, 4, B.z + Math.cos(B.rumbo) * 6); },
  velocidad: function (k) { escalaT = Math.max(.1, Math.min(10, +k || 1)); },
  saltar: saltar,
  verFinal: function () { empezarFinal(.01); },
  ir: function (x, z, rumbo) { B.x = x; B.z = z; B.v = 0; if (rumbo !== undefined) { B.rumbo = rumbo; camRumbo = rumbo; } camPos.set(x + Math.sin(B.rumbo) * 6, 4, z + Math.cos(B.rumbo) * 6); },
  serie: function () { serie.prox = 0; },
  remar: remar,
  camara: function (v) { camFija = v; },
  ciclo: function (h) { hForzado = h; },
  remoPunta: function () { var v = jinete.punta; return [v.x, v.y, v.z]; },
  remoMundo: function () { var v = bote.remo.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z]; },
  camLibre: function (p, m, f) { camLibre = p ? [p, m] : null; if (f) { cam.fov = fov = f; cam.updateProjectionMatrix(); } },
  fugaz: function () { C.forzarFugaz(); },
  llenarCofre: function () { cartas.forEach(function (k) { if (k.viva) { recogidas++; soltarCarta(k); } }); cofre.llenar(recogidas); },
  final: function (desde) { cargarKilla(); empezarFinal(desde || .01); },
  galeria: abrirGaleria,
  palanca: function (x, y, px, py) { joy.x = x; joy.y = y; palanca.style.left = px + 'px'; palanca.style.top = py + 'px'; palanca.className = x || y ? 'ver' : ''; perilla.style.transform = 'translate(' + (x * PAL_R) + 'px,' + (-y * PAL_R) + 'px)'; },
  mirar: function (m, yaw, pitch2, dist) { ponerMirar(m); avisoT = 0; avisoEl.className = ''; orb.yaw = yaw || 0; orb.pitch = pitch2 || 0; orb.dist = dist || 1; orb.quieto = 0; }
};
/* la API de prueba solo existe si la página la manejan las pruebas (navigator.webdriver) o si se
   pide a propósito: en un regalo de verdad no hay atajos para llegar al final sin jugar */
if (navigator.webdriver || window.__RUWAY_PRUEBA) window.__chasqui = api;
arrancar();
return { cerrar: cerrar, estado: api.estado, api: api };
}
})();
