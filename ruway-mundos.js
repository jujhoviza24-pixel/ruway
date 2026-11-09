/* GENERADO POR construir.js desde lib/mundos/ · NO EDITAR A MANO */
/* Ruway — LOS MUNDOS: el ambiente de los juegos cambia según el personaje que se elige.
   base.js: utilidades, texturas hechas en lienzo, la tabla de los seis mundos y qué pareja lleva a cuál.

   La idea (docs/PLAN-DESBLOQUEOS.md): cada pareja de personajes vive en un lugar del Perú. Al despertar
   a una pareja se abre su mundo. Los juegos con personaje (laberinto, planeta, isla, corre) leen de aquí
   el cielo, la luz, la neblina, el suelo, las paredes, lo que se ve a lo lejos y lo que flota en el aire.

     Uku y Puyu (oso, conejo) ........... Los Andes (sierra)      ← despiertos desde el inicio
     Tika y Sami (vaca, shiba) .......... Huanchaco (costa)
     Rumi y Chaska (explorador, nova) ... Chan Chan (desierto)
     Wayra e Inti (exploradora, paladín)  Trujillo (ciudad), y también el secreto: Kantu y Ari (tensy, leo)
     Yaku y Urpi (myke, lavender) ....... La noche andina (Mayu)
     Nina y Qori (panda y el «pingüino») Huanchaco (costa) · Kusi (el mono) en la Amazonía: lo espera una chica al azar
     Atuq (el zorro andino) ............. Los Andes: lo espera alguien al azar; despierta al ver todos los recuerdos

   Respeto: la cultura va en el MUNDO (paisaje, arquitectura, fauna), no en disfraces. Nada sagrado se
   usa como premio ni como adorno (sin apachetas ni ofrendas).

   Rendimiento: todo lo repetido va junto (una sola malla o una InstancedMesh), las texturas son chicas
   y se repiten, y la luz es una hemisférica más un sol. En un teléfono flojo no hay sombras de verdad:
   queda la sombrita redonda bajo los personajes. Medidas: 1 unidad = una casilla del laberinto. */
(function () {
'use strict';
var M = window.Mundos = window.Mundos || {};

/* ---------- utilidades ---------- */
M.azar = function (sem) { var s = (sem >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
M.suave = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
M.lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
M.lienzo = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
M.tex = function (c, srgb, rep) {
  var t = new THREE.CanvasTexture(c); if (!t.userData) t.userData = {};   /* en r128 las texturas no traen userData */
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};
/* ruido de valor que se repite cada "per" celdas: texturas sin costura */
M.ruido = function (per, rnd) {
  var g = new Float32Array(per * per); for (var i = 0; i < g.length; i++) g[i] = rnd();
  return function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    var x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = g[y0 * per + x0], b = g[y0 * per + x1], c = g[y1 * per + x0], d = g[y1 * per + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
};
/* color hex (sRGB) → [r,g,b] lineal, que es como van los colores de los vértices */
var _c = new THREE.Color();
M.col = function (hex, k) { _c.set(hex).convertSRGBToLinear(); if (k != null) _c.multiplyScalar(k); return [_c.r, _c.g, _c.b]; };
M.mezclaCol = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

/* ---------- la junta: muchas piezas con su color en UNA geometría ----------
   Cada pieza guarda su color en los vértices; las coordenadas de textura salen de la posición
   (según hacia dónde mira la cara), así el grano tiene el mismo tamaño en todas partes.
   o.oscuroAbajo: oscurece lo que está cerca del suelo (la humedad, la sombra de contacto). */
M.Junta = function () { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.base = 0; this.extra = {}; };
M.Junta.prototype.pieza = function (geo, color, m, uvK, extra) {
  if (m) geo.applyMatrix4(m);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  var p = geo.attributes.position, n = geo.attributes.normal, cnt = p.count, propio = geo.attributes.color, k = uvK || 1;
  var uvP = geo.userData && geo.userData.uvPropio ? geo.attributes.uv : null;
  for (var v = 0; v < cnt; v++) {
    var x = p.getX(v), y = p.getY(v), z = p.getZ(v), ax = Math.abs(n.getX(v)), ay = Math.abs(n.getY(v)), az = Math.abs(n.getZ(v));
    this.p.push(x, y, z); this.n.push(n.getX(v), n.getY(v), n.getZ(v));
    if (uvP) this.uv.push(uvP.getX(v), uvP.getY(v));
    else if (ay >= ax && ay >= az) this.uv.push(x * k, z * k);
    else if (ax >= az) this.uv.push(z * k, y * k);
    else this.uv.push(x * k, y * k);
    if (propio) this.c.push(color[0] * propio.getX(v), color[1] * propio.getY(v), color[2] * propio.getZ(v));
    else this.c.push(color[0], color[1], color[2]);
  }
  for (var e in (extra || {})) { var arr = this.extra[e] || (this.extra[e] = []); for (v = 0; v < cnt; v++) arr.push(typeof extra[e] === 'function' ? extra[e](v, p) : extra[e]); }
  if (geo.index) { var ix = geo.index.array; for (v = 0; v < ix.length; v++) this.i.push(ix[v] + this.base); }
  else for (v = 0; v < cnt; v++) this.i.push(v + this.base);
  this.base += cnt; geo.dispose(); return this;
};
M.Junta.prototype.caja = function (w, h, d, x, y, z, color, m, uvK) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return this.pieza(g, color, m, uvK); };
M.Junta.prototype.geometria = function (o) {
  o = o || {}; var g = new THREE.BufferGeometry();
  if (o.oscuroAbajo) for (var v = 0; v < this.base; v++) { var y = this.p[v * 3 + 1], f = o.oscuroAbajo[0] + (1 - o.oscuroAbajo[0]) * M.suave(0, o.oscuroAbajo[1], y); this.c[v * 3] *= f; this.c[v * 3 + 1] *= f; this.c[v * 3 + 2] *= f; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  for (var e in this.extra) g.setAttribute(e, new THREE.Float32BufferAttribute(this.extra[e], 1));
  g.setIndex(this.base > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
  g.computeBoundingSphere(); return g;
};
/* mueve los vértices de una geometría con una función (para que nada sea una caja perfecta) */
M.torcer = function (geo, f) { var p = geo.attributes.position, v = new THREE.Vector3(); for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); f(v, i); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; };
/* pinta los vértices de una geometría con una función que devuelve [r,g,b] */
M.pintar = function (geo, f) { var p = geo.attributes.position, c = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); var k = f(v, i); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };

/* ---------- texturas comunes ---------- */
var CACHE = {};
function una(k, f) { return CACHE[k] || (CACHE[k] = f()); }
/* grano gris alrededor de 1: se multiplica por el color de los vértices (piedra, barro, estuco) */
M.texGrano = function (sem, fuerza, n) {
  return una('grano' + sem + ':' + fuerza + ':' + n, function () {
    var N = n || 128, c = M.lienzo(N, N), g = c.getContext('2d'), rnd = M.azar(sem || 7), r1 = M.ruido(8, rnd), r2 = M.ruido(32, rnd), im = g.createImageData(N, N), F = fuerza || .2;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var v = r1(x / (N / 8), y / (N / 8)) * .6 + r2(x / (N / 32), y / (N / 32)) * .4, k = 1 - F * .5 + v * F, i = (y * N + x) * 4, b = Math.round(255 * Math.min(1, k * .96));
      im.data[i] = b; im.data[i + 1] = b; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); return M.tex(c, false, true);
  });
};
M.texBrillo = function () { return una('brillo', function () {
  var c = M.lienzo(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.6)'); gr.addColorStop(.5, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return M.tex(c, false, false); }); };
M.texSombra = function () { return una('sombra', function () {
  var c = M.lienzo(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return M.tex(c, false, false); }); };
/* un pétalo de limpiapipas (alfa): el camino de pétalos y las lluvias de colores */
M.texPetalo = function () { return una('petalo', function () {
  var c = M.lienzo(64, 64), g = c.getContext('2d');
  g.translate(32, 32); g.rotate(-.5); var gr = g.createLinearGradient(-20, 0, 20, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e8e8e8');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-24, 0); g.bezierCurveTo(-14, -16, 12, -14, 24, 0); g.bezierCurveTo(12, 14, -14, 16, -24, 0); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke();
  return M.tex(c, false, false); }); };
/* un anillo suave (la onda que sale del suelo al encontrar algo) */
M.texAnillo = function () { return una('anillo', function () {
  var c = M.lienzo(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.75, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return M.tex(c, false, false); }); };

/* ---------- los seis mundos ----------
   cielo: colores del cenit, del medio y del horizonte; sol (dirección, color, tamaño del disco).
   niebla: color y distancias (cerca, lejos). luz: hemisférica (cielo/suelo/fuerza), sol (color/fuerza)
   y la exposición. Los demás campos los leen muros.js, suelo.js, lejos.js y vida.js. */
M.MUNDOS = {
  sierra: {
    id: 'sierra', nombre: 'Los Andes', sub: 'Entre nevados y andenes',
    cielo: { cenit: '#2a63c9', medio: '#6fa6e6', horizonte: '#d9ecfb', sol: [0.45, 0.62, -0.64], solCol: '#fff6e2', solTam: .035, nubes: 'blancas' },
    niebla: { color: '#cfe3f2', cerca: 12, lejos: 60 },
    luz: { cielo: '#d5e4fa', suelo: '#525a38', hemi: .5, sol: '#fff0d4', solInt: 1.45, exp: .92 },
    muro: 'inca', suelo: 'puna', lejos: 'nevados', vida: 'puna',
    regalos: ['#d83a3a', '#f29b1f', '#f7d02c', '#2f9e5a', '#e2508a', '#3a74d8'], acento: '#f7d02c'
  },
  costa: {
    id: 'costa', nombre: 'Huanchaco', sub: 'El mar de los caballitos de totora',
    cielo: { cenit: '#3d4f9e', medio: '#ee8f6a', horizonte: '#ffd49a', sol: [-0.2, 0.12, -0.97], solCol: '#ffd9a0', solTam: .06, nubes: 'atardecer' },
    niebla: { color: '#f1c49b', cerca: 9, lejos: 44 },
    luz: { cielo: '#ffd8b8', suelo: '#7a5e47', hemi: .65, sol: '#ffc987', solInt: 1.9, exp: .95 },
    muro: 'totora', suelo: 'arena', lejos: 'mar', vida: 'mar',
    regalos: ['#2f7fd1', '#ffffff', '#ff8a5b', '#40c4c4', '#ffd166', '#e85d75'], acento: '#ff8a5b'
  },
  desierto: {
    id: 'desierto', nombre: 'Chan Chan', sub: 'La ciudad de barro junto al mar',
    cielo: { cenit: '#2f6db8', medio: '#8cc0e8', horizonte: '#f3e3c3', sol: [0.75, 0.42, 0.5], solCol: '#ffe6b8', solTam: .04, nubes: 'pocas' },
    niebla: { color: '#ecdcc0', cerca: 10, lejos: 48 },
    luz: { cielo: '#f6ead6', suelo: '#8f6f4e', hemi: .6, sol: '#ffdcae', solInt: 2.0, exp: .95 },
    muro: 'adobe', suelo: 'tierra', lejos: 'dunas', vida: 'polvo',
    regalos: ['#1fa3a3', '#e0533c', '#f4c542', '#7a4fb5', '#3c8de0', '#f08a2e'], acento: '#1fa3a3'
  },
  ciudad: {
    id: 'ciudad', nombre: 'Trujillo', sub: 'Las casonas de colores del centro',
    cielo: { cenit: '#2b3f86', medio: '#9a7bb6', horizonte: '#ffc58f', sol: [-0.6, 0.18, 0.78], solCol: '#ffcf8f', solTam: .045, nubes: 'atardecer' },
    niebla: { color: '#e9b99a', cerca: 16, lejos: 75 },
    luz: { cielo: '#ffe0c8', suelo: '#6f5a4a', hemi: .55, sol: '#ffcf96', solInt: 1.55, exp: .92 },
    muro: 'seto', suelo: 'losas', lejos: 'catedral', vida: 'faroles', plaza: true,
    regalos: ['#e9b949', '#3e6fb0', '#c9443b', '#6fb3a0', '#f08aa6', '#ffffff'], acento: '#e9b949'
  },
  noche: {
    id: 'noche', nombre: 'La noche andina', sub: 'Bajo el Mayu, el río de estrellas',
    cielo: { cenit: '#070b22', medio: '#14204a', horizonte: '#33416f', sol: [-0.35, 0.55, -0.76], solCol: '#dfe8ff', solTam: .03, luna: true, estrellas: true, via: true },
    niebla: { color: '#1b2550', cerca: 7, lejos: 34 },
    luz: { cielo: '#8ea6e6', suelo: '#262b4e', hemi: .95, sol: '#c4d4ff', solInt: 1.3, exp: 1.1 },
    muro: 'piedraNoche', suelo: 'escarcha', lejos: 'cerrosNoche', vida: 'luciernagas',
    regalos: ['#ffd36b', '#ff9fd1', '#9fe0ff', '#c8a8ff', '#ffb36b', '#ffffff'], acento: '#ffd36b', brillan: true
  },
  selva: {
    id: 'selva', nombre: 'La Amazonía', sub: 'Entre árboles gigantes y mariposas azules',
    cielo: { cenit: '#4f8fa0', medio: '#a6cfa0', horizonte: '#f1e6b0', sol: [0.3, 0.8, -0.52], solCol: '#fff3c8', solTam: .03, nubes: 'humedas' },
    niebla: { color: '#b9d3a3', cerca: 6, lejos: 30 },
    luz: { cielo: '#e2f3c6', suelo: '#33401c', hemi: .7, sol: '#fff0c2', solInt: 1.5, exp: .98 },
    muro: 'follaje', suelo: 'hojarasca', lejos: 'arboles', vida: 'mariposas',
    regalos: ['#ff5a3c', '#ffcf3c', '#3cb6ff', '#ff6fb1', '#7ee05a', '#ffffff'], acento: '#3cb6ff'
  }
};
/* qué pareja lleva a qué mundo (Ruway, Killa y "Mi avatar" van a los Andes) */
M.PJ_MUNDO = { oso: 'sierra', conejo: 'sierra', shiba: 'costa', vaca: 'costa', explorador: 'desierto', nova: 'desierto',
  escolar: 'ciudad', exploradora: 'ciudad', paladin: 'ciudad', rulitos: 'ciudad', tensy: 'ciudad', leo: 'ciudad', myke: 'noche', lavender: 'noche', panda: 'costa', qori: 'costa', mono: 'selva', fuego: 'selva', atuq: 'sierra' };
M.de = function (pjId) { return M.MUNDOS[M.PJ_MUNDO[pjId] || 'sierra']; };
M.lista = function () { return ['sierra', 'costa', 'desierto', 'ciudad', 'noche', 'selva'].map(function (k) { return M.MUNDOS[k]; }); };

/* ¿teléfono flojo? (sin sombras de verdad y con menos cosas en el aire) */
M.calidad = function () {
  if (M._cal) return M._cal;
  var baja = false;
  try { var mem = navigator.deviceMemory; if (mem && mem <= 2) baja = true; } catch (e) {}
  try { if ((navigator.hardwareConcurrency || 8) <= 4 && /Android/i.test(navigator.userAgent)) baja = true; } catch (e) {}
  if (window.__MUNDOS_CALIDAD) baja = window.__MUNDOS_CALIDAD === 'baja';
  return (M._cal = baja ? 'baja' : 'alta');
};

/* el renderizador como en la intro y el Chasqui: color correcto y luz de cine */
M.preparar = function (R, mundo) {
  M._R = R;   /* para las texturas reales (anisotropía) y el reflejo del cielo (PMREM) */
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = mundo.luz.exp || 1;
  R.shadowMap.enabled = M.calidad() === 'alta'; R.shadowMap.type = THREE.PCFSoftShadowMap;
};
/* ---------- el acabado de cine (9-nov, La gran carrera): brillo suave, color por lugar y viñeta ----------
   La escena se dibuja como siempre (en la pantalla, con su antialias y su tono de cine ACES) y después se toma esa imagen:
     · el brillo: lo que pasa del umbral se baja a 1/4 de la pantalla, se borronea (dos vueltas de dos pasadas) y se suma:
       se derrama alrededor de lo que brilla (el sol, las chispas, las ventanas y los faroles de la noche);
     · el color de cada lugar: contraste suave en S, saturación, sombras frías y luces cálidas;
     · la viñeta: las esquinas apenas más oscuras.
   Es un retoque de pantalla (sobre la imagen ya en sRGB, como en el cine) y queda en el mismo lienzo: va a la foto y al
   video. Si el celular no deja copiar la pantalla, se marca roto y no se usa (la escena queda como siempre). Sin descargas.
   crudo: el dibujo del renderizador antes de que el núcleo lo envuelva (N.fluido cuenta los dibujos para bajar la
   resolución y toma la foto del recuerdo después de dibujar): la escena y las pasadas van por crudo y solo la última,
   la que queda en la pantalla, por el envoltorio. Así cuenta un dibujo por cuadro y la foto sale con el acabado.
   M.cine(R, crudo) → { escala, roto, mundo(m), dibujar(E, C) (en vez de R.render), probar(), soltar() } */
var LOOKS = {   /* umbral y fuerza del brillo, saturación, contraste, tinte de las sombras y de las luces, viñeta */
  sierra:   { umbral: .82, brillo: .35, sat: 1.06, contraste: .18, frio: [-.012, 0, .022], calido: [.018, .010, -.010], vineta: .26 },
  costa:    { umbral: .80, brillo: .40, sat: 1.10, contraste: .14, frio: [-.015, .010, .025], calido: [.035, .020, -.020], vineta: .24 },
  desierto: { umbral: .82, brillo: .38, sat: .98, contraste: .16, frio: [0, 0, .015], calido: [.040, .020, -.025], vineta: .26 },
  ciudad:   { umbral: .78, brillo: .45, sat: 1.08, contraste: .16, frio: [.010, -.010, .030], calido: [.045, .015, -.015], vineta: .28 },
  noche:    { umbral: .55, brillo: .95, sat: 1.05, contraste: .20, frio: [-.010, .005, .045], calido: [.020, .010, -.010], vineta: .32 },   /* las ventanas y los faroles, con su halo */
  selva:    { umbral: .80, brillo: .40, sat: 1.06, contraste: .14, frio: [-.010, .020, .010], calido: [.025, .025, -.015], vineta: .28 }
};
var VERT_CINE = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
M.cine = function (R, crudo) {
  crudo = crudo || R.render;
  var K = .25, w = 0, h = 0, nuevo = false, tEsc = null, rtA = null, rtB = null, cam = new THREE.Camera(), esc = new THREE.Scene(), vT = new THREE.Vector2(), vPx = new THREE.Vector2(), v0 = new THREE.Vector2();
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; esc.add(quad);
  function mat(frag, u) { return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_CINE, fragmentShader: frag, depthTest: false, depthWrite: false }); }
  var mBrillo = mat('uniform sampler2D tE; uniform vec2 uPx; uniform float uUmbral; varying vec2 vUv;\n' +
      'vec3 t(vec2 o) { vec3 c = texture2D(tE, vUv + o * uPx).rgb; float l = max(c.r, max(c.g, c.b)), k = clamp((l - uUmbral) / (1. - uUmbral), 0., 1.); return c * k * k; }\n' +
      'void main() { gl_FragColor = vec4((t(vec2(-1., -1.)) + t(vec2(1., -1.)) + t(vec2(-1., 1.)) + t(vec2(1., 1.))) * .25, 1.); }',
    { tE: { value: null }, uPx: { value: new THREE.Vector2() }, uUmbral: { value: .8 } });
  var mBorron = mat('uniform sampler2D tE; uniform vec2 uDir; varying vec2 vUv;\n' +   /* gaussiana de 9 puntos en 5 lecturas */
      'void main() { vec3 c = texture2D(tE, vUv).rgb * .227027 + (texture2D(tE, vUv + uDir * 1.384615).rgb + texture2D(tE, vUv - uDir * 1.384615).rgb) * .316216\n' +
      '  + (texture2D(tE, vUv + uDir * 3.230769).rgb + texture2D(tE, vUv - uDir * 3.230769).rgb) * .07027; gl_FragColor = vec4(c, 1.); }',
    { tE: { value: null }, uDir: { value: new THREE.Vector2() } });
  var mFinal = mat('uniform sampler2D tE, tB; uniform float uBrillo, uSat, uContraste, uVineta; uniform vec3 uFrio, uCalido; varying vec2 vUv;\n' +
      'void main() { vec3 c = clamp(texture2D(tE, vUv).rgb + texture2D(tB, vUv).rgb * uBrillo, 0., 1.);\n' +
      '  float l = dot(c, vec3(.2126, .7152, .0722)); c = clamp(mix(vec3(l), c, uSat), 0., 1.); c = mix(c, c * c * (3. - 2. * c), uContraste);\n' +
      '  c += uFrio * (1. - l) * (1. - l) + uCalido * l * l;\n' +
      '  c *= mix(1. - uVineta, 1., 1. - smoothstep(.45, 1.45, length((vUv - .5) * 2.)));\n' +
      '  gl_FragColor = vec4(clamp(c, 0., 1.), 1.); }',
    { tE: { value: null }, tB: { value: null }, uBrillo: { value: .4 }, uSat: { value: 1 }, uContraste: { value: 0 }, uVineta: { value: 0 }, uFrio: { value: new THREE.Vector3() }, uCalido: { value: new THREE.Vector3() } });
  var L = LOOKS.sierra, OPC = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  function pasada(m, rt, ultima) { quad.material = m; R.setRenderTarget(rt); if (ultima) R.render(esc, cam); else crudo.call(R, esc, cam); }
  function soltarImg() { if (tEsc) tEsc.dispose(); if (rtA) rtA.dispose(); if (rtB) rtB.dispose(); tEsc = rtA = rtB = null; w = h = 0; }
  function medir() { R.getDrawingBufferSize(vT); if (tEsc && vT.x === w && vT.y === h) return; soltarImg(); w = vT.x; h = vT.y; nuevo = true;
    tEsc = new THREE.DataTexture(null, w, h, THREE.RGBFormat); tEsc.minFilter = tEsc.magFilter = THREE.LinearFilter;   /* sin alfa: la pantalla no lo tiene */
    rtA = new THREE.WebGLRenderTarget(Math.max(1, Math.round(w * K)), Math.max(1, Math.round(h * K)), OPC); rtB = rtA.clone(); }
  function brillo(fuente, A, B, px, umbral) {   /* lo que brilla, en chico y borroneado: queda en A */
    mBrillo.uniforms.tE.value = fuente; mBrillo.uniforms.uPx.value.copy(px); mBrillo.uniforms.uUmbral.value = umbral; pasada(mBrillo, A);
    for (var i = 0; i < 2; i++) { mBorron.uniforms.tE.value = A.texture; mBorron.uniforms.uDir.value.set(1 / A.width, 0); pasada(mBorron, B);
      mBorron.uniforms.tE.value = B.texture; mBorron.uniforms.uDir.value.set(0, 1 / A.height); pasada(mBorron, A); } }
  var api = { escala: K, roto: false,
    mundo: function (m) { L = LOOKS[m && m.id] || LOOKS.sierra; var u = mFinal.uniforms;
      u.uBrillo.value = L.brillo; u.uSat.value = L.sat; u.uContraste.value = L.contraste; u.uVineta.value = L.vineta; u.uFrio.value.fromArray(L.frio); u.uCalido.value.fromArray(L.calido); },
    /* en vez de R.render(E, C): la escena en la pantalla, su copia, el brillo y la pasada final */
    dibujar: function (E, C) { if (api.roto) { R.render(E, C); return false; }
      crudo.call(R, E, C); medir(); var gl = R.getContext();
      if (nuevo) while (gl.getError() !== gl.NO_ERROR) {}   /* solo cuentan los errores de la copia (se mira en el primer cuadro de cada tamaño) */
      R.copyFramebufferToTexture(v0, tEsc);
      if (nuevo) { nuevo = false; if (gl.getError() !== gl.NO_ERROR) { api.roto = true; soltarImg(); R.render(E, C); return false; } }   /* no se pudo copiar: desde ahora, como siempre */
      brillo(tEsc, rtA, rtB, vPx.set(1 / w, 1 / h), L.umbral);
      mFinal.uniforms.tE.value = tEsc; mFinal.uniforms.tB.value = rtA.texture; pasada(mFinal, null, true); return true; },
    /* para las pruebas: un punto blanco en negro pasa por el brillo; cuánto queda en el punto, cerca y más lejos */
    probar: function () { var N = 64, d = new Uint8Array(N * N * 3); for (var y = 28; y < 36; y++) for (var x = 28; x < 36; x++) d[(y * N + x) * 3] = d[(y * N + x) * 3 + 1] = d[(y * N + x) * 3 + 2] = 255;
      var t = new THREE.DataTexture(d, N, N, THREE.RGBFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
      var A = new THREE.WebGLRenderTarget(N * K, N * K, OPC), B = A.clone(), px = new Uint8Array(4), c = N * K / 2;
      function leer(x) { R.readRenderTargetPixels(A, x, c, 1, 1, px); return px[0] / 255; }
      try { brillo(t, A, B, new THREE.Vector2(1 / N, 1 / N), .5); return { centro: leer(c), cerca: leer(c + 3), lejos: leer(c + 7) }; }
      finally { R.setRenderTarget(null); t.dispose(); A.dispose(); B.dispose(); } },
    soltar: function () { soltarImg(); [mBrillo, mBorron, mFinal].forEach(function (m) { m.dispose(); }); quad.geometry.dispose(); } };
  api.mundo(null);
  return api;
};
/* las luces del mundo: hemisférica + sol con sombra que sigue al personaje */
M.luces = function (E, mundo) {
  var L = mundo.luz, hemi = new THREE.HemisphereLight(L.cielo, L.suelo, L.hemi); E.add(hemi);
  var sol = new THREE.DirectionalLight(L.sol, L.solInt), d = mundo.cielo.sol;
  sol.userData.dir = new THREE.Vector3(d[0], Math.max(.25, d[1]), d[2]).normalize();
  sol.castShadow = M.calidad() === 'alta'; sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0008; sol.shadow.normalBias = .02;
  var sc = sol.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = .5; sc.far = 40;
  E.add(sol); E.add(sol.target);
  E.fog = new THREE.Fog(mundo.niebla.color, mundo.niebla.cerca, mundo.niebla.lejos);
  return { hemi: hemi, sol: sol, seguir: function (x, z) { var v = sol.userData.dir; sol.position.set(x + v.x * 14, v.y * 14, z + v.z * 14); sol.target.position.set(x, 0, z); } };
};
/* ---------- texturas reales (La gran carrera, 3c): fotos CC0 de Poly Haven pasadas a WebP (lib/tx-*.webp) ----------
   M.texReal('arena', ok, mal) baja tx-arena.webp una sola vez (las que piden lo mismo esperan juntas). Si no llega, mal():
   quien la pidió se queda con su textura dibujada. tx-<nombre>-n.webp es el relieve (va sin sRGB). */
var REALES = {};
M.texReal = function (nombre, ok, mal) {
  var c = REALES[nombre];
  if (c && c.tex) { c.usos++; setTimeout(function () { ok(c.tex); }, 0); return; }
  if (c) { c.esperan.push([ok, mal]); return; }
  c = REALES[nombre] = { esperan: [[ok, mal]], usos: 0 };
  new THREE.TextureLoader().load((window.__MUNDOS_TX || '') + 'tx-' + nombre + '.webp', function (t) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (!t.userData) t.userData = {}; t.userData.fuente = 'tx-' + nombre + '.webp';
    if (!/-n$/.test(nombre)) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = M._R ? Math.min(4, M._R.capabilities.getMaxAnisotropy()) : 1;
    c.tex = t; var l = c.esperan; c.esperan = []; c.usos += l.length; l.forEach(function (f) { f[0](t); });   /* primero se cuentan todos: así una pista vieja no la suelta antes de que la reciba la nueva */
  }, undefined, function () { var l = c.esperan; delete REALES[nombre]; l.forEach(function (f) { if (f[1]) f[1](); }); });
};
/* suelta una textura real de la memoria del teléfono (la de una pista que ya no se juega): cada uno suelta lo que recibió */
M.soltarReal = function (nombre) { var c = REALES[nombre]; if (c && c.tex && --c.usos <= 0) { c.tex.dispose(); delete REALES[nombre]; } };
/* el reflejo del cielo: un panorama pintado con los colores del cielo del mundo y su sol, pasado por PMREM.
   Se ve en la pintura de los autos (no se baja nada). Uno por mundo, guardado. */
M.envCielo = function (mundo) {
  if (!M._R || !THREE.PMREMGenerator) return null;
  return una('env:' + mundo.id, function () { try {
    var W = 256, H = 128, c = M.lienzo(W, H), g = c.getContext('2d'), C = mundo.cielo, gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, C.cenit); gr.addColorStop(.3, C.medio); gr.addColorStop(.49, C.horizonte); gr.addColorStop(.52, mundo.luz.suelo); gr.addColorStop(1, mundo.luz.suelo);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var d = new THREE.Vector3(C.sol[0], C.sol[1], C.sol[2]).normalize(), u = Math.atan2(d.z, d.x) / (2 * Math.PI) + .5, v = Math.asin(d.y) / Math.PI + .5;
    var sx = u * W, sy = (1 - v) * H, rs = g.createRadialGradient(sx, sy, 0, sx, sy, 14);
    rs.addColorStop(0, C.solCol); rs.addColorStop(.25, C.solCol); rs.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rs; g.fillRect(sx - 14, sy - 14, 28, 28);
    var t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    var pm = new THREE.PMREMGenerator(M._R), env = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); return env;
  } catch (e) { return null; } });
};
/* la sombrita redonda bajo alguien (siempre, también en los teléfonos sin sombras) */
M.sombrita = function (r) {
  var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: M.texSombra(), transparent: true, depthWrite: false, opacity: .9 }));
  m.rotation.x = -Math.PI / 2; m.position.y = .012; m.renderOrder = 1; return m;
};
})();

;
/* Ruway — LOS MUNDOS. cielo.js: la bóveda de cada mundo.
   Un degradado de tres colores (horizonte → medio → cenit) con el sol (disco y resplandor) pintado en
   el mismo shader, nubes de una textura hecha en lienzo, y de noche estrellas, la vía láctea (el Mayu)
   y la luna. La bóveda sigue a la cámara: nunca se llega a su borde. Sin neblina: el horizonte ya trae
   el color de la neblina del mundo, así el suelo y el cielo se funden. */
(function () {
'use strict';
var M = window.Mundos;

var VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
var FS = [
  'uniform vec3 uCenit; uniform vec3 uMedio; uniform vec3 uHor; uniform vec3 uSolDir; uniform vec3 uSolCol; uniform float uSolTam; uniform sampler2D uNubes; uniform float uConNubes; uniform float uT;',
  'varying vec3 vDir;',
  'void main(){',
  '  vec3 d = normalize(vDir); float h = d.y;',
  '  vec3 c = mix(uHor, uMedio, smoothstep(0.0, 0.22, h));',
  '  c = mix(c, uCenit, smoothstep(0.18, 0.85, h));',
  '  c = mix(c, uHor * 0.92, smoothstep(0.0, -0.12, h));',          /* debajo del horizonte: el color de la neblina */
  '  float s = max(dot(d, normalize(uSolDir)), 0.0);',
  '  float disco = smoothstep(1.0 - uSolTam * 0.08, 1.0 - uSolTam * 0.05, s);',
  '  float halo = pow(s, 40.0) * 0.55 + pow(s, 6.0) * 0.22;',
  '  c += uSolCol * (halo + disco * 1.6);',
  '  if (uConNubes > 0.5 && h > -0.02) {',
  '    float u = atan(d.x, d.z) / 6.2831853 + 0.5 + uT * 0.002; float v = clamp(h / 0.55, 0.0, 1.0);',
  '    vec4 n = texture2D(uNubes, vec2(u, v));',
  '    float lado = pow(s, 3.0);',
  '    vec3 nc = mix(n.rgb, n.rgb + uSolCol * 0.6, lado);',
  '    c = mix(c, nc, n.a * smoothstep(-0.02, 0.06, h));',
  '  }',
  '  gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

/* nubes en una banda (u: alrededor del horizonte, v: de abajo hacia el cenit), con alfa */
function texNubes(tipo, sem) {
  var W = 1024, H = 256, c = M.lienzo(W, H), g = c.getContext('2d'), rnd = M.azar(sem || 11), r1 = M.ruido(16, rnd), r2 = M.ruido(64, rnd), im = g.createImageData(W, H);
  var P = {
    blancas: { base: [255, 255, 255], sombra: [196, 210, 230], umbral: .56, densa: 1.0, alto: .55 },
    atardecer: { base: [255, 214, 186], sombra: [176, 112, 140], umbral: .58, densa: .95, alto: .4 },
    pocas: { base: [255, 250, 240], sombra: [214, 210, 214], umbral: .66, densa: .8, alto: .45 },
    humedas: { base: [246, 250, 236], sombra: [184, 204, 178], umbral: .5, densa: .85, alto: .5 }
  }[tipo] || null;
  if (!P) return null;
  for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
    var v = y / H, alto = 1 - v;                                      /* la fila 0 es la de abajo en la textura */
    var n = r1(x / 64, y / 26) * .62 + r2(x / 16, y / 8) * .38;
    var banda = M.suave(0, .18, alto) * (1 - M.suave(P.alto * .6, P.alto, alto));
    var a = M.suave(P.umbral, P.umbral + .16, n) * banda * P.densa;
    var k = M.suave(P.umbral, P.umbral + .3, n), i = ((H - 1 - y) * W + x) * 4;
    im.data[i] = P.sombra[0] + (P.base[0] - P.sombra[0]) * k;
    im.data[i + 1] = P.sombra[1] + (P.base[1] - P.sombra[1]) * k;
    im.data[i + 2] = P.sombra[2] + (P.base[2] - P.sombra[2]) * k;
    im.data[i + 3] = Math.round(255 * a);
  }
  g.putImageData(im, 0, 0);
  var t = M.tex(c, false, false); t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.anisotropy = 1; return t;
}

M.cielo = function (E, mundo) {
  var C = mundo.cielo, lin = function (h) { return new THREE.Color(h); };
  var nubes = C.nubes ? texNubes(C.nubes, mundo.id.length * 7) : null;
  var mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uCenit: { value: lin(C.cenit) }, uMedio: { value: lin(C.medio) }, uHor: { value: lin(C.horizonte) },
      uSolDir: { value: new THREE.Vector3().fromArray(C.sol).normalize() }, uSolCol: { value: lin(C.solCol) }, uSolTam: { value: C.solTam },
      uNubes: { value: nubes || M.texBrillo() }, uConNubes: { value: nubes ? 1 : 0 }, uT: { value: 0 } }
  });
  var g = new THREE.Group(), cupula = new THREE.Mesh(new THREE.SphereGeometry(90, 40, 20), mat); cupula.renderOrder = -10; g.add(cupula);
  /* de noche: estrellas (una sola nube de puntos), el Mayu y la luna */
  if (C.estrellas) {
    var N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), rnd = M.azar(77);
    for (var i = 0; i < N; i++) { var u = rnd() * 2 - 1, a = rnd() * 6.283, r = Math.sqrt(1 - u * u), y = Math.abs(u) * .96 + .04;
      pos[i * 3] = Math.cos(a) * r * 85; pos[i * 3 + 1] = y * 85; pos[i * 3 + 2] = Math.sin(a) * r * 85;
      var k = .55 + rnd() * .45, tinte = rnd(); col[i * 3] = k * (tinte < .2 ? 1 : .9); col[i * 3 + 1] = k * .95; col[i * 3 + 2] = k * (tinte > .8 ? .8 : 1); }
    var gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gs.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var est = new THREE.Points(gs, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false, map: M.texBrillo(), blending: THREE.AdditiveBlending }));
    est.renderOrder = -9; g.add(est); g.userData.estrellas = est;
  }
  if (C.via) {
    /* la vía láctea: la foto de la galería del universo, en una banda inclinada que cruza el cielo */
    var tv = new THREE.TextureLoader().load(window.__MUNDOS_VIA || 'via-lactea.jpg'); tv.encoding = THREE.sRGBEncoding;
    var banda = new THREE.Mesh(new THREE.CylinderGeometry(84, 84, 46, 48, 1, true), new THREE.MeshBasicMaterial({ map: tv, transparent: true, opacity: .62, side: THREE.BackSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    banda.rotation.set(.9, .3, .55); banda.renderOrder = -9; g.add(banda);
  }
  if (C.luna) {
    var ld = new THREE.Vector3().fromArray(C.sol).normalize().multiplyScalar(80);
    var luna = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLuna(), fog: false, depthWrite: false, transparent: true })); luna.position.copy(ld); luna.scale.setScalar(7); luna.renderOrder = -8; g.add(luna);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.texBrillo(), color: '#9fb5ff', fog: false, depthWrite: false, transparent: true, opacity: .55, blending: THREE.AdditiveBlending })); halo.position.copy(ld); halo.scale.setScalar(30); halo.renderOrder = -9; g.add(halo);
  }
  E.add(g);
  return { g: g, actualizar: function (t, cam) { g.position.set(cam.x, 0, cam.z); mat.uniforms.uT.value = t; if (g.userData.estrellas) g.userData.estrellas.rotation.y = t * .004; } };
};
function texLuna() {
  var c = M.lienzo(128, 128), g = c.getContext('2d'), rnd = M.azar(5);
  var gr = g.createRadialGradient(56, 56, 4, 64, 64, 60); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(.85, '#e7e4d6'); gr.addColorStop(1, 'rgba(220,220,210,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 58, 0, 6.283); g.fill();
  for (var i = 0; i < 14; i++) { g.fillStyle = 'rgba(150,150,140,' + (.12 + rnd() * .16) + ')'; g.beginPath(); g.arc(30 + rnd() * 68, 30 + rnd() * 68, 3 + rnd() * 11, 0, 6.283); g.fill(); }
  return M.tex(c, true, false);
}
})();

;
/* Ruway — LOS MUNDOS. muros.js: las paredes de cada mundo (laberinto, y los bordes de los otros juegos).

   Un tramo de pared mide 1 de largo (de x = −0,5 a 0,5), está centrado en z = 0 y apoyado en y = 0.
   Cada mundo arma unas pocas VARIANTES de tramo (para que no se repita igual) y un PILAR para los cruces.
   Un tramo puede tener varias partes con distinto material (la piedra y las florcitas que brillan);
   el laberinto pone cada parte en una InstancedMesh: todas las paredes son unas pocas llamadas de dibujo.

     inca ........ piedra almohadillada de muro inca, que se inclina hacia adentro, con ichu arriba
     totora ...... tres atados de totora amarrados, como el costado de un caballito
     adobe ....... barro de Chan Chan con frisos en relieve: red de rombos, peces y aves marinas
     casona ...... casonas trujillanas de colores: zócalo, cornisa blanca, ventana con reja o balcón
     piedraNoche . piedra azulada de noche, con florcitas que brillan
     follaje ..... seto de hojas grandes con heliconias y orquídeas */
(function () {
'use strict';
var M = window.Mundos;
var V3 = THREE.Vector3, M4 = THREE.Matrix4;

/* una caja "almohadillada": las caras de adelante y atrás se abultan hacia el centro (piedra inca) */
function piedra(w, h, t, bulto, rnd) {
  var g = new THREE.BoxGeometry(w, h, t, 3, 3, 1);
  return M.torcer(g, function (v) {
    var fx = 1 - Math.pow(Math.abs(v.x) / (w / 2), 2), fy = 1 - Math.pow(Math.abs(v.y) / (h / 2), 2);
    if (Math.abs(v.z) > t / 2 - 1e-4) v.z += Math.sign(v.z) * bulto * Math.max(0, fx) * Math.max(0, fy);
    /* las aristas un poco redondeadas: lo de la orilla se mete */
    v.x *= 1 - .04 * (1 - Math.max(0, fy)); v.y *= 1 - .03 * (1 - Math.max(0, fx));
    v.x += (rnd() - .5) * .006; v.y += (rnd() - .5) * .006;
  });
}
/* matojos de ichu: conos finitos, amarillo paja, inclinados */
function ichu(J, x, y, z, rnd, col) {
  var n = 12 + (rnd() * 6 | 0);
  for (var k = 0; k < n; k++) {
    var h = .07 + rnd() * .09, c = new THREE.ConeGeometry(.006 + rnd() * .004, h, 3); c.translate(0, h / 2, 0);
    var m = new M4().makeRotationFromEuler(new THREE.Euler((rnd() - .5) * 1.3, rnd() * 6, (rnd() - .5) * 1.3)).setPosition(x + (rnd() - .5) * .05, y, z + (rnd() - .5) * .05);
    J.pieza(c, M.mezclaCol(col, M.col('#8f7a3c'), rnd() * .55), m);
  }
}

/* ---------- texturas propias de las paredes ---------- */
var TX = {};
/* totora: fibras largas en el sentido del atado, con nudos y tonos de paja */
function texTotora() {
  if (TX.totora) return TX.totora;
  var W = 256, H = 64, c = M.lienzo(W, H), g = c.getContext('2d'), rnd = M.azar(21);
  g.fillStyle = '#d9c28a'; g.fillRect(0, 0, W, H);
  for (var i = 0; i < 260; i++) { var y = rnd() * H, k = 150 + rnd() * 105 | 0; g.strokeStyle = 'rgba(' + k + ',' + (k * .86 | 0) + ',' + (k * .55 | 0) + ',' + (.35 + rnd() * .5) + ')'; g.lineWidth = .8 + rnd() * 1.6;
    g.beginPath(); g.moveTo(0, y); for (var x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x * .03 + i) * 1.2); g.stroke(); }
  for (i = 0; i < 40; i++) { g.fillStyle = 'rgba(90,64,30,' + (.15 + rnd() * .2) + ')'; g.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 1); }
  return (TX.totora = M.tex(c, true, true));
}
/* el friso de Chan Chan en un tramo de 1 × alto: abajo liso, la red de rombos en el medio y una hilera
   de peces y aves arriba. Devuelve color y relieve (para el bumpMap). */
function texAdobe() {
  if (TX.adobe) return TX.adobe;
  var W = 512, H = 480, rnd = M.azar(33), rr = M.ruido(16, rnd), r2 = M.ruido(64, rnd);
  var alto = M.lienzo(W, H), ga = alto.getContext('2d');
  ga.fillStyle = '#7a7a7a'; ga.fillRect(0, 0, W, H);
  function marco(y0, y1) { ga.fillStyle = '#9a9a9a'; ga.fillRect(0, y0, W, 8); ga.fillRect(0, y1 - 8, W, 8); ga.fillStyle = '#5a5a5a'; ga.fillRect(0, y0 + 8, W, 3); ga.fillRect(0, y1 - 11, W, 3); }
  /* la red de rombos (la "red de pescar" de los muros de Chan Chan) */
  var y0 = 130, y1 = 300; marco(y0, y1);
  ga.save(); ga.beginPath(); ga.rect(0, y0 + 12, W, y1 - y0 - 24); ga.clip();
  ga.strokeStyle = '#a6a6a6'; ga.lineWidth = 9; var paso = 64;
  for (var x = -H; x < W + H; x += paso) { ga.beginPath(); ga.moveTo(x, y0); ga.lineTo(x + (y1 - y0), y1); ga.stroke(); ga.beginPath(); ga.moveTo(x, y1); ga.lineTo(x + (y1 - y0), y0); ga.stroke(); }
  ga.strokeStyle = '#555'; ga.lineWidth = 3;
  for (x = -H; x < W + H; x += paso) { ga.beginPath(); ga.moveTo(x + 6, y0); ga.lineTo(x + 6 + (y1 - y0), y1); ga.stroke(); }
  ga.restore();
  /* peces y aves marinas, alternados, en sus casilleros */
  var z0 = 318, z1 = 460; marco(z0, z1);
  for (var k = 0; k < 4; k++) {
    var cx = 64 + k * 128, cy = (z0 + z1) / 2;
    ga.fillStyle = '#5c5c5c'; ga.fillRect(cx - 58, z0 + 14, 116, z1 - z0 - 28);
    ga.save(); ga.translate(cx, cy); ga.fillStyle = '#a8a8a8';
    if (k % 2 === 0) {      /* pez: cuerpo de rombo, cola y un ojo */
      ga.beginPath(); ga.moveTo(-40, 0); ga.lineTo(-6, -24); ga.lineTo(28, 0); ga.lineTo(-6, 24); ga.closePath(); ga.fill();
      ga.beginPath(); ga.moveTo(26, 0); ga.lineTo(46, -18); ga.lineTo(46, 18); ga.closePath(); ga.fill();
      ga.fillStyle = '#5c5c5c'; ga.beginPath(); ga.arc(-20, -4, 5, 0, 6.283); ga.fill();
    } else {                /* ave marina (pelícano) de perfil, escalonada */
      ga.fillRect(-34, -6, 52, 18); ga.fillRect(-14, -26, 14, 24); ga.fillRect(-14, -30, 40, 9); ga.fillRect(18, 12, 8, 18); ga.fillRect(-6, 12, 8, 18);
      ga.beginPath(); ga.moveTo(-34, -6); ga.lineTo(-48, 4); ga.lineTo(-34, 12); ga.fill();
    }
    ga.restore();
  }
  /* abajo: un zócalo liso con desgaste; todo con poros y grietas finas */
  marco(40, 120);
  var im = ga.getImageData(0, 0, W, H);
  for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) { var i = (yy * W + xx) * 4, n = (rr(xx / 32, yy / 32) - .5) * 26 + (r2(xx / 4, yy / 4) - .5) * 18; im.data[i] = im.data[i + 1] = im.data[i + 2] = M.lim(im.data[i] + n, 0, 255); }
  ga.putImageData(im, 0, 0);
  /* color: barro con luz de arriba (el relieve también se pinta un poco, para que se lea de lejos) */
  var col = M.lienzo(W, H), gc = col.getContext('2d'), imc = gc.createImageData(W, H), ia = ga.getImageData(0, 0, W, H).data;
  for (yy = 0; yy < H; yy++) for (xx = 0; xx < W; xx++) {
    var j = (yy * W + xx) * 4, h0 = ia[j] / 255, hU = ia[((Math.max(0, yy - 2)) * W + xx) * 4] / 255, luz = M.lim(1 + (h0 - hU) * 2.2, .7, 1.25), n2 = .92 + rr(xx / 20 + 3, yy / 20) * .16;
    imc.data[j] = M.lim(214 * luz * n2 * (.85 + h0 * .25), 0, 255); imc.data[j + 1] = M.lim(176 * luz * n2 * (.85 + h0 * .25), 0, 255); imc.data[j + 2] = M.lim(132 * luz * n2 * (.85 + h0 * .25), 0, 255); imc.data[j + 3] = 255;
  }
  gc.putImageData(imc, 0, 0);
  var tc = M.tex(col, true, false), th = M.tex(alto, false, false);
  return (TX.adobe = { color: tc, relieve: th });
}
/* hojas tropicales grandes (alfa), en tonos de verde con su nervio */
function texHojas() {
  if (TX.hojas) return TX.hojas;
  var N = 256, c = M.lienzo(N, N), g = c.getContext('2d'), rnd = M.azar(91);
  g.clearRect(0, 0, N, N);
  for (var i = 0; i < 26; i++) {
    var a = rnd() * 6.283, d = Math.sqrt(rnd()) * 92, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, l = 30 + rnd() * 26, k = rnd();
    var cl = k < .4 ? [46, 120, 52] : k < .75 ? [70, 150, 60] : [110, 170, 70];
    g.save(); g.translate(x, y); g.rotate(rnd() * 6.283);
    var gr = g.createLinearGradient(-l, 0, l, 0); gr.addColorStop(0, 'rgb(' + (cl[0] * .7 | 0) + ',' + (cl[1] * .7 | 0) + ',' + (cl[2] * .7 | 0) + ')'); gr.addColorStop(1, 'rgb(' + cl.join(',') + ')');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * .42, l, 0); g.quadraticCurveTo(0, l * .42, -l, 0); g.fill();
    g.strokeStyle = 'rgba(220,240,180,.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke();
    g.lineWidth = .8; for (var s = -l * .7; s < l * .8; s += 7) { g.beginPath(); g.moveTo(s, 0); g.lineTo(s + 6, -l * .25); g.moveTo(s, 0); g.lineTo(s + 6, l * .25); g.stroke(); }
    g.restore();
  }
  return (TX.hojas = M.tex(c, true, false));
}

/* ---------- los armadores: cada uno devuelve { alto, grosor, variantes:[[{geo,mat}]], pilar:[{geo,mat}] } ---------- */
var ARMAR = {};

/* piedras poligonales de muro inca: las hiladas no son rectas (los bordes suben y bajan), las juntas
   van inclinadas y cada piedra es un prisma con el canto redondeado (bisel), separado por una junta oscura */
function piedrasInca(J, ancho, H, T, filas, rnd, paleta, liquen) {
  function linea(y, salto) { var nodos = []; for (var x = -.5; x <= .5001; x += .2 + rnd() * .12) nodos.push([x, y + (rnd() - .5) * salto]); nodos[nodos.length - 1][0] = .5; nodos[0][0] = -.5; return nodos; }
  function altura(l, x) { for (var i = 1; i < l.length; i++) if (x <= l[i][0]) { var t = (x - l[i - 1][0]) / (l[i][0] - l[i - 1][0] || 1); return l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t; } return l[l.length - 1][1]; }
  var lineas = [linea(0, 0)], y = 0;
  filas.forEach(function (hf, fi) { y += hf; lineas.push(fi === filas.length - 1 ? linea(H, .02) : linea(y, .06)); });
  filas.forEach(function (hf, fi) {
    var abajo = lineas[fi], arriba = lineas[fi + 1], x = -.5, prof = T * (1 - fi * .08);
    var cortes = [[-.5, -.5]];
    while (x < .5) { var w = .14 + rnd() * .22; x += w; if (x > .4) x = .5; var incl = x >= .5 ? 0 : (rnd() - .5) * .07; cortes.push([x, Math.min(.5, Math.max(-.5, x + incl))]); }
    for (var k = 0; k + 1 < cortes.length; k++) {
      var xb0 = cortes[k][0], xt0 = cortes[k][1], xb1 = cortes[k + 1][0], xt1 = cortes[k + 1][1];
      var pts = [[xb0, altura(abajo, xb0)]];
      abajo.forEach(function (n) { if (n[0] > xb0 + .02 && n[0] < xb1 - .02) pts.push([n[0], n[1]]); });
      pts.push([xb1, altura(abajo, xb1)], [xt1, altura(arriba, xt1)]);
      arriba.slice().reverse().forEach(function (n) { if (n[0] < xt1 - .02 && n[0] > xt0 + .02) pts.push([n[0], n[1]]); });
      pts.push([xt0, altura(arriba, xt0)]);
      /* se encoge hacia su centro: queda la junta */
      var cx = 0, cy = 0; pts.forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= pts.length; cy /= pts.length;
      var sh = new THREE.Shape(); pts.forEach(function (q, i) { var dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1, px = q[0] - dx / l * .015, py = q[1] - dy / l * .015; if (i) sh.lineTo(px, py); else sh.moveTo(px, py); });
      var g = new THREE.ExtrudeGeometry(sh, { depth: prof - .04, bevelEnabled: true, bevelSize: .016, bevelThickness: .022, bevelSegments: 2, curveSegments: 1 });
      g.translate(0, 0, -(prof - .04) / 2);
      var c = M.col(paleta[rnd() * paleta.length | 0], .88 + rnd() * .22);
      if (liquen && rnd() < .28) c = M.mezclaCol(c, M.col(liquen), .2 + rnd() * .25);
      J.pieza(g, c, null, 2.4);
    }
  });
}
ARMAR.inca = function (o) {
  var H = .8, T = .26, rnd = M.azar(o.sem || 3);
  var paleta = o.noche ? ['#5a6a92', '#66769d', '#7484a8', '#53628a', '#6a7397'] : ['#857b6b', '#948a78', '#77705f', '#9e927e', '#807667', '#8d8172', '#a09888'];
  var gr = M.texGrano(5, .42), mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: gr, bumpMap: gr, bumpScale: .025, roughness: .95, metalness: 0 });
  var matPaja = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  var matBrillo = o.noche ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) : null;
  function variante(sem) {
    var r = M.azar(sem), J = new M.Junta(), JP = new M.Junta(), JB = matBrillo ? new M.Junta() : null;
    J.caja(1.0, H - .03, T * .62, 0, (H - .03) / 2, 0, M.col(o.noche ? '#111629' : '#3a352e'), null, 2);    /* el alma oscura: se ve en las juntas */
    piedrasInca(J, 1, H, T, [.3, .27, .23], r, paleta, o.noche ? '#4f7a8a' : '#7f8a5c');
    for (var k = 0; k < 4; k++) ichu(JP, -.42 + k * .28 + (r() - .5) * .1, H - .01, (r() - .5) * .08, r, M.col(o.noche ? '#7d8fb5' : '#d9bf6e'));
    if (JB) for (k = 0; k < 8; k++) { var s = new THREE.SphereGeometry(.011 + r() * .01, 5, 4), lado = r() < .5 ? -1 : 1; JB.pieza(s, M.col(['#9fe9ff', '#ffd7f6', '#d4ffb8'][k % 3], 1.6), new M4().makeTranslation(-.45 + r() * .9, .04 + r() * (H - .1), lado * (T / 2 + .015))); }
    var partes = [{ geo: J.geometria({ oscuroAbajo: [.66, .32] }), mat: mat }, { geo: JP.geometria(), mat: matPaja }];
    if (JB) partes.push({ geo: JB.geometria(), mat: matBrillo, sinSombra: true });
    return partes;
  }
  var J = new M.Junta(), sh = new THREE.Shape(); sh.moveTo(-.15, 0); sh.lineTo(.15, 0); sh.lineTo(.13, H + .08); sh.lineTo(-.14, H + .1); sh.lineTo(-.15, 0);
  var g = new THREE.ExtrudeGeometry(sh, { depth: .26, bevelEnabled: true, bevelSize: .02, bevelThickness: .025, bevelSegments: 2, curveSegments: 1 }); g.translate(0, 0, -.13);
  J.pieza(g, M.col(paleta[0], 1.05), null, 2.4);
  return { alto: H, grosor: T, variantes: [variante(11), variante(12), variante(13)], pilar: [{ geo: J.geometria({ oscuroAbajo: [.66, .4] }), mat: mat }] };
};
ARMAR.piedraNoche = function (o) { return ARMAR.inca(Object.assign({}, o, { noche: true })); };

ARMAR.totora = function (o) {
  var H = .72, T = .26, rnd = M.azar(o.sem || 5), tx = texTotora();
  var mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tx, roughness: .9 });
  var matAmarre = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 });
  function atado(J, JA, y, r, largo, r0) {
    var g = new THREE.CylinderGeometry(r, r, largo, 14, 6, false); g.rotateZ(Math.PI / 2);
    M.torcer(g, function (v) { var t = v.x / (largo / 2); v.y += -.012 * (1 - t * t); v.z += Math.sin(v.x * 9 + y * 10) * .004; });
    g.userData.uvPropio = true;
    var c = M.col('#d8bf86', .9 + r0() * .15);
    J.pieza(g, c, new M4().makeTranslation(0, y, 0));
    [-.3, 0.04, .32].forEach(function (x) { var a = new THREE.CylinderGeometry(r + .012, r + .012, .045, 14); a.rotateZ(Math.PI / 2); JA.pieza(a, M.col('#6d4d2a', .9 + r0() * .2), new M4().makeTranslation(x + (r0() - .5) * .04, y - .006, 0)); });
  }
  function variante(sem) {
    var r = M.azar(sem), J = new M.Junta(), JA = new M.Junta();
    atado(J, JA, .13, .13, 1.04, r); atado(J, JA, .37, .12, 1.04, r); atado(J, JA, .59, .1, 1.02, r);
    /* algunas puntas sueltas arriba */
    for (var k = 0; k < 10; k++) { var p = new THREE.CylinderGeometry(.004, .006, .1 + r() * .1, 3); p.translate(0, .06, 0);
      J.pieza(p, M.col('#cdb175'), new M4().makeRotationFromEuler(new THREE.Euler((r() - .5) * .8, 0, (r() - .5) * .8)).setPosition(-.45 + r() * .9, .66, (r() - .5) * .1)); }
    return [{ geo: J.geometria({ oscuroAbajo: [.7, .25] }), mat: mat }, { geo: JA.geometria(), mat: matAmarre }];
  }
  /* pilar: un caballito de totora parado (así se secan en la playa de Huanchaco) */
  var J = new M.Junta(), JA = new M.Junta(), alto = H + .22, perf = [];
  for (var i = 0; i <= 10; i++) { var t = i / 10; perf.push(new THREE.Vector2(.03 + Math.sin(Math.min(1, t * 1.1) * Math.PI) * .1 * (1 - t * .45), t * alto)); }
  var cab = new THREE.LatheGeometry(perf, 12); cab.userData.uvPropio = true;
  J.pieza(cab, M.col('#d2b67c'), new M4().makeRotationZ(.08));
  [.2, .45, .7].forEach(function (y) { var a = new THREE.TorusGeometry(.12 - y * .05, .012, 5, 14); a.rotateX(Math.PI / 2); JA.pieza(a, M.col('#6d4d2a'), new M4().makeRotationZ(.08).multiply(new M4().makeTranslation(0, y * alto * .9, 0))); });
  return { alto: H, grosor: T, variantes: [variante(21), variante(22), variante(23)], pilar: [{ geo: J.geometria({ oscuroAbajo: [.75, .3] }), mat: mat }, { geo: JA.geometria(), mat: matAmarre }] };
};

ARMAR.adobe = function (o) {
  var H = .95, T = .26, rnd = M.azar(o.sem || 7), tx = texAdobe();
  var mat = new THREE.MeshStandardMaterial({ map: tx.color, bumpMap: tx.relieve, bumpScale: .028, roughness: 1, vertexColors: true });
  var matLiso = new THREE.MeshStandardMaterial({ map: M.texGrano(9, .35), roughness: 1, vertexColors: true });
  function variante(sem) {
    var r = M.azar(sem), J = new M.Junta(), JL = new M.Junta();
    /* las dos caras con el friso (uv propias: el dibujo entra justo en un tramo) */
    var g = new THREE.BoxGeometry(1.0, H, T, 6, 4, 1); g.translate(0, H / 2, 0);
    M.torcer(g, function (v) { if (v.y > H - .01) v.y += (r() - .5) * .05; var t = 1 - v.y / H; v.z *= 1 + t * .1; });   /* arriba gastado; abajo un poco más ancho */
    g.userData.uvPropio = true; J.pieza(g, M.col('#ffffff', .95 + r() * .08));
    /* el borde de arriba, irregular, sin dibujo */
    var c = new THREE.BoxGeometry(1.02, .06, T * .92, 5, 1, 1); c.translate(0, H + .02, 0); M.torcer(c, function (v) { v.y += (r() - .5) * .03; v.z *= .9 + r() * .15; });
    JL.pieza(c, M.col('#b99266', .95 + r() * .1), null, 3);
    return [{ geo: J.geometria({ oscuroAbajo: [.78, .3] }), mat: mat }, { geo: JL.geometria(), mat: matLiso }];
  }
  /* pilar: un contrafuerte más ancho con remate escalonado */
  var J = new M.Junta();
  J.caja(.36, H + .1, .36, 0, (H + .1) / 2, 0, M.col('#c49b70'), null, 3);
  J.caja(.28, .08, .28, 0, H + .14, 0, M.col('#b78f66'), null, 3); J.caja(.18, .07, .18, 0, H + .21, 0, M.col('#ad865e'), null, 3);
  return { alto: H, grosor: T, variantes: [variante(31), variante(32), variante(33)], pilar: [{ geo: J.geometria({ oscuroAbajo: [.75, .35] }), mat: matLiso }] };
};

ARMAR.casona = function (o) {
  var H = .96, T = .22, colores = ['#e9b949', '#3e6fb0', '#c9443b', '#6fb3a0', '#d9774a'];
  var mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(13, .18), roughness: .92 });
  var matHierro = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .35 });
  var BL = M.col('#f4efe3'), OSC = M.col('#2a2724'), MAD = M.col('#7d4b2a');
  function frente(J, JH, lado, col, tipo, r) {
    var z = lado * (T / 2), s = lado;
    J.caja(1.0, .12, .02, 0, .06, z + s * .01, M.col(col, .62), null, 3);                       /* zócalo */
    J.caja(1.04, .05, .06, 0, H - .03, z + s * .02, BL, null, 3); J.caja(1.0, .03, .04, 0, H - .08, z + s * .015, BL, null, 3);   /* cornisa */
    if (tipo === 'puerta') {
      J.caja(.36, .62, .02, 0, .43, z + s * .012, OSC, null, 3);
      J.caja(.32, .58, .03, 0, .41, z + s * .02, MAD, null, 3);
      J.caja(.44, .05, .04, 0, .76, z + s * .02, BL, null, 3); J.caja(.05, .66, .04, -.2, .43, z + s * .02, BL, null, 3); J.caja(.05, .66, .04, .2, .43, z + s * .02, BL, null, 3);
    } else {
      var yv = tipo === 'balcon' ? .5 : .32, hv = tipo === 'balcon' ? .3 : .36;
      J.caja(.3, hv, .02, 0, yv + hv / 2, z + s * .01, OSC, null, 3);
      J.caja(.38, .04, .05, 0, yv - .01, z + s * .025, BL, null, 3); J.caja(.38, .04, .05, 0, yv + hv + .02, z + s * .025, BL, null, 3);
      J.caja(.04, hv + .06, .05, -.17, yv + hv / 2, z + s * .025, BL, null, 3); J.caja(.04, hv + .06, .05, .17, yv + hv / 2, z + s * .025, BL, null, 3);
      if (tipo === 'balcon') {   /* balcón de cajón de madera */
        J.caja(.46, .2, .12, 0, yv + .02, z + s * .07, MAD, null, 3); J.caja(.5, .03, .14, 0, yv + .13, z + s * .07, M.col('#5c3520'), null, 3); J.caja(.5, .03, .14, 0, yv - .09, z + s * .07, M.col('#5c3520'), null, 3);
        for (var k = 0; k < 5; k++) J.caja(.012, .16, .01, -.18 + k * .09, yv + .02, z + s * .135, M.col('#3d2717'), null, 3);
      } else {                   /* reja de hierro forjado */
        for (k = 0; k < 6; k++) JH.caja(.012, hv - .02, .012, -.125 + k * .05, yv + hv / 2, z + s * .045, OSC, null, 3);
        JH.caja(.28, .012, .012, 0, yv + hv * .3, z + s * .045, OSC, null, 3); JH.caja(.28, .012, .012, 0, yv + hv * .75, z + s * .045, OSC, null, 3);
      }
    }
  }
  var variantes = [];
  colores.forEach(function (col, ci) {
    ['ventana', 'balcon'].forEach(function (tipo, ti) {
      var r = M.azar(40 + ci * 3 + ti), J = new M.Junta(), JH = new M.Junta();
      J.caja(1.0, H, T, 0, H / 2, 0, M.col(col), null, 3);
      J.caja(1.0, .02, T - .02, 0, H + .005, 0, M.col('#b5643c', .9 + r() * .15), null, 3);   /* el techo: ladrillo pastelero */
      frente(J, JH, 1, col, tipo, r); frente(J, JH, -1, col, (ci + ti) % 3 === 0 ? 'puerta' : (ti ? 'ventana' : 'balcon'), r);
      var partes = [{ geo: J.geometria({ oscuroAbajo: [.8, .4] }), mat: mat }];
      if (JH.base) partes.push({ geo: JH.geometria(), mat: matHierro });
      variantes.push(partes);
    });
  });
  /* pilar: pilastra blanca con su capitel */
  var J = new M.Junta(); J.caja(.24, H + .03, .24, 0, (H + .03) / 2, 0, BL, null, 3); J.caja(.28, .05, .28, 0, H + .045, 0, BL, null, 3); J.caja(.27, .1, .27, 0, .05, 0, M.col('#cfc6b2'), null, 3);
  return { alto: H, grosor: T, variantes: variantes, pilar: [{ geo: J.geometria({ oscuroAbajo: [.8, .4] }), mat: mat }], farol: true };
};

ARMAR.follaje = function (o) {
  var H = .92, T = .3, tx = texHojas();
  var matAlma = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(17, .4), roughness: 1 });
  var matHoja = new THREE.MeshStandardMaterial({ vertexColors: true, map: tx, alphaTest: .45, side: THREE.DoubleSide, roughness: .75 });
  var matFlor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 });
  function hoja(J, x, y, z, s, r, giroY) {
    var g = new THREE.PlaneGeometry(s, s, 2, 2); M.torcer(g, function (v) { v.z += (v.x * v.x + v.y * v.y) * .25; });
    g.userData.uvPropio = true;
    J.pieza(g, M.col('#ffffff', .78 + r() * .3), new M4().makeRotationFromEuler(new THREE.Euler((r() - .5) * 1.1, giroY + (r() - .5) * .9, (r() - .5) * 1.4)).setPosition(x, y, z));
  }
  function variante(sem) {
    var r = M.azar(sem), JA = new M.Junta(), JH = new M.Junta(), JF = new M.Junta();
    JA.caja(1.0, H * .92, T * .62, 0, H * .46, 0, M.col('#1f4a24'), null, 2);
    for (var k = 0; k < 28; k++) { var lado = k % 2 ? 1 : -1, x = -.48 + r() * .96, y = .08 + r() * (H - .1); hoja(JH, x, y, lado * (T * .31 + r() * .025), .17 + r() * .14, r, lado > 0 ? 0 : Math.PI); }
    for (k = 0; k < 6; k++) hoja(JH, -.45 + r() * .9, H - .02 + r() * .05, (r() - .5) * .14, .18 + r() * .12, r, r() * 6);
    /* heliconias (pinzas rojas y amarillas en zigzag) y alguna orquídea */
    for (k = 0; k < 3; k++) {
      var fx = -.38 + r() * .76, fz = (r() < .5 ? -1 : 1) * (T * .38), fy = .3 + r() * .45;
      for (var p = 0; p < 4; p++) { var c = new THREE.ConeGeometry(.026, .1, 4); c.rotateZ(p % 2 ? 1.2 : -1.2); JF.pieza(c, M.col(p % 2 ? '#ffd23c' : '#e8332a'), new M4().makeTranslation(fx + (p % 2 ? .03 : -.03), fy - p * .055, fz)); }
    }
    if (r() < .7) { var or = new THREE.SphereGeometry(.03, 6, 5); or.scale(1, .6, 1); JF.pieza(or, M.col('#ff7bc8'), new M4().makeTranslation(-.3 + r() * .6, .2 + r() * .5, (r() < .5 ? -1 : 1) * T * .42)); }
    return [{ geo: JA.geometria({ oscuroAbajo: [.6, .4] }), mat: matAlma }, { geo: JH.geometria({ oscuroAbajo: [.62, .5] }), mat: matHoja, sinSombra: true }, { geo: JF.geometria(), mat: matFlor, sinSombra: true }];
  }
  /* pilar: un tronco con una liana y su copa */
  var r = M.azar(55), J = new M.Junta(), JH = new M.Junta(), alto = H + .28;
  var tr = new THREE.CylinderGeometry(.07, .12, alto, 8, 4); tr.translate(0, alto / 2, 0); M.torcer(tr, function (v) { v.x += Math.sin(v.y * 4) * .02; });
  J.pieza(tr, M.col('#5a4330'), null, 4);
  for (var k = 0; k < 6; k++) hoja(JH, (r() - .5) * .25, alto - .03 + r() * .08, (r() - .5) * .25, .22 + r() * .12, r, r() * 6);
  return { alto: H, grosor: T, variantes: [variante(61), variante(62), variante(63)], pilar: [{ geo: J.geometria({ oscuroAbajo: [.6, .4] }), mat: matAlma }, { geo: JH.geometria(), mat: matHoja, sinSombra: true }] };
};

/* seto recortado de la Plaza de Armas: verde tupido, con su sardinel amarillo abajo (como los de la plaza)
   y algunas flores encima; en los cruces, un cubo de seto con una bola recortada */
function texSeto() {
  if (TX.seto) return TX.seto;
  var N = 256, c = M.lienzo(N, N), g = c.getContext('2d'), rnd = M.azar(73);
  g.fillStyle = '#2f5a2a'; g.fillRect(0, 0, N, N);
  for (var i = 0; i < 5200; i++) { var k = rnd(), col = k < .3 ? '#24481f' : k < .65 ? '#3c6e32' : k < .9 ? '#4f8a3e' : '#6aa64e';
    g.fillStyle = col; g.save(); g.translate(rnd() * N, rnd() * N); g.rotate(rnd() * 6.283); g.beginPath(); g.ellipse(0, 0, 2.5 + rnd() * 3, 1.3 + rnd() * 1.5, 0, 0, 6.283); g.fill(); g.restore(); }
  return (TX.seto = M.tex(c, true, true));
}
ARMAR.seto = function (o) {
  var H = .78, T = .34, tx = texSeto();
  var mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tx, bumpMap: tx, bumpScale: .03, roughness: .95 });
  var matCurb = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(81, .2), roughness: .8 });
  var matFlor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 });
  function variante(sem) {
    var r = M.azar(sem), J = new M.Junta(), JC = new M.Junta(), JF = new M.Junta();
    var g = new THREE.BoxGeometry(1.0, H - .1, T, 8, 4, 2); g.translate(0, .1 + (H - .1) / 2, 0);
    M.torcer(g, function (v) { var t = (v.y - .1) / (H - .1); if (t > .85) { var k = (t - .85) / .15; v.z *= 1 - k * .12; } v.z += (r() - .5) * .012; v.y += t > .99 ? (r() - .5) * .015 : 0; });
    J.pieza(g, M.col('#ffffff', .85 + r() * .25), null, 2.5);
    JC.caja(1.02, .12, T + .1, 0, .06, 0, M.col('#e2b62e'), null, 3);                       /* el sardinel amarillo */
    if (r() < .55) for (var k = 0; k < 5; k++) { var f = new THREE.SphereGeometry(.03, 6, 5); f.scale(1, .7, 1);
      JF.pieza(f, M.col(['#ff5c8a', '#ffffff', '#ffd23c', '#e8332a'][(sem + k) % 4]), new M4().makeTranslation(-.4 + r() * .8, H + .005, (r() - .5) * T * .7)); }
    var partes = [{ geo: J.geometria({ oscuroAbajo: [.55, .45] }), mat: mat }, { geo: JC.geometria(), mat: matCurb }];
    if (JF.base) partes.push({ geo: JF.geometria(), mat: matFlor, sinSombra: true });
    return partes;
  }
  var J = new M.Junta(), JC = new M.Junta();
  var cubo = new THREE.BoxGeometry(.4, H - .02, .4, 2, 3, 2); cubo.translate(0, .1 + (H - .12) / 2, 0); J.pieza(cubo, M.col('#ffffff', .9), null, 2.5);
  var bola = new THREE.IcosahedronGeometry(.17, 2); bola.translate(0, H + .17, 0); J.pieza(bola, M.col('#ffffff', 1.05), null, 2.5);
  JC.caja(.48, .12, .48, 0, .06, 0, M.col('#e2b62e'), null, 3);
  return { alto: H, grosor: T, variantes: [variante(91), variante(92), variante(93)], pilar: [{ geo: J.geometria({ oscuroAbajo: [.55, .45] }), mat: mat }, { geo: JC.geometria(), mat: matCurb }], farol: true };
};

/* el juego pide: Mundos.muros(mundo) → { alto, grosor, variantes, pilar, farol } (se arma una vez y se guarda) */
var HECHOS = {};
M.muros = function (mundo) { return HECHOS[mundo.muro] || (HECHOS[mundo.muro] = ARMAR[mundo.muro]({ sem: mundo.id.length })); };
})();

;
/* Ruway — LOS MUNDOS. suelo.js: el piso de cada mundo y lo que hay sembrado encima.
   El piso es una malla grande con manchas suaves pintadas en los vértices (para que no se vea la
   repetición de la textura) y se pierde en la neblina. Lo sembrado (ichu, conchas, piedritas,
   helechos) va en InstancedMesh: cientos de matas en una llamada de dibujo. */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4;
var TX = {};

/* ---------- texturas de piso (512 px, se repiten) ---------- */
function pintarRuido(g, N, base, cols, n, rnd, trazo) {
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (var k = 0; k < n; k++) { g.fillStyle = cols[rnd() * cols.length | 0]; g.globalAlpha = .35 + rnd() * .45; trazo(g, rnd() * N, rnd() * N, rnd); }
  g.globalAlpha = 1;
}
var PISOS = {
  puna: function (g, N, rnd) {
    pintarRuido(g, N, '#6e8a40', ['#5f7b36', '#82984b', '#a39f58', '#55702f', '#b5a465', '#8c8a4a'], 18000, rnd, function (g, x, y, r) { g.save(); g.translate(x, y); g.rotate((r() - .5) * .8); g.fillRect(0, 0, 1.2, 4 + r() * 4); g.restore(); });
    for (var i = 0; i < 26; i++) { g.fillStyle = 'rgba(120,96,64,' + (.2 + rnd() * .25) + ')'; g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 6 + rnd() * 18, 4 + rnd() * 10, rnd() * 3, 0, 6.283); g.fill(); }
  },
  arena: function (g, N, rnd) {
    pintarRuido(g, N, '#e7cfa0', ['#d9bd8a', '#f1dcb2', '#cfb07c', '#f6e6c4'], 9000, rnd, function (g, x, y) { g.fillRect(x, y, 1.5, 1.5); });
    g.strokeStyle = 'rgba(160,124,80,.18)'; g.lineWidth = 2;
    for (var y = 0; y < N; y += 14) { g.beginPath(); for (var x = 0; x <= N; x += 8) g.lineTo(x, y + Math.sin(x * .04 + y * .3) * 4); g.stroke(); }
  },
  tierra: function (g, N, rnd) {
    pintarRuido(g, N, '#d2b088', ['#c39f76', '#dfc19a', '#b8946b', '#e6cba6'], 10000, rnd, function (g, x, y) { g.fillRect(x, y, 2, 2); });
    g.strokeStyle = 'rgba(120,88,56,.35)'; g.lineWidth = 1.2;
    for (var i = 0; i < 40; i++) { var x = rnd() * N, y = rnd() * N; g.beginPath(); g.moveTo(x, y); for (var k = 0; k < 5; k++) { x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
    for (i = 0; i < 120; i++) { g.fillStyle = 'rgba(' + (120 + rnd() * 60 | 0) + ',' + (100 + rnd() * 40 | 0) + ',80,.6)'; g.beginPath(); g.arc(rnd() * N, rnd() * N, 1 + rnd() * 2.5, 0, 6.283); g.fill(); }
  },
  losas: function (g, N, rnd) {
    g.fillStyle = '#5d554c'; g.fillRect(0, 0, N, N);
    for (var i = 0; i < 1400; i++) {
      var x = rnd() * N, y = rnd() * N, r = 6 + rnd() * 7, k = .8 + rnd() * .35, t = rnd(), col = t < .5 ? [168, 158, 142] : t < .8 ? [184, 166, 144] : [150, 146, 140];
      g.fillStyle = 'rgb(' + (col[0] * k | 0) + ',' + (col[1] * k | 0) + ',' + (col[2] * k | 0) + ')';
      g.beginPath(); g.ellipse(x, y, r, r * (.7 + rnd() * .3), rnd() * 3, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(x - r * .2, y - r * .25, r * .5, r * .35, 0, 0, 6.283); g.fill();
    }
  },
  escarcha: function (g, N, rnd) {
    pintarRuido(g, N, '#2c3d4c', ['#253545', '#34485a', '#3d5463', '#20303d'], 14000, rnd, function (g, x, y, r) { g.save(); g.translate(x, y); g.rotate((r() - .5)); g.fillRect(0, 0, 1.2, 4 + r() * 3); g.restore(); });
    for (var i = 0; i < 2600; i++) { g.fillStyle = 'rgba(220,235,255,' + (.25 + rnd() * .5) + ')'; g.fillRect(rnd() * N, rnd() * N, 1, 1); }
  },
  hojarasca: function (g, N, rnd) {
    pintarRuido(g, N, '#3e3021', ['#4a3a27', '#33281b', '#55442c'], 6000, rnd, function (g, x, y) { g.fillRect(x, y, 2, 2); });
    for (var i = 0; i < 420; i++) { var k = rnd(), col = k < .35 ? '#7a5a2a' : k < .6 ? '#5f6b2c' : k < .8 ? '#8a6a32' : '#4d5a26';
      g.save(); g.translate(rnd() * N, rnd() * N); g.rotate(rnd() * 6.283); g.fillStyle = col; g.globalAlpha = .7 + rnd() * .3; var l = 5 + rnd() * 8;
      g.beginPath(); g.moveTo(-l, 0); g.quadraticCurveTo(0, -l * .45, l, 0); g.quadraticCurveTo(0, l * .45, -l, 0); g.fill(); g.restore(); }
    g.globalAlpha = 1;
  }
};
function texPiso(tipo) {
  if (TX[tipo]) return TX[tipo];
  var N = 512, c = M.lienzo(N, N), g = c.getContext('2d'), rnd = M.azar(tipo.length * 13);
  PISOS[tipo](g, N, rnd);
  return (TX[tipo] = M.tex(c, true, true));
}
/* manchas grandes por vértice (lineal): cada piso con su paleta de manchas */
var MANCHAS = {
  puna: ['#ffffff', '#e2dcb0', '#c9c592', '#f0dca0', '#b9b884'], arena: ['#ffffff', '#f3e7d2', '#d8c3a0', '#cbb08a'], tierra: ['#ffffff', '#efe0c8', '#d9c09c'],
  losas: ['#ffffff', '#ece6dc', '#d8d0c4'], escarcha: ['#ffffff', '#c8d8ec', '#9fb6cf'], hojarasca: ['#ffffff', '#d6d0b8', '#b8b090']
};

/* ---------- lo sembrado ---------- */
function matojo(tipo, r) {
  var J = new M.Junta();
  if (tipo === 'ichu' || tipo === 'pastoNoche') {
    var n = 9, col = tipo === 'ichu' ? '#d3bb6f' : '#7d93b5';
    for (var k = 0; k < n; k++) { var h = .16 + r() * .14, c = new THREE.ConeGeometry(.014, h, 3); c.translate(0, h / 2, 0);
      J.pieza(c, M.mezclaCol(M.col(col), M.col(tipo === 'ichu' ? '#8e7838' : '#3c4c6e'), r() * .5), new M4().makeRotationFromEuler(new THREE.Euler((r() - .5) * 1, r() * 6, (r() - .5) * 1)).setPosition((r() - .5) * .06, 0, (r() - .5) * .06)); }
  } else if (tipo === 'piedrita') {
    var p = new THREE.DodecahedronGeometry(.05, 0); p.scale(1, .55, 1.2); p.translate(0, .015, 0); J.pieza(p, M.col('#9c958a', .8 + r() * .3));
  } else if (tipo === 'concha') {
    var s = new THREE.SphereGeometry(.035, 8, 4, 0, 6.283, 0, 1.4); s.scale(1, .45, 1.2); J.pieza(s, M.col(['#fff3e4', '#f6d2c0', '#efe0d0'][r() * 3 | 0]));
  } else if (tipo === 'arbusto') {
    for (k = 0; k < 6; k++) { var b = new THREE.IcosahedronGeometry(.06 + r() * .04, 0); b.translate((r() - .5) * .12, .05 + r() * .06, (r() - .5) * .12); J.pieza(b, M.col(['#8c8a4c', '#a29a58', '#757844'][k % 3])); }
  } else if (tipo === 'helecho') {
    for (k = 0; k < 7; k++) { var hp = new THREE.PlaneGeometry(.07, .34, 1, 3); hp.translate(0, .17, 0); M.torcer(hp, function (v) { v.z += v.y * v.y * .9; });
      J.pieza(hp, M.col(['#3f8a3a', '#57a046', '#2f7230'][k % 3]), new M4().makeRotationFromEuler(new THREE.Euler(-.5, k / 7 * 6.283 + r() * .4, 0))); }
  } else if (tipo === 'florcita') {
    var f = new THREE.SphereGeometry(.018, 5, 4); f.translate(0, .03, 0); J.pieza(f, M.col(['#a8f0ff', '#ffd6f4', '#d8ffbe'][r() * 3 | 0], 1.5));
  }
  return J.geometria();
}
var SIEMBRA = {
  puna: [{ t: 'ichu', n: 260 }, { t: 'piedrita', n: 70 }], arena: [{ t: 'concha', n: 120 }, { t: 'piedrita', n: 30 }],
  tierra: [{ t: 'piedrita', n: 120 }, { t: 'arbusto', n: 24 }], losas: [], escarcha: [{ t: 'pastoNoche', n: 200 }, { t: 'florcita', n: 90, brilla: true }],
  hojarasca: [{ t: 'helecho', n: 160 }]
};

/* para el planeta (que no es plano): la textura del piso, una mata suelta y qué se siembra en cada piso */
M.texSuelo = function (tipo) { return PISOS[tipo] ? texPiso(tipo) : null; };
M.matojo = function (tipo, r) { return matojo(tipo, r); };
M.SIEMBRA = SIEMBRA;

/* M.suelo(E, mundo, {cx, cz, r (radio de lo sembrado), libre(x,z) → true si se puede sembrar ahí,
                      tam, seg (tamaño y divisiones del piso), alto(x,z) → la altura del piso ahí (la carrera, con relieve)}) */
M.suelo = function (E, mundo, o) {
  var tipo = mundo.suelo, tx = texPiso(tipo); tx.repeat.set(30, 30);
  var G = new THREE.PlaneGeometry(o.tam || 140, o.tam || 140, o.seg || 48, o.seg || 48); G.rotateX(-Math.PI / 2);
  if (o.alto) { var PG = G.attributes.position; for (var iv = 0; iv < PG.count; iv++) PG.setY(iv, o.alto(PG.getX(iv) + o.cx, PG.getZ(iv) + o.cz)); G.computeVertexNormals(); }
  var rnd = M.azar(19), rr = M.ruido(8, rnd), man = MANCHAS[tipo].map(function (h) { return M.col(h); });
  M.pintar(G, function (v) { var n = rr(v.x / 14 + 3, v.z / 14 + 7), k = Math.min(man.length - 1.001, n * man.length); var a = man[k | 0], b = man[Math.min(man.length - 1, (k | 0) + 1)]; return M.mezclaCol(a, b, k % 1); });
  var piso = new THREE.Mesh(G, new THREE.MeshStandardMaterial({ map: tx, vertexColors: true, roughness: 1, metalness: 0 }));
  piso.position.set(o.cx, 0, o.cz); piso.receiveShadow = true; E.add(piso);
  /* lo sembrado */
  var mats = {};
  (SIEMBRA[tipo] || []).forEach(function (s, si) {
    if (M.calidad() === 'baja') s = { t: s.t, n: s.n >> 1, brilla: s.brilla };
    var r = M.azar(70 + si), geo = matojo(s.t, r), mat = s.brilla ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
      : (mats[s.t] || (mats[s.t] = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: s.t === 'helecho' ? THREE.DoubleSide : THREE.FrontSide })));
    var im = new THREE.InstancedMesh(geo, mat, s.n), m4 = new THREE.Object3D(), puestos = 0, intentos = 0;
    while (puestos < s.n && intentos < s.n * 8) {
      intentos++;
      var a = r() * 6.283, d = Math.sqrt(r()) * (o.r || 20), x = o.cx + Math.cos(a) * d, z = o.cz + Math.sin(a) * d;
      if (o.libre && !o.libre(x, z)) continue;
      m4.position.set(x, o.alto ? o.alto(x, z) : 0, z); m4.rotation.set(0, r() * 6.283, 0); m4.scale.setScalar(.7 + r() * .7); m4.updateMatrix(); im.setMatrixAt(puestos++, m4.matrix);
    }
    im.count = puestos; im.receiveShadow = true; E.add(im);
  });
  return { piso: piso };
};
})();

;
/* Ruway — LOS MUNDOS. lejos.js: lo que se ve a lo lejos en cada mundo.
     nevados ..... cordillera con nieve y un cerro con andenes
     mar ......... el mar de Huanchaco con su muelle y caballitos de totora parados en la playa
     dunas ....... dunas, cerros pálidos y algarrobos
     catedral .... casonas de colores alrededor, la catedral amarilla, palmeras y faroles (en la carrera, la catedral
                   la arma ciudad.js con su detalle: o.catedralAparte)
     cerrosNoche . cerros oscuros con lucecitas de pueblos
     arboles ..... árboles gigantes con raíces tablares, lianas, neblina y rayos de luz
   Lo que queda más allá de la neblina no la usa: trae el color del horizonte ya mezclado en sus
   vértices (perspectiva aérea), así se ve lejos pero se ve. Estilo de caras planas: se lee limpio
   y pesa poco. Todo lo de un tipo va junto en una sola malla. */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4;

function haze(mundo) { var h = M.col(mundo.cielo.horizonte), N = mundo.niebla; return function (c, d, max) { var f = M.suave(N.cerca, N.lejos * 1.7, d) * (max == null ? .82 : max); return M.mezclaCol(c, h, f); }; }
function malla(J, mat, E) { var m = new THREE.Mesh(J.geometria(), mat); m.matrixAutoUpdate = false; E.add(m); return m; }

/* un cerro de caras planas: cono deformado con ruido; colores por altura (con nieve si va) */
function cerro(J, x, z, r, h, rnd, cols, nieve, hz, cx, cz) {
  var g = new THREE.ConeGeometry(r, h, 11, 6, true).toNonIndexed(), rr = M.ruido(8, rnd), off = rnd() * 50;
  M.torcer(g, function (v) { var a = Math.atan2(v.z, v.x), t = (v.y + h / 2) / h, n = rr(a * 2 + off, t * 3) - .5;
    var k = 1 + n * .35; v.x *= k; v.z *= k; if (t < .99) v.y += n * h * .12; });
  var p = g.attributes.position, col = new Float32Array(p.count * 3), d = Math.hypot(x - cx, z - cz);
  for (var i = 0; i < p.count; i += 3) {                                /* un color por cara: caras planas */
    var ym = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, t = (ym + h / 2) / h, c;
    if (nieve && t > .6 + rnd() * .08) c = M.mezclaCol(M.col('#ffffff'), M.col('#c9d8ee'), rnd() * .5);
    else c = M.mezclaCol(cols[0], cols[1], M.lim(t * 1.3 + (rnd() - .5) * .3, 0, 1));
    c = hz(c, d);
    for (var k = 0; k < 3; k++) { col[(i + k) * 3] = c[0]; col[(i + k) * 3 + 1] = c[1]; col[(i + k) * 3 + 2] = c[2]; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.translate(0, h / 2 - .5, 0);
  J.pieza(g, [1, 1, 1], new M4().makeTranslation(x, 0, z));
}
function anillo(J, o, rnd, cols, nieve, hz) {
  for (var i = 0; i < o.n; i++) {
    var a0 = o.a0 || 0, a1 = o.a1 == null ? 6.283 : o.a1, a = a0 + (i / o.n) * (a1 - a0) + rnd() * .3 * (a1 - a0) / 6.283, d = o.r0 + rnd() * (o.r1 - o.r0);
    cerro(J, o.cx + Math.cos(a) * d, o.cz + Math.sin(a) * d, o.rad0 + rnd() * (o.rad1 - o.rad0), o.h0 + rnd() * (o.h1 - o.h0), rnd, cols, nieve, hz, o.cx, o.cz);
  }
}


/* ---------- relieve de verdad: un terreno de alturas alrededor del juego ----------
   Una malla de 150 × 150 (unas 30 mil caras) con cerros de ruido "con crestas" (como cordilleras),
   que sube desde el borde del juego hacia afuera. Los colores salen de la altura y de la pendiente
   (pasto en lo plano, roca en lo empinado, nieve arriba) y llevan ya la neblina mezclada según la
   distancia. o.andenes: en un sector, la ladera se vuelve escalones (andenes). o.solo(x,z): dónde sí. */
M.terreno = function (E, mundo, o) {
  var rnd = M.azar(o.sem || 77), r1 = M.ruido(16, rnd), r2 = M.ruido(32, rnd), r3 = M.ruido(64, rnd), hz = haze(mundo);
  var S = o.seg || 150, T = o.tam || Math.max(170, (o.r1 || 0) * 2 + 40), G = new THREE.PlaneGeometry(T, T, S, S); G.rotateX(-Math.PI / 2);   /* la carrera es más grande */
  var P = G.attributes.position, alturas = new Float32Array(P.count);
  function cresta(n) { return 1 - Math.abs(n * 2 - 1); }
  function alto(x, z) {
    var d = Math.hypot(x, z), m = M.suave(o.r0, o.r1, d);
    if (o.solo) m *= o.solo(x, z);
    var c = cresta(r1(x / 26 + 5, z / 26 + 9)), c2 = cresta(r2(x / 10, z / 10)), b = r3(x / 4, z / 4);
    var h = (Math.pow(c, 2.2) * .75 + c2 * .2 + b * .05) * o.amp * (.08 + .92 * Math.pow(M.suave(o.r0, o.r1 * 2.2, d), 1.6));   /* cerca, lomas bajas; lejos, la cordillera */
    if (o.andenes) {        /* andenes: escalones en las laderas del sector pedido */
      var a = Math.atan2(z, x), sec = Math.max(0, Math.cos(a - o.andenes.ang)), en = M.suave(.55, .85, sec) * (1 - M.suave(o.andenes.hMax * .8, o.andenes.hMax, h));
      if (en > 0) { var paso = o.andenes.paso, q = Math.floor(h / paso) * paso + paso * M.suave(.82, 1, (h / paso) % 1); h = h + (q - h) * en; }
    }
    return h * m - .02 - HUNDIR * (1 - m);   /* la carrera lo hunde adentro: ahí manda el suelo con relieve */
  }
  for (var i = 0; i < P.count; i++) { var x = P.getX(i), z = P.getZ(i), h = alto(x, z); P.setY(i, h); alturas[i] = h; }
  G.computeVertexNormals();
  var N = G.attributes.normal, col = new Float32Array(P.count * 3), C = o.colores;
  for (i = 0; i < P.count; i++) {
    x = P.getX(i); z = P.getZ(i); var y = alturas[i], ny = N.getY(i), d = Math.hypot(x, z), ruido = r2(x / 3, z / 3) - .5;
    var cc = M.mezclaCol(C.bajo, C.medio, M.lim(y / (o.amp * .35) + ruido * .3, 0, 1));
    cc = M.mezclaCol(cc, C.roca, M.suave(.82, .6, ny) * .9);                                       /* lo empinado es roca */
    if (C.nieve) cc = M.mezclaCol(cc, C.nieve, M.suave(o.nieve, o.nieve + 2.5, y + ruido * 3) * M.suave(.45, .7, ny));
    cc = hz(cc, d + o.hazeExtra);
    col[i * 3] = cc[0]; col[i * 3 + 1] = cc[1]; col[i * 3 + 2] = cc[2];
  }
  G.setAttribute('color', new THREE.BufferAttribute(col, 3));
  var mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, map: M.texGrano(o.sem || 7, .25) }); M.texGrano(o.sem || 7, .25).repeat.set(40, 40);
  var malla = new THREE.Mesh(G, mat); malla.position.set(o.cx, 0, o.cz); malla.receiveShadow = true; malla.userData.terreno = true; E.add(malla);
  return { alto: function (x, z) { return alto(x - o.cx, z - o.cz); }, malla: malla };
};

var LEJOS = {};

LEJOS.nevados = function (E, mundo, o) {
  var R = Math.max(o.medioX, o.medioZ);
  var tn = M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: R + 3, r1: R + 24, amp: 42, nieve: 13, sem: 101, hazeExtra: -16,
    andenes: { ang: -Math.PI / 2, paso: .55, hMax: 9 },
    colores: { bajo: M.col('#6f8a3a'), medio: M.col('#8d8a55'), roca: M.col('#6c6457'), nieve: M.col('#f4f7fb') } });
  /* los muros de piedra de los andenes se pintan solos (roca en lo empinado de cada escalón) */
  if (o.info) o.info.nevados = tn.malla;
};

LEJOS.cerrosNoche = function (E, mundo, o) {
  var rnd = M.azar(131), R = Math.max(o.medioX, o.medioZ);
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: R + 3, r1: R + 24, amp: 30, nieve: 15, sem: 131, hazeExtra: -10,
    colores: { bajo: M.col('#1c2a3a'), medio: M.col('#2a3550'), roca: M.col('#323a58'), nieve: M.col('#b9c8ef') } });
  /* lucecitas de pueblos en las faldas */
  var N = 90, pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) { var a = rnd() * 6.283, d = R + 6 + rnd() * 6; pos[i * 3] = o.cx + Math.cos(a) * d; pos[i * 3 + 1] = .6 + rnd() * 2.6; pos[i * 3 + 2] = o.cz + Math.sin(a) * d; }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  E.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffcf7a', size: .35, map: M.texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
};

/* el mar: un plano con olitas (mapa de normales hecho en lienzo que se desliza) y la orilla con espuma */
function texOlas() {
  var N = 256, c = M.lienzo(N, N), g = c.getContext('2d'), rnd = M.azar(41), r1 = M.ruido(16, rnd), r2 = M.ruido(32, rnd), im = g.createImageData(N, N), h = new Float32Array(N * N);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) h[y * N + x] = r1(x / 16, y / 16) * .6 + r2(x / 8, y / 8) * .4;
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var dx = h[y * N + (x + 1) % N] - h[y * N + (x - 1 + N) % N], dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x], i = (y * N + x) * 4;
    im.data[i] = 128 + dx * 300; im.data[i + 1] = 128 + dy * 300; im.data[i + 2] = 255; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return M.tex(c, false, true);
}
LEJOS.mar = function (E, mundo, o) {
  var rnd = M.azar(151), orilla = o.orilla != null ? o.orilla : o.cz - o.medioZ - 3.2;   /* la orilla: un poco más allá del borde de atrás del laberinto (la carrera la pide al lado de la largada) */
  var nm = texOlas(); nm.repeat.set(18, 8);
  var mar = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), new THREE.MeshStandardMaterial({ color: '#2b6d8a', roughness: .22, metalness: .05, normalMap: nm, normalScale: new THREE.Vector2(.55, .55) }));
  mar.rotation.x = -Math.PI / 2; mar.position.set(o.cx, o.olas ? -.12 : .03, orilla - 55); E.add(mar);
  var OL = { value: 0 }, olas = null, flotan = [];
  if (o.olas) {   /* 3c (carrera): olas que llegan a la orilla, con espuma en las crestas, y el cielo reflejado */
    var gO = new THREE.PlaneGeometry(240, 70, o.baja ? 60 : 120, o.baja ? 18 : 35); gO.rotateX(-Math.PI / 2);   /* en los celulares flojos, menos detalle y sin reflejo */
    var mO = new THREE.MeshStandardMaterial({ color: '#2a6a88', roughness: .2, metalness: .1, normalMap: nm, normalScale: new THREE.Vector2(.35, .35), envMap: !o.baja && M.envCielo ? M.envCielo(mundo) : null, envMapIntensity: 1.1 });
    mO.onBeforeCompile = function (sh) {
      sh.uniforms.uT = OL; sh.uniforms.uOrilla = { value: orilla };
      sh.vertexShader = 'uniform float uT;\nuniform float uOrilla;\nvarying float vOla;\nvarying float vOri;\n' +
        'float ola(vec2 p) { float d = p.y - uOrilla; float a = clamp(.35 - d / 5., .35, 1.) * (1. - smoothstep(50., 68., -d));\n' +
        '  return (.16 * sin(.55 * p.y - 1.5 * uT + .12 * sin(.07 * p.x + uT * .3)) + .06 * sin(1.4 * p.y - .3 * p.x - 2.4 * uT) + .04 * sin(.9 * p.x + 1.7 * uT)) * a; }\n' +
        sh.vertexShader.replace('#include <beginnormal_vertex>',
          'vec4 wp0 = modelMatrix * vec4(position, 1.); float h0 = ola(wp0.xz), hx = ola(wp0.xz + vec2(.25, 0.)), hz = ola(wp0.xz + vec2(0., .25));\n' +
          'vec3 objectNormal = normalize(vec3(-(hx - h0) * 4., 1., -(hz - h0) * 4.));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif')
        .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); transformed.y += h0; vOla = h0; vOri = wp0.z - uOrilla;');
      sh.fragmentShader = 'varying float vOla;\nvarying float vOri;\n' + sh.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n  float esp = smoothstep(.1, .19, vOla) * .55 + smoothstep(-2.5, -.2, vOri) * .6;\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .95, .96), clamp(esp, 0., .85));');
    };
    olas = new THREE.Mesh(gO, mO); olas.position.set(o.cx, .03, orilla - 32.5); E.add(olas);   /* de orilla + 2,5 (bajo la arena) hasta mar adentro */
    if (o.info) { o.info.olas = olas; o.info.olasT = OL; }
  }
  /* la misma ola en JS: para que los caballitos suban y bajen con ella */
  function olaEn(x, z, t) { var d = z - orilla, a = Math.max(.35, Math.min(1, .35 - d / 5)) * (1 - M.suave(50, 68, -d));
    return (.16 * Math.sin(.55 * z - 1.5 * t + .12 * Math.sin(.07 * x + t * .3)) + .06 * Math.sin(1.4 * z - .3 * x - 2.4 * t) + .04 * Math.sin(.9 * x + 1.7 * t)) * a; }
  /* la arena mojada y la espuma de la orilla */
  var espuma = M.lienzo(256, 32), ge = espuma.getContext('2d');
  for (var i = 0; i < 900; i++) { ge.fillStyle = 'rgba(255,255,255,' + (.2 + rnd() * .6) + ')'; ge.beginPath(); ge.arc(rnd() * 256, 10 + Math.pow(rnd(), 2) * 22, .8 + rnd() * 2.2, 0, 6.283); ge.fill(); }
  var te = M.tex(espuma, false, true); te.repeat.set(30, 1);
  var franja = new THREE.Mesh(new THREE.PlaneGeometry(220, 1.4), new THREE.MeshBasicMaterial({ map: te, transparent: true, depthWrite: false, opacity: .85 }));
  franja.rotation.x = -Math.PI / 2; franja.position.set(o.cx, .045, orilla + .3); E.add(franja);
  var mojada = new THREE.Mesh(new THREE.PlaneGeometry(220, 3), new THREE.MeshStandardMaterial({ color: '#b39468', roughness: .35, transparent: true, opacity: .55 }));
  mojada.rotation.x = -Math.PI / 2; mojada.position.set(o.cx, .02, orilla + 1.4); E.add(mojada);
  /* el muelle de Huanchaco: largo, sobre pilotes, con sus faroles */
  var J = new M.Junta(), mx = o.cx + 9, km = o.muelle || 1, LM = 46 * km, AM = 1.6 * km, YM = 1.1 * km;   /* km: la carrera lo pide más grande */
  J.caja(AM, .12 * km, LM, mx, YM, orilla - LM / 2, M.col('#8a7a66'), null, 2);
  for (var z = 0; z < LM; z += 2.2 * km) { J.caja(.12 * km, YM + .5, .12 * km, mx - AM * .4375, (YM - .5) / 2, orilla - z, M.col('#5e5244'), null, 2); J.caja(.12 * km, YM + .5, .12 * km, mx + AM * .4375, (YM - .5) / 2, orilla - z, M.col('#5e5244'), null, 2); }
  for (z = 0; z < LM; z += 1.15 * km) { J.caja(.05 * km, .32 * km, .05 * km, mx - AM * .4875, YM + .22 * km, orilla - z, M.col('#d8d2c8'), null, 2); J.caja(.05 * km, .32 * km, .05 * km, mx + AM * .4875, YM + .22 * km, orilla - z, M.col('#d8d2c8'), null, 2); }
  J.caja(.05 * km, .05 * km, LM, mx - AM * .4875, YM + .36 * km, orilla - LM / 2, M.col('#e8e2d8'), null, 2); J.caja(.05 * km, .05 * km, LM, mx + AM * .4875, YM + .36 * km, orilla - LM / 2, M.col('#e8e2d8'), null, 2);
  var nFar = 0;
  if (o.faroles) {   /* los faroles del muelle, encendidos al atardecer */
    var JL = new M.Junta(), brillo = [];
    for (z = 4; z < LM; z += 7.5) [-1, 1].forEach(function (l) { var fx = mx + l * AM * .4875, fy = YM + .1 * km;
      J.caja(.07 * km, 1.5 * km, .07 * km, fx, fy + .75 * km, orilla - z, M.col('#2e2a26'), null, 2); J.caja(.36 * km, .05 * km, .05 * km, fx - l * .15 * km, fy + 1.5 * km, orilla - z, M.col('#2e2a26'), null, 2);
      var fa = new THREE.SphereGeometry(.13 * km, 10, 8); fa.translate(fx - l * .3 * km, fy + 1.38 * km, orilla - z); JL.pieza(fa, M.col('#fff0c0'));
      brillo.push(fx - l * .3 * km, fy + 1.38 * km, orilla - z); nFar++; });
    malla(JL, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), E);
    var gB = new THREE.BufferGeometry(); gB.setAttribute('position', new THREE.Float32BufferAttribute(brillo, 3));
    E.add(new THREE.Points(gB, new THREE.PointsMaterial({ color: '#ffd27a', size: 1.6, map: M.texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  }
  malla(J, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(27, .3), roughness: .9 }), E);
  if (o.info) { o.info.muelleLargo = LM; o.info.muelleX = mx; o.info.faroles = nFar; o.info.orilla = orilla; }
  /* caballitos de totora parados en la arena, entre el laberinto y el mar */
  var JC = new M.Junta(), perf = [];
  for (var k = 0; k <= 10; k++) { var t = k / 10; perf.push(new THREE.Vector2(.03 + Math.sin(Math.min(1, t * 1.15) * Math.PI) * .2 * (1 - t * .5), t * 2.1)); }
  for (k = 0; k < 11; k++) {
    var lg = new THREE.LatheGeometry(perf, 10); lg.userData.uvPropio = true;
    var x = o.cx - 8 + k * 1.15 + (rnd() - .5) * .3, m = new M4().makeRotationZ((rnd() - .5) * .2).premultiply(new M4().makeRotationX(-.12 - rnd() * .1)).setPosition(x, 0, orilla + 2 + rnd() * .6);
    if (Math.abs(x - mx) < 1.4) continue;
    JC.pieza(lg, M.col('#d2b67c', .85 + rnd() * .2), m);
  }
  var tt = M.lienzo(64, 128), gt = tt.getContext('2d'); gt.fillStyle = '#ccb07a'; gt.fillRect(0, 0, 64, 128);
  for (k = 0; k < 40; k++) { gt.fillStyle = 'rgba(110,80,40,' + (.15 + rnd() * .3) + ')'; gt.fillRect(rnd() * 64, 0, 1 + rnd() * 2, 128); }
  gt.fillStyle = 'rgba(90,60,30,.8)'; [30, 64, 98].forEach(function (y) { gt.fillRect(0, y, 64, 5); });
  var matCab = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.tex(tt, true, true), roughness: .9 });
  malla(JC, matCab, E);
  if (o.olas) {   /* 3c (carrera): caballitos en el agua, montados como se montan (el pescador sentado, con su remo de caña) */
    for (k = 0; k < 6; k++) {
      var JF = new M.Junta(), lb = new THREE.LatheGeometry(perf, 10); lb.userData.uvPropio = true; lb.rotateZ(-Math.PI / 2); lb.translate(-1.05, 0, 0);
      M.torcer(lb, function (v) { v.y += Math.pow(Math.max(0, v.x - .3), 2) * .55; });   /* la proa, levantada */
      JF.pieza(lb, M.col('#d2b67c', .85 + rnd() * .2));
      if (k % 2 === 0) { var to = new THREE.CylinderGeometry(.08, .11, .36, 8); to.translate(-.35, .32, 0); JF.pieza(to, M.col(['#c9443b', '#3e6fb0', '#e9b949'][k % 3]));
        var ca = new THREE.SphereGeometry(.08, 10, 8); ca.translate(-.35, .58, 0); JF.pieza(ca, M.col('#8a5a3c'));
        var re = new THREE.CylinderGeometry(.015, .015, 1.5, 5); re.rotateX(1.1); re.translate(-.3, .4, .25); JF.pieza(re, M.col('#b9a272')); }
      var cab = new THREE.Mesh(JF.geometria(), matCab); var ax = o.cx - 34 + k * 12 + (rnd() - .5) * 4; if (Math.abs(ax - mx) < 4) ax += 8;
      cab.userData.x = ax; cab.userData.z = orilla - 6 - rnd() * 14; cab.userData.giro = rnd() * 6.283; cab.scale.setScalar(1.3); cab.position.set(ax, .1, cab.userData.z); E.add(cab); flotan.push(cab);
    }
    if (o.info) o.info.caballitos = flotan;
  }
  /* cerros pálidos detrás de la playa */
  /* r1 nunca antes que r0: en la carrera (medio 44) el 40 fijo dejaba las lomas DENTRO, encima de la pista */
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: Math.max(o.medioX, o.medioZ) + 6, r1: Math.max(40, Math.max(o.medioX, o.medioZ) + 20), amp: 16, sem: 151, hazeExtra: 0, solo: function (x, z) { return M.suave(3, 11, z); },
    colores: { bajo: M.col('#c9a77e'), medio: M.col('#b48e66'), roca: M.col('#9a7756') } });
  return { actualizar: function (dt, t) { nm.offset.set(t * .012, t * .02); te.offset.x = t * .01; franja.material.opacity = .6 + Math.sin(t * .9) * .25; franja.position.z = orilla + .3 + Math.sin(t * .9) * .25;
    OL.value = t; flotan.forEach(function (c) { var x = c.userData.x, z = c.userData.z, h = olaEn(x, z, t), hz = olaEn(x, z + .5, t);
      c.position.y = .1 + h; c.rotation.set((hz - h) * 1.2, c.userData.giro, Math.sin(t * 1.3 + x) * .05); }); } };
};

LEJOS.dunas = function (E, mundo, o) {
  var rnd = M.azar(171), R = Math.max(o.medioX, o.medioZ);
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: R + 3, r1: R + 30, amp: 14, sem: 171, hazeExtra: 0,
    colores: { bajo: M.col('#d6b48a'), medio: M.col('#e8cfa6'), roca: M.col('#b9926a') } });
  /* algarrobos: tronco torcido y copa ancha y plana */
  var JT = new M.Junta(), k;
  for (k = 0; k < 9; k++) {
    var a = rnd() * 6.283, dd = 11 + rnd() * 8, x = o.cx + Math.cos(a) * dd, z = o.cz + Math.sin(a) * dd, h = 1.4 + rnd() * .8;
    if (o.libre && !o.libre(x, z, 1.8)) continue;                          /* en la carrera: nunca encima de la pista */
    var tr = new THREE.CylinderGeometry(.08, .16, h, 6, 3); tr.translate(0, h / 2, 0); M.torcer(tr, function (v) { v.x += Math.sin(v.y * 2.4) * .12; });
    JT.pieza(tr, M.col('#5a4632'), new M4().makeTranslation(x, 0, z));
    for (var c2 = 0; c2 < 5; c2++) { var co = new THREE.IcosahedronGeometry(.6 + rnd() * .4, 0); co.scale(1.4, .45, 1.2); co.translate((rnd() - .5) * 1.2, h + (rnd() - .2) * .3, (rnd() - .5) * 1.2); JT.pieza(co, M.col(['#5f6e34', '#71803c', '#566430'][c2 % 3]), new M4().makeTranslation(x, 0, z)); }
  }
  malla(JT, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), E);
};

/* hoja de palmera (alfa) */
var TXP = null;
function texPalma() {
  if (TXP) return TXP;
  var c = M.lienzo(64, 256), g = c.getContext('2d'); g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  for (var y = 8; y < 250; y += 6) { var w = Math.sin(y / 256 * Math.PI) * 28 + 4; g.lineWidth = 2.4; g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 - w * .5, y + 8, 32 - w, y + 20); g.stroke(); g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 + w * .5, y + 8, 32 + w, y + 20); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
  return (TXP = M.tex(c, false, false));
}
function palmera(JT, JH, x, z, alto, rnd) {
  var tr = new THREE.CylinderGeometry(.09, .14, alto, 7, 6); tr.translate(0, alto / 2, 0); var curva = (rnd() - .5) * .5;
  M.torcer(tr, function (v) { v.x += Math.pow(v.y / alto, 2) * curva; });
  JT.pieza(tr, M.col('#8a7458'), new M4().makeTranslation(x, 0, z), 3);
  for (var k = 0; k < 9; k++) {
    var h = new THREE.PlaneGeometry(.5, 1.9, 1, 4); h.translate(0, .95, 0); M.torcer(h, function (v) { v.z += v.y * v.y * .28; }); h.userData.uvPropio = true;
    JH.pieza(h, M.col(['#4f8a3a', '#62a046', '#3f7a32'][k % 3]), new M4().makeRotationFromEuler(new THREE.Euler(-1.15 + rnd() * .3, k / 9 * 6.283, 0, 'YXZ')).setPosition(x + curva, alto, z));
  }
}
LEJOS.catedral = function (E, mundo, o) {
  var rnd = M.azar(191), W = M.muros(M.MUNDOS.ciudad), m4 = new THREE.Object3D();
  /* casonas grandes alrededor (los mismos tramos de las paredes, a escala de casa), dejando la calle libre */
  var lista = [], R = Math.max(o.medioX, o.medioZ) + 4.5;
  [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (s, si) {
    var largo = (s[0] ? o.medioZ : o.medioX) * 2 + 12;
    var kh = o.escalaCasonas || 1;   /* la carrera: casonas de tamaño de casa */
    for (var u = -largo / 2; u < largo / 2; u += 2.4 * kh) {
      if (si === 0 && !o.catedralEn && Math.abs(u) < 5.5 * (o.escalaCatedral || 1)) continue;   /* al norte, el hueco de la catedral (si va ahí) */
      var x = o.cx + (s[0] ? s[0] * (o.medioX + 6) : u + 1.2), z = o.cz + (s[1] ? s[1] * (o.medioZ + 6) : u + 1.2);
      lista.push({ x: x, z: z, giro: s[0] ? -s[0] * Math.PI / 2 : (s[1] > 0 ? Math.PI : 0), v: rnd() * W.variantes.length | 0, alto: (2.3 + rnd() * .9) * kh });
    }
  });
  var porVar = {};
  lista.forEach(function (c) { (porVar[c.v] = porVar[c.v] || []).push(c); });
  Object.keys(porVar).forEach(function (v) {
    W.variantes[v].forEach(function (parte) {
      var im = new THREE.InstancedMesh(parte.geo, parte.mat, porVar[v].length);
      porVar[v].forEach(function (c, i) { m4.position.set(c.x, 0, c.z); m4.rotation.set(0, c.giro, 0); m4.scale.set(2.4 * (o.escalaCasonas || 1), c.alto, 3 * (o.escalaCasonas || 1)); m4.updateMatrix(); im.setMatrixAt(i, m4.matrix); });
      im.receiveShadow = true; E.add(im);
    });
  });
  /* la catedral: amarilla con blanco, dos torres campanario y la cúpula (en la carrera la arma ciudad.js con su detalle: M.catedral) */
  if (!o.catedralAparte) {
  var J = new M.Junta(), AM = M.col('#e9b949'), BL = M.col('#f4efe3'), cz = o.cz - o.medioZ - 9, cx = o.cx;
  J.caja(8, 4.6, 4, cx, 2.3, cz - 1, AM, null, .8); J.caja(8.4, .3, 4.2, cx, 4.65, cz - 1, BL, null, .8);
  J.caja(2.4, 3.2, .3, cx, 1.6, cz + 1.05, BL, null, .8); J.caja(1.4, 2.4, .32, cx, 1.2, cz + 1.12, M.col('#6d4528'), null, .8);
  var fr = new THREE.CylinderGeometry(0, 1.6, 1.1, 3, 1); fr.rotateY(Math.PI / 6); fr.scale(1.6, 1, .3); fr.translate(cx, 5.35, cz + .7); J.pieza(fr, AM, null, .8);
  [-1, 1].forEach(function (l) {
    var tx = cx + l * 3.6;
    J.caja(1.8, 7, 1.8, tx, 3.5, cz + .3, AM, null, .8); J.caja(2, .25, 2, tx, 7.1, cz + .3, BL, null, .8);
    J.caja(1.4, 1.4, 1.4, tx, 7.95, cz + .3, BL, null, .8); J.caja(.6, .9, 1.5, tx, 7.95, cz + .3, M.col('#3a2a20'), null, .8);
    var cu = new THREE.SphereGeometry(.75, 14, 8, 0, 6.283, 0, Math.PI / 2); cu.translate(tx, 8.65, cz + .3); J.pieza(cu, BL, null, .8);
    var li = new THREE.CylinderGeometry(.12, .16, .7, 8); li.translate(tx, 9.6, cz + .3); J.pieza(li, AM, null, .8);
  });
  var cup = new THREE.SphereGeometry(1.9, 18, 10, 0, 6.283, 0, Math.PI / 2); cup.translate(cx, 6.2, cz - 2.6); J.pieza(cup, AM, null, .8);
  var tam = new THREE.CylinderGeometry(1.95, 1.95, 1.2, 18, 1); tam.translate(cx, 5.6, cz - 2.6); J.pieza(tam, BL, null, .8);
  for (var k = 0; k < 8; k++) { var cl = new THREE.BoxGeometry(.4, .7, .1); cl.translate(0, 5.6, 1.96); cl.rotateY(k / 8 * 6.283); cl.translate(cx, 0, cz - 2.6); J.pieza(cl, M.col('#3a3040'), null, .8); }
  var gCat = J.geometria(), kc = o.escalaCatedral || 1; if (kc !== 1) gCat.translate(-cx, 0, -cz).scale(kc, kc, kc).translate(cx, 0, cz);   /* la carrera la pide grande */
  if (o.catedralEn) { var ce = o.catedralEn; gCat.translate(-cx, 0, -cz).rotateY(ce.giro).translate(ce.x, ce.y || 0, ce.z); }   /* y en Trujillo, frente a la largada */
  var mCat = new THREE.Mesh(gCat, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(29, .14), roughness: .9 })); mCat.matrixAutoUpdate = false; mCat.castShadow = kc > 1 && !o.baja; E.add(mCat);
  if (o.info) o.info.catedral = mCat;
  }
  /* palmeras de la plaza y faroles en las esquinas */
  var JT = new M.Junta(), JH = new M.Junta();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { palmera(JT, JH, o.cx + s[0] * (o.medioX + 2.2), o.cz + s[1] * (o.medioZ + 2.2), 3 + rnd() * .8, rnd); });
  [[-1, 0], [1, 0]].forEach(function (s) { palmera(JT, JH, o.cx + s[0] * (o.medioX + 2.4), o.cz + 1.5, 3.4, rnd); });
  malla(JT, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(31, .5), roughness: 1 }), E);
  malla(JH, new THREE.MeshStandardMaterial({ vertexColors: true, map: texPalma(), alphaTest: .4, side: THREE.DoubleSide, roughness: .8 }), E);
};

LEJOS.arboles = function (E, mundo, o) {
  var rnd = M.azar(211), JT = new M.Junta(), JH = new M.Junta(), JL = new M.Junta();
  var hojas = new THREE.MeshStandardMaterial({ vertexColors: true, alphaTest: .45, side: THREE.DoubleSide, roughness: .8 });
  /* la textura de hojas de las paredes de la selva (muros.js la arma) */
  var mf = M.muros(mundo).variantes[0][1].mat; hojas.map = mf.map;
  for (var k = 0; k < 13; k++) {
    var a = (k / 13) * 6.283 + rnd() * .3, d = Math.max(o.medioX, o.medioZ) + 3 + rnd() * 7, x = o.cx + Math.cos(a) * d, z = o.cz + Math.sin(a) * d, h = 7 + rnd() * 5;
    if (o.libre && !o.libre(x, z, 3.5)) continue;                          /* en la carrera: nunca encima de la pista */
    var tr = new THREE.CylinderGeometry(.28, .45, h, 9, 6); tr.translate(0, h / 2, 0); M.torcer(tr, function (v) { v.x += Math.sin(v.y * .5 + k) * .15; });
    JT.pieza(tr, M.col('#6b5a45', .85 + rnd() * .2), new M4().makeTranslation(x, 0, z), 2);
    for (var r = 0; r < 4; r++) { var ra = new THREE.BoxGeometry(.08, 1.4, 1.1); ra.translate(0, .55, .55); M.torcer(ra, function (v) { v.z *= 1 - v.y * .35; }); JT.pieza(ra, M.col('#5f4f3c'), new M4().makeRotationY(r / 4 * 6.283 + rnd() * .5).setPosition(x, 0, z), 2); }
    for (var c = 0; c < 26; c++) { var s = 1.4 + rnd() * 1.2, g = new THREE.PlaneGeometry(s, s); g.userData.uvPropio = true;
      JH.pieza(g, M.col('#ffffff', .6 + rnd() * .4), new M4().makeRotationFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)).setPosition(x + (rnd() - .5) * 3.5, h - .5 + rnd() * 2.4, z + (rnd() - .5) * 3.5)); }
    /* lianas */
    for (var l = 0; l < 3; l++) {
      var p0 = new THREE.Vector3(x + (rnd() - .5) * 2.4, h - .3, z + (rnd() - .5) * 2.4), p2 = new THREE.Vector3(x + (rnd() - .5) * 5, 0, z + (rnd() - .5) * 5);
      var cur = new THREE.QuadraticBezierCurve3(p0, new THREE.Vector3((p0.x + p2.x) / 2, h * .35, (p0.z + p2.z) / 2), p2);
      JL.pieza(new THREE.TubeGeometry(cur, 12, .025, 4, false), M.col('#3c5a2a'));
    }
  }
  malla(JT, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(37, .45), roughness: 1 }), E).castShadow = false;
  malla(JH, hojas, E); malla(JL, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), E);
  /* una pared de selva más lejos (cerritos verdes de copas) */
  /* más allá: una muralla de copas redondas (el bosque visto desde adentro) */
  var JF = new M.Junta(), hz = haze(mundo);
  for (k = 0; k < 70; k++) {
    /* a 19-31 del centro: en el laberinto es lejos; la carrera, que es más grande, pide desde dónde (copasDesde) */
    var a2 = rnd() * 6.283, d2 = (o.copasDesde || 19) + rnd() * 12, x2 = o.cx + Math.cos(a2) * d2, z2 = o.cz + Math.sin(a2) * d2, r2 = 2.2 + rnd() * 2.6, y2 = 3 + rnd() * 6;
    if (o.libre && !o.libre(x2, z2, r2 + .5)) continue;
    var b2 = new THREE.IcosahedronGeometry(r2, 1); b2.scale(1, .8, 1); b2.translate(x2, y2, z2);
    JF.pieza(b2, hz(M.mezclaCol(M.col('#24461f'), M.col('#4f7f3a'), rnd()), Math.hypot(x2 - o.cx, z2 - o.cz), .45));
    var tr2 = new THREE.CylinderGeometry(.25, .4, y2, 6); tr2.translate(x2, y2 / 2, z2); JF.pieza(tr2, hz(M.col('#4a3c2c'), d2, .45));
  }
  malla(JF, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }), E);
};

/* M.lejos(E, mundo, {cx, cz, medioX, medioZ, libre?, copasDesde?}) → { actualizar(dt, t) }
   libre(x, z, margen): la carrera la pasa para que nada caiga encima de la pista (el laberinto no la usa). */
var HUNDIR = 0;   /* solo mientras se arma lo lejano de la carrera (el laberinto lo deja en 0) */
M.lejos = function (E, mundo, o) { HUNDIR = o.hundir || 0; var r; try { r = LEJOS[mundo.lejos](E, mundo, o); } finally { HUNDIR = 0; } return r && r.actualizar ? r : { actualizar: function () {} }; };
})();

;
/* Ruway — LOS MUNDOS. vida.js: lo que se mueve en el aire de cada mundo.
     puna ........ jirones de nube que pasan bajo y un cóndor que planea en lo alto
     mar ......... gaviotas que cruzan y destellos del sol en el agua
     polvo ....... polvo dorado que flota en la luz de la tarde
     faroles ..... la luz tibia de los faroles, polillas y motas de luz
     luciernagas . luciérnagas que se encienden y estrellas fugaces
     mariposas ... mariposas morfo azules, polen y rayos de luz entre los árboles
   Todo es barato: una nube de puntos o unos pocos sprites, y en un teléfono flojo la mitad. */
(function () {
'use strict';
var M = window.Mundos;

function puntos(E, n, area, alto, color, tam, aditivo, rnd) {
  var pos = new Float32Array(n * 3), fase = new Float32Array(n);
  for (var i = 0; i < n; i++) { pos[i * 3] = area.cx + (rnd() - .5) * area.w; pos[i * 3 + 1] = alto[0] + rnd() * (alto[1] - alto[0]); pos[i * 3 + 2] = area.cz + (rnd() - .5) * area.h; fase[i] = rnd() * 6.283; }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var m = new THREE.PointsMaterial({ color: color, size: tam, map: M.texBrillo(), transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: .9 });
  var p = new THREE.Points(g, m); E.add(p); p.userData.fase = fase; return p;
}
/* un ave en V (gaviota o cóndor) dibujada en lienzo, que aletea cambiando su escala */
function texAve(cond) {
  var c = M.lienzo(128, 64), g = c.getContext('2d'); g.fillStyle = cond ? '#1d1a1a' : '#ffffff'; g.strokeStyle = cond ? '#1d1a1a' : '#5d6670'; g.lineWidth = cond ? 0 : 2;
  g.beginPath(); g.moveTo(64, 34); g.quadraticCurveTo(40, 14, 4, 22); g.quadraticCurveTo(36, 26, 58, 40); g.lineTo(70, 40); g.quadraticCurveTo(92, 26, 124, 22); g.quadraticCurveTo(88, 14, 64, 34); g.fill(); if (!cond) g.stroke();
  if (cond) { g.fillStyle = '#f2efe6'; g.beginPath(); g.ellipse(64, 34, 6, 3, 0, 0, 6.283); g.fill(); }
  return M.tex(c, true, false);
}
function texMariposa() {
  var c = M.lienzo(128, 64), g = c.getContext('2d');
  [-1, 1].forEach(function (l) { var gr = g.createRadialGradient(64 + l * 30, 28, 4, 64 + l * 30, 28, 34); gr.addColorStop(0, '#7fe6ff'); gr.addColorStop(.55, '#1f7fe0'); gr.addColorStop(.9, '#0b2a6a'); gr.addColorStop(1, '#05122e');
    g.fillStyle = gr; g.beginPath(); g.moveTo(64, 32); g.bezierCurveTo(64 + l * 20, 0, 64 + l * 62, 4, 64 + l * 56, 30); g.bezierCurveTo(64 + l * 60, 48, 64 + l * 30, 62, 64, 36); g.fill(); });
  g.fillStyle = '#111'; g.fillRect(62, 18, 4, 30); return M.tex(c, true, false);
}
function texRayo() {
  var c = M.lienzo(64, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,250,210,0)'); gr.addColorStop(.5, 'rgba(255,250,210,.55)'); gr.addColorStop(1, 'rgba(255,250,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256); var gv = g.createLinearGradient(0, 0, 0, 256); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(.15, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = gv; g.fillRect(0, 0, 64, 256); return M.tex(c, false, false);
}

var VIDA = {};
VIDA.puna = function (E, mundo, a, rnd, k) {
  var nubes = [], tn = M.texBrillo();
  for (var i = 0; i < 10 * k; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tn, color: '#ffffff', transparent: true, opacity: .22, depthWrite: false })); s.scale.set(5 + rnd() * 4, 1.4 + rnd(), 1); s.position.set(a.cx + (rnd() - .5) * 40, 1.6 + rnd() * 2.2, a.cz + (rnd() - .5) * 40); s.userData.v = .25 + rnd() * .3; E.add(s); nubes.push(s); }
  var condor = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAve(true), transparent: true, depthWrite: false, fog: false })); condor.scale.set(2.6, 1.3, 1); E.add(condor);
  return function (dt, t) {
    nubes.forEach(function (s) { s.position.x += s.userData.v * dt; if (s.position.x > a.cx + 22) s.position.x = a.cx - 22; });
    var ang = t * .07; condor.position.set(a.cx + Math.cos(ang) * 16, 13 + Math.sin(t * .3) * 1.2, a.cz - 6 + Math.sin(ang) * 10); condor.material.rotation = Math.sin(t * .4) * .15;
  };
};
VIDA.mar = function (E, mundo, a, rnd, k) {
  var aves = [], ta = texAve(false);
  for (var i = 0; i < 6; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ta, transparent: true, depthWrite: false })); s.scale.set(.7, .35, 1); s.userData = { f: rnd() * 6, v: .8 + rnd() * .6, y: 3 + rnd() * 4, z: a.cz - a.h / 2 - 3 - rnd() * 10, x: a.cx + (rnd() - .5) * 30 }; E.add(s); aves.push(s); }
  var brillo = puntos(E, 50 * k, { cx: a.cx, cz: a.cz - a.h / 2 - 14, w: 24, h: 18 }, [.08, .12], '#fff2c8', .25, true, rnd);
  return function (dt, t) {
    aves.forEach(function (s) { var u = s.userData; u.x += u.v * dt; if (u.x > a.cx + 18) u.x = a.cx - 18; s.position.set(u.x, u.y + Math.sin(t + u.f) * .4, u.z); s.scale.y = .35 * (.55 + Math.abs(Math.sin(t * 5 + u.f)) * .6); });
    brillo.material.opacity = .5 + Math.sin(t * 3) * .3;
  };
};
VIDA.polvo = function (E, mundo, a, rnd, k) {
  var p = puntos(E, 160 * k, { cx: a.cx, cz: a.cz, w: a.w + 6, h: a.h + 6 }, [.1, 2.4], '#ffe6b0', .06, true, rnd);
  return function (dt, t) { var pp = p.geometry.attributes.position.array, f = p.userData.fase; for (var i = 0; i < f.length; i++) { pp[i * 3] += Math.sin(t * .4 + f[i]) * dt * .12 + dt * .05; pp[i * 3 + 1] += Math.cos(t * .3 + f[i]) * dt * .05; if (pp[i * 3] > a.cx + a.w / 2 + 3) pp[i * 3] -= a.w + 6; } p.geometry.attributes.position.needsUpdate = true; };
};
VIDA.faroles = function (E, mundo, a, rnd, k) {
  var p = puntos(E, 90 * k, { cx: a.cx, cz: a.cz, w: a.w + 4, h: a.h + 4 }, [.2, 2.2], '#ffd59a', .07, true, rnd);
  return function (dt, t) { var pp = p.geometry.attributes.position.array, f = p.userData.fase; for (var i = 0; i < f.length; i++) { pp[i * 3 + 1] += Math.sin(t * .8 + f[i]) * dt * .06; } p.geometry.attributes.position.needsUpdate = true; p.material.opacity = .7 + Math.sin(t * 1.3) * .2; };
};
VIDA.luciernagas = function (E, mundo, a, rnd, k) {
  var n = 70 * k, luces = [], tb = M.texBrillo();
  for (var i = 0; i < n; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tb, color: i % 4 ? '#d8ff9a' : '#ffe39a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(.12 + rnd() * .1);
    s.userData = { x: a.cx + (rnd() - .5) * (a.w + 6), z: a.cz + (rnd() - .5) * (a.h + 6), y: .2 + rnd() * 1.6, f: rnd() * 6.283 }; E.add(s); luces.push(s); }
  var fugaz = new THREE.Sprite(new THREE.SpriteMaterial({ map: tb, color: '#ffffff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); fugaz.scale.set(2.4, .08, 1); fugaz.visible = false; E.add(fugaz);
  var proxima = 4, vida = 0, ini = new THREE.Vector3(), dir = new THREE.Vector3();
  return function (dt, t, cam) {
    luces.forEach(function (s) { var u = s.userData; u.f += dt; s.position.set(u.x + Math.sin(u.f * .6) * .4, u.y + Math.sin(u.f * 1.1) * .2, u.z + Math.cos(u.f * .5) * .4); s.material.opacity = Math.max(0, Math.sin(u.f * 1.7)); });
    proxima -= dt;
    if (proxima <= 0 && !fugaz.visible) { fugaz.visible = true; vida = 0; ini.set((cam ? cam.x : a.cx) + (rnd() - .5) * 30, 18 + rnd() * 10, (cam ? cam.z : a.cz) - 25 - rnd() * 15); dir.set(rnd() < .5 ? -1 : 1, -.35, 0).normalize(); fugaz.material.rotation = Math.atan2(dir.y, dir.x); }
    if (fugaz.visible) { vida += dt; fugaz.position.copy(ini).addScaledVector(dir, vida * 30); fugaz.material.opacity = Math.sin(Math.min(1, vida / .7) * Math.PI); if (vida > .7) { fugaz.visible = false; proxima = 5 + rnd() * 6; } }
  };
};
VIDA.mariposas = function (E, mundo, a, rnd, k) {
  var mar = [], tm = texMariposa();
  for (var i = 0; i < 9; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tm, transparent: true, depthWrite: false })); s.scale.set(.32, .16, 1);
    s.userData = { cx: a.cx + (rnd() - .5) * a.w, cz: a.cz + (rnd() - .5) * a.h, y: .8 + rnd() * 1.2, f: rnd() * 6, r: .6 + rnd() * 1.2 }; E.add(s); mar.push(s); }
  var polen = puntos(E, 110 * k, { cx: a.cx, cz: a.cz, w: a.w + 4, h: a.h + 4 }, [.2, 2.6], '#fff6c0', .05, true, rnd);
  var tr = texRayo(), rayos = [];
  for (i = 0; i < 6; i++) { var r = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), new THREE.MeshBasicMaterial({ map: tr, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .35, side: THREE.DoubleSide, fog: false }));
    r.position.set(a.cx + (rnd() - .5) * a.w, 4, a.cz + (rnd() - .5) * a.h); r.rotation.set(0, rnd() * 3, -.35); r.userData.f = rnd() * 6; E.add(r); rayos.push(r); }
  return function (dt, t, cam) {
    mar.forEach(function (s) { var u = s.userData; u.f += dt; s.position.set(u.cx + Math.cos(u.f * .7) * u.r, u.y + Math.sin(u.f * 2.1) * .25, u.cz + Math.sin(u.f * .9) * u.r); s.scale.x = .32 * (.25 + Math.abs(Math.sin(u.f * 11))); });
    var pp = polen.geometry.attributes.position.array, f = polen.userData.fase; for (var i = 0; i < f.length; i++) pp[i * 3 + 1] += Math.sin(t * .5 + f[i]) * dt * .04; polen.geometry.attributes.position.needsUpdate = true;
    rayos.forEach(function (r) { r.material.opacity = .22 + Math.sin(t * .5 + r.userData.f) * .12; if (cam) r.lookAt(cam.x, 4, cam.z); r.rotateZ(-.35); });
  };
};

/* M.vida(E, mundo, {cx, cz, w, h}) → actualizar(dt, t, posiciónDeCámara) */
M.vida = function (E, mundo, a) { var k = M.calidad() === 'baja' ? .5 : 1; return VIDA[mundo.vida](E, mundo, a, M.azar(mundo.id.length * 31), k); };
})();

;
/* Ruway — LOS MUNDOS. flora.js: la vegetación de La gran carrera (3c, parte 2, 6-nov-2026).
   Cada lugar con sus plantas, hechas aquí (sin modelos ni fotos de nadie):
     sierra .... ichu en manojos dorados, queñuas (tronco rojizo, copa tupida) y piedras
     costa ..... totora en matas, palmeras y grama salada
     desierto .. algarrobos de copa ancha, cactus San Pedro (columnas con costillas), piedras y grama seca
     ciudad .... ficus podados en su macetero, jardines con flores, palmeras y grama
     noche ..... ichu con escarcha, piedras y puyas de Raimondi
     selva ..... árboles altos con su copa, plátanos de hojas grandes y helechos
   Todo va en InstancedMesh (una llamada de dibujo por pieza) y se siembra fuera de las vallas: lo bajo desde 3,2 m del
   borde del asfalto y lo alto desde 7 m (no tapa la pista). Hay más cerca de la pista, que es donde se ve.
   Las hojas y el pasto se mecen con el viento (en el sombreador, con la posición de cada planta).
   En los celulares flojos va menos de la mitad y sin sombras.

   M.flora(E, mundo, { alto(x,z), sitio(x,z) → [distancia al centro de la pista, s], L, W, baja, R?, fuera(x,z)?, largada(x,z)? })
     → { tipos: {especie: cuántas}, mallas: [InstancedMesh], viento: {value}, ms, actualizar(t) } */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4, E3 = THREE.Euler;
var TX = {};
function una(k, f) { return TX[k] || (TX[k] = f()); }

/* ---------- texturas (blancas con alfa: el color lo ponen los vértices) ---------- */
function texPasto() { return una('pasto', function () {
  var W = 64, H = 128, c = M.lienzo(W, H), g = c.getContext('2d'), r = M.azar(5);
  for (var i = 0; i < 48; i++) {
    var x0 = 6 + r() * 52, ld = (r() - .5) * 34, h = H * (.42 + r() * .58), w = 1.8 + r() * 2.4, gr = g.createLinearGradient(0, H, 0, H - h);
    gr.addColorStop(0, 'rgb(120,120,112)'); gr.addColorStop(1, 'rgb(255,255,246)'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0 - w, H); g.quadraticCurveTo(x0 - w * .3 + ld * .3, H - h * .5, x0 + ld, H - h); g.quadraticCurveTo(x0 + w * .3 + ld * .3, H - h * .5, x0 + w, H); g.closePath(); g.fill();
  }
  return M.tex(c, true, false);
}); }
function texHojas() { return una('hojas', function () {
  var N = 128, c = M.lienzo(N, N), g = c.getContext('2d'), r = M.azar(9);
  for (var i = 0; i < 90; i++) {
    var a = r() * 6.283, d = Math.sqrt(r()) * 52, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, k = 150 + r() * 105 | 0;
    g.save(); g.translate(x, y); g.rotate(r() * 6.283); g.fillStyle = 'rgb(' + k + ',' + k + ',' + (k - 8) + ')';
    g.beginPath(); g.ellipse(0, 0, 4 + r() * 4, 2 + r() * 2, 0, 0, 6.283); g.fill(); g.restore();
  }
  return M.tex(c, true, false);
}); }
/* hoja de plumas (palmera y helecho): un nervio y hojitas a los dos lados */
function texPluma() { return una('pluma', function () {
  var c = M.lienzo(64, 256), g = c.getContext('2d'); g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  for (var y = 10; y < 250; y += 5) { var w = Math.sin(y / 256 * Math.PI) * 27 + 3; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 - w * .5, y + 7, 32 - w, y + 18); g.stroke();
    g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 + w * .5, y + 7, 32 + w, y + 18); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
  return M.tex(c, true, false);
}); }
/* la hoja grande del plátano: ovalada, con su nervio y algún corte */
function texHojaGrande() { return una('hojaGrande', function () {
  var c = M.lienzo(64, 256), g = c.getContext('2d'), r = M.azar(13);
  g.fillStyle = '#f2f2ea'; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(64, 50, 64, 200, 32, 254); g.bezierCurveTo(0, 200, 0, 50, 32, 4); g.fill();
  g.globalCompositeOperation = 'destination-out'; for (var i = 0; i < 6; i++) { var y = 50 + r() * 170, l = r() < .5; g.fillRect(l ? 0 : 33, y, 31, 1.6); } g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#bdbdb2'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 254); g.stroke();
  return M.tex(c, true, false);
}); }

/* ---------- piezas ---------- */
function plano(w, h, sx, sy) { var p = new THREE.PlaneGeometry(w, h, sx || 1, sy || 1); p.translate(0, h / 2, 0); p.userData.uvPropio = true; return p; }
function rot(x, y, z, orden) { return new M4().makeRotationFromEuler(new E3(x, y, z, orden || 'XYZ')); }
/* un manojo: tres planos de pasto cruzados */
function manojo(J, w, h, col, r) { for (var k = 0; k < 3; k++) J.pieza(plano(w, h), col, rot((r() - .5) * .25, k * 1.047 + r() * .3, (r() - .5) * .25)); }
/* una copa de hojas: núcleo de bolas (en J) y planos de hojas alrededor (en JH) */
function copa(J, JH, cx, cy, cz, rad, n, cols, cHoja, r, nPl, tPl) {
  for (var i = 0; i < n; i++) { var b = new THREE.IcosahedronGeometry(rad * (.6 + r() * .4), 1); b.scale(1, .75, 1);
    M.torcer(b, function (v) { var k = 1 + (r() - .5) * .18; v.multiplyScalar(k); });
    b.translate(cx + (r() - .5) * rad * 1.3, cy + (r() - .5) * rad * .6, cz + (r() - .5) * rad * 1.3); J.pieza(b, cols[i % cols.length]); }
  for (var j = 0; j < nPl; j++) { var p = new THREE.PlaneGeometry(tPl, tPl); p.userData.uvPropio = true;
    JH.pieza(p, cHoja, rot(r() * 6.3, r() * 6.3, r() * 6.3).setPosition(cx + (r() - .5) * rad * 2, cy + (r() - .5) * rad * 1.1, cz + (r() - .5) * rad * 2)); }
}
function tronco(J, r0, r1, h, col, curva, seg, m) { var t = new THREE.CylinderGeometry(r0, r1, h, seg || 7, 5); t.translate(0, h / 2, 0);
  M.torcer(t, function (v) { var u = v.y / h; v.x += Math.sin(u * 2.6) * curva; v.z += Math.sin(u * 1.7 + 1) * curva * .6; }); J.pieza(t, col, m || null, 3); }
/* las especies: cada una devuelve sus geometrías { solido?, cartas?, tex, alto } */
var ESPECIES = {
  ichu: function (r) { var J = new M.Junta(); manojo(J, .95, .8, M.col('#cdb064'), r); manojo(J, .6, .55, M.col('#b39a55'), r); return { cartas: J.geometria(), tex: texPasto(), mece: .07, alto: .8 }; },
  ichuNoche: function (r) { var J = new M.Junta(); manojo(J, .95, .8, M.col('#b6c4e2'), r); manojo(J, .6, .55, M.col('#dfe8f8'), r); return { cartas: J.geometria(), tex: texPasto(), mece: .07, alto: .8 }; },
  grama: function (r) { var J = new M.Junta(); manojo(J, .7, .4, M.col('#7f9c4a'), r); return { cartas: J.geometria(), tex: texPasto(), mece: .08, alto: .4 }; },
  gramaSeca: function (r) { var J = new M.Junta(); manojo(J, .7, .42, M.col('#b9a06a'), r); return { cartas: J.geometria(), tex: texPasto(), mece: .08, alto: .42 }; },
  totora: function (r) { var J = new M.Junta(); manojo(J, .9, 1.9, M.col('#8ea456'), r); manojo(J, .7, 1.5, M.col('#a7ad62'), r); return { cartas: J.geometria(), tex: texPasto(), mece: .035, alto: 1.9 }; },
  piedra: function (r, mundo) { var J = new M.Junta(), col = { sierra: '#8f897e', noche: '#4f566e', desierto: '#b39a76' }[mundo.id] || '#8f897e';
    var p = new THREE.DodecahedronGeometry(.5, 0); M.torcer(p, function (v) { v.multiplyScalar(.85 + r() * .3); }); p.scale(1.25, .6, 1); p.translate(0, .12, 0); J.pieza(p, M.col(col));
    return { solido: J.geometria(), alto: .5, plano: true }; },
  quenua: function (r) { var J = new M.Junta(), JH = new M.Junta(), cT = M.col('#9a5a3c');
    tronco(J, .08, .16, 2.2, cT, .25, 6);
    [-1, 1].forEach(function (l) { var b = new THREE.CylinderGeometry(.035, .06, 1.1, 5); b.translate(0, .55, 0); J.pieza(b, cT, rot(0, 0, l * .7).setPosition(l * .05, 1.3, 0)); });
    copa(J, JH, 0, 2.45, 0, .7, 4, [M.col('#34502a'), M.col('#3e5d30'), M.col('#2d4624')], M.col('#5a7a3c'), r, 10, 1.1);
    return { solido: J.geometria(), cartas: JH.geometria(), tex: texHojas(), mece: .006, alto: 3.2, sombra: true }; },
  algarrobo: function (r) { var J = new M.Junta(), JH = new M.Junta(), cT = M.col('#5a4632');
    tronco(J, .14, .24, 1.5, cT, .3, 7);
    for (var k = 0; k < 3; k++) { var b = new THREE.CylinderGeometry(.05, .09, 1.4, 5); b.translate(0, .7, 0); J.pieza(b, cT, rot(0, k * 2.1, .9).setPosition(0, 1.3, 0)); }
    for (var c = 0; c < 6; c++) { var co = new THREE.IcosahedronGeometry(.75 + r() * .35, 1); co.scale(1.5, .42, 1.3); co.translate((r() - .5) * 2.2, 2 + (r() - .3) * .35, (r() - .5) * 2.2); J.pieza(co, [M.col('#5f6e34'), M.col('#71803c'), M.col('#566430')][c % 3]); }
    for (var j = 0; j < 12; j++) { var p = new THREE.PlaneGeometry(1.2, 1.2); p.userData.uvPropio = true; JH.pieza(p, M.col('#7a8a44'), rot(-1.3 + r() * .6, r() * 6.3, 0, 'YXZ').setPosition((r() - .5) * 3, 2.1 + r() * .3, (r() - .5) * 3)); }
    return { solido: J.geometria(), cartas: JH.geometria(), tex: texHojas(), mece: .006, alto: 3, sombra: true }; },
  cactus: function (r) { var J = new M.Junta(), cC = M.col('#5f8a50');
    function columna(rad, h, m) { var t = new THREE.CylinderGeometry(rad * .92, rad, h, 10, 2);   /* 10 lados: 8 costillas bastan de lejos */ t.translate(0, h / 2, 0);
      M.torcer(t, function (v) { var a = Math.atan2(v.z, v.x), k = 1 + .14 * Math.cos(a * 5); v.x *= k; v.z *= k; });   /* las costillas */
      J.pieza(t, cC, m); var tapa = new THREE.SphereGeometry(rad * .92, 10, 3, 0, 6.283, 0, 1.5); tapa.translate(0, h, 0); J.pieza(tapa, M.col('#6f9a5c'), m); }
    columna(.17, 2.3, null); var nb = 1 + (r() * 2.5 | 0);
    for (var k = 0; k < nb; k++) { var a = k * 2.4 + r(), hb = .5 + r() * .7, m = rot(0, a, 0).multiply(new M4().makeTranslation(.32, hb, 0));
      var codo = new THREE.CylinderGeometry(.11, .12, .34, 8); codo.rotateZ(Math.PI / 2); J.pieza(codo, cC, rot(0, a, 0).multiply(new M4().makeTranslation(.17, hb, 0)));
      columna(.12, .7 + r() * .7, m); }
    return { solido: J.geometria(), alto: 2.4, sombra: true }; },
  palmera: function (r) { var J = new M.Junta(), JH = new M.Junta(), h = 5.2, cur = .45;
    var t = new THREE.CylinderGeometry(.11, .17, h, 7, 8); t.translate(0, h / 2, 0); M.torcer(t, function (v) { v.x += Math.pow(v.y / h, 2) * cur; v.x *= 1 + .06 * Math.sin(v.y * 9); v.z *= 1 + .06 * Math.sin(v.y * 9); });
    J.pieza(t, M.col('#8a7458'), null, 3);
    for (var k = 0; k < 11; k++) { var hj = new THREE.PlaneGeometry(.6, 2.5, 1, 5); hj.translate(0, 1.25, 0); M.torcer(hj, function (v) { v.z -= v.y * v.y * .26; }); hj.userData.uvPropio = true;   /* la hoja cae (con el giro de abajo, +z apuntaba al cielo) */
      JH.pieza(hj, [M.col('#4f8a3a'), M.col('#62a046'), M.col('#3f7a32')][k % 3], rot(-1.05 + r() * .35, k / 11 * 6.283 + r() * .2, 0, 'YXZ').setPosition(cur, h, 0)); }
    return { solido: J.geometria(), cartas: JH.geometria(), tex: texPluma(), mece: .0045, alto: 5.5, sombra: true }; },
  ficus: function (r) { var J = new M.Junta();
    var mac = new THREE.CylinderGeometry(.55, .46, .4, 14); mac.translate(0, .2, 0); J.pieza(mac, M.col('#ece4d2'));
    var tierra = new THREE.CylinderGeometry(.5, .5, .04, 14); tierra.translate(0, .41, 0); J.pieza(tierra, M.col('#5b4330'));
    tronco(J, .07, .1, 1.3, M.col('#6b5a45'), .04, 6);
    var b = new THREE.IcosahedronGeometry(.95, 2); b.scale(1, .9, 1); M.torcer(b, function (v) { v.multiplyScalar(.95 + r() * .09); }); b.translate(0, 1.95, 0); J.pieza(b, M.col('#2f5a2a'));
    return { solido: J.geometria(), alto: 2.9, sombra: true }; },
  jardin: function (r) { var J = new M.Junta();
    var s = new THREE.BoxGeometry(1.7, .34, .7, 6, 2, 3); M.torcer(s, function (v) { v.y += (r() - .5) * .05; v.x *= 1 + (r() - .5) * .03; }); s.translate(0, .17, 0); J.pieza(s, M.col('#3b6b30'));
    var bor = new THREE.BoxGeometry(1.86, .12, .84); bor.translate(0, .06, 0); J.pieza(bor, M.col('#d9d0bd'));
    var cols = ['#e23b4a', '#ffd23f', '#e2508a', '#ffffff', '#ff8a3d', '#9a5ad8'];
    for (var k = 0; k < 26; k++) { var f = new THREE.IcosahedronGeometry(.055, 0); f.translate((r() - .5) * 1.5, .36 + r() * .05, (r() - .5) * .55); J.pieza(f, M.col(cols[k % cols.length])); }
    return { solido: J.geometria(), alto: .45 }; },
  puya: function (r) { var J = new M.Junta();
    for (var k = 0; k < 46; k++) { var c = new THREE.ConeGeometry(.04, 1.1, 3); c.translate(0, .55, 0); J.pieza(c, M.col(k % 2 ? '#7c8f6a' : '#93a47c'), rot(.35 + r() * 1.1, r() * 6.283, 0, 'YXZ').setPosition(0, .35, 0)); }
    var e = new THREE.CylinderGeometry(.2, .3, 3.1, 10, 8); e.translate(0, 2, 0); M.torcer(e, function (v) { v.x *= 1 + .12 * Math.sin(v.y * 11 + Math.atan2(v.z, v.x) * 5); v.z *= 1 + .12 * Math.cos(v.y * 11); });
    J.pieza(e, M.col('#b9b48a')); var p = new THREE.ConeGeometry(.2, .5, 10); p.translate(0, 3.8, 0); J.pieza(p, M.col('#a9a37a'));
    return { solido: J.geometria(), alto: 4, sombra: true }; },
  arbol: function (r) { var J = new M.Junta(), JH = new M.Junta(), h = 8;
    tronco(J, .22, .36, h, M.col('#7a6a55'), .35, 8);
    for (var k = 0; k < 4; k++) { var ra = new THREE.BoxGeometry(.08, 1.3, 1); ra.translate(0, .5, .5); M.torcer(ra, function (v) { v.z *= 1 - v.y * .35; }); J.pieza(ra, M.col('#6a5a46'), rot(0, k * 1.57 + r() * .4, 0)); }   /* raíces tablares */
    copa(J, JH, 0, h + .4, 0, 1.9, 6, [M.col('#2f5a24'), M.col('#3b6a2c'), M.col('#27501f')], M.col('#4f8a36'), r, 18, 2);
    return { solido: J.geometria(), cartas: JH.geometria(), tex: texHojas(), mece: .0012, alto: 9.5, sombra: true }; },
  platano: function (r) { var J = new M.Junta(), JH = new M.Junta();
    tronco(J, .09, .14, 1.6, M.col('#7f9c4c'), .05, 7);
    for (var k = 0; k < 7; k++) { var hj = new THREE.PlaneGeometry(.75, 2.2, 1, 5); hj.translate(0, 1.1, 0); M.torcer(hj, function (v) { v.z -= v.y * v.y * .2; }); hj.userData.uvPropio = true;
      JH.pieza(hj, [M.col('#5aa040'), M.col('#6db04a'), M.col('#4c8c36')][k % 3], rot(-.75 + r() * .4, k / 7 * 6.283 + r() * .3, 0, 'YXZ').setPosition(0, 1.55, 0)); }
    return { solido: J.geometria(), cartas: JH.geometria(), tex: texHojaGrande(), mece: .012, alto: 2.9, sombra: true }; },
  helecho: function (r) { var J = new M.Junta();
    for (var k = 0; k < 8; k++) { var f = new THREE.PlaneGeometry(.32, 1.15, 1, 3); f.translate(0, .57, 0); M.torcer(f, function (v) { v.z -= v.y * v.y * .55; }); f.userData.uvPropio = true;
      J.pieza(f, [M.col('#3f8a3a'), M.col('#57a046'), M.col('#2f7230')][k % 3], rot(-.55 + r() * .3, k / 8 * 6.283 + r() * .3, 0, 'YXZ')); }
    return { cartas: J.geometria(), tex: texPluma(), mece: .05, alto: .9 }; }
};
/* qué se siembra en cada mundo: [especie, cuántas (celular bueno)] */
var PLAN = {
  sierra: [['ichu', 1300], ['quenua', 60], ['piedra', 140]],
  costa: [['totora', 380], ['palmera', 45], ['grama', 900]],
  desierto: [['algarrobo', 55], ['cactus', 90], ['piedra', 120], ['gramaSeca', 700]],
  ciudad: [['ficus', 60], ['jardin', 110], ['palmera', 30], ['grama', 700]],
  noche: [['ichuNoche', 1300], ['piedra', 150], ['puya', 14]],
  selva: [['arbol', 70], ['platano', 130], ['helecho', 700]]
};

/* el viento: mueve lo de arriba de cada plano según su altura (lo de abajo queda quieto), cada planta en su fase */
function mecer(mat, viento, fuerza) {
  var uF = { value: fuerza };
  mat.onBeforeCompile = function (sh) {
    sh.uniforms.uViento = viento; sh.uniforms.uFuerza = uF;
    sh.vertexShader = 'uniform float uViento;\nuniform float uFuerza;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  float fase = instanceMatrix[3].x * .37 + instanceMatrix[3].z * .23;\n#else\n  float fase = 0.;\n#endif\n' +
      '  float alt = max(0., position.y);\n  transformed.x += sin(uViento * 1.7 + fase) * uFuerza * alt * alt;\n  transformed.z += cos(uViento * 1.3 + fase * 1.3) * uFuerza * .6 * alt * alt;');
  };
}

M.flora = function (E, mundo, o) {
  var plan = PLAN[mundo.id]; if (!plan) return null;
  var sem = 0; for (var ci = 0; ci < mundo.id.length; ci++) sem = sem * 31 + mundo.id.charCodeAt(ci);
  var t0 = performance.now(), r = M.azar(sem + 7), baja = !!o.baja, W2 = o.W / 2, R = o.R || 74, viento = { value: 0 }, tipos = {}, mallas = [];
  var mGrano = M.texGrano(57, .35), ob = new THREE.Object3D(), cI = new THREE.Color();
  /* dónde: fuera de las vallas, más denso cerca de la pista, nunca en la largada (tribunas, banderas, globos) ni en el mar */
  function sembrar(n, dMin, dMax, sep) {
    var out = [], grid = {}, intentos = 0;
    while (out.length < n && intentos < n * 30) { intentos++;
      var x = (r() * 2 - 1) * R, z = (r() * 2 - 1) * R; if (x * x + z * z > R * R) continue;
      if (o.fuera && o.fuera(x, z)) continue;
      var q = o.sitio(x, z), d = q[0]; if (d < dMin || d > dMax) continue;
      if (d < 19 && o.largada && o.largada(x, z)) continue;
      if (o.permitido && !o.permitido(x, z, d, q[1])) continue;
      if (r() > 1 - .7 * M.suave(dMin, dMax, d)) continue;
      if (sep) { var k = Math.floor(x / sep) + ',' + Math.floor(z / sep); if (grid[k]) continue; grid[k] = 1; }
      out.push([x, z]); }
    return out;
  }
  plan.forEach(function (fila) {
    var nombre = fila[0], n = baja ? Math.round(fila[1] * .42) : fila[1], esp = ESPECIES[nombre](r, mundo), alto = esp.alto;
    var bajo = alto < 1.6, lugares = sembrar(n, W2 + (bajo ? 3.2 : 7) + (nombre === 'puya' ? 1 : 0), bajo ? 42 : 58, bajo ? 0 : (alto > 6 ? 4.5 : 3));
    if (!lugares.length) return;
    var partes = [];
    if (esp.solido) partes.push(new THREE.InstancedMesh(esp.solido, new THREE.MeshStandardMaterial({ vertexColors: true, map: mGrano, roughness: .95, flatShading: !!esp.plano }), lugares.length));
    if (esp.cartas) { var mc = new THREE.MeshStandardMaterial({ vertexColors: true, map: esp.tex, alphaTest: esp.tex === texPasto() ? .35 : .5, side: THREE.DoubleSide, roughness: .85 }); mecer(mc, viento, esp.mece || 0);
      partes.push(new THREE.InstancedMesh(esp.cartas, mc, lugares.length)); }
    lugares.forEach(function (p, i) {
      var y = o.alto(p[0], p[1]), s = bajo ? .75 + r() * .6 : .8 + r() * .55;
      ob.position.set(p[0], y - (bajo ? .03 : .12), p[1]); ob.rotation.set(bajo ? (r() - .5) * .15 : 0, r() * 6.283, bajo ? (r() - .5) * .15 : 0); ob.scale.set(s, s * (.85 + r() * .3), s); ob.updateMatrix();
      var k = .86 + r() * .28; cI.setRGB(k, k * (.96 + r() * .08), k * (.94 + r() * .06));
      partes.forEach(function (im) { im.setMatrixAt(i, ob.matrix); im.setColorAt(i, cI); });
    });
    partes.forEach(function (im) { im.userData.alto = alto; im.userData.especie = nombre; im.frustumCulled = false;
      im.castShadow = !baja && !!esp.sombra; im.receiveShadow = !baja; if (im.instanceColor) im.instanceColor.needsUpdate = true; E.add(im); mallas.push(im); });
    tipos[nombre] = lugares.length;
  });
  return { tipos: tipos, mallas: mallas, viento: viento, ms: Math.round(performance.now() - t0), actualizar: function (t) { viento.value = t; } };   /* ms: lo que tardó en armarse */
};
})();

;
/* Ruway — LOS MUNDOS. lugares.js: lo emblemático de cada lugar en La gran carrera (3c, parte 3, 7-nov-2026).
   Lo que vive en lejos.js (el mar y el muelle de Huanchaco, la catedral, los nevados) se agranda allí con opciones que solo
   pasa la carrera. Aquí va lo que es solo de la carrera:
     ciudad ... el Monumento a la Libertad en el centro de la Plaza de Armas: gradas, pedestal, la columna y la figura
                alada con su antorcha (blanco, como el de Trujillo; hecho aquí, sin modelos de nadie)
     noche .... estrellas que titilan (una capa de las más brillantes, sobre las de cielo.js)
   M.lugares(E, mundo, { cielo, alto(x,z), baja }) → { monumento?, titilan?, actualizar(t) } */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4;

function monumento(E, o) {
  var J = new M.Junta(), BL = M.col('#efe9dd'), PI = M.col('#d9d3c7'), y0 = o.alto ? o.alto(0, 0) : 0;
  [[4.4, .45], [3.7, .45], [3, .45]].forEach(function (g, i) { var c = new THREE.CylinderGeometry(g[0], g[0] + .1, g[1], 32); c.translate(0, g[1] / 2 + i * g[1], 0); J.pieza(c, PI); });   /* las gradas */
  J.caja(2.6, 2.6, 2.6, 0, 1.35 + 1.3, 0, BL);                                       /* el pedestal */
  J.caja(3, .3, 3, 0, 1.35 + 2.75, 0, PI); J.caja(2.8, .25, 2.8, 0, 1.5, 0, PI);
  [0, 1, 2, 3].forEach(function (k) { var a = k * Math.PI / 2;                        /* los relieves del pedestal (placas) */
    J.caja(1.6, 1.4, .06, 0, 2.6, 1.33, M.col('#cfc6b6'), new M4().makeRotationY(a)); });
  var col = new THREE.CylinderGeometry(.48, .62, 8.6, 20, 6); col.translate(0, 4.2 + 4.3, 0);
  M.torcer(col, function (v) { var a = Math.atan2(v.z, v.x), k = 1 + .035 * Math.cos(a * 12); v.x *= k; v.z *= k; });   /* estrías */
  J.pieza(col, BL);
  J.caja(1.3, .35, 1.3, 0, 12.95, 0, PI); J.caja(1.1, .2, 1.1, 0, 13.22, 0, BL);   /* el capitel */
  /* la figura de la Libertad: cuerpo con túnica, cabeza, el brazo en alto con la antorcha y las alas */
  var cu = new THREE.CylinderGeometry(.22, .42, 1.5, 12); cu.translate(0, 13.3 + .75, 0); J.pieza(cu, BL);
  var ca = new THREE.SphereGeometry(.2, 14, 10); ca.translate(0, 15.25, 0); J.pieza(ca, BL);
  var br = new THREE.CylinderGeometry(.06, .07, .9, 8); br.translate(0, .45, 0); br.applyMatrix4(new M4().makeRotationZ(-.35)); br.translate(.18, 14.6, 0); J.pieza(br, BL);
  var an = new THREE.CylinderGeometry(.07, .04, .35, 8); an.translate(.5, 15.55, 0); J.pieza(an, M.col('#c9b98f'));
  var JF = new M.Junta(), fl = new THREE.ConeGeometry(.12, .32, 8); fl.translate(.5, 15.88, 0); JF.pieza(fl, M.col('#ffb347'));
  [-1, 1].forEach(function (l) { var al = new THREE.PlaneGeometry(1.1, 1.5, 3, 3); al.translate(.55, .2, 0);
    M.torcer(al, function (v) { v.z += Math.sin(v.x * 2.2) * .18; v.y += v.x * v.x * .25; });
    al.applyMatrix4(new M4().makeRotationY(l > 0 ? -2.6 : -.54)); al.translate(0, 14.6, -.15); J.pieza(al, BL); });
  var m = new THREE.Mesh(J.geometria({ oscuroAbajo: [.82, 1.4] }), new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(61, .18), roughness: .55, side: THREE.DoubleSide }));
  m.position.set(0, y0 - .05, 0); m.castShadow = !o.baja; m.receiveShadow = true; m.userData.lugar = 'monumento';
  var llama = new THREE.Mesh(JF.geometria(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); m.add(llama);
  E.add(m); return m;
}

/* las estrellas que titilan: las más brillantes, cada una con su ritmo */
function titilan(cielo, n) {
  var pos = new Float32Array(n * 3), fase = new Float32Array(n), tam = new Float32Array(n), r = M.azar(91);
  for (var i = 0; i < n; i++) { var u = r() * .9 + .08, a = r() * 6.283, h = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(a) * h * 84; pos[i * 3 + 1] = u * 84; pos[i * 3 + 2] = Math.sin(a) * h * 84; fase[i] = r() * 6.283; tam[i] = 2 + r() * 3.5; }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('fase', new THREE.BufferAttribute(fase, 1)); g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  /* uPx: el tamaño en píxeles de pantalla (en celulares de mucha densidad salían de 1 px) */
  var mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uMapa: { value: M.texBrillo() }, uPx: { value: M._R ? M._R.getPixelRatio() : 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute float fase; attribute float tam; uniform float uT; uniform float uPx; varying float vB;\n' +
      'void main() { vB = .55 + .45 * sin(uT * (1.3 + fract(fase * 3.7) * 2.2) + fase); gl_PointSize = tam * uPx * (.7 + .5 * vB); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform sampler2D uMapa; varying float vB;\nvoid main() { vec4 c = texture2D(uMapa, gl_PointCoord); gl_FragColor = vec4(vec3(1., .97, .9) * c.a * vB, c.a * vB); }' });
  var p = new THREE.Points(g, mat); p.renderOrder = -8; p.frustumCulled = false; cielo.g.add(p); return p;
}

M.lugares = function (E, mundo, o) {
  var out = { actualizar: function () {} }, tit = null;
  if (mundo.id === 'ciudad') out.monumento = monumento(E, o);
  if (mundo.id === 'noche' && o.cielo && o.cielo.g) { tit = titilan(o.cielo, o.baja ? 160 : 320); out.titilan = tit; }
  out.actualizar = function (t) { if (tit) tit.material.uniforms.uT.value = t; };
  return out;
};
})();

;
/* Ruway — LOS MUNDOS. ciudad.js: Trujillo como circuito urbano (7-nov-2026, pedido del dueño: «que pueda ingresar a la
   ciudad y se vea bien la ciudad como lo sería una verdadera… lo más realistas que se pueda»).
   La pista pasa por calles de casonas coloniales a tamaño real (el auto mide 1,2; una casona de dos pisos, unos 6,8):
     · fachadas continuas a los dos lados, de los colores del centro de Trujillo, con zócalo, pilastras y cornisas blancas;
     · abajo, portones de madera con sus tableros y ventanas con rejas de fierro; arriba, balcones de cajón (madera, con su
       celosía, sus canes y su techito de tejas), balcones abiertos con baranda y ventanas, alguna encendida;
     · faroles de pared encendidos y, cada tanto, una bocacalle: una calle que entra a la ciudad con sus casonas
       (con bolardos: el auto sigue por la pista);
     · la largada no lleva casas: de un lado la catedral (M.catedral) y del otro la plaza.
   Las casonas salen de plantillas (largo × variante) que se arman una vez; cada tramo de la vuelta junta sus piezas por
   material en una sola malla (pocas llamadas de dibujo, y lo que no se ve se recorta). Hecho aquí, sin modelos de nadie.

   8-nov: Huanchaco por el malecón. La misma calle con otra plantilla (casas y restaurantes de playa de 2 o 3 pisos, con
   letrero, toldo y ramadas de caña, terrazas de madera) y, del lado del mar, el malecón (M.malecon): vereda, murete y
   baranda blanca con sus balaustres, postes de luz y una pasarela de madera que baja al muelle.

   8-nov: Chan Chan por dentro de la ciudadela. Plantilla 'muralla': muros de barro de 7,6 a 8 m (rectos abajo, en talud arriba,
   el borde gastado, las líneas del tapial) con frisos a la altura del auto (red de rombos, peces o aves marinas, en relieve) o
   lisos; entradas angostas a patios con su audiencia (el recinto en U), sin faroles. Y M.plazaCeremonial: la plataforma con su
   rampa y su friso de olas, a un costado de la largada.

   9-nov: Los Andes, un pueblo andino. Plantilla 'andina': casas de adobe encaladas de 1 y 2 pisos, zócalo pintado o de piedra,
   puertas y ventanas de madera pintada, balcón corrido, techo de teja a dos aguas con alero y, en algunas, la cruz con sus
   toritos. Y lo de alrededor: M.iglesiaAndina (nave, torre campanario, portada y atrio con su cruz), M.pileta (la plaza),
   M.pircas (muros de piedra suelta en el campo) y M.andenes (un cerro con terrazas de cultivo).
   9-nov: la Amazonía. Plantilla 'palafito': casas de tablas pintadas sobre pilotes, con terraza, baranda y escalera, y techo
   de caña a dos aguas (la fachada, más atrás: a 3,6 m del asfalto, por la escalera). Y M.tunelSelva (árboles gigantes con raíces
   tablares y sus copas en bóveda sobre la pista), M.puenteMadera (vigas, barandas, pilotes y cabezales del puente) y M.canoas.
   9-nov: la noche andina, el mismo pueblo de noche (o.noche): ventanas y puertas encendidas, faroles con su charco de luz en
   la vereda, la iglesia iluminada y faroles en la plaza. Sin luces de verdad (cuestan en el celular): lo que brilla, brilla solo.
   9-nov: la catedral de Trujillo con su detalle (M.catedral): la portada de dos cuerpos, las torres con su campanario abierto
   y sus campanas, la nave con contrafuertes y la cúpula. Antes la hacía lejos.js con cajas lisas (el laberinto la sigue usando).

   M.ciudad(E, mundo, { pos, dir, L, W, alto(x,z), dist(x,z), baja, env, sIni, sFin, plantilla?, semilla?, saltar? })
     plantilla: 'casona' (Trujillo, la de siempre), 'playa' (Huanchaco), 'muralla' (Chan Chan) o 'andina' (Los Andes)
     saltar({a, b, Z, fondo, lado, s}) → true: ahí no va casa (el lado del mar)
     → { tipo, modulos: [{s, d, alto, tipo, x, z}], cuenta, mallas, mats, ocupa(x,z), ms }
   M.plazaCeremonial(E, { pos, dir, W, alto(x,z), dist(x,z), baja, mats, s, lado }) → { x, z, rampa, mallas, ocupa(x,z) }
   M.malecon(E, { pos, yEn(s, off), L, W, lado, enMar(s), mats, baja, muelleX?, muelleY?, muelleAncho?, orilla? })
     → { metros, faroles, mallas, ocupa(x,z), ms }
   M.catedral(E, { pos, dir, W, alto(x,z), dist(x,z), baja, mats, s, lado }) → { g, x, z, alto }
     g: THREE.Group con userData { cuenta, vanos (rayos que cruzan cada campanario), puerta, ancho, ocupa(x,z), ms } */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4, V3 = THREE.Vector3;
var COLORES = ['#e9b949', '#3e6fb0', '#c9443b', '#6fb3a0', '#d9774a', '#efe0b6', '#7fb2d6', '#e48a9a', '#b8c46a', '#f0c27a'];
var FA = 2.65;            /* la fachada, a 2,65 del borde del asfalto (la vereda va de 0,55 a 2,62) */
var LARGOS = [5.6, 6.4, 7.2, 8], BOCA = 8, FONDO = 20, DETRAS = 6;   /* la calle lateral: sus casas empiezan detrás de las de la esquina */
var UVK = { muro: .62, madera: .55, tejas: .45, cana: .5, piedra: .45 };
var COLORES_PLAYA = ['#f4efe6', '#7cc6d6', '#f2d16b', '#3fa7a0', '#e98c6a', '#a7d3a6', '#ffffff', '#6aa6d8', '#f6b38e', '#d9e8ef', '#f5e6a8', '#9fd8e6'];
/* los negocios de la playa: 64 nombres inventados (sin marcas ni negocios reales conocidos), tipo + nombre */
var NEGOCIOS = [
  ['CEVICHERÍA', 'La Ola Brava'], ['PICANTERÍA', 'Doña Charo'], ['MARISCOS', 'El Pescador'], ['RESTAURANTE', 'Caleta Azul'],
  ['JUGUERÍA', 'La Huanchaquera'], ['HOSPEDAJE', 'Las Totoras'], ['CEVICHERÍA', 'El Caballito'], ['HELADERÍA', 'La Concha'],
  ['BODEGA', 'San Pedrito'], ['RESTAURANTE', 'El Muelle Viejo'], ['PICANTERÍA', 'El Norteño'], ['CEVICHERÍA', 'Tres Olas'],
  ['POLLERÍA', 'El Gaviotín'], ['HOSTAL', 'Puesta de Sol'], ['MARISCOS', 'La Lancha'], ['CAFETERÍA', 'La Caleta'],
  ['CEVICHERÍA', 'Marea Alta'], ['PANADERÍA', 'Santa Rosa'], ['RESTAURANTE', 'Las Gaviotas'], ['ARTESANÍAS', 'El Totoral'],
  ['PICANTERÍA', 'La Mochica'], ['CEVICHERÍA', 'Doña Petita'], ['JUGUERÍA', 'Mango y Mar'], ['HOSTAL', 'Arena Blanca'],
  ['MARISCOS', 'Mar Adentro'], ['RESTAURANTE', 'El Ancla'], ['CHICHARRONERÍA', 'Don Cucho'], ['CEVICHERÍA', 'El Remo'],
  ['BODEGA', 'Don Pepe'], ['RESTAURANTE', 'Viento Sur'], ['PICANTERÍA', 'Doña Meche'], ['ESCUELA DE TABLA', 'Ola Norte'],
  ['CEVICHERÍA', 'Los Pelícanos'], ['HOSPEDAJE', 'Brisas del Norte'], ['MARISCOS', 'El Cardumen'], ['RESTAURANTE', 'La Totora'],
  ['SANGUCHERÍA', 'El Chalán'], ['CEVICHERÍA', 'Brisa Marina'], ['HELADERÍA', 'El Barquillo'], ['RESTAURANTE', 'Arena y Sal'],
  ['PICANTERÍA', 'Mama Julia'], ['PESCADERÍA', 'San Pedro'], ['CEVICHERÍA', 'Don Lucho'], ['HOSTAL', 'La Perla'],
  ['RESTAURANTE', 'Mirador del Mar'], ['JUGUERÍA', 'Doña Flor'], ['MARISCOS', 'Puerto Viejo'], ['CAFETERÍA', 'Café del Muelle'],
  ['CEVICHERÍA', 'La Red de Oro'], ['POLLERÍA', 'La Brasa Norteña'], ['RESTAURANTE', 'El Faro'], ['BAZAR', 'Don Manuel'],
  ['PANADERÍA', 'El Horno de Barro'], ['CEVICHERÍA', 'Siete Mares'], ['HOSPEDAJE', 'Casa del Pescador'], ['ARTESANÍAS', 'Manos de Barro'],
  ['PICANTERÍA', 'El Tumi'], ['RESTAURANTE', 'Sol y Totora'], ['LAVANDERÍA', 'Espuma'], ['CEVICHERÍA', 'El Pulpo Feliz'],
  ['BODEGA', 'La Esquina'], ['MARISCOS', 'Mar de Fondo'], ['RESTAURANTE', 'La Caña Brava'], ['JUGUERÍA', 'Fresca Mañana']];
var ATLAS = null, AT_COL = 2, AT_FIL = 32, AT_ASP = 8;   /* 2 × 32 letreros de 512 × 64 (en los celulares flojos, a la mitad) */
function texLetreros(baja) {   /* cada letrero con su estilo: fondo, borde, su dibujito según el negocio, el tipo arriba y el nombre grande */
  if (ATLAS) return ATLAS;
  var k = baja ? .5 : 1, c = M.lienzo(1024 * k, 2048 * k), g = c.getContext('2d'), r = M.azar(64);
  var fondos = ['#fdf6e3', '#e8f4f7', '#fff3d6', '#f2f7ec', '#1f4e79', '#a8322d', '#1d6b5f', '#f7e1d7', '#fef9ef', '#2b3a55'];
  var tintas = ['#1f4e79', '#a8322d', '#1d6b5f', '#7a3e8a', '#c0602a', '#2b3a55'];
  var letra = ['900 30px Nunito, Arial, sans-serif', 'italic 700 31px Georgia, serif', '800 29px "Trebuchet MS", Arial, sans-serif', '700 30px "Palatino Linotype", Georgia, serif'];
  g.scale(k, k);
  NEGOCIOS.forEach(function (n, i) { var x = (i % AT_COL) * 512, y = Math.floor(i / AT_COL) * 64, fo = fondos[i % fondos.length], oscuro = /^#(1f|a8|1d|2b)/.test(fo);
    var ti = tintas[(i * 5 + 1) % tintas.length], tx = oscuro ? '#fdf6e3' : tintas[(i * 3) % tintas.length];
    g.fillStyle = fo; g.fillRect(x, y, 512, 64);
    g.strokeStyle = oscuro ? '#f2d16b' : ti; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, 504, 56);
    if (i % 3 === 0) { g.fillStyle = oscuro ? '#f2d16b' : ti; g.fillRect(x + 4, y + 4, 504, 5); g.fillRect(x + 4, y + 55, 504, 5); }
    /* el dibujito, a la izquierda: pescado, casita, fruta, sol u olas, según el negocio */
    var cx = x + 38, cy = y + 32, t = n[0]; g.fillStyle = g.strokeStyle = oscuro ? '#f2d16b' : ti; g.lineWidth = 3;
    if (/CEVICH|MARISC|PESCAD/.test(t)) { g.beginPath(); g.ellipse(cx, cy, 15, 8, 0, 0, 6.283); g.fill(); g.beginPath(); g.moveTo(cx + 12, cy); g.lineTo(cx + 24, cy - 9); g.lineTo(cx + 24, cy + 9); g.closePath(); g.fill(); }
    else if (/HOST|HOSPED/.test(t)) { g.beginPath(); g.moveTo(cx - 16, cy); g.lineTo(cx, cy - 15); g.lineTo(cx + 16, cy); g.closePath(); g.fill(); g.fillRect(cx - 11, cy, 22, 14); }
    else if (/JUGU|HELAD/.test(t)) { g.beginPath(); g.arc(cx, cy + 3, 12, 0, 6.283); g.fill(); g.fillRect(cx - 2, cy - 17, 4, 9); }
    else if (/RESTAU|CAFET|PICANT/.test(t)) { g.beginPath(); g.arc(cx, cy, 11, 0, 6.283); g.fill(); for (var q = 0; q < 8; q++) { var a = q * .785; g.beginPath(); g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); g.stroke(); } }
    else { g.beginPath(); for (var w = 0; w < 3; w++) { g.moveTo(cx - 18, cy - 8 + w * 8); g.quadraticCurveTo(cx - 9, cy - 15 + w * 8, cx, cy - 8 + w * 8); g.quadraticCurveTo(cx + 9, cy - 1 + w * 8, cx + 18, cy - 8 + w * 8); } g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = tx;
    g.font = '800 13px Nunito, Arial, sans-serif'; g.fillText(t.split('').join(' '), x + 278, y + 17, 400);
    g.font = letra[(i * 7 + (r() * 4 | 0)) % letra.length]; g.fillText(n[1], x + 278, y + 42, 410); });
  ATLAS = M.tex(c, true, false); return ATLAS;
}
function letrero(w) {   /* un tablero que mira a la calle (-z): su letrero se elige casa por casa (ver M.ciudad) */
  var g = new THREE.PlaneGeometry(w, w / AT_ASP); g.rotateY(Math.PI); g.userData.uvPropio = true; return g;
}
function aCelda(geo, i) {   /* lleva el letrero (uv de 0 a 1) a su celda del atlas */
  var uv = geo.attributes.uv, col = i % AT_COL, fila = Math.floor(i / AT_COL);
  for (var k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / AT_COL, 1 - (fila + 1) / AT_FIL + uv.getY(k) / AT_FIL);
  return geo;
}

/* ---------- Chan Chan: los frisos en relieve (una imagen de 4 bandas: rombos, peces, aves y olas) ---------- */
var FRISOS = null, FR_FILAS = ['rombos', 'peces', 'aves', 'olas'], FR_ALTO = 2.8, FR_PER = FR_ALTO * 4;   /* cada banda: 1024 × 256, o sea 11,2 × 2,8 m */
function texFrisos(baja) {
  if (FRISOS) return FRISOS;
  var N = baja ? 512 : 1024, k = N / 1024, alto = M.lienzo(N, N), g = alto.getContext('2d'), rnd = M.azar(77), rr = M.ruido(16, rnd), r2 = M.ruido(64, rnd);
  g.scale(k, k); g.fillStyle = '#646464'; g.fillRect(0, 0, 1024, 1024);
  function marco(y0) { g.fillStyle = '#9c9c9c'; g.fillRect(0, y0 + 4, 1024, 18); g.fillRect(0, y0 + 234, 1024, 18); g.fillStyle = '#4a4a4a'; g.fillRect(0, y0 + 22, 1024, 5); g.fillRect(0, y0 + 229, 1024, 5); }
  FR_FILAS.forEach(function (tipo, f) {
    var y0 = f * 256, a0 = y0 + 30, a1 = y0 + 226; marco(y0);
    g.save(); g.beginPath(); g.rect(0, a0, 1024, a1 - a0); g.clip();
    if (tipo === 'rombos') {   /* la red de pescar: rombos chicos en relieve */
      g.strokeStyle = '#a4a4a4'; g.lineWidth = 15; for (var x = -256; x < 1280; x += 56) { g.beginPath(); g.moveTo(x, a0); g.lineTo(x + (a1 - a0), a1); g.stroke(); g.beginPath(); g.moveTo(x, a1); g.lineTo(x + (a1 - a0), a0); g.stroke(); }
      g.strokeStyle = '#4c4c4c'; g.lineWidth = 3; for (x = -256; x < 1280; x += 56) { g.beginPath(); g.moveTo(x + 7, a0); g.lineTo(x + 7 + (a1 - a0), a1); g.stroke(); }
    } else if (tipo === 'olas') {   /* la greca de olas: espirales escalonadas */
      g.fillStyle = '#a6a6a6'; for (x = 0; x < 1024; x += 128) { g.fillRect(x, a0 + 120, 128, 26); g.fillRect(x + 20, a0 + 44, 26, 102); g.fillRect(x + 20, a0 + 44, 84, 26); g.fillRect(x + 78, a0 + 70, 26, 42); g.fillRect(x + 52, a0 + 86, 52, 26); }
    } else {   /* peces o aves en sus casilleros hundidos */
      for (var q = 0; q < 8; q++) { var cx = 64 + q * 128, cy = (a0 + a1) / 2; g.fillStyle = '#525252'; g.fillRect(cx - 56, a0 + 10, 112, a1 - a0 - 20);
        g.save(); g.translate(cx, cy); if (q % 2) g.scale(-1, 1); g.fillStyle = '#ababab';
        if (tipo === 'peces') { g.beginPath(); g.moveTo(-44, 0); g.lineTo(-6, -30); g.lineTo(30, 0); g.lineTo(-6, 30); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(26, 0); g.lineTo(48, -22); g.lineTo(48, 22); g.closePath(); g.fill(); g.fillStyle = '#525252'; g.beginPath(); g.arc(-22, -6, 6, 0, 6.283); g.fill();
          g.fillRect(-4, -14, 4, 28); }
        else { g.fillRect(-36, -4, 58, 20); g.fillRect(-16, -30, 16, 28); g.fillRect(-16, -36, 46, 11); g.fillRect(18, 16, 9, 22); g.fillRect(-6, 16, 9, 22);
          g.beginPath(); g.moveTo(-36, -4); g.lineTo(-52, 8); g.lineTo(-36, 16); g.fill(); g.fillRect(22, -2, 22, 10); }
        g.restore(); }
    }
    g.restore();
  });
  /* poros, desgaste y grietas finas: el barro no es liso */
  var im = g.getImageData(0, 0, N, N), d = im.data;
  for (var y = 0; y < N; y++) for (var x2 = 0; x2 < N; x2++) { var i = (y * N + x2) * 4, n = (rr(x2 / 32 / k, y / 32 / k) - .5) * 30 + (r2(x2 / 4 / k, y / 4 / k) - .5) * 20; d[i] = d[i + 1] = d[i + 2] = M.lim(d[i] + n, 0, 255); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(im, 0, 0);
  /* el color: barro claro con la luz de arriba (el relieve también se pinta un poco, para que se lea de lejos); el tono lo da cada muro */
  var col = M.lienzo(N, N), gc = col.getContext('2d'), ic = gc.createImageData(N, N), c = ic.data;
  for (y = 0; y < N; y++) for (x2 = 0; x2 < N; x2++) { var j = (y * N + x2) * 4, h0 = d[j] / 255, hU = d[((Math.max(0, y - 2)) * N + x2) * 4] / 255, luz = M.lim(1 + (h0 - hU) * 2.4, .68, 1.28), n2 = .93 + rr(x2 / 20 / k + 3, y / 20 / k) * .14;
    c[j] = M.lim(206 * luz * n2 * (.82 + h0 * .3), 0, 255); c[j + 1] = M.lim(174 * luz * n2 * (.82 + h0 * .3), 0, 255); c[j + 2] = M.lim(134 * luz * n2 * (.82 + h0 * .3), 0, 255); c[j + 3] = 255; }   /* arena de Chan Chan */
  gc.putImageData(ic, 0, 0);
  var tc = M.tex(col, true, false), th = M.tex(alto, false, false); tc.userData.fuente = th.userData.fuente = 'frisos';
  return (FRISOS = { color: tc, relieve: th });
}
/* la banda del friso: un tablero que mira a la calle (-z), con la fila del friso que le toca */
function friso(w, fila) {
  var g = new THREE.PlaneGeometry(w, FR_ALTO); g.rotateY(Math.PI); var uv = g.attributes.uv;
  for (var k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / FR_PER, 1 - (fila + 1) / 4 + uv.getY(k) / 4);
  g.userData.uvPropio = true; return g;
}
var COLORES_BARRO = ['#ffffff', '#f6efe6', '#fbf4ea', '#efe6da', '#f8efe2', '#f2ebe3'];   /* casi blanco: el tono de arena lo dan el material (muros) y el dibujo (frisos); esto solo varía un poco de tramo a tramo */
var LARGOS_M = [6.4, 7.2, 8, 9.6];
/* ---------- la muralla de Chan Chan: x de 0 a len (la calle), z hacia adentro del muro (la cara en z = 0) ----------
   v: 0 friso de rombos · 1 de peces · 2 de aves · 3 liso (de 7,6 a 8 m de alto) */
function muralla(len, v, baja, fondo) {
  var r = M.azar(Math.round(len * 10) * 13 + v * 191 + (baja ? 7 : 0) + Math.round((fondo || 2.6) * 10)), P = { color: new M.Junta(), friso: new M.Junta() };
  var tipo = ['rombos', 'peces', 'aves', 'liso'][v], H = 7.6 + r() * .4, HV = 4.4,   /* casi la misma altura: se lee como una muralla seguida */ D = fondo || 2.6, B = [1, 1, 1], cuenta = {};
  var s1 = r() * 9, s2 = r() * 9;
  function gasto(x) { return Math.sin(x * 1.3 + s1) * .16 + Math.sin(x * 3.7 + s2) * .08; }   /* el borde de arriba gastado (igual en todas las caras: sin grietas) */
  function caja(J, w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); J.pieza(g, col || B); }
  /* el barro no es plano: la cara de la calle tiene bultos y huecos de la erosión (solo hacia adentro: no tapan el friso) */
  function bulto(x, y) { return Math.abs(Math.sin(x * 2.1 + s1) * Math.sin(y * 1.7 + s2)) * .07 + Math.abs(Math.sin(x * 5.3 + y * 3.1 + s2)) * .03; }
  /* abajo, recto (lleva el friso); arriba, en talud y gastado */
  var nx = baja ? 4 : Math.max(10, Math.round(len * 2.2));   /* la misma división abajo y arriba: la erosión empalma sin escalones */
  var gb = new THREE.BoxGeometry(len, HV + 1, D, baja ? 1 : nx, baja ? 1 : 5, 1); gb.translate(len / 2, (HV + 1) / 2 - 1, D / 2);
  if (!baja) M.torcer(gb, function (q) { if (q.z < .01 && q.y > 0 && (tipo === 'liso' || q.y < .85 || q.y > 4.0)) q.z += bulto(q.x, q.y); });
  P.color.pieza(gb, B);
  var gu = new THREE.BoxGeometry(len, H - HV, D, nx, baja ? 1 : 4, 1); gu.translate(len / 2, HV + (H - HV) / 2, D / 2);
  M.torcer(gu, function (q) { var t = (q.y - HV) / (H - HV); if (q.z < D / 2) q.z += .5 * t + (baja ? 0 : bulto(q.x, q.y) * (1 + t)); else q.z -= .25 * t;   /* en talud: la cara de la calle se mete medio metro */
    if (q.y > H - .01) q.y += gasto(q.x); });
  P.color.pieza(gu, B);
  /* las líneas del tapial (cada capa de barro apisonado), un poco más oscuras */
  var osc = [.84, .82, .8], paso = baja ? 1.1 : .55;
  for (var yt = .5; yt < HV - .2; yt += paso) if (tipo === 'liso' || yt < .85 || yt > 4.0) caja(P.color, len, .05, .16, len / 2, yt, .05, osc);   /* metidas en el barro: asoman donde la pared está entera */
  if (!baja) for (yt = HV + .6; yt < H - .5; yt += paso) { var gl = new THREE.BoxGeometry(len, .05, .2); gl.translate(len / 2, yt, .07 + .5 * (yt - HV) / (H - HV)); P.color.pieza(gl, osc); }
  if (tipo !== 'liso') {   /* la banda del friso, entre dos pilastras lisas */
    var fw = len - .7; P.friso.pieza(friso(fw, FR_FILAS.indexOf(tipo)).translate(len / 2, 1.0 + FR_ALTO / 2, -.03), B);
    [.17, len - .17].forEach(function (x) { caja(P.color, .34, FR_ALTO + .3, .06, x, 1.0 + FR_ALTO / 2, -.03, [.95, .95, .95]); });   /* sobresalen 6 cm: el auto llega a 7 cm del muro */
    caja(P.color, len, .14, .06, len / 2, 1.0 + FR_ALTO + .1, -.03, [.97, .97, .97]); caja(P.color, len, .14, .06, len / 2, .92, -.03, [.9, .9, .9]);
  }
  cuenta[tipo] = 1;
  var G = { color: P.color.geometria({ oscuroAbajo: [.74, 1.2] }) };
  if (P.friso.base) { G.friso = P.friso.geometria(); G.friso.userData.uvPropio = true; }
  return { geos: G, cuenta: cuenta, alto: H };
}
/* la audiencia: el recinto en U de barro, con sus hornacinas, abierto hacia la calle (-z) */
function audiencia(baja) {
  var J = new M.Junta(), Bc = [1, 1, 1], oscuro = [.42, .38, .34];
  function caja(w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); J.pieza(g, col || Bc); }
  caja(4.4, .5, 3.8, 0, .25 - .3, .4);                                     /* la tarima */
  caja(3.9, 2.5, .45, 0, 1.45, 1.9);                                      /* el fondo (entre los costados: sin caras pegadas) */
  [-1, 1].forEach(function (l) { caja(.45, 2.5, 3.0, l * 1.78, 1.45, .6); });   /* los costados */
  caja(4.3, .16, 3.4, 0, 2.78, .7, [.92, .92, .92]);                      /* el remate */
  [-1.1, 0, 1.1].forEach(function (x) { caja(.5, .7, .04, x, 1.5, 1.66, oscuro); });   /* hornacinas del fondo */
  if (!baja) [-1, 1].forEach(function (l) { [-.1, 1.0].forEach(function (z) { caja(.04, .7, .5, l * 1.54, 1.5, z, oscuro); }); });
  return J.geometria({ oscuroAbajo: [.72, .9] });
}

/* ---------- la noche andina: la luz cálida y el charco que deja en el suelo ---------- */
var CALIDAS = ['#ffd59a', '#ffcf8a', '#ffe2ad', '#f8c47c', '#ffdca0'];
var CHARCO = null, CHARCO_R = null, LAVADO = null;
function texCharco() {   /* medio óvalo de luz: fuerte junto a la pared (abajo de la imagen), se apaga hacia la calle */
  if (CHARCO) return CHARCO; var c = M.lienzo(128, 64), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,.75)'); gr.addColorStop(.45, 'rgba(255,196,120,.32)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
  return (CHARCO = M.tex(c, true, false)); }
function texCharcoRedondo() {   /* el charco de un farol de poste: redondo */
  if (CHARCO_R) return CHARCO_R; var c = M.lienzo(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,214,150,.7)'); gr.addColorStop(.5, 'rgba(255,196,120,.25)'); gr.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (CHARCO_R = M.tex(c, true, false)); }
function texLavado() {   /* la luz que sube por una fachada desde los reflectores: fuerte abajo, se apaga arriba */
  if (LAVADO) return LAVADO; var c = M.lienzo(16, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,205,140,.6)'); gr.addColorStop(.55, 'rgba(255,190,120,.22)'); gr.addColorStop(1, 'rgba(255,180,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 128);
  return (LAVADO = M.tex(c, true, false)); }
function matLuzAditiva(tex, op) { return new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: op || 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }); }
function brilloPuntos(pos, tam) { var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffcf7a', size: tam || 1.5, map: M.texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); }

/* ---------- la Amazonía: el palafito, casa de tablas sobre pilotes con techo de caña ----------
   x de 0 a len (la calle), z hacia adentro; adelante, la terraza (z de 0 a la pared) con su baranda y la escalera que baja a la
   calle (0,9 m). v: 0 y 1 tablas pintadas · 2 tablas al natural · 3 tienda (la puerta ancha abierta) */
var COLORES_PALAFITO = ['#9fd3c7', '#f2d16b', '#7cc6d6', '#e98c6a', '#c9e3a5', '#b9d7f0', '#f4efe6', '#f3b5a5'];
var PEND_CANA = .62;
function palafito(len, v, baja, fondo) {
  var r = M.azar(Math.round(len * 10) * 19 + v * 223 + (baja ? 13 : 0) + (fondo || 6) * 3), P = {};
  ['color', 'madera', 'cana', 'vidrio'].forEach(function (k) { P[k] = new M.Junta(); });
  var D = fondo || 6, HP = 1.7, HW = 2.5, B = [1, 1, 1], cO = M.col('#5a4030'), cM = M.col('#7a5a3e'), cuenta = { palafito: 1, escalera: 0, terraza: 0 };
  var terr = D >= 5 ? 1.5 : 1.0, yW = HP + .08 + HW, t = Math.tan(PEND_CANA), natural = v === 2;
  function caja(J, w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); J.pieza(g, col || B); }
  /* los pilotes y el piso */
  var nxp = Math.max(2, Math.round(len / 1.8));
  for (var i = 0; i <= nxp; i++) { var xp = .15 + i * (len - .3) / nxp;
    [.15, D / 2, D - .15].forEach(function (zp) { var g = new THREE.CylinderGeometry(.09, .12, HP + 1, baja ? 5 : 7); g.translate(xp, (HP + 1) / 2 - 1, zp); P.madera.pieza(g, cO); }); }
  caja(P.madera, len, .16, D, len / 2, HP, D / 2, cM);
  /* las paredes de tablas (pintadas o al natural) y sus líneas */
  caja(natural ? P.madera : P.color, len, HW, D - terr, len / 2, HP + .08 + HW / 2, terr + (D - terr) / 2, natural ? M.col('#9a7a58') : null);
  if (!baja) for (var y = HP + .38; y < HP + HW; y += .3) caja(P.madera, len, .025, .03, len / 2, y, terr - .015, M.col('#3a2c22'));
  /* la puerta y las ventanas con postigos */
  var nb = Math.max(2, Math.round(len / 2.2)), bw = len / nb, pu = r() * nb | 0;
  for (i = 0; i < nb; i++) { var xc = bw * (i + .5);
    if (i === pu) caja(v === 3 ? P.vidrio : P.madera, v === 3 ? 1.6 : 1.0, 2.0, .05, xc, HP + 1.08, terr - .03, v === 3 ? null : cO);   /* la tienda: la puerta ancha, abierta */
    else { caja(P.vidrio, .9, .8, .04, xc, HP + 1.55, terr - .02); if (!baja) [-1, 1].forEach(function (l) { caja(P.madera, .44, .82, .04, xc + l * .68, HP + 1.55, terr - .04, cM); }); } }
  /* la terraza: su baranda (con el hueco de la escalera) y los pies derechos que sostienen el alero */
  var xe = r() < .5 ? .8 : len - .8;
  [[.05, xe - .55], [xe + .55, len - .05]].forEach(function (q) { var a = q[0], b = q[1]; if (b - a < .3) return;
    caja(P.madera, b - a, .07, .07, (a + b) / 2, HP + .95, .06, cM); caja(P.madera, b - a, .05, .05, (a + b) / 2, HP + .45, .06, cM);
    if (!baja) for (var xb = a; xb <= b; xb += .45) caja(P.madera, .05, .9, .05, xb, HP + .5, .06, cO); });
  [.12, len / 2, len - .12].forEach(function (x) { caja(P.madera, .12, yW - HP, .12, x, (HP + yW) / 2, .1, cO); });
  cuenta.terraza++;
  /* la escalera que baja a la calle (0,9 m hacia afuera) */
  for (var k = 0; k < 5; k++) caja(P.madera, .85, .05, .26, xe, HP - .06 - k * .34, -.05 - k * .18, cM);
  [-1, 1].forEach(function (l) { var g = new THREE.BoxGeometry(.06, .2, 2.0); g.rotateX(-1.08); g.translate(xe + l * .45, HP / 2, -.42); P.madera.pieza(g, cO); });
  cuenta.escalera++;
  /* el techo de caña a dos aguas: la cumbrera a lo largo de la calle, alero de 0,7 adelante (sobre la escalera) y atrás */
  var z0 = -.7, z1 = D / 2, z2 = D + .7, hR = D / 2 * t;
  faldon(P.cana, len + .02, Math.hypot(z1 - z0, (z1 - z0) * t), -PEND_CANA, len / 2, yW + ((z0 + z1) / 2) * t + .06, (z0 + z1) / 2);
  faldon(P.cana, len + .02, Math.hypot(z2 - z1, (z2 - z1) * t), PEND_CANA, len / 2, yW + hR - ((z2 - z1) / 2) * t + .06, (z1 + z2) / 2);
  faldon(P.cana, len + .04, .5, 0, len / 2, yW + hR + .12, z1);
  hastial(natural ? P.madera : P.color, .1, yW, D, hR, natural ? M.col('#9a7a58') : null); hastial(natural ? P.madera : P.color, len - .1, yW, D, hR, natural ? M.col('#9a7a58') : null);
  var G = {}; Object.keys(P).forEach(function (kk) { if (P[kk].base) G[kk] = P[kk].geometria(kk === 'color' ? { oscuroAbajo: [.85, 2.4] } : null); });
  if (G.cana) G.cana.userData.uvPropio = true;
  return { geos: G, cuenta: cuenta, alto: yW + hR + .12 };
}

/* ---------- Los Andes: la casa de adobe encalada con techo de teja ---------- */
var COLORES_ANDINA = ['#f7f3eb', '#f2ead9', '#efe2c6', '#f8f6f1', '#ead8b2', '#f3ecdf', '#e7d0a6', '#faf7f2'];   /* blanco de cal, crema y ocre */
var ZOCALOS = ['#2f5f9e', '#3b7d4f', '#a33a2f', '#c9862f', '#3f6fa8', '#2e7a6e'], MADERA_PINTADA = ['#2f5f9e', '#3b7d4f', '#7a4a2c', '#2e7a6e', '#5a3a22', '#8a2f2a'];
var PENDIENTE = .45;   /* el techo, a unos 26 grados */
/* un faldón de tejas: largo a lo largo del alero (x), ancho por la pendiente (z); uv propias: las hileras siguen el alero */
function faldon(J, largo, ancho, giroX, x, y, z, giroY) {
  var g = new THREE.BoxGeometry(largo, .12, ancho), uv = g.attributes.uv, p = g.attributes.position;
  for (var k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) + largo / 2) / 1.6, (p.getZ(k) + ancho / 2) / 1.6);
  g.rotateX(giroX); if (giroY) g.rotateY(giroY); g.translate(x, y, z); g.userData.uvPropio = true; J.pieza(g, [1, 1, 1]);
}
/* el hastial: el triángulo de pared bajo el techo, en una punta de la casa (fondo D, alto h) */
function hastial(J, x, y, D, h, col) { var g = new THREE.BoxGeometry(.2, h, D); M.torcer(g, function (q) { if (q.y > 0) q.z = 0; }); g.translate(x, y + h / 2, D / 2); J.pieza(g, col || [1, 1, 1]); }
/* v: 0 un piso · 1 dos pisos con balcón corrido · 2 dos pisos con ventanas · 3 un piso con zócalo de piedra */
function casaAndina(len, v, baja, fondo, noche) {
  var r = M.azar(Math.round(len * 10) * 17 + v * 211 + (baja ? 11 : 0) + (fondo || 6) * 5), rn = M.azar(Math.round(len * 10) * 29 + v * 97 + (fondo || 6) * 13 + 7777), P = {};
  ['color', 'blanco', 'madera', 'tejas', 'piedra', 'vidrio', 'fierro', 'luz'].forEach(function (k) { P[k] = new M.Junta(); });
  function calida() { return M.col(CALIDAS[rn() * CALIDAS.length | 0]); }
  var cuenta = { puerta: 0, balcon: 0, cruz: 0, ventanaLuz: 0 }, dos = v === 1 || v === 2, H = dos ? 5.9 : 3.3, D = fondo || 6, B = [1, 1, 1];
  var zoc = M.col(ZOCALOS[r() * ZOCALOS.length | 0]), mad = M.col(MADERA_PINTADA[r() * MADERA_PINTADA.length | 0]), deP = v === 3 || r() < .2;
  function caja(J, w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); J.pieza(g, col || B); }
  caja(P.color, len, H + 1, D, len / 2, (H + 1) / 2 - 1, D / 2);                       /* el cuerpo de adobe encalado */
  if (deP) caja(P.piedra, len + .04, 1.15, .1, len / 2, .3, -.05);                      /* el zócalo de piedra */
  else caja(P.color, len + .02, 1.1, .05, len / 2, .3, -.025, zoc);                     /* o pintado */
  /* abajo: la puerta de madera pintada (con su umbral de piedra) y ventanas con postigos */
  var nb = Math.max(2, Math.round(len / 2.4)), bw = len / nb, pu = r() * nb | 0;
  for (var i = 0; i < nb; i++) { var xc = bw * (i + .5);
    if (i === pu) { caja(P.blanco, 1.5, .16, .1, xc, 2.42, -.05); [-1, 1].forEach(function (l) { caja(P.blanco, .14, 2.4, .1, xc + l * .68, 1.2, -.05); });
      var entre = noche && rn() < .3;   /* de noche, alguna puerta entreabierta deja salir la luz */
      if (entre) { caja(P.madera, .9, 2.3, .06, xc - .16, 1.15, -.02, mad); caja(P.luz, .3, 2.2, .03, xc + .45, 1.12, -.01, calida()); cuenta.ventanaLuz++; }
      else caja(P.madera, 1.22, 2.3, .06, xc, 1.15, -.02, mad);
      if (!baja && !entre) { caja(P.madera, .05, 2.2, .04, xc, 1.12, -.06, M.mezclaCol(mad, [0, 0, 0], .35)); caja(P.fierro, .08, .08, .06, xc + .35, 1.2, -.07); }
      caja(P.piedra, 1.6, .14, .4, xc, .05, -.2); cuenta.puerta++; }
    else { var enc = noche && rn() < .5; caja(enc ? P.luz : P.vidrio, .8, 1.0, .04, xc, 1.65, -.02, enc ? calida() : null); if (enc) cuenta.ventanaLuz++; caja(P.madera, .96, .08, .08, xc, 2.2, -.04, mad); caja(P.blanco, 1.1, .1, .16, xc, 1.1, -.08);
      if (!baja) [-1, 1].forEach(function (l) { caja(P.madera, .4, 1.0, .04, xc + l * .64, 1.65, -.04, mad); }); }   /* los postigos, abiertos */
  }
  /* arriba (dos pisos): el balcón corrido de madera, o ventanas */
  if (dos) { var y1 = 3.05;
    for (i = 0; i < nb; i++) { xc = bw * (i + .5); var alto2 = v === 1 ? 2.0 : 1.1, yv = v === 1 ? y1 + 1.05 : y1 + 1.4;
      var enc2 = noche && rn() < (v === 1 ? .45 : .5);   /* de noche, la puerta del balcón o la ventana de arriba encendida */
      caja(enc2 ? P.luz : v === 1 ? P.madera : P.vidrio, v === 1 ? 1.0 : .8, alto2, .05, xc, yv, -.02, enc2 ? calida() : v === 1 ? mad : null); if (enc2) cuenta.ventanaLuz++;
      if (v === 2) { caja(P.madera, .96, .08, .08, xc, yv + .58, -.04, mad); if (!baja) [-1, 1].forEach(function (l) { caja(P.madera, .4, 1.1, .04, xc + l * .64, yv, -.04, mad); }); } }
    if (v === 1) { var bl = len - .4;
      caja(P.madera, bl, .12, .9, len / 2, y1, -.45, mad);                                          /* el piso del balcón */
      caja(P.madera, bl, .08, .08, len / 2, y1 + .98, -.86, mad); caja(P.madera, bl, .06, .06, len / 2, y1 + .3, -.86, mad);
      if (!baja) for (var q = 0; q * .32 < bl; q++) caja(P.madera, .05, .7, .05, .2 + q * .32, y1 + .64, -.86, mad);
      for (q = 0; q < Math.max(2, Math.round(bl / 1.6)); q++) caja(P.madera, .1, .14, .8, .3 + q * (bl - .2) / Math.max(1, Math.round(bl / 1.6) - 1), y1 - .12, -.4, M.mezclaCol(mad, [0, 0, 0], .4));   /* los canes */
      var yA = H - .7 * Math.tan(PENDIENTE) - .02; [.25, len - .25].forEach(function (x) { caja(P.madera, .1, yA - y1, .1, x, (y1 + yA) / 2, -.7, mad); });   /* los pies derechos, del balcón al alero */
      cuenta.balcon++; } }
  /* el techo de teja a dos aguas: la cumbrera a lo largo de la calle, con alero de 0,75 sobre la vereda */
  var t = Math.tan(PENDIENTE), hR = D / 2 * t, al = .75, z0 = -al, z1 = D / 2, wF = Math.hypot(z1 - z0, (z1 - z0) * t), yF = H + ((z0 + z1) / 2) * t;
  faldon(P.tejas, len + .02, wF, -PENDIENTE, len / 2, yF + .06, (z0 + z1) / 2);   /* casi justo: con la vecina no se montan (parpadeaban) */
  var z2 = D + .35, wB = Math.hypot(z2 - z1, (z2 - z1) * t), yB = H + hR - ((z2 - z1) / 2) * t;
  faldon(P.tejas, len + .02, wB, PENDIENTE, len / 2, yB + .06, (z1 + z2) / 2);
  faldon(P.tejas, len + .03, .34, 0, len / 2, H + hR + .1, z1);                                       /* la cumbrera */
  hastial(P.color, .1, H, D, hR); hastial(P.color, len - .1, H, D, hR);
  if (!baja) for (q = 0; q < Math.round(len / .9); q++) { var gc = new THREE.BoxGeometry(.08, .08, (al + .1) / Math.cos(PENDIENTE)); gc.rotateX(-PENDIENTE);   /* los canecillos: bajo la teja, con su pendiente */
    gc.translate(.45 + q * (len - .9) / Math.max(1, Math.round(len / .9) - 1), H + (-al / 2 + .05) * t - .05, -al / 2 + .05); P.madera.pieza(gc, [.45, .32, .22]); }
  /* la cruz con sus toritos, en algunas cumbreras */
  var conCruz = r() < .38;
  if (conCruz) { var xm = len / 2, yc = H + hR + .16, cT = [.62, .36, .22];
    caja(P.fierro, .07, .9, .07, xm, yc + .45, z1, [.3, .27, .24]); caja(P.fierro, .5, .07, .07, xm, yc + .62, z1, [.3, .27, .24]);
    [-1, 1].forEach(function (l) { caja(P.blanco, .3, .16, .12, xm + l * .5, yc + .14, z1, cT); caja(P.blanco, .12, .12, .1, xm + l * .7, yc + .24, z1, cT);   /* cuerpo y cabeza */
      if (!baja) [-1, 1].forEach(function (m) { caja(P.blanco, .04, .14, .04, xm + l * .5 + m * .1, yc - .03, z1 + .04, cT); }); });
    cuenta.cruz++; }
  var G = {}; Object.keys(P).forEach(function (k) { if (P[k].base) G[k] = P[k].geometria(k === 'color' ? { oscuroAbajo: [.8, 1.0] } : null); });
  if (G.tejas) G.tejas.userData.uvPropio = true;
  return { geos: G, cuenta: cuenta, alto: H + hR + (conCruz ? .9 : 0), unPiso: !dos };
}

/* ---------- la casa de playa de Huanchaco: 2 o 3 pisos (a veces 1, con su ramada arriba), restaurante abajo ----------
   v: 0 dos pisos · 1 tres pisos · 2 dos pisos con ramada en la azotea · 3 un piso con terraza y ramada grande */
function casaPlaya(len, v, baja, fondo) {
  var r = M.azar(Math.round(len * 10) * 11 + v * 173 + (baja ? 3 : 0) + (fondo || 6) * 7), P = {};
  ['color', 'blanco', 'madera', 'fierro', 'cana', 'vidrio', 'luz', 'letrero'].forEach(function (k) { P[k] = new M.Junta(); });
  var cuenta = { porton: 0, terraza: 0, ramada: 0, letrero: 0 }, pisos = v === 1 ? 3 : (v === 3 ? 1 : 2), HP = 3.0, H = pisos * HP, D = fondo || 6, B = [1, 1, 1];
  var ZO = [.72, .72, .72], cM = M.col('#c09466'), cO = M.col('#a07a52'), cC = M.col('#efe2c4'), conRamada = v === 2 || v === 3;
  function caja(J, w, h, d, x, y, z, col, giroX) { var g = new THREE.BoxGeometry(w, h, d); if (giroX) g.rotateX(giroX); g.translate(x, y, z); J.pieza(g, col || B); }
  /* el cuerpo, el zócalo, las losas entre pisos, el parapeto con su remate y las esquineras */
  caja(P.color, len, H + 1, D, len / 2, (H + 1) / 2 - 1, D / 2);
  caja(P.color, len + .02, 1.6, .05, len / 2, -.2, -.025, ZO);
  for (var k = 1; k < pisos; k++) caja(P.blanco, len + .06, .16, .14, len / 2, k * HP, -.07);
  caja(P.color, len, .6, .2, len / 2, H + .3, .1); caja(P.blanco, len + .06, .08, .26, len / 2, H + .62, .1);
  [.12, len - .12].forEach(function (x) { caja(P.blanco, .24, H, .08, x, H / 2, -.04); });
  /* abajo, el restaurante: vidrieras con marco de madera, la puerta doble, el letrero y el toldo de caña */
  var nb = Math.max(2, Math.round(len / 2.6)), bw = len / nb, puerta = r() * nb | 0;
  for (var i = 0; i < nb; i++) { var xc = bw * (i + .5);
    if (i === puerta) {
      caja(P.blanco, 1.62, .1, .1, xc, 2.3, -.05); [-1, 1].forEach(function (l) { caja(P.blanco, .14, 2.3, .1, xc + l * .74, 1.15, -.05); });
      caja(P.madera, 1.36, 2.2, .07, xc, 1.1, -.02, cM); caja(P.vidrio, .44, .85, .02, xc - .33, 1.55, -.07); caja(P.vidrio, .44, .85, .02, xc + .33, 1.55, -.07);
      if (!baja) caja(P.madera, .05, 2.12, .04, xc, 1.08, -.07, cO);
      cuenta.porton++;
    } else {
      var vw = Math.min(1.9, bw - .5); caja(P.vidrio, vw, 1.5, .04, xc, 1.35, -.02);
      caja(P.madera, vw + .16, .1, .1, xc, 2.16, -.05, cM); caja(P.madera, vw + .2, .1, .18, xc, .55, -.09, cM);
      if (!baja) { [-1, 1].forEach(function (l) { caja(P.madera, .08, 1.56, .08, xc + l * (vw / 2 + .04), 1.35, -.05, cM); }); caja(P.madera, .05, 1.5, .05, xc, 1.35, -.05, cM); }
    }
  }
  var lw = Math.min(len - 1.4, 4.4), terraza1 = pisos > 1 && r() < .7, lh = lw / AT_ASP;
  caja(P.madera, lw + .16, lh + .1, .06, len / 2, 2.66, -.04, cO); P.letrero.pieza(letrero(lw).translate(len / 2, 2.66, -.08), B); cuenta.letrero++;
  if (!terraza1) { caja(P.cana, len - .5, .07, 1.05, len / 2, 3.2, -.52, cC, -.2); cuenta.ramada++;   /* el toldo de caña: de 3,3 en la pared a 3,1 adelante */
    [.45, len - .45].forEach(function (x) { caja(P.madera, .06, .06, 1.08, x, 2.86, -.48, cO, .42); }); }   /* sus pies de amigo, contra la pared */
  /* arriba: una terraza de madera en el segundo piso (o el toldo abajo) y ventanas (alguna encendida) */
  for (k = 1; k < pisos; k++) { var y0 = k * HP, terraza = k === 1 && terraza1;
    if (terraza) {
      caja(P.blanco, len - .5, .14, .9, len / 2, y0 + .02, -.45);
      caja(P.madera, len - .5, .08, .08, len / 2, y0 + 1.02, -.86, cM); caja(P.madera, len - .5, .06, .06, len / 2, y0 + .3, -.86, cM);
      if (!baja) for (var q = 0; q * .42 < len - .6; q++) caja(P.madera, .05, .72, .05, .3 + q * .42, y0 + .66, -.86, cO);
      [.27, len - .27].forEach(function (x) { caja(P.madera, .06, 1.0, .9, x, y0 + .55, -.45, cM); });
      cuenta.terraza++;
    }
    for (i = 0; i < nb; i++) { xc = bw * (i + .5); var enc = r() < .2, alto = terraza ? 2.0 : 1.35, yv = terraza ? y0 + 1.15 : y0 + 1.55;
      caja(enc ? P.luz : P.vidrio, terraza ? 1.1 : 1.0, alto, .04, xc, yv, -.02, enc ? M.col('#ffd59a') : null);
      caja(P.blanco, (terraza ? 1.1 : 1.0) + .2, .1, .14, xc, yv + alto / 2 + .07, -.07);
      if (!terraza) caja(P.blanco, 1.22, .08, .16, xc, yv - alto / 2 - .05, -.08); }
  }
  /* la azotea: la ramada de caña sobre horcones de madera, con su baranda (el restaurante de arriba) */
  if (conRamada) { var yR = H + .66, hR = 2.4, zA = .5, zB = Math.min(D - .6, 4.2);
    [[.35, zA], [len - .35, zA], [.35, zB], [len - .35, zB]].forEach(function (c) { caja(P.madera, .14, hR, .14, c[0], yR + hR / 2, c[1], cO); });
    caja(P.cana, len - .2, .1, zB - zA + 1.0, len / 2, yR + hR + .12, (zA + zB) / 2, cC, .08);
    caja(P.madera, len - .4, .1, .1, len / 2, yR + hR - .05, zA, cM);
    if (!baja) for (q = 0; q * .5 < len - .7; q++) caja(P.madera, .05, .8, .05, .4 + q * .5, yR + .4, .02, cO);
    caja(P.madera, len - .4, .07, .07, len / 2, yR + .82, .02, cM);
    cuenta.ramada++; }
  if (!baja) for (i = 0; i < nb; i++) { var xt = bw * (i + .5);   /* la espalda también tiene ventanas */
    for (k = 0; k < pisos; k++) { caja(P.vidrio, .9, 1.2, .04, xt, k * HP + 1.6, D + .02); caja(P.blanco, 1.1, .08, .14, xt, k * HP + .95, D + .07); } }
  var G = {}; Object.keys(P).forEach(function (k) { if (P[k].base) G[k] = P[k].geometria(k === 'color' ? { oscuroAbajo: [.75, 1.0] } : null); });
  if (G.letrero) G.letrero.userData.uvPropio = true;
  return { geos: G, cuenta: cuenta, alto: H + .66 + (conRamada ? 2.6 : 0) };
}

/* ---------- la plantilla de una casona: x de 0 a len (la calle), y hacia arriba, z hacia adentro (la fachada en z = 0) ---------- */
function plantilla(len, v, baja, fondo) {
  var r = M.azar(Math.round(len * 10) * 7 + v * 131 + (baja ? 5 : 0)), P = {};
  ['color', 'blanco', 'madera', 'fierro', 'tejas', 'vidrio', 'luz'].forEach(function (k) { P[k] = new M.Junta(); });
  var cuenta = { porton: 0, reja: 0, cajon: 0 }, unPiso = v === 3, H = unPiso ? 3.7 : 6.4, D = fondo || 6, B = [1, 1, 1], ZO = [.62, .62, .62], OS = M.col('#24201c');
  function caja(J, w, h, d, x, y, z, col, giroX) { var g = new THREE.BoxGeometry(w, h, d); if (giroX) g.rotateX(giroX); g.translate(x, y, z); J.pieza(g, col || (J === P.fierro ? OS : B)); }   /* el fierro, oscuro si no se dice otro color */
  /* el cuerpo, el zócalo, las cornisas, el parapeto y las pilastras */
  caja(P.color, len, H + 1, D, len / 2, (H + 1) / 2 - 1, D / 2);
  caja(P.color, len + .02, 1.75, .06, len / 2, -.125, -.03, ZO);
  caja(P.blanco, len + .16, .22, .26, len / 2, H - .1, -.13); caja(P.blanco, len + .08, .1, .14, len / 2, H - .32, -.07);
  caja(P.color, len, .5, .22, len / 2, H + .24, .11); caja(P.blanco, len + .04, .08, .26, len / 2, H + .5, .11);
  if (!unPiso) caja(P.blanco, len + .1, .14, .16, len / 2, 3.05, -.08);
  [.16, len - .16].forEach(function (x) { caja(P.blanco, .32, H, .1, x, H / 2, -.05); });
  var nb = Math.max(2, Math.round(len / 2.7)), bw = len / nb, conPorton = r() * nb | 0;
  for (var i = 0; i < nb; i++) {
    var xc = bw * (i + .5);
    if (i > 0) caja(P.blanco, .22, H, .07, bw * i, H / 2, -.035);
    if (i === conPorton) {   /* el portón de madera con su marco y sus tableros */
      caja(P.blanco, 2.02, .16, .12, xc, 2.82, -.06); [-1, 1].forEach(function (l) { caja(P.blanco, .16, 2.82, .12, xc + l * 1.0, 1.41, -.06); });
      caja(P.madera, 1.84, 2.72, .08, xc, 1.36, -.02, M.col('#7a5234'));
      if (!baja) for (var q = 0; q < 4; q++) caja(P.madera, .62, .92, .04, xc + (q % 2 ? .4 : -.4), q < 2 ? .78 : 1.95, -.07, M.col('#5e3c24'));
      caja(P.fierro, .06, .06, .1, xc + .3, 1.45, -.1, M.col('#c9a24a')); cuenta.porton++;
    } else {                 /* la ventana con su reja de fierro */
      caja(P.vidrio, 1.12, 1.8, .04, xc, 1.86, -.02); caja(P.blanco, 1.4, .1, .22, xc, .92, -.11);
      if (!baja) { caja(P.blanco, 1.3, .1, .08, xc, 2.82, -.04); [-1, 1].forEach(function (l) { caja(P.blanco, .1, 1.9, .08, xc + l * .61, 1.86, -.04); });
        for (q = 0; q < 8; q++) caja(P.fierro, .028, 1.96, .028, xc - .49 + q * .14, 1.88, -.16);
        [1.08, 2.66].forEach(function (y) { caja(P.fierro, 1.16, .035, .035, xc, y, -.16); }); }
      cuenta.reja++;
    }
    if (unPiso) continue;
    var tipo = r(), xb = xc;
    if (tipo < .4) {           /* el balcón de cajón: piso, canes, tableros, celosía y su techito de tejas */
      var BW = Math.min(2.1, bw - .3), BD = .82, y0 = 3.32, cM = M.col('#6e4a2e'), cO = M.col('#4e3320');
      caja(P.madera, BW + .1, .18, BD, xb, y0, -BD / 2, cM);
      [-1, 0, 1].forEach(function (k) { caja(P.madera, .12, .4, .55, xb + k * BW * .38, y0 - .28, -.28, cO); });
      caja(P.madera, BW, .92, .06, xb, y0 + .55, -BD + .03, cM); [-1, 1].forEach(function (l) { caja(P.madera, .06, .92, BD, xb + l * BW / 2, y0 + .55, -BD / 2, cM); });
      caja(P.madera, BW - .1, .96, .03, xb, y0 + 1.55, -BD + .14, cO);
      if (!baja) { var ns = Math.round(BW / .2); for (q = 0; q <= ns; q++) caja(P.madera, .05, 1.0, .04, xb - BW / 2 + q * BW / ns, y0 + 1.55, -BD + .03, cM);
        [-1, 1].forEach(function (l) { for (var q2 = 1; q2 < 4; q2++) caja(P.madera, .04, 1.0, .05, xb + l * BW / 2, y0 + 1.55, -q2 * BD / 4, cM); }); }
      caja(P.madera, BW + .12, .12, .1, xb, y0 + 2.1, -BD + .03, cM);
      caja(P.tejas, BW + .4, .09, BD + .35, xb, y0 + 2.32, -BD / 2 - .12, M.col('#ffffff'), .38);
      cuenta.cajon++;
    } else if (tipo < .65) {   /* balcón abierto con baranda de fierro y puerta-ventana */
      caja(P.blanco, Math.min(1.9, bw - .3), .14, .62, xb, 3.28, -.31);
      caja(P.vidrio, 1.0, 2.05, .04, xb, 4.38, -.02); caja(P.blanco, 1.24, .12, .1, xb, 5.46, -.05);
      caja(P.fierro, 1.7, .04, .04, xb, 4.18, -.58);
      if (!baja) for (q = 0; q < 11; q++) caja(P.fierro, .022, .82, .022, xb - .8 + q * .16, 3.76, -.58);
    } else {                   /* ventana alta, con su cornisita; algunas encendidas */
      var enc = r() < .22; caja(enc ? P.luz : P.vidrio, 1.0, 1.62, .04, xb, 4.62, -.02, enc ? M.col('#ffd59a') : null);
      caja(P.blanco, 1.34, .12, .16, xb, 5.55, -.08); caja(P.blanco, 1.18, .08, .16, xb, 3.75, -.08);
    }
  }
  if (unPiso) caja(P.tejas, len + .3, .1, 1.3, len / 2, H + .2, -.35, M.col('#ffffff'), .42);   /* la casa de un piso, con su alero de tejas */
  if (!baja) for (i = 0; i < nb; i++) { var xt = bw * (i + .5);   /* la espalda también tiene ventanas (en las curvas cerradas se ve desde la otra calle) */
    [1.9].concat(unPiso ? [] : [4.6]).forEach(function (y) { caja(P.vidrio, .9, 1.4, .04, xt, y, D + .02); caja(P.blanco, 1.1, .08, .14, xt, y - .75, D + .07); }); }
  var G = {}; Object.keys(P).forEach(function (k) { if (P[k].base) G[k] = P[k].geometria(k === 'color' ? { oscuroAbajo: [.72, 1.1] } : null); });
  return { geos: G, cuenta: cuenta, alto: H + .54 };
}
/* el farol de pared: brazo de fierro, la linterna y su vidrio encendido */
function farolPared() {
  var F = new M.Junta(), Lz = new M.Junta(), cF = M.col('#262321');
  F.caja(.06, .06, .6, 0, 3.45, -.3, cF); F.caja(.05, .4, .05, 0, 3.25, -.05, cF);
  F.caja(.34, .06, .34, 0, 3.32, -.62, cF); F.caja(.3, .08, .3, 0, 3.9, -.62, cF); var cono = new THREE.ConeGeometry(.24, .22, 4); cono.rotateY(Math.PI / 4); cono.translate(0, 4.05, -.62); F.pieza(cono, cF);
  Lz.caja(.26, .5, .26, 0, 3.6, -.62, M.col('#ffd59a'));
  return { fierro: F.geometria(), luz: Lz.geometria() };
}

M.ciudad = function (E, mundo, o) {
  var t0 = performance.now(), r = M.azar(o.semilla || 777), baja = !!o.baja, L = o.L, W2 = o.W / 2, playa = o.plantilla === 'playa', muro = o.plantilla === 'muralla', andina = o.plantilla === 'andina', palaf = o.plantilla === 'palafito', noche = !!o.noche, N = andina && noche ? 4 : playa || andina ? 6 : 7;   /* de noche, el pueblo andino lleva más mallas (luz y charcos): 4 tramos */   /* tramos de la vuelta: lo que no se ve se recorta (la playa tiene dos materiales más: caña y letreros) */
  var PLANT = palaf ? palafito : andina ? casaAndina : muro ? muralla : playa ? casaPlaya : plantilla, PALETA = palaf ? COLORES_PALAFITO : andina ? COLORES_ANDINA : muro ? COLORES_BARRO : playa ? COLORES_PLAYA : COLORES, LG = muro ? LARGOS_M : LARGOS;
  var FAc = palaf ? 3.6 : FA;   /* el palafito, más atrás: su escalera baja 0,9 m hacia la calle */
  var FONDOS = muro ? [2.6, 1.6] : [6, 3], DETRAS_T = muro ? 2.6 : DETRAS, FONDO_T = muro ? 2.6 + 14 : FONDO;   /* la muralla: 2,6 m de grueso; los costados del patio empiezan detrás de la esquina */
  function cadaBoca() { return muro ? 5 + (r() * 4 | 0) : andina || palaf ? 4 + (r() * 3 | 0) : 3 + (r() * 3 | 0); }   /* en Chan Chan, las entradas son pocas */
  var mats = {
    muro: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 }),
    madera: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72 }),
    fierro: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .6 }),
    tejas: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }),
    vidrio: new THREE.MeshStandardMaterial({ color: '#1b2630', roughness: .08, metalness: .7, envMap: o.env || null, envMapIntensity: 1.2 }),
    luz: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  };
  if (playa) { mats.madera.color.setScalar(1.7);   /* la madera de playa, clara y gastada por el sol (la foto de la madera es oscura) */
    mats.cana = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }); mats.letrero = new THREE.MeshStandardMaterial({ map: texLetreros(baja), roughness: .75 }); }
  if (muro) { mats.muro.roughness = 1; var arena = M.col('#cdb08a'); mats.muro.color.setRGB(arena[0], arena[1], arena[2]);   /* arena, mientras llega la foto del barro */
    mats.muro.userData.conMapa = function (m) { m.color.setRGB(3.0, 3.4, 4.0); };   /* la foto del barro es oscura y rojiza (115, 89, 61): se aclara hacia la arena de Chan Chan */
    var FX = texFrisos(baja);   /* el friso en relieve (en los celulares flojos, sin el relieve) */
    mats.friso = new THREE.MeshStandardMaterial({ vertexColors: true, map: FX.color, bumpMap: baja ? null : FX.relieve, bumpScale: .06, roughness: 1 }); }
  /* los letreros, casa por casa: se recorren los 64 en un orden barajado; ninguno se repite antes de usarlos todos */
  var rL = M.azar(4242), ordenL = [], letreros = [];
  function turnoLetrero() { if (!ordenL.length) { var ant = letreros.length ? NEGOCIOS.indexOf(letreros[letreros.length - 1]) : -1;
      for (var q = 0; q < NEGOCIOS.length; q++) ordenL.push(q); for (q = ordenL.length - 1; q > 0; q--) { var j = rL() * (q + 1) | 0, tq = ordenL[q]; ordenL[q] = ordenL[j]; ordenL[j] = tq; }
      if (ordenL[0] === ant) ordenL.push(ordenL.shift()); }
    return ordenL.shift(); }
  if (palaf) { mats.madera.userData.conMapa = function (m) { m.color.setScalar(1.8); }; mats.cana = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }); }   /* la madera al sol y el techo de caña */
  if (andina) { mats.madera.userData.conMapa = function (m) { m.color.setScalar(2.0); };   /* la madera pintada se ve pintada (la foto de la madera es oscura): se aclara cuando llega */
    mats.piedra = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
    if (noche) mats.charco = matLuzAditiva(texCharco(), .9); }   /* el charco de luz de cada farol */
  var MAT_DE = { color: 'muro', blanco: 'muro', madera: 'madera', fierro: 'fierro', tejas: 'tejas', vidrio: 'vidrio', luz: 'luz', cana: 'cana', letrero: 'letrero', friso: 'friso', piedra: 'piedra', charco: 'charco' };
  var TR = []; for (var c = 0; c < N; c++) { TR.push({}); }
  function junta(ch, m) { return TR[ch][m] || (TR[ch][m] = new M.Junta()); }
  var PL = {}, farol = farolPared(), lado = 1, AUD = muro ? audiencia(baja) : null;
  function plant(len, v, fondo) { var k = len + ':' + v + ':' + fondo; return PL[k] || (PL[k] = PLANT(len, v, baja, fondo, noche)); }
  /* dónde hay casas (cuadros de 2 m): para no sembrar plantas adentro */
  var OC = {}; function marcar(x, z) { OC[Math.floor(x / 2) + ',' + Math.floor(z / 2)] = 1; }
  /* ¿cabe una casa de este fondo sin pisar otro tramo de la pista? (en las curvas cerradas, el otro lado de la curva queda cerca) */
  function cabe(a, b, Z, fondo) { for (var k = 0; k <= 4; k++) { var x = a.x + (b.x - a.x) * k / 4, z = a.z + (b.z - a.z) * k / 4;
      if (o.dist(x + Z.x * fondo, z + Z.z * fondo) < W2 + FAc - .1 || o.dist(x + Z.x * fondo / 2, z + Z.z * fondo / 2) < W2 + FAc - .1) return false; } return true; }
  /* ¿el techo de la casa (con el alero de adelante, el balcón y el alero de atrás) queda fuera de la pista y su bordillo? */
  function techoLibre(a, b, Z, fondo) { var atras = palaf ? 1.0 : .45, cu = Math.hypot(b.x - a.x, b.z - a.z), nu = Math.max(2, Math.ceil(cu / 1.5)), nw = Math.max(2, Math.ceil((fondo + .95 + atras) / 1.5));
    for (var i = 0; i <= nu; i++) for (var j = 0; j <= nw; j++) { var f = i / nu, w = -.95 + (fondo + .95 + atras) * j / nw;
      if (o.dist(a.x + (b.x - a.x) * f + Z.x * w, a.z + (b.z - a.z) * f + Z.z * w) < W2 + .85) return false; }
    return true; }
  var cuenta = { porton: 0, reja: 0, cajon: 0, farol: 0, bocacalle: 0 }, modulos = [], brillos = [], mt = new M4(), vX = new V3(), vY = new V3(0, 1, 0), vZ = new V3();
  /* pone una pieza de p0 a p1 con la fachada mirando a -Z (Z: hacia adentro de la casa) */
  function colocar(p0, p1, Z, s, len, v, calle) {
    vX.set(Z.z, 0, -Z.x);
    var a = p0, b = p1; if ((b.x - a.x) * vX.x + (b.z - a.z) * vX.z < 0) { a = p1; b = p0; }
    var cuerda = Math.hypot(b.x - a.x, b.z - a.z); if (cuerda < 2) return;
    if (calle) {   /* en la curva de afuera la recta de la fachada se acerca a la pista: se corre hacia adentro de la casa lo que falte */
      var dmin = 1e9; for (var k = 0; k <= 4; k++) dmin = Math.min(dmin, o.dist(a.x + (b.x - a.x) * k / 4, a.z + (b.z - a.z) * k / 4));
      var falta = W2 + FAc - .05 - dmin; if (falta > 0) { a = a.clone().addScaledVector(Z, falta); b = b.clone().addScaledVector(Z, falta); } }
    var fondo = cabe(a, b, Z, FONDOS[0]) ? FONDOS[0] : (cabe(a, b, Z, FONDOS[1]) ? FONDOS[1] : 0); if (!fondo) return;   /* si no cabe ni una casa angosta, ahí no va casa */
    if ((andina || palaf) && !techoLibre(a, b, Z, fondo)) { fondo = fondo === FONDOS[0] && techoLibre(a, b, Z, FONDOS[1]) ? FONDOS[1] : 0; if (!fondo) return; }   /* Los Andes: también el alero y el balcón (sobresalen) */
    if (o.saltar && o.saltar({ a: a, b: b, Z: Z, fondo: fondo, lado: lado, s: ((s % L) + L) % L })) return;   /* Huanchaco: del lado del mar, el malecón */
    var y = Math.min(o.alto(a.x, a.z), o.alto(b.x, b.z)) - .25, P = plant(len, v, fondo), sx = cuerda / len;
    vZ.copy(Z); mt.makeBasis(vX.clone().multiplyScalar(sx), vY, vZ).setPosition(a.x, y, a.z);
    var col = M.col(PALETA[r() * PALETA.length | 0]), ch = Math.min(N - 1, Math.max(0, Math.floor(((s % L) + L) % L / (L / N))));
    Object.keys(P.geos).forEach(function (k) { var mk = MAT_DE[k], gk = P.geos[k].clone();
      if (k === 'letrero') { var il = turnoLetrero(); aCelda(gk, il); letreros.push(NEGOCIOS[il]); }
      junta(ch, mk).pieza(gk, k === 'color' || k === 'friso' ? col : [1, 1, 1], mt, UVK[mk] || 1); });   /* el friso, del mismo barro que su muro */
    Object.keys(P.cuenta).forEach(function (k) { cuenta[k] = (cuenta[k] || 0) + P.cuenta[k]; });
    var cx = (a.x + b.x) / 2 - Z.x * .01, cz = (a.z + b.z) / 2 - Z.z * .01;
    for (var u = 0; u <= cuerda; u += 1) for (var w = 0; w <= fondo; w += 1) { var f = u / cuerda; marcar(a.x + (b.x - a.x) * f + Z.x * w, a.z + (b.z - a.z) * f + Z.z * w); }
    modulos.push({ s: s, d: o.dist(cx, cz), alto: P.alto, tipo: calle ? 'calle' : 'boca', x: cx, z: cz });
    return { a: a, b: b, ch: ch, y: y };
  }
  function farolEn(p, Z, y, ch) {   /* en la unión de dos casonas, a media altura */
    vX.set(Z.z, 0, -Z.x); mt.makeBasis(vX, vY, Z).setPosition(p.x, y, p.z);
    junta(ch, 'fierro').pieza(farol.fierro.clone(), [1, 1, 1], mt); junta(ch, 'luz').pieza(farol.luz.clone(), [1, 1, 1], mt);
    brillos.push(p.x - Z.x * .62, y + 3.6, p.z - Z.z * .62); cuenta.farol++;
    if (andina && noche) {   /* su charco de luz en la vereda, junto a la pared; en las curvas se acorta (o no va) si se asomaría a la pista */
      var hondo = [2.0, 1.2].filter(function (h) { for (var u = -1.8; u <= 1.8; u += 1.8) for (var w = 0; w <= h; w += h / 2) if (o.dist(p.x + vX.x * u - Z.x * w, p.z + vX.z * u - Z.z * w) < W2 + .75) return false; return true; })[0];
      if (hondo) { var gch = new THREE.PlaneGeometry(3.6, hondo); gch.rotateX(-Math.PI / 2); gch.translate(0, 0, -hondo / 2); gch.userData.uvPropio = true;
        var qx = p.x - Z.x, qz = p.z - Z.z; mt.makeBasis(vX, vY, Z).setPosition(p.x, o.alto(qx, qz) + .2, p.z); junta(ch, 'charco').pieza(gch, M.col('#ffd29a'), mt); cuenta.charco = (cuenta.charco || 0) + 1; } }
  }
  var tmp = new V3(), prev = new V3(), dirT = new V3();
  [1, -1].forEach(function (l) {
    lado = l; var off = l * (1 + FAc / W2), s = o.sIni, pA = o.pos(s, off).clone(), sA = s, acum = 0, hastaBoca = cadaBoca(), obj = LG[r() * 4 | 0];
    prev.copy(pA); var ultimo = null;
    for (s = o.sIni + .5; s <= o.sFin; s += .5) {
      var p = o.pos(s, off, tmp); acum += Math.hypot(p.x - prev.x, p.z - prev.z); prev.copy(p);
      if (acum < obj) continue;
      o.dir((sA + s) / 2, dirT); var Zm = new V3(-dirT.z * l, 0, dirT.x * l);   /* hacia adentro de la casa: afuera de la pista */
      var pB = p.clone();
      if (hastaBoca === 0) {   /* la bocacalle: dos filas de casonas que se van hacia adentro, una que cierra al fondo y los bolardos */
        var u = Zm, pS = pA, pE = pB, fS = pS.clone().addScaledVector(u, FONDO_T), fE = pE.clone().addScaledVector(u, FONDO_T), sm = (sA + s) / 2;
        var tt = new V3(pE.x - pS.x, 0, pE.z - pS.z).normalize();
        [[pS, -1], [pE, 1]].forEach(function (q) { var base = q[0], Zl = tt.clone().multiplyScalar(q[1]);
          for (var k = 0; k < 2; k++) colocar(base.clone().addScaledVector(u, DETRAS_T + k * 7), base.clone().addScaledVector(u, DETRAS_T + (k + 1) * 7), Zl, sm, 7.2, r() * 3 | 0); });
        colocar(fS, fE, u, sm, LG[Math.min(3, Math.round((BOCA - 5.6) / .8))], muro ? 3 : r() * 3 | 0);
        var chB = Math.min(N - 1, Math.floor(sm / (L / N)));
        if (muro) {   /* Chan Chan: la entrada es angosta (dos jambas de muro dejan 3 m) y en el patio está la audiencia */
          var jA = colocar(pS, pS.clone().addScaledVector(tt, 2.5), Zm, sm, 2.5, 3, true), jB = colocar(pE.clone().addScaledVector(tt, -2.5), pE, Zm, sm, 2.5, 3, true);
          for (var pu = 0; pu <= 1; pu += .25) for (var pw = DETRAS_T; pw <= FONDO_T; pw += 2) { var pp = pS.clone().lerp(pE, pu).addScaledVector(u, pw); marcar(pp.x, pp.z); }   /* el suelo del patio: sin plantas */
          var ca = pS.clone().lerp(pE, .5).addScaledVector(u, DETRAS_T + 7.2), xa = new V3(u.z, 0, -u.x);
          if (o.dist(ca.x, ca.z) > W2 + FAc + 4) { mt.makeBasis(xa, vY, u).setPosition(ca.x, o.alto(ca.x, ca.z), ca.z); junta(chB, 'muro').pieza(AUD.clone(), M.col(PALETA[r() * PALETA.length | 0]), mt, UVK.muro);
            for (var qa = -2; qa <= 2; qa += 2) for (var qb = -1; qb <= 3; qb += 2) marcar(ca.x + xa.x * qa + u.x * qb, ca.z + xa.z * qa + u.z * qb);
            cuenta.audiencia = (cuenta.audiencia || 0) + 1; }
        } else for (var k2 = 0; k2 < 5; k2++) { var bp = pS.clone().lerp(pE, (k2 + .5) / 5).addScaledVector(u, -.4), yb = o.alto(bp.x, bp.z);
          var bo = new THREE.CylinderGeometry(.09, .11, .95, 8); bo.translate(bp.x, yb + .47, bp.z); junta(chB, 'fierro').pieza(bo, M.col('#2e2a26')); }
        cuenta.bocacalle++; hastaBoca = cadaBoca(); ultimo = null;
      } else {
        var v = r() < (muro ? .22 : .16) ? 3 : (r() * 3 | 0), hecho = colocar(pA, pB, Zm, (sA + s) / 2, obj, v, true);
        if (hecho && ultimo && !muro && !palaf) farolEn(pA, Zm, hecho.y + (andina ? (v === 0 || v === 3 ? -1.3 : 0) : v === 3 ? -1.2 : 0), hecho.ch);   /* en Chan Chan no hay faroles; en Los Andes, bajo el alero de las de un piso */
        ultimo = hecho; hastaBoca--;
      }
      pA = pB; sA = s; acum = 0; obj = hastaBoca === 0 ? BOCA : (o.curva && Math.abs(o.curva(s)) > .03 ? LG[0] : LG[r() * 4 | 0]);
    }
  });
  /* juntar: una malla por tramo y material (lo que no se ve se recorta solo) */
  var mallas = [];
  TR.forEach(function (tr) { Object.keys(tr).forEach(function (mk) { var m = new THREE.Mesh(tr[mk].geometria(), mats[mk]);
    m.castShadow = muro && !baja && mk === 'muro';   /* las casas no echan sombra: costaba entre 7 y 9 % del cuadro y casi no se nota (8-nov, lag en Trujillo y Huanchaco); las murallas sí (son pocas caras y la sombra hace el corredor) */ m.receiveShadow = mk !== 'luz' && mk !== 'charco'; m.userData.ciudad = true; E.add(m); mallas.push(m); }); });
  if (brillos.length) { var gB = new THREE.BufferGeometry(); gB.setAttribute('position', new THREE.Float32BufferAttribute(brillos, 3));
    var pb = new THREE.Points(gB, new THREE.PointsMaterial({ color: '#ffcf7a', size: 1.5, map: M.texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pb.userData.ciudad = true; E.add(pb); mallas.push(pb); }
  return { tipo: palaf ? 'palafito' : andina ? 'andina' : muro ? 'muralla' : playa ? 'playa' : 'casona', noche: noche, modulos: modulos, cuenta: cuenta, mallas: mallas, mats: mats, letreros: letreros.map(function (n) { return n[0] + ' ' + n[1]; }), ocupa: function (x, z) { return !!OC[Math.floor(x / 2) + ',' + Math.floor(z / 2)]; }, ms: Math.round(performance.now() - t0) };
};

/* al cambiar de pista: se suelta la imagen de los letreros (se vuelve a pintar si se vuelve a Huanchaco) */
M.ciudad.soltar = function () { if (ATLAS) { ATLAS.dispose(); ATLAS = null; } if (FRISOS) { FRISOS.color.dispose(); FRISOS.relieve.dispose(); FRISOS = null; } if (CHACRA) { CHACRA.dispose(); CHACRA = null; } [CHARCO, CHARCO_R, LAVADO].forEach(function (t) { if (t) t.dispose(); }); CHARCO = CHARCO_R = LAVADO = null; };

/* ---------- el malecón de Huanchaco: del lado del mar, donde la pista corre junto a la playa ----------
   Sobre el borde de la vereda: un murete, la baranda blanca (pilares, balaustres y pasamanos) y postes de luz que miran a
   la pista. Frente al muelle, la baranda se abre y una pasarela de madera baja de la vereda al muelle. */
M.malecon = function (E, o) {
  var t0 = performance.now(), baja = !!o.baja, L = o.L, W2 = o.W / 2, D = W2 + 2.6, off = o.lado * D / W2, mats = o.mats;
  var JB = new M.Junta(), JM = new M.Junta(), JF = new M.Junta(), JL = new M.Junta(), brillos = [], metros = 0, faroles = 0, mt = new M4();
  var blanco = M.col('#f3efe6'), gris = M.col('#cfc8bb'), cF = M.col('#2c3a33'), cM = M.col('#c09466'), cO = M.col('#a07a52');
  var AM = o.muelleAncho || 2.56, hueco = function (p) { return o.muelleX != null && Math.abs(p.x - o.muelleX) < AM / 2 + .25; };
  /* los tramos: puntos de la baranda cada 0,5 m donde la pista va junto al mar (empezando fuera, por si el tramo cruza la largada) */
  var s0 = 0; while (s0 < L && o.enMar(s0)) s0 += .5;
  var tramos = [], cur = null;
  for (var u = 0; u < L; u += .5) { var s = (s0 + u) % L;
    if (o.enMar(s)) { var p = o.pos(s, off); p.y = o.yEn(s, o.lado * D); if (!cur) { cur = []; tramos.push(cur); } cur.push(p); } else cur = null; }
  function seg(J, a, b, w, h, d, dy, col) {   /* una pieza de a a b (de largo |ab| + w), de alto h y ancho d, a dy sobre la vereda */
    var dx = b.x - a.x, dz = b.z - a.z, lg = Math.hypot(dx, dz) + w, g = new THREE.BoxGeometry(lg, h, d);
    mt.makeRotationY(-Math.atan2(dz, dx)).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2 + dy, (a.z + b.z) / 2); J.pieza(g, col, mt, .62); }
  var pasarela = null;
  tramos.forEach(function (T) {
    for (var i = 0; i + 2 < T.length; i += 2) { var a = T[i], b = T[i + 2], m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      if (hueco(m)) { if (!pasarela) pasarela = { x: o.muelleX, z: m.z, y: (a.y + b.y) / 2 }; continue; }
      metros += Math.hypot(b.x - a.x, b.z - a.z);
      seg(JB, a, b, .02, .75, .32, -.3, gris);   /* el murete: tapa el canto de la vereda y baja a la arena */
      seg(JB, a, b, .02, .09, .22, 1.0, blanco);   /* el pasamanos */
      seg(JB, a, b, .02, .07, .16, .16, blanco);   /* la base de los balaustres */
      if (baja) seg(JB, a, b, 0, .62, .05, .58, blanco);
      else for (var q = 0; q < 4; q++) { var f = (q + .5) / 4, bx = a.x + (b.x - a.x) * f, bz = a.z + (b.z - a.z) * f, by = a.y + (b.y - a.y) * f;
        var gb = new THREE.CylinderGeometry(.045, .06, .78, 6); gb.translate(bx, by + .58, bz); JB.pieza(gb, blanco); }
      if ((i / 2) % 3 === 0 || hueco({ x: T[Math.min(T.length - 1, i + 4)].x }) || (i >= 2 && hueco({ x: T[i - 2].x }))) {   /* pilar cada 3 m y a los dos lados del hueco */
        var gp = new THREE.BoxGeometry(.28, 1.2, .28); gp.translate(a.x, a.y + .5, a.z); JB.pieza(gp, blanco, null, .62);
        var gc = new THREE.BoxGeometry(.36, .08, .36); gc.translate(a.x, a.y + 1.13, a.z); JB.pieza(gc, blanco, null, .62); }
      if ((i / 2) % 12 === 6) {   /* el poste de luz, con su brazo hacia la pista */
        var n = new V3(); n.set(-(b.z - a.z), 0, b.x - a.x).normalize(); var haciaPista = o.pista(a.x + n.x, a.z + n.z) < o.pista(a.x - n.x, a.z - n.z) ? 1 : -1; n.multiplyScalar(haciaPista);
        var bx2 = a.x - n.x * .3, bz2 = a.z - n.z * .3, gpo = new THREE.CylinderGeometry(.06, .09, 4.2, 8); gpo.translate(bx2, a.y + 2.1, bz2); JF.pieza(gpo, cF);
        var gbr = new THREE.BoxGeometry(.05, .05, 1.0); mt.makeRotationY(Math.atan2(n.x, n.z)).setPosition(bx2 + n.x * .5, a.y + 4.1, bz2 + n.z * .5); JF.pieza(gbr, cF, mt);
        var lx = bx2 + n.x * 1.0, lz = bz2 + n.z * 1.0, gk = new THREE.BoxGeometry(.32, .08, .32); gk.translate(lx, a.y + 4.1, lz); JF.pieza(gk, cF);
        var gl = new THREE.BoxGeometry(.24, .34, .24); gl.translate(lx, a.y + 3.88, lz); JL.pieza(gl, M.col('#ffd59a'));
        brillos.push(lx, a.y + 3.85, lz); faroles++; }
    }
  });
  /* la pasarela al muelle: de la vereda baja a la arena y sube al tablero del muelle */
  var ocupa = null;
  if (pasarela && o.orilla != null) {
    var z0 = pasarela.z, z1 = o.orilla - .1, y0 = pasarela.y + .06, y1 = (o.muelleY || 1.86), lp = Math.abs(z0 - z1), sg = z1 < z0 ? -1 : 1, ang = Math.atan2(y1 - y0, lp);
    var gt = new THREE.BoxGeometry(AM, .14, Math.hypot(lp, y1 - y0)); gt.rotateX(sg < 0 ? ang : -ang); gt.translate(pasarela.x, (y0 + y1) / 2, (z0 + z1) / 2); JM.pieza(gt, cM, null, .55);
    for (var zz = 1.2; zz < lp; zz += 1.6) { var yy = y0 + (y1 - y0) * zz / lp, zp = z0 + sg * zz;
      [-1, 1].forEach(function (l) { var gpl = new THREE.BoxGeometry(.14, yy + .6, .14); gpl.translate(pasarela.x + l * (AM / 2 - .1), (yy - .6) / 2, zp); JM.pieza(gpl, cO, null, .55); }); }
    [-1, 1].forEach(function (l) { var xr = pasarela.x + l * (AM / 2 - .04);
      var gr = new THREE.BoxGeometry(.07, .07, Math.hypot(lp, y1 - y0)); gr.rotateX(sg < 0 ? ang : -ang); gr.translate(xr, (y0 + y1) / 2 + .9, (z0 + z1) / 2); JM.pieza(gr, cM, null, .55);
      for (var zz2 = 0; zz2 <= lp; zz2 += baja ? Math.max(lp, .5) : 1.2) { var yv = y0 + (y1 - y0) * zz2 / lp, gv = new THREE.BoxGeometry(.06, .9, .06); gv.translate(xr, yv + .45, z0 + sg * zz2); JM.pieza(gv, cO, null, .55); } });
    var xA = pasarela.x - AM / 2 - .6, xB = pasarela.x + AM / 2 + .6, zA = Math.min(z0, z1) - .5, zB = Math.max(z0, z1) + .5;
    ocupa = function (x, z) { return x > xA && x < xB && z > zA && z < zB; };
  }
  var mallas = [];
  function malla(J, mat, sombra) { if (!J.base) return; var m = new THREE.Mesh(J.geometria(), mat); m.castShadow = false; m.receiveShadow = !mat.isMeshBasicMaterial; m.userData.malecon = true; E.add(m); mallas.push(m); }
  malla(JB, mats.muro, true); malla(JM, mats.madera, true); malla(JF, mats.fierro, false); malla(JL, mats.luz, false);
  if (brillos.length) { var gB = new THREE.BufferGeometry(); gB.setAttribute('position', new THREE.Float32BufferAttribute(brillos, 3));
    var pb = new THREE.Points(gB, new THREE.PointsMaterial({ color: '#ffcf7a', size: 1.5, map: M.texBrillo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pb.userData.malecon = true; E.add(pb); mallas.push(pb); }
  return { metros: Math.round(metros), faroles: faroles, pasarela: !!pasarela, mallas: mallas, ocupa: ocupa || function () { return false; }, ms: Math.round(performance.now() - t0) };
};

/* ---------- Chan Chan: la plaza ceremonial, a un costado de la largada ----------
   La plataforma de barro (15 × 9 m, 2,4 de alto) con su friso de olas, la rampa al medio que baja hacia la pista y, arriba,
   un recinto bajo al fondo. Local: x a lo largo de la pista, y arriba, z hacia afuera (la cara de la plataforma en z = 0). */
M.plazaCeremonial = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, mats = o.mats, ANCHO = 15, FONDO = 9, HP = 2.4, RAMPA = 6, LEJOS = 12, Bc = [1, 1, 1], barro = M.col('#f4ece2');
  function sitio(l) { var p0 = o.pos(o.s, l * (1 + LEJOS / W2)), d = o.dir(o.s), n = new V3(-d.z * l, 0, d.x * l), xa = new V3(n.z, 0, -n.x), ok = true;
    [[-ANCHO / 2, -RAMPA], [ANCHO / 2, -RAMPA], [-ANCHO / 2, FONDO], [ANCHO / 2, FONDO], [0, FONDO / 2]].forEach(function (q) { var x = p0.x + xa.x * q[0] + n.x * q[1], z = p0.z + xa.z * q[0] + n.z * q[1];
      if (o.dist(x, z) < W2 + 5) ok = false; });
    return { p: p0, n: n, xa: xa, ok: ok }; }
  var A = sitio(o.lado || 1); if (!A.ok) { var B = sitio(-(o.lado || 1)); if (B.ok) A = B; }
  if (!A.ok) return { x: 0, z: 0, rampa: false, mallas: [], ocupa: function () { return false; } };   /* si no cabe en ningún lado sin pisar la pista, no va */
  var JM = new M.Junta(), JF = new M.Junta();
  function caja(w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); JM.pieza(g, col || Bc); }
  caja(ANCHO, HP + 1, FONDO, 0, (HP + 1) / 2 - 1, FONDO / 2);                       /* la plataforma */
  caja(ANCHO + .2, .16, .2, 0, HP + .02, -.05, [.95, .95, .95]);                     /* su borde */
  var fw = (ANCHO - 3.6) / 2 - .3;   /* el friso de olas a los dos lados de la rampa */
  [-1, 1].forEach(function (l) { var g = friso(fw, 3); g.scale(1, (HP - .7) / FR_ALTO, 1); g.translate(l * (1.8 + .15 + fw / 2), .35 + (HP - .7) / 2, -.03); JF.pieza(g, Bc); });
  var lr = Math.hypot(RAMPA, HP), ang = Math.atan2(HP, RAMPA), gr = new THREE.BoxGeometry(3.2, .3, lr); gr.rotateX(-ang); gr.translate(0, HP / 2 - .15, -RAMPA / 2); JM.pieza(gr, [.96, .96, .96]);   /* la rampa: sube hacia la plataforma */
  [-1, 1].forEach(function (l) { var gp = new THREE.BoxGeometry(.4, .7, lr); gp.rotateX(-ang); gp.translate(l * 1.8, HP / 2 + .2, -RAMPA / 2); JM.pieza(gp, [.9, .9, .9]); });   /* sus pretiles */
  caja(7, 1.8, .5, 0, HP + .9, FONDO - .6); [-1, 1].forEach(function (l) { caja(.5, 1.8, 3, l * 3.25, HP + .9, FONDO - 2.1); });   /* el recinto del fondo, arriba */
  if (!baja) [-2, 0, 2].forEach(function (x) { caja(.6, .8, .04, x, HP + 1, FONDO - .87, [.42, .38, .34]); });   /* sus hornacinas */
  var y = Math.min(o.alto(A.p.x, A.p.z), o.alto(A.p.x + A.n.x * FONDO, A.p.z + A.n.z * FONDO)) - .2, mt = new M4().makeBasis(A.xa, new V3(0, 1, 0), A.n).setPosition(A.p.x, y, A.p.z);
  var mallas = [];
  [[JM, mats.muro], [JF, mats.friso]].forEach(function (q) { if (!q[0].base) return; var g = q[0].geometria(q[0] === JM ? { oscuroAbajo: [.74, 1.2] } : null); g.applyMatrix4(mt);
    var c = g.attributes.color; for (var i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * barro[0], c.getY(i) * barro[1], c.getZ(i) * barro[2]);
    var m = new THREE.Mesh(g, q[1]); m.castShadow = !baja && q[1] === mats.muro; m.receiveShadow = true; m.userData.plaza = true; E.add(m); mallas.push(m); });
  var cx = A.p.x + A.n.x * FONDO / 2, cz = A.p.z + A.n.z * FONDO / 2;
  return { x: cx, z: cz, rampa: true, mallas: mallas,
    ocupa: function (x, z) { var dx = x - A.p.x, dz = z - A.p.z, u = dx * A.xa.x + dz * A.xa.z, w = dx * A.n.x + dz * A.n.z; return Math.abs(u) < ANCHO / 2 + 1.5 && w > -RAMPA - 1 && w < FONDO + 1.5; } };
};

/* ---------- Los Andes: la iglesia del pueblo, frente a la largada ----------
   Nave encalada con techo de teja a dos aguas y contrafuertes de piedra, la portada de piedra con su arco y el óculo, la torre
   campanario (piedra abajo, cal arriba, el campanario abierto con sus campanas, el cupulín y la cruz) y el atrio con su muro y su
   cruz. Local: x a lo largo de la pista, y arriba, z hacia afuera (la fachada en z = 0, mirando a la pista). */
M.iglesiaAndina = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, mats = o.mats, LEJOS = 10, Bc = [1, 1, 1], t = Math.tan(PENDIENTE), Hn = 8.95;
  function sitio(l) { var p0 = o.pos(o.s, l * (1 + LEJOS / W2)), d = o.dir(o.s), n = new V3(-d.z * l, 0, d.x * l), xa = new V3(n.z, 0, -n.x), ok = true;
    [[-11, -5], [11, -5], [-11, 27], [11, 27], [0, 12], [-11, 12], [11, 12], [0, -5]].forEach(function (q) { if (o.dist(p0.x + xa.x * q[0] + n.x * q[1], p0.z + xa.z * q[0] + n.z * q[1]) < W2 + 4) ok = false; });
    return { p: p0, n: n, xa: xa, ok: ok }; }
  var A = sitio(o.lado || 1); if (!A.ok) { var A2 = sitio(-(o.lado || 1)); if (A2.ok) A = A2; }
  if (!A.ok) return null;   /* si no cabe sin pisar la pista, no va */
  var noche = !!o.noche, J = { muro: new M.Junta(), piedra: new M.Junta(), tejas: new M.Junta(), madera: new M.Junta(), fierro: new M.Junta(), luz: new M.Junta(), lavado: new M.Junta() }, brillos = [], C1 = M.col('#ffd59a');
  function caja(k, w, h, d, x, y, z, col) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); J[k].pieza(g, col || Bc, null, UVK[k === 'muro' ? 'muro' : k] || .5); }
  /* el atrio: plataforma de piedra, su muro (abierto al frente) y la cruz */
  caja('piedra', 22, .9, 32, 0, 0, 11); caja('piedra', 21.9, 3, 31.9, 0, -1.9, 11);   /* el faldón de piedra: no flota donde el terreno baja */
  [-1, 1].forEach(function (l) { caja('piedra', 9, .8, .5, l * 6.5, .85, -4.75); caja('piedra', .5, .8, 32, l * 10.75, .85, 11); });
  caja('piedra', 2.2, .4, 2.2, 0, .65, -2); caja('piedra', 1.5, .4, 1.5, 0, 1.05, -2); caja('piedra', .9, .6, .9, 0, 1.55, -2);
  caja('piedra', .3, 3.2, .3, 0, 3.45, -2); caja('piedra', 1.5, .3, .3, 0, 4.2, -2);
  /* la nave, sus contrafuertes y el techo de teja (la cumbrera a lo largo de la nave) */
  caja('muro', 10, 9.0, 24, 0, (Hn - .05) / 2, 12);
  [5, 11, 17, 23].forEach(function (z) { [-1, 1].forEach(function (l) { caja('piedra', 1.0, 6.5, 1.4, l * 5.5, 3.25, z); }); });
  var run = 5.6, wR = Math.hypot(run, run * t), yR = Hn + (run / 2 - .6) * t;
  faldon(J.tejas, 24.8, wR, -PENDIENTE, -run / 2, yR + .06, 12, Math.PI / 2); faldon(J.tejas, 24.8, wR, PENDIENTE, run / 2, yR + .06, 12, Math.PI / 2);
  faldon(J.tejas, 25, .4, 0, 0, Hn + 5 * t + .12, 12, Math.PI / 2);
  [0, 24].forEach(function (z) { var g = new THREE.BoxGeometry(10, 5 * t, .3); M.torcer(g, function (q) { if (q.y > 0) q.x = 0; }); g.translate(0, Hn + 5 * t / 2, z); J.muro.pieza(g, Bc, null, UVK.muro); });   /* los hastiales */
  /* la portada: pilastras y arco de piedra, la puerta de madera y el óculo */
  [-1, 1].forEach(function (l) { caja('piedra', .7, 5.0, .5, l * 2.1, 2.5, -.25); });
  var arco = new THREE.TorusGeometry(2.1, .35, 6, baja ? 8 : 14, Math.PI); arco.translate(0, 5.0, -.25); J.piedra.pieza(arco, Bc, null, .5);
  if (noche) {   /* de noche, la puerta abierta con la luz de adentro */
    [-1, 1].forEach(function (l) { caja('madera', .7, 4.5, .1, l * 1.15, 2.3, -.05, [.42, .28, .18]); }); caja('luz', 1.6, 4.4, .02, 0, 2.25, -.02, C1); brillos.push(0, 2.0, -.6);
  } else { caja('madera', 3.0, 4.6, .1, 0, 2.3, -.05, [.42, .28, .18]); if (!baja) caja('madera', .06, 4.5, .06, 0, 2.3, -.12, [.3, .2, .12]); }
  var ocu = new THREE.CylinderGeometry(.6, .6, .1, baja ? 10 : 18); ocu.rotateX(Math.PI / 2); ocu.translate(0, 8.2, -.05);   /* entre el arco (llega a 7,45) y el hastial (8,95) */ if (noche) { J.luz.pieza(ocu, C1); brillos.push(0, 8.2, -.4); } else J.fierro.pieza(ocu, [.25, .24, .26]);
  var aro = new THREE.TorusGeometry(.65, .12, 6, baja ? 10 : 18); aro.translate(0, 8.2, -.08); J.piedra.pieza(aro, Bc, null, .5);
  /* la torre: piedra abajo, cal arriba, el campanario abierto, sus campanas, el cupulín y la cruz */
  var tx = -7.2, tz = 2.6;   /* pegada a la nave */
  caja('piedra', 4.4, 6.5, 4.4, tx, 3.2, tz); caja('muro', 4.0, 6.0, 4.0, tx, 9.45, tz); caja('piedra', 4.6, .4, 4.6, tx, 12.65, tz);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { caja('muro', .9, 3.2, .9, tx + q[0] * 1.55, 14.45, tz + q[1] * 1.55); });
  caja('piedra', 4.4, .5, .6, tx, 16.0, tz - 1.7); caja('piedra', 4.4, .5, .6, tx, 16.0, tz + 1.7); caja('piedra', .6, .5, 4.4, tx - 1.7, 16.0, tz); caja('piedra', .6, .5, 4.4, tx + 1.7, 16.0, tz);
  caja('piedra', 4.6, .35, 4.6, tx, 16.45, tz);
  caja('madera', 3.6, .2, .2, tx, 15.1, tz, [.4, .28, .18]); caja('madera', .2, .2, 3.6, tx, 15.1, tz, [.4, .28, .18]);   /* el travesaño del que cuelgan */
  [[-.7, 0], [.7, 0]].forEach(function (q) { var cb = new THREE.CylinderGeometry(.3, .5, .75, baja ? 8 : 12); cb.translate(tx + q[0], 14.6, tz + q[1]); J.fierro.pieza(cb, [.55, .42, .22]); });   /* las campanas, de bronce */
  var cup = new THREE.SphereGeometry(1.7, baja ? 10 : 16, baja ? 5 : 8, 0, Math.PI * 2, 0, Math.PI / 2); cup.translate(tx, 16.6, tz); J.muro.pieza(cup, Bc, null, UVK.muro);
  if (noche) { caja('luz', 2.2, .12, 2.2, tx, 15.8, tz, C1); brillos.push(tx, 14.4, tz);   /* el campanario encendido */
    var lv = new THREE.PlaneGeometry(10.4, 9.2); lv.rotateY(Math.PI); lv.translate(0, 4.6, -.22); lv.userData.uvPropio = true; J.lavado.pieza(lv, C1);   /* la fachada bañada de luz desde abajo */
    if (!baja) { var lt = new THREE.PlaneGeometry(4.6, 12.4); lt.rotateY(Math.PI); lt.translate(tx, 6.2, tz - 2.45); lt.userData.uvPropio = true; J.lavado.pieza(lt, C1); }   /* y la torre (en los celulares flojos, no: es mucho relleno) */
    [-3.5, 3.5].forEach(function (x) { caja('fierro', .5, .35, .4, x, .7, -3.6, [.2, .2, .22]); caja('luz', .38, .22, .04, x, .74, -3.38, C1); brillos.push(x, .8, -3.2); }); }   /* los reflectores del atrio */
  caja('muro', .6, 1.0, .6, tx, 18.7, tz); caja('fierro', .12, 1.4, .12, tx, 19.9, tz, [.25, .23, .22]); caja('fierro', .7, .12, .12, tx, 20.15, tz, [.25, .23, .22]);
  var y = Math.min(o.alto(A.p.x, A.p.z), o.alto(A.p.x + A.n.x * 12, A.p.z + A.n.z * 12)) - .3, mt = new M4().makeBasis(A.xa, new V3(0, 1, 0), A.n).setPosition(A.p.x, y, A.p.z);
  var mallas = [];
  Object.keys(J).forEach(function (k) { if (!J[k].base) return; var g = J[k].geometria(k === 'muro' ? { oscuroAbajo: [.8, 1.0] } : null); g.applyMatrix4(mt); if (k === 'tejas') g.userData.uvPropio = true;
    var mat = k === 'lavado' ? matLuzAditiva(texLavado(), .8) : mats[k], m = new THREE.Mesh(g, mat); m.castShadow = !baja && k !== 'fierro' && k !== 'luz' && k !== 'lavado'; m.receiveShadow = k !== 'luz' && k !== 'lavado'; m.userData.iglesia = true; E.add(m); mallas.push(m); });
  if (brillos.length) { var vb = new V3(), wb = []; for (var ib = 0; ib < brillos.length; ib += 3) { vb.set(brillos[ib], brillos[ib + 1], brillos[ib + 2]).applyMatrix4(mt); wb.push(vb.x, vb.y, vb.z); }
    var pb = brilloPuntos(wb, baja ? 2.0 : 3.2); pb.userData.iglesia = true; E.add(pb); mallas.push(pb); }
  var cx = A.p.x + A.n.x * 12, cz = A.p.z + A.n.z * 12;
  return { x: cx, z: cz, alto: 20.2, torre: true, iluminada: noche, lado: A.n.x * -o.dir(o.s).z + A.n.z * o.dir(o.s).x > 0 ? 1 : -1, mallas: mallas,
    ocupa: function (x, z) { var dx = x - A.p.x, dz = z - A.p.z, u = dx * A.xa.x + dz * A.xa.z, w = dx * A.n.x + dz * A.n.z; return Math.abs(u) < 12.5 && w > -6.5 && w < 28.5; } };
};

/* ---------- Trujillo: la catedral frente a la largada (9-nov, pedido del dueño: de cerca se veía simple) ----------
   Amarilla con blanco, al estilo de la de Trujillo (hecha aquí, sin modelos de nadie). La fachada mira a la pista (-z) y el
   edificio se va hacia atrás (+z), como la iglesia andina:
     · la portada de dos cuerpos sobre tres gradas: la puerta de madera en arco (con su tímpano de vidrio y fierro) entre
       cuatro columnas con pedestal, basa y capitel; el entablamento; la ventana del coro entre pilastras y dos hornacinas;
       la cornisa y el remate curvo con su óculo, sus pináculos y la cruz;
     · dos torres: el cuerpo bajo con pilastras en las esquinas y ventanas, la balaustrada, el campanario abierto (cuatro
       arcos: se ve el cielo) con dos campanas de bronce colgadas de su viga, pináculos y el cupulín con linterna y cruz;
     · la nave con contrafuertes, ventanas altas y su bóveda; la cúpula sobre su tambor con ventanas y pilastras, sus
       nervios, la linterna y la cruz.
   Con los materiales de la ciudad (estuco y madera reales). En los celulares flojos: sin balaustres, rejas ni tableros,
   y con menos curvas. Si al frente de la largada no cabe, se aleja de la pista hasta que quepa. */
M.catedral = function (E, o) {
  var t0 = performance.now(), W2 = o.W / 2, baja = !!o.baja, mats = o.mats, sg = baja ? 5 : 10, sc = baja ? 8 : 14;
  /* la foto del estuco y la de la madera oscurecen: el amarillo, el blanco y la madera de la puerta se aclaran (es la joya de la plaza) */
  var AM = M.col('#e9b84a', 1.4), BL = M.col('#f6f2e8', 1.2), PI = M.col('#c4bdb1', 1.1), CAL = M.col('#ece6d8', 1.2), MAD = M.col('#a06a3e', 2.0), MAD2 = M.col('#7e5030', 2.0), BRO = M.col('#a8803e', 1.5), FI = M.col('#3a3632');
  var J = { muro: new M.Junta(), madera: new M.Junta(), fierro: new M.Junta(), vidrio: new M.Junta() };
  var cuenta = { columna: 0, puerta: 0, coro: 0, remate: 0, grada: 0, torre: 0, arco: 0, campana: 0, balaustre: 0, pinaculo: 0, cupulin: 0, cruz: 0, contrafuerte: 0, ventana: 0, tambor: 0, nervio: 0, linterna: 0 };
  var V2 = THREE.Vector2, PERFIL_BAL = [[.075, 0], [.075, .06], [.1, .13], [.115, .24], [.08, .38], [.055, .48], [.075, .58], [.075, .66]].map(function (q) { return new V2(q[0], q[1]); });
  var PERFIL_CAMP = [[.44, 0], [.39, .08], [.31, .2], [.27, .4], [.25, .6], [.22, .74], [.14, .8], [.001, .82]].map(function (q) { return new V2(q[0], q[1]); });
  var ESQ = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function pieza(k, g, col, m) { J[k].pieza(g, col || BL, m || null, UVK[k] || .5); }
  function caja(k, w, h, d, x, y, z, col, m) { var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); pieza(k, g, col, m); }
  function cil(k, rt, rb, h, n, x, y, z, col) { var g = new THREE.CylinderGeometry(rt, rb, h, n); g.translate(x, y, z); pieza(k, g, col); }
  function media(k, r, n, h, x, y, z, col) { var g = new THREE.SphereGeometry(r, n, h, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(x, y, z); pieza(k, g, col); }
  function giro(a, x, y, z) { return new M4().makeRotationY(a).setPosition(x, y, z); }
  function extruir(s, d) { return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: sg }); }
  /* las formas: el marco en arco (una U con su arco), el vano lleno (el vidrio) y la enjuta (el muro sobre un arco) */
  function marco(wo, wi, h) { var s = new THREE.Shape(), ro = wo / 2, ri = wi / 2;
    s.moveTo(-ro, 0); s.lineTo(-ro, h); s.absarc(0, h, ro, Math.PI, 0, true); s.lineTo(ro, 0); s.lineTo(ri, 0); s.lineTo(ri, h); s.absarc(0, h, ri, 0, Math.PI, false); s.lineTo(-ri, 0); return s; }
  function lleno(w, h) { var s = new THREE.Shape(), r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h); s.absarc(0, h, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; }
  function enjuta(a, h) { var s = new THREE.Shape(); s.moveTo(-a, 0); s.lineTo(-a, h); s.lineTo(a, h); s.lineTo(a, 0); s.absarc(0, 0, a, 0, Math.PI, false); return s; }
  function remate(kx, ky) { var s = new THREE.Shape(); s.moveTo(-4.8 * kx, 0); s.lineTo(-4.8 * kx, .5 * ky); s.bezierCurveTo(-3.4 * kx, .5 * ky, -2.6 * kx, 1.1 * ky, -2.1 * kx, 2.0 * ky);
    s.absellipse(0, 2.0 * ky, 2.1 * kx, 2.1 * ky, Math.PI, 0, true, 0); s.bezierCurveTo(2.6 * kx, 1.1 * ky, 3.4 * kx, .5 * ky, 4.8 * kx, .5 * ky); s.lineTo(4.8 * kx, 0); return s; }
  /* una ventana en arco que mira a -z (m la lleva a su pared): marco blanco, vidrio, alféizar y (si no es floja) su reja */
  function ventana(wi, h, mc, m, sinReja) { var f = extruir(marco(wi + mc * 2, wi, h), .2); f.translate(0, 0, -.2); pieza('muro', f, BL, m);
    var v = new THREE.ShapeGeometry(lleno(wi, h), sg); v.rotateY(Math.PI); v.translate(0, 0, -.05); pieza('vidrio', v, BL, m);
    caja('muro', wi + mc * 2 + .2, .14, .32, 0, -.07, -.16, BL, m);
    if (!baja && !sinReja) { caja('fierro', .05, h + wi / 2 - .1, .05, 0, (h + wi / 2) / 2, -.07, FI, m); caja('fierro', wi, .05, .05, 0, h * .55, -.07, FI, m); } }
  function pinaculo(x, y, z) { caja('muro', .44, .5, .44, x, y + .25, z, BL); var b = new THREE.SphereGeometry(.2, 8, 6); b.translate(x, y + .7, z); pieza('muro', b, BL);
    var c = new THREE.ConeGeometry(.07, .4, 6); c.translate(x, y + 1.05, z); pieza('muro', c, BL); cuenta.pinaculo++; }

  /* el faldón (no flota donde el suelo baja) y las tres gradas */
  caja('muro', 20.6, 4.0, 20.0, 0, -2.0, 7.65, PI);
  [[2.1, .09], [1.65, .27], [1.2, .45]].forEach(function (q) { caja('muro', 11.6, .18, q[0], 0, q[1], -q[0] / 2, PI); cuenta.grada++; });
  /* la nave (su frente es la fachada del medio), el zócalo, las cornisas y la bóveda */
  caja('muro', 11.0, 12.12, 17.4, 0, 6.06, 8.7, AM);
  caja('muro', 11.0, .9, .14, 0, .45, -.07, PI); caja('muro', 11.28, .9, .14, 0, .45, 17.47, PI);
  caja('muro', 11.8, .28, .5, 0, 11.76, 17.6, BL); caja('muro', 12.0, .2, .7, 0, 12.0, 17.65, BL);
  var bv = new THREE.CylinderGeometry(5.5, 5.5, 17.0, baja ? 10 : 16, 1, false, Math.PI / 2, Math.PI); bv.rotateX(Math.PI / 2); bv.scale(1, .3, 1); bv.translate(0, 12.12, 8.7); pieza('muro', bv, CAL);
  [-1, 1].forEach(function (l) {
    caja('muro', .14, .9, 13.3, l * 5.57, .45, 10.85, PI);
    caja('muro', .5, .28, 13.7, l * 5.6, 11.76, 10.75, BL); caja('muro', .7, .2, 13.9, l * 5.65, 12.0, 10.75, BL);
    [5.0, 9.0, 13.0, 16.9].forEach(function (z) {   /* los contrafuertes, escalonados */
      caja('muro', 1.1, .9, 1.0, l * 6.0, .45, z, PI); caja('muro', 1.0, 8.6, .9, l * 6.0, 4.3, z, AM); caja('muro', 1.12, .16, 1.02, l * 6.0, 8.68, z, BL);
      caja('muro', .6, 1.8, .7, l * 5.8, 9.66, z, AM); caja('muro', .72, .14, .82, l * 5.8, 10.6, z, BL); cuenta.contrafuerte++; });
    [7.0, 11.0, 15.0].forEach(function (z) { ventana(1.0, 1.6, .26, giro(-l * Math.PI / 2, l * 5.5, 7.6, z)); cuenta.ventana++; });   /* las ventanas altas */
  });

  /* la portada, primer cuerpo: la puerta en arco con su marco y su clave, el tímpano y las cuatro columnas */
  var yP = .54, fP = extruir(marco(3.9, 3.0, 3.6), .32); fP.translate(0, yP, -.32); pieza('muro', fP, BL);
  caja('muro', .5, .72, .44, 0, yP + 5.35, -.22, BL);
  [-1, 1].forEach(function (l) { caja('madera', 1.48, 3.58, .08, l * .75, yP + 1.79, -.04, MAD);
    if (!baja) for (var k = 0; k < 3; k++) caja('madera', 1.02, .9, .05, l * .75, yP + .62 + k * 1.15, -.1, MAD2); });   /* las dos hojas con sus tableros */
  caja('madera', 3.0, .16, .12, 0, yP + 3.6, -.06, MAD2);   /* el dintel bajo el tímpano */
  var ti = new THREE.CircleGeometry(1.5, sg * 2, 0, Math.PI); ti.rotateY(Math.PI); ti.translate(0, yP + 3.6, -.05); pieza('vidrio', ti, BL);
  if (!baja) [-2, -1, 0, 1, 2].forEach(function (k) { var b = new THREE.BoxGeometry(.05, 1.45, .04); b.translate(0, .725, 0); b.rotateZ(k * Math.PI / 6); b.translate(0, yP + 3.6, -.07); pieza('fierro', b, FI); });
  cuenta.puerta++;
  [-3.55, -2.45, 2.45, 3.55].forEach(function (x) {
    caja('muro', .74, 1.5, .74, x, yP + .75, -.55, BL); caja('muro', .84, .12, .84, x, yP + 1.56, -.55, BL);   /* el pedestal */
    cil('muro', .33, .35, .18, sc, x, yP + 1.71, -.55, BL); cil('muro', .235, .27, 3.85, sc, x, yP + 3.725, -.55, BL);   /* la basa y el fuste */
    cil('muro', .37, .25, .24, sc, x, yP + 5.77, -.55, BL); caja('muro', .8, .12, .8, x, yP + 5.95, -.55, BL); cuenta.columna++; });   /* el capitel */
  caja('muro', 8.4, .34, 1.05, 0, 6.72, -.45, BL); caja('muro', 8.2, .42, .9, 0, 7.1, -.38, AM);   /* el entablamento */
  caja('muro', 9.0, .2, 1.25, 0, 7.41, -.55, BL); caja('muro', 9.3, .12, 1.4, 0, 7.57, -.62, BL);
  /* el segundo cuerpo: la ventana del coro entre pilastras, dos hornacinas y la cornisa */
  ventana(1.5, 2.0, .38, giro(0, 0, 8.1, 0)); cuenta.coro++;
  [-3.0, -1.75, 1.75, 3.0].forEach(function (x) { caja('muro', Math.abs(x) > 2 ? .5 : .38, 3.85, .2, x, 9.56, -.1, BL); });
  [-1, 1].forEach(function (l) { ventana(.7, 1.0, .18, giro(0, l * 4.35, 8.5, 0), true); });
  caja('muro', 11.4, .3, .8, 0, 11.75, -.25, BL); caja('muro', 11.8, .22, 1.0, 0, 12.01, -.35, BL);
  /* el remate: curvo, amarillo con su borde blanco, el óculo, los pináculos y la cruz */
  var yR = 12.12, fr = extruir(remate(1, 1), .3); fr.translate(0, yR, -.42); pieza('muro', fr, AM);
  var fb = extruir(remate(1.07, 1.05), .3); fb.translate(0, yR, -.27); pieza('muro', fb, BL);
  var oc = new THREE.TorusGeometry(.64, .1, 6, sg * 2); oc.translate(0, yR + 2.0, -.45); pieza('muro', oc, BL);
  var ov = new THREE.CircleGeometry(.62, sg * 2); ov.rotateY(Math.PI); ov.translate(0, yR + 2.0, -.47); pieza('vidrio', ov, BL);   /* a 5 cm de la cara del remate (sin parpadeo de lejos) */
  caja('muro', .44, .3, .44, 0, yR + 4.46, -.27, BL); caja('fierro', .12, 1.5, .12, 0, yR + 5.36, -.27, FI); caja('fierro', .76, .12, .12, 0, yR + 5.61, -.27, FI);
  cuenta.cruz++; cuenta.remate++;
  [-1, 1].forEach(function (l) { pinaculo(l * 4.9, yR, -.3); });

  /* las dos torres */
  [-1, 1].forEach(function (l) { var tx = l * 7.8, tz = 1.9;
    caja('muro', 4.6, 12.12, 4.6, tx, 6.06, tz, AM); caja('muro', 4.76, .9, 4.76, tx, .45, tz, PI);
    ESQ.forEach(function (q) { caja('muro', .6, 11.2, .6, tx + q[0] * 2.05, 6.5, tz + q[1] * 2.05, BL); });   /* las pilastras de las esquinas */
    caja('muro', 4.8, .42, 4.8, tx, 7.1, tz, BL);
    ventana(.8, 1.25, .25, giro(0, tx, 8.7, tz - 2.3)); ventana(.8, 1.25, .25, giro(-l * Math.PI / 2, tx + l * 2.3, 8.7, tz));
    caja('muro', 4.95, .3, 4.95, tx, 11.75, tz, BL); caja('muro', 5.25, .22, 5.25, tx, 12.01, tz, BL);
    /* la balaustrada (en los celulares flojos, un pretil) */
    caja('muro', 4.75, .16, 4.75, tx, 12.2, tz, BL);
    for (var c4 = 0; c4 < 4; c4++) { var mL = giro(c4 * Math.PI / 2, tx, 0, tz);
      if (baja) caja('muro', 4.4, .7, .22, 0, 12.63, -2.2, BL, mL);
      else for (var i = 0; i < 8; i++) { var bl = new THREE.LatheGeometry(PERFIL_BAL, 5); bl.translate(-1.75 + i * .5, 12.28, -2.2); pieza('muro', bl, BL, mL); cuenta.balaustre++; }
      caja('muro', 4.6, .14, .28, 0, 13.01, -2.2, BL, mL); }
    if (!baja) ESQ.forEach(function (q) { caja('muro', .36, .8, .36, tx + q[0] * 2.2, 12.68, tz + q[1] * 2.2, BL);
      var b = new THREE.SphereGeometry(.16, 8, 6); b.translate(tx + q[0] * 2.2, 13.22, tz + q[1] * 2.2); pieza('muro', b, BL); cuenta.pinaculo++; });
    /* el campanario abierto: cuatro pilares, cuatro arcos con su arquivolta, la viga y dos campanas de bronce */
    caja('muro', 3.6, .15, 3.6, tx, 12.36, tz, CAL);
    ESQ.forEach(function (q) { caja('muro', .85, 4.47, .85, tx + q[0] * 1.375, 14.515, tz + q[1] * 1.375, AM); caja('muro', .95, .14, .95, tx + q[0] * 1.375, 14.93, tz + q[1] * 1.375, BL); });
    for (c4 = 0; c4 < 4; c4++) { var mC = giro(c4 * Math.PI / 2, tx, 15.0, tz);
      var en = extruir(enjuta(.95, 1.75), .5); en.translate(0, 0, -1.8); pieza('muro', en, AM, mC);
      var av = new THREE.TorusGeometry(1.0, .075, 4, sg + 2, Math.PI); av.translate(0, 0, -1.82); pieza('muro', av, BL, mC); cuenta.arco++; }
    caja('muro', 3.6, .25, 3.6, tx, 16.63, tz, AM); caja('madera', 3.0, .2, .2, tx, 16.3, tz, MAD2);
    [-1, 1].forEach(function (k) { var cp = new THREE.LatheGeometry(PERFIL_CAMP, baja ? 7 : 12); cp.translate(tx + k * .72, 15.38, tz); pieza('fierro', cp, BRO);
      var bo = new THREE.CircleGeometry(.4, 10); bo.rotateX(Math.PI / 2); bo.translate(tx + k * .72, 15.43, tz); pieza('fierro', bo, FI); cuenta.campana++; });
    /* la cornisa, los pináculos y el cupulín con su linterna y su cruz */
    caja('muro', 4.0, .26, 4.0, tx, 16.88, tz, BL); caja('muro', 4.3, .2, 4.3, tx, 17.11, tz, BL);
    ESQ.forEach(function (q) { pinaculo(tx + q[0] * 1.85, 17.21, tz + q[1] * 1.85); });
    cil('muro', 1.3, 1.36, .8, 8, tx, 17.61, tz, AM); cil('muro', 1.48, 1.48, .14, 8, tx, 18.08, tz, BL);
    media('muro', 1.38, baja ? 10 : 16, baja ? 4 : 7, tx, 18.15, tz, BL);
    cil('muro', .3, .3, .62, 8, tx, 19.75, tz, BL); media('muro', .34, 8, 4, tx, 20.06, tz, BL);
    caja('fierro', .09, 1.0, .09, tx, 20.85, tz, FI); caja('fierro', .5, .09, .09, tx, 21.05, tz, FI);
    cuenta.cupulin++; cuenta.cruz++; cuenta.torre++; });

  /* la cúpula: su base, el tambor con pilastras y ventanas, la cornisa, la media naranja con sus nervios y la linterna */
  var zc = 12.4;
  caja('muro', 7.2, 1.7, 7.2, 0, 12.97, zc, AM); caja('muro', 7.6, .24, 7.6, 0, 13.94, zc, BL);
  cil('muro', 3.0, 3.0, 2.2, 16, 0, 15.16, zc, AM);   /* 16 caras también en los flojos: las ventanas y pilastras quedan pegadas al tambor */
  for (var k8 = 0; k8 < 8; k8++) { var a8 = k8 * Math.PI / 4;
    var pl = new THREE.BoxGeometry(.34, 2.2, .18); pl.translate(0, 0, 3.04); pl.rotateY(a8 + Math.PI / 8); pl.translate(0, 15.16, zc); pieza('muro', pl, BL);
    var mv = new THREE.BoxGeometry(.72, 1.3, .05); mv.translate(0, 0, 3.02); mv.rotateY(a8); mv.translate(0, 15.1, zc); pieza('muro', mv, BL);
    var vv = new THREE.BoxGeometry(.5, 1.05, .06); vv.translate(0, 0, 3.05); vv.rotateY(a8); vv.translate(0, 15.1, zc); pieza('vidrio', vv, BL); cuenta.tambor++;
    var nv = new THREE.TorusGeometry(3.13, .085, 4, baja ? 5 : 10, Math.PI / 2); nv.rotateY(a8); nv.translate(0, 16.56, zc); pieza('muro', nv, BL); cuenta.nervio++; }
  cil('muro', 3.26, 3.2, .3, 16, 0, 16.41, zc, BL);
  media('muro', 3.1, baja ? 14 : 24, baja ? 6 : 10, 0, 16.56, zc, AM);
  cil('muro', .62, .66, 1.2, 8, 0, 20.05, zc, BL); cil('muro', .76, .76, .12, 8, 0, 20.71, zc, BL); media('muro', .66, 10, 4, 0, 20.77, zc, AM);
  if (!baja) for (var k4 = 0; k4 < 4; k4++) { var lv = new THREE.BoxGeometry(.2, .62, .04); lv.translate(0, 0, .64); lv.rotateY(k4 * Math.PI / 2 + Math.PI / 4); lv.translate(0, 20.05, zc); pieza('vidrio', lv, BL); }
  caja('fierro', .1, 1.2, .1, 0, 22.0, zc, FI); caja('fierro', .6, .1, .1, 0, 22.2, zc, FI); cuenta.linterna++; cuenta.cruz++;

  /* dónde va: frente a la largada, del lado pedido; si no cabe sin acercarse a la pista, más atrás */
  function sitio(l, lej) { var p0 = o.pos(o.s, l * (1 + lej / W2)), d = o.dir(o.s), n = new V3(-d.z * l, 0, d.x * l), xa = new V3(n.z, 0, -n.x), ok = true;
    [[-10.4, -2.3], [10.4, -2.3], [-10.4, 17.7], [10.4, 17.7], [0, 8], [-10.4, 8], [10.4, 8], [0, -2.3]].forEach(function (q) { if (o.dist(p0.x + xa.x * q[0] + n.x * q[1], p0.z + xa.z * q[0] + n.z * q[1]) < W2 + 3.5) ok = false; });
    return { p: p0, n: n, xa: xa, ok: ok }; }
  var A = sitio(o.lado || 1, 7.5); [9.5, 11.5, 14].some(function (lj) { if (A.ok) return true; A = sitio(o.lado || 1, lj); return A.ok; });   /* si ninguno cabe, queda el más lejano */
  var y = o.alto(A.p.x - A.n.x * 2.6, A.p.z - A.n.z * 2.6) - .04, mt = new M4().makeBasis(A.xa, new V3(0, 1, 0), A.n).setPosition(A.p.x, y, A.p.z);
  var grupo = new THREE.Group();
  Object.keys(J).forEach(function (k) { if (!J[k].base) return; var g = J[k].geometria(k === 'muro' ? { oscuroAbajo: [.8, 1.3] } : null); g.applyMatrix4(mt);
    var m = new THREE.Mesh(g, mats[k]); m.castShadow = !baja && k === 'muro'; m.receiveShadow = k !== 'vidrio'; m.matrixAutoUpdate = false; m.userData.parte = k; m.userData.catedral = true; grupo.add(m); });
  E.add(grupo);
  function enMundo(x, yy, z) { return new V3(x, yy, z).applyMatrix4(mt); }
  var vanos = []; [-1, 1].forEach(function (l) { var c = enMundo(l * 7.8, 15.55, 1.9); vanos.push({ x: c.x, y: c.y, z: c.z, dx: A.n.x, dz: A.n.z }, { x: c.x, y: c.y, z: c.z, dx: A.xa.x, dz: A.xa.z }); });
  var pu = enMundo(0, 2.3, -.1), ce = enMundo(0, 0, 7.6);
  grupo.userData = { catedral: true, cuenta: cuenta, vanos: vanos, puerta: { x: pu.x, z: pu.z }, ancho: 20.2, ms: Math.round(performance.now() - t0),
    ocupa: function (x, z) { var dx = x - A.p.x, dz = z - A.p.z, u = dx * A.xa.x + dz * A.xa.z, w = dx * A.n.x + dz * A.n.z; return Math.abs(u) < 10.6 && w > -2.6 && w < 18; } };
  return { g: grupo, x: ce.x, z: ce.z, alto: 22.6 };
};

/* ---------- Los Andes: la pileta de la plaza, con sus bancas ---------- */
M.pileta = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, mats = o.mats, l = o.lado || 1;
  function cabe(c) { if (o.dist(c.x, c.z) < W2 + 8.5) return false; for (var k = 0; k < 12; k++) { var a = k / 12 * 6.283; if (o.dist(c.x + Math.cos(a) * 7, c.z + Math.sin(a) * 7) < W2 + 3) return false; } return true; }   /* la plaza (7 m de radio) no pisa la vereda */
  var p0 = o.pos(o.s, l * (1 + 11 / W2)); if (!cabe(p0)) { l = -l; p0 = o.pos(o.s, l * (1 + 11 / W2)); if (!cabe(p0)) return null; }
  var JP = new M.Junta(), JM = new M.Junta(), Bc = [1, 1, 1], sg = baja ? 8 : 16;
  function cil(J, r1, r2, h, y, lados, col) { var g = new THREE.CylinderGeometry(r1, r2, h, lados); g.translate(0, y, 0); J.pieza(g, col || Bc, null, .5); }
  cil(JP, 7, 7, .2, .0, baja ? 16 : 32, [.92, .9, .86]);       /* el piso de la plaza */
  cil(JP, 2.0, 2.1, .6, .4, 8); cil(JP, .22, .3, 1.5, 1.3, sg); cil(JP, .8, .35, .3, 2.0, sg); cil(JP, .1, .2, .3, 2.3, sg);
  var gs = new THREE.SphereGeometry(.2, sg, 6); gs.translate(0, 2.55, 0); JP.pieza(gs, Bc, null, .5);
  [.785, 2.356, 3.927, 5.498].forEach(function (a) { var m = new M4().makeRotationY(-a).setPosition(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6);
    var gb = new THREE.BoxGeometry(.45, .1, 1.8); gb.translate(0, .5, 0); gb.applyMatrix4(m); JM.pieza(gb, [.62, .42, .26], null, .55);
    [-.65, .65].forEach(function (zz) { var gp = new THREE.BoxGeometry(.4, .45, .2); gp.translate(0, .25, zz); gp.applyMatrix4(m); JP.pieza(gp, Bc, null, .5); }); });
  var JF = new M.Junta(), JL = new M.Junta(), JC = new M.Junta(), brillos = [], faroles = 0;
  if (o.noche) [0, 1.571, 3.142, 4.712].forEach(function (a) { var fx = Math.cos(a) * 6.4, fz = Math.sin(a) * 6.4;   /* los faroles de poste de la plaza */
    var gp = new THREE.CylinderGeometry(.06, .09, 3.0, 8); gp.translate(fx, 1.5, fz); JF.pieza(gp, [.18, .18, .2]);
    var gt = new THREE.ConeGeometry(.3, .25, 4); gt.rotateY(Math.PI / 4); gt.translate(fx, 3.42, fz); JF.pieza(gt, [.18, .18, .2]);
    var gl = new THREE.BoxGeometry(.3, .4, .3); gl.translate(fx, 3.12, fz); JL.pieza(gl, M.col('#ffd59a'));
    var gc = new THREE.PlaneGeometry(3.6, 3.6);   /* dentro de la plaza: no se asoma hacia la pista */ gc.rotateX(-Math.PI / 2); gc.translate(fx, .14, fz); gc.userData.uvPropio = true; JC.pieza(gc, M.col('#ffd29a'));
    brillos.push(fx, 3.12, fz); faroles++; });
  var y = o.alto(p0.x, p0.z) - .05, mt = new M4().makeTranslation(p0.x, y, p0.z), mallas = [];
  var agua = new THREE.MeshStandardMaterial({ color: '#4f86a6', roughness: .08, metalness: .2, envMap: o.env || null, envMapIntensity: 1 });
  var ga = new THREE.CylinderGeometry(1.82, 1.82, .05, 8); ga.translate(p0.x, y + .725, p0.z);   /* sobre la taza (que llega a 0,70): se ve el agua y el borde de piedra */
  [[JP, mats.piedra], [JM, mats.madera]].forEach(function (q) { var g = q[0].geometria(); g.applyMatrix4(mt); var m = new THREE.Mesh(g, q[1]); m.receiveShadow = true; m.castShadow = !baja; m.userData.pileta = true; E.add(m); mallas.push(m); });
  var ma = new THREE.Mesh(ga, agua); ma.userData.pileta = true; E.add(ma); mallas.push(ma);
  if (faroles) { [[JF, mats.fierro], [JL, mats.luz], [JC, matLuzAditiva(texCharcoRedondo(), .9)]].forEach(function (q) { var g = q[0].geometria(); g.applyMatrix4(mt); var m = new THREE.Mesh(g, q[1]); m.userData.pileta = true; E.add(m); mallas.push(m); });
    var wb = []; for (var ib = 0; ib < brillos.length; ib += 3) wb.push(brillos[ib] + p0.x, brillos[ib + 1] + y, brillos[ib + 2] + p0.z); var pb = brilloPuntos(wb, 2.2); pb.userData.pileta = true; E.add(pb); mallas.push(pb); }
  return { x: p0.x, z: p0.z, faroles: faroles, mallas: mallas, ocupa: function (x, z) { return Math.hypot(x - p0.x, z - p0.z) < 7.6; } };
};

/* ---------- Los Andes: las pircas del campo, muros bajos de piedra suelta a los dos lados (con sus aberturas) ---------- */
M.pircas = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, r = M.azar(919), J = new M.Junta(), metros = 0, OC = {};
  function marcar(x, z) { OC[Math.floor(x / 2) + ',' + Math.floor(z / 2)] = 1; }
  [1, -1].forEach(function (l) {
    var off = l * (1 + 3.1 / W2), s = o.desde, hueco = s + 14 + r() * 10;   /* a 3,1 del asfalto: el auto llega a 2,58 (con la onda de las piedras, queda a más de 2,7) */
    while (s < o.hasta) {
      if (s > hueco) { s += 3.2; hueco = s + 16 + r() * 12; continue; }   /* la abertura (la tranquera de la chacra) */
      var lg = 1.5 + r() * .4, a = o.pos(s, off), b = o.pos(s + lg, off), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      if (o.dist(cx, cz) < W2 + 2.6) { s += lg; continue; }   /* en la curva de adentro, si queda cerca del otro tramo, no va */
      var dx = b.x - a.x, dz = b.z - a.z, L2 = Math.hypot(dx, dz), h = .85 + r() * .3, sem = s * 1.7;
      var g = new THREE.BoxGeometry(L2 + .08, h, .55, baja ? 1 : 3, baja ? 1 : 2, 1);
      if (!baja) M.torcer(g, function (q) { var k = Math.sin(q.x * 7.1 + q.y * 5.3 + sem) * .05 + Math.sin(q.x * 13.7 - q.y * 9.1 + sem) * .03; q.z += k; if (q.y > 0) q.y += k * 2; });   /* piedras, no ladrillos */
      g.rotateY(-Math.atan2(dz, dx)); g.translate(cx, o.alto(cx, cz) + h / 2 - .12, cz);
      var tono = .86 + r() * .2; J.pieza(g, [tono, tono * (.97 + r() * .05), tono * (.93 + r() * .06)], null, .5);
      metros += L2; marcar(a.x, a.z); marcar(cx, cz); marcar(b.x, b.z); s += lg;
    }
  });
  var mallas = [];
  if (J.base) { var m = new THREE.Mesh(J.geometria({ oscuroAbajo: [.7, .5] }), o.mats.piedra); m.receiveShadow = true; m.userData.pircas = true; E.add(m); mallas.push(m); }
  return { metros: metros, mallas: mallas, ocupa: function (x, z) { return !!OC[Math.floor(x / 2) + ',' + Math.floor(z / 2)]; } };
};

/* ---------- Los Andes: un cerro con andenes (terrazas de cultivo con muros de piedra), donde haya lugar ----------
   Se busca el sitio más lejos de la pista y de lo construido; cada nivel sube 1,15 m y tiene 2,3 m de chacra, con el contorno
   ondulado (no es un círculo perfecto). */
var CHACRA = null;
function texChacra() { if (CHACRA) return CHACRA;
  var c = M.lienzo(128, 128), g = c.getContext('2d'), rnd = M.azar(55); g.fillStyle = '#9a8a5a'; g.fillRect(0, 0, 128, 128);
  for (var y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(70,110,40,' + (.75 + rnd() * .2) + ')'; g.fillRect(0, y + 1, 128, 5); for (var x = 0; x < 128; x += 3) { g.fillStyle = 'rgba(50,90,30,' + rnd() * .6 + ')'; g.fillRect(x, y + rnd() * 5, 2, 2); } }
  return (CHACRA = M.tex(c, true, true)); }
M.andenes = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, mejor = null, mR = 0;
  function circuloLibre(x, z, R) { for (var k = 0; k < 20; k++) { var a = k / 20 * 6.283; if (!o.libre(x + Math.cos(a) * R, z + Math.sin(a) * R)) return false; } return o.libre(x, z); }
  var paso = baja ? 6 : 4;
  for (var x = -64; x <= 64; x += paso) for (var z = -64; z <= 64; z += paso) { if (x * x + z * z > 66 * 66) continue;
    var d = o.dist(x, z), R = Math.min(15, d - (W2 + 6)); if (R < 8 || R <= mR) continue;
    while (R > mR && R >= 8 && !circuloLibre(x, z, R + 1)) R -= 1;   /* no sigue achicando si ya no puede ganar */
    if (R >= 8 && R > mR) { mR = R; mejor = [x, z]; } }
  if (!mejor) return { zonas: 0, niveles: 0, mallas: [], ocupa: function () { return false; } };
  var cx = mejor[0], cz = mejor[1], niveles = Math.min(6, Math.floor(mR / 2.3)), y0 = o.alto(cx, cz) - .3, HN = 1.15, seg = baja ? 16 : 36;
  function rad(a, rr) { return rr + Math.sin(a * 3 + 1.3) * .55 + Math.sin(a * 5 + .4) * .3; }
  function ondular(q) { var rr = Math.hypot(q.x, q.z); if (rr < .01) return; var k = rad(Math.atan2(q.z, q.x), rr) / rr; q.x *= k; q.z *= k; }
  var JP = new M.Junta(), JC = new M.Junta(), verdes = ['#6f8f3a', '#86a043', '#5f7f34', '#a6a24c', '#8a7a4a', '#78963c'];
  for (var i = 0; i < niveles; i++) {
    var rO = mR - i * 2.3, rI = i < niveles - 1 ? rO - 2.3 : 0, yT = y0 + (i + 1) * HN;
    var gw = new THREE.CylinderGeometry(rO, rO + .25, HN + .4, seg, baja ? 1 : 2, true); M.torcer(gw, ondular); gw.translate(cx, yT - HN / 2 - .2, cz); JP.pieza(gw, [.95, .93, .9], null, .5);
    var gr = rI > 0 ? new THREE.RingGeometry(rI, rO, seg, 1) : new THREE.CircleGeometry(rO, seg); gr.rotateX(-Math.PI / 2); M.torcer(gr, ondular); gr.translate(cx, yT, cz);
    JC.pieza(gr, M.col(verdes[i % verdes.length]), null, .12);
  }
  var mallas = [], mC = new THREE.MeshStandardMaterial({ vertexColors: true, map: texChacra(), roughness: .95 });
  [[JP, o.mats.piedra], [JC, mC]].forEach(function (q) { var m = new THREE.Mesh(q[0].geometria(), q[1]); m.castShadow = !baja && q[1] === o.mats.piedra; m.receiveShadow = true; m.userData.andenes = true; E.add(m); mallas.push(m); });
  return { zonas: 1, niveles: niveles, x: cx, z: cz, radio: mR, mallas: mallas, ocupa: function (x, z) { return Math.hypot(x - cx, z - cz) < mR + 2; } };
};

/* ---------- la Amazonía: el túnel de selva ----------
   Árboles gigantes a los dos costados (a más de 5 m del asfalto), con sus raíces tablares, y sus copas cerrando una bóveda sobre
   la pista a 9-12 m (las copas más bajas, a más de 6 m sobre el asfalto); lianas a los costados y alguna corta sobre la pista,
   siempre por encima de los 4,5 m. Las copas dan sombra: el túnel es fresco. */
M.tunelSelva = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, r = M.azar(616), JT = new M.Junta(), JH = new M.Junta(), JL = new M.Junta(), copas = 0, altoMin = 1e9, troncos = [];
  var verdes = ['#2f6b2a', '#3b7d34', '#285c25', '#4a8a3a', '#356f2e', '#5a9640'];
  function cilindro(J, a, b, r0, r1, col, lados) { var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, lg = Math.hypot(dx, dy, dz), g = new THREE.CylinderGeometry(r1, r0, lg, lados || 6);
    g.translate(0, lg / 2, 0); g.applyMatrix4(new M4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(dx / lg, dy / lg, dz / lg)))); g.translate(a.x, a.y, a.z); J.pieza(g, col); }
  /* los troncos, a los dos lados, y sus ramas hacia la pista */
  for (var s = o.s0; s <= o.s1; s += 6.5) [1, -1].forEach(function (l, k) {
    var sp = s + (k ? 3.2 : 0), lat = W2 + 5.4 + r() * 1.2, p = o.pos(sp, l * lat / W2), yT = o.altoPista(sp);
    if (o.dist(p.x, p.z) < W2 + 4.6) return;   /* en una curva, si quedaría cerca de otro tramo, no va */
    var yb = o.alto(p.x, p.z), H = 15 + r() * 4, ct = M.col('#6b5a45', .85 + r() * .25);
    var tg = new THREE.CylinderGeometry(.55, .85, H, baja ? 7 : 10); tg.translate(p.x, yb + H / 2 - .3, p.z); JT.pieza(tg, ct);
    if (!baja) for (var q = 0; q < 4; q++) { var fin = new THREE.BoxGeometry(.14, 2.4, 1.7); M.torcer(fin, function (v) { if (v.y > 0) v.z *= .25; }); fin.translate(0, .9, 1.0); fin.rotateY(q * 1.571 + r() * .5); fin.translate(p.x, yb, p.z); JT.pieza(fin, ct); }   /* las raíces tablares */
    var c = o.pos(sp, l * (W2 * .3) / W2); cilindro(JT, new V3(p.x, yb + H * .72, p.z), new V3(c.x, yT + 10.2, c.z), .32, .16, ct, baja ? 5 : 7);   /* la rama que cruza hacia la pista */
    var gc = new THREE.IcosahedronGeometry(3.4, baja ? 0 : 1); gc.scale(1.3, .7, 1.3); gc.translate(p.x, yb + H + .6, p.z); JH.pieza(gc, M.col(verdes[r() * verdes.length | 0]));   /* su copa, arriba */
    if (!baja) for (q = 0; q < 2; q++) { var lx = p.x + (r() - .5) * 2.4, lz = p.z + (r() - .5) * 2.4; cilindro(JL, new V3(lx, yb + H * .8, lz), new V3(lx + (r() - .5) * .6, yb + 1.2 + r() * 1.5, lz + (r() - .5) * .6), .04, .03, M.col('#3e5a2a'), 4); }   /* lianas junto al tronco */
    troncos.push([p.x, p.z]);
  });
  /* la bóveda: copas sobre la pista cada 3 m */
  for (s = o.s0; s <= o.s1; s += 3) { var yT = o.altoPista(s);
    [-6.2, -2.1, 2.1, 6.2].forEach(function (u) { var c = o.pos(s, u / W2), R = 2.3 + r() * .8, sy = .62, yc = yT + 9.6 + r() * 2.4, j1 = r() * 6.28, j2 = r() * 6.28;
      var g = new THREE.IcosahedronGeometry(R, baja ? 0 : 1); g.scale(1.25, sy, 1.25); if (!baja) M.torcer(g, function (v) { var k = 1 + Math.sin(v.x * 2.1 + j1) * .12 + Math.sin(v.z * 1.7 + j2) * .1; v.x *= k; v.z *= k; });
      g.translate(c.x + (r() - .5) * 1.2, yc, c.z + (r() - .5) * 1.2); JH.pieza(g, M.col(verdes[r() * verdes.length | 0]));
      if (Math.abs(u) - R * 1.4 < W2 + .55) { altoMin = Math.min(altoMin, yc - R * sy * 1.15 - yT); if (Math.abs(u) < W2 + .55) copas++; }
      if (!baja && r() < .45) { var lx = c.x + (r() - .5), lz = c.z + (r() - .5); cilindro(JL, new V3(lx, yc - R * sy * .6, lz), new V3(lx, yT + 4.6 + r() * 1.5, lz), .035, .03, M.col('#3e5a2a'), 4); }   /* lianas cortas, bien altas */
    }); }
  var mallas = [], mT = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(71, .45), roughness: .95 }), mH = new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(73, .35), roughness: .82, flatShading: true }), mL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
  [[JT, mT, true], [JH, mH, true], [JL, mL, false]].forEach(function (q) { if (!q[0].base) return; var m = new THREE.Mesh(q[0].geometria(), q[1]); m.castShadow = !baja && q[2]; m.receiveShadow = true; m.userData.tunel = true; E.add(m); mallas.push(m); });
  return { s0: o.s0, s1: o.s1, copas: copas, altoMin: altoMin, mallas: mallas,
    ocupa: function (x, z) { for (var i = 0; i < troncos.length; i++) if (Math.hypot(x - troncos[i][0], z - troncos[i][1]) < 3.4) return true; return false; } };
};

/* ---------- la Amazonía: el puente de madera (vigas a los lados, barandas, pilotes y cabezales; el tablero lo pone pista.js) ---------- */
M.puenteMadera = function (E, o) {
  var W2 = o.W / 2, baja = !!o.baja, J = new M.Junta(), mt = new M4(), metros = 0, E2 = W2 + 2.85, cM = M.col('#7a5a3e'), cO = M.col('#5a4030');
  function seg(a, b, w, h, d, dy, col) { var dx = b.x - a.x, dz = b.z - a.z, lg = Math.hypot(dx, dz) + w, g = new THREE.BoxGeometry(lg, h, d);
    mt.makeRotationY(-Math.atan2(dz, dx)).setPosition((a.x + b.x) / 2, (a.y + b.y) / 2 + dy, (a.z + b.z) / 2); J.pieza(g, col, mt, .55); }
  function borde(s, lat) { var q = o.pos(s, lat / W2); q.y = o.yTablero(s, lat); return q; }
  [1, -1].forEach(function (l) {
    for (var s = o.s0; s < o.s1 - .01; s += 1.5) { var s2 = Math.min(o.s1, s + 1.5), a = borde(s, l * (E2 - .12)), b = borde(s2, l * (E2 - .12));
      seg(a, b, .02, .4, .3, -.2, cO);                                     /* la viga del costado (le da grosor al tablero) */
      var aR = borde(s, l * (W2 + 2.75)), bR = borde(s2, l * (W2 + 2.75));
      seg(aR, bR, .02, .08, .1, 1.05, cM); seg(aR, bR, .02, .06, .06, .55, cM);   /* la baranda: pasamanos y travesaño */
      var gp = new THREE.BoxGeometry(.12, 1.1, .12); gp.translate(aR.x, aR.y + .55, aR.z); J.pieza(gp, cO, null, .55); metros += Math.hypot(bR.x - aR.x, bR.z - aR.z); }
    var fin = borde(o.s1, l * (W2 + 2.75)), gf = new THREE.BoxGeometry(.12, 1.1, .12); gf.translate(fin.x, fin.y + .55, fin.z); J.pieza(gf, cO, null, .55); });   /* el último poste */
  /* los pilotes y sus cabezales, cada 3 m */
  for (var s = o.s0 + 1; s < o.s1; s += 3) { var a = borde(s, -E2 + .2), b = borde(s, E2 - .2); seg(a, b, 0, .3, .35, -.35, cO);
    [-(W2 + 2.4), -W2 * .4, W2 * .4, W2 + 2.4].forEach(function (lat) { var q = borde(s, lat), h = q.y - .3 - (o.lecho - .4), g = new THREE.CylinderGeometry(.16, .2, h, baja ? 6 : 8); g.translate(q.x, o.lecho - .4 + h / 2, q.z); J.pieza(g, cO, null, .55); }); }
  var m = new THREE.Mesh(J.geometria(), o.mats.madera); m.castShadow = !baja; m.receiveShadow = true; m.userData.puente = true; E.add(m);
  return { s0: o.s0, s1: o.s1, baranda: metros, mallas: [m] };
};

/* ---------- la Amazonía: canoas en el río ---------- */
M.canoas = function (E, o) {
  var J = new M.Junta(), r = M.azar(808), n = 0, pinturas = [M.col('#2f6fb0'), M.col('#c9443b'), M.col('#3b7d4f'), M.col('#e9b949')];
  o.sitios.forEach(function (q) {
    var g = new THREE.CylinderGeometry(.55, .55, 4.6, o.baja ? 8 : 12, 1, true, Math.PI, Math.PI); g.rotateZ(Math.PI / 2); g.scale(1, .55, 1);   /* el casco: medio cilindro (la mitad de x negativa, que al girar queda abajo), abierto arriba */
    var gr = new THREE.BoxGeometry(4.5, .06, .08); gr.translate(0, .02, .52); var gr2 = gr.clone(); gr2.translate(0, 0, -1.04);   /* las bordas, pintadas */
    var mt = new M4().makeRotationY(q.giro).setPosition(q.x, o.agua + .2, q.z), col = pinturas[r() * pinturas.length | 0];
    g.applyMatrix4(mt); J.pieza(g, M.col('#7a5a3e'), null, .55); gr.applyMatrix4(mt); J.pieza(gr, col); gr2.applyMatrix4(mt); J.pieza(gr2, col);
    [-.9, .9].forEach(function (x) { var gs = new THREE.BoxGeometry(.3, .05, 1.0); gs.translate(x, .05, 0); gs.applyMatrix4(mt); J.pieza(gs, M.col('#5a4030')); });   /* los asientos */
    n++; });
  var m = new THREE.Mesh(J.geometria(), o.mats.madera); m.castShadow = !o.baja; m.receiveShadow = true; m.userData.canoas = true; E.add(m);
  return { n: n, mallas: [m] };
};
})();

;
/* Ruway — LOS MUNDOS. laberinto.js: arma el laberinto en el mundo del personaje.

   El juego (laberinto() en Experiencias.html) decide las reglas; aquí se arma lo que se ve:
     · las paredes del mundo, cada variante en una InstancedMesh (pocas llamadas de dibujo);
     · los pilares de los cruces (y faroles en Trujillo);
     · el piso, lo que se ve a lo lejos, el cielo, la luz y lo que flota en el aire;
     · los regalitos envueltos con los colores del mundo, con su luz en el piso;
     · la meta: un estrado con flores de limpiapipas donde espera la persona que regala;
     · el camino de pétalos que guía, las lluvias de pétalos al encontrar algo;
     · los ATAJOS: una pared se hunde en la tierra con polvo (el laberinto "se ablanda").

   Coordenadas: la casilla (c, f) va de x = c a c+1 y de z = f a f+1. */
(function () {
'use strict';
var M = window.Mundos, M4 = THREE.Matrix4;

/* papel de regalo con franjas del mundo (alfa no: es una caja) */
function texPapel(cols, sem) {
  var c = M.lienzo(128, 128), g = c.getContext('2d'), rnd = M.azar(sem);
  g.fillStyle = cols[0]; g.fillRect(0, 0, 128, 128);
  var y = 0; while (y < 128) { var h = 6 + rnd() * 14; g.fillStyle = cols[1 + (rnd() * (cols.length - 1) | 0)]; g.fillRect(0, y, 128, h * .55); y += h; }
  g.fillStyle = 'rgba(255,255,255,.25)'; for (var i = 0; i < 40; i++) g.fillRect(rnd() * 128, rnd() * 128, 2, 2);
  return M.tex(c, true, false);
}
/* una flor de limpiapipas: tallo y pétalos en espiral (la marca de Ruway) */
function florLimpiapipas(J, x, z, col, rnd, alto) {
  var h = alto || (.22 + rnd() * .1);
  var t = new THREE.CylinderGeometry(.008, .01, h, 4); t.translate(x, h / 2, z); J.pieza(t, M.col('#3f8a3a'));
  for (var p = 0; p < 6; p++) {
    var a = p / 6 * 6.283, pe = new THREE.TorusGeometry(.035, .011, 5, 10); pe.scale(1, .6, 1);
    pe.translate(.035, 0, 0); pe.rotateY(a); pe.rotateX((rnd() - .5) * .3); pe.translate(x, h, z); J.pieza(pe, M.col(col, .95 + rnd() * .1));
  }
  var c = new THREE.SphereGeometry(.022, 6, 5); c.translate(x, h + .01, z); J.pieza(c, M.col('#ffd23c'));
}

/* la Plaza de Armas de la intro (lib/intro): escala 0,36 (una persona de 1,7 m mide lo que un personaje) */
function plazaTrujillo(E, cx, cz) {
  var I = window.__RI; if (!I || !I.createTrujilloPlaza || !I.Obra) return null;
  var S = .36, g = new THREE.Group(); g.scale.setScalar(S); g.position.set(cx, -.14 * S, cz - 28 * S); E.add(g);
  var P;
  I.DETALLE = M.calidad() === 'alta' ? .7 : .45;
  try { P = I.createTrujilloPlaza(g, { baja: M.calidad() !== 'alta', despejar: [[0, 28, 19]], sinCiudad: M.calidad() !== 'alta', sinJardines: true }); } catch (e) { return null; } finally { I.DETALLE = 1; }
  var uT = { value: 0 };
  var texs = { estuco: I.texEstuco(), hojas: I.texHojas(), relieve: I.texRelieve(), ciudad: I.texCiudad(), globo: I.texGlobo(), piedra: I.texGrano(11, .24), hoja: I.texGrano(3, .4),
    madera: I.texMadera(), celosia: I.texCelosia(), losas: I.texLosas(), palma: I.texHojaPalma(), flores: I.texFlores ? I.texFlores() : null };
  texs.losas.repeat.set(.55, .55);
  function L(o) { return new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)); }
  var m = { estuco: L({ map: texs.estuco }), piedra: L({ map: texs.piedra }), losa: L({ map: texs.losas }), madera: L({ map: texs.madera }), celosia: L({ map: texs.celosia }),
    verde: L({ map: texs.hoja }), tronco: L({ map: texs.piedra }), flores: L(texs.flores ? { map: texs.flores } : {}), cerro: L({}),
    vidrio: new THREE.MeshBasicMaterial({ vertexColors: true }), luz: new THREE.MeshBasicMaterial({ vertexColors: true }), metal: L({}),
    bronce: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: '#6b5a3c' }),
    palma: L({ alphaMap: texs.palma, alphaTest: .5, side: THREE.DoubleSide }), hojas: L({ map: texs.hojas, alphaTest: .45, side: THREE.DoubleSide }),
    relieve: new THREE.MeshPhongMaterial({ map: texs.relieve, shininess: 22, specular: '#6b5a3c' }), ciudad: L({ map: texs.ciudad }),
    globo: new THREE.MeshPhongMaterial({ map: texs.globo, shininess: 24, specular: '#6b5a3c' }) };
  m.palma.onBeforeCompile = m.hojas.onBeforeCompile = function (sh) {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'attribute float meceo;\nuniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += vec3(sin(uT * 1.3 + position.x * .21) * .32, sin(uT * 2.1 + position.z * .3) * .06, cos(uT * 1.1 + position.z * .19) * .22) * meceo;');
  };
  var mallas = P.obra.mallas(m, g);
  for (var k in mallas) { if (!m[k]) { m[k] = L({}); mallas[k].material = m[k]; } if (k !== 'cerro' && k !== 'luz' && k !== 'vidrio') { mallas[k].receiveShadow = true; } }
  /* los faroles de la plaza: un resplandor cada uno */
  var tb = M.texBrillo(), gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(P.luces, 3));
  g.add(new THREE.Points(gl, new THREE.PointsMaterial({ map: tb, size: 1.4, color: '#ffcf8a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .85 })));
  return { g: g, uT: uT };
}

M.laberinto = function (E, o) {
  var mundo = o.mundo, COLS = o.COLS, FILAS = o.FILAS, celdas = o.celdas, W = M.muros(mundo), rnd = M.azar(o.sem || 7), m4 = new THREE.Object3D();
  var cx = COLS / 2, cz = FILAS / 2, A = { cx: cx, cz: cz, w: COLS, h: FILAS };
  function cel(c, f) { return (c < 0 || f < 0 || c >= COLS || f >= FILAS) ? null : celdas[f * COLS + c]; }

  /* ---- los tramos de pared (los mismos que usa el juego para chocar) ---- */
  var tramos = [];
  celdas.forEach(function (k) {
    if (k.p[0]) tramos.push({ h: true, x: k.c + .5, z: k.f, a: cel(k.c, k.f - 1), b: k });
    if (k.p[3]) tramos.push({ h: false, x: k.c, z: k.f + .5, a: cel(k.c - 1, k.f), b: k });
    if (k.c === COLS - 1 && k.p[1]) tramos.push({ h: false, x: k.c + 1, z: k.f + .5, a: k, b: null });
    if (k.f === FILAS - 1 && k.p[2]) tramos.push({ h: true, x: k.c + .5, z: k.f + 1, a: k, b: null });
  });
  var porVar = {};
  tramos.forEach(function (t, i) { t.v = (rnd() * W.variantes.length) | 0; t.alto = 1; t.partes = []; (porVar[t.v] = porVar[t.v] || []).push(i); });
  function matrizTramo(t, bajada, temblor) {
    m4.position.set(t.x + (temblor ? (Math.random() - .5) * temblor : 0), -bajada, t.z); m4.rotation.set(0, t.h ? 0 : Math.PI / 2, 0); m4.scale.set(1, 1, 1);
    if (bajada > W.alto + .05) m4.scale.set(0, 0, 0); m4.updateMatrix(); return m4.matrix;
  }
  Object.keys(porVar).forEach(function (v) {
    var ids = porVar[v];
    W.variantes[v].forEach(function (parte) {
      var im = new THREE.InstancedMesh(parte.geo, parte.mat, ids.length);
      ids.forEach(function (ti, j) { im.setMatrixAt(j, matrizTramo(tramos[ti], 0)); tramos[ti].partes.push({ im: im, j: j }); });
      im.castShadow = !parte.sinSombra; im.receiveShadow = true; E.add(im);
    });
  });
  /* ---- pilares en los cruces que tienen alguna pared ---- */
  var toca = {};
  tramos.forEach(function (t) { var a = t.h ? [[t.x - .5, t.z], [t.x + .5, t.z]] : [[t.x, t.z - .5], [t.x, t.z + .5]]; a.forEach(function (q) { toca[q[0] + ',' + q[1]] = 1; }); });
  var vert = Object.keys(toca).map(function (k) { return k.split(',').map(Number); });
  W.pilar.forEach(function (parte) {
    var im = new THREE.InstancedMesh(parte.geo, parte.mat, vert.length);
    vert.forEach(function (q, j) { m4.position.set(q[0], 0, q[1]); m4.rotation.set(0, (rnd() * 4 | 0) * Math.PI / 2, 0); m4.scale.set(1, 1, 1); m4.updateMatrix(); im.setMatrixAt(j, m4.matrix); });
    im.castShadow = !parte.sinSombra; im.receiveShadow = true; E.add(im);
  });
  /* faroles (Trujillo): en los pilares del borde, con su luz tibia */
  var faroles = [];
  if (W.farol) {
    var JF = new M.Junta(), tb = M.texBrillo();
    vert.forEach(function (q) {
      var borde = q[0] === 0 || q[1] === 0 || q[0] === COLS; if (!borde || q[1] > FILAS - 2 || (q[0] + q[1]) % 2) return;   /* no en el lado de la cámara: taparían */
      JF.caja(.03, .32, .03, q[0], W.alto + .26, q[1], M.col('#1d1b1a')); JF.caja(.11, .14, .11, q[0], W.alto + .48, q[1], M.col('#1d1b1a'));
      var cono = new THREE.ConeGeometry(.09, .07, 4); cono.rotateY(Math.PI / 4); cono.translate(q[0], W.alto + .585, q[1]); JF.pieza(cono, M.col('#1d1b1a'));
      var luz = new THREE.Sprite(new THREE.SpriteMaterial({ map: tb, color: '#ffc46a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .9 }));
      luz.position.set(q[0], W.alto + .48, q[1]); luz.scale.setScalar(.9); E.add(luz); faroles.push(luz);
      var vid = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .08), new THREE.MeshBasicMaterial({ color: '#ffe2a0', toneMapped: false })); vid.position.copy(luz.position); E.add(vid);
    });
    if (JF.base) E.add(new THREE.Mesh(JF.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .4 })));
  }

  /* ---- el mundo alrededor ---- */
  var cielo = M.cielo(E, mundo), luces = M.luces(E, mundo);
  /* Trujillo: el laberinto es un jardín de setos DENTRO de la Plaza de Armas de la intro (a escala de los
     personajes), al sur del Monumento a la Libertad, con la Catedral al fondo. Sin ruway-intro.js, las casonas propias. */
  var plaza = mundo.plaza ? plazaTrujillo(E, cx, cz) : null;
  if (!plaza) M.suelo(E, mundo, { cx: cx, cz: cz, r: 22, libre: function (x, z) {
    if (x > -.35 && x < COLS + .35 && z > -.35 && z < FILAS + .35) { var dx = Math.abs(x - Math.round(x)), dz = Math.abs(z - Math.round(z)); return dx > .24 && dz > .24 && rnd() < .35; }
    return true; } });
  var lejos = plaza ? { actualizar: function (dt, t) { plaza.uT.value = t; } } : M.lejos(E, mundo, { cx: cx, cz: cz, medioX: COLS / 2, medioZ: FILAS / 2 });
  var vida = M.vida(E, mundo, A);

  /* ---- regalitos ---- */
  var papeles = [], tAnillo = M.texAnillo();
  function regalo(i) {
    var cols = mundo.regalos, base = cols[i % cols.length], otra = cols[(i + 2) % cols.length];
    var tp = papeles[i % 3] || (papeles[i % 3] = texPapel([base, otra, '#ffffff', cols[(i + 4) % cols.length]], 90 + i));
    var g = new THREE.Group(), brilla = mundo.brillan;
    var mCaja = new THREE.MeshStandardMaterial({ map: tp, roughness: .5, emissive: brilla ? base : '#000000', emissiveIntensity: brilla ? .35 : 0 });
    var caja = new THREE.Mesh(new THREE.BoxGeometry(.3, .26, .3), mCaja); caja.position.y = .15; g.add(caja);
    var tapa = new THREE.Mesh(new THREE.BoxGeometry(.33, .07, .33), mCaja); tapa.position.y = .31; g.add(tapa);
    var cinta = new THREE.MeshStandardMaterial({ color: mundo.acento, roughness: .35, metalness: .15 });
    [[.05, .36, .34], [.34, .36, .05]].forEach(function (s) { var b = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), cinta); b.position.y = .18; g.add(b); });
    [-1, 1].forEach(function (l) { var lz = new THREE.Mesh(new THREE.TorusGeometry(.06, .02, 6, 14), cinta); lz.position.set(l * .05, .38, 0); lz.rotation.set(0, Math.PI / 2, l * .6); g.add(lz); });
    g.children.forEach(function (x) { x.castShadow = true; });
    var aro = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({ map: tAnillo, color: base, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .7 }));
    aro.rotation.x = -Math.PI / 2; aro.position.y = .02; g.add(aro);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.texBrillo(), color: base, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 })); halo.position.y = .3; halo.scale.setScalar(.9); g.add(halo);
    g.userData = { tapa: tapa, aro: aro, halo: halo, caja: caja };
    E.add(g); return g;
  }

  /* ---- la meta: estrado con flores y un corazón que se enciende ---- */
  function meta(x, z) {
    var g = new THREE.Group(); g.position.set(x, 0, z); E.add(g);
    var J = new M.Junta(), JF = new M.Junta(), r2 = M.azar(5), colPiso = { sierra: '#9a9488', costa: '#d8bf86', desierto: '#c49b70', ciudad: '#efe7d6', noche: '#4a5679', selva: '#6b5a45' }[mundo.id];
    var est = new THREE.CylinderGeometry(.42, .46, .08, 28); est.translate(0, .04, 0); J.pieza(est, M.col(colPiso, 1.05), null, 3);
    var est2 = new THREE.CylinderGeometry(.34, .36, .05, 28); est2.translate(0, .1, 0); J.pieza(est2, M.col(colPiso, 1.2), null, 3);
    for (var k = 0; k < 12; k++) { var a = k / 12 * 6.283; florLimpiapipas(JF, Math.cos(a) * .4, Math.sin(a) * .4, mundo.regalos[k % mundo.regalos.length], r2, .14 + r2() * .08); }
    var m1 = new THREE.Mesh(J.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(41, .2), roughness: .9 })); m1.receiveShadow = true; m1.castShadow = true; g.add(m1);
    g.add(new THREE.Mesh(JF.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 })));
    var cor = new THREE.Shape(); cor.moveTo(0, -.3); cor.bezierCurveTo(-.45, 0, -.25, .32, 0, .14); cor.bezierCurveTo(.25, .32, .45, 0, 0, -.3);
    var gc = new THREE.ExtrudeGeometry(cor, { depth: .1, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 3, curveSegments: 14 }); gc.center();
    var mc = new THREE.MeshStandardMaterial({ color: '#6c6a78', roughness: .4, metalness: .2, emissive: '#000000' });
    var corazon = new THREE.Mesh(gc, mc); corazon.scale.setScalar(.55); corazon.position.y = 1.05; g.add(corazon);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.texBrillo(), color: '#ff7aa8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); halo.position.y = 1.05; halo.scale.setScalar(1.4); g.add(halo);
    var lugar = new THREE.Group(); lugar.position.y = .125; g.add(lugar);
    return { g: g, lugar: lugar, corazon: corazon, encender: function () { mc.color.set('#ff5c8f'); mc.emissive.set('#ff3d7f'); mc.emissiveIntensity = .55; halo.material.opacity = .8; }, halo: halo };
  }

  /* ---- el camino de pétalos ---- */
  var NP = 90, tp2 = M.texPetalo(), gp = new THREE.PlaneGeometry(.16, .16); gp.rotateX(-Math.PI / 2);
  var mp = new THREE.MeshBasicMaterial({ map: tp2, transparent: true, depthWrite: false, opacity: 0, vertexColors: false });
  var pet = new THREE.InstancedMesh(gp, mp, NP); pet.count = 0; pet.renderOrder = 2; E.add(pet);
  if (pet.setColorAt) for (var pi = 0; pi < NP; pi++) pet.setColorAt(pi, new THREE.Color(mundo.regalos[pi % mundo.regalos.length]).lerp(new THREE.Color('#ffffff'), .25));
  var petObjetivo = 0, petPos = [];
  function mostrarPetalos(camino) {
    petPos = []; var r3 = M.azar(camino.length * 7 + 3);
    for (var i = 0; i + 1 < camino.length && petPos.length < NP; i++) {
      var a = camino[i], b = camino[i + 1];
      for (var s = 0; s < 3 && petPos.length < NP; s++) { var t = (s + r3()) / 3; petPos.push([a[0] + (b[0] - a[0]) * t + (r3() - .5) * .18, a[1] + (b[1] - a[1]) * t + (r3() - .5) * .18, r3() * 6.283]); }
    }
    pet.count = petPos.length; petPos.forEach(function (p, j) { m4.position.set(p[0], .02, p[1]); m4.rotation.set(0, p[2], 0); m4.scale.setScalar(1); m4.updateMatrix(); pet.setMatrixAt(j, m4.matrix); });
    pet.instanceMatrix.needsUpdate = true; if (pet.instanceColor) pet.instanceColor.needsUpdate = true; petObjetivo = 1;
  }

  /* ---- lluvia de pétalos y onda en el piso ---- */
  var chispas = [], ondas = [];
  function estallido(x, z, n, y0) {
    n = n || 28; var cols = mundo.regalos;
    for (var i = 0; i < n; i++) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tp2, color: cols[i % cols.length], transparent: true, depthWrite: false }));
      s.position.set(x, y0 || .35, z); s.scale.setScalar(.09 + Math.random() * .06);
      var a = Math.random() * 6.283, v = .8 + Math.random() * 1.6; s.userData = { vx: Math.cos(a) * v * .6, vy: 1.6 + Math.random() * 1.8, vz: Math.sin(a) * v * .6, vida: 1.4 + Math.random() * .6, giro: (Math.random() - .5) * 8 };
      E.add(s); chispas.push(s);
    }
    var on = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tAnillo, color: mundo.acento, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    on.rotation.x = -Math.PI / 2; on.position.set(x, .03, z); on.userData.t = 0; E.add(on); ondas.push(on);
  }
  /* ---- atajos: la pared se hunde ---- */
  var hundiendo = [], tPolvo = M.texBrillo(), polvos = [];
  function polvo(x, z) {
    var colP = { sierra: '#cfc6b2', costa: '#ead6ac', desierto: '#e3c79d', ciudad: '#e8dccb', noche: '#8796c0', selva: '#9fbf7a' }[mundo.id];
    for (var i = 0; i < 14; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tPolvo, color: colP, transparent: true, depthWrite: false, opacity: .5 }));
      s.position.set(x + (Math.random() - .5) * .8, .1 + Math.random() * .3, z + (Math.random() - .5) * .8); s.scale.setScalar(.3 + Math.random() * .3); s.userData = { vida: 1.2 + Math.random() * .6, v: .2 + Math.random() * .3 }; E.add(s); polvos.push(s); }
  }
  function bajar(i, listo) {
    var t = tramos[i]; if (!t || t.bajando) return; t.bajando = { t: 0, listo: listo }; hundiendo.push(t); polvo(t.x, t.z);
  }

  return {
    tramos: tramos, mundo: mundo, alto: W.alto, regalo: regalo, meta: meta, estallido: estallido, bajar: bajar, luces: luces,
    petalos: { mostrar: mostrarPetalos, ocultar: function () { petObjetivo = 0; } },
    actualizar: function (dt, t, cam, yo) {
      cielo.actualizar(t, cam); lejos.actualizar(dt, t); vida(dt, t, cam);
      if (yo) luces.seguir(yo.x, yo.z);
      faroles.forEach(function (f, i) { f.material.opacity = .78 + Math.sin(t * 7 + i * 2.1) * .06 + Math.sin(t * 13 + i) * .04; });
      mp.opacity += (petObjetivo * .95 - mp.opacity) * Math.min(1, dt * 6); if (mp.opacity < .01 && !petObjetivo) pet.count = 0;
      for (var k = chispas.length - 1; k >= 0; k--) { var c = chispas[k], u = c.userData; u.vy -= 4.2 * dt; c.position.x += u.vx * dt; c.position.y = Math.max(.03, c.position.y + u.vy * dt); c.position.z += u.vz * dt; c.material.rotation += u.giro * dt;
        if (c.position.y <= .031) { u.vx *= .9; u.vz *= .9; u.giro *= .9; } u.vida -= dt; c.material.opacity = Math.min(1, u.vida * 1.5); if (u.vida <= 0) { E.remove(c); c.material.dispose(); chispas.splice(k, 1); } }
      for (k = ondas.length - 1; k >= 0; k--) { var on = ondas[k]; on.userData.t += dt; var s = .3 + on.userData.t * 3.2; on.scale.set(s, s, 1); on.material.opacity = Math.max(0, 1 - on.userData.t * 1.3); if (on.userData.t > .8) { E.remove(on); on.geometry.dispose(); on.material.dispose(); ondas.splice(k, 1); } }
      for (k = polvos.length - 1; k >= 0; k--) { var p = polvos[k]; p.userData.vida -= dt; p.position.y += p.userData.v * dt; p.scale.multiplyScalar(1 + dt * .6); p.material.opacity = Math.max(0, p.userData.vida * .4); if (p.userData.vida <= 0) { E.remove(p); p.material.dispose(); polvos.splice(k, 1); } }
      for (k = hundiendo.length - 1; k >= 0; k--) {
        var tr = hundiendo[k], b = tr.bajando; b.t += dt; var y = Math.pow(Math.min(1, b.t / 1.3), 1.6) * (W.alto + .12);
        tr.partes.forEach(function (q) { q.im.setMatrixAt(q.j, matrizTramo(tr, y, b.t < 1.1 ? .025 : 0)); q.im.instanceMatrix.needsUpdate = true; });
        if (b.t >= 1.3) { hundiendo.splice(k, 1); tr.abierto = true; if (b.listo) b.listo(); }
      }
    }
  };
};
})();

;
/* Ruway — LOS MUNDOS. pista.js: la pista de La gran carrera en 3D, en el mundo de la pareja.
   Un circuito cerrado (una curva suave por puntos) con asfalto, bordillos rojo y blanco, la línea de largada a cuadros y
   su arco con semáforo, tribunas con público que salta, banderines cruzando la pista, banderas del Perú, globos, carteles
   de curva, flores, y en las curvas las paredes del mundo (muro inca, totora, adobe de Chan Chan, casonas de Trujillo,
   piedra de noche, follaje). Alrededor, lo de cada mundo: su cielo, su luz, su piso sembrado, lo que se ve a lo lejos
   (nevados, el mar con su muelle, las dunas, la catedral, los cerros de noche, los árboles gigantes) y lo que vuela.
   Inspiración: las pistas de ciudad de los juegos de karts (mucho color, mucho detalle a los costados). Nada copiado:
   todo se dibuja aquí. Rendimiento: lo repetido va en una sola malla o en InstancedMesh.
   Medidas: las del laberinto (1 = una casilla; el personaje mide ~0,6). La pista mide 4,6 de ancho.

   M.pista(E, mundo, {calidad}) → { L, W, pos(s, x, v3), dir(s, v3), curva(s), mini, semaforo(k), actualizar(dt, t, x, z) }
     s: distancia por la pista (0..L, se repite) · x: de −1 (borde izquierdo) a 1 (derecho) */
(function () {
'use strict';
var M = window.Mundos, V3 = THREE.Vector3, M4 = THREE.Matrix4;

/* el trazado: una recta de largada, una horquilla, eses y una curva larga. Cada mundo lo gira o lo refleja. */
var TRAZO = [[-20, -24], [0, -26], [20, -24], [34, -16], [38, -2], [32, 10], [20, 12], [12, 20], [16, 30], [6, 36], [-8, 32],
  [-14, 20], [-26, 22], [-36, 12], [-38, -4], [-32, -18]];
var TX_SUELO = { puna: 12, arena: 12, tierra: 2.4, losas: 1.8, escarcha: 24, hojarasca: 3 }, TX_MURO = { adobe: 1, casona: 1 };
var GIRO = { sierra: [0, 1], costa: [0, -1], desierto: [Math.PI / 2, 1], ciudad: [Math.PI, 1], noche: [-Math.PI / 2, -1], selva: [Math.PI, -1] };

function lienzo(w, h, f) { var c = M.lienzo(w, h); f(c.getContext('2d'), w, h); return c; }
function texAsfalto() {
  var c = lienzo(128, 256, function (g, w, h) {
    g.fillStyle = '#6b6e78'; g.fillRect(0, 0, w, h); var r = M.azar(3);
    for (var i = 0; i < 2600; i++) { var k = 90 + r() * 40 | 0; g.fillStyle = 'rgba(' + k + ',' + k + ',' + (k + 8) + ',.5)'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.fillStyle = '#f4f4f0'; g.fillRect(5, 0, 4, h); g.fillRect(w - 9, 0, 4, h);
    g.fillStyle = 'rgba(255,255,255,.85)'; [w / 3, 2 * w / 3].forEach(function (x) { g.fillRect(x - 2, 0, 4, h / 2 - 20); });
  });
  var t = M.tex(c, true, true); return t;
}
function texBordillo() { var c = lienzo(16, 64, function (g) { g.fillStyle = '#e23b3b'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#ffffff'; g.fillRect(0, 32, 16, 32); }); var t = M.tex(c, true, true); t.magFilter = THREE.NearestFilter; return t; }
function texCuadros() { var c = lienzo(64, 16, function (g) { for (var i = 0; i < 16; i++) for (var j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 4, j * 4, 4, 4); } }); var t = M.tex(c, true, false); t.magFilter = THREE.NearestFilter; return t; }
function texLetrero(txt, fondo, letra, ancho) {   /* ancho: el de la imagen, para que tenga la forma del letrero (si no, las letras se estiran) */
  var c = lienzo(ancho || 512, 96, function (g, w, h) {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    for (var i = 0; i < w / 16; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(i * 16, 0, 16, 10); g.fillRect(i * 16 + 8, h - 10, 16, 10); }
    g.fillStyle = letra; g.font = '900 56px Nunito, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2, w - 40);
  });
  return M.tex(c, true, false);
}
function texFlecha(izq) { var c = lienzo(64, 32, function (g, w, h) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e23b3b';
  for (var k = 0; k < 3; k++) { var x = 6 + k * 19; g.beginPath(); if (izq) { g.moveTo(x + 14, 3); g.lineTo(x, 16); g.lineTo(x + 14, 29); g.lineTo(x + 19, 29); g.lineTo(x + 6, 16); g.lineTo(x + 19, 3); }
    else { g.moveTo(x, 3); g.lineTo(x + 14, 16); g.lineTo(x, 29); g.lineTo(x + 5, 29); g.lineTo(x + 19, 16); g.lineTo(x + 5, 3); } g.closePath(); g.fill(); } }); return M.tex(c, true, false); }
/* ---------- 3c: las texturas reales ----------
   El asfalto: la foto de asfalto de pista repetida 5 × 4 en un lienzo que cubre 7,5 m de ancho y 7 de largo (la foto mide
   2 m), con la goma de las ruedas y las líneas pintadas encima (las mismas de antes). Su relieve igual, con las líneas lisas.
   Se arma una sola vez y la usan las seis pistas. Los bordillos: rojo y blanco gastados con la misma foto. */
var ASF = null;
function componerAsfalto(c0, n0, N) {
  function tiles(g, img, nx, ny, W, H) { for (var i = 0; i < nx; i++) for (var j = 0; j < ny; j++) g.drawImage(img, i * W / nx, j * H / ny, W / nx, H / ny); }
  function lineas(g, col, col2) { var sx = N / 128, sy = N / 256; g.fillStyle = col; g.fillRect(5 * sx, 0, 4 * sx, N); g.fillRect(N - 9 * sx, 0, 4 * sx, N);
    g.fillStyle = col2; [N / 3, 2 * N / 3].forEach(function (x) { g.fillRect(x - 2 * sx, 0, 4 * sx, N / 2 - 20 * sy); }); }
  var cv = M.lienzo(N, N), g = cv.getContext('2d'); tiles(g, c0.image, 5, 4, N, N);
  [.3, .7].forEach(function (u) { var gr = g.createLinearGradient((u - .1) * N, 0, (u + .1) * N, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(8,8,10,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect((u - .1) * N, 0, .2 * N, N); });   /* la goma de las ruedas */
  lineas(g, 'rgba(244,244,240,.9)', 'rgba(255,255,255,.8)');
  var map = M.tex(cv, true, true), nor = null; map.userData.fuente = 'tx-asfalto.webp';
  if (n0) { var cn = M.lienzo(N, N), h = cn.getContext('2d'); tiles(h, n0.image, 5, 4, N, N); lineas(h, 'rgb(128,128,255)', 'rgb(128,128,255)'); nor = M.tex(cn, false, true); nor.userData.fuente = 'tx-asfalto-n.webp'; }
  /* el bordillo: los bloques rojo y blanco de siempre, con el grano de la foto encima */
  var cb = M.lienzo(64, 256), gb = cb.getContext('2d'); gb.fillStyle = '#e23b3b'; gb.fillRect(0, 0, 64, 128); gb.fillStyle = '#f4f2ee'; gb.fillRect(0, 128, 64, 128);
  gb.globalCompositeOperation = 'multiply'; gb.globalAlpha = .45; tiles(gb, c0.image, 1, 4, 64, 256); gb.globalCompositeOperation = 'source-over'; gb.globalAlpha = 1;
  var bor = M.tex(cb, true, true); bor.userData.fuente = 'tx-asfalto.webp';
  return { map: map, nor: nor, bor: bor };
}
function texBandera() { var c = lienzo(48, 32, function (g) { g.fillStyle = '#d91023'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#ffffff'; g.fillRect(16, 0, 16, 32); g.fillStyle = '#d91023'; g.fillRect(32, 0, 16, 32); }); return M.tex(c, true, false); }

M.pista = function (E, mundo, o) {
  o = o || {};
  /* 3a (6-nov): pista ancha como en los juegos de karts (antes 4,6) y trazado 1,6 veces más grande (vueltas de unos 45 s) */
  var baja = M.calidad() === 'baja', W = 7.5, ES = 1.6, rnd = M.azar(mundo.id.length * 77 + 5), gi = GIRO[mundo.id] || [0, 1];
  var ca = Math.cos(gi[0]), sa = Math.sin(gi[0]);
  var curvaT = new THREE.CatmullRomCurve3(TRAZO.map(function (p) { var x = p[0] * gi[1] * ES, z = p[1] * ES; return new V3(x * ca - z * sa, 0, x * sa + z * ca); }), true, 'centripetal');
  var K = 900, PS = curvaT.getSpacedPoints(K), L = curvaT.getLength(), ds = L / K;
  var T = [], R = [], CU = [];
  for (var i = 0; i < K; i++) { var t = PS[(i + 1) % K].clone().sub(PS[i]).normalize(); T.push(t); R.push(new V3(-t.z, 0, t.x)); }
  for (i = 0; i < K; i++) { var a = T[i], b = T[(i + 1) % K]; CU.push(-(a.x * b.z - a.z * b.x) / ds); }   /* > 0: dobla a la izquierda */
  /* curvatura suavizada (para la física y para saber dónde hay curva) */
  var CS = CU.map(function (v, i) { var s = 0; for (var k = -12; k <= 12; k++) s += CU[(i + k + K) % K]; return s / 25; });
  /* ---------- el relieve (3a): lomas, curvas peraltadas y una loma de salto; la largada (meta, tribunas, podio) queda plana ---------- */
  var Y = new Float32Array(K), BK = new Float32Array(K), f1 = rnd() * 6.283, f2 = rnd() * 6.283, A1 = 2.2 + rnd() * .8, A2 = 1.1 + rnd() * .5;
  function lejosLargada(s) { return M.suave(32, 62, s) * M.suave(38, 68, L - s); }   /* 0 en la largada, 1 en el resto */
  /* la loma del salto: en la recta más larga lejos de la largada; se sube despacio y la cumbre es filuda (ahí se despega) */
  var sJ = L * .5, mJ = 1e9; for (var s1 = L * .3; s1 < L * .7; s1 += 2) { var cs1 = 0; for (var k1 = -10; k1 <= 10; k1 += 2) cs1 += Math.abs(CS[Math.floor(((s1 + k1) % L + L) % L / ds) % K]); if (cs1 < mJ) { mJ = cs1; sJ = s1; } }
  var HJ = 1.7, SUBE = 7, BAJA = 5;
  function loma(s) { var u = s - sJ; if (u < -SUBE || u > BAJA) return 0; if (u > 0) return HJ * (1 - u / BAJA);
    var lin = HJ * (1 + u / SUBE), pie = M.suave(-SUBE, -SUBE + 2, u); return lin * pie; }   /* recta y pareja hasta la cumbre (ahí se despega) */
  for (i = 0; i < K; i++) { var si = i * ds, w0 = lejosLargada(si);
    Y[i] = w0 * (A1 * Math.sin(6.2832 * si / L + f1) + A2 * Math.sin(25.1327 * si / L + f2)) + loma(si);
    BK[i] = w0 * Math.max(-.2, Math.min(.2, CS[i] * 7)); }   /* peralte: el lado de afuera de la curva más alto */
  /* la altura de la pista: el centro, más el peralte de costado */
  function ix(s) { var u = ((s % L) + L) % L / ds, i = Math.floor(u); return [i % K, (i + 1) % K, u - i]; }
  function pos(s, x, v) { var q = ix(s), A = PS[q[0]], B = PS[q[1]], r = R[q[0]], f = q[2]; v = v || new V3();
    var lp = Math.max(-(W / 2 + .6), Math.min(W / 2 + .6, x * W / 2)), y = Y[q[0]] + (Y[q[1]] - Y[q[0]]) * f + (BK[q[0]] + (BK[q[1]] - BK[q[0]]) * f) * lp;
    v.set(A.x + (B.x - A.x) * f + r.x * x * W / 2, y, A.z + (B.z - A.z) * f + r.z * x * W / 2); return v; }
  function alto(s) { var q = ix(s); return Y[q[0]] + (Y[q[1]] - Y[q[0]]) * q[2]; }
  function peralte(s) { var q = ix(s); return BK[q[0]] + (BK[q[1]] - BK[q[0]]) * q[2]; }
  var yMin = 1e9, yMax = -1e9; for (i = 0; i < K; i++) { yMin = Math.min(yMin, Y[i]); yMax = Math.max(yMax, Y[i]); }
  /* el suelo sigue a la pista: debajo del asfalto un poco más hondo, en el bordillo a ras, y se va a la ondulación del campo
     (que se apaga lejos, donde está lo lejano de siempre: el mar, los cerros, la catedral) */
  var GR = 8, grilla = {};
  function clave(kx, kz) { return (kx + 2048) * 4096 + (kz + 2048); }
  for (i = 0; i < K; i++) { var kg = clave(Math.floor(PS[i].x / GR), Math.floor(PS[i].z / GR)); (grilla[kg] || (grilla[kg] = [])).push(i); }
  function cercano(x, z) { var kx = Math.floor(x / GR), kz = Math.floor(z / GR), mejor = -1, m = 1e18;
    for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) { var l = grilla[clave(kx + a, kz + b)]; if (!l) continue;
      for (var j = 0; j < l.length; j++) { var P = PS[l[j]], dx = P.x - x, dz = P.z - z, d = dx * dx + dz * dz; if (d < m) { m = d; mejor = l[j]; } } }
    return mejor; }
  var ANDES = mundo.id === 'sierra' || mundo.id === 'noche';   /* Los Andes y la noche andina: el mismo pueblo (de noche, iluminado) */
  var URB = mundo.id === 'ciudad' || mundo.id === 'costa' || mundo.id === 'desierto' || ANDES || mundo.id === 'selva';   /* circuito urbano: casas (o murallas) en vez de muros de curva, vallas y flores del borde */
  var ondas = M.ruido(8, M.azar(mundo.id.length * 41 + 3)), INFO = {}, ORILLA = null;   /* INFO: lo emblemático de este lugar (CI.lugares) */
  if (mundo.id === 'costa') { var zMinP = 1e9; for (i = 0; i < K; i++) zMinP = Math.min(zMinP, PS[i].z); ORILLA = zMinP - 13.5; }   /* 3c: el mar de Huanchaco al lado de la largada */
  function campo(x, z) { var y = (ondas(x / 30 + 11, z / 30 + 5) - .5) * 3.2 * (1 - M.suave(48, 68, Math.hypot(x, z)));
    if (ORILLA != null) { var wb = M.suave(ORILLA + 12, ORILLA + 3, z); y = y * (1 - wb) + ((z - ORILLA) * .05 - .06) * wb; }   /* la playa: baja suave y se mete bajo el agua */
    return y; }
  function altoSuelo(x, z) { var j = cercano(x, z), yn = campo(x, z); if (j < 0) return RIO ? cauce(x, z, yn, -1) : yn;
    var P = PS[j], r = R[j], tj = T[j], l = (x - P.x) * r.x + (z - P.z) * r.z, d = Math.abs(l), lim = W / 2 + .6, sp = j * ds + (x - P.x) * tj.x + (z - P.z) * tj.z;
    var ys = alto(sp) + peralte(sp) * Math.max(-lim, Math.min(lim, l));
    var w = M.suave(W / 2 + 2.8, W / 2 + 13, d), hondo = .4 * (1 - M.suave(W / 2 + .3, W / 2 + .8, d));   /* hondo bajo el asfalto y el bordillo; el pasto (hasta la valla), a ras */
    var ysu = (ys - .03 - hondo) * (1 - w) + yn * w; return RIO ? cauce(x, z, ysu, j) : ysu; }
  function dir(s, v) { var q = ix(s); return (v || new V3()).copy(T[q[0]]).lerp(T[q[1]], q[2]).normalize(); }
  function curva(s) { var q = ix(s); return CS[q[0]] + (CS[q[1]] - CS[q[0]]) * q[2]; }
  /* ¿qué tan lejos está un punto de la pista? (para no sembrar encima) */
  function lejosDePista(x, z) { var m = 1e9; for (var i = 0; i < K; i += 3) { var dx = PS[i].x - x, dz = PS[i].z - z, d = dx * dx + dz * dz; if (d < m) m = d; } return Math.sqrt(m); }

  /* ---------- la Amazonía: un río cruza la pista por debajo de un puente; hacia afuera corre hasta donde no toque otro tramo, y
     hacia adentro termina en una cocha (laguna) si cabe. El cauce baja el suelo; el agua queda por debajo de sus orillas. ---------- */
  var RIO = null;
  function sCirc(a, b) { var d = Math.abs(((a - b) % L + L) % L); return Math.min(d, L - d); }
  function distOtro(x, z) { var m = 1e9; for (var i = 0; i < K; i += 3) { if (RIO0 && sCirc(i * ds, RIO0.s) < 25) continue; var dx = PS[i].x - x, dz = PS[i].z - z, d = dx * dx + dz * dz; if (d < m) m = d; } return Math.sqrt(m); }
  var RIO0 = null;
  if (mundo.id === 'selva') {
    var sRio = L * .5, mRio = 1e9;
    for (var sr = L * .3; sr < L * .78; sr += 2) { if (Math.abs(sr - sJ) < 35) continue; var cr = 0; for (var kr = -14; kr <= 14; kr += 2) cr += Math.abs(CS[Math.floor(((sr + kr) % L + L) % L / ds) % K]); if (cr < mRio) { mRio = cr; sRio = sr; } }
    var P0r = pos(sRio, 0), tRio = dir(sRio), afR = Math.hypot(pos(sRio, 1).x, pos(sRio, 1).z) > Math.hypot(pos(sRio, -1).x, pos(sRio, -1).z) ? 1 : -1;
    var uRio = new V3(-tRio.z * afR, 0, tRio.x * afR), HWR = 6;   /* uRio: río abajo (hacia afuera de la vuelta); tRio: a lo ancho del río */
    RIO0 = { s: sRio };
    var uMaxR = W / 2 + 12; for (var ur = W / 2 + 12; ur <= 130; ur += 3) { if (distOtro(P0r.x + uRio.x * ur, P0r.z + uRio.z * ur) < W / 2 + HWR + 5) break; uMaxR = ur; }
    var coc = null;
    for (var dIn = W / 2 + 16; dIn <= W / 2 + 42 && !coc; dIn += 2) { var ccx = P0r.x - uRio.x * dIn, ccz = P0r.z - uRio.z * dIn, okc = true, rc = 8;
      for (var ka = 0; ka < 16 && okc; ka++) { var aa = ka / 16 * 6.283; if (distOtro(ccx + Math.cos(aa) * (rc + 4), ccz + Math.sin(aa) * (rc + 4)) < W / 2 + 3) okc = false; }
      for (var uu = W / 2 + 10; uu < dIn && okc; uu += 3) if (distOtro(P0r.x - uRio.x * uu, P0r.z - uRio.z * uu) < W / 2 + HWR + 4) okc = false;
      if (okc) coc = { x: ccx, z: ccz, rad: rc, d: dIn }; }
    var tmpR = { s: sRio, x: P0r.x, z: P0r.z, u: uRio, t: tRio, hw: HWR, ancho: HWR * 2, uIn: coc ? -coc.d : -(W / 2 + 9), uMax: uMaxR, cocha: coc };
    var minOr = 1e9;   /* el agua, por debajo de las orillas en todo su largo (se mide sin el cauce) */
    for (ur = tmpR.uIn; ur <= tmpR.uMax; ur += 3) [-1, 1].forEach(function (l) { [HWR + 2, HWR + 4.5].forEach(function (w) { minOr = Math.min(minOr, altoSuelo(P0r.x + uRio.x * ur + tRio.x * l * w, P0r.z + uRio.z * ur + tRio.z * l * w)); }); });   /* también donde termina el agua */
    if (coc) for (ka = 0; ka < 12; ka++) { aa = ka / 12 * 6.283; [2, 3.8].forEach(function (w) { minOr = Math.min(minOr, altoSuelo(coc.x + Math.cos(aa) * (coc.rad + w), coc.z + Math.sin(aa) * (coc.rad + w))); }); }
    tmpR.agua = Math.min(alto(sRio) - 1.6, minOr - .45); tmpR.lecho = tmpR.agua - 1.3; RIO = tmpR;
  }
  function factorRio(x, z) {   /* 0 fuera del río; 1 en el cauce (con orillas suaves de 5 m) */
    if (!RIO) return 0; var dx = x - RIO.x, dz = z - RIO.z, u = dx * RIO.u.x + dz * RIO.u.z, v = dx * RIO.t.x + dz * RIO.t.z;
    var dd = u < RIO.uIn ? Math.hypot(v, u - RIO.uIn) : u > RIO.uMax ? Math.hypot(v, u - RIO.uMax) : Math.abs(v), f = 1 - M.suave(RIO.hw, RIO.hw + 5, dd);
    if (RIO.cocha) { var c = RIO.cocha; f = Math.max(f, 1 - M.suave(c.rad, c.rad + 4, Math.hypot(x - c.x, z - c.z))); }
    return f; }
  function cauce(x, z, y, j) { var f = factorRio(x, z); if (f <= 0) return y;
    if (j >= 0 && sCirc(j * ds, RIO.s) > 25) f *= M.suave(W / 2 + 6, W / 2 + 12, Math.hypot(PS[j].x - x, PS[j].z - z));   /* junto a otro tramo de la pista no se cava (y se apaga suave) */
    return y * (1 - f) + RIO.lecho * f; }

  /* ---------- el mundo alrededor ---------- */
  var cielo = M.cielo(E, mundo), luces = M.luces(E, mundo);
  if (!baja) { var scs = luces.sol.shadow.camera; scs.left = -15; scs.right = 15; scs.top = 15; scs.bottom = -15; scs.near = 1; scs.far = 75; scs.updateProjectionMatrix();
    luces.sol.shadow.mapSize.set(2048, 2048); luces.sol.shadow.bias = -0.0005; luces.sol.shadow.normalBias = .03; }   /* 3c: 30 × 30 m, centrada en lo que viene (antes 12 × 12 alrededor del auto) */
  E.fog.near = mundo.niebla.cerca * 2.2; E.fog.far = mundo.niebla.lejos * 2.5;   /* en la carrera se mira más lejos (y ahora es más grande) */
  var TAM = 230, sueloR = M.suelo(E, mundo, { cx: 0, cz: 0, r: 80, tam: TAM, seg: baja ? 80 : 115, alto: altoSuelo, libre: function (x, z) { return lejosDePista(x, z) > W / 2 + 1.4; } });
  /* lo lejano se hizo para el laberinto (14 × 14): acá se le dice qué tan grande es esto y dónde no poner nada */
  function libre(x, z, margen) { return lejosDePista(x, z) > W / 2 + .55 + (margen || 0); }
  var catEn = null;
  if (mundo.id === 'ciudad') { var sC = 18, pO = pos(sC, 1), pI = pos(sC, -1), lo = Math.hypot(pO.x, pO.z) > Math.hypot(pI.x, pI.z) ? 1 : -1, pc = pos(sC, lo * (1 + 10 / (W / 2))), dC = dir(sC);
    catEn = { x: pc.x, z: pc.z, y: altoSuelo(pc.x, pc.z) - .2, giro: Math.atan2(dC.z * lo, -dC.x * lo) }; }   /* la catedral mira a la pista, por fuera de la largada */
  var lejos = M.lejos(E, mundo, { cx: 0, cz: 0, medioX: mundo.id === 'selva' ? 86 : 70, medioZ: mundo.id === 'selva' ? 86 : 67, libre: libre, copasDesde: 77, hundir: 9,
    orilla: ORILLA, olas: mundo.id === 'costa', baja: baja, muelle: 1.6, faroles: true, escalaCatedral: 2, catedralEn: catEn, escalaCasonas: mundo.id === 'ciudad' ? 2.2 : 1, info: INFO,   /* 3c: el mar con olas, el muelle grande y la catedral grande (solo la carrera los pide) */   /* los árboles gigantes, lejos de la cámara */
    catedralAparte: mundo.id === 'ciudad' && !!(M.ciudad && M.catedral) });   /* 9-nov: en Trujillo, la catedral con su detalle la arma ciudad.js (más abajo) */
  var vidaG = new THREE.Group(), vida = M.vida ? M.vida(vidaG, mundo, { cx: 0, cz: 0, w: 14, h: 14 }) : null; E.add(vidaG);
  /* ---------- el circuito urbano (ciudad.js): Trujillo (casonas), Huanchaco (casas de playa y el malecón) y Chan Chan (murallas,
     con la plaza ceremonial). Veredas a los dos lados, menos en Chan Chan (ahí el barro llega a la pista) ---------- */
  var vLg = new V3(), PUENTE = null, TUNEL = null, matTablas = null;   /* (enLargada lo usa, y los andenes la llaman antes de la flora) */
  /* el agua del río: una franja a lo largo del cauce, con las puntas redondas, y la cocha; con ondas que se mueven */
  var NM_RIO = null;
  function aguaDelRio() {
    var c = M.lienzo(128, 128), g = c.getContext('2d'), im = g.createImageData(128, 128), rr = M.ruido(16, M.azar(91)), h = new Float32Array(128 * 128);
    for (var y = 0; y < 128; y++) for (var x = 0; x < 128; x++) h[y * 128 + x] = rr(x / 8, y / 8);
    for (y = 0; y < 128; y++) for (x = 0; x < 128; x++) { var dx = h[y * 128 + (x + 1) % 128] - h[y * 128 + (x + 127) % 128], dy = h[((y + 1) % 128) * 128 + x] - h[((y + 127) % 128) * 128 + x], i = (y * 128 + x) * 4;
      im.data[i] = 128 + dx * 220; im.data[i + 1] = 128 + dy * 220; im.data[i + 2] = 255; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); NM_RIO = M.tex(c, false, true); NM_RIO.repeat.set(4, 12);
    var mat = new THREE.MeshStandardMaterial({ color: '#3a4626', roughness: .3, metalness: .05, normalMap: NM_RIO, normalScale: new THREE.Vector2(.4, .4), envMap: baja || !M.envCielo ? null : M.envCielo(mundo), envMapIntensity: .3 });   /* turbia y verdosa: refleja poco (con más brillo se veía blanca) */
    var J = new M.Junta(), largo = RIO.uMax - RIO.uIn, xa = new V3(RIO.u.z, 0, -RIO.u.x), mt = new M4();
    function pieza(geo, u) { geo.rotateX(-Math.PI / 2); var px = RIO.x + RIO.u.x * u, pz = RIO.z + RIO.u.z * u; mt.makeBasis(xa, new V3(0, 1, 0), RIO.u).setPosition(px, RIO.agua, pz); J.pieza(geo, [1, 1, 1], mt, .08); }
    RIO.hwAgua = RIO.hw + 4.2;   /* el borde del agua, bajo la orilla (no flota) */
    pieza(new THREE.PlaneGeometry(RIO.hwAgua * 2, largo), (RIO.uIn + RIO.uMax) / 2);
    pieza(new THREE.CircleGeometry(RIO.hwAgua, 24), RIO.uIn); pieza(new THREE.CircleGeometry(RIO.hwAgua, 24), RIO.uMax);
    if (RIO.cocha) { var gc = new THREE.CircleGeometry(RIO.cocha.rad + 3.6, 28); gc.rotateX(-Math.PI / 2); gc.translate(RIO.cocha.x, RIO.agua, RIO.cocha.z); J.pieza(gc, [1, 1, 1], null, .08); }
    var m = new THREE.Mesh(J.geometria(), mat); m.receiveShadow = true; m.userData.rio = true; E.add(m); return [m];
  }

  var CIUDAD = null, mVer = null, MALECON = null, PLAZA = null, IGLESIA = null, PILETA = null, PIRCAS = null, ANDENES = null, SP = L * .52;   /* SP: en Los Andes, hasta dónde llega el pueblo */
  if (URB && M.ciudad) {
    var enPueblo = ANDES ? function (s) { return s < SP + 3 || s > L - 45; } : null;   /* en Los Andes, la vereda solo en el pueblo */
    if (mundo.id !== 'desierto' && mundo.id !== 'selva') { mVer = new THREE.MeshStandardMaterial({ color: mundo.id === 'costa' ? '#ddd7cb' : '#cfc7ba', roughness: .9 }); cinta(-W / 2 - 2.62, -W / 2 - .55, .14, mVer, 1.6, enPueblo); cinta(W / 2 + .55, W / 2 + 2.62, .14, mVer, 1.6, enPueblo); }
    var opC = { pos: pos, dir: dir, curva: curva, L: L, W: W, alto: altoSuelo, dist: lejosDePista, baja: baja, env: baja || !M.envCielo ? null : M.envCielo(mundo), sIni: 30, sFin: L - 40 };
    if (mundo.id === 'costa') {   /* Huanchaco: del lado del mar no hay casas sino el malecón */
      var LMAR = R[0].z < 0 ? 1 : -1, enMar = function (s) { return pos(s, LMAR * (1 + 2.65 / (W / 2))).z < ORILLA + 21; };
      opC.plantilla = 'playa'; opC.semilla = 909;
      opC.saltar = function (q) { if (q.lado === LMAR && enMar(q.s)) return true;
        return Math.min(q.a.z, q.b.z, q.a.z + q.Z.z * q.fondo, q.b.z + q.Z.z * q.fondo) < ORILLA + 16; };
    }
    if (mundo.id === 'desierto') { opC.plantilla = 'muralla'; opC.semilla = 515; }   /* Chan Chan: por dentro de la ciudadela */
    if (ANDES) { opC.plantilla = 'andina'; opC.semilla = 313; opC.sFin = SP; opC.noche = mundo.id === 'noche'; }   /* Los Andes: el pueblo hasta media vuelta; después, el campo */
    if (mundo.id === 'selva' && RIO) {   /* la Amazonía: los palafitos a los dos lados, cerca del río (no en el puente) */
      opC.plantilla = 'palafito'; opC.semilla = 717; opC.sIni = Math.max(30, RIO.s - 80); opC.sFin = Math.min(L - 40, RIO.s + 80);
      opC.saltar = function (q) { return sCirc(q.s, RIO.s) < 15 || factorRio((q.a.x + q.b.x) / 2, (q.a.z + q.b.z) / 2) > .05; }; }
    CIUDAD = M.ciudad(E, mundo, opC);
    if (mundo.id === 'desierto' && M.plazaCeremonial) {   /* la plaza ceremonial con su rampa, del lado de afuera de la largada */
      var sPz = 12, lPz = Math.hypot(pos(sPz, 1).x, pos(sPz, 1).z) > Math.hypot(pos(sPz, -1).x, pos(sPz, -1).z) ? 1 : -1;
      PLAZA = M.plazaCeremonial(E, { pos: pos, dir: dir, W: W, alto: altoSuelo, dist: lejosDePista, baja: baja, mats: CIUDAD.mats, s: sPz, lado: lPz }); INFO.plaza = PLAZA; }
    if (ANDES && M.iglesiaAndina) {   /* la iglesia frente a la largada (afuera), la plaza con su pileta enfrente; en el campo, pircas y un cerro con andenes */
      var sIg = 18, lIg = Math.hypot(pos(sIg, 1).x, pos(sIg, 1).z) > Math.hypot(pos(sIg, -1).x, pos(sIg, -1).z) ? 1 : -1, opA = { pos: pos, dir: dir, W: W, L: L, alto: altoSuelo, dist: lejosDePista, baja: baja, mats: CIUDAD.mats, env: opC.env, noche: opC.noche };
      IGLESIA = M.iglesiaAndina(E, Object.assign({ s: sIg, lado: lIg }, opA)); PILETA = M.pileta(E, Object.assign({ s: sIg, lado: -(IGLESIA ? IGLESIA.lado : lIg) }, opA));   /* enfrente de donde quedó la iglesia */
      PIRCAS = M.pircas(E, Object.assign({ desde: SP + 5, hasta: L - 46 }, opA));
      ANDENES = M.andenes(E, Object.assign({ libre: function (x, z) { return !CIUDAD.ocupa(x, z) && !(IGLESIA && IGLESIA.ocupa(x, z)) && !(PILETA && PILETA.ocupa(x, z)) && !PIRCAS.ocupa(x, z) && !enLargada(x, z); } }, opA));
      if (IGLESIA) INFO.iglesia = IGLESIA; if (PILETA) INFO.pileta = PILETA; INFO.pircas = PIRCAS; INFO.andenes = ANDENES; }
    if (mundo.id === 'ciudad' && M.catedral)   /* Trujillo: la catedral frente a la largada, del lado de afuera (sC y lo, de más arriba; adentro queda la plaza) */
      INFO.catedral = M.catedral(E, { pos: pos, dir: dir, W: W, alto: altoSuelo, dist: lejosDePista, baja: baja, mats: CIUDAD.mats, s: sC, lado: lo }).g;
    if (mundo.id === 'selva' && RIO && M.puenteMadera) {   /* el puente de tablas sobre el río, el agua, las canoas y, del otro lado de la vuelta, el túnel de selva */
      var s0P = RIO.s - 11, s1P = RIO.s + 11, eP = W / 2 + 2.85;
      matTablas = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85 }); matTablas.userData.conMapa = function (m) { m.color.setScalar(1.6); };
      cinta(-eP, eP, .07, matTablas, 2.0, function (s) { return s >= s0P && s <= s1P; }, 6);   /* el tablero: los tablones cruzan la pista */
      PUENTE = M.puenteMadera(E, { pos: pos, W: W, s0: s0P, s1: s1P, lecho: RIO.lecho, mats: CIUDAD.mats, baja: baja, yTablero: function (s, lat) { return alto(s) + peralte(s) * lat + .07; } });
      PUENTE.tablas = matTablas; INFO.puente = PUENTE;
      RIO.mallas = aguaDelRio(); INFO.rio = RIO;
      var sitiosC = []; [14, 22, 31].forEach(function (u, k) { if (u > RIO.uMax - 3) return; var v = (k % 2 ? 1 : -1) * (1.6 + k * .4);
        sitiosC.push({ x: RIO.x + RIO.u.x * u + RIO.t.x * v, z: RIO.z + RIO.u.z * u + RIO.t.z * v, giro: Math.atan2(-RIO.u.z, RIO.u.x) + (k - 1) * .25 }); });
      if (RIO.cocha) [0, 2.4].forEach(function (a) { sitiosC.push({ x: RIO.cocha.x + Math.cos(a) * 3.5, z: RIO.cocha.z + Math.sin(a) * 3.5, giro: a + 1.2 }); });
      var CAN = M.canoas(E, { sitios: sitiosC, agua: RIO.agua, mats: CIUDAD.mats, baja: baja }); INFO.canoas = CAN.n; RIO.mallas = RIO.mallas.concat(CAN.mallas);
      var sTn = RIO.s > L / 2 ? RIO.s - L * .42 : RIO.s + L * .42; sTn = Math.max(70, Math.min(L - 80, sTn));
      TUNEL = M.tunelSelva(E, { pos: pos, W: W, L: L, alto: altoSuelo, altoPista: alto, dist: lejosDePista, baja: baja, s0: sTn - 22, s1: sTn + 22 }); INFO.tunel = TUNEL; }

    if (mundo.id === 'costa' && M.malecon) {
      MALECON = M.malecon(E, { pos: pos, L: L, W: W, lado: LMAR, enMar: enMar, mats: CIUDAD.mats, baja: baja, pista: lejosDePista, orilla: ORILLA,
        yEn: function (s, of) { return alto(s) + peralte(s) * of + .14; }, muelleX: INFO.muelleX, muelleY: 1.1 * 1.6 + .1, muelleAncho: 1.6 * 1.6 });
      INFO.baranda = MALECON.metros; INFO.malecon = MALECON;
    }
  }
  /* 3c: la vegetación de cada lugar, fuera de las vallas (flora.js). sitio: qué tan lejos del centro de la pista y en qué parte de la vuelta */
  function sitioPista(x, z) { var j = cercano(x, z); if (j < 0) return [lejosDePista(x, z), -1]; var P = PS[j]; return [Math.hypot(P.x - x, P.z - z), j * ds]; }
  function enLargada(x, z) { for (var sl = -52; sl <= 40; sl += 4) { pos(sl, 0, vLg); if ((vLg.x - x) * (vLg.x - x) + (vLg.z - z) * (vLg.z - z) < 361) return true; } return false; }
  var flora = M.flora ? M.flora(E, mundo, { alto: altoSuelo, sitio: sitioPista, largada: enLargada, L: L, W: W, baja: baja, R: mundo.id === 'ciudad' ? 72 : 74,   /* en Trujillo, las casonas empiezan a 76 */
    fuera: mundo.id === 'costa' ? function (x, z) { return z < ORILLA + 6; } : RIO ? function (x, z) { return factorRio(x, z) > .02; } : mundo.id === 'ciudad' ? function (x, z) { return x * x + z * z < 100; } : null,
    permitido: mundo.id === 'ciudad' ? function (x, z, d, sP) { return x * x + z * z < 576 || (sP >= 0 && (sP < 26 || sP > L - 36) && d > 9 && Math.hypot(x, z) < Math.hypot(PS[Math.floor(sP / ds) % K].x, PS[Math.floor(sP / ds) % K].z)); }
      : mundo.id === 'costa' && CIUDAD ? function (x, z) { return !CIUDAD.ocupa(x, z) && !(MALECON && MALECON.ocupa(x, z)); }
      : mundo.id === 'desierto' && CIUDAD ? function (x, z) { for (var a = -2; a <= 2; a += 2) for (var b = -2; b <= 2; b += 2) if (CIUDAD.ocupa(x + a, z + b)) return false; return !(PLAZA && PLAZA.ocupa(x, z)); }   /* Chan Chan: lejos de los muros (las copas de los algarrobos son anchas) y fuera de la plaza */
      : ANDES && CIUDAD ? function (x, z) { for (var a = -2; a <= 2; a += 2) for (var b = -2; b <= 2; b += 2) if (CIUDAD.ocupa(x + a, z + b)) return false;
          return !(IGLESIA && IGLESIA.ocupa(x, z)) && !(PILETA && PILETA.ocupa(x, z)) && !(PIRCAS && PIRCAS.ocupa(x, z)) && !(ANDENES && ANDENES.ocupa(x, z)); }   /* Los Andes: fuera de las casas, la iglesia, la plaza, las pircas y los andenes */
      : mundo.id === 'selva' && CIUDAD ? function (x, z) { for (var a = -2; a <= 2; a += 2) for (var b = -2; b <= 2; b += 2) if (CIUDAD.ocupa(x + a, z + b)) return false; return !(TUNEL && TUNEL.ocupa(x, z)); }   /* la Amazonía: fuera de los palafitos y de los árboles del túnel */
      : null }) : null;   /* Huanchaco: fuera de las casas y de la pasarela */   /* Trujillo: la plaza y el lado de adentro de la largada */   /* en Huanchaco, el mar y la playa; en Trujillo, el monumento */
  var emblemas = M.lugares ? M.lugares(E, mundo, { cielo: cielo, alto: altoSuelo, baja: baja }) : null;   /* «lugares» ya es el nombre de los asientos de las tribunas */
  if (emblemas) { if (emblemas.monumento) INFO.monumento = emblemas.monumento; if (emblemas.titilan) INFO.titilan = emblemas.titilan; }

  /* ---------- el asfalto y los bordillos ---------- */
  function cinta(x0, x1, y, mat, vPor, en, uK) {   /* en(s): solo en esa parte de la vuelta; uK: veces que se repite la textura a lo ancho */
    var pos3 = [], uv = [], idx = [];
    for (var i = 0; i <= K; i++) { var P = PS[i % K], r = R[i % K], yc = Y[i % K] + y, bk = BK[i % K];
      pos3.push(P.x + r.x * x0, yc + bk * x0, P.z + r.z * x0, P.x + r.x * x1, yc + bk * x1, P.z + r.z * x1); uv.push(0, i * ds / vPor, uK || 1, i * ds / vPor); }
    for (i = 0; i < K; i++) { if (en && !en(i * ds)) continue; var q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }   /* que miren hacia arriba */
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.pista = true; E.add(m); return m; }   /* el asfalto y los bordillos: son la pista misma */
  var tA = texAsfalto(); tA.repeat.set(1, 1);
  var matA = new THREE.MeshStandardMaterial({ map: tA, roughness: .85 }); cinta(-W / 2, W / 2, .03, matA, 7);
  var tB = texBordillo(), mB = new THREE.MeshStandardMaterial({ map: tB, roughness: .6 });
  cinta(-W / 2 - .55, -W / 2, .045, mB, 2.4); cinta(W / 2, W / 2 + .55, .045, mB, 2.4);
  /* la línea de largada a cuadros */
  var lin = new THREE.Mesh(new THREE.PlaneGeometry(W, .9), new THREE.MeshStandardMaterial({ map: texCuadros(), roughness: .7 }));
  lin.rotation.x = -Math.PI / 2; var p0 = pos(0, 0); lin.position.set(p0.x, .05, p0.z); lin.rotation.z = Math.atan2(T[0].x, T[0].z) + Math.PI; E.add(lin);
  /* el carril de boxes: las marcas de la grilla de largada */
  var JG = new M.Junta();
  for (var k = 1; k <= 8; k++) { var sg = L - k * 2.1, xg = k % 2 ? -.45 : .45, pg = pos(sg, xg), d = dir(sg), ang = Math.atan2(d.x, d.z);
    [-1, 1].forEach(function (l) { var b = new THREE.BoxGeometry(.06, .01, .5); JG.pieza(b, M.col('#ffffff'), new M4().makeRotationY(ang).setPosition(pg.x + Math.cos(ang) * l * .45, .05, pg.z - Math.sin(ang) * l * .45)); }); }
  E.add(new THREE.Mesh(JG.geometria(), new THREE.MeshBasicMaterial({ vertexColors: true })));

  /* ---------- en las curvas, las paredes del mundo (por fuera); en las rectas, vallas ---------- */
  var muro = null; if (!URB || mundo.id === 'desierto') try { muro = M.muros(mundo); } catch (e) { muro = null; }   /* Trujillo y Huanchaco: en vez de muros, las casas (ciudad.js); Chan Chan lo usa para las murallas de alrededor */
  var ESM = 1.35, enMuro = [], enValla = [], muroId = mundo.id === 'ciudad' ? 'casona' : mundo.muro, murosReal = [], clones = {};
  for (var s = 0; s < L; s += ESM) { var c = curva(s); if (Math.abs(c) > .045 / ES) enMuro.push([s, c > 0 ? 1 : -1]); else if (Math.floor(s / ESM) % 2 === 0) enValla.push(s); }
  if (muro && !URB) {   /* los muros de las curvas (en el circuito urbano, no: ahí están las casas o las murallas) */
    var porVar = {}; enMuro.forEach(function (q, j) { var v = j % muro.variantes.length; (porVar[v] = porVar[v] || []).push(q); });
    var ob = new THREE.Object3D();
    Object.keys(porVar).forEach(function (v) { var lista = porVar[v];
      muro.variantes[v].forEach(function (parte, pi) { var mat = parte.mat;
        if (pi === 0 && TX_MURO[muroId]) { if (!clones[mat.uuid]) { clones[mat.uuid] = mat.clone(); murosReal.push(clones[mat.uuid]); } mat = clones[mat.uuid]; }   /* el cuerpo del muro: aquí recibe su foto */
        var im = new THREE.InstancedMesh(parte.geo, mat, lista.length);
        lista.forEach(function (q, j) { var lado = q[1], pm = pos(q[0], lado * (1 + (2.7 + muro.grosor * ESM / 2) / (W / 2))), d = dir(q[0]);
          ob.position.set(pm.x, altoSuelo(pm.x, pm.z), pm.z); ob.rotation.set(0, Math.atan2(-d.z, d.x), 0); ob.scale.set(ESM, ESM, ESM); ob.updateMatrix(); im.setMatrixAt(j, ob.matrix); });
        im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; im.userData.muroCurva = true; E.add(im); }); });
  }
  /* 3c: Chan Chan, las murallas de adobe con sus frisos, a escala de muralla, alrededor del circuito (con dos puertas) */
  var murallas = [];
  if (muro && muroId === 'adobe') {
    var EM = 5.2, HW = 72, tramosM = [], obM = new THREE.Object3D();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (sd) { for (var u = -HW; u < HW - .1; u += EM) { var uc = u + EM / 2;
      if (sd[1] !== 0 && Math.abs(uc) < 8) continue;
      var xm = sd[0] ? sd[0] * HW : uc, zm = sd[1] ? sd[1] * HW : uc; if (lejosDePista(xm, zm) < W / 2 + 6) continue; tramosM.push([xm, zm, sd[0] ? Math.PI / 2 : 0]); } });
    var porVM = {}; tramosM.forEach(function (q, j) { var v = j % muro.variantes.length; (porVM[v] = porVM[v] || []).push(q); });
    Object.keys(porVM).forEach(function (v) { var lista = porVM[v];
      muro.variantes[v].forEach(function (parte, pi) { var mat = parte.mat;
        if (pi === 0 && TX_MURO[muroId]) { if (!clones[mat.uuid]) { clones[mat.uuid] = mat.clone(); murosReal.push(clones[mat.uuid]); } mat = clones[mat.uuid]; }   /* el barro real (sin los muros de curva, la copia se hace aquí) */
        var im = new THREE.InstancedMesh(parte.geo, mat, lista.length);
        lista.forEach(function (q, j) { obM.position.set(q[0], altoSuelo(q[0], q[1]) - .35, q[1]); obM.rotation.set(0, q[2], 0); obM.scale.set(EM, EM, EM); obM.updateMatrix(); im.setMatrixAt(j, obM.matrix); });
        im.userData.alto = muro.alto; im.castShadow = !baja; im.receiveShadow = true; im.frustumCulled = false; E.add(im); if (pi === 0) murallas.push(im); }); });
    INFO.murallas = murallas;
  }
  /* vallas blancas y rojas de las rectas (una sola malla) */
  var JV = new M.Junta(), blanco = M.col('#f3f3f0'), rojo = M.col('#d8343a');
  enValla.forEach(function (s, j) { [-1, 1].forEach(function (l) { var p = pos(s, l * (1 + 2.6 / (W / 2))), d = dir(s), ang = Math.atan2(-d.z, d.x), m = new M4().makeRotationY(ang).setPosition(p.x, altoSuelo(p.x, p.z), p.z);
    JV.pieza(new THREE.BoxGeometry(.06, .5, .06).translate(0, .25, 0), blanco, m); JV.pieza(new THREE.BoxGeometry(ESM, .09, .04).translate(0, .42, 0), j % 2 ? rojo : blanco, m); JV.pieza(new THREE.BoxGeometry(ESM, .09, .04).translate(0, .22, 0), j % 2 ? blanco : rojo, m); }); });
  if (JV.base && !URB) { var mVa = new THREE.Mesh(JV.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 })); mVa.userData.valla = true; E.add(mVa); }
  /* ---------- la largada: arco con letrero y semáforo, tribunas con público, banderas y globos ---------- */
  var cols = mundo.regalos, acento = mundo.acento;
  var arco = new THREE.Group(), pA = pos(1.2, 0), dA = dir(1.2); arco.position.set(pA.x, 0, pA.z); arco.rotation.y = Math.atan2(dA.x, dA.z); E.add(arco);
  var mPil = new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: .5, metalness: .3 });
  /* alto: la cámara va a 1,75 y el semáforo a 2,55 le tapaba media pantalla al pasar; todo va por encima de 3,2 */
  [-1, 1].forEach(function (l) { var pil = new THREE.Mesh(new THREE.BoxGeometry(.35, 4.6, .35), mPil); pil.position.set(l * (W / 2 + 2.9), 2.3, 0); pil.castShadow = true; arco.add(pil); });
  var anchoL = Math.round(96 * (W + 6.2) / .9 / 16) * 16;   /* la imagen con la forma del letrero: desde la 3a mide 13,7 × 0,9 y la de 512 × 96 se estiraba casi 3 veces */
  var letrero = new THREE.Mesh(new THREE.BoxGeometry(W + 6.2, .9, .18), [mPil, mPil, mPil, mPil, new THREE.MeshBasicMaterial({ map: texLetrero('RUWAY · LA GRAN CARRERA', acento, '#1c1424', anchoL) }), new THREE.MeshBasicMaterial({ map: texLetrero('RUWAY · LA GRAN CARRERA', acento, '#1c1424', anchoL) })]);
  letrero.position.y = 4.3; arco.add(letrero);
  var focos = [];
  for (k = 0; k < 5; k++) { var fm = new THREE.MeshBasicMaterial({ color: '#3a1010' }), f = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), fm); f.position.set(-1 + k * .5, 3.55, .12); arco.add(f); focos.push(fm); }
  var caja = new THREE.Mesh(new THREE.BoxGeometry(2.8, .42, .16), mPil); caja.position.set(0, 3.55, 0); arco.add(caja);
  function semaforo(n) { focos.forEach(function (m, k) { m.color.set(n >= 6 ? '#3cff6a' : (k < n ? '#ff3030' : '#3a1010')); }); }
  /* tribunas a los dos lados de la recta de largada, con techito del color del mundo y público */
  var gente = [], GENTE_N = 0, mPer = null, imPer = null;
  var JT = new M.Junta(), lugares = [];
  [-1, 1].forEach(function (l) { for (var tz = 0; tz < 2; tz++) {
    var s0 = -6 - tz * 9, p = pos(s0, l * (1 + 4.2 / (W / 2))), d = dir(s0), ang = Math.atan2(-d.z, d.x), m = new M4().makeRotationY(ang).setPosition(p.x, 0, p.z), rr = new V3(-d.z, 0, d.x).multiplyScalar(l);
    for (var e = 0; e < 4; e++) JT.pieza(new THREE.BoxGeometry(7.5, .4 + e * .45, .7).translate(0, (.4 + e * .45) / 2, e * .7 * l), e % 2 ? M.col('#d9d2c8') : M.col('#c4bcb0'), m);
    JT.pieza(new THREE.BoxGeometry(7.9, .12, 3.4).translate(0, 2.9, 1.1 * l), M.col(acento), m);
    [-3.8, 3.8].forEach(function (xx) { JT.pieza(new THREE.BoxGeometry(.12, 2.9, .12).translate(xx, 1.45, 2.6 * l), M.col('#ffffff'), m); });
    for (e = 0; e < 4; e++) for (var q = 0; q < 14; q++) lugares.push({ p: new V3(p.x, .4 + e * .45, p.z).addScaledVector(dir(s0), -3.4 + q * .5 + (e % 2) * .25).addScaledVector(rr, e * .7 + .2), f: rnd() * 6.283 });
  } });
  E.add(new THREE.Mesh(JT.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 })));
  if (lugares.length) {
    var JP = new M.Junta(); JP.pieza(new THREE.CylinderGeometry(.11, .14, .34, 8).translate(0, .17, 0), M.col('#ffffff')); JP.pieza(new THREE.SphereGeometry(.1, 10, 8).translate(0, .44, 0), M.col('#f2c9a8'));
    mPer = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 }); imPer = new THREE.InstancedMesh(JP.geometria(), mPer, lugares.length);
    var cg = new THREE.Color(), ropa = ['#ff5a7a', '#3a8bff', '#ffd23f', '#3fc46a', '#9b6bff', '#ff8a3d', '#ffffff', '#1fb5b0'];
    lugares.forEach(function (u, j) { imPer.setColorAt(j, cg.set(ropa[j % ropa.length]).convertSRGBToLinear()); });
    E.add(imPer); GENTE_N = lugares.length; gente = lugares;
  }
  /* banderas del Perú en mástiles y globos de colores junto a la largada */
  var tbF = texBandera(), banderas = [];
  [[-4, -1], [-4, 1], [4, -1], [4, 1], [-15, -1], [-15, 1]].forEach(function (b) { var p = pos(b[0], b[1] * (1 + 3.2 / (W / 2)));
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3, 6), mPil); mast.position.set(p.x, 1.5, p.z); E.add(mast);
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(.9, .6, 6, 1), new THREE.MeshStandardMaterial({ map: tbF, side: THREE.DoubleSide, roughness: .8 })); fl.position.set(p.x, 2.6, p.z); E.add(fl); banderas.push(fl); });
  var globos = [];
  [[-9, -1], [-9, 1], [8, 1], [-22, -1]].forEach(function (b, j) { var p = pos(b[0], b[1] * (1 + 3.7 / (W / 2))), gg = new THREE.Group(); gg.position.set(p.x, 0, p.z);
    for (var k = 0; k < 4; k++) { var gl = new THREE.Mesh(new THREE.SphereGeometry(.28, 14, 10), new THREE.MeshStandardMaterial({ color: cols[(j + k) % cols.length], roughness: .25, metalness: .05 })); gl.scale.y = 1.2; gl.position.set((k % 2 - .5) * .45, 2.6 + (k >> 1) * .5, (k >> 1) * .2); gg.add(gl); }
    var hilo = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 2.4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hilo.position.y = 1.3; gg.add(hilo); E.add(gg); globos.push(gg); });

  /* ---------- banderines cruzando la pista, solo en la recta de la largada ----------
     Antes eran siete cruces por la vuelta, a 3,1 de alto: en el celular vertical se veían enormes y tapaban el cielo.
     Ahora dos, más altos y más chicos: se ven de lejos y pasan por encima. */
  var JBn = new M.Junta();
  function enRecta(s) { for (var i = 0; i < 8 && Math.abs(curva(s)) > .05 / ES; i++) s += 2; return s; }   /* que no caigan en una curva */
  [enRecta(8), enRecta(L - 22)].forEach(function (sb, k) {
    var pi = pos(sb, -1 - 2.9 / (W / 2)), pd = pos(sb, 1 + 2.9 / (W / 2)), hb = 4.6;
    [pi, pd].forEach(function (p) { JBn.pieza(new THREE.CylinderGeometry(.05, .06, hb, 6).translate(p.x, hb / 2, p.z), M.col('#ffffff')); });
    for (var q = 0; q < 16; q++) { var u = (q + .5) / 16, x = pi.x + (pd.x - pi.x) * u, z = pi.z + (pd.z - pi.z) * u, y = hb - .1 - Math.sin(u * Math.PI) * .35;
      var tri = new THREE.ConeGeometry(.11, .24, 3); tri.rotateX(Math.PI); tri.translate(x, y - .12, z); JBn.pieza(tri, M.col(cols[(q + k) % cols.length])); } });
  E.add(new THREE.Mesh(JBn.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, side: THREE.DoubleSide })));

  /* ---------- carteles de curva (flechas rojas y blancas) y flores ---------- */
  var tFI = texFlecha(true), tFD = texFlecha(false), JPo = new M.Junta(), visto = -99;
  for (s = 0; s < L; s += 2) { var cv = curva(s); if (Math.abs(cv) < .07 / ES || s - visto < 22) continue; visto = s;
    for (var r2 = 0; r2 < 3; r2++) { var sc = s + r2 * 1.6, lado = cv > 0 ? 1 : -1, p = pos(sc, lado * (1 + 2.5 / (W / 2))), d = dir(sc);
      var cart = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55), new THREE.MeshBasicMaterial({ map: cv > 0 ? tFI : tFD, side: THREE.DoubleSide }));
      var yc = altoSuelo(p.x, p.z); cart.position.set(p.x, yc + .9, p.z); cart.rotation.y = Math.atan2(d.x, d.z) + Math.PI; E.add(cart);
      JPo.pieza(new THREE.BoxGeometry(.05, .65, .05).translate(p.x, yc + .32, p.z), M.col('#3a3f48')); } }
  if (JPo.base) E.add(new THREE.Mesh(JPo.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true })));
  var JFl = new M.Junta();
  for (k = 0; k < (baja ? 45 : 90); k++) { var sf = rnd() * L, lf = rnd() < .5 ? -1 : 1, pf = pos(sf, lf * (1 + (3 + rnd() * 1.8) / (W / 2))), yf = altoSuelo(pf.x, pf.z);
    for (var q2 = 0; q2 < 5; q2++) { var fl2 = new THREE.SphereGeometry(.07, 6, 5); fl2.translate(pf.x + (rnd() - .5) * .5, yf + .12, pf.z + (rnd() - .5) * .5); JFl.pieza(fl2, M.col(cols[(k + q2) % cols.length])); }
    var mata = new THREE.IcosahedronGeometry(.2, 0); mata.scale(1, .5, 1); mata.translate(pf.x, yf + .05, pf.z); JFl.pieza(mata, M.col('#3f8a3a')); }
  if (!URB) { var mFl = new THREE.Mesh(JFl.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 })); mFl.userData.floresBorde = true; E.add(mFl); }

  /* el minimapa (puntos del trazado) */
  var mini = []; for (i = 0; i < K; i += 10) mini.push([PS[i].x, PS[i].z]);

  /* ---------- 3c: las texturas reales. Se piden ahora y se ponen cuando llegan; si no llegan, queda lo dibujado ---------- */
  /* cambia la imagen de un material y suelta la anterior: la dibujada ya se subió a la tarjeta de video mientras llegaba la foto,
     y si no se suelta queda ocupando memoria en cada pista (si otra la sigue usando, se vuelve a subir sola) */
  function cambiar(m, k, t) { var v = m[k]; m[k] = t; if (v && v !== t && v.isTexture) v.dispose(); }
  var REAL = { pedidas: [], cargadas: 0, fallos: 0, listo: false, asfalto: matA, bordillo: mB, suelo: sueloR.piso.material, muros: murosReal }, vivo = true, propias = [];
  function contar(ok) { if (ok) REAL.cargadas++; else REAL.fallos++; REAL.listo = REAL.cargadas + REAL.fallos === REAL.pedidas.length; }
  function pedir(nombre, ok, mal) { REAL.pedidas.push('tx-' + nombre + '.webp');
    M.texReal(nombre, function (t) { contar(true); if (vivo) ok(t); else M.soltarReal(nombre); }, function () { contar(false); if (vivo && mal) mal(); }); }
  var conRelieve = !baja, NA = baja ? 512 : 1024, asfC = null, asfN = null, asfSinN = !conRelieve;
  function asfaltoListo() { if (!ASF) { if (!asfC || !(asfN || asfSinN)) return; ASF = componerAsfalto(asfC, asfN, NA);
      M.soltarReal('asfalto'); if (asfN) M.soltarReal('asfalto-n'); }   /* ya compuesto: las fotos sueltas no hacen falta */
    cambiar(matA, 'map', ASF.map); if (mundo.id === 'noche') matA.color.setScalar(.6);   /* de noche el asfalto no brilla como de día */
    if (conRelieve && ASF.nor) { matA.normalMap = ASF.nor; matA.normalScale.set(.9, .9); } matA.roughness = .86; matA.needsUpdate = true;
    cambiar(mB, 'map', ASF.bor); if (conRelieve && ASF.nor) { mB.normalMap = ASF.nor; mB.normalScale.set(.5, .5); } mB.needsUpdate = true; }
  if (ASF) asfaltoListo();   /* el asfalto ya se compuso en otra pista: no se baja de nuevo */
  else { pedir('asfalto', function (t) { asfC = t; asfaltoListo(); });
    if (conRelieve) pedir('asfalto-n', function (t) { asfN = t; asfaltoListo(); }, function () { asfSinN = true; asfaltoListo(); }); }
  var tipoS = mundo.suelo, cubre = TX_SUELO[tipoS], pm = sueloR.piso.material;
  var sC = null, sN = null;
  function sueloListo() { if (!sC) return; sC.repeat.set(TAM / cubre, TAM / cubre); cambiar(pm, 'map', sC);
    if (sN) { sN.repeat.set(TAM / cubre, TAM / cubre); pm.normalMap = sN; pm.normalScale.set(.8, .8); } pm.needsUpdate = true; }
  if (cubre) { pedir(tipoS, function (t) { sC = t; sueloListo(); }); if (conRelieve) pedir(tipoS + '-n', function (t) { sN = t; sueloListo(); }); }
  var mC = null, mN = null;
  if (TX_MURO[muroId] && murosReal.length) {
    pedir(muroId, function (t) { murosReal.forEach(function (m) {
      if (muroId === 'adobe' && m.map && m.map.image) {   /* el adobe guarda sus frisos dibujados: se le pone el grano de la foto encima */
        var img = m.map.image, cv = M.lienzo(img.width, img.height), g = cv.getContext('2d'); g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'soft-light'; g.globalAlpha = .85; for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) g.drawImage(t.image, i * img.width / 2, j * img.height / 2, img.width / 2, img.height / 2);
        var tc = M.tex(cv, true, false), mo = m.map; tc.wrapS = mo.wrapS; tc.wrapT = mo.wrapT; tc.repeat.copy(mo.repeat); tc.offset.copy(mo.offset);
        tc.userData.fuente = 'tx-adobe.webp'; propias.push(tc); cambiar(m, 'map', tc);
      } else { t.repeat.set(.5, .5); cambiar(m, 'map', t); mC = t; murosRelieve(); }
      m.needsUpdate = true; }); });
    if (conRelieve && muroId !== 'adobe') pedir(muroId + '-n', function (t) { mN = t; murosRelieve(); }); }
  function murosRelieve() { if (!mC || !mN) return; mN.repeat.set(.5, .5); murosReal.forEach(function (m) { m.normalMap = mN; m.normalScale.set(.6, .6); m.needsUpdate = true; }); }
  function parReal(nombre, lista, sinRelieve) { var cC = null, cN = null;   /* color y relieve juntos (en r128 el relieve usa el repeat del color) */
    function poner() { if (!cC) return; lista.forEach(function (m) { cambiar(m, 'map', cC); if (m.userData.conMapa) m.userData.conMapa(m);   /* el material puede ajustar su color a la foto */ if (cN) { m.normalMap = cN; m.normalScale.set(.7, .7); } m.needsUpdate = true; }); }
    pedir(nombre, function (t) { cC = t; poner(); }); if (conRelieve && !sinRelieve) pedir(nombre + '-n', function (t) { cN = t; poner(); }); }
  var texCiudad = !CIUDAD ? [] : mundo.id === 'desierto' ? ['adobe'] : mundo.id === 'costa' ? ['estuco', 'madera', 'cana'] : ANDES ? ['estuco', 'madera', 'tejas', 'inca'] : mundo.id === 'selva' ? ['madera', 'cana'] : ['estuco', 'madera', 'tejas'];   /* Huanchaco: sin tejas, con caña; Chan Chan: el barro; Los Andes: también la piedra */
  if (CIUDAD) { texCiudad.forEach(function (n) { parReal(n, n === 'estuco' ? [CIUDAD.mats.muro, mVer] : n === 'adobe' ? [CIUDAD.mats.muro] : n === 'inca' ? [CIUDAD.mats.piedra] : n === 'madera' && matTablas ? [CIUDAD.mats.madera, matTablas] : [CIUDAD.mats[n]]); });
    if (mundo.id !== 'desierto') murosReal.push(CIUDAD.mats.muro); }   /* en Chan Chan, los muros reales son las murallas (su barro se mezcla con los frisos dibujados) */
  if (INFO.nevados && conRelieve) pedir('nieve-n', function (t) { var vie = INFO.nevados.material;   /* el repeat lo pone el color (en r128 todos usan el del map) */   /* 3c: los nevados, con el relieve de la nieve */
    var mn = new THREE.MeshStandardMaterial({ vertexColors: true, map: vie.map, normalMap: t, roughness: .8, metalness: 0, fog: false, envMap: M.envCielo ? M.envCielo(mundo) : null, envMapIntensity: .55 });
    mn.normalScale.set(.9, .9); INFO.nevados.material = mn; vie.dispose(); });
  if (!REAL.pedidas.length) REAL.listo = true;   /* nada que bajar (el asfalto ya estaba) */
  /* al cambiar de pista: se suelta lo de esta (el asfalto compuesto queda: lo usan todas) */
  function soltar() { vivo = false; propias.forEach(function (t) { t.dispose(); }); if (CIUDAD && M.ciudad.soltar) M.ciudad.soltar();
    [tipoS, tipoS + '-n', 'nieve-n'].concat(TX_MURO[muroId] ? [muroId, muroId + '-n'] : []).concat(   /* el muro solo si se pidió */texCiudad.reduce(function (a, n) { return a.concat([n, n + '-n']); }, [])).forEach(function (n) { M.soltarReal(n); }); }
  var vSol = new V3();

  var mo = new M4(), q4 = new THREE.Quaternion(), e3 = new V3(), vT = new V3(1, 1, 1), vAl = new V3();
  return {
    L: L, W: W, K: K, pos: pos, dir: dir, curva: curva, mini: mini, semaforo: semaforo, luces: luces, vida: vidaG, real: REAL, soltar: soltar, flora: flora, distPista: lejosDePista, lugares: INFO, ciudad: CIUDAD ? Object.assign(CIUDAD, { catedral: INFO.catedral || null }) : null,
    puente: PUENTE ? { s0: PUENTE.s0, s1: PUENTE.s1 } : null, alto: alto, peralte: peralte, altoSuelo: altoSuelo, relieve: yMax - yMin, salto: { s: sJ, pendiente: HJ / SUBE },
    bordes: { pasto: 1 + .55 / (W / 2), valla: 1 + 2.25 / (W / 2) },   /* en unidades de la pista (1 = el borde del asfalto); la valla está a 2,6 m del borde */
    altoEn: function (s, x) { var q = pos(s, x, vAl), d = Math.abs(x) * W / 2; if (d <= W / 2 + .55) return q.y;
      if (PUENTE) { var sm = ((s % L) + L) % L; if (sm >= PUENTE.s0 && sm <= PUENTE.s1 && d <= W / 2 + 2.85) return alto(sm) + peralte(sm) * x * W / 2 + .07; }   /* sobre el tablero del puente (abajo está el río) */
      var t = M.suave(W / 2 + .55, W / 2 + 1.6, d); return q.y * (1 - t) + (altoSuelo(q.x, q.z) + .03) * t; },
    actualizar: function (dt, t, x, z, cam, y) {
      if (cielo) cielo.actualizar(t, cam || { x: x, z: z }); if (NM_RIO) NM_RIO.offset.set(t * .008, -t * .03);   /* el río corre */
      if (lejos) lejos.actualizar(dt, t);
      var ax = x, az = z, yb = y || 0; if (cam) { var dxs = x - cam.x, dzs = z - cam.z, dls = Math.hypot(dxs, dzs) || 1; ax += dxs / dls * 8; az += dzs / dls * 8; }
      vSol.copy(luces.sol.userData.dir); luces.sol.position.set(ax + vSol.x * 30, yb + vSol.y * 30, az + vSol.z * 30); luces.sol.target.position.set(ax, yb, az);   /* 3c: la sombra cubre lo que viene */
      vidaG.position.set(x, y || 0, z); if (vida) vida(dt, t, cam); if (flora) flora.actualizar(t); if (emblemas) emblemas.actualizar(t);
      /* lo que vuela se hizo para el laberinto y acá sigue al auto: lo que pasa pegado a la cámara se esconde
         (una mariposa a un metro llenaba la pantalla). Solo se esconde y se vuelve a mostrar lo escondido aquí:
         la estrella fugaz maneja su propio «visible». */
      if (cam) for (var j = 0; j < vidaG.children.length; j++) { var vo = vidaG.children[j]; if (!(vo.isSprite || vo.isMesh)) continue;
        var gp = vo.geometry && vo.geometry.parameters, tam = vo.isSprite ? Math.max(vo.scale.x, vo.scale.y) : ((gp && gp.width) || 2);   /* los rayos de luz: altos y angostos, cuenta su ancho */
        var dx = x + vo.position.x - cam.x, dy = vo.isSprite ? (y || 0) + vo.position.y - cam.y : 0, dz = z + vo.position.z - cam.z, lim = 3.4 + tam * .6, cerca = dx * dx + dy * dy + dz * dz < lim * lim;
        if (cerca) { if (vo.visible) { vo.visible = false; vo.userData.ocultoCam = true; } } else if (vo.userData.ocultoCam) { vo.visible = true; vo.userData.ocultoCam = false; } }
      if (imPer) { for (var j = 0; j < GENTE_N; j++) { var u = gente[j], salto = Math.max(0, Math.sin(t * 6 + u.f)) * .12;
        e3.set(u.p.x, u.p.y + salto, u.p.z); mo.compose(e3, q4, vT); imPer.setMatrixAt(j, mo); } imPer.instanceMatrix.needsUpdate = true; }
      banderas.forEach(function (b, j) { b.rotation.y = Math.sin(t * 2 + j) * .35; });
      globos.forEach(function (g, j) { g.position.y = Math.sin(t * 1.3 + j) * .12; g.rotation.y = Math.sin(t * .7 + j) * .2; });
    }
  };
};
})();

;
/* Ruway — LOS MUNDOS: los sonidos de ambiente de cada lugar.
   Todo se hace en el teléfono con Web Audio (ruido filtrado y osciladores): no se baja ningún archivo y
   no hay grabaciones con dueño. Cada mundo tiene "capas" que suenan siempre (viento, mar, insectos) y
   "eventos" que aparecen de vez en cuando (una quena a lo lejos, gaviotas, campanas, grillos, aves).

     Los Andes ...... viento que sube y baja, una quena lejana con eco del valle, pajaritos
     Huanchaco ...... olas que revientan y se retiran, espuma, gaviotas, brisa
     Chan Chan ...... viento seco con ráfagas, arena que silba, el mar muy lejos
     Trujillo ....... la pileta de la plaza, palomas, gorriones y las campanas de la catedral
     La noche ....... grillos, ranas, un búho, brisa suave
     La Amazonía .... insectos, aves, guacamayos, gotas que caen de las hojas

   Uso: var a = Mundos.ambiente(idMundo, contextoDeAudio); a.iniciar(); a.volumen(0..1); a.parar(seg).
   Los eventos se programan por adelantado con la hora del contexto (no con setTimeout): así también
   suenan en un OfflineAudioContext (las pruebas miden el volumen sin parlantes) con a.programar(hasta). */
(function () {
'use strict';
var M = window.Mundos = window.Mundos || {};

/* ---------- ruido (blanco, rosa o marrón), 4 segundos que se repiten sin clic ---------- */
var CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;
function ruido(ac, tipo) {
  var k = (CACHE && CACHE.get(ac)) || {};
  if (k[tipo]) return k[tipo];
  var sr = ac.sampleRate, n = sr * 4 | 0, b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), az = M.azar(91 + tipo.length * 7);
  var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ult = 0, i;
  for (i = 0; i < n; i++) {
    var w = az() * 2 - 1;
    if (tipo === 'blanco') d[i] = w * .5;
    else if (tipo === 'rosa') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
    else { ult = (ult + .02 * w) / 1.02; d[i] = ult * 3.5; }
  }
  /* el principio se mezcla con el final: al volver a empezar no hay salto */
  var f = sr * .05 | 0;
  for (i = 0; i < f; i++) { var a = i / f; d[i] = d[i] * a + d[n - f + i] * (1 - a); }
  b._fin = (n - f) / sr;
  k[tipo] = b; if (CACHE) CACHE.set(ac, k);
  return b;
}

/* ---------- piezas ---------- */
function fuente(ac, tipo, t0, viven) { var s = ac.createBufferSource(); s.buffer = ruido(ac, tipo); s.loop = true; s.loopEnd = s.buffer._fin; s.start(t0, Math.random() * 3); if (viven) viven.push(s); return s; }
function suelta(ac, tipo, t0, dur) { var s = ac.createBufferSource(); s.buffer = ruido(ac, tipo); s.loop = true; s.loopEnd = s.buffer._fin; s.start(t0, Math.random() * 3); s.stop(t0 + dur + .05); return s; }
function filtro(ac, tipo, f, q) { var b = ac.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q == null ? .7 : q; return b; }
function ganancia(ac, v) { var g = ac.createGain(); g.gain.value = v; return g; }
function lfo(ac, f, prof, param, t0, viven, forma) {
  var o = ac.createOscillator(); o.type = forma || 'sine'; o.frequency.value = f;
  var g = ganancia(ac, prof); o.connect(g); g.connect(param); o.start(t0); if (viven) viven.push(o); return o;
}
function paneo(ac, x) { if (!ac.createStereoPanner) return ganancia(ac, 1); var p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x)); return p; }
function cadena(nodos) { for (var i = 0; i < nodos.length - 1; i++) nodos[i].connect(nodos[i + 1]); return nodos[nodos.length - 1]; }
/* una capa continua de ruido filtrado, con vaivén lento de tono y de volumen */
function capa(ac, sal, t0, viven, o) {
  var s = fuente(ac, o.ruido || 'rosa', t0, viven), f = filtro(ac, o.filtro || 'bandpass', o.f, o.q), g = ganancia(ac, o.vol);
  cadena([s, f, g]);
  if (o.pan != null) g.connect(cadena([paneo(ac, o.pan), sal])); else g.connect(sal);
  if (o.fLfo) lfo(ac, o.fLfo[0], o.fLfo[1], f.frequency, t0, viven);
  if (o.vLfo) lfo(ac, o.vLfo[0], o.vLfo[1], g.gain, t0, viven);
  if (o.vLfo2) lfo(ac, o.vLfo2[0], o.vLfo2[1], g.gain, t0, viven);
  return { s: s, f: f, g: g };
}
/* un tono corto que se desliza (pío, gaviota, gota) */
function tono(ac, sal, t, o) {
  var os = ac.createOscillator(); os.type = o.forma || 'sine';
  os.frequency.setValueAtTime(o.f0, t);
  if (o.fm) { os.frequency.exponentialRampToValueAtTime(o.fm, t + o.dur * (o.tm || .3)); }
  os.frequency.exponentialRampToValueAtTime(o.f1 || o.f0, t + o.dur);
  var g = ac.createGain(), at = o.at || .008;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vol, t + at);
  g.gain.setValueAtTime(o.vol, t + Math.max(at, o.dur - (o.rel || .03)));
  g.gain.exponentialRampToValueAtTime(.0001, t + o.dur + .02);
  var nodos = [os];
  if (o.bp) nodos.push(filtro(ac, 'bandpass', o.bp, o.bq || 3));
  if (o.lp) nodos.push(filtro(ac, 'lowpass', o.lp, .7));
  nodos.push(g); if (o.pan != null) nodos.push(paneo(ac, o.pan)); nodos.push(sal);
  cadena(nodos);
  if (o.trem) lfo(ac, o.trem[0], o.trem[1], g.gain, t).stop(t + o.dur + .05);
  os.start(t); os.stop(t + o.dur + .05);
}
/* un pajarito: de 3 a 7 píos rápidos */
function ave(ac, sal, t, az, o) {
  var n = 3 + (az() * 5 | 0), base = o.base * (.85 + az() * .3), pan = az() * 1.6 - .8, sube = az() < .5;
  for (var i = 0; i < n; i++) {
    var d = .045 + az() * .07, f0 = base * (.9 + az() * .25);
    tono(ac, sal, t, { f0: sube ? f0 * .8 : f0 * 1.25, f1: sube ? f0 * 1.3 : f0 * .75, dur: d, vol: o.vol * (.6 + az() * .4), pan: pan, rel: .02 });
    t += d + .03 + az() * (o.pausa || .09);
  }
}

/* ---------- los seis lugares ---------- */
var PENTA = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];   /* sol, la, do, re, mi, sol, la: la escala de cinco notas de los Andes */
var LUGARES = {
  sierra: {
    nivel: 1,
    capas: function (ac, sal, t0, v) {
      capa(ac, sal, t0, v, { ruido: 'rosa', f: 520, q: .55, vol: .3, fLfo: [.06, 300], vLfo: [.043, .14], vLfo2: [.011, .08] });
      capa(ac, sal, t0, v, { ruido: 'blanco', f: 1900, q: 1.1, vol: .035, fLfo: [.09, 650], vLfo: [.071, .028], pan: .25 });
    },
    preparar: function (ac, sal, est) {   /* el eco del valle para la quena */
      var eco = ac.createDelay(1.5), fb = ganancia(ac, .32), lp = filtro(ac, 'lowpass', 1900, .5), vuelta = ganancia(ac, .55);
      eco.delayTime.value = .46; cadena([eco, lp, fb, eco]); lp.connect(vuelta); vuelta.connect(sal); est.eco = eco;
    },
    eventos: [
      { cada: [26, 48], primero: [5, 9], fn: function (ac, sal, t, az, est) {   /* la quena lejana */
        var n = 4 + (az() * 3 | 0), k = 2 + (az() * 4 | 0), dir = sal; var g = ganancia(ac, 1), p = paneo(ac, .35 - az() * .7);
        cadena([g, p, dir]); if (est.eco) g.connect(est.eco);
        for (var i = 0; i < n; i++) {
          k = Math.max(0, Math.min(PENTA.length - 1, k + (az() < .62 ? -1 : 1) * (1 + (az() < .25 ? 1 : 0))));
          var f = PENTA[k], d = i === n - 1 ? 1.1 + az() * .5 : .32 + az() * .45;
          var o = ac.createOscillator(), o2 = ac.createOscillator(), e = ac.createGain();
          o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f;
          var g2 = ganancia(ac, .18); o2.connect(g2); g2.connect(e); o.connect(e);
          var vb = ac.createOscillator(), vg = ganancia(ac, 0); vb.frequency.value = 5.2; vb.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
          vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .009, t + Math.min(.3, d * .7));
          e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.05, t + .07); e.gain.setValueAtTime(.05, t + d - .1); e.gain.linearRampToValueAtTime(0, t + d + .04);
          e.connect(g);
          var so = suelta(ac, 'blanco', t, d), bf = filtro(ac, 'bandpass', f * 2.1, 4), bg = ganancia(ac, 0);   /* el soplido */
          bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(.03, t + .04); bg.gain.linearRampToValueAtTime(.008, t + .2); bg.gain.linearRampToValueAtTime(0, t + d);
          cadena([so, bf, bg, g]);
          [o, o2, vb].forEach(function (x) { x.start(t); x.stop(t + d + .1); });
          t += d + .04 + (az() < .2 ? .25 : 0);
        }
      } },
      { cada: [8, 17], primero: [2, 5], fn: function (ac, sal, t, az) { ave(ac, sal, t, az, { base: 3600, vol: .022 }); } }
    ]
  },
  costa: {
    nivel: 0.85,
    capas: function (ac, sal, t0, v) {
      capa(ac, sal, t0, v, { ruido: 'marron', filtro: 'lowpass', f: 320, vol: .22, vLfo: [.09, .07] });         /* el mar de fondo */
      capa(ac, sal, t0, v, { ruido: 'rosa', f: 900, q: .6, vol: .05, fLfo: [.05, 300], vLfo: [.04, .03] });     /* brisa */
    },
    eventos: [
      { cada: [6.2, 9.4], primero: [.3, 1.5], fn: function (ac, sal, t, az) {   /* una ola */
        var pan = az() * .8 - .4, sube = 1.8 + az() * 1.2, baja = 3.8 + az() * 2.5, fuerte = .35 + az() * .25, dur = sube + baja;
        var s = suelta(ac, 'marron', t, dur), lp = filtro(ac, 'lowpass', 500, .6), g = ganancia(ac, 0);
        lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1300, t + sube); lp.frequency.exponentialRampToValueAtTime(420, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(fuerte, t + sube); g.gain.setTargetAtTime(0, t + sube, baja / 3.2);
        cadena([s, lp, g, paneo(ac, pan), sal]);
        var e = suelta(ac, 'blanco', t + sube * .8, baja), hp = filtro(ac, 'highpass', 2400, .5), ge = ganancia(ac, 0);   /* la espuma */
        ge.gain.setValueAtTime(0, t + sube * .8); ge.gain.linearRampToValueAtTime(.07 * fuerte / .45, t + sube + .2); ge.gain.setTargetAtTime(0, t + sube + .3, baja / 3.5);
        cadena([e, hp, ge, paneo(ac, pan * 1.4), sal]);
      } },
      { cada: [11, 21], primero: [4, 8], fn: function (ac, sal, t, az) {   /* gaviotas */
        var n = 2 + (az() * 3 | 0), pan = az() * 1.6 - .8;
        for (var i = 0; i < n; i++) { var d = .28 + az() * .22; tono(ac, sal, t, { forma: 'sawtooth', f0: 1350 + az() * 200, fm: 2050 + az() * 250, tm: .2, f1: 1100, dur: d, vol: .016, bp: 1700, bq: 3.5, pan: pan }); t += d + .08 + az() * .2; }
      } }
    ]
  },
  desierto: {
    nivel: 1.2,
    capas: function (ac, sal, t0, v) {
      capa(ac, sal, t0, v, { ruido: 'rosa', f: 720, q: .75, vol: .24, fLfo: [.05, 420], vLfo: [.031, .13], vLfo2: [.08, .05] });
      capa(ac, sal, t0, v, { ruido: 'blanco', f: 4600, q: .9, vol: .018, vLfo: [.085, .014], pan: -.3 });      /* la arena que silba */
      capa(ac, sal, t0, v, { ruido: 'marron', filtro: 'lowpass', f: 240, vol: .07 });                            /* el mar, muy lejos */
    },
    eventos: [
      { cada: [11, 21], primero: [3, 7], fn: function (ac, sal, t, az) {   /* una ráfaga */
        var d = 2.6 + az() * 1.6, s = suelta(ac, 'rosa', t, d), f = filtro(ac, 'bandpass', 400, .9), g = ganancia(ac, 0);
        f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(1500 + az() * 600, t + d * .45); f.frequency.linearRampToValueAtTime(450, t + d);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + d * .4); g.gain.linearRampToValueAtTime(0, t + d);
        cadena([s, f, g, paneo(ac, az() * 1.4 - .7), sal]);
      } },
      { cada: [16, 30], primero: [8, 14], fn: function (ac, sal, t, az) {   /* un ave del arenal: dos silbos que bajan */
        var pan = az() * 1.2 - .6;
        for (var i = 0; i < 2; i++) { tono(ac, sal, t, { f0: 2500 + az() * 200, f1: 1750, dur: .26, vol: .02, pan: pan, at: .02 }); t += .38; }
      } }
    ]
  },
  ciudad: {
    nivel: 1.3,
    capas: function (ac, sal, t0, v) {
      var p = capa(ac, sal, t0, v, { ruido: 'blanco', f: 1250, q: .5, vol: .06, pan: .15 });                     /* la pileta */
      lfo(ac, 3.1, .012, p.g.gain, t0, v); lfo(ac, 4.7, .01, p.g.gain, t0, v); lfo(ac, .7, 160, p.f.frequency, t0, v);
      capa(ac, sal, t0, v, { ruido: 'blanco', filtro: 'highpass', f: 3200, vol: .016, pan: .15 });
      capa(ac, sal, t0, v, { ruido: 'marron', filtro: 'lowpass', f: 420, vol: .09, vLfo: [.05, .025] });        /* la ciudad, lejos */
    },
    eventos: [
      { cada: [8, 16], primero: [3, 6], fn: function (ac, sal, t, az) {   /* palomas */
        var pan = az() * 1.4 - .7;
        tono(ac, sal, t, { f0: 430, f1: 390, dur: .38, vol: .028, lp: 900, trem: [17, .016], pan: pan, at: .04 });
        tono(ac, sal, t + .48, { f0: 445, fm: 470, f1: 360, dur: .62, vol: .03, lp: 900, trem: [16, .018], pan: pan, at: .05 });
      } },
      { cada: [5, 11], primero: [1, 3], fn: function (ac, sal, t, az) { ave(ac, sal, t, az, { base: 4800, vol: .013, pausa: .05 }); } },   /* gorriones */
      { cada: [48, 80], primero: [14, 22], fn: function (ac, sal, t, az) {   /* las campanas de la catedral */
        var n = 3 + (az() * 3 | 0), base = 311, PAR = [[.5, .5, 7], [1, 1, 5.5], [1.19, .45, 4], [1.5, .35, 3.5], [2, .3, 3], [2.74, .12, 2], [3.01, .1, 1.6]];
        var lp = filtro(ac, 'lowpass', 2600, .5), pg = paneo(ac, .45); cadena([lp, pg, sal]);
        for (var i = 0; i < n; i++) {
          PAR.forEach(function (p) { var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = base * p[0] * (1 + (az() - .5) * .002);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.034 * p[1], t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + p[2]);
            o.connect(g); g.connect(lp); o.start(t); o.stop(t + p[2] + .05); });
          t += 1.55;
        }
      } }
    ]
  },
  noche: {
    nivel: 2,
    capas: function (ac, sal, t0, v) {
      capa(ac, sal, t0, v, { ruido: 'rosa', f: 360, q: .6, vol: .1, fLfo: [.04, 140], vLfo: [.03, .05] });
    },
    preparar: function (ac, sal, est, t0, v) {   /* tres grillos: un tono fijo que se prende y se apaga */
      est.grillos = [[4350, -.6, .9], [4720, .5, 1.13], [3980, .1, 1.37]].map(function (c) {
        var o = ac.createOscillator(), g = ganancia(ac, 0); o.frequency.value = c[0]; cadena([o, g, paneo(ac, c[1]), sal]); o.start(t0); v.push(o);
        return { g: g, cada: c[2] };
      });
    },
    eventos: [
      { cada: [.85, 1.15], primero: [.2, .6], fn: function (ac, sal, t, az, est) {
        (est.grillos || []).forEach(function (gr, j) { if (az() < .18) return; var tt = t + j * .21 + az() * .1, n = 3 + (az() < .4 ? 1 : 0);
          for (var i = 0; i < n; i++) { gr.g.gain.setValueAtTime(0, tt); gr.g.gain.linearRampToValueAtTime(.012, tt + .004); gr.g.gain.setValueAtTime(.012, tt + .024); gr.g.gain.linearRampToValueAtTime(0, tt + .03); tt += .048; } });
      } },
      { cada: [9, 18], primero: [3, 6], fn: function (ac, sal, t, az) {   /* ranas */
        var n = 2 + (az() * 3 | 0), pan = az() * 1.6 - .8;
        for (var i = 0; i < n; i++) { tono(ac, sal, t, { forma: 'sawtooth', f0: 125 + az() * 30, f1: 110, dur: .2, vol: .03, bp: 520, bq: 2, trem: [27, .026], pan: pan, at: .02 }); t += .32 + az() * .15; }
      } },
      { cada: [24, 44], primero: [10, 16], fn: function (ac, sal, t, az) {   /* un búho */
        var pan = az() * 1.2 - .6;
        tono(ac, sal, t, { f0: 370, f1: 345, dur: .26, vol: .03, lp: 700, pan: pan, at: .05, rel: .1 });
        tono(ac, sal, t + .42, { f0: 380, fm: 392, f1: 330, dur: .55, vol: .034, lp: 700, pan: pan, at: .06, rel: .2 });
      } }
    ]
  },
  selva: {
    nivel: 1.8,
    capas: function (ac, sal, t0, v) {
      var ins = capa(ac, sal, t0, v, { ruido: 'blanco', f: 5200, q: 6, vol: .05, vLfo: [.05, .02], pan: -.2 });   /* insectos */
      lfo(ac, 38, .03, ins.g.gain, t0, v, 'square');
      var ins2 = capa(ac, sal, t0, v, { ruido: 'blanco', f: 6800, q: 9, vol: .03, vLfo: [.037, .02], pan: .4 });
      lfo(ac, 51, .02, ins2.g.gain, t0, v, 'square');
      capa(ac, sal, t0, v, { ruido: 'rosa', filtro: 'lowpass', f: 850, vol: .08, vLfo: [.06, .02] });            /* el aire húmedo del monte */
    },
    eventos: [
      { cada: [2.5, 6], primero: [.5, 2], fn: function (ac, sal, t, az) { ave(ac, sal, t, az, { base: 2200 + az() * 2200, vol: .02 }); } },
      { cada: [1.2, 3.6], primero: [.3, 1], fn: function (ac, sal, t, az) { tono(ac, sal, t, { f0: 850 + az() * 300, f1: 1700 + az() * 500, dur: .045, vol: .012, pan: az() * 1.8 - .9 }); } },   /* gotas */
      { cada: [16, 32], primero: [6, 11], fn: function (ac, sal, t, az) {   /* un guacamayo */
        var n = 1 + (az() * 2 | 0), pan = az() * 1.4 - .7;
        for (var i = 0; i < n; i++) { tono(ac, sal, t, { forma: 'sawtooth', f0: 820, fm: 1350, tm: .25, f1: 760, dur: .34, vol: .02, bp: 1400, bq: 2.5, trem: [55, .008], pan: pan }); t += .5 + az() * .3; }
      } },
      { cada: [12, 22], primero: [4, 8], fn: function (ac, sal, t, az) {   /* una ranita: co-quí */
        var pan = az() * 1.4 - .7; tono(ac, sal, t, { f0: 1150, dur: .07, vol: .016, pan: pan }); tono(ac, sal, t + .11, { f0: 1900, f1: 2150, dur: .11, vol: .016, pan: pan });
      } }
    ]
  }
};
M.AMBIENTES = Object.keys(LUGARES);

M.ambiente = function (id, ac, op) {
  op = op || {};
  var L = LUGARES[id] || LUGARES.sierra, az = M.azar(op.semilla || (Date.now() & 0xffff) + 13), est = {}, viven = [], prog = [], reloj = null, vivo = false;
  var maestro = ganancia(ac, 0), sal = ganancia(ac, L.nivel || 1), contados = 0;   /* nivel: todos los lugares suenan parejo */
  sal.connect(maestro); maestro.connect(op.destino || ac.destination);
  function entre(r) { return r[0] + az() * (r[1] - r[0]); }
  var A = {
    id: LUGARES[id] ? id : 'sierra',
    iniciar: function (vol) {
      if (vivo) return A; vivo = true;
      var t0 = ac.currentTime + .05;
      L.capas(ac, sal, t0, viven);
      if (L.preparar) L.preparar(ac, sal, est, t0, viven);
      prog = L.eventos.map(function (e) { return { e: e, sig: t0 + entre(e.primero) }; });
      maestro.gain.setValueAtTime(0, t0); maestro.gain.linearRampToValueAtTime(vol == null ? 1 : vol, t0 + 2.5);
      A.programar(t0 + 1.5);
      if (!op.offline) reloj = setInterval(function () { A.programar(ac.currentTime + 1.5); }, 500);
      return A;
    },
    /* deja listo todo lo que tiene que sonar hasta "hasta" (segundos del contexto) */
    programar: function (hasta) {
      if (!vivo) return;
      var ahora = ac.currentTime;
      prog.forEach(function (p) {
        if (p.sig < ahora - .5) p.sig = ahora + entre(p.e.cada) * .5;   /* volvió de una pausa: no se dispara todo junto */
        while (p.sig < hasta) { try { p.e.fn(ac, sal, Math.max(p.sig, ahora), az, est); contados++; } catch (e) {} p.sig += entre(p.e.cada); }
      });
    },
    volumen: function (v, seg) { var t = ac.currentTime; maestro.gain.cancelScheduledValues(t); maestro.gain.setValueAtTime(maestro.gain.value, t); maestro.gain.linearRampToValueAtTime(Math.max(0, v), t + (seg == null ? .6 : seg)); },
    parar: function (seg) {
      if (!vivo) return; vivo = false; clearInterval(reloj); seg = seg == null ? 1.2 : seg;
      A.volumen(0, seg);
      setTimeout(function () { viven.forEach(function (x) { try { x.stop(); } catch (e) {} }); viven = []; try { maestro.disconnect(); } catch (e) {} }, seg * 1000 + 200);
    },
    estado: function () { return { mundo: A.id, vivo: vivo, capas: viven.length, eventos: contados, vol: +maestro.gain.value.toFixed(3) }; }
  };
  return A;
};
})();
