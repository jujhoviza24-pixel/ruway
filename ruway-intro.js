/* GENERADO POR construir.js desde lib/intro/ · NO EDITAR A MANO */
/* RuwayIntro — la entrada común de Ruway: «La plaza donde comienzan los recuerdos».
   base.js: utilidades, texturas hechas en lienzo y la OBRA (el armador que junta la geometría).

   Por qué una "obra": la plaza tiene miles de piezas (molduras, marcos, rejas, balcones…). Si
   cada pieza fuera un objeto, un Android barato haría miles de llamadas de dibujo por cuadro.
   La obra junta todas las piezas que comparten material en UNA sola malla, con el color de
   cada pieza guardado en sus vértices. Así toda la arquitectura son unas pocas llamadas.

   Las coordenadas de textura se recalculan desde la posición en el mundo (según hacia dónde
   mira cada cara): el grano del estuco o de la piedra tiene el mismo tamaño en una moldura de
   20 cm que en un muro de 10 m, sin costuras.

   Medidas: 1 unidad ≈ 1 metro. La plaza es un cuadrado de 100 × 100 con el monumento en (0,0);
   el norte es −Z (hacia la catedral) y la cámara entra por el sur (+Z). */
(function () {
'use strict';
var I = window.__RI = window.__RI || {};

I.azar = function (sem) { var s = sem >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
I.suave = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
I.lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
I.lienzo = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
I.tex = function (c, srgb, rep) {
  var t = new THREE.CanvasTexture(c); if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2; return t;
};
I.ruido = function (per, rnd) {
  var g = new Float32Array(per * per); for (var i = 0; i < g.length; i++) g[i] = rnd();
  return function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    var x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = g[y0 * per + x0], b = g[y0 * per + x1], c = g[y1 * per + x0], d = g[y1 * per + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
};
/* color de una pieza: hex en sRGB → lineal (los vértices van en lineal, como el resto de three) */
var _c = new THREE.Color();
I.col = function (hex, k) { _c.set(hex).convertSRGBToLinear(); if (k != null) _c.multiplyScalar(k); return [_c.r, _c.g, _c.b]; };

/* ---------- texturas (todas pequeñas y repetibles) ---------- */
/* grano de estuco / piedra: gris claro alrededor de 1, se multiplica por el color del vértice */
I.texGrano = function (sem, fuerza) {
  var N = 128, c = I.lienzo(N, N), g = c.getContext('2d'), rnd = I.azar(sem || 7), r1 = I.ruido(8, rnd), r2 = I.ruido(32, rnd), im = g.createImageData(N, N);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var n = r1(x / 16, y / 16) * .6 + r2(x / 4, y / 4) * .4, k = 1 - (fuerza || .16) * .5 + n * (fuerza || .16), i = (y * N + x) * 4, v = Math.round(255 * Math.min(1, k * .97));
    im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return I.tex(c, false, true);
};
/* estuco de las casonas: grano fino, manchas grandes y suaves, y chorreaduras verticales tenues
   (la pintura de una casona vieja nunca es pareja) */
I.texEstuco = function () {
  var N = 256, c = I.lienzo(N, N), g = c.getContext('2d'), rnd = I.azar(29), r1 = I.ruido(4, rnd), r2 = I.ruido(16, rnd), r3 = I.ruido(64, rnd), im = g.createImageData(N, N);
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
    var n = r1(x / 64, y / 64) * .5 + r2(x / 16, y / 16) * .3 + r3(x / 4, y / 4) * .2, chorro = Math.pow(r2(x / 3, y / 60), 6) * .25;
    var k = .9 + (n - .5) * .16 - chorro, i = (y * N + x) * 4, v = Math.round(255 * I.lim(k, 0, 1));
    im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = Math.round(v * .985); im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return I.tex(c, false, true);
};
/* madera: vetas largas */
I.texMadera = function () {
  var c = I.lienzo(64, 256), g = c.getContext('2d'), rnd = I.azar(19);
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 70; i++) { var x = rnd() * 64; g.fillStyle = 'rgba(' + (rnd() < .5 ? '255,255,255' : '70,70,70') + ',' + (.08 + rnd() * .16) + ')'; g.fillRect(x, 0, 1 + rnd() * 2.5, 256); }
  return I.tex(c, false, true);
};
/* celosía de los balcones de cajón: listones cruzados con huecos oscuros */
I.texCelosia = function () {
  var c = I.lienzo(128, 128), g = c.getContext('2d');
  g.fillStyle = '#1b120b'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#d9d9d9'; g.lineWidth = 5;
  for (var j = -128; j < 256; j += 16) { g.beginPath(); g.moveTo(j, 0); g.lineTo(j + 128, 128); g.stroke(); g.beginPath(); g.moveTo(j + 128, 0); g.lineTo(j, 128); g.stroke(); }
  g.lineWidth = 9; g.strokeRect(0, 0, 128, 128);
  return I.tex(c, false, true);
};
/* el pavimento de la plaza: losas de piedra cálida en hileras de alto distinto, cada losa de su
   largo y de su tono (unas más claras, otras más rosadas o más grises), con juntas discretas */
I.texLosas = function () {
  var N = 512, c = I.lienzo(N, N), g = c.getContext('2d'), rnd = I.azar(41), r = I.ruido(16, rnd);
  g.fillStyle = '#9c8f7e'; g.fillRect(0, 0, N, N);                     /* el color de las juntas */
  var altos = [48, 64, 40, 64, 56, 48, 72, 40, 80], y = 0, f = 0;
  while (y < N) {
    var h = altos[f % altos.length]; if (y + h > N) h = N - y;
    var x = -Math.floor(rnd() * 60);
    while (x < N) {
      var w = 64 + Math.floor(rnd() * 70), t = rnd(), k = .9 + rnd() * .12;
      var col = t < .55 ? [236, 224, 204] : t < .8 ? [232, 214, 198] : t < .93 ? [222, 218, 208] : [214, 196, 172];
      g.fillStyle = 'rgb(' + Math.round(col[0] * k) + ',' + Math.round(col[1] * k) + ',' + Math.round(col[2] * k) + ')';
      g.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
      /* las losas que cruzan el borde se repiten al otro lado, para que la textura no tenga costura */
      if (x + w > N) g.fillRect(x - N + 1.5, y + 1.5, w - 3, h - 3);
      x += w;
    }
    y += h; f++;
  }
  /* desgaste suave encima de todo */
  var im = g.getImageData(0, 0, N, N);
  for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) { var i = (yy * N + xx) * 4, n = .94 + r(xx / 32, yy / 32) * .1;
    im.data[i] *= n; im.data[i + 1] *= n; im.data[i + 2] *= n; }
  g.putImageData(im, 0, 0); return I.tex(c, true, true);
};
/* racimo de hojas de árbol (alfa): muchas hojitas ovaladas con su nervio, en tonos de verde */
I.texHojas = function () {
  var c = I.lienzo(128, 128), g = c.getContext('2d'), rnd = I.azar(57);
  g.clearRect(0, 0, 128, 128);
  for (var i = 0; i < 70; i++) {
    var a = rnd() * 6.283, d = Math.sqrt(rnd()) * 50, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, l = 9 + rnd() * 8, k = 150 + Math.floor(rnd() * 105);
    g.save(); g.translate(x, y); g.rotate(rnd() * 6.283);
    g.fillStyle = 'rgb(' + k + ',' + k + ',' + k + ')'; g.beginPath(); g.ellipse(0, 0, l, l * .45, 0, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l, 0); g.lineTo(l, 0); g.stroke(); g.restore();
  }
  return I.tex(c, true, false);
};
/* el relieve de bronce del pedestal: una escena de figuras (la gesta de la libertad) en bajorrelieve,
   pintada con luz de arriba a la izquierda: bordes claros arriba, sombras abajo, pátina verdosa */
I.texRelieve = function () {
  var c = I.lienzo(256, 160), g = c.getContext('2d'), rnd = I.azar(63);
  var gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#4f5a45'); gr.addColorStop(1, '#3a4234'); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  function figuraR(x, y, s, inclina, brazo) {
    function forma(dx, dy, col) { g.save(); g.translate(x + dx, y + dy); g.rotate(inclina); g.fillStyle = col;
      g.beginPath(); g.ellipse(0, -s * 1.55, s * .22, s * .26, 0, 0, 6.283); g.fill();                      /* cabeza */
      g.beginPath(); g.moveTo(-s * .32, -s * 1.3); g.quadraticCurveTo(0, -s * 1.42, s * .32, -s * 1.3); g.lineTo(s * .24, -s * .55); g.lineTo(s * .3, 0); g.lineTo(s * .1, 0); g.lineTo(0, -s * .5); g.lineTo(-s * .1, 0); g.lineTo(-s * .3, 0); g.lineTo(-s * .24, -s * .55); g.closePath(); g.fill();
      g.lineWidth = s * .16; g.strokeStyle = col; g.lineCap = 'round'; g.beginPath(); g.moveTo(-s * .28, -s * 1.25); g.lineTo(-s * .55, -s * (brazo ? 1.9 : .8)); g.moveTo(s * .28, -s * 1.25); g.lineTo(s * .6, -s * .9); g.stroke(); g.restore(); }
    forma(1.6, 1.6, 'rgba(20,24,16,.75)'); forma(-1, -1, 'rgba(190,200,150,.55)'); forma(0, 0, '#5b6650');
  }
  for (var i = 0; i < 9; i++) figuraR(20 + i * 27 + rnd() * 6, 140 - rnd() * 8, 38 + rnd() * 10, (rnd() - .5) * .35, rnd() < .4);
  g.strokeStyle = 'rgba(200,210,160,.4)'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 154); g.strokeStyle = 'rgba(15,18,12,.6)'; g.strokeRect(6, 6, 244, 148);
  return I.tex(c, true, false);
};
/* las casas de la ciudad (más allá de las fachadas de la plaza): un tablero de 16 franjas de 128 px.
   Cada franja es UN tramo de fachada de 4 m de ancho por 10,4 m de alto que se repite a lo ancho
   (repetición horizontal): puerta o ventana con reja abajo, ventana con marco, balcón de cajón o
   balconcillo arriba, pilastras, banda entre pisos, cornisa y pretil, zócalo y la suciedad de abajo.
     0–9  casonas de colores (azul, amarillo, rojo, blanco con azul, ocre, verde agua, rosado, crema,
          blanco con marrón, terracota)
     10   azotea (concreto con manchas)
     11–13 edificios modernos (4 pisos por franja)
   Así las cuadras de alrededor tienen casas con sus detalles y no cajas vacías, con una sola
   textura y unas pocas llamadas de dibujo. */
I.CIUDAD = { franjas: 16, azotea: 10, modernos: [11, 12, 13] };
I.texCiudad = function () {
  var W = 128, F = 128, c = I.lienzo(W, F * 16), g = c.getContext('2d'), rnd = I.azar(83);
  var estilos = [
    ['#3e5aa8', '#f4efe3', 'cajon'], ['#e2ab2c', '#f4efe3', 'abierto'], ['#c64a30', '#f4efe3', 'ventana'], ['#f1ede4', '#3e5aa8', 'cajon'],
    ['#d8a35a', '#f4efe3', 'arco'], ['#9cc9b4', '#f4efe3', 'ventana'], ['#e8a1a8', '#f4efe3', 'abierto'], ['#efe5cf', '#8a5a34', 'cajon'],
    ['#f2efe8', '#6b4428', 'ventana'], ['#b5543a', '#efe5cf', 'arco']];
  function ventana(x, y, w, h, marco, reja, luz) {
    g.fillStyle = marco; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = luz ? '#e9b56a' : '#2a2320'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 1, y + 1, w / 2 - 1, h - 2);
    if (reja) { g.fillStyle = '#1a1714'; for (var i = 1; i < 5; i++) g.fillRect(x + i * w / 5, y, 1, h); g.fillRect(x, y + h * .5, w, 1); }
    else { g.fillStyle = marco; g.fillRect(x + w / 2 - .5, y, 1, h); g.fillRect(x, y + h * .45, w, 1); }
  }
  for (var r = 0; r < 10; r++) {
    var e = estilos[r], y0 = r * F, muro = e[0], marco = e[1];
    g.fillStyle = muro; g.fillRect(0, y0, W, F);
    /* manchas y chorreaduras de la pintura */
    for (var i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (rnd() < .5 ? '0,0,0' : '255,255,255') + ',' + (.03 + rnd() * .04) + ')'; g.fillRect(rnd() * W, y0 + rnd() * F, 2 + rnd() * 14, 4 + rnd() * 20); }
    var gs = g.createLinearGradient(0, y0 + F * .8, 0, y0 + F); gs.addColorStop(0, 'rgba(0,0,0,0)'); gs.addColorStop(1, 'rgba(40,30,20,.35)'); g.fillStyle = gs; g.fillRect(0, y0 + F * .8, W, F * .2);
    /* pilastras (media a cada lado: al repetirse forman una entera), zócalo, banda, cornisa y pretil */
    g.fillStyle = marco; g.fillRect(0, y0 + 10, 7, F - 10); g.fillRect(W - 7, y0 + 10, 7, F - 10);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(7, y0 + 10, 1, F - 10);
    g.fillStyle = marco; g.fillRect(0, y0 + 60, W, 4); g.fillRect(0, y0 + 8, W, 5); g.fillRect(0, y0 + 3, W, 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y0 + 13, W, 2); g.fillRect(0, y0 + 64, W, 1);
    g.fillStyle = muro; g.fillRect(0, y0, W, 3);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y0 + F - 12, W, 12);                               /* zócalo */
    /* abajo: puerta de madera (en arco o recta) o ventana con reja */
    var abajo = rnd() < .45 ? 'puerta' : 'ventana';
    if (abajo === 'puerta' || e[2] === 'arco') {
      g.fillStyle = marco; g.fillRect(44, y0 + 74, 40, 54);
      if (e[2] === 'arco') { g.beginPath(); g.arc(64, y0 + 82, 20, Math.PI, 0); g.fill(); }
      g.fillStyle = '#5a3420'; g.fillRect(48, y0 + 80, 32, 48); if (e[2] === 'arco') { g.beginPath(); g.arc(64, y0 + 84, 16, Math.PI, 0); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(63, y0 + 82, 2, 46); for (i = 0; i < 4; i++) g.fillRect(50, y0 + 88 + i * 10, 28, 1);
    } else ventana(50, y0 + 80, 28, 34, marco, true, rnd() < .25);
    /* arriba: ventana con marco, balcón de cajón o balconcillo de fierro */
    ventana(50, y0 + 24, 28, 30, marco, false, rnd() < .3);
    if (e[2] === 'cajon') {
      g.fillStyle = '#6b3f22'; g.fillRect(36, y0 + 20, 56, 42); g.fillStyle = '#7d4b2a'; g.fillRect(38, y0 + 22, 52, 22);
      g.strokeStyle = 'rgba(30,15,5,.7)'; g.lineWidth = 1; for (i = -40; i < 60; i += 6) { g.beginPath(); g.moveTo(38 + i, y0 + 22); g.lineTo(38 + i + 22, y0 + 44); g.moveTo(38 + i + 22, y0 + 22); g.lineTo(38 + i, y0 + 44); g.stroke(); }
      g.fillStyle = '#4e2c16'; g.fillRect(34, y0 + 18, 60, 4); g.fillRect(36, y0 + 46, 56, 3); for (i = 0; i < 4; i++) g.fillRect(40 + i * 14, y0 + 49, 10, 10);
      g.fillStyle = '#3a2010'; g.fillRect(36, y0 + 62, 56, 3);
    } else if (e[2] === 'abierto') {
      g.fillStyle = '#1a1714'; g.fillRect(42, y0 + 50, 44, 2); for (i = 0; i <= 11; i++) g.fillRect(42 + i * 4, y0 + 50, 1, 12); g.fillRect(40, y0 + 62, 48, 3);
    }
  }
  /* azotea */
  var yA = 10 * F; g.fillStyle = '#a49c90'; g.fillRect(0, yA, W, F);
  for (i = 0; i < 120; i++) { g.fillStyle = 'rgba(' + (rnd() < .6 ? '60,55,50' : '230,225,215') + ',' + (.06 + rnd() * .1) + ')'; g.fillRect(rnd() * W, yA + rnd() * F, 2 + rnd() * 16, 2 + rnd() * 16); }
  /* modernos: cuatro pisos de ventanas por franja */
  [['#d9d6cf', '#5d6a78'], ['#bfc4c9', '#3e4b5a'], ['#e8e1d3', '#6f7a84']].forEach(function (m, j) {
    var y1 = (11 + j) * F; g.fillStyle = m[0]; g.fillRect(0, y1, W, F);
    for (var p = 0; p < 4; p++) for (var v = 0; v < 3; v++) { g.fillStyle = rnd() < .2 ? '#e6c48a' : m[1]; g.fillRect(8 + v * 40, y1 + 6 + p * 32, 32, 20); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(8 + v * 40, y1 + 6 + p * 32, 32, 4); }
    g.fillStyle = 'rgba(0,0,0,.12)'; for (p = 0; p < 4; p++) g.fillRect(0, y1 + 30 + p * 32, W, 2);
  });
  /* las franjas 14 y 15 quedan del color de la azotea (por si alguna mezcla de mipmaps las toca) */
  g.fillStyle = '#a49c90'; g.fillRect(0, 14 * F, W, 2 * F);
  var t = I.tex(c, true, false); t.wrapS = THREE.RepeatWrapping; return t;
};
/* el globo de bronce del monumento: continentes un poco más claros, con borde de luz y sombra */
I.texGlobo = function () {
  var c = I.lienzo(256, 128), g = c.getContext('2d'), rnd = I.azar(47), r = I.ruido(8, rnd);
  g.fillStyle = '#34503f'; g.fillRect(0, 0, 256, 128);
  var im = g.getImageData(0, 0, 256, 128);
  for (var y = 0; y < 128; y++) for (var x = 0; x < 256; x++) {
    var n = r(x / 26, y / 18) * .7 + r(x / 9, y / 7) * .3, lat = Math.abs(y - 64) / 64, tierra = n > .56 + lat * .1, i = (y * 256 + x) * 4;
    var borde = Math.abs(n - .56 - lat * .1) < .015;
    var k = tierra ? 1.28 : 1; if (borde) k = .7;
    im.data[i] = Math.min(255, im.data[i] * k); im.data[i + 1] = Math.min(255, im.data[i + 1] * k); im.data[i + 2] = Math.min(255, im.data[i + 2] * k);
  }
  g.putImageData(im, 0, 0); return I.tex(c, true, false);
};
/* hoja de palmera: raquis y foliolos (alfa) */
I.texHojaPalma = function () {
  var c = I.lienzo(128, 256), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  for (var y = 6; y < 250; y += 5) {
    var w = Math.sin(y / 256 * Math.PI) * 60 + 6;
    g.lineWidth = 2.6; g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 - w * .5, y + 8, 64 - w, y + 22); g.stroke();
    g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + w * .5, y + 8, 64 + w, y + 22); g.stroke();
  }
  g.lineWidth = 5; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 256); g.stroke();
  return I.tex(c, false, false);
};
I.texResplandor = function () {
  var c = I.lienzo(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return I.tex(c, false, false);
};
I.texSombra = function () {
  var c = I.lienzo(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return I.tex(c, false, false);
};

/* ---------- la obra ---------- */
var M4 = THREE.Matrix4, V3 = THREE.Vector3;
I.Obra = function () { this.cubos = {}; };
/* agrega una geometría: material (nombre del cubo), color [r,g,b] lineal, matriz (opcional) */
I.Obra.prototype.pieza = function (mat, geo, color, m) {
  if (m) geo.applyMatrix4(m);
  var p = geo.attributes.position, n = geo.attributes.normal, cnt = p.count;
  if (!n) { geo.computeVertexNormals(); n = geo.attributes.normal; }
  /* si la pieza ya trae color por vértice (las nervaduras blancas de una cúpula), se respeta,
     multiplicado por el color de la pieza */
  var propio = geo.attributes.color || null, uvPropio = geo.userData && geo.userData.uvPropio && geo.attributes.uv;
  var uv = new Float32Array(cnt * 2), co = new Float32Array(cnt * 3);
  for (var i = 0; i < cnt; i++) {
    var x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (uvPropio) { uv[i * 2] = uvPropio.getX(i); uv[i * 2 + 1] = uvPropio.getY(i); }
    else if (ay >= ax && ay >= az) { uv[i * 2] = x * .35; uv[i * 2 + 1] = z * .35; }
    else if (ax >= az) { uv[i * 2] = z * .35; uv[i * 2 + 1] = y * .35; }
    else { uv[i * 2] = x * .35; uv[i * 2 + 1] = y * .35; }
    if (propio) { co[i * 3] = color[0] * propio.getX(i); co[i * 3 + 1] = color[1] * propio.getY(i); co[i * 3 + 2] = color[2] * propio.getZ(i); }
    else { co[i * 3] = color[0]; co[i * 3 + 1] = color[1]; co[i * 3 + 2] = color[2]; }
  }
  var idx = geo.index ? Array.prototype.slice.call(geo.index.array) : null;
  if (!idx) { idx = []; for (i = 0; i < cnt; i++) idx.push(i); }
  var c = this.cubos[mat] || (this.cubos[mat] = { p: [], n: [], uv: [], c: [], i: [], base: 0, extra: {} });
  for (i = 0; i < idx.length; i++) c.i.push(idx[i] + c.base);
  for (i = 0; i < cnt; i++) { c.p.push(p.getX(i), p.getY(i), p.getZ(i)); c.n.push(n.getX(i), n.getY(i), n.getZ(i)); c.uv.push(uv[i * 2], uv[i * 2 + 1]); c.c.push(co[i * 3], co[i * 3 + 1], co[i * 3 + 2]); }
  /* atributos propios (por ejemplo, cuánto se mece una hoja) */
  if (geo.userData && geo.userData.extra) for (var k in geo.userData.extra) { var arr = c.extra[k] || (c.extra[k] = []); var src = geo.userData.extra[k]; for (i = 0; i < cnt; i++) arr.push(src[i]); }
  c.base += cnt;
  geo.dispose();
};
/* una caja con su centro en (x,y,z), rotada "giro" en Y (útil para todo lo que va pegado a una fachada) */
I.Obra.prototype.caja = function (mat, w, h, d, x, y, z, color, m) {
  var g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); this.pieza(mat, g, color, m); };
I.Obra.prototype.mallas = function (materiales, escena) {
  var out = {};
  for (var k in this.cubos) {
    var c = this.cubos[k], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(c.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(c.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(c.uv, 2));
    /* el estuco se ensucia cerca del suelo (salpicaduras, humedad): un poco más oscuro abajo */
    if (k === 'estuco') for (var vi = 0; vi < c.base; vi++) { var yv = c.p[vi * 3 + 1]; if (yv < 1.4) { var f = .8 + .2 * Math.max(0, yv) / 1.4; c.c[vi * 3] *= f; c.c[vi * 3 + 1] *= f; c.c[vi * 3 + 2] *= f; } }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c.c, 3));
    for (var e in c.extra) g.setAttribute(e, new THREE.Float32BufferAttribute(c.extra[e], 1));
    g.setIndex(c.base > 65535 ? new THREE.Uint32BufferAttribute(c.i, 1) : new THREE.Uint16BufferAttribute(c.i, 1));
    g.computeBoundingSphere();
    var mesh = new THREE.Mesh(g, materiales[k]); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    escena.add(mesh); out[k] = mesh;
  }
  this.cubos = {};
  return out;
};

/* matriz de una fachada: su frente en z = 0 mirando a +Z, llevada a (x, z) y girada "giro" */
I.marco = function (x, z, giro, y) { return new M4().makeRotationY(giro || 0).setPosition(x, y || 0, z); };
I.mul = function (a, b) { return new M4().multiplyMatrices(a, b); };
I.mover = function (x, y, z) { return new M4().makeTranslation(x, y, z); };

/* un arco de medio punto como pieza con espesor (marco de puerta, de ventana, del campanario) */
I.geoArco = function (rExt, rInt, prof, seg) {
  var s = new THREE.Shape(); seg = seg || 14;
  s.moveTo(rExt, 0); s.absarc(0, 0, rExt, 0, Math.PI, false); s.lineTo(-rInt, 0); s.absarc(0, 0, rInt, Math.PI, 0, true); s.lineTo(rExt, 0);
  var g = new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: false, curveSegments: seg }); return g;
};
/* un vano con remate de arco (la hoja de una puerta, el hueco oscuro de una ventana) */
I.geoVanoArco = function (ancho, alto, prof) {
  var r = ancho / 2, s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, alto - r); s.absarc(0, alto - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth: prof, bevelEnabled: false, curveSegments: 12 });
};
/* un perfil de revolución (cúpulas, balaustres, linternas, el cantarito…) */
I.geoTorno = function (pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 20); };
})();

;
/* RuwayIntro — arquitectura.js: las piezas de la arquitectura trujillana, hechas con código.

   Todo se arma en el "espacio de la fachada": el frente en z = 0 mirando a +Z, el suelo en y = 0
   y el muro hacia −Z. Cada función recibe la obra y la matriz que lleva esa fachada a su lugar
   en la plaza. Así un mismo armador sirve para la catedral, las casonas y las esquinas.

   Fidelidad: la composición, los colores y el carácter salen de fotografías de la plaza (catedral
   amarilla y blanca con dos torres y cúpulas, casonas de colores con balcones de cajón, palacio
   blanco y azul). Las medidas no salen de planos: es una interpretación estilizada, no una
   reconstrucción milimétrica. */
(function () {
'use strict';
var I = window.__RI;
var C = I.col;
/* maderas de los balcones y puertas: el cedro barnizado de las casonas (no negro: al sol bajo se ve su veta) */
var BL = C('#F4EFE3'), OSC = C('#3d2717'), MAD = C('#7d4b2a'), MADO = C('#5c3520'), MET = C('#1c1a19');

/* ---------- ventanas ---------- */
/* x: centro del vano · y: alfeizar · w, h: medidas del vano · o.reja, o.luz, o.marco */
I.createWindow = function (obra, m, x, y, w, h, o) {
  o = o || {}; var mc = o.marco || BL, t = .13;
  /* el hueco con su vidrio (algunos encendidos al atardecer) */
  var luz = o.luz ? C(o.luz) : C('#2a3442');
  obra.caja('vidrio', w, h, .1, x, y + h / 2, -.16, luz, m);
  obra.caja('estuco', w, h, .3, x, y + h / 2, -.33, OSC, m);       /* fondo del vano (la jamba en sombra) */
  /* marco con su espesor */
  obra.caja('estuco', t, h + t, .14, x - w / 2 - t / 2, y + h / 2, .05, mc, m);
  obra.caja('estuco', t, h + t, .14, x + w / 2 + t / 2, y + h / 2, .05, mc, m);
  obra.caja('estuco', w + t * 2, t, .14, x, y + h + t / 2, .05, mc, m);
  /* alfeizar y dintel con cornisita */
  obra.caja('estuco', w + .5, .14, .26, x, y - .06, .1, mc, m);
  obra.caja('estuco', w + .55, .18, .24, x, y + h + .25, .09, mc, m);
  obra.caja('estuco', w + .35, .12, .16, x, y + h + .11, .06, mc, m);
  if (o.reja) {                                                     /* reja de fierro */
    var n = Math.max(3, Math.round(w / .16));
    for (var i = 1; i < n; i++) obra.caja('metal', .025, h, .025, x - w / 2 + i * w / n, y + h / 2, .04, MET, m);
    obra.caja('metal', w, .03, .03, x, y + h * .3, .04, MET, m); obra.caja('metal', w, .03, .03, x, y + h * .78, .04, MET, m);
  }
  if (o.postigos) {                                                 /* contraventanas de madera, abiertas */
    obra.caja('madera', w * .5, h, .05, x - w * .75 - .05, y + h / 2, .12, MADO, m);
    obra.caja('madera', w * .5, h, .05, x + w * .75 + .05, y + h / 2, .12, MADO, m);
  }
};

/* ---------- puertas ---------- */
I.createArchedDoor = function (obra, m, x, w, h, o) {
  o = o || {}; var mc = o.marco || BL, r = w / 2, y0 = o.y || 0;
  var hoja = I.geoVanoArco(w, h, .12); hoja.translate(x, y0, -.22); obra.pieza('madera', hoja, o.hoja || MAD, m);
  var fondo = I.geoVanoArco(w, h, .2); fondo.translate(x, y0, -.45); obra.pieza('estuco', fondo, OSC, m);
  /* tableros de la hoja */
  for (var k = 0; k < 2; k++) for (var j = 0; j < 3; j++) obra.caja('madera', r * .7, (h - r) * .26, .06, x - r / 2 + k * r, y0 + .5 + j * (h - r) * .31 + (h - r) * .13, -.08, MADO, m);
  /* jambas y arco con espesor, y su clave */
  obra.caja('estuco', .3, h - r, .3, x - r - .15, y0 + (h - r) / 2, .02, mc, m);
  obra.caja('estuco', .3, h - r, .3, x + r + .15, y0 + (h - r) / 2, .02, mc, m);
  var arco = I.geoArco(r + .3, r, .3); arco.translate(x, y0 + h - r, -.13); obra.pieza('estuco', arco, mc, m);
  obra.caja('estuco', .36, .5, .38, x, y0 + h + .1, .05, mc, m);
  if (o.columnas) {                                                 /* columnas pareadas a los lados */
    [-1, 1].forEach(function (s) {
      for (var c = 0; c < (o.columnas === 2 ? 2 : 1); c++) {
        var cx = x + s * (r + .75 + c * .8), alto = h + .4;
        obra.caja('estuco', .7, .8, .7, cx, y0 + .4, .25, mc, m);
        var col = new THREE.CylinderGeometry(.24, .28, alto - .8, 12); col.translate(cx, y0 + .8 + (alto - .8) / 2, .25); obra.pieza('estuco', col, mc, m);
        obra.caja('estuco', .7, .3, .7, cx, y0 + alto + .15, .25, mc, m);
      }
    });
    var anc = w + (o.columnas === 2 ? 4.6 : 3);
    obra.caja('estuco', anc, .5, .8, x, y0 + h + .85, .25, mc, m);
    obra.caja('estuco', anc + .5, .22, 1.0, x, y0 + h + 1.2, .28, mc, m);
  }
};
I.createDoor = function (obra, m, x, w, h, o) {
  o = o || {}; var mc = o.marco || BL;
  obra.caja('madera', w, h, .12, x, h / 2, -.22, o.hoja || MAD, m);
  obra.caja('estuco', w, h, .2, x, h / 2, -.42, OSC, m);
  for (var k = 0; k < 2; k++) for (var j = 0; j < 3; j++) obra.caja('madera', w * .36, h * .24, .06, x - w / 4 + k * w / 2, .45 + j * h * .3 + h * .1, -.13, MADO, m);
  obra.caja('estuco', .28, h + .28, .22, x - w / 2 - .14, (h + .28) / 2, .02, mc, m);
  obra.caja('estuco', .28, h + .28, .22, x + w / 2 + .14, (h + .28) / 2, .02, mc, m);
  obra.caja('estuco', w + .9, .32, .3, x, h + .3, .05, mc, m);
  obra.caja('estuco', w + 1.1, .16, .38, x, h + .52, .07, mc, m);
};

/* ---------- cornisas, pilastras, bandas ---------- */
I.createCornice = function (obra, m, ancho, y, color, vuelo) {
  var v = vuelo || 1;
  obra.caja('estuco', ancho + .1, .32, .22 * v, 0, y - .16, .1 * v, color, m);
  obra.caja('estuco', ancho + .3, .2, .36 * v, 0, y + .1, .17 * v, color, m);
  obra.caja('estuco', ancho + .5, .2, .52 * v, 0, y + .3, .25 * v, color, m);
};
/* cornisa alrededor de un volumen cuadrado (las torres): tres anillos que vuelan cada vez más */
I.createRingCornice = function (obra, m, cx, cz, w, y, color) {
  obra.caja('estuco', w + .3, .32, w + .3, cx, y - .16, cz, color, m);
  obra.caja('estuco', w + .6, .2, w + .6, cx, y + .1, cz, color, m);
  obra.caja('estuco', w + .9, .2, w + .9, cx, y + .3, cz, color, m);
};
I.createPilaster = function (obra, m, x, y0, alto, color, ancho) {
  var w = ancho || .55;
  obra.caja('estuco', w, alto, .14, x, y0 + alto / 2, .07, color, m);
  obra.caja('estuco', w + .16, .26, .22, x, y0 + .13, .1, color, m);
  obra.caja('estuco', w + .16, .22, .22, x, y0 + alto - .11, .1, color, m);
};

/* ---------- balcones de cajón (la firma de Trujillo) ---------- */
/* x: centro · y: piso del balcón · w: ancho · tipo: 'cajon' o 'abierto' */
I.createBalcony = function (obra, m, x, y, w, tipo) {
  var vu = tipo === 'abierto' ? .7 : 1.0;
  obra.caja('madera', w + .3, .2, vu, x, y, vu / 2, MADO, m);                         /* plataforma */
  var nm = Math.max(2, Math.round(w / 1.3) + 1);
  for (var i = 0; i < nm; i++) {                                                     /* ménsulas */
    var mx = x - w / 2 + i * w / (nm - 1);
    obra.caja('madera', .16, .5, vu * .75, mx, y - .35, vu * .37, MADO, m);
    obra.caja('madera', .16, .2, vu * .4, mx, y - .7, vu * .2, MADO, m);
  }
  if (tipo === 'abierto') {
    var nb = Math.round(w / .14);
    for (i = 0; i <= nb; i++) obra.caja('metal', .03, .95, .03, x - w / 2 + i * w / nb, y + .58, vu - .05, MET, m);
    obra.caja('metal', w + .1, .05, .06, x, y + 1.06, vu - .05, MET, m);
    [-1, 1].forEach(function (s) { for (var j = 0; j <= 4; j++) obra.caja('metal', .03, .95, .03, x + s * w / 2, y + .58, j * (vu - .05) / 4, MET, m); });
    return;
  }
  var fz = vu - .04, alto = 2.5;
  obra.caja('madera', w + .3, .85, .08, x, y + .52, fz, MAD, m);                     /* antepecho de tableros */
  for (i = 0; i < Math.round(w / .8); i++) obra.caja('madera', .6, .5, .05, x - w / 2 + .4 + i * .8, y + .52, fz + .05, MADO, m);
  obra.caja('celosia', w + .26, 1.45, .04, x, y + 1.7, fz, MAD, m);                   /* celosías */
  [-1, 1].forEach(function (s) {
    obra.caja('madera', .08, .85, vu, x + s * (w / 2 + .15), y + .52, vu / 2, MAD, m);
    obra.caja('celosia', .04, 1.45, vu - .1, x + s * (w / 2 + .15), y + 1.7, vu / 2, MAD, m);
  });
  var np = Math.max(2, Math.round(w / 1.0) + 1);                                    /* parantes */
  for (i = 0; i < np; i++) obra.caja('madera', .1, alto, .1, x - w / 2 - .1 + i * (w + .2) / (np - 1), y + alto / 2, fz + .04, MADO, m);
  obra.caja('madera', w + .4, .12, .1, x, y + 1.0, fz + .06, MADO, m);
  obra.caja('madera', w + .55, .2, vu + .15, x, y + alto + .05, (vu + .15) / 2, MADO, m);   /* cornisa */
  obra.caja('madera', w + .75, .12, vu + .3, x, y + alto + .22, (vu + .3) / 2, MAD, m);     /* tejadillo */
};

/* ---------- la casona ---------- */
/* o: x, z, giro, ancho, alto, fondo, color, marco, zocalo, pisos (1|2), balcon ('cajon'|'abierto'|'largo'|null),
      arco (puerta en arco), luz (proporción de ventanas encendidas), sem */
I.createColonialFacade = function (obra, o) {
  var m = I.marco(o.x, o.z, o.giro), rnd = I.azar(o.sem || 1);
  var A = o.ancho, H = o.alto || (o.pisos === 1 ? 6 : 10.5), F = o.fondo || 14, col = C(o.color), mc = o.marco ? C(o.marco) : BL;
  var zc = o.zocalo ? C(o.zocalo) : C(o.color, .78);
  obra.caja('estuco', A, H, F, 0, H / 2, -F / 2, col, m);                                   /* el volumen */
  obra.caja('estuco', A + .04, 1.05, .1, 0, .52, .05, zc, m);                               /* zócalo */
  var n = Math.max(2, Math.round(A / 4.3)), bw = A / n, piso = o.pisos === 1 ? H : H * .48;
  for (var i = 0; i <= n; i++) I.createPilaster(obra, m, -A / 2 + i * bw + (i === 0 ? .28 : i === n ? -.28 : 0), 1.05, H - 1.6, mc, i === 0 || i === n ? .56 : .42);
  if (o.pisos !== 1) obra.caja('estuco', A + .05, .28, .2, 0, piso, .08, mc, m);            /* banda entre pisos */
  I.createCornice(obra, m, A, H - .45, mc);
  obra.caja('estuco', A, .75, .22, 0, H + .3, -.08, col, m);                                /* pretil */
  obra.caja('estuco', A + .1, .14, .3, 0, H + .7, -.06, mc, m);
  /* la azotea: concreto gris (no del color de la fachada) y, a veces, su tanque de agua */
  obra.caja('piedra', A - .1, .06, F - .3, 0, H + .03, -F / 2, C('#a39a8e'), m);
  if (rnd() < .5) { var tq = new THREE.CylinderGeometry(.6, .6, 1.2, 10); tq.translate((rnd() - .5) * A * .6, H + .66, -F * (.4 + rnd() * .4)); obra.pieza('metal', tq, C(rnd() < .6 ? '#2a2a2a' : '#e8e6e0'), m); }
  var puerta = Math.floor(n / 2);
  for (i = 0; i < n; i++) {
    var cx = -A / 2 + bw * (i + .5);
    var luz = rnd() < (o.luz || .35) ? (rnd() < .5 ? '#ffcf86' : '#f4b467') : null;
    if (i === puerta || (n > 5 && (i === 1 || i === n - 2) && rnd() < .5)) {
      if (o.arco) I.createArchedDoor(obra, m, cx, Math.min(2.4, bw * .55), Math.min(4.2, piso - .8), { marco: mc });
      else I.createDoor(obra, m, cx, Math.min(2.2, bw * .52), Math.min(3.6, piso - 1), { marco: mc });
    } else I.createWindow(obra, m, cx, 1.25, Math.min(1.25, bw * .36), Math.min(2.5, piso - 2.2), { reja: true, marco: mc, luz: luz });
    if (o.pisos !== 1) {
      var wy = piso + .55, wh = Math.min(2.6, H - piso - 2.2);
      var luz2 = rnd() < (o.luz || .35) ? '#ffd28e' : null;
      if (o.balcon === 'cajon' && (i % 2 === (n % 2 ? 0 : 1) || n <= 2)) {
        I.createWindow(obra, m, cx, wy, Math.min(1.3, bw * .4), wh, { marco: mc, luz: luz2 });
        I.createBalcony(obra, m, cx, piso + .25, Math.min(3.0, bw * .78), 'cajon');
      } else if (o.balcon === 'abierto' && i % 2 === 0) {
        I.createWindow(obra, m, cx, wy - .3, Math.min(1.3, bw * .4), wh + .3, { marco: mc, luz: luz2, postigos: true });
        I.createBalcony(obra, m, cx, piso + .2, Math.min(2.0, bw * .6), 'abierto');
      } else I.createWindow(obra, m, cx, wy, Math.min(1.3, bw * .4), wh, { marco: mc, luz: luz2, postigos: rnd() < .3 });
    }
  }
  /* el balcón corrido de las casonas grandes (como el de la foto de la esquina) */
  if (o.balcon === 'largo' && o.pisos !== 1) I.createBalcony(obra, m, 0, piso + .25, A - 1.2, 'cajon');
  return m;
};

/* una casona de esquina: dos fachadas que se encuentran en la esquina sin caras encimadas.
   (x, z): la esquina · giro: hacia dónde mira la primera · s1: hacia qué lado de su eje se extiende
   (+1 o −1) · giro2 y s2: lo mismo para la segunda. La segunda se adelanta 5 cm hacia su calle y se
   corre 5 cm desde la esquina: así ningún muro queda en el mismo plano que otro (sin parpadeos). */
I.createCornerHouse = function (obra, o) {
  function eje(g) { return [Math.cos(g), -Math.sin(g)]; }
  function frente(g) { return [Math.sin(g), Math.cos(g)]; }
  var e1 = eje(o.giro), e2 = eje(o.giro2), f2 = frente(o.giro2);
  var base = { alto: o.alto, color: o.color, marco: o.marco, pisos: o.pisos, luz: o.luz, zocalo: o.zocalo, arco: o.arco };
  I.createColonialFacade(obra, Object.assign({}, base, { x: o.x + e1[0] * o.s1 * o.a / 2, z: o.z + e1[1] * o.s1 * o.a / 2, giro: o.giro, ancho: o.a, fondo: o.b, balcon: o.balcon, sem: o.sem }));
  I.createColonialFacade(obra, Object.assign({}, base, { x: o.x + e2[0] * o.s2 * (o.b / 2 + .05) + f2[0] * .05, z: o.z + e2[1] * o.s2 * (o.b / 2 + .05) + f2[1] * .05,
    giro: o.giro2, ancho: o.b - .1, fondo: o.a, balcon: o.balcon2 || o.balcon, sem: (o.sem || 1) + 7 }));
};

/* ---------- la catedral ---------- */
var AMA = C('#E0A21F'), AMAc = C('#E8B23A');
/* cúpula de revolución con nervaduras blancas (color por vértice) */
I.createDome = function (obra, m, x, y, z, r, alto, op) {
  op = op || {};
  var pts = []; for (var i = 0; i <= 12; i++) { var a = i / 12 * Math.PI / 2; pts.push([Math.cos(a) * r, Math.sin(a) * alto]); }
  var g = I.geoTorno(pts, 48), p = g.attributes.position, cc = new Float32Array(p.count * 3), nerv = op.nervios || 8;
  var bl = BL, am = op.color || AMAc;
  for (i = 0; i < p.count; i++) {
    var ang = Math.atan2(p.getZ(i), p.getX(i)), f = Math.abs(Math.sin(ang * nerv / 2));
    var blanco = f < .09 || p.getY(i) < alto * .05;
    var c = blanco ? bl : am; cc[i * 3] = c[0]; cc[i * 3 + 1] = c[1]; cc[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  g.translate(x, y, z); obra.pieza('estuco', g, [1, 1, 1], m);
  /* tambor con ventanitas y anillo blanco */
  if (op.tambor) {
    var t = new THREE.CylinderGeometry(r * 1.02, r * 1.05, op.tambor, 24); t.translate(x, y - op.tambor / 2, z); obra.pieza('estuco', t, am, m);
    var an = new THREE.CylinderGeometry(r * 1.1, r * 1.1, .3, 24); an.translate(x, y, z); obra.pieza('estuco', an, bl, m);
    for (var k = 0; k < 8; k++) { var aa = k / 8 * Math.PI * 2, wx = x + Math.cos(aa) * r * 1.04, wz = z + Math.sin(aa) * r * 1.04;
      var v = new THREE.BoxGeometry(.5, op.tambor * .5, .2); v.rotateY(-aa + Math.PI / 2); v.translate(wx, y - op.tambor / 2, wz); obra.pieza('vidrio', v, C('#3a3020'), m); }
  }
  /* linterna con su cupulita y la cruz */
  var lr = r * .26, ly = y + alto;
  var l = new THREE.CylinderGeometry(lr, lr * 1.1, lr * 2.2, 12); l.translate(x, ly + lr * 1.1, z); obra.pieza('estuco', l, bl, m);
  var cu = I.geoTorno([[lr * 1.2, 0], [lr * 1.1, lr * .5], [lr * .6, lr * 1.0], [0, lr * 1.2]], 14); cu.translate(x, ly + lr * 2.2, z); obra.pieza('estuco', cu, am, m);
  obra.caja('metal', .08, 1.1, .08, x, ly + lr * 3.4 + .55, z, MET, m); obra.caja('metal', .5, .08, .08, x, ly + lr * 3.4 + .75, z, MET, m);
};
/* torre con campanario: base, dos cuerpos con cornisas, campanario con arcos huecos, cúpula y linterna */
I.createBellTower = function (obra, m, x, z, w, alto, op) {
  op = op || {}; var hb = alto * .62, hc = alto * .26;
  obra.caja('estuco', w, hb, w, x, hb / 2, z - w / 2, AMA, m);
  [-1, 1].forEach(function (s) { obra.caja('estuco', .7, hb, .7, x + s * (w / 2 - .3), hb / 2, z - .2, BL, m); obra.caja('estuco', .7, hb, .7, x + s * (w / 2 - .3), hb / 2, z - w + .2, BL, m); });
  [hb * .48, hb].forEach(function (yy) { I.createRingCornice(obra, m, x, z - w / 2, w, yy, BL); });
  /* el campanario: cuatro pilares de esquina y un arco por cara, hueco por dentro */
  var cw = w * .86, y0 = hb + .4, ab = cw * .42, ah = hc * .78;
  obra.caja('estuco', cw * .62, hc, cw * .62, x, y0 + hc / 2, z - w / 2, OSC, m);               /* el interior en sombra */
  for (var k = 0; k < 4; k++) {
    var giro = k * Math.PI / 2, mm = I.mul(m, I.mul(I.mover(x, 0, z - w / 2), new THREE.Matrix4().makeRotationY(giro)));
    var hz = cw / 2;
    [-1, 1].forEach(function (s) { obra.caja('estuco', (cw - ab) / 2, hc, .7, s * (ab / 2 + (cw - ab) / 4), y0 + hc / 2, hz - .35, AMA, mm);
      obra.caja('estuco', .3, hc, .3, s * (cw / 2 - .1), y0 + hc / 2, hz - .05, BL, mm); });
    var ar = I.geoArco(ab / 2 + .28, ab / 2, .75); ar.translate(0, y0 + ah - ab / 2, hz - .75); obra.pieza('estuco', ar, BL, mm);
    obra.caja('estuco', ab + .6, hc - ah + .1, .7, 0, y0 + ah + (hc - ah) / 2 + .2, hz - .35, AMA, mm);
    obra.caja('estuco', ab + .4, .25, .9, 0, y0 + .12, hz - .3, BL, mm);
    if (k === 0) { var cp = I.geoTorno([[.05, .9], [.45, .55], [.55, .1], [.62, 0]], 14); cp.translate(0, y0 + ah * .45, hz - 1.4); obra.pieza('metal', cp, C('#2b2622'), mm); }
  }
  var yc = y0 + hc;
  I.createRingCornice(obra, m, x, z - w / 2, w + .2, yc, BL);
  obra.caja('estuco', w * .78, 1.2, w * .78, x, yc + 1.0, z - w / 2, AMA, m);
  [-1, 1].forEach(function (s) { [-1, 1].forEach(function (t) {
    var pin = new THREE.ConeGeometry(.22, .9, 8); pin.translate(x + s * w * .44, yc + 1.05, z - w / 2 + t * w * .44); obra.pieza('estuco', pin, BL, m);
    var bo = new THREE.SphereGeometry(.16, 8, 6); bo.translate(x + s * w * .44, yc + 1.55, z - w / 2 + t * w * .44); obra.pieza('estuco', bo, BL, m); }); });
  I.createDome(obra, m, x, yc + 1.6, z - w / 2, w * .4, w * .42, {});
  if (op.reloj) {
    var d = new THREE.CircleGeometry(.95, 28); d.translate(x, hb * .74, z + .02); obra.pieza('vidrio', d, C('#f3ecdc'), m);
    var aro = new THREE.TorusGeometry(1.0, .09, 6, 28); aro.translate(x, hb * .74, z + .05); obra.pieza('estuco', aro, BL, m);
    obra.caja('metal', .07, .7, .03, x, hb * .74 + .3, z + .06, MET, m); obra.caja('metal', .5, .06, .03, x + .22, hb * .74, z + .06, MET, m);
  }
};
/* La catedral completa. (x, z): centro del frente · mira a +Z (giro 0) */
I.createCatedral = function (obra, x, z, giro) {
  var m = I.marco(x, z, giro || 0), W = 20, TW = 7.2, TX = W / 2 + TW / 2 - .3, H = 18.5;
  /* el cuerpo de la nave, largo y bajo, con sus pilastras blancas */
  obra.caja('estuco', W + 2, 16, 56, 0, 8, -30, AMA, m);
  for (var i = 0; i < 9; i++) { [-1, 1].forEach(function (s) { obra.caja('estuco', .14, 14, 1.0, s * (W / 2 + 1.07), 7.6, -6 - i * 6, BL, m); }); }
  [-1, 1].forEach(function (s) { obra.caja('estuco', .3, .5, 56, s * (W / 2 + 1.1), 16.1, -30, BL, m); });
  /* la fachada central (portada-retablo) */
  obra.caja('estuco', W, H, 1.6, 0, H / 2, -.8, AMA, m);
  obra.caja('estuco', W + .1, .9, .14, 0, .45, .05, BL, m);
  [-1, 1].forEach(function (s) { I.createPilaster(obra, m, s * (W / 2 - .45), .9, H - 2, BL, .8); I.createPilaster(obra, m, s * 6.2, .9, 7.4, BL, .5); });
  I.createArchedDoor(obra, m, 0, 3.4, 6.6, { columnas: 2, marco: BL });                          /* primer cuerpo */
  I.createCornice(obra, m, W - 1.2, 8.6, BL, 1.1);
  /* segundo cuerpo: la ventana del coro con su marco y columnitas */
  var ov = new THREE.TorusGeometry(1.15, .26, 8, 28); ov.scale(1, 1.3, 1); ov.translate(0, 11.6, .25); obra.pieza('estuco', ov, BL, m);
  var vd = new THREE.CircleGeometry(1.1, 24); vd.scale(1, 1.3, 1); vd.translate(0, 11.6, .1); obra.pieza('vidrio', vd, C('#3b2f22'), m);
  [-1, 1].forEach(function (s) { for (var c = 0; c < 2; c++) {
    var cx = s * (2.3 + c * .7), col = new THREE.CylinderGeometry(.18, .2, 3.8, 10); col.translate(cx, 11.4, .3); obra.pieza('estuco', col, BL, m);
    obra.caja('estuco', .5, .5, .5, cx, 9.25, .3, BL, m); obra.caja('estuco', .5, .25, .5, cx, 13.4, .3, BL, m); }
    /* hornacinas a los lados */
    var nicho = I.geoVanoArco(1.1, 2.4, .2); nicho.translate(s * 5.2, 10.2, -.12); obra.pieza('estuco', nicho, C('#c98e1c'), m);
    var arq = I.geoArco(.8, .55, .2); arq.translate(s * 5.2, 12.05, .02); obra.pieza('estuco', arq, BL, m); });
  I.createCornice(obra, m, 9, 14.0, BL, 1.0);
  /* remate: escalonado con volutas, hornacina y cruz */
  obra.caja('estuco', 7.2, 3.0, 1.2, 0, 15.8, -.3, AMA, m);
  var rem = I.geoVanoArco(4.4, 5.2, .5); rem.translate(0, 14.2, -.4); obra.pieza('estuco', rem, AMA, m);
  var marcoR = I.geoArco(2.5, 2.2, .55); marcoR.translate(0, 17.0, -.35); obra.pieza('estuco', marcoR, BL, m);
  [-1, 1].forEach(function (s) {
    var vol = I.geoArco(1.5, 1.05, .5); vol.rotateZ(s > 0 ? -Math.PI / 2 : Math.PI / 2); vol.translate(s * 3.6, 14.4, -.3); obra.pieza('estuco', vol, BL, m);
    var pin = new THREE.ConeGeometry(.28, 1.3, 8); pin.translate(s * 4.6, 15.0, .1); obra.pieza('estuco', pin, BL, m);
    var bo = new THREE.SphereGeometry(.2, 8, 6); bo.translate(s * 4.6, 15.8, .1); obra.pieza('estuco', bo, BL, m); });
  var est = I.geoVanoArco(.9, 1.9, .3); est.translate(0, 15.0, -.05); obra.pieza('estuco', est, C('#c98e1c'), m);
  obra.caja('estuco', .5, 1.6, .5, 0, 15.8, .1, BL, m);                                        /* la imagen, apenas sugerida */
  obra.caja('metal', .14, 1.6, .14, 0, 20.1, -.4, MET, m); obra.caja('metal', .8, .14, .14, 0, 20.4, -.4, MET, m);
  /* las dos torres, un poco adelantadas, con sus puertas laterales */
  I.createBellTower(obra, m, -TX, .6, TW, 30, {});
  I.createBellTower(obra, m, TX, .6, TW, 30, { reloj: true });
  [-1, 1].forEach(function (s) {
    var mt = I.mul(m, I.mover(s * TX, 0, .6));
    I.createArchedDoor(obra, mt, 0, 2.2, 4.6, { marco: BL });
    obra.caja('estuco', 3.4, .3, .5, 0, 5.4, .1, BL, mt);
    var fr = I.geoArco(1.5, 1.2, .4); fr.translate(0, 5.5, -.1); obra.pieza('estuco', fr, BL, mt);
    I.createWindow(obra, mt, 0, 9.6, 1.0, 1.9, { marco: BL });
  });
  /* la cúpula de la nave, detrás */
  I.createDome(obra, m, 0, 20.5, -24, 4.6, 5.0, { tambor: 3.2 });
  /* la capilla lateral (a la derecha) con su cúpula y portada de columnas */
  var ma = I.mul(m, I.mover(TX + TW / 2 + 7.5, 0, -1.5));
  obra.caja('estuco', 15, 10.5, 16, 0, 5.25, -8, AMA, ma);
  I.createCornice(obra, ma, 15, 10.2, BL, 1);
  for (i = 0; i < 4; i++) I.createPilaster(obra, ma, -7.2 + i * 4.8, .9, 9, BL, .5);
  I.createArchedDoor(obra, ma, 2.2, 2.4, 4.6, { columnas: 1, marco: BL });
  I.createWindow(obra, ma, -4.2, 3.2, 1.1, 1.7, { reja: true, marco: BL });
  I.createDome(obra, ma, -1, 12.6, -8, 3.6, 3.4, { tambor: 2.2 });
  /* el atrio de piedra clara con sus gradas */
  var at = I.mul(m, I.mover(TX * .25, 0, 6));
  obra.caja('piedra', 44, .45, 12, 0, .22, 0, C('#e6dcc9'), at);
  for (i = 0; i < 3; i++) obra.caja('piedra', 44, .15, .5, 0, .07 + i * .15, 6.2 - i * .5, C('#d9cdb7'), at);
  return m;
};
})();

;
/* RuwayIntro — plaza.js: la Plaza de Armas de Trujillo completa (createTrujilloPlaza).

   Distribución (de las fotos): plaza cuadrada y peatonal de 100 × 100, con el Monumento a la
   Libertad al centro sobre su base escalonada; ocho caminos (cuatro en cruz y cuatro en
   diagonal) dejan ocho jardines con parterres de flores rojas y blancas, árboles de copa ancha y
   palmeras reales; bancas y faroles negros; el borde con su sardinel amarillo. Alrededor, calles
   de 12,5 m y las manzanas: la Catedral al norte (algo a la izquierda, para que el monumento no la
   tape), casonas de colores con balcones de cajón, un palacio blanco y azul, esquinas con sus dos
   fachadas y, más allá, la ciudad baja y los cerros.

   Rendimiento: todo lo que comparte material va en una sola malla (la obra). Las palmeras se
   mecen en el vertex shader (sin animar objetos). Una luz de sol, una de cielo y ninguna sombra
   real: las sombras de contacto son manchas pintadas. */
(function () {
'use strict';
var I = window.__RI, C = I.col;
var PIEDRA = C('#d8cab0'), PIEDRAo = C('#bfae92'), BL = C('#F4EFE3'), MET = C('#1c1a19');

/* ---------- figuras de piedra (las esculturas del monumento) ----------
   De las fotos: figuras macizas y musculosas de travertino, de formas redondeadas y compactas
   (pecho ancho, hombros y muslos fuertes, manos y pies grandes). Cada figura se arma desde sus
   articulaciones con volúmenes de anatomía (pelvis, abdomen, pecho, hombros, bíceps, antebrazos,
   muslos, pantorrillas, manos, pies, cuello, cráneo y mandíbula). Es una interpretación: no copia
   las esculturas de Edmund Möller. */
var Y1 = new THREE.Vector3(0, 1, 0);
function orientar(g, c, dir) {
  var q = new THREE.Quaternion().setFromUnitVectors(Y1, dir.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1))); return g;
}
function capsula(a, b, r1, r2) {
  var d = new THREE.Vector3().subVectors(b, a), L = d.length(), mid = a.clone().add(b).multiplyScalar(.5);
  var g = new THREE.CylinderGeometry(r2 || r1, r1, L, 10, 1, true);
  var s1 = new THREE.SphereGeometry(r1, 10, 7); s1.translate(0, -L / 2, 0);
  var s2 = new THREE.SphereGeometry(r2 || r1, 10, 7); s2.translate(0, L / 2, 0);
  return [g, s1, s2].map(function (x) { return orientar(x, mid, d); });
}
/* un volumen ovalado: centro, eje largo (dir), y sus tres radios (ancho, largo, fondo) */
/* I.DETALLE (1 en la intro): el juego del árbol, que dibuja la plaza muchos minutos y no 17 s, la
   arma con menos segmentos en las figuras del monumento y en las bancas (en un celular barato el
   monumento solo eran 94 mil triángulos). Q(n): segmentos según ese detalle. */
function Q(n, min) { return Math.max(min || 3, Math.round(n * (I.DETALLE || 1))); }
function ovalo(c, dir, rx, ry, rz) { var g = new THREE.SphereGeometry(1, Q(12, 6), Q(9, 5)); g.scale(rx, ry, rz); return orientar(g, c, dir); }
function V(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
/* perfiles de anatomía (t de -1 a 1 a lo alto del tronco): ancho y fondo */
function perfil(tab, t) { for (var i = 1; i < tab.length; i++) if (t <= tab[i][0]) { var a = tab[i - 1], b = tab[i], f = (t - a[0]) / (b[0] - a[0]); f = f * f * (3 - 2 * f); return a[1] + (b[1] - a[1]) * f; } return tab[tab.length - 1][1]; }
var ANCHO_T = [[-1, .3], [-.86, .86], [-.6, .96], [-.2, .8], [.2, .94], [.55, 1.12], [.8, 1.08], [.93, .62], [1, .3]];
var FONDO_T = [[-1, .3], [-.8, .7], [-.55, .76], [-.15, .6], [.25, .7], [.55, .74], [.85, .58], [1, .3]];
/* el tronco entero en una sola pieza: caderas, cintura, pecho, hombros (sin bolas sueltas) */
function tronco(cad, pec, lado, k) {
  var up = pec.clone().sub(cad), L = up.length(); up.normalize();
  var x = lado.clone().sub(up.clone().multiplyScalar(lado.dot(up))).normalize(), z = new THREE.Vector3().crossVectors(x, up);
  var g = new THREE.SphereGeometry(1, Q(20, 8), Q(18, 8)), p = g.attributes.position;
  for (var i = 0; i < p.count; i++) {
    var X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), w = perfil(ANCHO_T, Y), d = perfil(FONDO_T, Y);
    if (Z > 0 && Y > .2 && Y < .65) d *= 1.1;                   /* pecho */
    if (Z < 0 && Y > -.8 && Y < -.35) d *= 1.12;                /* glúteos */
    if (Z > 0 && Y > -.35 && Y < .1) d *= .93;                  /* vientre plano */
    p.setXYZ(i, X * w * .235 * k, Y * L * .68, Z * d * .21 * k);
  }
  g.computeVertexNormals();
  var c = cad.clone().addScaledVector(up, L * .52);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, up, z).setPosition(c));
  return g;
}
/* un miembro con su músculo: un torno de a a b, de radio r0 a r1, con un abultamiento en bp */
function miembro(a, b, r0, r1, bulto, bp) {
  var d = new THREE.Vector3().subVectors(b, a), L = d.length(), pts = [];
  var N = Q(14, 6);
  for (var i = 0; i <= N; i++) {
    var s = i / N, r = (r0 + (r1 - r0) * s) * (1 + bulto * Math.exp(-Math.pow((s - bp) / .26, 2)));
    var cap = s < .08 ? Math.sqrt(1 - Math.pow(1 - s / .08, 2)) : s > .92 ? Math.sqrt(1 - Math.pow((s - .92) / .08, 2)) : 1;
    pts.push(new THREE.Vector2(Math.max(.001, r * cap), s * L - L / 2));
  }
  var g = new THREE.LatheGeometry(pts, Q(12, 5));
  return orientar(g, a.clone().add(b).multiplyScalar(.5), d);
}
/* una figura desde sus articulaciones; obra, material, color, matriz */
function figura(obra, mat, col, m, J, op) {
  op = op || {}; var k = op.k || 1, piezas = [];
  function P(n) { return V(J[n]); }
  function ov(c, dir, rx, ry, rz) { piezas.push(ovalo(c, dir, rx * k, ry * k, rz * k)); }
  function L(a, b, t) { return a.clone().lerp(b, t); }
  var cad = P('cad'), pec = P('pec'), cue = P('cue'), cab = P('cab'), up = pec.clone().sub(cad);
  var lado = P('hd').sub(P('hi')).normalize(), frente = new THREE.Vector3().crossVectors(lado, up).normalize();
  piezas.push(tronco(cad.clone().addScaledVector(up, -.25), pec.clone().addScaledVector(up, .12), lado, k));
  piezas.push(miembro(pec.clone().addScaledVector(up, .05), cab.clone().addScaledVector(cab.clone().sub(cue), -.4), .085 * k, .07 * k, .05, .3));   /* cuello */
  /* cabeza: cráneo, mandíbula, nariz, cejas y pelo */
  var dc = cab.clone().sub(cue).normalize();
  ov(cab, dc, .108, .13, .118);
  ov(cab.clone().addScaledVector(dc, -.065 * k).addScaledVector(frente, .04 * k), dc, .08, .062, .082);
  var nariz = new THREE.ConeGeometry(.022 * k, .055 * k, 6); orientar(nariz, cab.clone().addScaledVector(frente, .118 * k).addScaledVector(dc, -.01 * k), dc); piezas.push(nariz);
  ov(cab.clone().addScaledVector(frente, .09 * k).addScaledVector(dc, .03 * k), lado, .03, .1, .025);
  ov(cab.clone().addScaledVector(dc, .035 * k).addScaledVector(frente, -.025 * k), dc, .118, .115, .125);
  /* brazos: deltoides, brazo con bíceps, antebrazo, mano */
  [['hi', 'ci', 'mi'], ['hd', 'cd', 'md']].forEach(function (br) {
    var h = P(br[0]), c = P(br[1]), mm = P(br[2]), dv = mm.clone().sub(c).normalize();
    ov(h.clone().addScaledVector(up.clone().normalize(), -.02 * k), c.clone().sub(h), .1, .11, .1);
    piezas.push(miembro(h, c, .09 * k, .068 * k, .18, .42));
    ov(c, c.clone().sub(h), .068, .075, .068);                                         /* codo */
    piezas.push(miembro(c, mm, .07 * k, .048 * k, .16, .25));
    ov(mm.clone().addScaledVector(dv, .06 * k), dv, .05, .08, .03);
  });
  if (!op.tunica) {
    [[-1, 'ri', 'pi'], [1, 'rd', 'pd']].forEach(function (pi) {
      var cad2 = cad.clone().addScaledVector(lado, pi[0] * .1 * k).addScaledVector(up.clone().normalize(), -.04 * k), r = P(pi[1]), f = P(pi[2]);
      piezas.push(miembro(cad2, r, .135 * k, .085 * k, .16, .35));                   /* muslo */
      piezas.push(miembro(r, f, .085 * k, .05 * k, .2, .28));                        /* pierna con pantorrilla */
      ov(r.clone().addScaledVector(frente, .04 * k), up, .065, .06, .055);           /* rodilla */
      ov(f.clone().add(new THREE.Vector3(0, .025 * k, 0)).addScaledVector(frente, .065 * k), frente, .055, .12, .038);   /* pie */
    });
  } else { var t = new THREE.CylinderGeometry(.24 * k, .5 * k, cad.y, 18, 1, true); t.translate(cad.x, cad.y / 2, cad.z); piezas.push(t); }
  piezas.forEach(function (g) { obra.pieza(mat, g, col, m); });
}
/* la roca tallada sobre la que se apoyan los grupos */
function roca(obra, m, x, y, z, s, sem) {
  var rnd = I.azar(sem), ru = I.ruido(6, rnd), g = new THREE.SphereGeometry(s, Q(14, 7), Q(9, 5)), p = g.attributes.position;
  for (var i = 0; i < p.count; i++) { var f = .85 + ru(p.getX(i) * 2 + 3, p.getZ(i) * 2 + p.getY(i)) * .3; p.setXYZ(i, p.getX(i) * f * 1.15, Math.max(-s * .2, p.getY(i)) * f * .55, p.getZ(i) * f); }
  g.computeVertexNormals(); g.translate(x, y, z); obra.pieza('piedra', g, PIEDRAo, m);
}
function cuerpo(o) {
  var J = { cad: [0, 1, 0], pec: [0, 1.45, 0], cue: [0, 1.6, 0], cab: [0, 1.78, 0], hi: [-.22, 1.47, 0], hd: [.22, 1.47, 0],
    ci: [-.28, 1.18, 0], mi: [-.3, .92, .05], cd: [.28, 1.18, 0], md: [.3, .92, .05], ri: [-.12, .52, 0], pi: [-.13, 0, .03], rd: [.12, .52, 0], pd: [.13, 0, .03] };
  for (var k in o) J[k] = o[k]; return J;
}
var POSES = {
  /* el doblegado: de rodillas, encorvado bajo un peso */
  doblegado: cuerpo({ cad: [0, .62, 0], pec: [0, .98, .32], cue: [0, 1.04, .46], cab: [0, 1.02, .62], hi: [-.24, 1.05, .3], hd: [.24, 1.05, .3], ci: [-.32, .75, .42], mi: [-.3, .45, .5], cd: [.32, .75, .42], md: [.3, .45, .5], ri: [-.18, .3, .32], pi: [-.18, 0, .05], rd: [.18, .3, .32], pd: [.18, 0, .05] }),
  /* el que lucha: tenso, con los brazos hacia atrás */
  lucha: cuerpo({ cad: [0, .95, 0], pec: [0, 1.42, .16], cue: [0, 1.58, .22], cab: [0, 1.75, .28], hi: [-.24, 1.44, .12], hd: [.24, 1.44, .12], ci: [-.4, 1.22, -.2], mi: [-.46, 1.05, -.46], cd: [.42, 1.6, -.1], md: [.5, 1.9, -.05], ri: [-.13, .52, .3], pi: [-.13, 0, .4], rd: [.14, .46, -.22], pd: [.16, .04, -.44] }),
  /* el que se libera: brazos arriba, puños cerrados */
  libre: cuerpo({ cad: [0, 1, 0], pec: [0, 1.48, 0], cue: [0, 1.62, 0], cab: [0, 1.79, 0], hi: [-.23, 1.5, 0], hd: [.23, 1.5, 0], ci: [-.42, 1.86, 0], mi: [-.45, 2.2, .04], cd: [.42, 1.86, 0], md: [.45, 2.2, .04] }),
  /* sentados: la madre con frutos, el anciano y el joven que lee */
  sentado: cuerpo({ cad: [0, .5, 0], pec: [0, .95, -.05], cue: [0, 1.08, -.04], cab: [0, 1.24, 0], hi: [-.21, .98, -.04], hd: [.21, .98, -.04], ci: [-.3, .72, .14], mi: [-.18, .58, .32], cd: [.3, .72, .14], md: [.22, .6, .34], ri: [-.14, .52, .42], pi: [-.16, 0, .5], rd: [.14, .52, .42], pd: [.16, 0, .5] }),
  recostado: cuerpo({ cad: [0, .35, 0], pec: [.05, .78, .1], cue: [.06, .9, .12], cab: [.08, 1.05, .16], hi: [-.16, .82, .08], hd: [.26, .82, .1], ci: [-.4, .6, .2], mi: [-.55, .42, .32], cd: [.45, .62, .25], md: [.6, .45, .35], ri: [-.2, .3, .55], pi: [-.5, .12, .8], rd: [.2, .3, .55], pd: [.55, .12, .85] })
};

/* ---------- el Monumento a la Libertad (createPlazaMonument) ----------
   De las fotos: plataforma circular escalonada con escalinatas en cruz y muros curvos que
   abrazan la terraza; en los extremos de los muros, pedestales con grupos esculpidos; al centro
   el pedestal cuadrado de travertino con relieves de bronce; tres grupos alrededor del pilar; un
   pilar facetado que se afina; arriba el globo y la figura de bronce con la antorcha en alto,
   apoyada en un pie. Es una versión estilizada: no copia la obra de Edmund Moeller. */
I.createPlazaMonument = function (obra) {
  var m = new THREE.Matrix4(), y = 0, i;
  /* plataforma circular con tres gradas */
  [[11.5, .3], [10.8, .3], [10.1, .3]].forEach(function (e) { var g = new THREE.CylinderGeometry(e[0], e[0] + .1, e[1], 48); g.translate(0, y + e[1] / 2, 0); obra.pieza('piedra', g, PIEDRAo, m); y += e[1]; });
  var terraza = 1.9;
  var t = new THREE.CylinderGeometry(8.6, 8.8, terraza - y, 48); t.translate(0, y + (terraza - y) / 2, 0); obra.pieza('piedra', t, PIEDRA, m);
  /* escalinatas en cruz y muros curvos entre ellas */
  for (var k = 0; k < 4; k++) {
    var giro = k * Math.PI / 2, mk = new THREE.Matrix4().makeRotationY(giro);
    for (i = 0; i < 6; i++) { var g2 = new THREE.BoxGeometry(5.4, (terraza - .9) / 6 * (i + 1), .55); g2.translate(0, .9 + (terraza - .9) / 6 * (i + 1) / 2, 10.0 - i * .5); obra.pieza('piedra', g2, i % 2 ? PIEDRA : PIEDRAo, mk); }
    [-1, 1].forEach(function (s) {
      var bar = new THREE.BoxGeometry(.5, .95, 3.4); bar.translate(s * 2.95, terraza + .2 - .7, 8.9); obra.pieza('piedra', bar, PIEDRA, mk);
    });
    /* muro curvo (un arco de anillo) con su remate y el pedestal con su grupo al extremo */
    var a0 = giro + Math.PI / 4 - .55, a1 = giro + Math.PI / 4 + .55;
    var sh = new THREE.Shape(); sh.absarc(0, 0, 8.6, a0, a1, false); sh.absarc(0, 0, 8.0, a1, a0, true);
    var muro = new THREE.ExtrudeGeometry(sh, { depth: 1.15, bevelEnabled: false, curveSegments: 12 }); muro.rotateX(-Math.PI / 2); muro.translate(0, terraza, 0);
    obra.pieza('piedra', muro, PIEDRA, m);
    [a0 - .08, a1 + .08].forEach(function (a, j) {
      var px = Math.cos(a) * 8.3, pz = -Math.sin(a) * 8.3;
      var ped = new THREE.BoxGeometry(1.9, 1.5, 1.9); ped.rotateY(a); ped.translate(px, terraza + .75, pz); obra.pieza('piedra', ped, PIEDRA, m);
      var pl = new THREE.BoxGeometry(.9, .6, .05); pl.rotateY(Math.PI / 2 - a); pl.translate(px * 1.12, terraza + .8, pz * 1.12); obra.pieza('bronce', pl, C('#3a3a2c'), m);
      var mf = new THREE.Matrix4().makeRotationY(Math.PI / 2 - a + Math.PI).setPosition(px, terraza + 1.5, pz);
      roca(obra, mf, 0, 0, .1, .5, 90 + j + k * 2);
      figura(obra, 'piedra', PIEDRA, mf, j ? POSES.recostado : POSES.sentado, { k: 1.45 });
    });
  }
  /* el pedestal central de travertino con relieves de bronce */
  var py = terraza, pw = 5.4, ph = 3.4;
  obra.caja('piedra', pw + .8, .5, pw + .8, 0, py + .25, 0, PIEDRAo, m);
  obra.caja('piedra', pw, ph, pw, 0, py + .5 + ph / 2, 0, PIEDRA, m);
  obra.caja('piedra', pw + .5, .35, pw + .5, 0, py + .5 + ph + .17, 0, PIEDRAo, m);
  for (k = 0; k < 4; k++) {
    var mr = new THREE.Matrix4().makeRotationY(k * Math.PI / 2);
    obra.caja('bronce', 3.4, 2.2, .08, 0, py + .5 + ph * .55, pw / 2 + .04, C('#3d4434'), mr);
    var rel = new THREE.PlaneGeometry(3.1, 1.9); rel.translate(0, py + .5 + ph * .55, pw / 2 + .085); rel.userData = { uvPropio: true }; obra.pieza('relieve', rel, [1, 1, 1], mr);
    obra.caja('piedra', 3.5, .18, .14, 0, py + .5 + ph * .55 + 1.1, pw / 2 + .06, PIEDRAo, mr);
  }
  var top = py + .5 + ph + .35;
  /* los tres grupos alrededor del pilar: doblegado, en lucha, liberado */
  ['doblegado', 'lucha', 'libre'].forEach(function (p, j) {
    var a = j * Math.PI * 2 / 3 + Math.PI / 3, x = Math.sin(a) * 2.25, z = Math.cos(a) * 2.25;
    var mf = new THREE.Matrix4().makeRotationY(a).setPosition(x, top, z);
    obra.caja('piedra', 1.8, .5, 1.5, 0, .25, 0, PIEDRAo, mf);
    roca(obra, mf, 0, .5, 0, .6, 70 + j);
    figura(obra, 'piedra', PIEDRA, I.mul(mf, I.mover(-.25, .5, .05)), POSES[p], { k: 1.6 });
    /* cada grupo central tiene una segunda figura, enlazada con la primera */
    var otra = ['sentado', 'recostado', 'doblegado'][j];
    figura(obra, 'piedra', PIEDRA, I.mul(mf, I.mul(I.mover(.45, .5, -.15), new THREE.Matrix4().makeRotationY(-.6))), POSES[otra], { k: 1.45 });
  });
  /* el pilar facetado que se afina, con sus molduras */
  var pil = new THREE.CylinderGeometry(.85, 1.25, 6.6, 6, 1); pil.translate(0, top + 3.3, 0); obra.pieza('piedra', pil, PIEDRA, m);
  var pil2 = new THREE.CylinderGeometry(1.0, .85, .9, 6, 1); pil2.rotateY(Math.PI / 6); pil2.translate(0, top + 6.9, 0); obra.pieza('piedra', pil2, PIEDRAo, m);
  obra.caja('piedra', 2.9, .35, 2.9, 0, top + .17, 0, PIEDRAo, m);
  obra.caja('piedra', 2.4, .3, 2.4, 0, top + .5, 0, PIEDRA, m);
  var gy = top + 7.35;
  /* el globo y la figura de bronce, apoyada en un pie, con la capa y la antorcha en alto */
  var globo = new THREE.SphereGeometry(.78, 28, 18); globo.rotateY(1.2); globo.translate(0, gy + .78, 0); globo.userData = { uvPropio: true }; obra.pieza('globo', globo, [1, 1, 1], m);   /* con sus continentes en relieve */
  var fy = gy + 1.5, k2 = 2.1;
  /* como en la foto: de pie sobre el globo, apoyado en un pie; la antorcha en alto con la mano
     izquierda, el brazo derecho abajo, la cabeza inclinada mirando a la plaza */
  var J = cuerpo({ cad: [0, 1.0, 0], pec: [0, 1.48, 0], cue: [0, 1.62, .02], cab: [0, 1.78, .07], hi: [-.22, 1.5, 0], hd: [.22, 1.5, 0],
    ci: [-.31, 1.86, .02], mi: [-.29, 2.2, .04], cd: [.31, 1.2, .03], md: [.37, .93, .09], ri: [-.1, .53, -.07], pi: [-.13, .1, -.22], rd: [.08, .52, .04], pd: [.05, 0, 0] });
  var mf2 = new THREE.Matrix4().makeRotationY(.35); mf2.scale(new THREE.Vector3(k2, k2, k2)); mf2.setPosition(0, fy, 0);
  figura(obra, 'bronce', C('#3f5c4a'), mf2, J, { k: 1 });
  var capa = new THREE.Shape(); capa.moveTo(-.25, 1.52); capa.quadraticCurveTo(-.75, 1.1, -1.05, .2); capa.quadraticCurveTo(-.7, .35, -.45, .3); capa.quadraticCurveTo(-.15, .9, .25, 1.5); capa.lineTo(-.25, 1.52);
  var cg = new THREE.ExtrudeGeometry(capa, { depth: .07, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, curveSegments: 10 }); cg.translate(0, 0, -.22); obra.pieza('bronce', cg, C('#36513f'), mf2);
  var antorcha = new THREE.Vector3(-.29, 2.6, .04).applyMatrix4(mf2);
  var mango = new THREE.CylinderGeometry(.16, .09, 1.6, 10); mango.translate(antorcha.x, antorcha.y - .6, antorcha.z);
  obra.pieza('bronce', mango, C('#36513f'));
  /* la llama de la antorcha, también de bronce (en la plaza es metal, no fuego) */
  var llama = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.2, .1), new THREE.Vector2(.24, .3), new THREE.Vector2(.16, .55), new THREE.Vector2(.05, .8), new THREE.Vector2(0, .95)], 10);
  llama.scale(1.7, 1.7, 1.7); llama.translate(antorcha.x, antorcha.y + .15, antorcha.z); obra.pieza('bronce', llama, C('#4a6a50'));
  return { antorcha: antorcha, alto: antorcha.y + .6, terraza: terraza };
};

/* ---------- vegetación ---------- */
/* palmera real: tronco gris liso y algo panzón, capitel verde y un penacho de hojas que se mecen */
I.createPalmTree = function (obra, x, z, alto, sem) {
  /* ninguna igual a otra: cada una se inclina un poco hacia su lado, con su número de hojas,
     su largo y su tono */
  var rnd = I.azar(sem), m = I.mover(x, 0, z);
  var la = rnd() * Math.PI * 2, lk = .012 + rnd() * .03, lx = Math.cos(la) * lk, lz = Math.sin(la) * lk;
  var tr = new THREE.CylinderGeometry(.33 + rnd() * .04, .42 + rnd() * .06, alto, 10, 6, true), p = tr.attributes.position;
  for (var i = 0; i < p.count; i++) { var yy = p.getY(i) / alto + .5, k = 1 + Math.sin(yy * Math.PI) * .12, Y = yy * alto;   /* inclinada desde la base */ p.setX(i, p.getX(i) * k + lx * Y); p.setZ(i, p.getZ(i) * k + lz * Y); }
  tr.translate(0, alto / 2, 0);
  tr.computeVertexNormals(); obra.pieza('tronco', tr, C('#a8a399', .92 + rnd() * .14), m);
  var ox = lx * alto, oz = lz * alto;
  var cap = new THREE.CylinderGeometry(.33, .36, 2.2, 10); cap.translate(ox, alto + 1.1, oz); obra.pieza('estuco', cap, C('#6f8a4c', .9 + rnd() * .2), m);
  var n = 11 + Math.floor(rnd() * 5), top = alto + 2.1, cx = x + ox, cz = z + oz;
  for (var h = 0; h < n; h++) {
    var ang = h / n * Math.PI * 2 + rnd() * .35, L = 3.8 + rnd() * 1.6, sube = .7 + rnd() * 1.0, cae = 2.3 + rnd() * 1.6;
    var dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)), lado = new THREE.Vector3(-dir.z, 0, dir.x);
    var seg = 7, pos = [], uv = [], mec = [], idx = [];
    for (var s = 0; s <= seg; s++) {
      var tt = s / seg, c = new THREE.Vector3(cx, top, cz).addScaledVector(dir, L * tt); c.y += sube * tt * 2 - cae * tt * tt;
      var w = (Math.sin(tt * Math.PI) * .9 + .12) * 1.1, tw = .35 + tt * .5;
      var a = c.clone().addScaledVector(lado, -w).add(new THREE.Vector3(0, -w * tw, 0)), b = c.clone().addScaledVector(lado, w).add(new THREE.Vector3(0, -w * tw, 0));
      pos.push(a.x, a.y, a.z, c.x, c.y + .05, c.z, b.x, b.y, b.z); uv.push(0, tt, .5, tt, 1, tt); mec.push(tt, tt, tt);
      if (s) { var o = (s - 1) * 3; idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    g.userData = { uvPropio: true, extra: { meceo: mec } };
    var tono = .8 + rnd() * .34; obra.pieza('palma', g, C(rnd() < .22 ? '#7d8a45' : rnd() < .5 ? '#4f7d36' : '#5a8a3c', tono));
  }
};
/* árbol de copa ancha (los de los jardines): tronco que se abre en ramas y una copa hecha de
   matas con relieve, más oscura por dentro y por debajo, cubierta de racimos de hojas recortadas */
I.createTree = function (obra, x, z, r, sem) {
  var rnd = I.azar(sem), m = I.mover(x, 0, z), TR = C('#5e4b3a', .9 + rnd() * .2);
  var curva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3((rnd() - .5) * .3, 1.4, (rnd() - .5) * .3), new THREE.Vector3((rnd() - .5) * .4, 2.7, (rnd() - .5) * .4)]);
  var t = new THREE.TubeGeometry(curva, 8, .27, 9, false), tp = t.attributes.position;
  for (var i = 0; i < tp.count; i++) { var f = 1.15 - tp.getY(i) / 2.7 * .45; var cx = curva.getPoint(I.lim(tp.getY(i) / 2.7, 0, 1)); tp.setX(i, cx.x + (tp.getX(i) - cx.x) * f); tp.setZ(i, cx.z + (tp.getZ(i) - cx.z) * f); }
  t.computeVertexNormals(); obra.pieza('tronco', t, TR, m);
  var cima = curva.getPoint(1);
  for (var b = 0; b < 5; b++) { var a = b / 5 * 6.283 + rnd(), L = r * (.55 + rnd() * .3);
    var rc = new THREE.CatmullRomCurve3([cima, cima.clone().add(new THREE.Vector3(Math.cos(a) * L * .4, .7, Math.sin(a) * L * .4)), cima.clone().add(new THREE.Vector3(Math.cos(a) * L, 1.3 + rnd() * .6, Math.sin(a) * L))]);
    obra.pieza('tronco', new THREE.TubeGeometry(rc, 6, .11, 6, false), TR, m); }
  var ruido = I.ruido(8, rnd), y0 = 3.6;
  /* el volumen de la copa: matas suaves (esferas con relieve), más oscuras por dentro y por debajo */
  for (i = 0; i < 9; i++) {
    var an = rnd() * 6.283, d = Math.sqrt(rnd()) * r * .6, s = r * (.42 + rnd() * .22), cy = y0 + .4 + (1 - d / r) * 1.1 + rnd() * .5;
    var g = new THREE.SphereGeometry(s, 12, 9), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (var v = 0; v < p.count; v++) { var px = p.getX(v), py = p.getY(v), pz = p.getZ(v), n = .82 + ruido(px * 1.6 + i * 3, pz * 1.6 + py * 1.3) * .32;
      p.setXYZ(v, px * n, py * n * .66, pz * n);
      var luz = I.lim(.55 + py / s * .35 + (cy - y0) * .06, .4, 1.0); col[v * 3] = luz; col[v * 3 + 1] = luz; col[v * 3 + 2] = luz; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.translate(Math.cos(an) * d, cy, Math.sin(an) * d);
    obra.pieza('verde', g, C(rnd() < .5 ? '#33602b' : '#3e6c31', .85 + rnd() * .15), m);
  }
  /* la superficie de hojas: racimos recortados sobre un óvalo, mirando hacia afuera (así la copa
     tiene borde de hojas y no de bolas) */
  var cen = new THREE.Vector3(0, y0 + 1.2, 0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  for (i = 0; i < 90; i++) {
    var th = rnd() * 6.283, ph = Math.acos(1 - rnd() * 1.6), dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    var pos = cen.clone().add(new THREE.Vector3(dir.x * r * (.9 + rnd() * .2), dir.y * r * .62 * (.9 + rnd() * .2), dir.z * r * (.9 + rnd() * .2)));
    var hq = new THREE.PlaneGeometry(1.3 + rnd() * .5, 1.3 + rnd() * .5); hq.rotateZ(rnd() * 6.283);
    Q.setFromUnitVectors(Z, dir); M.compose(pos, Q, new THREE.Vector3(1, 1, 1)); hq.applyMatrix4(M);
    hq.userData = { uvPropio: true, extra: { meceo: [.1, .1, .1, .1] } };
    obra.pieza('hojas', hq, C(rnd() < .4 ? '#4b7a3a' : rnd() < .7 ? '#5d8f45' : '#3d6a30', (.8 + rnd() * .3) * (.75 + dir.y * .3)), m);
  }
};
I.createShrub = function (obra, x, z, r, sem) {
  var g = new THREE.SphereGeometry(r, 10, 8); g.scale(1, 1.25, 1); g.translate(x, r * 1.15, z); obra.pieza('verde', g, C('#4d7d3e', .9 + (sem % 5) * .05));
};

/* ---------- mobiliario ---------- */
I.createStreetLamp = function (obra, x, z, luces) {
  var m = I.mover(x, 0, z);
  var b = new THREE.CylinderGeometry(.2, .28, .7, 10); b.translate(0, .35, 0); obra.pieza('metal', b, MET, m);
  var p = new THREE.CylinderGeometry(.06, .09, 4.0, 8); p.translate(0, 2.7, 0); obra.pieza('metal', p, MET, m);
  obra.caja('metal', .5, .08, .5, 0, 4.7, 0, MET, m);
  obra.caja('luz', .34, .5, .34, 0, 5.0, 0, C('#ffd9a0'), m);
  [-1, 1].forEach(function (s) { [-1, 1].forEach(function (t) { obra.caja('metal', .04, .55, .04, s * .19, 5.0, t * .19, MET, m); }); });
  var c = new THREE.ConeGeometry(.36, .3, 4); c.rotateY(Math.PI / 4); c.translate(0, 5.42, 0); obra.pieza('metal', c, MET, m);
  luces.push(x, 5.0, z);
};
/* banca de plaza: costados de fierro fundido con volutas, asiento y respaldo de listones de madera
   barnizada (cada listón de su tono), apoyabrazos curvos */
var costadoBanca = null;
function formaCostado() {
  var sh = new THREE.Shape();
  sh.moveTo(-.28, 0); sh.lineTo(-.22, 0); sh.quadraticCurveTo(-.2, .22, -.17, .4);       /* pata delantera */
  sh.lineTo(.2, .42); sh.quadraticCurveTo(.25, .2, .3, 0); sh.lineTo(.36, 0);           /* pata trasera */
  sh.quadraticCurveTo(.3, .3, .3, .46); sh.lineTo(.42, .9); sh.lineTo(.36, .91);         /* poste del respaldo */
  sh.lineTo(.25, .5); sh.lineTo(-.15, .48);
  sh.quadraticCurveTo(-.24, .52, -.28, .64); sh.quadraticCurveTo(-.3, .7, -.24, .7);       /* voluta del apoyabrazos */
  sh.quadraticCurveTo(-.18, .7, -.2, .64); sh.quadraticCurveTo(-.22, .56, -.25, .45);
  sh.quadraticCurveTo(-.28, .25, -.28, 0);
  return sh;
}
I.createBench = function (obra, x, z, giro, sem) {
  var m = I.marco(x, z, giro), rnd = I.azar(sem || Math.round(x * 31 + z * 17));
  if (!costadoBanca) costadoBanca = formaCostado();
  [-1, 1].forEach(function (s) {
    var g = new THREE.ExtrudeGeometry(costadoBanca, { depth: .045, bevelEnabled: (I.DETALLE || 1) >= 1, bevelThickness: .008, bevelSize: .006, bevelSegments: 1, curveSegments: Q(6, 2) });
    g.rotateY(Math.PI / 2); g.translate(s * .86 - .022, 0, 0); obra.pieza('metal', g, MET, m);
    /* apoyabrazos curvo */
    var ap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * .86, .68, -.25), new THREE.Vector3(s * .86, .72, 0), new THREE.Vector3(s * .86, .62, .22)]), 8, .022, 6, false);
    obra.pieza('metal', ap, MET, m);
  });
  /* travesaño de fierro bajo el asiento */
  obra.caja('metal', 1.7, .04, .04, 0, .38, .05, MET, m);
  var tono = function () { return C(['#7a4b2a', '#83532f', '#6d4325', '#8a5a34'][Math.floor(rnd() * 4)], .9 + rnd() * .15); };
  /* asiento: cinco listones con un poco de curva hacia atrás */
  for (var i = 0; i < 5; i++) obra.caja('madera', 1.92, .035, .075, 0, .45 + i * .006, .19 - i * .085, tono(), m);
  /* respaldo inclinado: tres listones */
  for (i = 0; i < 3; i++) { var yy = .6 + i * .12, zz = -.3 - .3 * (yy - .5) + .03; var r = new THREE.BoxGeometry(1.92, .085, .03); r.rotateX(.29); r.translate(0, yy, zz); obra.pieza('madera', r, tono(), m); }
};

/* ---------- el cielo del atardecer ---------- */
I.createSky = function (escena, sol) {
  /* nubes: velos alargados y suaves pintados con degradados (sin ruido de cuadrícula) */
  var c = I.lienzo(512, 128), g = c.getContext('2d'), rnd = I.azar(5);
  for (var i = 0; i < 46; i++) {
    var x = rnd() * 512, y = 128 - Math.pow(rnd(), 1.6) * 100 - 8, rx = 30 + rnd() * 90, ry = 3 + rnd() * 9, al = .12 + rnd() * .3;
    for (var dx = -512; dx <= 512; dx += 512) { g.save(); g.translate(x + dx, y); g.scale(1, ry / rx);
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, 'rgba(255,255,255,' + al + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 6.283); g.fill(); g.restore(); }
  }
var nub = new THREE.CanvasTexture(c); nub.wrapS = THREE.RepeatWrapping;
  var mat = new THREE.ShaderMaterial({
    uniforms: { uSol: { value: sol.clone().normalize() }, uNubes: { value: nub }, uT: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'uniform vec3 uSol; uniform sampler2D uNubes; uniform float uT; varying vec3 vD;',
      'void main(){',
      '  vec3 d = normalize(vD); float h = max(d.y, 0.0);',
      '  vec3 zen = vec3(.12,.2,.48), alto = vec3(.5,.5,.72), hz = vec3(1.0,.6,.36);',
      '  float s = max(dot(d, uSol), 0.0);',
      '  vec3 c = mix(hz, alto, smoothstep(0.0, .28, h)); c = mix(c, zen, smoothstep(.25, .9, h));',
      '  c += vec3(1.0,.55,.22) * pow(s, 6.0) * .55 * (1.0 - smoothstep(0.0, .5, h));',
      '  c += vec3(1.0,.8,.55) * pow(s, 180.0) * 3.0;',
      '  float az = atan(d.z, d.x) / 6.28318 + uT * .002;',
      '  float n = texture2D(uNubes, vec2(az * 2.0, h * 1.6)).a * smoothstep(.0, .06, h);',
      '  vec3 nubC = mix(vec3(1.0,.62,.42), vec3(.95,.85,.9), smoothstep(0.0, .5, h)) * (.7 + .5 * pow(s, 3.0));',
      '  c = mix(c, nubC, min(1.0, n * 1.3));',
      '  if (d.y < 0.0) c = hz * .55;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  var domo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat); domo.renderOrder = -1; escena.add(domo);
  return domo;
};

/* ---------- los jardines (ocho sectores entre los caminos) ---------- */
function jardines(obra) {
  var B = 46.5, R0 = 15, w = 3.2, polys = [];
  for (var k = 0; k < 8; k++) {
    var a1 = k * Math.PI / 4, a2 = (k + 1) * Math.PI / 4;
    var u1 = [Math.cos(a1), Math.sin(a1)], u2 = [Math.cos(a2), Math.sin(a2)];
    var p1 = [-u1[1], u1[0]], p2 = [u2[1], -u2[0]];                 /* hacia dentro del sector */
    function borde(u, p) {                                         /* dónde la línea paralela al camino toca el cuadrado */
      var tx = u[0] ? (Math.sign(u[0]) * B - p[0] * w) / u[0] : 1e9, tz = u[1] ? (Math.sign(u[1]) * B - p[1] * w) / u[1] : 1e9;
      var t = Math.min(Math.abs(tx), Math.abs(tz)); return [u[0] * t + p[0] * w, u[1] * t + p[1] * w];
    }
    var t0 = Math.sqrt(R0 * R0 - w * w);
    var A = [u1[0] * t0 + p1[0] * w, u1[1] * t0 + p1[1] * w], Bp = borde(u1, p1), Cp = borde(u2, p2), D = [u2[0] * t0 + p2[0] * w, u2[1] * t0 + p2[1] * w];
    var esq = [Math.sign(u1[0] + u2[0]) * B, Math.sign(u1[1] + u2[1]) * B];
    var pts = [A, Bp];
    if (Math.abs(Bp[0]) > B - .01 && Math.abs(Cp[1]) > B - .01 || Math.abs(Bp[1]) > B - .01 && Math.abs(Cp[0]) > B - .01) pts.push(esq);
    pts.push(Cp, D);
    polys.push(pts);
  }
  var lista = [];
  polys.forEach(function (pts, k) {
    function forma(enco) {
      var cx = 0, cz = 0; pts.forEach(function (p) { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
      var s = new THREE.Shape(); pts.forEach(function (p, i) { var x = p[0] + (cx - p[0]) * enco, z = p[1] + (cz - p[1]) * enco; if (i) s.lineTo(x, -z); else s.moveTo(x, -z); });
      return { s: s, cx: cx, cz: cz };
    }
    var f0 = forma(0), f1 = forma(.04);
    var cur = new THREE.ExtrudeGeometry(f0.s, { depth: .2, bevelEnabled: false }); cur.rotateX(-Math.PI / 2); obra.pieza('piedra', cur, C('#e9e2d2'));
    var cesped = new THREE.ExtrudeGeometry(f1.s, { depth: .24, bevelEnabled: false }); cesped.rotateX(-Math.PI / 2); obra.pieza('verde', cesped, C('#5e8f3a'));
    /* el parterre de flores: un rombo al medio */
    var cx = f0.cx, cz = f0.cz, rr = 4.2, sh = new THREE.Shape(); sh.moveTo(cx - rr, -cz); sh.lineTo(cx, -cz - rr * .7); sh.lineTo(cx + rr, -cz); sh.lineTo(cx, -cz + rr * .7); sh.lineTo(cx - rr, -cz);
    var fl = new THREE.ExtrudeGeometry(sh, { depth: .32, bevelEnabled: false }); fl.rotateX(-Math.PI / 2); obra.pieza('flores', fl, [1, 1, 1]);
    lista.push({ cx: cx, cz: cz, pts: pts });
  });
  return lista;
}
I.texFlores = function () {
  var c = I.lienzo(128, 128), g = c.getContext('2d'), rnd = I.azar(77);
  g.fillStyle = '#3e6b2c'; g.fillRect(0, 0, 128, 128);
  for (var i = 0; i < 420; i++) { var x = rnd() * 128, y = rnd() * 128, r = 1.5 + rnd() * 2.2, t = rnd();
    g.fillStyle = t < .55 ? '#c8202e' : t < .85 ? '#f4f1ec' : '#e8506a'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
  return I.tex(c, true, true);
};

/* ---------- las cuadras de alrededor ----------
   El damero de Trujillo: la plaza es una cuadra; alrededor, cuadras de 100 m separadas por calles
   de 12,5 m. Cada cuadra tiene casas pegadas en sus cuatro lados, mirando a la calle (cada una con
   su ancho, su altura, su color y su estilo, del tablero I.texCiudad), su azotea con tanques de
   agua, y el centro de la manzana techado. Más lejos, algunos edificios modernos. Las casas que
   chocarían con las fachadas detalladas de la plaza no se ponen. */
function caja6(w, h, d, franja, pisos, anchoFranja) {
  /* una casa: caja con la fachada (+Z) mapeada a su franja (repetida a lo ancho), los costados lisos
     y el techo de azotea */
  var g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, N = I.CIUDAD.franjas;
  var v0 = 1 - (franja + 1) / N, v1 = 1 - franja / N, vm = v0 + (v1 - v0) * (pisos === 1 ? .5 : 1), va = 1 - (I.CIUDAD.azotea + .5) / N;
  var rep = w / (anchoFranja || 4);
  function cara(k, u0, u1, a, b) { var i = k * 4; uv.setXY(i, u0, b); uv.setXY(i + 1, u1, b); uv.setXY(i + 2, u0, a); uv.setXY(i + 3, u1, a); }
  cara(4, 0, rep, v0, pisos === 1 ? v0 + (v1 - v0) * .5 : v1);              /* frente */
  cara(5, 0, rep, v0, pisos === 1 ? v0 + (v1 - v0) * .5 : v1);              /* atrás (casi no se ve) */
  cara(0, .3, .32, v0 + .3 / N, v0 + .5 / N); cara(1, .3, .32, v0 + .3 / N, v0 + .5 / N);   /* costados: muro liso */
  cara(2, 0, w / 8, va - .3 / N, va + .3 / N); cara(3, 0, .01, va, va);         /* azotea y piso */
  g.userData = { uvPropio: true };
  return g;
}
function ciudad(obra, rnd, baja) {
  /* donde empieza cada cuadra (x o z); en los teléfonos modestos, un anillo menos */
  var bloques = baja ? [-275, -162.5, -50, 62.5, 175] : [-387.5, -275, -162.5, -50, 62.5, 175, 287.5];
  /* las fachadas detalladas de la plaza: no se pisan */
  function ocupado(x, z) {
    var ax = Math.abs(x), az = Math.abs(z);
    if (ax < 52 && az > 60 && az < 79) return true;
    if (az < 52 && ax > 60 && ax < 79) return true;
    if (ax > 46 && ax < 82 && az > 46 && az < 82) return true;   /* esquinas */
    return false;
  }
  var M = new THREE.Matrix4(), AGUA = C('#2a2a2a'), AGUAb = C('#e8e6e0');
  bloques.forEach(function (bx) { bloques.forEach(function (bz) {
    if (bx === -50 && bz === -50) return;                         /* la plaza */
    var lejos = Math.max(Math.abs(bx + 50), Math.abs(bz + 50)) > 150, muyLejos = Math.max(Math.abs(bx + 50), Math.abs(bz + 50)) > 260;
    /* los cuatro lados: [inicio x, inicio z, paso x, paso z, giro de la fachada (mirando hacia afuera)] */
    [[bx, bz + 100, 1, 0, 0], [bx + 100, bz + 100, 0, -1, Math.PI / 2], [bx + 100, bz, -1, 0, Math.PI], [bx, bz, 0, 1, -Math.PI / 2]].forEach(function (L) {
      var pos = 0;
      while (pos < 100) {
        var w = Math.min(100 - pos, 7 + Math.floor(rnd() * 4) * 3), moderno = lejos && rnd() < (muyLejos ? .07 : .035);
        var pisos = moderno ? 0 : rnd() < .35 ? 1 : 2, h = moderno ? 12 * (2 + Math.floor(rnd() * 2.5)) : pisos === 1 ? 5.6 + rnd() * .8 : 9.4 + rnd() * 1.4, d = 13;
        var giro = L[4], t = pos + w / 2, cx = L[0] + L[2] * t, cz = L[1] + L[3] * t;
        /* la fachada sobre la línea de la cuadra, el volumen hacia adentro */
        var fx = Math.sin(giro), fz = Math.cos(giro), px = cx - fx * d / 2, pz = cz - fz * d / 2;
        if (!ocupado(px, pz)) {
          M.makeRotationY(giro).setPosition(px, 0, pz);
          if (moderno) {
            var fr = I.CIUDAD.modernos[Math.floor(rnd() * 3)];
            for (var k = 0; k < h / 12; k++) { var gm = caja6(w, 12, d, fr, 2, 4); gm.translate(0, 6 + k * 12, 0); obra.pieza('ciudad', gm, [1, 1, 1], M); }
          } else {
            var gc = caja6(w, h, d, Math.floor(rnd() * 10), pisos, 4); gc.translate(0, h / 2, 0); obra.pieza('ciudad', gc, [1, 1, 1], M);
            /* pretil con remate y, a veces, el tanque de agua */
            var pr = new THREE.BoxGeometry(w, .5, .25); pr.translate(0, h + .25, d / 2 - .12); obra.pieza('estuco', pr, C('#e9e2d4'), M);
            if (rnd() < .45) { var tq = new THREE.CylinderGeometry(.6, .6, 1.2, 10); tq.translate((rnd() - .5) * w * .6, h + .6, -rnd() * 4); obra.pieza('metal', tq, rnd() < .6 ? AGUA : AGUAb, M); }
          }
        }
        pos += w;
      }
    });
    /* el centro de la manzana, techado (patios, techos y azoteas vistos desde arriba) */
    /* en parches de distinta altura y tono, con cuartos de azotea y tanques: desde arriba se ve
       como un barrio de verdad y no como una losa */
    for (var ix = 0; ix < 3; ix++) for (var iz = 0; iz < 3; iz++) {
      var ph = 4.2 + rnd() * 3.6, techo = caja6(24.6, ph, 24.6, I.CIUDAD.azotea, 2, 4), tono = .78 + rnd() * .25;
      techo.translate(bx + 13 + ix * 24.6 + 12.3, ph / 2, bz + 13 + iz * 24.6 + 12.3); obra.pieza('ciudad', techo, [tono, tono * (.97 + rnd() * .05), tono * .95]);
      if (rnd() < .6) { var cu = new THREE.BoxGeometry(3 + rnd() * 4, 2.4, 3 + rnd() * 4); cu.translate(bx + 13 + ix * 24.6 + 6 + rnd() * 12, ph + 1.2, bz + 13 + iz * 24.6 + 6 + rnd() * 12); obra.pieza('estuco', cu, C(['#d9c7a8', '#e3d5bd', '#c9b8a0', '#e8a1a8', '#9cc9b4'][Math.floor(rnd() * 5)])); }
      if (rnd() < .7) { var tq2 = new THREE.CylinderGeometry(.6, .6, 1.2, 8); tq2.translate(bx + 13 + ix * 24.6 + 3 + rnd() * 18, ph + .6, bz + 13 + iz * 24.6 + 3 + rnd() * 18); obra.pieza('metal', tq2, rnd() < .6 ? AGUA : AGUAb); }
    }
  }); });
}

/* ---------- la plaza completa ---------- */
I.createTrujilloPlaza = function (escena, op) {
  op = op || {};
  var obra = new I.Obra(), luces = [], sombras = [], bancas = [], faroles = [];
  /* op.despejar: [[x, z, radio], …] donde no va ni palmera, ni árbol, ni arbusto, ni farol, ni banca
     (el juego del árbol pone ahí el árbol de Navidad, el puesto de chocolate y el nacimiento).
     La intro no lo usa: su plaza queda igual. */
  var DESP = op.despejar || [];
  function libre(x, z) { for (var i = 0; i < DESP.length; i++) { var d = DESP[i]; if ((x - d[0]) * (x - d[0]) + (z - d[1]) * (z - d[1]) < d[2] * d[2]) return false; } return true; }
  /* suelo: calles, veredas y la plaza con su sardinel amarillo */
  var asf = new THREE.PlaneGeometry(700, 700); asf.rotateX(-Math.PI / 2); asf.translate(0, -.02, 0); obra.pieza('piedra', asf, C('#4a4a4c'));
  var vereda = function (cx, cz, w, d) { var g = new THREE.BoxGeometry(w, .18, d); g.translate(cx, .09, cz); obra.pieza('piedra', g, C('#b9b2a6')); };
  vereda(0, -64, 132, 3.2); vereda(0, 64, 132, 3.2); vereda(-64, 0, 3.2, 125); vereda(64, 0, 3.2, 125);
  var sard = function (cx, cz, w, d) { var g = new THREE.BoxGeometry(w, .22, d); g.translate(cx, .11, cz); obra.pieza('piedra', g, C('#e2b62e')); };
  sard(0, -50.1, 100.4, .3); sard(0, 50.1, 100.4, .3); sard(-50.1, 0, .3, 100.4); sard(50.1, 0, .3, 100.4);
  /* el piso de la plaza: losas de piedra cálida (los jardines y el monumento van encima) */
  var piso = new THREE.BoxGeometry(100, .14, 100); piso.translate(0, .07, 0); obra.pieza('losa', piso, C('#d8bf9c'));
  /* cruces peatonales (la cámara entra por el del sur) */
  [[0, 56.25, 0], [0, -56.25, 0], [56.25, 0, 1], [-56.25, 0, 1]].forEach(function (c) {
    for (var i = -4; i <= 4; i++) { var g = new THREE.BoxGeometry(c[2] ? 11 : .55, .02, c[2] ? .55 : 11); g.translate(c[0] + (c[2] ? 0 : i * 1.1), .005, c[1] + (c[2] ? i * 1.1 : 0)); obra.pieza('piedra', g, C('#e6e3dc')); }
  });
  /* op.sinJardines: el laberinto de Trujillo pone sus setos en la plaza; los jardines y arbustos de la intro estorbarían */
  var J = op.sinJardines ? [] : jardines(obra);
  /* el monumento */
  var MO = I.createPlazaMonument(obra);
  /* palmeras reales, árboles de copa ancha y arbustos recortados */
  var palmas = [[-22, 28, 17], [24, 30, 18], [-34, -18, 16], [33, -22, 19], [-12, -36, 17.5], [14, 40, 16.5], [-40, 8, 18.5], [41, 11, 17], [-26, -40, 18], [30, -40, 16], [6, -30, 18], [-8, 24, 16.4], [44, 38, 15.5], [-44, 40, 17.2]];
  palmas.forEach(function (p, i) { if (!libre(p[0], p[1])) return; I.createPalmTree(obra, p[0], p[1], p[2], 31 + i); sombras.push([p[0], p[1], 2.2]); });
  [[-20, 18, 4.2], [21, 19, 4.4], [-30, -30, 4.0], [28, -28, 4.3], [-38, 30, 3.6], [36, 33, 3.8]].forEach(function (t, i) { if (!libre(t[0], t[1])) return; I.createTree(obra, t[0], t[1], t[2], 51 + i); sombras.push([t[0], t[1], t[2] * 1.1]); });
  J.forEach(function (j, i) { for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2 + i, x = j.cx + Math.cos(a) * 6.2, z = j.cz + Math.sin(a) * 6.2; if (libre(x, z)) I.createShrub(obra, x, z, .55 + (k % 2) * .2, i * 4 + k); } });
  /* faroles: el borde de la plaza y a lo largo de los caminos */
  for (var s = -40; s <= 40; s += 13.3) { [[s, 48.5], [s, -48.5], [48.5, s], [-48.5, s]].forEach(function (p) { if (!libre(p[0], p[1])) return; I.createStreetLamp(obra, p[0], p[1], luces); faroles.push([p[0], p[1]]); }); }
  for (var k2 = 0; k2 < 8; k2++) { var a = k2 * Math.PI / 4; [21, 33].forEach(function (r) { var dx = Math.cos(a), dz = Math.sin(a); var fx = dx * r - dz * 2.4, fz = dz * r + dx * 2.4; if (!libre(fx, fz)) return; I.createStreetLamp(obra, fx, fz, luces); faroles.push([fx, fz]); }); }
  /* bancas junto a los jardines */
  for (k2 = 0; k2 < 8; k2++) { var b = k2 * Math.PI / 4; [17.5, 27, 38].forEach(function (r, j) { var dx = Math.cos(b), dz = Math.sin(b), sx = (j % 2 ? 1 : -1) * 2.6;
    /* mira hacia el camino: su frente (+Z local) apunta al eje del camino */
    var px = -dz, pz = dx, sg = sx > 0 ? 1 : -1;
    var bx = dx * r + px * sx, bz = dz * r + pz * sx, bg = Math.atan2(-sg * px, -sg * pz); if (!libre(bx, bz)) return; I.createBench(obra, bx, bz, bg); bancas.push([bx, bz, bg]); }); }

  /* la catedral (al norte, algo a la izquierda) y las casonas */
  I.createCatedral(obra, -24, -62.5, 0);
  var F0 = 62.5, H2 = 10.4;
  function fila(giro, lista) {
    var u = lista[0], pos = u.desde;
    lista.slice(1).forEach(function (c, i) {
      var cen = pos + c.ancho / 2, x, z;
      if (giro === 0) { x = cen; z = -F0; } else if (giro === Math.PI) { x = cen; z = F0; } else if (giro > 0) { x = -F0; z = cen; } else { x = F0; z = cen; }
      I.createColonialFacade(obra, Object.assign({ x: x, z: z, giro: giro, alto: c.pisos === 1 ? 6.4 : H2, sem: 100 + i + Math.round(pos) }, c));
      pos += c.ancho;
    });
  }
  /* norte, a la derecha de la catedral: el arzobispado amarillo y una casona añil */
  fila(0, [{ desde: 8.2 }, { ancho: 19, color: '#e2ab2c', balcon: 'cajon', arco: true, luz: .4 }, { ancho: 13, color: '#3e5aa8', balcon: 'abierto', luz: .3 }, { ancho: 9.6, color: '#efe5cf', pisos: 1 }]);
  /* este: el palacio blanco y azul y sus vecinas */
  fila(-Math.PI / 2, [{ desde: -40 }, { ancho: 14, color: '#c64a30', balcon: 'cajon' }, { ancho: 38, color: '#f1ede4', marco: '#3e5aa8', zocalo: '#3e5aa8', balcon: 'abierto', arco: true, luz: .5 }, { ancho: 13, color: '#e7b23e', balcon: 'cajon' }, { ancho: 13.5, color: '#8fb6d8', pisos: 1 }]);
  /* oeste: la casona añil grande, la roja y la crema */
  fila(Math.PI / 2, [{ desde: -40 }, { ancho: 26, color: '#3e5aa8', balcon: 'cajon', arco: true, luz: .4 }, { ancho: 24, color: '#d4532f', marco: '#f4efe3', balcon: 'abierto', luz: .45 }, { ancho: 14, color: '#efe5cf', balcon: 'cajon' }, { ancho: 14.5, color: '#e7b23e', pisos: 1 }]);
  /* sur: la casona blanca del balcón corrido, una ocre y una verde agua */
  fila(Math.PI, [{ desde: -40 }, { ancho: 30, color: '#f2efe8', zocalo: '#5a3720', balcon: 'largo', marco: '#6b4428', luz: .35 }, { ancho: 18, color: '#d8a35a', balcon: 'cajon' }, { ancho: 16, color: '#9cc9b4', balcon: 'abierto' }, { ancho: 16.5, color: '#efe5cf', pisos: 1 }]);
  /* esquinas: las ocho de las manzanas que dan a la plaza y las cuatro de las manzanas en diagonal */
  var E = [
    { x: 50, z: -F0, giro: 0, s1: -1, giro2: Math.PI / 2, s2: 1, a: 9.8, b: 14, color: '#c64a30' },
    { x: -50, z: -F0, giro: 0, s1: 1, giro2: -Math.PI / 2, s2: -1, a: 8.8, b: 14, color: '#efe5cf' },
    { x: F0, z: -50, giro: -Math.PI / 2, s1: 1, giro2: Math.PI, s2: -1, a: 10, b: 14, color: '#e2ab2c' },
    { x: F0, z: 50, giro: -Math.PI / 2, s1: -1, giro2: 0, s2: 1, a: 10, b: 14, color: '#3e5aa8' },
    { x: -F0, z: -50, giro: Math.PI / 2, s1: -1, giro2: Math.PI, s2: 1, a: 10, b: 14, color: '#d8a35a' },
    { x: -F0, z: 50, giro: Math.PI / 2, s1: 1, giro2: 0, s2: -1, a: 10, b: 14, color: '#c64a30' },
    { x: 50, z: F0, giro: Math.PI, s1: 1, giro2: Math.PI / 2, s2: -1, a: 10, b: 14, color: '#e7b23e' },
    { x: -50, z: F0, giro: Math.PI, s1: -1, giro2: -Math.PI / 2, s2: 1, a: 10, b: 14, color: '#3e5aa8' },
    { x: F0, z: -F0, giro: 0, s1: 1, giro2: -Math.PI / 2, s2: -1, a: 16, b: 16, color: '#efe5cf' },
    { x: -F0, z: -F0, giro: 0, s1: -1, giro2: Math.PI / 2, s2: 1, a: 16, b: 16, color: '#e2ab2c' },
    { x: F0, z: F0, giro: Math.PI, s1: -1, giro2: -Math.PI / 2, s2: 1, a: 16, b: 16, color: '#9cc9b4' },
    { x: -F0, z: F0, giro: Math.PI, s1: 1, giro2: Math.PI / 2, s2: -1, a: 16, b: 16, color: '#c64a30' }
  ];
  E.forEach(function (e, i) { I.createCornerHouse(obra, Object.assign({ alto: H2, pisos: 2, balcon: i % 3 === 0 ? 'cajon' : i % 3 === 1 ? 'abierto' : null, sem: 300 + i, luz: .35 }, e)); });
  /* la ciudad de alrededor: las otras cuadras del damero, con casas de verdad en sus cuatro lados */
  var rnd = I.azar(9), n;
  /* op.sinCiudad: el juego del árbol (de noche, dentro de la plaza) no necesita las otras cuadras ni los cerros */
  if (!op.sinCiudad) ciudad(obra, rnd, op.baja);
  for (n = 0; n < (op.sinCiudad ? 0 : 26); n++) {
    var a3 = -Math.PI * .95 + n / 26 * Math.PI * 1.25, R = 720 + rnd() * 160, ex = Math.cos(a3) * R, ez = Math.sin(a3) * R;
    var cono = new THREE.ConeGeometry(160 + rnd() * 160, 34 + rnd() * 60, 6);   /* cerros bajos y lejanos, que no compitan con la Catedral */ cono.rotateY(rnd() * 3); cono.translate(ex, 30, ez);
    obra.pieza('cerro', cono, C(rnd() < .5 ? '#8f8a8e' : '#9c938c'));
  }
  return { obra: obra, luces: luces, sombras: sombras, monumento: MO, bancas: bancas, faroles: faroles };
};
})();

;
/* RuwayIntro — flor.js: la flor de limpiapipas, su cajita, las chispas, el logo y el portal.

   La flor es lo único hecho a mano de la escena y lo único mágico (junto con sus chispas, el logo
   y el portal): la plaza se ve como es; la magia la pone la flor.

   - Tamaño real: unos 35 cm con el tallo, la cabeza de unos 17 cm. Vive en una cajita de madera
     sobre una banca del camino del sur, como un regalo que alguien dejó ahí.
   - Cada pétalo es un lazo de limpiapipas (un tubo con pelusa) con su propio largo, ancho y giro:
     ninguno es idéntico. Se abren doblándose desde el centro (rotación rígida de cada pétalo, sin
     deformar la malla): de capullo, mirando a la cámara, a abiertos.
   - El centro es un pompón con pelitos; el tallo, delgado y algo curvo, con dos hojas en lazo.
   - El origen de la flor es la base del tallo: así se mece desde abajo, como una flor de verdad.
   - Logo: el dibujo oficial (ruway-logo.png), con sus colores sin tocar. Aparece disolviéndose
     desde las chispas, con un filo dorado en su propio contorno; sin placas ni halos detrás.
   - Portal: anillos de luz en 3D que nacen del centro de la flor y crecen hasta que la cámara
     pasa por dentro. */
(function () {
'use strict';
var I = window.__RI;

function texPelusa() {
  var c = I.lienzo(64, 256), g = c.getContext('2d'), rnd = I.azar(23);
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 900; i++) { var x = rnd() * 64, y = rnd() * 256, l = 3 + rnd() * 10, a = (rnd() - .5) * 1.2;
    g.strokeStyle = 'rgba(' + (rnd() < .5 ? '255,255,255' : '110,110,110') + ',' + (.25 + rnd() * .5) + ')'; g.lineWidth = .6 + rnd() * .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l); g.stroke(); }
  return I.tex(c, true, true);
}
function texPelos() {
  var c = I.lienzo(64, 256), g = c.getContext('2d'), rnd = I.azar(31);
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 2400; i++) { var x = rnd() * 64, y = rnd() * 256, l = 2 + rnd() * 6; g.strokeStyle = 'rgba(255,255,255,' + (.5 + rnd() * .5) + ')'; g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y + l); g.stroke(); }
  return I.tex(c, false, true);
}

/* ---------- la flor ----------
   Como las de verdad (las fotos de referencia): cada pétalo está hecho de varias vueltas de
   limpiapipas puestas lado a lado, así que su superficie tiene surcos paralelos que van de la base
   a la punta redonda, con un borde que lo contornea. Dos coronas de pétalos (8 afuera, 8 adentro,
   más paradas), el centro es un espiral amarillo con un anillo naranja y estambres finos con su
   bolita; detrás, sépalos verdes; el tallo es doble, retorcido, con dos hojas de surcos.
   Todo se arma junto (una malla por pétalo) para que cada pétalo pueda girar entero al abrirse. */
function juntar(geos, color) {
  /* une varias geometrías en una, con color por vértice (color(y) o un color fijo) */
  var n = 0, ni = 0; geos.forEach(function (g) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), idx = new (n > 65535 ? Uint32Array : Uint16Array)(ni), o = 0, oi = 0;
  geos.forEach(function (g) {
    var p = g.attributes.position, q = g.attributes.normal, u = g.attributes.uv, c = g.attributes.color, cnt = p.count;
    for (var i = 0; i < cnt; i++) {
      pos.set([p.getX(i), p.getY(i), p.getZ(i)], (o + i) * 3); nor.set([q.getX(i), q.getY(i), q.getZ(i)], (o + i) * 3); uv.set([u.getX(i), u.getY(i)], (o + i) * 2);
      var cc = c ? [c.getX(i), c.getY(i), c.getZ(i)] : color(p.getX(i), p.getY(i), p.getZ(i)); col.set(cc, (o + i) * 3);
    }
    if (g.index) for (i = 0; i < g.index.count; i++) idx[oi++] = g.index.getX(i) + o; else for (i = 0; i < cnt; i++) idx[oi++] = i + o;
    o += cnt; g.dispose();
  });
  var r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); r.setAttribute('color', new THREE.BufferAttribute(col, 3)); r.setIndex(new THREE.BufferAttribute(idx, 1)); return r;
}
var _cA = new THREE.Color(), _cB = new THREE.Color();
function degradado(c1, c2, y0, y1) {          /* color que pasa de c1 (base) a c2 (punta) a lo largo de y */
  var a = new THREE.Color(c1).convertSRGBToLinear(), b = new THREE.Color(c2).convertSRGBToLinear();
  return function (x, y) { var t = I.lim((y - y0) / (y1 - y0), 0, 1); _cA.copy(a).lerp(b, t * t); return [_cA.r, _cA.g, _cA.b]; };
}
/* un pétalo de surcos: largo L, medio ancho W, n vueltas, curvatura de cuchara */
function petaloSurcos(L, W, n, r, cuchara, rnd) {
  var V = function (x, y, z) { return new THREE.Vector3(x, y, z); }, geos = [], bordes = [];
  function ancho(s) { return s < .55 ? W * Math.pow(Math.sin(s / .55 * Math.PI / 2), .8) : W * Math.sqrt(Math.max(0, 1 - Math.pow((s - .55) / .45, 2))); }
  function punto(u, s) { var w = ancho(s); return V(u * w, s * L, cuchara * u * u * w / W * .9 + Math.sin(s * Math.PI) * L * .05 - s * s * L * .06); }
  for (var j = 0; j < n; j++) {
    var u = -1 + 2 * (j + .5) / n, pts = [];
    for (var k = 0; k <= 12; k++) pts.push(punto(u * .9 * (1 + (rnd() - .5) * .03), k / 12 * .985 + .01));
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, r, 5, false));
  }
  /* el borde: una vuelta que contornea todo el pétalo, un poco más gruesa */
  var bp = []; for (k = 0; k <= 24; k++) { var t = k / 24, uu = t < .5 ? -1 : 1, ss = t < .5 ? t * 2 : (1 - t) * 2; bp.push(punto(uu, ss * .995 + .005)); }
  bordes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 48, r * 1.15, 5, false));
  return geos.concat(bordes);
}
I.createFlower = function (op) {
  op = op || {};
  var g = new THREE.Group(), cuerpo = new THREE.Group(), texP = texPelusa(), texH = texPelos(), petalos = [], todos = [], rnd = I.azar(op.sem || 17);
  g.add(cuerpo); texP.repeat.set(26, 1); texH.repeat.set(40, 1);
  function mats(extra) {
    var m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, map: texP, roughness: 1, metalness: 0, emissive: '#ffb04a', emissiveIntensity: 0 }, extra || {}));
    var mp = new THREE.MeshStandardMaterial({ vertexColors: true, alphaMap: texH, transparent: true, alphaTest: .55, roughness: 1, depthWrite: false, emissive: '#ffb04a', emissiveIntensity: 0 });
    todos.push(m, mp); return [m, mp];
  }
  /* la pelusa necesita una funda un poco más gruesa que el tubo: se hace inflando la geometría */
  function funda(geo, k) { var f = geo.clone(), p = f.attributes.position, n = f.attributes.normal; for (var i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k); return f; }
  function poner(geo, mm, padre, k) { padre.add(new THREE.Mesh(geo, mm[0])); padre.add(new THREE.Mesh(funda(geo, k), mm[1])); }
  var V = function (x, y, z) { return new THREE.Vector3(x, y, z); }, H = .26;    /* alto del tallo hasta la cabeza */
  var verde = mats();
  /* el tallo: dos limpiapipas retorcidos */
  var tallo = []; for (var t2 = 0; t2 < 2; t2++) { var pts = []; for (var i = 0; i <= 30; i++) { var yy = i / 30 * H, a = i / 30 * Math.PI * 9 + t2 * Math.PI; pts.push(V(Math.cos(a) * .0035 + Math.sin(yy * 9) * .004, yy, Math.sin(a) * .0035)); } tallo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, .0034, 6, false)); }
  poner(juntar(tallo, function () { return I.col('#4f9a34'); }), verde, cuerpo, .0018);
  /* dos hojas de surcos en el tallo */
  [[-1, .09, .3], [1, .13, -.2]].forEach(function (h) {
    var hg = new THREE.Group(); hg.position.set(0, h[1], .003); hg.rotation.set(h[2] * .4, 0, h[0] * -1.15); cuerpo.add(hg);
    poner(juntar(petaloSurcos(.075, .016, 4, .0028, .006, rnd), degradado('#3f8a2c', '#7cc350', 0, .075)), verde, hg, .0015);
  });
  /* la cabeza, inclinada hacia quien la mira */
  var cabeza = new THREE.Group(); cabeza.position.set(0, H, .006); cabeza.rotation.x = -.55; cuerpo.add(cabeza);
  /* sépalos verdes detrás */
  for (var k = 0; k < 6; k++) { var sp = new THREE.Group(); sp.rotation.z = k / 6 * Math.PI * 2 + .3; sp.position.z = -.008; cabeza.add(sp); var sd = new THREE.Group(); sd.rotation.x = .15; sp.add(sd);
    poner(juntar(petaloSurcos(.07, .024, 4, .003, .004, rnd), degradado('#2f6e22', '#5aa33d', 0, .07)), verde, sd, .0016); }
  /* dos coronas de pétalos */
  var c1 = op.c1 || '#e8378b', c2 = op.c2 || '#ff9bcc';
  [{ n: 8, L: .09, W: .03, rib: 7, r: .0031, z: 0, abre: .2, cierra: 1.25, gir: 0, cu: .012 }, { n: 8, L: .072, W: .026, rib: 6, r: .0029, z: .007, abre: .62, cierra: 1.42, gir: Math.PI / 8, cu: .014 }].forEach(function (corona, ci) {
    var mm = mats();
    for (var p = 0; p < corona.n; p++) {
      var piv = new THREE.Group(); piv.rotation.z = p / corona.n * Math.PI * 2 + corona.gir + (rnd() - .5) * .08; piv.position.z = corona.z; cabeza.add(piv);
      var dob = new THREE.Group(); piv.add(dob);
      var L = corona.L * (.93 + rnd() * .14), geo = juntar(petaloSurcos(L, corona.W * (.92 + rnd() * .16), corona.rib, corona.r, corona.cu, rnd), degradado(ci ? '#d42a7a' : c1, c2, 0, L));
      poner(geo, mm, dob, .0017);
      petalos.push({ dob: dob, abre: corona.abre + (rnd() - .5) * .1, cierra: corona.cierra, mats: mm, corona: ci });
    }
  });
  /* el centro: anillo naranja, espiral amarillo y estambres */
  var cen = mats(), est = mats();
  var anillo = []; for (k = 0; k < 2; k++) { var ap = []; for (i = 0; i <= 40; i++) { var aa = i / 40 * Math.PI * 2; ap.push(V(Math.cos(aa) * (.02 + k * .005), Math.sin(aa) * (.02 + k * .005), .012)); } anillo.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ap, true), 60, .0034, 6, true)); }
  poner(juntar(anillo, function () { return I.col('#ff6a1f'); }), cen, cabeza, .0016);
  var espP = []; for (i = 0; i <= 90; i++) { var ae = i / 90 * Math.PI * 2 * 5, re = .0015 + i / 90 * .0165; espP.push(V(Math.cos(ae) * re, Math.sin(ae) * re, .02 - i / 90 * .004)); }
  poner(juntar([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(espP), 200, .0032, 6, false)], function () { return I.col('#ffc61f'); }), cen, cabeza, .0015);
  var estG = [];
  for (k = 0; k < 16; k++) { var ak = k / 16 * Math.PI * 2 + rnd() * .2, r0 = .02, r1 = .045 + rnd() * .012;
    var pe = [V(Math.cos(ak) * r0, Math.sin(ak) * r0, .014), V(Math.cos(ak) * (r0 + r1) / 2, Math.sin(ak) * (r0 + r1) / 2, .026), V(Math.cos(ak) * r1, Math.sin(ak) * r1, .03)];
    estG.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pe), 6, .0009, 4, false));
    var bo = new THREE.SphereGeometry(.0028, 8, 6); bo.translate(pe[2].x, pe[2].y, pe[2].z); estG.push(bo); }
  var estM = new THREE.Mesh(juntar(estG, function () { return I.col('#ffe25a'); }), est[0]); cabeza.add(estM);
  var centroLuz = [cen[0], cen[1], est[0]];
  return {
    g: g, alto: H,
    centro: function (v) { return cabeza.getWorldPosition(v).add(new THREE.Vector3(0, 0, 0)); },
    /* 0 = capullo, 1 = abierta: cada pétalo a su ritmo, la corona de adentro un poco después */
    abrir: function (k) { petalos.forEach(function (p, j) { var d = (j % 8) * .05 + p.corona * .18, kk = I.suave(d, .62 + d, k); p.dob.rotation.x = p.cierra * (1 - kk) + p.abre * kk; }); },
    mecer: function (tv, k) { cuerpo.rotation.z = Math.sin(tv * 1.05) * .02 * k + Math.sin(tv * 2.3) * .005 * k; cuerpo.rotation.x = Math.sin(tv * .8 + 1) * .012 * k; },
    luz: function (fase, base, pulso) {
      petalos.forEach(function (p, j) { var d = ((fase - (j % 8) / 8) % 1 + 1) % 1, e = Math.exp(-d * d * 60) + Math.exp(-(1 - d) * (1 - d) * 60);
        p.mats[0].emissiveIntensity = base + e * .35 * Math.min(1, base * 4 + .2); p.mats[1].emissiveIntensity = (base + e * .25) * .8; });
      centroLuz.forEach(function (m) { m.emissiveIntensity = .12 + pulso * 1.2; });
    },
    liberar: function () { todos.forEach(function (m) { m.dispose(); }); texP.dispose(); texH.dispose(); g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
  };
};

/* ---------- la cajita de regalo artesanal ----------
   Madera de listones (cada uno de su tono, con las juntas y los clavitos), esquineros, el fondo
   forrado de papel kraft, relleno de tiras de papel de seda rosado y blanco, una cinta de raso
   alrededor con su lazo, y una tarjetita de kraft colgada del lazo. La tapa descansa al lado. */
function texTarjeta() {
  var c = I.lienzo(128, 80), g = c.getContext('2d');
  g.fillStyle = '#c9a678'; g.fillRect(0, 0, 128, 80); g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 2; g.strokeRect(5, 5, 118, 70);
  g.fillStyle = '#5a3a1e'; g.font = 'italic 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('para ti', 64, 42);
  g.fillStyle = '#d9497a'; g.beginPath(); g.arc(104, 18, 5, 0, 6.283); g.fill();
  return I.tex(c, true, false);
}
I.createCraftBox = function () {
  var g = new THREE.Group(), obra = new I.Obra(), rnd = I.azar(77), tm = I.texMadera(), tt = texTarjeta();
  tm.repeat.set(10, 10);   /* la obra proyecta la textura en metros: la veta tiene que ser fina en una caja de 27 cm */
  var W = .27, D = .19, Hh = .11, e = .011;
  var mats = {
    madera: new THREE.MeshLambertMaterial({ vertexColors: true, map: tm }),
    papel: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    cinta: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .05 }),
    clavo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .7 }),
    tarjeta: new THREE.MeshLambertMaterial({ map: tt, side: THREE.DoubleSide })
  };
  function tono() { return I.col(['#b98353', '#a97446', '#c4905e', '#9f6c40'][Math.floor(rnd() * 4)], .92 + rnd() * .14); }
  /* fondo */
  obra.caja('madera', W, e, D, 0, e / 2, 0, tono());
  obra.caja('papel', W - 2 * e, .002, D - 2 * e, 0, e + .001, 0, I.col('#caa171'));
  /* paredes: tres listones por lado, con una junta fina entre ellos */
  var hl = (Hh - e) / 3;
  for (var i = 0; i < 3; i++) {
    var y = e + hl * i + hl / 2;
    [[W, e, 0, D / 2 - e / 2], [W, e, 0, -D / 2 + e / 2]].forEach(function (c) { obra.caja('madera', c[0] - .004, hl - .003, c[1], c[2], y, c[3], tono()); });
    [[D - 2 * e, W / 2 - e / 2], [D - 2 * e, -W / 2 + e / 2]].forEach(function (c) { obra.caja('madera', e, hl - .003, c[0] - .004, c[1], y, 0, tono()); });
    /* los clavitos en las puntas de cada listón */
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { var cl = new THREE.CylinderGeometry(.0018, .0018, .0012, 8); cl.rotateX(Math.PI / 2); cl.translate(sx * (W / 2 - .008), y, sz * (D / 2 + .0006)); obra.pieza('clavo', cl, I.col('#8d8478')); }); });
  }
  /* esquineros */
  [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) { obra.caja('madera', .014, Hh + .004, .014, sx * (W / 2 - .002), (Hh + .004) / 2, sz * (D / 2 - .002), I.col('#8a5c35')); }); });
  /* relleno de tiras de papel de seda */
  var colores = ['#f6b8cd', '#fbe3ea', '#f19ab8', '#ffffff', '#e9c9a0'];
  for (i = 0; i < 150; i++) {
    var tira = new THREE.BoxGeometry(.004, .0012, .035 + rnd() * .03); tira.rotateY(rnd() * 6.283); tira.rotateX((rnd() - .5) * 1.2); tira.rotateZ((rnd() - .5) * 1.2);
    tira.translate((rnd() - .5) * (W - .04), Hh - .028 + rnd() * .03, (rnd() - .5) * (D - .04));
    obra.pieza('papel', tira, I.col(colores[Math.floor(rnd() * colores.length)]));
  }
  /* la cinta de raso alrededor, a media altura, y su lazo en el frente */
  var CI = I.col('#c2185b'), yc = Hh * .55;
  obra.caja('cinta', W + .003, .022, .002, 0, yc, D / 2 + .0015, CI); obra.caja('cinta', W + .003, .022, .002, 0, yc, -D / 2 - .0015, CI);
  obra.caja('cinta', .002, .022, D + .003, W / 2 + .0015, yc, 0, CI); obra.caja('cinta', .002, .022, D + .003, -W / 2 - .0015, yc, 0, CI);
  var lx = -W * .22, lz = D / 2 + .006;
  [-1, 1].forEach(function (s) {
    var lazo = new THREE.TorusGeometry(.016, .0045, 8, 20); lazo.scale(1.5, .75, .5); lazo.rotateZ(s * .35); lazo.translate(lx + s * .024, yc + .004, lz); obra.pieza('cinta', lazo, CI);
    var cola = new THREE.BoxGeometry(.012, .04, .0015); cola.translate(0, -.02, 0); cola.rotateZ(s * .4); cola.translate(lx + s * .006, yc - .004, lz + .002); obra.pieza('cinta', cola, I.col('#a8144e'));
  });
  var nudo = new THREE.SphereGeometry(.0075, 10, 8); nudo.scale(1, .8, .6); nudo.translate(lx, yc + .002, lz + .002); obra.pieza('cinta', nudo, I.col('#ad1550'));
  /* la tarjetita colgada del lazo, con su hilo */
  var hilo = new THREE.CylinderGeometry(.0006, .0006, .03, 4); hilo.rotateZ(.4); hilo.translate(lx + .02, yc - .016, lz + .004); obra.pieza('clavo', hilo, I.col('#e9dcc4'));
  obra.mallas(mats, g);
  var tarjeta = new THREE.Mesh(new THREE.PlaneGeometry(.05, .031), mats.tarjeta); tarjeta.position.set(lx + .04, yc - .04, lz + .006); tarjeta.rotation.set(-.08, .12, .22); g.add(tarjeta);
  /* la tapa, apoyada al lado de la caja */
  var tapa = new I.Obra(); tapa.caja('madera', W + .012, e, D + .012, 0, 0, 0, tono()); tapa.caja('madera', W + .012, .022, e, 0, -.011, D / 2, tono()); tapa.caja('madera', W + .012, .022, e, 0, -.011, -D / 2, tono());
  var tg = new THREE.Group(); tapa.mallas({ madera: mats.madera }, tg); tg.position.set(0, .07, -D / 2 - .05); tg.rotation.x = -1.25; g.add(tg);
  g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g: g, alto: Hh, liberar: function () { g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); for (var k in mats) mats[k].dispose(); tm.dispose(); tt.dispose(); } };
};

/* ---------- los puntos del logo ---------- */
/* listo(puntos, alto/ancho, lienzo): puntos [{u, v}] en 0..1 (u a la derecha, v hacia abajo),
   repartidos al azar sobre el dibujo; el lienzo es la textura del logo */
I.muestrasLogo = function (src, n, listo) {
  function desde(dibujar, w, h) {
    var c = I.lienzo(w, h), g = c.getContext('2d'); dibujar(g, w, h);
    var d = g.getImageData(0, 0, w, h).data, pts = [], rnd = I.azar(91);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 120) pts.push({ u: (x + .5) / w, v: (y + .5) / h });
    var out = []; for (var i = 0; i < n; i++) out.push(pts.length ? pts[Math.floor(rnd() * pts.length)] : { u: .5, v: .5 });
    return { p: out, c: c };
  }
  /* sin el archivo del logo: la palabra, en el verde de la marca (es lo único que se puede hacer
     sin el dibujo oficial; no se inventa un logo) */
  function texto() { var r = desde(function (g, w, h) { g.fillStyle = '#6f7f45'; g.font = 'bold 120px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RUWAY', w / 2, h / 2); }, 512, 180); listo(r.p, 180 / 512, r.c); }
  if (!src) { texto(); return; }
  var img = new Image(), hecho = false;
  img.onload = function () { if (hecho) return; hecho = true; try { var w = 512, h = Math.round(512 * img.naturalHeight / img.naturalWidth); var r = desde(function (g) { g.drawImage(img, 0, 0, w, h); }, w, h); listo(r.p, h / w, r.c); } catch (e) { texto(); } };
  img.onerror = function () { if (hecho) return; hecho = true; texto(); };
  setTimeout(function () { if (!hecho) { hecho = true; texto(); } }, 2500);
  img.src = src;
};

/* el logo: el dibujo tal cual (colores de la marca, sin estirar), que aparece y se va disolviéndose
   en granos, con un filo dorado donde se está formando, y un brillo dorado muy tenue que sigue su
   propio contorno (no una placa: fuera del dibujo no hay nada) */
I.createLogo = function (lienzo, asp, ancho) {
  var g = new THREE.Group();
  var tex = new THREE.CanvasTexture(lienzo); tex.anisotropy = 4;           /* sin conversión: sale con los colores exactos */
  /* el brillo: el contorno del logo, borroso y dorado (encoger y volver a agrandar = desenfoque barato) */
  var pq = I.lienzo(64, Math.max(8, Math.round(64 * asp))), pg = pq.getContext('2d'); pg.drawImage(lienzo, 0, 0, pq.width, pq.height);
  var gc = I.lienzo(256, Math.round(256 * asp) + 32), gg = gc.getContext('2d'); gg.imageSmoothingEnabled = true;
  gg.drawImage(pq, 16, 16, 224, Math.round(224 * asp)); gg.globalCompositeOperation = 'source-in'; gg.fillStyle = '#ffc861'; gg.fillRect(0, 0, gc.width, gc.height);
  var texG = new THREE.CanvasTexture(gc);
  var sh = {
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    ruido: 'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }'
  };
  var m = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uK: { value: 0 } },
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: sh.vertexShader,
    fragmentShader: 'uniform sampler2D uTex; uniform float uK; varying vec2 vUv; ' + sh.ruido +
      'void main(){ vec4 t = texture2D(uTex, vUv); float r = n(vUv * vec2(34.0, 34.0 * ' + asp.toFixed(3) + ')) * .7 + n(vUv * 90.0) * .3;' +
      ' float u = uK * 1.3 - .15; float vis = smoothstep(r - .04, r + .04, u); float filo = smoothstep(r - .1, r, u) - smoothstep(r, r + .08, u);' +
      ' gl_FragColor = vec4(mix(t.rgb, vec3(1.0, .82, .45), filo * .85), t.a * max(vis, filo * .9)); }'
  });
  var mg = new THREE.MeshBasicMaterial({ map: texG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  var brillo = new THREE.Mesh(new THREE.PlaneGeometry(ancho * 256 / 224, ancho * gc.height / 224), mg); brillo.renderOrder = 19;
  var dibujo = new THREE.Mesh(new THREE.PlaneGeometry(ancho, ancho * asp), m); dibujo.renderOrder = 20; dibujo.position.z = .002;
  g.add(brillo); g.add(dibujo);
  return { g: g, ver: function (k) { m.uniforms.uK.value = k; mg.opacity = I.suave(.3, 1, k) * .55; g.visible = k > .001; },
    liberar: function () { tex.dispose(); texG.dispose(); m.dispose(); mg.dispose(); brillo.geometry.dispose(); dibujo.geometry.dispose(); } };
};

/* ---------- las chispas (un solo sistema de puntos, de tamaño contado) ---------- */
I.createSparks = function (n, tex) {
  var g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), alfa = new Float32Array(n), tam = new Float32Array(n), rnd = I.azar(5);
  for (var i = 0; i < n; i++) { pos[i * 3 + 1] = -999; tam[i] = .5 + rnd() * .9; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('alfa', new THREE.BufferAttribute(alfa, 1)); g.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  var m = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uPx: { value: 1 }, uCol: { value: new THREE.Color('#ffcf7a') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float alfa; attribute float tam; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vA = alfa; gl_PointSize = clamp(tam * uPx * 5.0 / -mv.z, 1.2, 14.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uTex; uniform vec3 uCol; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uCol * t.rgb, t.a * vA); }'
  });
  var p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 21;
  return { p: p, n: n, pos: pos, alfa: alfa, g: g, m: m,
    /* semillas de cada chispa: ángulo, altura, velocidad, radio, retraso, hora de nacer */
    s: (function () { var s = []; for (var i = 0; i < n; i++) s.push({ a: rnd() * 6.283, h: rnd(), v: .6 + rnd() * .9, r: .03 + rnd() * .16, d: rnd(), nace: rnd() }); return s; })() };
};

/* ---------- el portal: anillos de luz en 3D que nacen del centro de la flor ---------- */
I.createPortal = function () {
  var g = new THREE.Group(), uni = { uT: { value: 0 }, uK: { value: 0 }, uLleno: { value: 0 } };
  function anillo(r, grosor, vel, fase) {
    var m = new THREE.ShaderMaterial({
      uniforms: { uT: uni.uT, uK: uni.uK, uV: { value: vel }, uF: { value: fase } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uT, uK, uV, uF; varying vec2 vUv; void main(){ float pulso = .55 + .45 * sin(vUv.x * 6.2832 * 7.0 - uT * uV + uF);' +
        ' float borde = 1.0 - abs(vUv.y - .5) * 2.0; vec3 c = mix(vec3(1.0,.62,.25), vec3(1.0,.93,.75), pulso); gl_FragColor = vec4(c * 1.3, uK * pulso * borde); }'
    });
    var malla = new THREE.Mesh(new THREE.TorusGeometry(r, grosor, 6, 160), m); g.add(malla); return malla;
  }
  var a1 = anillo(1, .016, 5, 0), a2 = anillo(1.07, .007, -3.5, 2), a3 = anillo(.93, .006, 4.2, 4);
  /* el interior: un remolino tenue (lo que se ve al otro lado todavía es la plaza) */
  var md = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uT, uK, uLleno; varying vec2 vUv; void main(){ vec2 p = (vUv - .5) * 2.0; float r = length(p), a = atan(p.y, p.x);' +
      ' float remo = .5 + .5 * sin(a * 5.0 + r * 9.0 - uT * 2.5); float k = smoothstep(1.0, .3, r) * (.12 + .18 * remo) * uK + smoothstep(1.02, .0, r) * uLleno * (.7 + .3 * remo);' +
      ' gl_FragColor = vec4(vec3(1.0,.84,.56) * k, min(1.0, k)); }'
  });
  var disco = new THREE.Mesh(new THREE.CircleGeometry(.95, 48), md); g.add(disco);
  return { g: g, uni: uni,
    girar: function (tv) { a2.rotation.z = tv * .3; a3.rotation.z = -tv * .45; a2.rotation.x = Math.sin(tv * .7) * .12; a3.rotation.y = Math.sin(tv * .6) * .12; },
    liberar: function () { g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } };
};
})();

;
/* RuwayIntro — intro.js: la película de entrada común a todas las experiencias Ruway.

   «La plaza donde comienzan los recuerdos» (≈ 11 s; se puede saltar en cualquier momento):
     A 0–3    Llegada: la Plaza de Armas al atardecer, desde lo alto del lado sur. La cámara baja
              en una curva suave sobre la calle; la Catedral, el monumento y las palmeras.
     B 3–6    La flor despierta: la cámara baja hasta una banca del camino del sur, donde espera una
              cajita con una flor de limpiapipas (unos 35 cm). El tallo se mece, los pétalos se
              abren, el centro late con luz cálida y nacen chispas doradas pequeñas. Si la página
              aún no sabe a qué experiencia va, la escena ESPERA aquí, viva, sin cortes.
     C 6–8    Ruway: las chispas suben y el logo oficial aparece una sola vez sobre la flor. La frase
              de la marca.
     D 8–10   El portal: la luz se extiende por los pétalos, unos anillos de luz nacen del centro de
              la flor, crecen y la cámara pasa por dentro; la luz cubre la pantalla.
     E 10–11  La luz y las chispas se vuelven el mundo de destino (estrellas, mar, camino del
              laberinto, pista…) y se apartan: la página queda en control.

   API (la usa Nucleo.intro):
     var c = RuwayIntro.play({ desde, destino, logo, calidad, alCubrir, alTerminar, frase });
     c.destino(tipo)  la página ya sabe a dónde va: la película sigue
     c.saltar()       lo mismo que el botón "Saltar intro"
     c.cancelar()     se aparta ya (la página falló y tiene algo que decir)
     c.tiempo()       segundos de película (para continuar en otra página)
     c.estado()       {fase, t, fin, modo, esperando}
   alCubrir() se llama con la pantalla tapada por la luz (la página cambia lo de abajo sin que se
   vea el salto); alTerminar(info) se llama UNA vez, con todo ya liberado.

   Nada de esto toca datos del regalo: solo dibuja encima de la página y se retira. */
(function () {
'use strict';
var I = window.__RI;
var T = { TELON: 3.4, B0: 7.0, ESPERA: 10.5, C0: 10.5, D0: 13.2, CUBRE: 16.0, FIN: 17.4 };
/* la banca del camino del sur (la que createTrujilloPlaza pone en x 2,6 · z 38, mirando al camino,
   con el respaldo hacia el este): la cajita va en el extremo sur de su asiento, y la cámara llega
   por el sur, junto al extremo de la banca, con el monumento y la Catedral al fondo */
var BANCA = new THREE.Vector3(2.57, .49, 38.2), ESCALA_FLOR = 1;
var FRASE = 'Cada regalo guarda un mundo. Cada mundo, una historia.';

function hayWebGL() {
  try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
}
function poca() {   /* teléfono modesto: menos píxeles, menos chispas y sombras pintadas */
  var n = navigator, m = n.deviceMemory || 4, h = n.hardwareConcurrency || 4;
  return m <= 3 || h <= 4 || Math.min(screen.width, screen.height) * (devicePixelRatio || 1) < 720;
}

/* ---------- materiales de la obra ---------- */
function materiales(texs, uT) {
  function L(o) { return new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o)); }
  var m = {
    estuco: L({ map: texs.estuco }), piedra: L({ map: texs.piedra }), losa: L({ map: texs.losas }),
    madera: L({ map: texs.madera }), celosia: L({ map: texs.celosia }), verde: L({ map: texs.hoja }),
    tronco: L({ map: texs.piedra }), flores: L({ map: texs.flores }), cerro: L({}),
    vidrio: new THREE.MeshBasicMaterial({ vertexColors: true }),
    luz: new THREE.MeshBasicMaterial({ vertexColors: true }),
    metal: new THREE.MeshLambertMaterial({ vertexColors: true }),
    bronce: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: '#6b5a3c' }),
    palma: L({ alphaMap: texs.palma, alphaTest: .5, side: THREE.DoubleSide }),
    hojas: L({ map: texs.hojas, alphaTest: .45, side: THREE.DoubleSide }),
    relieve: new THREE.MeshPhongMaterial({ map: texs.relieve, shininess: 22, specular: '#6b5a3c' }),
    ciudad: L({ map: texs.ciudad }),
    globo: new THREE.MeshPhongMaterial({ map: texs.globo, shininess: 24, specular: '#6b5a3c' })
  };
  /* las hojas de palmera se mecen en la tarjeta gráfica: ningún objeto se anima en JS */
  m.palma.onBeforeCompile = m.hojas.onBeforeCompile = function (s) {
    s.uniforms.uT = uT;
    s.vertexShader = 'attribute float meceo;\nuniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += vec3(sin(uT * 1.3 + position.x * .21) * .32, sin(uT * 2.1 + position.z * .3) * .06, cos(uT * 1.1 + position.z * .19) * .22) * meceo;');
  };
  return m;
}

/* ---------- fase E: las chispas doradas se vuelven el mundo de destino (2D, sobre la luz) ---------- */
var VIAJE = {
  universo: 'estrellas', planeta: 'planeta', constelaciones: 'constelacion', bitacora: 'ventana',
  laberinto: 'laberinto', carrito: 'pista', corre: 'camino', arbol: 'hojas', vela: 'vela',
  cartas: 'mar', isla: 'isla', match: 'joyas'
};
var FONDO = { estrellas: ['#2b2a5c', '#0b0d24'], planeta: ['#2a2050', '#090a1c'], constelacion: ['#1f2552', '#070918'], ventana: ['#1d2350', '#070918'],
  laberinto: ['#3d5a3a', '#16251a'], pista: ['#ff9e5e', '#7a2a3a'], camino: ['#9fd3ea', '#3f7f52'], hojas: ['#bfe3a5', '#2f5d3a'], vela: ['#4a2a1a', '#120806'],
  mar: ['#3aa3b8', '#0d4a6b'], isla: ['#4fb6c6', '#0d4a6b'], joyas: ['#ffd1e1', '#b8457a'] };
/* dónde termina cada chispa (en 0..1 de la pantalla) y de qué color */
function destinos(modo, n, rnd, asp) {
  var out = [], i, t;
  for (i = 0; i < n; i++) {
    var x = rnd(), y = rnd(), c = '#fff1d6', s = .8 + rnd() * 1.6;
    if (modo === 'laberinto') {          /* un camino de luces que zigzaguea por pasillos */
      t = i / n * 6; var tramo = Math.floor(t), f = t - tramo, filas = [.18, .34, .5, .66, .82, .95];
      var y0 = filas[tramo], y1 = filas[Math.min(5, tramo + 1)], izq = tramo % 2 === 0;
      if (f < .8) { x = izq ? .12 + f / .8 * .76 : .88 - f / .8 * .76; y = y0; } else { x = izq ? .88 : .12; y = y0 + (f - .8) / .2 * (y1 - y0); }
      c = '#ffe9a8';
    } else if (modo === 'pista' || modo === 'camino') {   /* destellos a los lados de una pista que se aleja */
      var lado = i % 2 ? 1 : -1, d = rnd(); x = .5 + lado * (.06 + d * .5); y = .42 + d * .62; s = .8 + d * 2.6; c = modo === 'pista' ? (i % 3 ? '#ffe08a' : '#ff6f61') : '#ffffff';
    } else if (modo === 'ventana') {     /* el marco de una ventana */
      t = rnd() * 4; var k = t % 1;
      if (t < 1) { x = .14 + k * .72; y = .2; } else if (t < 2) { x = .86; y = .2 + k * .6; } else if (t < 3) { x = .86 - k * .72; y = .8; } else { x = .14; y = .8 - k * .6; }
      if (i % 5 === 0) { x = .5; y = .2 + rnd() * .6; } c = '#ffe1aa';
    } else if (modo === 'vela') {        /* se juntan en una llama */
      var r = Math.pow(rnd(), 1.5) * .06, a = rnd() * 6.283; x = .5 + Math.cos(a) * r * .55; y = .5 + Math.sin(a) * r * 1.6 - r; c = rnd() < .5 ? '#ffd27a' : '#ff9d4a';
    } else if (modo === 'mar' || modo === 'isla') {      /* brillos sobre las olas */
      var fila = Math.floor(rnd() * 8); y = .32 + fila * .085; x = rnd(); c = '#e8fbff';
    } else if (modo === 'hojas') { c = rnd() < .6 ? '#8cc96a' : '#ffd79a';
    } else if (modo === 'joyas') { c = ['#ff6f91', '#ffd166', '#7bd389', '#7aa8ff', '#c38cff'][i % 5]; s = 3 + rnd() * 3;
    } else if (modo === 'constelacion' && i < 14) {   /* las primeras catorce dibujan un corazón de estrellas */
      t = i / 14 * Math.PI * 2; x = .5 + .3 * Math.pow(Math.sin(t), 3); y = .44 - .3 * asp * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16; c = '#fff3c4'; s = 2.6;
    } else { c = rnd() < .15 ? '#cfe0ff' : '#fff1d6'; }
    out.push({ x: x, y: y, c: c, s: s, a0: rnd() * 6.283, r0: Math.pow(rnd(), .6) * .3, f: rnd() * 6.283 });
  }
  return out;
}
function mezcla(c1, c2, k) {
  var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  var r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k), g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k), bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
function viaje(g, w, h, modo, k, P, tv) {
  /* k: 0 → recién cubierto (todo luz), 1 → listo para apartarse */
  var cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2, e = I.suave(0, .7, k), ce = 1 - Math.pow(1 - e, 3), F = FONDO[modo] || FONDO.estrellas, i;
  g.clearRect(0, 0, w, h);
  /* del oro de la luz al color del mundo de destino */
  var gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  gr.addColorStop(0, mezcla('#fff3d6', F[0], e)); gr.addColorStop(1, mezcla('#ffcd7a', F[1], e));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  var u = Math.min(w, h);
  if (modo === 'planeta') { var r = u * .2 * (.3 + .7 * ce), gp = g.createRadialGradient(cx - r * .4, cy - r * .4, r * .1, cx, cy, r); gp.addColorStop(0, '#ffd3a0'); gp.addColorStop(1, '#c0567a');
    g.globalAlpha = ce; g.fillStyle = gp; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,230,190,.75)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy, r * 1.7, r * .34, -.3, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
  if (modo === 'isla') { g.globalAlpha = ce; g.fillStyle = '#f0d6a0'; g.beginPath(); g.ellipse(cx, cy + h * .06, w * .26 * ce, h * .05 * ce, 0, 0, 6.283); g.fill(); g.fillStyle = '#5c9646'; g.beginPath(); g.ellipse(cx, cy + h * .045, w * .16 * ce, h * .035 * ce, 0, 0, 6.283); g.fill(); g.globalAlpha = 1; }
  if (modo === 'pista' || modo === 'camino') { g.globalAlpha = ce * .5; g.fillStyle = modo === 'pista' ? '#3b2a33' : '#d9c39a'; g.beginPath(); g.moveTo(cx - w * .04, h * .42); g.lineTo(cx + w * .04, h * .42); g.lineTo(cx + w * .6, h); g.lineTo(cx - w * .6, h); g.fill(); g.globalAlpha = 1; }
  if (modo === 'vela') { var gv = g.createRadialGradient(cx, cy, 0, cx, cy, u * .3); gv.addColorStop(0, 'rgba(255,200,120,' + .55 * ce + ')'); gv.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gv; g.fillRect(0, 0, w, h); }
  /* las chispas: salen del centro (donde estaba el portal) hacia su lugar en el mundo nuevo */
  var pts = [];
  for (i = 0; i < P.length; i++) {
    var p = P[i], sx = cx + Math.cos(p.a0) * p.r0 * R, sy = cy + Math.sin(p.a0) * p.r0 * R;
    var px = sx + (p.x * w - sx) * ce, py = sy + (p.y * h - sy) * ce;
    if (modo === 'mar' || modo === 'isla') py += Math.sin(px / 40 + tv * 2 + p.f) * 3 * ce;
    var tw = .6 + .4 * Math.sin(tv * 4 + p.f), s = (1.2 + (p.s - 1.2) * ce) * (Math.min(w, h) / 420);
    g.globalAlpha = Math.min(1, .5 + .5 * tw);
    g.fillStyle = mezcla('#ffd27a', p.c.charAt(0) === '#' ? p.c : '#fff1d6', ce);
    g.beginPath();
    if (modo === 'hojas' && ce > .3) g.ellipse(px, py, s * 2.2, s, p.f, 0, 6.283); else g.arc(px, py, s, 0, 6.283);
    g.fill();
    pts.push([px, py]);
  }
  g.globalAlpha = 1;
  if (modo === 'constelacion') { g.strokeStyle = 'rgba(255,220,160,' + ce * .55 + ')'; g.lineWidth = 1.2 * (Math.min(w, h) / 420); g.beginPath(); for (i = 0; i < 14; i++) { var q = pts[i]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); } g.closePath(); g.stroke(); }
  if (modo === 'laberinto') { g.strokeStyle = 'rgba(255,233,168,' + ce * .25 + ')'; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath();
    var fl = [.18, .34, .5, .66, .82, .95]; for (i = 0; i < 6; i++) { var izq = i % 2 === 0; g.lineTo((izq ? .12 : .88) * w, fl[i] * h); g.lineTo((izq ? .88 : .12) * w, fl[i] * h); } g.stroke(); }
  /* lo que queda de la luz del portal, que se apaga hacia el centro */
  var gl = g.createRadialGradient(cx, cy, 0, cx, cy, R * (1.1 - ce * .9)); gl.addColorStop(0, 'rgba(255,246,220,' + (1 - ce) + ')'); gl.addColorStop(1, 'rgba(255,210,122,0)');
  g.fillStyle = gl; g.fillRect(0, 0, w, h);
}

/* ---------- el telón (bambalinas de terciopelo rojo que se abren al empezar) ----------
   k: 0 cerrado, 1 abierto. Como un telón de teatro de verdad:
   - dos paños de terciopelo con pliegues de ancho distinto: cada pliegue tiene su fondo oscuro, su
     costado y su lomo brillante (el terciopelo brilla en el lomo y se hunde en negro en el surco);
   - la luz viene de arriba al centro: abajo el telón cae a casi negro;
   - al abrirse, cada paño se recoge hacia su lado y se ata con un cordón dorado con borla: los
     pliegues se juntan en el amarre y se abren otra vez abajo;
   - arriba, la bambalina con sus ondas (bandas de tela colgando en arco, con sus propios pliegues);
   - al final, telón y bambalina se van hacia afuera como si la cámara entrara al escenario. */
var PLIEGUES = null;
function pliegues(n, sem) { var rnd = I.azar(sem), a = [0], t = 0; for (var i = 0; i < n; i++) { t += .6 + rnd() * .8; a.push(t); } return a.map(function (v) { return v / t; }); }
function terciopelo(g, x0, x1, y0, y1) {
  if (x1 - x0 < .5) return;
  var gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, '#1c0003'); gr.addColorStop(.12, '#5a0710'); gr.addColorStop(.38, '#b3101f'); gr.addColorStop(.5, '#e8283a');
  gr.addColorStop(.58, '#c4141f'); gr.addColorStop(.8, '#6a0912'); gr.addColorStop(1, '#22000a');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0 + .6, y1 - y0 + .6);
}
function telon(g, w, h, k, tv) {
  g.clearRect(0, 0, w, h);
  if (k >= 1) return;
  if (!PLIEGUES) PLIEGUES = [pliegues(12, 11), pliegues(12, 23)];
  var a = I.suave(0, .78, k), sale = I.suave(.72, 1, k), u = Math.min(w, h) / 400;
  g.save();
  /* al final todo se aleja hacia afuera, como si la cámara pasara entre los telones */
  var z = 1 + sale * .5; g.translate(w / 2, h * .45); g.scale(z, z); g.translate(-w / 2, -h * .45); g.globalAlpha = 1 - sale;
  var yt = h * .6;                                                     /* altura del amarre */
  function borde(y) {                                                  /* dónde termina el paño (desde su lado) */
    var cerrado = w / 2 + 1, xt = w * .16, xk = w * .055, xb = w * .13;
    var abierto = y < yt ? xt + (xk - xt) * Math.pow(y / yt, 1.6) : xk + (xb - xk) * Math.pow((y - yt) / (h - yt), .7);
    return cerrado + (abierto - cerrado) * a + Math.sin(y / h * 7 + tv) * 1.5 * u * (1 - a);
  }
  var bandas = 22;
  [0, 1].forEach(function (lado) {
    g.save(); if (lado) { g.translate(w, 0); g.scale(-1, 1); }
    var P = PLIEGUES[lado];
    for (var b = 0; b < bandas; b++) {
      var y0 = b / bandas * h, y1 = (b + 1) / bandas * h, xi = borde((y0 + y1) / 2), on = Math.sin(((y0 + y1) / 2) / h * 5 + lado) * 2 * u;
      for (var f = 0; f < P.length - 1; f++) terciopelo(g, P[f] * xi + on * (f % 2 ? 1 : -1) * .5, P[f + 1] * xi + on * (f % 2 ? -1 : 1) * .5, y0, y1);
    }
    /* la orilla del paño, un poco más oscura */
    g.beginPath(); for (b = 0; b <= bandas; b++) { var yy = b / bandas * h; if (b) g.lineTo(borde(yy), yy); else g.moveTo(borde(yy), yy); }
    g.strokeStyle = 'rgba(20,0,4,.6)'; g.lineWidth = 2 * u; g.stroke();
    /* el amarre: cordón dorado con su borla */
    if (a > .25) {
      var xk = borde(yt), al = I.suave(.25, .6, a);
      g.globalAlpha = (1 - sale) * al;
      g.strokeStyle = '#c9952f'; g.lineWidth = 4 * u; g.beginPath(); g.moveTo(0, yt - 6 * u); g.quadraticCurveTo(xk * .6, yt + 4 * u, xk + 2 * u, yt - 2 * u); g.stroke();
      g.strokeStyle = '#f0c766'; g.lineWidth = 1.4 * u; g.stroke();
      var gb = g.createLinearGradient(xk - 6 * u, 0, xk + 6 * u, 0); gb.addColorStop(0, '#7a5414'); gb.addColorStop(.5, '#f2c45c'); gb.addColorStop(1, '#7a5414');
      g.fillStyle = gb; g.beginPath(); g.ellipse(xk + 2 * u, yt + 4 * u, 4.5 * u, 6 * u, 0, 0, 6.283); g.fill();
      g.beginPath(); g.moveTo(xk - 4 * u, yt + 8 * u); g.lineTo(xk + 8 * u, yt + 8 * u); g.lineTo(xk + 10 * u, yt + 40 * u); g.lineTo(xk - 6 * u, yt + 40 * u); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,10,.6)'; g.lineWidth = .8 * u; for (var q = 0; q < 6; q++) { g.beginPath(); g.moveTo(xk - 3 * u + q * 2.2 * u, yt + 10 * u); g.lineTo(xk - 5 * u + q * 2.8 * u, yt + 40 * u); g.stroke(); }
      g.globalAlpha = 1 - sale;
    }
    g.restore();
  });
  /* la luz de arriba al centro y la caída a negro abajo */
  var gv = g.createLinearGradient(0, 0, 0, h); gv.addColorStop(0, 'rgba(0,0,0,.15)'); gv.addColorStop(.35, 'rgba(0,0,0,0)'); gv.addColorStop(.72, 'rgba(0,0,0,.35)'); gv.addColorStop(1, 'rgba(0,0,0,.92)');
  g.fillStyle = gv; g.fillRect(0, 0, w, h);
  var foco = g.createRadialGradient(w / 2, h * .3, 0, w / 2, h * .3, Math.max(w, h) * .55); foco.addColorStop(0, 'rgba(255,90,90,' + .12 * (1 - a) + ')'); foco.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = foco; g.fillRect(0, 0, w, h);
  /* la bambalina: una franja arriba y ondas de tela que cuelgan en arco, cada una con sus pliegues */
  var vh = h * .13, nO = Math.max(3, Math.round(w / (120 * u))), ow = w / nO;
  g.fillStyle = '#3a0008'; g.fillRect(0, 0, w, vh * .3);
  for (var o = -1; o <= nO; o++) {
    var cx = (o + .5) * ow;
    for (var c = 5; c >= 0; c--) {                                     /* de la capa de atrás a la de adelante */
      var prof = vh * (.42 + c * .11), ancho = ow * (.62 + c * .07);
      g.beginPath(); g.moveTo(cx - ancho, vh * .18); g.quadraticCurveTo(cx, prof * 2 - vh * .18, cx + ancho, vh * .18);
      g.quadraticCurveTo(cx, prof * 2 - vh * .18 - vh * .2, cx - ancho, vh * .18); g.closePath();
      var gg = g.createLinearGradient(0, vh * .2, 0, prof + vh * .2); gg.addColorStop(0, '#2a0005'); gg.addColorStop(.55, c % 2 ? '#a3101e' : '#d4202f'); gg.addColorStop(.85, '#7a0a14'); gg.addColorStop(1, '#2a0005');
      g.fillStyle = gg; g.fill();
    }
  }
  var gt = g.createLinearGradient(0, 0, 0, vh * 1.1); gt.addColorStop(0, 'rgba(0,0,0,.55)'); gt.addColorStop(.4, 'rgba(0,0,0,0)'); g.fillStyle = gt; g.fillRect(0, 0, w, vh * 1.1);
  g.restore();
}

function capa(css) { var d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;' + (css || ''); return d; }

I.play = function (op) {
  op = op || {};
  var fin = false, cubierto = false, destino = op.destino || null, t = Math.max(0, +op.desde || 0), tv = 0, ultimo = 0, raf = 0, modo = '3d';
  var porSaltar = false, cancelado = false;
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (op.modo === '2d' || reduce || !hayWebGL()) modo = '2d';
  var baja = op.calidad === 'baja' || (op.calidad !== 'alta' && poca());

  /* --- lo que se ve encima de la página --- */
  var raiz = document.createElement('div'); raiz.id = 'ruway-intro';
  raiz.setAttribute('role', 'presentation');
  raiz.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:#f3e3cf;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none';
  var lienzo3d = null;
  var velo = capa('background:#f3e3cf;transition:opacity .9s ease;opacity:1');
  /* la frase, arriba (el logo va en el centro y la flor abajo): sobre un velo suave del cielo */
  var frase = capa('display:flex;align-items:flex-start;justify-content:center;padding:calc(54px + env(safe-area-inset-top,0px)) 28px 0;opacity:0;transition:opacity .9s ease;' +
    'background:linear-gradient(to top,rgba(0,0,0,0) 70%,rgba(30,20,50,.35));font:500 18px/1.45 Georgia,"Times New Roman",serif;color:#fff8ea;text-align:center;letter-spacing:.02em;text-shadow:0 1px 10px rgba(40,20,40,.6)');
  frase.textContent = op.frase === false ? '' : FRASE;
  var luzD = capa('opacity:0;background:radial-gradient(circle at 50% 50%,#fffaf0 0%,#ffe6b0 40%,#ffcd7a 100%)');
  var cvT = document.createElement('canvas'); cvT.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;pointer-events:none';
  var cv2 = document.createElement('canvas'); cv2.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;pointer-events:none;opacity:0';
  /* "Saltar intro": 44 px de alto (un dedo), contraste alto, abajo a la derecha (lejos del logo) */
  var boton = document.createElement('button'); boton.type = 'button'; boton.textContent = 'Saltar intro'; boton.setAttribute('aria-label', 'Saltar intro');
  boton.style.cssText = 'position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2;pointer-events:auto;opacity:0;transition:opacity .5s;' +
    'min-height:44px;min-width:44px;padding:0 20px;border:1px solid rgba(255,255,255,.75);background:rgba(28,18,12,.62);color:#fff;border-radius:999px;font:600 15px system-ui,-apple-system,sans-serif;letter-spacing:.01em;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent';
  boton.addEventListener('click', function (e) { e.stopPropagation(); saltar(); });
  var logo2d = null;
  if (modo === '2d') {
    logo2d = document.createElement('img'); logo2d.alt = 'Ruway'; if (op.logo) logo2d.src = op.logo;
    logo2d.style.cssText = 'position:fixed;left:50%;top:44%;width:min(52vw,240px);transform:translate(-50%,-50%) scale(.9);opacity:0;transition:opacity .9s ease,transform 2.2s ease';
    logo2d.onerror = function () { logo2d.remove(); };
    raiz.style.background = 'radial-gradient(circle at 50% 44%,#fff3dc 0%,#f2c48f 55%,#c9805a 100%)';
    frase.style.color = '#5a3418'; frase.style.textShadow = 'none'; frase.style.background = 'none';
  }
  velo.style.display = 'none';            /* el telón cerrado es el primer cuadro: no hace falta el velo */
  raiz.style.background = '#3d0712';
  [velo, cvT, frase, luzD, cv2].forEach(function (d) { raiz.appendChild(d); });
  if (logo2d) raiz.insertBefore(logo2d, frase);
  raiz.appendChild(boton);
  (op.contenedor || document.body).appendChild(raiz);
  function medirTelon() { var r = Math.min(devicePixelRatio || 1, 1.5); cvT.width = Math.round((innerWidth || 390) * r); cvT.height = Math.round((innerHeight || 844) * r); }
  medirTelon(); telon(cvT.getContext('2d'), cvT.width, cvT.height, 0, 0);

  /* --- la escena 3D --- */
  var R = null, escena, cam, uT = { value: 0 }, texs = {}, mats = {}, flor, caja, chispas, portal, logo = null, logoPts = null, cielo, luces, luzFlor, ds;
  var cuadro = 0, ANCHO_LOGO = .66, CAB = new THREE.Vector3(), LOGO = new THREE.Vector3(), ANILLO = new THREE.Vector3(), viajeP = null;
  function construir() {
    R = new THREE.WebGLRenderer({ antialias: !baja, alpha: false, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(devicePixelRatio || 1, baja ? 1 : 1.75));
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9;
    /* sombras de verdad (suaves) solo donde el teléfono puede; en los modestos, las pintadas */
    if (!baja) { R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false; }
    lienzo3d = R.domElement; lienzo3d.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:block';
    lienzo3d.addEventListener('webglcontextlost', perdido, false);
    raiz.insertBefore(lienzo3d, velo);
    escena = new THREE.Scene(); escena.fog = new THREE.Fog('#e3b48f', 120, 650);
    cam = new THREE.PerspectiveCamera(50, 1, .03, 2000);
    var sol = new THREE.Vector3(-1, .2, .3).normalize();
    escena.add(new THREE.HemisphereLight('#a6b8e6', '#8a5e3e', .6));
    ds = new THREE.DirectionalLight('#ffb878', 2.1); ds.position.copy(sol).multiplyScalar(160).add(new THREE.Vector3(0, 0, 18)); ds.target.position.set(0, 0, 18); escena.add(ds); escena.add(ds.target);
    if (!baja) { ds.castShadow = true; var sc = ds.shadow.camera; sc.left = -72; sc.right = 72; sc.top = 60; sc.bottom = -60; sc.near = 20; sc.far = 340; ds.shadow.mapSize.set(2048, 2048); ds.shadow.bias = -.0006; ds.shadow.normalBias = .04; ds.shadow.radius = 3; }
    var rel = new THREE.DirectionalLight('#9fb6ff', .32); rel.position.set(60, 40, -40); escena.add(rel);
    cielo = I.createSky(escena, sol);
    texs = { estuco: I.texEstuco(), hojas: I.texHojas(), relieve: I.texRelieve(), ciudad: I.texCiudad(), globo: I.texGlobo(), grano: I.texGrano(7, .16), piedra: I.texGrano(11, .24), hoja: I.texGrano(3, .4), madera: I.texMadera(), celosia: I.texCelosia(), losas: I.texLosas(), palma: I.texHojaPalma(), flores: I.texFlores(), brillo: I.texResplandor(), sombra: I.texSombra() };
    texs.losas.repeat.set(.55, .55);
    mats = materiales(texs, uT);
    var P = I.createTrujilloPlaza(escena, { baja: baja });
    var mallas = P.obra.mallas(mats, escena);
    for (var k in mallas) {
      if (!mats[k]) { mats[k] = new THREE.MeshLambertMaterial({ vertexColors: true }); mallas[k].material = mats[k]; }
      if (!baja && k !== 'cerro' && k !== 'luz' && k !== 'vidrio') { mallas[k].receiveShadow = true; mallas[k].castShadow = k !== 'losa' && k !== 'flores'; }
    }
    /* la palmera proyecta su sombra con el recorte de sus hojas */
    if (!baja && mallas.palma) mallas.palma.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: texs.palma, alphaTest: .5 });
    if (!baja && mallas.hojas) mallas.hojas.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: texs.hojas, alphaTest: .45 });
    /* las luces de los faroles: un punto brillante por farol (se encienden con el atardecer) */
    var gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute(P.luces, 3));
    mats._faroles = new THREE.PointsMaterial({ map: texs.brillo, size: 1.6, color: '#ffcf8a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    luces = new THREE.Points(gl, mats._faroles); escena.add(luces);
    /* sombras de contacto pintadas (bajo palmeras y árboles): con sombras de verdad, más tenues */
    var sp = [], si = [], su = [], n = 0;
    P.sombras.forEach(function (s) { var r = s[2], y = .27; sp.push(s[0] - r, y, s[1] - r, s[0] + r, y, s[1] - r, s[0] + r, y, s[1] + r, s[0] - r, y, s[1] + r); su.push(0, 0, 1, 0, 1, 1, 0, 1); si.push(n, n + 2, n + 1, n, n + 3, n + 2); n += 4; });
    var gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); gs.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); gs.setIndex(si);
    mats._sombra = new THREE.MeshBasicMaterial({ map: texs.sombra, transparent: true, depthWrite: false, opacity: baja ? 1 : .55, polygonOffset: true, polygonOffsetFactor: -2 });
    escena.add(new THREE.Mesh(gs, mats._sombra));
    /* la cajita sobre la banca y la flor dentro */
    caja = I.createCraftBox(); caja.g.position.copy(BANCA); caja.g.rotation.y = .12; escena.add(caja.g);
    flor = I.createFlower({ c1: '#e8378b', c2: '#ff9bcc' }); flor.g.scale.setScalar(ESCALA_FLOR); flor.g.position.set(BANCA.x + .02, BANCA.y + .014, BANCA.z + .02); escena.add(flor.g); flor.abrir(0);
    if (!baja) flor.g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    flor.g.updateMatrixWorld(true); flor.centro(CAB);
    /* su luz: cálida, corta, se nota en la cajita y en la banca */
    luzFlor = new THREE.PointLight('#ffb862', 0, 2.2, 2); luzFlor.position.copy(CAB).add(new THREE.Vector3(0, .02, .08)); escena.add(luzFlor);
    chispas = I.createSparks(baja ? 450 : 900, texs.brillo); escena.add(chispas.p);
    portal = I.createPortal(); portal.g.visible = false; escena.add(portal.g);
    /* el logo flota en el centro de la toma de C (a 1,9 m de la cámara, un poco por encima del eje),
       sobre la flor y contra el cielo y la plaza */
    LOGO.copy(LOGO_L).sub(LOGO_P).normalize().multiplyScalar(1.9).add(LOGO_P); LOGO.y += .4;
    I.muestrasLogo(op.logo, chispas.n, function (pts, asp, lz) {
      if (fin || apagado) return;
      logoPts = { p: pts, asp: asp };
      logo = I.createLogo(lz, asp, ANCHO_LOGO); logo.g.position.copy(LOGO); logo.ver(0); escena.add(logo.g);
    });
    medir();
    if (!baja) R.shadowMap.needsUpdate = true;     /* la luz no se mueve: la sombra se calcula una vez (y otra si cambia el tamaño) */
    R.compile(escena, cam);
  }
  function medir() {
    var w = innerWidth || 390, h = innerHeight || 844;
    if (R) { R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 50; cam.updateProjectionMatrix(); if (chispas) chispas.m.uniforms.uPx.value = R.getPixelRatio() * (h / 800); }
    cv2.width = Math.round(w * Math.min(devicePixelRatio || 1, 1.5)); cv2.height = Math.round(h * Math.min(devicePixelRatio || 1, 1.5));
  }

  /* --- la cámara: una curva suave desde lo alto del lado sur hasta la flor --- */
  var vP = new THREE.Vector3(), vL = new THREE.Vector3(), vA = new THREE.Vector3(), vB = new THREE.Vector3(), fija = null;
  /* desde lo alto (se ve la plaza entera, como en las fotos aéreas), bajando despacio por el camino
     del sur hasta quedar frente a la banca, un poco por encima de la flor */
  var RUTA = new THREE.CatmullRomCurve3([new THREE.Vector3(5, 36, 78), new THREE.Vector3(8, 22, 63), new THREE.Vector3(8, 9.5, 51), new THREE.Vector3(5.6, 3.6, 45),
    new THREE.Vector3(3.5, 1.8, 41.0), new THREE.Vector3(2.85, 1.3, 39.3)], false, 'centripetal');
  var MIRA = new THREE.CatmullRomCurve3([new THREE.Vector3(-4, 0, -14), new THREE.Vector3(-3, 2, -10), new THREE.Vector3(-1, 4.5, 0), new THREE.Vector3(1, 3, 18),
    new THREE.Vector3(2.3, 1.2, 32), new THREE.Vector3(2.56, .86, 38.15)], false, 'centripetal');
  /* C: la cámara sube y retrocede: la flor abajo, el logo al centro, la plaza detrás */
  var LOGO_P = new THREE.Vector3(2.92, 1.95, 41.05), LOGO_L = new THREE.Vector3(2.55, 1.2, 36.85);
  function camara(t) {
    /* llegada (0–6 s): un solo movimiento que arranca y frena suave */
    var s = I.lim(t / T.ESPERA, 0, 1), u = s * s * s * (s * (s * 6 - 15) + 10);
    RUTA.getPoint(u, vP); MIRA.getPoint(u, vL);
    /* C: un paso atrás para ver la flor y el logo juntos */
    var c = I.suave(T.C0, T.C0 + 2.0, t); vP.lerp(LOGO_P, c); vL.lerp(LOGO_L, c);
    /* D: hacia el centro del anillo, cada vez más rápido, y a través */
    var d = I.suave(T.D0 + 1.2, T.CUBRE + .1, t); d = Math.pow(d, 2.2);
    vA.copy(ANILLO).add(new THREE.Vector3(.01, 0, .02)); vB.copy(ANILLO).add(new THREE.Vector3(-.04, 0, -.8));
    vP.lerp(vA, d); vL.lerp(vB, d);
    /* una respiración de cámara en mano, muy leve */
    var ma = 1 - d; vP.x += Math.sin(tv * .7) * .012 * ma; vP.y += Math.sin(tv * .9) * .008 * ma;
    if (fija) { vP.fromArray(fija[0]); vL.fromArray(fija[1]); }
    cam.position.copy(vP); cam.lookAt(vL);
  }

  /* --- las chispas --- */
  var M4 = new THREE.Matrix4(), q = new THREE.Vector3();
  function moverChispas(t) {
    var C = chispas, s = C.s, pos = C.pos, al = C.alfa;
    var kl = I.suave(T.C0, T.C0 + 1.4, t), quieto = I.suave(T.C0 + 1.3, T.C0 + 2.0, t), kp = I.suave(T.D0 - .1, T.D0 + .8, t), apaga = 1 - I.suave(T.CUBRE - .15, T.CUBRE, t);
    var lp = logoPts, Wl = ANCHO_LOGO;
    if (logo) { logo.g.updateMatrixWorld(true); M4.copy(logo.g.matrixWorld); } else M4.makeTranslation(LOGO.x, LOGO.y, LOGO.z);
    portal.g.updateMatrixWorld(true);
    for (var i = 0; i < C.n; i++) {
      var p = s[i], nace = T.B0 + 1.2 + p.nace * (T.ESPERA - T.B0 - 1.2), vida = I.suave(nace, nace + .7, t);
      /* nacen cerca de los pétalos y suben girando despacio */
      var a = p.a + tv * p.v * .7, sube = ((tv * .05 * p.v + p.h) % 1);
      var x = CAB.x + Math.cos(a) * (p.r + sube * .05), y = CAB.y - .02 + sube * .26, z = CAB.z + Math.sin(a) * (p.r + sube * .05) * .7;
      if (kl > 0 && lp) {                       /* se reúnen en el dibujo del logo */
        var kk = I.suave(p.d * .35, p.d * .35 + .65, kl), m = lp.p[i];
        q.set((m.u - .5) * Wl, -(m.v - .5) * Wl * lp.asp, .01).applyMatrix4(M4);
        x += (q.x - x) * kk; y += (q.y - y) * kk + Math.sin(kk * Math.PI) * .05 * (p.h - .5); z += (q.z - z) * kk;
      }
      if (kp > 0) {                             /* y bajan a montar los anillos */
        var kq = I.suave(p.d * .4, p.d * .4 + .6, kp), ap = p.a + tv * (1.2 + p.v * .6), rr = (.9 + .2 * p.h);
        q.set(Math.cos(ap) * rr, Math.sin(ap) * rr, (p.h - .5) * .15).applyMatrix4(portal.g.matrixWorld);
        x += (q.x - x) * kq; y += (q.y - y) * kq; z += (q.z - z) * kq;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      var brillo = .5 + .5 * Math.sin(tv * 3 + i * 1.3);
      /* mientras el logo se ve entero, las chispas casi se apagan: ahora son el logo */
      al[i] = vida * apaga * (.35 + .65 * brillo) * (1 - quieto * .8 * (1 - kp)) * (kl > 0 ? 1 : .8);
    }
    C.g.attributes.position.needsUpdate = true; C.g.attributes.alfa.needsUpdate = true;
  }

  /* --- un cuadro de película --- */
  function escenaEn(t) {
    uT.value = tv; cielo.material.uniforms.uT.value = tv;
    /* la flor: se mece, se abre, late; y en D la luz se extiende por todos sus pétalos */
    flor.mecer(tv, I.suave(T.B0 - .4, T.B0 + .6, t));
    flor.abrir(I.suave(T.B0 + .6, T.ESPERA - .4, t));
    var late = .5 + .5 * Math.sin(tv * 2.4), despierta = I.suave(T.B0 + 1.6, T.ESPERA, t), extiende = I.suave(T.D0, T.D0 + 1.2, t);
    flor.luz(tv * .5, despierta * .08 + extiende * .55, despierta * (.35 + .4 * late) + extiende * .8);
    luzFlor.intensity = despierta * (.5 + .35 * late) + extiende * 1.6;
    mats._faroles.opacity = .2 + I.suave(1, 9, t) * .55;
    /* el portal nace del centro de la flor y sube un poco mientras crece */
    var kn = I.suave(T.D0 + .1, T.D0 + 1.5, t);
    ANILLO.copy(CAB).add(new THREE.Vector3(0, .4 * kn + .02, .02));
    portal.g.visible = kn > 0; portal.g.position.copy(ANILLO);
    var ra = .001 + kn * .24; portal.g.scale.set(ra, ra, ra);
    portal.g.lookAt(cam.position);
    portal.uni.uT.value = tv; portal.uni.uK.value = kn; portal.uni.uLleno.value = I.suave(T.D0 + 1.5, T.CUBRE - .3, t); portal.girar(tv);
    if (logo) { logo.g.lookAt(cam.position); logo.ver(I.suave(T.C0 + .6, T.C0 + 1.8, t) * (1 - I.suave(T.D0 - .4, T.D0 + .3, t))); }
    camara(t);
    moverChispas(t);
    R.render(escena, cam);
  }

  /* --- el reloj (basado en el tiempo real entre cuadros) --- */
  function paso(ahora) {
    raf = requestAnimationFrame(paso);
    var dt = ultimo ? Math.min(.05, (ahora - ultimo) / 1000) : 0; ultimo = ahora;
    avanzar(dt);
  }
  function avanzar(dt) {
    if (fin) return;
    tv += dt;
    var espera = !destino && !porSaltar && t >= T.ESPERA && tv < 50;   /* nunca para siempre */
    if (!espera) t += dt;
    if (modo === '3d' && !cubierto) { try { escenaEn(Math.min(t, T.CUBRE)); } catch (e) { I.error = String(e && e.stack || e); pasarA2d(); return; } cuadro++; }
    else en2d(t);
    /* la capa de encima: velo inicial, frase, luz que cubre y el viaje */
    /* el telón se abre en cuanto la plaza ya está dibujada */
    var kt = I.suave(.35, T.TELON, t);
    if (cvT.parentNode) { if (kt >= 1 || porSaltar) cvT.parentNode.removeChild(cvT); else telon(cvT.getContext('2d'), cvT.width, cvT.height, (modo === '3d' && cuadro < 2) ? 0 : kt, tv); }
    boton.style.opacity = tv > .6 && t < T.CUBRE ? '1' : '0';
    frase.style.opacity = t > T.C0 + 1.2 && t < T.D0 + .5 ? '1' : '0';
    /* la luz cubre al final, cuando la cámara ya está dentro del anillo */
    var kc = I.suave(T.CUBRE - .55, T.CUBRE, t); luzD.style.opacity = String(kc * kc);
    if (t >= T.CUBRE && !cubierto) {
      cubierto = true; luzD.style.opacity = '1';
      apagar3d();                                  /* la memoria vuelve a la página antes del viaje */
      if (typeof op.alCubrir === 'function') try { op.alCubrir(destino); } catch (e) { setTimeout(function () { throw e; }); }
    }
    if (cubierto) {
      var k = I.lim((t - T.CUBRE) / (T.FIN - T.CUBRE), 0, 1), md = VIAJE[destino] || 'estrellas';
      if (!viajeP) viajeP = destinos(md, porSaltar ? 90 : 160, I.azar(77), cv2.width / cv2.height);
      cv2.style.opacity = '1';
      viaje(cv2.getContext('2d'), cv2.width, cv2.height, md, k, viajeP, tv);
      var sale = I.suave(.62, 1, k); raiz.style.opacity = String(1 - sale); raiz.style.background = 'transparent';
      if (k >= 1) terminar(cancelado ? 'cancelada' : porSaltar ? 'saltada' : 'completa');
    }
  }
  function en2d(t) {
    if (logo2d) { logo2d.style.opacity = t > .2 && t < T.CUBRE ? '1' : '0'; logo2d.style.transform = 'translate(-50%,-50%) scale(' + (t > .2 ? 1 : .9) + ')'; }
  }
  function pasarA2d() {
    /* algo falló en la tarjeta gráfica: se termina con la luz, sin cortes bruscos */
    apagar3d(); modo = '2d'; raiz.style.background = 'radial-gradient(circle at 50% 44%,#fff3dc 0%,#f2c48f 55%,#c9805a 100%)';
    if (t < T.CUBRE - .6) t = T.CUBRE - .6;
  }
  function perdido(e) { if (e && e.preventDefault) e.preventDefault(); pasarA2d(); }

  /* --- liberar: todo lo que se creó, una vez --- */
  var apagado = false;
  function apagar3d() {
    if (apagado || !R) return; apagado = true;
    try {
      escena.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.customDepthMaterial) o.customDepthMaterial.dispose(); });
      for (var k in mats) if (mats[k] && mats[k].dispose) mats[k].dispose();
      for (k in texs) if (texs[k] && texs[k].dispose) texs[k].dispose();
      if (cielo) { cielo.material.uniforms.uNubes.value.dispose(); cielo.material.dispose(); }
      if (flor) flor.liberar(); if (caja) caja.liberar(); if (logo) logo.liberar(); if (portal) portal.liberar();
      if (chispas) { chispas.g.dispose(); chispas.m.dispose(); }
      if (ds && ds.shadow && ds.shadow.map) ds.shadow.map.dispose();
      R.renderLists.dispose(); R.dispose();
      lienzo3d.removeEventListener('webglcontextlost', perdido, false);
      if (R.forceContextLoss) R.forceContextLoss();
    } catch (e) {}
    if (lienzo3d && lienzo3d.parentNode) lienzo3d.parentNode.removeChild(lienzo3d);
    escena = null; R = null;
  }
  function terminar(como) {
    if (fin) return; fin = true;
    cancelAnimationFrame(raf); removeEventListener('resize', alMedir); removeEventListener('orientationchange', alMedir);
    apagar3d();
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
    if (I.ultimo === ctl) I.ultimo = null;
    if (typeof op.alTerminar === 'function') try { op.alTerminar({ como: como, destino: destino }); } catch (e) { setTimeout(function () { throw e; }); }
  }
  /* saltar: directo a la luz (la experiencia se abre en menos de un segundo) */
  function saltar() { if (fin || porSaltar) return; porSaltar = true; cv2.style.transition = 'opacity .25s'; t = Math.max(t, T.CUBRE); }
  function alMedir() { medir(); medirTelon(); if (R && !baja) R.shadowMap.needsUpdate = true; }

  var ctl = {
    destino: function (tipo) { if (typeof tipo === 'string' && /^[a-z]{2,20}$/.test(tipo)) destino = tipo; else if (!destino) destino = 'universo'; return ctl; },
    saltar: function () { saltar(); return ctl; },
    cancelar: function () { if (fin) return ctl; cancelado = true; saltar(); return ctl; },
    tiempo: function () { return t; },
    estado: function () { return { fase: t < T.B0 ? 'A' : t < T.C0 ? 'B' : t < T.D0 ? 'C' : t < T.CUBRE ? 'D' : 'E', t: t, fin: fin, modo: modo, esperando: !destino && t >= T.ESPERA }; },
    /* solo para revisar: cuánto dibuja cada cuadro */
    info: function () { return R ? { llamadas: R.info.render.calls, triangulos: R.info.render.triangles, geometrias: R.info.memory.geometries, texturas: R.info.memory.textures, sombras: !!R.shadowMap.enabled, camara: cam.position.toArray().map(function (v) { return +v.toFixed(2); }), anillo: ANILLO.toArray().map(function (v) { return +v.toFixed(2); }), logo: LOGO.toArray().map(function (v) { return +v.toFixed(2); }), mira: vL.toArray().map(function (v) { return +v.toFixed(2); }) } : null; },
    /* solo para revisar la maqueta: cámara fija [pos], [mira] (null la suelta) */
    vista: function (p, l) { fija = p && l ? [p, l] : null; return ctl; },
    /* solo para grabar o probar cuadro a cuadro: detiene el reloj y avanza a mano */
    manual: function () { cancelAnimationFrame(raf); raf = 0; ctl.avanzar = function (dt) { avanzar(dt); }; return ctl; }
  };
  I.ultimo = ctl;
  addEventListener('resize', alMedir); addEventListener('orientationchange', alMedir);

  /* se construye un instante después de pintar el velo (si no, la pantalla se queda en blanco
     mientras se arma la plaza) */
  function arrancar() {
    if (fin) return;
    if (modo === '3d' && !cubierto) { try { construir(); } catch (e) { I.error = String(e && e.stack || e); apagar3d(); modo = '2d'; raiz.style.background = 'radial-gradient(circle at 50% 44%,#fff3dc 0%,#f2c48f 55%,#c9805a 100%)'; } }
    if (modo === '2d') medir();
    raf = requestAnimationFrame(paso);
  }
  setTimeout(arrancar, 30);
  return ctl;
};

window.RuwayIntro = { play: I.play, hayWebGL: hayWebGL, tiempos: T, version: 2 };
})();
