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
  var t = new THREE.CanvasTexture(c); if (srgb !== false) t.encoding = THREE.sRGBEncoding;
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
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = mundo.luz.exp || 1;
  R.shadowMap.enabled = M.calidad() === 'alta'; R.shadowMap.type = THREE.PCFSoftShadowMap;
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

/* M.suelo(E, mundo, {cx, cz, r (radio de lo sembrado), libre(x,z) → true si se puede sembrar ahí}) */
M.suelo = function (E, mundo, o) {
  var tipo = mundo.suelo, tx = texPiso(tipo); tx.repeat.set(30, 30);
  var G = new THREE.PlaneGeometry(140, 140, 48, 48); G.rotateX(-Math.PI / 2);
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
      m4.position.set(x, 0, z); m4.rotation.set(0, r() * 6.283, 0); m4.scale.setScalar(.7 + r() * .7); m4.updateMatrix(); im.setMatrixAt(puestos++, m4.matrix);
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
     catedral .... casonas de colores alrededor, la catedral amarilla, palmeras y faroles
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
  var S = o.seg || 150, T = o.tam || 170, G = new THREE.PlaneGeometry(T, T, S, S); G.rotateX(-Math.PI / 2);
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
    return h * m - .02;
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
  var malla = new THREE.Mesh(G, mat); malla.position.set(o.cx, 0, o.cz); malla.receiveShadow = true; E.add(malla);
  return { alto: function (x, z) { return alto(x - o.cx, z - o.cz); } };
};

var LEJOS = {};

LEJOS.nevados = function (E, mundo, o) {
  var R = Math.max(o.medioX, o.medioZ);
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: R + 3, r1: R + 24, amp: 42, nieve: 13, sem: 101, hazeExtra: -16,
    andenes: { ang: -Math.PI / 2, paso: .55, hMax: 9 },
    colores: { bajo: M.col('#6f8a3a'), medio: M.col('#8d8a55'), roca: M.col('#6c6457'), nieve: M.col('#f4f7fb') } });
  /* los muros de piedra de los andenes se pintan solos (roca en lo empinado de cada escalón) */
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
  var rnd = M.azar(151), orilla = o.cz - o.medioZ - 3.2;                  /* la orilla: un poco más allá del borde de atrás del laberinto */
  var nm = texOlas(); nm.repeat.set(18, 8);
  var mar = new THREE.Mesh(new THREE.PlaneGeometry(220, 110), new THREE.MeshStandardMaterial({ color: '#2b6d8a', roughness: .22, metalness: .05, normalMap: nm, normalScale: new THREE.Vector2(.55, .55) }));
  mar.rotation.x = -Math.PI / 2; mar.position.set(o.cx, .03, orilla - 55); E.add(mar);
  /* la arena mojada y la espuma de la orilla */
  var espuma = M.lienzo(256, 32), ge = espuma.getContext('2d');
  for (var i = 0; i < 900; i++) { ge.fillStyle = 'rgba(255,255,255,' + (.2 + rnd() * .6) + ')'; ge.beginPath(); ge.arc(rnd() * 256, 10 + Math.pow(rnd(), 2) * 22, .8 + rnd() * 2.2, 0, 6.283); ge.fill(); }
  var te = M.tex(espuma, false, true); te.repeat.set(30, 1);
  var franja = new THREE.Mesh(new THREE.PlaneGeometry(220, 1.4), new THREE.MeshBasicMaterial({ map: te, transparent: true, depthWrite: false, opacity: .85 }));
  franja.rotation.x = -Math.PI / 2; franja.position.set(o.cx, .045, orilla + .3); E.add(franja);
  var mojada = new THREE.Mesh(new THREE.PlaneGeometry(220, 3), new THREE.MeshStandardMaterial({ color: '#b39468', roughness: .35, transparent: true, opacity: .55 }));
  mojada.rotation.x = -Math.PI / 2; mojada.position.set(o.cx, .02, orilla + 1.4); E.add(mojada);
  /* el muelle de Huanchaco: largo, sobre pilotes, con sus faroles */
  var J = new M.Junta(), mx = o.cx + 9;
  J.caja(1.6, .12, 46, mx, 1.1, orilla - 23, M.col('#8a7a66'), null, 2);
  for (var z = 0; z < 46; z += 2.2) { J.caja(.12, 1.6, .12, mx - .7, .3, orilla - z, M.col('#5e5244'), null, 2); J.caja(.12, 1.6, .12, mx + .7, .3, orilla - z, M.col('#5e5244'), null, 2); }
  for (z = 0; z < 46; z += 1.15) { J.caja(.05, .32, .05, mx - .78, 1.32, orilla - z, M.col('#d8d2c8'), null, 2); J.caja(.05, .32, .05, mx + .78, 1.32, orilla - z, M.col('#d8d2c8'), null, 2); }
  J.caja(.05, .05, 46, mx - .78, 1.46, orilla - 23, M.col('#e8e2d8'), null, 2); J.caja(.05, .05, 46, mx + .78, 1.46, orilla - 23, M.col('#e8e2d8'), null, 2);
  malla(J, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(27, .3), roughness: .9 }), E);
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
  malla(JC, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.tex(tt, true, true), roughness: .9 }), E);
  /* cerros pálidos detrás de la playa */
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: Math.max(o.medioX, o.medioZ) + 6, r1: 40, amp: 16, sem: 151, hazeExtra: 0, solo: function (x, z) { return M.suave(3, 11, z); },
    colores: { bajo: M.col('#c9a77e'), medio: M.col('#b48e66'), roca: M.col('#9a7756') } });
  return { actualizar: function (dt, t) { nm.offset.set(t * .012, t * .02); te.offset.x = t * .01; franja.material.opacity = .6 + Math.sin(t * .9) * .25; franja.position.z = orilla + .3 + Math.sin(t * .9) * .25; } };
};

LEJOS.dunas = function (E, mundo, o) {
  var rnd = M.azar(171), R = Math.max(o.medioX, o.medioZ);
  M.terreno(E, mundo, { cx: o.cx, cz: o.cz, r0: R + 3, r1: R + 30, amp: 14, sem: 171, hazeExtra: 0,
    colores: { bajo: M.col('#d6b48a'), medio: M.col('#e8cfa6'), roca: M.col('#b9926a') } });
  /* algarrobos: tronco torcido y copa ancha y plana */
  var JT = new M.Junta(), k;
  for (k = 0; k < 9; k++) {
    var a = rnd() * 6.283, dd = 11 + rnd() * 8, x = o.cx + Math.cos(a) * dd, z = o.cz + Math.sin(a) * dd, h = 1.4 + rnd() * .8;
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
    for (var u = -largo / 2; u < largo / 2; u += 2.4) {
      if (si === 0 && Math.abs(u) < 5.5) continue;                       /* al norte, el hueco de la catedral */
      var x = o.cx + (s[0] ? s[0] * (o.medioX + 6) : u + 1.2), z = o.cz + (s[1] ? s[1] * (o.medioZ + 6) : u + 1.2);
      lista.push({ x: x, z: z, giro: s[0] ? -s[0] * Math.PI / 2 : (s[1] > 0 ? Math.PI : 0), v: rnd() * W.variantes.length | 0, alto: 2.3 + rnd() * .9 });
    }
  });
  var porVar = {};
  lista.forEach(function (c) { (porVar[c.v] = porVar[c.v] || []).push(c); });
  Object.keys(porVar).forEach(function (v) {
    W.variantes[v].forEach(function (parte) {
      var im = new THREE.InstancedMesh(parte.geo, parte.mat, porVar[v].length);
      porVar[v].forEach(function (c, i) { m4.position.set(c.x, 0, c.z); m4.rotation.set(0, c.giro, 0); m4.scale.set(2.4, c.alto, 3); m4.updateMatrix(); im.setMatrixAt(i, m4.matrix); });
      im.receiveShadow = true; E.add(im);
    });
  });
  /* la catedral: amarilla con blanco, dos torres campanario y la cúpula */
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
  malla(J, new THREE.MeshStandardMaterial({ vertexColors: true, map: M.texGrano(29, .14), roughness: .9 }), E);
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
    var a2 = rnd() * 6.283, d2 = 19 + rnd() * 12, x2 = o.cx + Math.cos(a2) * d2, z2 = o.cz + Math.sin(a2) * d2, r2 = 2.2 + rnd() * 2.6, y2 = 3 + rnd() * 6;
    var b2 = new THREE.IcosahedronGeometry(r2, 1); b2.scale(1, .8, 1); b2.translate(x2, y2, z2);
    JF.pieza(b2, hz(M.mezclaCol(M.col('#24461f'), M.col('#4f7f3a'), rnd()), Math.hypot(x2 - o.cx, z2 - o.cz), .45));
    var tr2 = new THREE.CylinderGeometry(.25, .4, y2, 6); tr2.translate(x2, y2 / 2, z2); JF.pieza(tr2, hz(M.col('#4a3c2c'), d2, .45));
  }
  malla(JF, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false }), E);
};

/* M.lejos(E, mundo, {cx, cz, medioX, medioZ}) → { actualizar(dt, t) } */
M.lejos = function (E, mundo, o) { var r = LEJOS[mundo.lejos](E, mundo, o); return r && r.actualizar ? r : { actualizar: function () {} }; };
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
function texLetrero(txt, fondo, letra) {
  var c = lienzo(512, 96, function (g, w, h) {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 32; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(i * 16, 0, 16, 10); g.fillRect(i * 16 + 8, h - 10, 16, 10); }
    g.fillStyle = letra; g.font = '900 52px Nunito, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2);
  });
  return M.tex(c, true, false);
}
function texFlecha(izq) { var c = lienzo(64, 32, function (g, w, h) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e23b3b';
  for (var k = 0; k < 3; k++) { var x = 6 + k * 19; g.beginPath(); if (izq) { g.moveTo(x + 14, 3); g.lineTo(x, 16); g.lineTo(x + 14, 29); g.lineTo(x + 19, 29); g.lineTo(x + 6, 16); g.lineTo(x + 19, 3); }
    else { g.moveTo(x, 3); g.lineTo(x + 14, 16); g.lineTo(x, 29); g.lineTo(x + 5, 29); g.lineTo(x + 19, 16); g.lineTo(x + 5, 3); } g.closePath(); g.fill(); } }); return M.tex(c, true, false); }
function texBandera() { var c = lienzo(48, 32, function (g) { g.fillStyle = '#d91023'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#ffffff'; g.fillRect(16, 0, 16, 32); g.fillStyle = '#d91023'; g.fillRect(32, 0, 16, 32); }); return M.tex(c, true, false); }

M.pista = function (E, mundo, o) {
  o = o || {};
  var baja = M.calidad() === 'baja', W = 4.6, rnd = M.azar(mundo.id.length * 77 + 5), gi = GIRO[mundo.id] || [0, 1];
  var ca = Math.cos(gi[0]), sa = Math.sin(gi[0]);
  var curvaT = new THREE.CatmullRomCurve3(TRAZO.map(function (p) { var x = p[0] * gi[1], z = p[1]; return new V3(x * ca - z * sa, 0, x * sa + z * ca); }), true, 'centripetal');
  var K = 900, PS = curvaT.getSpacedPoints(K), L = curvaT.getLength(), ds = L / K;
  var T = [], R = [], CU = [];
  for (var i = 0; i < K; i++) { var t = PS[(i + 1) % K].clone().sub(PS[i]).normalize(); T.push(t); R.push(new V3(-t.z, 0, t.x)); }
  for (i = 0; i < K; i++) { var a = T[i], b = T[(i + 1) % K]; CU.push(-(a.x * b.z - a.z * b.x) / ds); }   /* > 0: dobla a la izquierda */
  /* curvatura suavizada (para la física y para saber dónde hay curva) */
  var CS = CU.map(function (v, i) { var s = 0; for (var k = -12; k <= 12; k++) s += CU[(i + k + K) % K]; return s / 25; });
  function ix(s) { var u = ((s % L) + L) % L / ds, i = Math.floor(u); return [i % K, (i + 1) % K, u - i]; }
  function pos(s, x, v) { var q = ix(s), A = PS[q[0]], B = PS[q[1]], r = R[q[0]]; v = v || new V3();
    v.set(A.x + (B.x - A.x) * q[2] + r.x * x * W / 2, 0, A.z + (B.z - A.z) * q[2] + r.z * x * W / 2); return v; }
  function dir(s, v) { var q = ix(s); return (v || new V3()).copy(T[q[0]]).lerp(T[q[1]], q[2]).normalize(); }
  function curva(s) { var q = ix(s); return CS[q[0]] + (CS[q[1]] - CS[q[0]]) * q[2]; }
  /* ¿qué tan lejos está un punto de la pista? (para no sembrar encima) */
  function lejosDePista(x, z) { var m = 1e9; for (var i = 0; i < K; i += 3) { var dx = PS[i].x - x, dz = PS[i].z - z, d = dx * dx + dz * dz; if (d < m) m = d; } return Math.sqrt(m); }

  /* ---------- el mundo alrededor ---------- */
  var cielo = M.cielo(E, mundo), luces = M.luces(E, mundo);
  E.fog.near = mundo.niebla.cerca * 1.6; E.fog.far = mundo.niebla.lejos * 1.7;   /* en la carrera se mira más lejos */
  M.suelo(E, mundo, { cx: 0, cz: 0, r: 50, libre: function (x, z) { return lejosDePista(x, z) > W / 2 + 1.4; } });
  var lejos = M.lejos(E, mundo, { cx: 0, cz: 0, medioX: mundo.id === 'selva' ? 54 : 44, medioZ: mundo.id === 'selva' ? 54 : 42 });   /* los árboles gigantes, lejos de la cámara */
  var vidaG = new THREE.Group(), vida = M.vida ? M.vida(vidaG, mundo, { cx: 0, cz: 0, w: 14, h: 14 }) : null; E.add(vidaG);

  /* ---------- el asfalto y los bordillos ---------- */
  function cinta(x0, x1, y, mat, vPor) {
    var pos3 = [], uv = [], idx = [];
    for (var i = 0; i <= K; i++) { var P = PS[i % K], r = R[i % K];
      pos3.push(P.x + r.x * x0, y, P.z + r.z * x0, P.x + r.x * x1, y, P.z + r.z * x1); uv.push(0, i * ds / vPor, 1, i * ds / vPor); }
    for (i = 0; i < K; i++) { var q = i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }   /* que miren hacia arriba */
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.receiveShadow = true; E.add(m); return m; }
  var tA = texAsfalto(); tA.repeat.set(1, 1);
  cinta(-W / 2, W / 2, .03, new THREE.MeshStandardMaterial({ map: tA, roughness: .85 }), 7);
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
  var muro = null; try { muro = M.muros(mundo.id === 'ciudad' ? { muro: 'casona', id: 'casona' } : mundo); } catch (e) { muro = null; }   /* Trujillo: casonas de colores */
  var ESM = 1.35, enMuro = [], enValla = [];
  for (var s = 0; s < L; s += ESM) { var c = curva(s); if (Math.abs(c) > .045) enMuro.push([s, c > 0 ? 1 : -1]); else if (Math.floor(s / ESM) % 2 === 0) enValla.push(s); }
  if (muro) {
    var porVar = {}; enMuro.forEach(function (q, j) { var v = j % muro.variantes.length; (porVar[v] = porVar[v] || []).push(q); });
    var ob = new THREE.Object3D();
    Object.keys(porVar).forEach(function (v) { var lista = porVar[v];
      muro.variantes[v].forEach(function (parte) { var im = new THREE.InstancedMesh(parte.geo, parte.mat, lista.length);
        lista.forEach(function (q, j) { var lado = q[1], pm = pos(q[0], lado * (1 + (1.1 + muro.grosor * ESM / 2) / (W / 2))), d = dir(q[0]);
          ob.position.set(pm.x, 0, pm.z); ob.rotation.set(0, Math.atan2(-d.z, d.x), 0); ob.scale.set(ESM, ESM, ESM); ob.updateMatrix(); im.setMatrixAt(j, ob.matrix); });
        im.castShadow = false; im.receiveShadow = true; E.add(im); }); });
  }
  /* vallas blancas y rojas de las rectas (una sola malla) */
  var JV = new M.Junta(), blanco = M.col('#f3f3f0'), rojo = M.col('#d8343a');
  enValla.forEach(function (s, j) { [-1, 1].forEach(function (l) { var p = pos(s, l * (1 + 1.05 / (W / 2))), d = dir(s), ang = Math.atan2(-d.z, d.x), m = new M4().makeRotationY(ang).setPosition(p.x, 0, p.z);
    JV.pieza(new THREE.BoxGeometry(.06, .5, .06).translate(0, .25, 0), blanco, m); JV.pieza(new THREE.BoxGeometry(ESM, .09, .04).translate(0, .42, 0), j % 2 ? rojo : blanco, m); JV.pieza(new THREE.BoxGeometry(ESM, .09, .04).translate(0, .22, 0), j % 2 ? blanco : rojo, m); }); });
  if (JV.base) E.add(new THREE.Mesh(JV.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 })));

  /* ---------- la largada: arco con letrero y semáforo, tribunas con público, banderas y globos ---------- */
  var cols = mundo.regalos, acento = mundo.acento;
  var arco = new THREE.Group(), pA = pos(1.2, 0), dA = dir(1.2); arco.position.set(pA.x, 0, pA.z); arco.rotation.y = Math.atan2(dA.x, dA.z); E.add(arco);
  var mPil = new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: .5, metalness: .3 });
  [-1, 1].forEach(function (l) { var pil = new THREE.Mesh(new THREE.BoxGeometry(.35, 3.4, .35), mPil); pil.position.set(l * (W / 2 + .9), 1.7, 0); pil.castShadow = true; arco.add(pil); });
  var letrero = new THREE.Mesh(new THREE.BoxGeometry(W + 2.2, .9, .18), [mPil, mPil, mPil, mPil, new THREE.MeshBasicMaterial({ map: texLetrero('RUWAY · LA GRAN CARRERA', acento, '#1c1424') }), new THREE.MeshBasicMaterial({ map: texLetrero('RUWAY · LA GRAN CARRERA', acento, '#1c1424') })]);
  letrero.position.y = 3.2; arco.add(letrero);
  var focos = [];
  for (k = 0; k < 5; k++) { var fm = new THREE.MeshBasicMaterial({ color: '#3a1010' }), f = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), fm); f.position.set(-1 + k * .5, 2.55, .12); arco.add(f); focos.push(fm); }
  var caja = new THREE.Mesh(new THREE.BoxGeometry(2.8, .42, .16), mPil); caja.position.set(0, 2.55, 0); arco.add(caja);
  function semaforo(n) { focos.forEach(function (m, k) { m.color.set(n >= 6 ? '#3cff6a' : (k < n ? '#ff3030' : '#3a1010')); }); }
  /* tribunas a los dos lados de la recta de largada, con techito del color del mundo y público */
  var gente = [], GENTE_N = 0, mPer = null, imPer = null;
  var JT = new M.Junta(), lugares = [];
  [-1, 1].forEach(function (l) { for (var tz = 0; tz < 2; tz++) {
    var s0 = -6 - tz * 9, p = pos(s0, l * (1 + 2.6 / (W / 2))), d = dir(s0), ang = Math.atan2(-d.z, d.x), m = new M4().makeRotationY(ang).setPosition(p.x, 0, p.z), rr = new V3(-d.z, 0, d.x).multiplyScalar(l);
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
  [[-4, -1], [-4, 1], [4, -1], [4, 1], [-15, -1], [-15, 1]].forEach(function (b) { var p = pos(b[0], b[1] * (1 + 1.6 / (W / 2)));
    var mast = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 3, 6), mPil); mast.position.set(p.x, 1.5, p.z); E.add(mast);
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(.9, .6, 6, 1), new THREE.MeshStandardMaterial({ map: tbF, side: THREE.DoubleSide, roughness: .8 })); fl.position.set(p.x, 2.6, p.z); E.add(fl); banderas.push(fl); });
  var globos = [];
  [[-9, -1], [-9, 1], [8, 1], [-22, -1]].forEach(function (b, j) { var p = pos(b[0], b[1] * (1 + 2.1 / (W / 2))), gg = new THREE.Group(); gg.position.set(p.x, 0, p.z);
    for (var k = 0; k < 4; k++) { var gl = new THREE.Mesh(new THREE.SphereGeometry(.28, 14, 10), new THREE.MeshStandardMaterial({ color: cols[(j + k) % cols.length], roughness: .25, metalness: .05 })); gl.scale.y = 1.2; gl.position.set((k % 2 - .5) * .45, 2.6 + (k >> 1) * .5, (k >> 1) * .2); gg.add(gl); }
    var hilo = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, 2.4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hilo.position.y = 1.3; gg.add(hilo); E.add(gg); globos.push(gg); });

  /* ---------- banderines cruzando la pista (una malla por cada cruce) ---------- */
  var JBn = new M.Junta();
  for (k = 0; k < (baja ? 4 : 7); k++) { var sb = L * (k + .5) / (baja ? 4 : 7); if (Math.abs(curva(sb)) > .05) sb += 6;
    var pi = pos(sb, -1 - 1.1 / (W / 2)), pd = pos(sb, 1 + 1.1 / (W / 2)), alto = 3.1;
    [pi, pd].forEach(function (p) { JBn.pieza(new THREE.CylinderGeometry(.05, .06, alto, 6).translate(p.x, alto / 2, p.z), M.col('#ffffff')); });
    for (var q = 0; q < 14; q++) { var u = (q + .5) / 14, x = pi.x + (pd.x - pi.x) * u, z = pi.z + (pd.z - pi.z) * u, y = alto - .1 - Math.sin(u * Math.PI) * .45;
      var tri = new THREE.ConeGeometry(.16, .34, 3); tri.rotateX(Math.PI); tri.translate(x, y - .17, z); JBn.pieza(tri, M.col(cols[(q + k) % cols.length])); } }
  E.add(new THREE.Mesh(JBn.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, side: THREE.DoubleSide })));

  /* ---------- carteles de curva (flechas rojas y blancas) y flores ---------- */
  var tFI = texFlecha(true), tFD = texFlecha(false), JPo = new M.Junta(), visto = -99;
  for (s = 0; s < L; s += 2) { var cv = curva(s); if (Math.abs(cv) < .07 || s - visto < 14) continue; visto = s;
    for (var r2 = 0; r2 < 3; r2++) { var sc = s + r2 * 1.6, lado = cv > 0 ? 1 : -1, p = pos(sc, lado * (1 + 2.2 / (W / 2))), d = dir(sc);
      var cart = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .55), new THREE.MeshBasicMaterial({ map: cv > 0 ? tFI : tFD, side: THREE.DoubleSide }));
      cart.position.set(p.x, .9, p.z); cart.rotation.y = Math.atan2(d.x, d.z) + Math.PI; E.add(cart);
      JPo.pieza(new THREE.BoxGeometry(.05, .65, .05).translate(p.x, .32, p.z), M.col('#3a3f48')); } }
  if (JPo.base) E.add(new THREE.Mesh(JPo.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true })));
  var JFl = new M.Junta();
  for (k = 0; k < (baja ? 30 : 60); k++) { var sf = rnd() * L, lf = rnd() < .5 ? -1 : 1, pf = pos(sf, lf * (1 + (1.6 + rnd() * 1.4) / (W / 2)));
    for (var q2 = 0; q2 < 5; q2++) { var fl2 = new THREE.SphereGeometry(.07, 6, 5); fl2.translate(pf.x + (rnd() - .5) * .5, .12, pf.z + (rnd() - .5) * .5); JFl.pieza(fl2, M.col(cols[(k + q2) % cols.length])); }
    var mata = new THREE.IcosahedronGeometry(.2, 0); mata.scale(1, .5, 1); mata.translate(pf.x, .05, pf.z); JFl.pieza(mata, M.col('#3f8a3a')); }
  E.add(new THREE.Mesh(JFl.geometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 })));

  /* el minimapa (puntos del trazado) */
  var mini = []; for (i = 0; i < K; i += 10) mini.push([PS[i].x, PS[i].z]);

  var mo = new M4(), q4 = new THREE.Quaternion(), e3 = new V3(), vT = new V3(1, 1, 1);
  return {
    L: L, W: W, K: K, pos: pos, dir: dir, curva: curva, mini: mini, semaforo: semaforo, luces: luces,
    actualizar: function (dt, t, x, z, cam) {
      if (cielo) cielo.actualizar(t, cam || { x: x, z: z });
      if (lejos) lejos.actualizar(dt, t);
      luces.seguir(x, z); vidaG.position.set(x, 0, z); if (vida) vida(dt, t, cam);
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
