/* GENERADO POR construir.js desde lib/arbol/ · NO EDITAR A MANO */
/* El árbol que se enciende — prototipo (etapa 1).
   base.js: utilidades comunes, calidad automática y las luces de la plaza.

   Varias piezas salen del chasqui (maquetas/chasqui/cielo.js), copiadas aquí para no tocar
   esa carpeta: azar, ruido repetible, lienzos, unir geometrías y la calidad del equipo.

   LAS LUCES. La plaza tiene unas 14 fuentes de luz cálida (faroles, el puesto, el nacimiento,
   la pileta y, al final, el árbol). Ningún celular barato pinta 14 luces de verdad por píxel.
   Cada cuadro se eligen las K más cercanas a lo que se mira (K = 4, 6 u 8 según la calidad):
   esas K mueven las K PointLight de three (los materiales Lambert iluminan por vértice, así que
   cuestan poco) y llenan los mismos arreglos de uniforms que usan los shaders propios (piso,
   fachadas, Don Gruñón). Las lejanas no se notan: su luz ya cayó a casi nada. */
(function () {
'use strict';
var A = window.Arbol = window.Arbol || {};

/* ---------- utilidades ---------- */
A.azar = function (sem) { var s = sem >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
A.suave = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
A.lim = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
A.angDif = function (a, b) { return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; };
/* ruido de valor que se repite cada "per" celdas (texturas sin costuras) */
A.ruidoPer = function (per, rnd) {
  var g = new Float32Array(per * per); for (var i = 0; i < g.length; i++) g[i] = rnd();
  return function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    var x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    var a = g[y0 * per + x0], b = g[y0 * per + x1], c = g[y1 * per + x0], d = g[y1 * per + x1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
};
A.lienzo = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
A.texDe = function (c, srgb, rep) {
  var t = new THREE.CanvasTexture(c); if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};
/* Une geometrías en una sola (una llamada de dibujo). Toma los atributos de la primera; a las
   que no traen color, uv u otro atributo se les pone uno neutro. Suelta las originales. */
A.unir = function (geos) {
  var noms = {}, tam = {};
  geos.forEach(function (g) { Object.keys(g.attributes).forEach(function (n) { noms[n] = 1; tam[n] = g.attributes[n].itemSize; }); });
  var lista = Object.keys(noms), datos = {};
  lista.forEach(function (n) { datos[n] = []; });
  geos.forEach(function (g) {
    var gg = g.index ? g.toNonIndexed() : g, cnt = gg.attributes.position.count;
    lista.forEach(function (n) {
      var a = gg.attributes[n], d = datos[n], k = tam[n], i, j;
      if (a) { for (i = 0; i < cnt; i++) for (j = 0; j < k; j++) d.push(a.array[i * a.itemSize + j]); }
      else { var neutro = n === 'color' ? 1 : 0; for (i = 0; i < cnt * k; i++) d.push(neutro); }
    });
    if (gg !== g) gg.dispose(); g.dispose();
  });
  var r = new THREE.BufferGeometry();
  lista.forEach(function (n) { r.setAttribute(n, new THREE.Float32BufferAttribute(datos[n], tam[n])); });
  r.computeBoundingSphere(); return r;
};
A.pintar = function (g, hex) {
  var c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
};
A.reducido = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Alfa "nítida" para hojas y matas recortadas: el borde se afila con fwidth y, a lo lejos, el
   alfa se sube según el nivel de mipmap (si no, las hojitas finas desaparecen y la palmera queda
   rala). Solo con WebGL2 (fwidth siempre disponible); en WebGL1 queda el recorte de siempre. */
A.alfaNitida = function (m, w, h) {
  if (!A.webgl2) return;
  m.onBeforeCompile = function (sh) {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', [
      '#ifdef ALPHATEST',
      '  vec2 dxA = dFdx(vUv * vec2(' + w + '.0, ' + h + '.0)), dyA = dFdy(vUv * vec2(' + w + '.0, ' + h + '.0));',
      '  float lodA = max(0.0, .5 * log2(max(dot(dxA, dxA), dot(dyA, dyA))));',
      '  diffuseColor.a *= 1.0 + lodA * .28;',
      '  diffuseColor.a = (diffuseColor.a - ALPHATEST) / max(fwidth(diffuseColor.a), 1e-4) + .5;',
      '  if (diffuseColor.a < .5) discard;',
      '#endif'].join('\n'));
  };
};

/* ---------- calidad del equipo (la misma regla del chasqui) ----------
   gpu: el nombre de la tarjeta de video si la página ya lo averiguó (así no se abre otro
   contexto WebGL solo para preguntarlo). */
A.calidad = function (gpuDado) {
  var q = (location.search.match(/[?&]q=(bajo|medio|alto)/) || [])[1];
  if (q) return q;
  var nucleos = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, gpu = '';
  if (typeof gpuDado === 'string') gpu = gpuDado;
  else try {
    var cv = document.createElement('canvas'), gl = cv.getContext('webgl');
    var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    var l = gl && gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
  } catch (e) {}
  A.gpu = gpu;
  if (/Mali-[4T]|Mali-G31|Mali-G51|Adreno \(TM\) [34]\d\d|Adreno \(TM\) 50\d|PowerVR SGX|PowerVR Rogue GE|SwiftShader|HD Graphics( \d{3,4})?\b(?!.*Iris)/i.test(gpu)) return 'bajo';
  if (mem <= 2 || nucleos <= 4) return 'bajo';
  if (mem <= 4 || /Mali-G5|Mali-G6|Adreno \(TM\) 5|Adreno \(TM\) 6[01]\d/i.test(gpu)) return 'medio';
  return 'alto';
};
/* ramas: tarjetas de agujas del árbol · foquitos: luces del árbol · cuentas: guirnalda ·
   bolitas: adornos chicos · luces: cuántas PointLight reales · conchas: capas de pelusa de Don
   Gruñón (0 = sin capas; solo en alta: en un celular mediano pesan más de lo que se ven) ·
   cubo: lado del cubemap de los reflejos */
A.AJUSTES = {
  bajo:  { nombre: 'bajo',  pr: 1.0, aa: false, ramas: 190, foquitos: 200, cuentas: 140, bolitas: 46,  estrellas: 2200, fuegos: 1100, nieve: 280, conchas: 0, luces: 4, cubo: 128, detalle: 0, flores: 40 },
  medio: { nombre: 'medio', pr: 1.5, aa: false, ramas: 360, foquitos: 340, cuentas: 240, bolitas: 76,  estrellas: 3800, fuegos: 2300, nieve: 560, conchas: 0, luces: 6, cubo: 256, detalle: 1, flores: 90 },
  alto:  { nombre: 'alto',  pr: 2.0, aa: true,  ramas: 560, foquitos: 500, cuentas: 340, bolitas: 104, estrellas: 5400, fuegos: 3400, nieve: 950, conchas: 6, luces: 8, cubo: 256, detalle: 2, flores: 150 }
};

/* resplandor radial (bloom barato con sprites o puntos aditivos) */
A.texResplandor = (function () {
  var t = null;
  return function () {
    if (t) return t;
    var c = A.lienzo(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,255,255,.55)'); g.addColorStop(.35, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); t = new THREE.CanvasTexture(c); return t;
  };
})();
/* sombra de contacto: mancha oscura de borde suave (multiplica el piso) */
A.texSombra = (function () {
  var t = null;
  return function () {
    if (t) return t;
    var c = A.lienzo(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(.45, 'rgba(0,0,0,.42)'); g.addColorStop(.8, 'rgba(0,0,0,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); t = new THREE.CanvasTexture(c); return t;
  };
})();
/* Ruido de varias escalas en una sola textura repetible (R grande, G mediana, B fina, A granito).
   Lo usan el piso, el estuco, el pasto, la corteza y la pelusa de los limpiapipas. */
A.texRuido = (function () {
  var t = null;
  return function () {
    if (t) return t;
    var N = 256, rnd = A.azar(919), d = new Uint8Array(N * N * 4);
    var o1 = [A.ruidoPer(4, rnd), A.ruidoPer(8, rnd), A.ruidoPer(16, rnd)], o2 = [A.ruidoPer(16, rnd), A.ruidoPer(32, rnd)], o3 = [A.ruidoPer(64, rnd), A.ruidoPer(128, rnd)];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var u = x / N, v = y / N, k = (y * N + x) * 4;
      var a = o1[0](u * 4, v * 4) * .55 + o1[1](u * 8, v * 8) * .3 + o1[2](u * 16, v * 16) * .15;
      var b = o2[0](u * 16, v * 16) * .6 + o2[1](u * 32, v * 32) * .4;
      var c = o3[0](u * 64, v * 64) * .6 + o3[1](u * 128, v * 128) * .4;
      d[k] = a * 255; d[k + 1] = b * 255; d[k + 2] = c * 255; d[k + 3] = rnd() * 255;
    }
    t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true; return t;
  };
})();

/* ---------- uniforms compartidos ---------- */
A.U = {
  uT: { value: 0 },
  uLuna: { value: new THREE.Vector3(.38, .42, -.82).normalize() },
  uLunaCol: { value: new THREE.Color(.13, .17, .3) },
  uCieloCol: { value: new THREE.Color(.03, .038, .07) },     /* luz que baja del cielo (hemisferio) */
  uSueloCol: { value: new THREE.Color(.018, .014, .011) },     /* la que rebota del piso */
  uLucesPos: { value: [] }, uLucesCol: { value: [] }, uLucesRad: { value: [] },
  uFiesta: { value: 0 }                                       /* 0 → 1 cuando todo se enciende al final */
};
A.unif = function (extra) { var u = {}, k; for (k in A.U) u[k] = A.U[k]; for (k in extra) u[k] = extra[k]; return u; };

/* Se llama UNA vez, antes de armar los materiales: el número de luces va fijo en el GLSL
   (un bucle de largo constante), así en "bajo" cada píxel solo mira 4. */
A.prepararLuces = function (k) {
  A.MAX_LUCES = k;
  for (var i = 0; i < k; i++) { A.U.uLucesPos.value.push(new THREE.Vector3(0, -999, 0)); A.U.uLucesCol.value.push(new THREE.Color(0, 0, 0)); A.U.uLucesRad.value.push(1); }
  A.GLSL_LUZ = GLSL_LUZ.replace('@NL@', String(k));
};

/* GLSL de la luz de la plaza: hemisferio + luna + las K luces cercanas.
   "envuelve" ablanda el lado oscuro (telas, pelusa); 0 = Lambert puro. */
var GLSL_LUZ = [
  '#define NL @NL@',
  'uniform vec3 uLuna, uLunaCol, uCieloCol, uSueloCol;',
  'uniform vec3 uLucesPos[NL]; uniform vec3 uLucesCol[NL]; uniform float uLucesRad[NL];',
  'uniform float uT, uFiesta;',
  'vec3 luzPlaza(vec3 p, vec3 n, float envuelve){',
  '  vec3 c = mix(uSueloCol, uCieloCol, n.y * .5 + .5);',
  '  c += uLunaCol * max((dot(n, uLuna) + envuelve) / (1.0 + envuelve), 0.0);',
  '  for (int i = 0; i < NL; i++) {',
  /* la misma caída que las PointLight de three (modo clásico): (1 − d/alcance)², × 1,6 */
  '    vec3 L = uLucesPos[i] - p; float d2 = dot(L, L); float d = sqrt(d2);',
  '    float at = pow(clamp(1.0 - d / (uLucesRad[i] * 1.15), 0.0, 1.0), 2.0) * 1.6;',
  '    float nl = max((dot(n, L / max(d, 1e-3)) + envuelve) / (1.0 + envuelve), 0.0);',
  '    c += uLucesCol[i] * at * nl;',
  '  }',
  '  return c;',
  '}',
  /* brillo especular de las luces cercanas (piedra pulida por los pasos, metal, vidrio) */
  'vec3 brilloPlaza(vec3 p, vec3 n, vec3 v, float dureza){',
  '  vec3 s = vec3(0.0);',
  '  for (int i = 0; i < NL; i++) {',
  '    vec3 L = uLucesPos[i] - p; float d2 = dot(L, L); float d = sqrt(d2);',
  '    float at = pow(clamp(1.0 - d / (uLucesRad[i] * 1.15), 0.0, 1.0), 2.0) * 1.6;',
  '    vec3 h = normalize(L / max(d, 1e-3) + v);',
  '    s += uLucesCol[i] * pow(max(dot(n, h), 0.0), dureza) * at;',
  '  }',
  '  return s;',
  '}'
].join('\n');

/* Antes de cada partida (la página puede abrir el juego otra vez): se vacían los registros que
   los módulos llenan al armar la plaza (luces, choques), para que nada se duplique. */
A.reiniciar = function () {
  A.luces.length = 0; orden.length = 0; A.reales = [];
  A.U.uLucesPos.value = []; A.U.uLucesCol.value = []; A.U.uLucesRad.value = [];
  A.U.uT.value = 0; A.U.uFiesta.value = 0;
  if (A.colisiones) A.colisiones.length = 0;
};

/* ---------- el registro de luces ---------- */
A.luces = [];   /* {p: Vector3, col: Color, i: intensidad, r: alcance, on: 0..1} */
var orden = [];  /* la misma lista, ordenada en su sitio cada cuadro (sin crear arreglos) */
A.agregarLuz = function (x, y, z, hex, intens, alcance) {
  var L = { p: new THREE.Vector3(x, y, z), col: new THREE.Color(hex), i: intens, r: alcance || 10, on: 1, d: 0 };
  A.luces.push(L); orden.push(L); return L;
};
function porCercania(a, b) { return a.d - b.d; }
/* las PointLight reales (para Lambert/Standard): se crean una vez y no cambia su número */
A.armarLuces = function (escena, k) {
  A.MAX_REAL = k; A.reales = [];
  for (var i = 0; i < k; i++) { var pl = new THREE.PointLight('#ffffff', 0, 10, 2); escena.add(pl); A.reales.push(pl); }
};
/* cada cuadro: ordena por cercanía a "foco" (pesada por lo fuerte que es cada luz) y reparte */
A.repartirLuces = function (foco) {
  var L = A.luces, i;
  for (i = 0; i < L.length; i++) L[i].d = L[i].p.distanceToSquared(foco) / Math.max(.001, L[i].r * L[i].r * L[i].i * L[i].on);
  orden.sort(porCercania);
  var U = A.U;
  for (i = 0; i < A.MAX_LUCES; i++) {
    var l = orden[i];
    if (l && l.on > .001) {
      U.uLucesPos.value[i].copy(l.p); U.uLucesCol.value[i].copy(l.col).multiplyScalar(l.i * l.on); U.uLucesRad.value[i] = l.r;
    } else { U.uLucesPos.value[i].set(0, -999, 0); U.uLucesCol.value[i].setRGB(0, 0, 0); U.uLucesRad.value[i] = 1; }
  }
  for (i = 0; i < A.reales.length; i++) {
    var pl = A.reales[i], l2 = orden[i];
    if (l2 && l2.on > .001) { pl.position.copy(l2.p); pl.color.copy(l2.col); pl.intensity = l2.i * l2.on * 1.6; pl.distance = l2.r * 1.15; }
    else pl.intensity = 0;
  }
};
})();

;
/* El árbol que se enciende — prototipo.
   cielo.js: el cielo de Nochebuena. Es el del chasqui (maquetas/chasqui/cielo.js) fijo en la
   noche: estrellas tenues y vía láctea horneadas una vez en un cubemap, las brillantes como
   puntos nítidos de caída gaussiana que titilan, la luna grande procedural con su halo, y
   estrellas fugaces de vez en cuando. Lo propio de aquí: el resplandor cálido de la ciudad en
   el horizonte (en la costa nunca está negro del todo) y un poco menos de estrellas abajo. */
(function () {
'use strict';
var A = window.Arbol;

/* ---------- la luna (procedural): mares, cráteres con borde iluminado, rayos ---------- */
function texLuna(N) {
  var c = A.lienzo(N, N), x = c.getContext('2d'), rnd = A.azar(211), k = N / 512;
  var o = [A.ruidoPer(6, rnd), A.ruidoPer(12, rnd), A.ruidoPer(24, rnd), A.ruidoPer(48, rnd)];
  var im = x.createImageData(N, N), d = im.data, i, px, py;
  var mares = [[.36, .3, .17], [.55, .26, .13], [.62, .45, .15], [.3, .55, .11], [.45, .62, .09], [.7, .66, .08]];
  for (py = 0; py < N; py++) for (px = 0; px < N; px++) {
    var u = px / N, v = py / N, f = o[0](u * 6, v * 6) * .5 + o[1](u * 12, v * 12) * .25 + o[2](u * 24, v * 24) * .15 + o[3](u * 48, v * 48) * .1;
    var mar = 0;
    for (i = 0; i < mares.length; i++) { var m = mares[i], dd = Math.hypot(u - m[0], v - m[1]) / m[2] + (o[1](u * 9 + i, v * 9) - .5) * 1.1 + (o[2](u * 20, v * 20 + i) - .5) * .5; mar = Math.max(mar, (1 - A.suave(.55, 1.15, dd)) * (.75 + .25 * o[0](u * 5 + i, v * 5))); }
    var b = 214 + (f - .5) * 70 - mar * 150, j = (py * N + px) * 4;
    d[j] = b; d[j + 1] = b * .985; d[j + 2] = b * .96 + mar * 6; d[j + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  for (i = 0; i < 220; i++) {
    var r = (1 + Math.pow(rnd(), 3.5) * 18) * k, cx = rnd() * N, cy = rnd() * N, al = .08 + rnd() * .1;
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.clip();
    x.fillStyle = 'rgba(40,36,34,' + al * 1.6 + ')'; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    x.fillStyle = 'rgba(232,228,220,' + al * 1.4 + ')'; x.beginPath(); x.arc(cx + r * .32, cy + r * .32, r * .95, 0, 6.3); x.fill();
    x.restore();
    if (r > 8 * k) { x.strokeStyle = 'rgba(240,236,228,' + al + ')'; x.lineWidth = r * .12; x.beginPath(); x.arc(cx, cy, r * 1.04, .2, 1.9); x.stroke(); }
  }
  var tx = N * .42, ty = N * .8;
  for (i = 0; i < 26; i++) {
    var a = rnd() * 6.283, l = (60 + rnd() * 160) * k;
    var g = x.createLinearGradient(tx, ty, tx + Math.cos(a) * l, ty + Math.sin(a) * l);
    g.addColorStop(0, 'rgba(255,255,250,.16)'); g.addColorStop(1, 'rgba(255,255,250,0)');
    x.strokeStyle = g; x.lineWidth = (1 + rnd() * 2.5) * k; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + Math.cos(a) * l, ty + Math.sin(a) * l); x.stroke();
  }
  x.fillStyle = 'rgba(255,255,252,.85)'; x.beginPath(); x.arc(tx, ty, 6 * k, 0, 6.3); x.fill();
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.LinearEncoding; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t;
}

/* estrellas tenues + vía láctea (con polvo oscuro) pintadas una sola vez en un cubemap */
var MW = new THREE.Vector3(.42, .5, -.76).normalize();
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
      '  vec3 st = capa(d, 420.0, .006 + .04 * banda) * .9 + capa(d, 760.0, .004 + .09 * banda) * .55 + capa(d, 1300.0, .02 * banda) * .45 + capa(d, 230.0, .004) * 1.2;',
      '  float mw = banda * (.45 + .9 * n) * (1.0 - smoothstep(.42, .7, polvo) * .8 * nucleo - smoothstep(.5, .75, polvo) * .4 * banda);',
      '  vec3 col = st * .12 * (1.0 - smoothstep(.42, .7, polvo) * banda * .7) + vec3(.36, .4, .6) * mw * .15 + vec3(.75, .62, .48) * nucleo * n * mw * .17;',
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
  return rt.texture;
}

/* las estrellas brillantes: puntos nítidos que titilan (las muy brillantes destellan en cruz) */
function puntosEstrellas(n) {
  var rnd = A.azar(307), pos = [], mag = [], col = [], fas = [], v = new THREE.Vector3();
  while (pos.length < n * 3) {
    v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); var l = v.length(); if (l > 1 || l < .1) continue; v.divideScalar(l);
    if (rnd() < .45) { var bb = v.dot(MW); v.addScaledVector(MW, -bb * (.75 + rnd() * .2)).normalize(); }
    if (v.y < .02) continue;
    pos.push(v.x * 900, v.y * 900, v.z * 900);
    mag.push(Math.pow(rnd(), 3.2));
    var tt = rnd(); col.push(tt < .25 ? .72 : 1, tt < .25 ? .82 : tt < .7 ? .97 : .86, tt < .25 ? 1 : tt < .7 ? .95 : .68); fas.push(rnd() * 6.283);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('mag', new THREE.Float32BufferAttribute(mag, 1));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('fase', new THREE.Float32BufferAttribute(fas, 1));
  var m = new THREE.ShaderMaterial({
    uniforms: { uPr: { value: 1 }, uT: A.U.uT, uLuna: A.U.uLuna, uTw: { value: A.reducido ? .35 : 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float mag; attribute float fase; uniform float uPr, uT, uTw; varying vec3 vC; varying float vM; varying vec3 vD; varying float vTw; void main(){ vC = color; vM = mag; vD = normalize(position); vTw = 1.0 - uTw * (.35 - .35 * sin(uT * (3.0 + fase) + fase * 7.0) * sin(uT * 1.7 + fase)); if (mag > .93) vC *= vec3(1.0 + .25 * sin(uT * 9.0 + fase), 1.0 + .2 * sin(uT * 7.0 + fase * 3.0), 1.0 + .25 * sin(uT * 11.0 + fase * 5.0)); gl_PointSize = (3.0 + mag * mag * 9.0) * uPr * (mag > .93 ? 2.4 : 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uLuna;',
      'varying vec3 vC; varying float vM; varying vec3 vD; varying float vTw;',
      'void main(){',
      '  vec2 c = gl_PointCoord - .5; float r = length(c);',
      /* núcleo chico muy brillante + halo suave (caída gaussiana: nada de cuadraditos) */
      '  float a = exp(-r * r * 90.0) * 1.6 + exp(-r * r * 16.0) * .22;',
      '  if (vM > .93) a += (max(0.0, 1.0 - abs(c.x) * 22.0) + max(0.0, 1.0 - abs(c.y) * 22.0)) * max(0.0, 1.0 - r * 2.0) * .55;',
      /* cerca del horizonte la luz de la ciudad se come las tenues */
      '  float k = (.3 + vM * 2.2) * vTw * smoothstep(.02, .3, vD.y + vM * .12) * (1.0 - smoothstep(.93, .997, dot(vD, uLuna)) * .95);',
      '  gl_FragColor = vec4(vC * a * k, 1.0);',
      '}'
    ].join('\n')
  });
  var p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9;
  return p;
}

A.armarCielo = function (escena, R, aj) {
  var texL = texLuna(aj.detalle >= 1 ? 512 : 256);
  var cubo = hornearEstrellas(R, aj.detalle >= 1 ? 512 : 256);
  var estrellas = puntosEstrellas(aj.estrellas);
  escena.add(estrellas);
  var mDomo = new THREE.ShaderMaterial({
    uniforms: { uLuna: A.U.uLuna, uLunaTex: { value: texL }, uEstrellas: { value: cubo }, uFiesta: A.U.uFiesta, uFlash: { value: new THREE.Color(0, 0, 0) } },
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'uniform vec3 uLuna; uniform sampler2D uLunaTex; uniform samplerCube uEstrellas; uniform float uFiesta; uniform vec3 uFlash;',
      'varying vec3 vDir;',
      'void main(){',
      '  vec3 d = normalize(vDir); float y = d.y, h = max(y, 0.0);',
      '  vec3 zen = vec3(.0016, .0028, .011), alto = vec3(.004, .0075, .024), hz = vec3(.018, .019, .034);',
      '  vec3 c = mix(hz, alto, smoothstep(0.0, .22, h));',
      '  c = mix(c, zen, smoothstep(.18, .75, h));',
      /* el resplandor de la ciudad: cálido y bajito */
      '  c += vec3(.11, .06, .028) * exp(-h * 22.0) * .55;',
      '  float ml = max(dot(d, uLuna), 0.0);',
      '  c += vec3(.5, .58, .78) * (pow(ml, 14.0) * .045 + pow(ml, 160.0) * .14);',
      '  if (y < 0.0) c = hz * .6;',
      '  vec3 cs = textureCube(uEstrellas, d).rgb;',
      '  c += cs * smoothstep(-.01, .28, y) * (1.0 - smoothstep(.9, .995, dot(d, uLuna)) * .7);',
      /* la luna grande, con sus mares, oscurecida hacia el borde */
      '  float md = dot(d, uLuna); float disc = smoothstep(.99924, .99932, md);',
      '  if (disc > 0.0) {',
      '    vec3 ax = normalize(cross(uLuna, vec3(0.0, 1.0, 0.0))); vec3 ay = cross(ax, uLuna);',
      '    vec2 q = vec2(dot(d, ax), dot(d, ay)) / .0378;',
      '    vec3 tex = texture2D(uLunaTex, q * .49 + .5).rgb;',
      '    float ld = pow(max(0.0, 1.0 - dot(q, q)), .3);',
      '    c = mix(c, tex * vec3(.98, .97, 1.0) * (.55 + .45 * ld) * 1.5, disc);',
      '  }',
      /* el destello de los fuegos tiñe el cielo un instante */
      '  c += uFlash * (.25 + .75 * exp(-h * 4.0));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
  var domo = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mDomo);
  domo.frustumCulled = false; domo.renderOrder = -10; escena.add(domo);

  /* halo de la luna: un anillo luminoso que empieza en el borde del disco */
  var cH = A.lienzo(256, 256), xH = cH.getContext('2d'), gH = xH.createRadialGradient(128, 128, 0, 128, 128, 128);
  gH.addColorStop(0, 'rgba(255,255,255,0)'); gH.addColorStop(.145, 'rgba(255,255,255,0)'); gH.addColorStop(.16, 'rgba(255,255,255,.55)');
  gH.addColorStop(.28, 'rgba(255,255,255,.16)'); gH.addColorStop(.55, 'rgba(255,255,255,.04)'); gH.addColorStop(1, 'rgba(255,255,255,0)');
  xH.fillStyle = gH; xH.fillRect(0, 0, 256, 256);
  var mGlLuna = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cH), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#AFC0EA', fog: false, opacity: .42 });
  var glLuna = new THREE.Sprite(mGlLuna); glLuna.scale.set(760, 760, 1); glLuna.renderOrder = -8; escena.add(glLuna);

  /* estrella fugaz: un trazo que cruza el cielo de vez en cuando */
  var gF = new THREE.PlaneGeometry(1, 1); gF.translate(-.5, 0, 0);
  var mF = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * (1.0 - abs(vUv.y * 2.0 - 1.0)); gl_FragColor = vec4(vec3(.9, .95, 1.0) * a * uA * 2.0, 1.0); }'
  });
  var fugaz = new THREE.Mesh(gF, mF); fugaz.visible = false; fugaz.frustumCulled = false; escena.add(fugaz);
  var fz = { t: 0, prox: 4, dur: 1.1, a: new THREE.Vector3(), b: new THREE.Vector3() };
  var vt = new THREE.Vector3(), cab = new THREE.Vector3(), dir = new THREE.Vector3(), n0 = new THREE.Vector3(), aOjo = new THREE.Vector3(), cruz = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0), qq = new THREE.Quaternion();
  var forzar = false;

  return {
    domo: domo, mat: mDomo, estrellas: estrellas,
    fugaz: function () { forzar = true; },
    medir: function (pr) { estrellas.material.uniforms.uPr.value = pr; },
    cuadro: function (dt, cam) {
      domo.position.copy(cam.position); estrellas.position.copy(cam.position);
      glLuna.position.copy(cam.position).addScaledVector(A.U.uLuna.value, 1500);
      if (!A.reducido || forzar) {
        fz.prox -= dt;
        if ((fz.prox <= 0 || forzar) && !fugaz.visible) {
          forzar = false; fz.prox = 7 + Math.random() * 9; fz.t = 0; fugaz.visible = true;
          cam.getWorldDirection(vt);
          var az = Math.atan2(vt.x, vt.z) + (Math.random() - .5) * .5, el = .32 + Math.random() * .14;
          fz.a.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(90);
          var dz = (Math.random() < .5 ? -1 : 1);
          fz.b.set(Math.sin(az + dz * .32) * Math.cos(el - .09), Math.sin(el - .09), Math.cos(az + dz * .32) * Math.cos(el - .09)).multiplyScalar(90);
        }
      }
      if (fugaz.visible) {
        fz.t += dt; var k = fz.t / fz.dur;
        if (k >= 1) fugaz.visible = false;
        else {
          cab.copy(fz.a).lerp(fz.b, k);
          fugaz.position.copy(cam.position).add(cab);
          dir.copy(fz.b).sub(fz.a).normalize();
          fugaz.scale.set(14 * Math.min(1, k * 4), .18, 1);
          fugaz.quaternion.setFromUnitVectors(X, dir);
          /* que el trazo mire al ojo: se gira sobre su propio eje */
          n0.set(0, 0, 1).applyQuaternion(fugaz.quaternion); aOjo.copy(cab).negate().normalize();
          aOjo.addScaledVector(dir, -aOjo.dot(dir)).normalize();
          var ang = Math.atan2(cruz.crossVectors(n0, aOjo).dot(dir), n0.dot(aOjo));
          fugaz.quaternion.premultiply(qq.setFromAxisAngle(dir, ang));
          mF.uniforms.uA.value = Math.sin(k * Math.PI);
        }
      }
    }
  };
};
})();

;
/* El árbol que se enciende — prototipo.
   plaza.js: el piso, las casitas y los foquitos de una placita costeña genérica (no copia
   ninguna plaza real).

   Medidas (metros). La plaza es una manzana de 32,5 m con la pileta al centro (0,0) y el
   árbol al norte (z = −9). Alrededor, la pista de 5 m, las veredas de 2,5 m y las fachadas de
   las ocho manzanas vecinas (las de los lados y las de las esquinas, que se ven al mirar por
   las calles).

   El piso es UN shader para todo (plaza, pista y veredas): adoquines en hilera (en anillos
   alrededor de la pileta), pasto en los cuatro jardines, asfalto y losas. Los adoquines se
   dibujan en el shader (sin textura que se repita) con su bisel: así cada piedra tiene su tono
   y su brillo, y no hay costuras.

   Las fachadas son cajas instanciadas con un shader que reparte módulos de un atlas (ventanas
   con reja, portones, balcones de fierro, tiendas, ventanas con arbolito) por piso y por vano;
   zócalo, pilastras, cornisa y manchas de humedad salen del shader. De noche se prenden
   ventanas al azar y las guirnaldas tiñen el estuco. */
(function () {
'use strict';
var A = window.Arbol;
var P = A.PLAZA = { borde: 16.25, calle: 21.25, fachada: 23.75, arbol: new THREE.Vector3(0, 0, -9), pileta: new THREE.Vector3(0, 0, 0) };

/* el piso donde se para cada cosa (la pista está 15 cm más abajo que la plaza y las veredas) */
A.alturaPiso = function (x, z) {
  var ax = Math.abs(x), az = Math.abs(z);
  if (Math.max(ax, az) <= P.borde) return 0;
  if ((ax > P.borde && ax < P.calle) || (az > P.borde && az < P.calle)) return -.15;
  return 0;
};

/* ---------- el piso ---------- */
var GLSL_PISO = [
  'uniform sampler2D uRuido; uniform float uArbolLuz; uniform vec3 uArbolPos;',
  'varying vec3 vPos;',
  'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  /* una piedra de un aparejo: devuelve (alto, color) y la normal por su bisel */
  'vec4 piedra(vec2 q, vec2 S, float junta, vec2 irr, out vec3 nrm){',
  '  float fila = floor(q.y / S.y);',
  '  q.x += mod(fila, 2.0) * S.x * .5 + h2(vec2(fila, 3.1)) * S.x;',
  '  vec2 cel = vec2(floor(q.x / S.x), fila);',
  '  vec2 lp = (fract(q / S) - .5) * S + irr;',
  '  float rc = min(S.x, S.y) * .18; vec2 hb = S * .5 - junta * .5 - rc;',
  '  vec2 qd = abs(lp) - hb; float d = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0) - rc;',
  '  vec2 gr = (qd.x > 0.0 || qd.y > 0.0) ? normalize(max(qd, 0.0) + 1e-5) * sign(lp) : (qd.x > qd.y ? vec2(sign(lp.x), 0.0) : vec2(0.0, sign(lp.y)));',
  '  float bis = junta * 1.4; float k = clamp(-d / bis, 0.0, 1.0);',
  '  float alto = k * k * (3.0 - 2.0 * k);',
  '  float pend = (d < 0.0 && d > -bis) ? 6.0 * k * (1.0 - k) / bis * .008 : 0.0;',
  '  nrm = normalize(vec3(gr.x * pend * 22.0, 1.0, gr.y * pend * 22.0));',
  '  float hc = h2(cel + 4.7), hd = h2(cel + 9.1);',
  '  if (d > 0.0) nrm = vec3(0.0, 1.0, 0.0); else nrm = normalize(nrm + vec3(hc - .5, 0.0, hd - .5) * .09);',
  '  return vec4(alto, cel, h2(cel));',
  '}',
  'float jardin(vec2 p){',
  '  vec2 c = vec2(sign(p.x), sign(p.y)) * 10.5; vec2 q = abs(p - c) - vec2(2.6);',
  '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 1.45;',
  '}'
].join('\n');

function matPiso() {
  return new THREE.ShaderMaterial({
    uniforms: A.unif({ uRuido: { value: A.texRuido() }, uArbolLuz: { value: 0 }, uArbolPos: { value: P.arbol } }),
    extensions: { derivatives: true },
    vertexShader: 'varying vec3 vPos; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: A.GLSL_LUZ + '\n' + GLSL_PISO + [
      '',
      'void main(){',
      '  vec2 p = vPos.xz; float ax = abs(p.x), az = abs(p.y), m = max(ax, az);',
      '  vec3 V = normalize(cameraPosition - vPos); float dist = length(cameraPosition - vPos);',
      '  vec4 rn = texture2D(uRuido, p * .045); vec4 rf = texture2D(uRuido, p * .9);',
      '  vec3 alb; vec3 n = vec3(0.0, 1.0, 0.0); float brillo = 0.0, dureza = 30.0;',
      '  float dj = jardin(p);',
      '  if (m <= 16.25 && dj < 0.0) {',
      /* pasto: oscuro, con matas y hojitas (ruido fino estirado) */
      '    float mata = texture2D(uRuido, p * .33).g; float hoja = texture2D(uRuido, p * vec2(5.0, 1.7)).b;',
      '    alb = mix(vec3(.035, .07, .028), vec3(.075, .13, .045), mata) * (.75 + .5 * hoja) * (.85 + .3 * rn.r);',
      '    alb *= .8 + .2 * smoothstep(-.6, -.05, dj);',
      '    n = normalize(vec3((hoja - .5) * .4, 1.0, (rf.b - .5) * .4));',
      '  } else if (m <= 16.25) {',
      /* adoquines: en hilera; alrededor de la pileta, en anillos. Lejos (una piedra mide menos de
         unos 4 píxeles) el dibujo se funde en su color medio: si no, las juntas hacen muaré. */
      '    float r = length(p); vec4 pd; vec3 nn;',
      '    float aa = 1.0 - smoothstep(.012, .04, length(fwidth(p)));',
      '    vec2 irr = (texture2D(uRuido, p * 2.3).gb - .5) * .022;',
      '    if (r < 6.2) { float th = atan(p.y, p.x); pd = piedra(vec2(th * max(r, .5), r), vec2(.23, .12), .016, irr, nn);',
      '      float st = sin(th), ct = cos(th); nn = normalize(vec3(-nn.x * st + nn.z * ct, nn.y, nn.x * ct + nn.z * st)); }',
      '    else pd = piedra(p, vec2(.24, .12), .016, irr, nn);',
      '    float hs = pd.w, hs2 = fract(hs * 7.31);',
      '    vec3 gris = vec3(.25, .24, .225), beige = vec3(.31, .285, .25), rosa = vec3(.3, .24, .215);',
      '    vec3 col = hs < .55 ? mix(gris, beige, hs2) : (hs < .85 ? mix(beige, rosa, hs2 * .7) : rosa * (.85 + .2 * hs2));',
      '    col *= (.8 + .3 * rn.r) * (.84 + .3 * rf.a) * (.9 + .2 * texture2D(uRuido, p * 7.0).b);',
      /* la franja de granito que rodea la pileta */
      '    if (abs(r - 6.35) < .17) { col = vec3(.36, .345, .33) * (.85 + .25 * rf.g); pd.x = 1.0; nn = vec3(0.0, 1.0, 0.0); }',
      '    vec3 junta = mix(vec3(.075, .07, .062), vec3(.2, .18, .15), smoothstep(.55, .8, rf.b)) * (.8 + .4 * rf.g);',
      '    vec3 medio = vec3(.24, .225, .205) * (.8 + .3 * rn.r);',
      '    alb = mix(medio, mix(junta, col, smoothstep(.0, .35, pd.x)), aa);',
      '    n = normalize(mix(vec3(0.0, 1.0, 0.0), nn, aa)); brillo = .28 * mix(.6, smoothstep(.3, 1.0, pd.x) * (.5 + .5 * hs2), aa); dureza = 40.0;',
      '  } else if ((ax > 16.25 && ax < 21.25) || (az > 16.25 && az < 21.25)) {',
      /* la pista: asfalto oscuro con granos */
      '    alb = vec3(.04, .042, .047) * (.8 + .35 * rf.a + .25 * rn.g);',
      '    brillo = .12; dureza = 18.0; n = normalize(vec3((rf.b - .5) * .25, 1.0, (rf.g - .5) * .25));',
      '  } else {',
      /* veredas: losas de concreto de 1 m */
      '    vec2 f = abs(fract(p) - .5); float linea = smoothstep(.485, .495, max(f.x, f.y));',
      '    alb = vec3(.25, .245, .235) * (.82 + .25 * rn.r + .1 * rf.a) * (1.0 - linea * .5 * (1.0 - smoothstep(.01, .04, length(fwidth(p)))));',
      '    brillo = .08;',
      '  }',
      '  vec3 luz = luzPlaza(vPos, n, 0.0);',
      /* el árbol encendido derrama su luz de colores alrededor */
      '  float dA = distance(p, uArbolPos.xz);',
      '  luz += vec3(1.0, .72, .42) * uArbolLuz * .55 * exp(-dA * dA * .03) + vec3(.6, .3, .9) * uArbolLuz * .12 * exp(-dA * .25);',
      '  vec3 c = alb * luz + brilloPlaza(vPos, n, V, dureza) * brillo;',
      '  c = mix(c, vec3(.008, .01, .018), clamp(1.0 - exp(-dist * .008), 0.0, .6));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
}

A.armarPiso = function (escena) {
  var mat = matPiso(), grupo = new THREE.Group(); escena.add(grupo);
  /* la pista: un plano grande 15 cm abajo */
  var pista = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 1, 1).rotateX(-Math.PI / 2).translate(0, -.15, 0), mat); grupo.add(pista);
  /* la plaza y las 8 manzanas vecinas (sus veredas): planos a nivel 0 */
  var geos = [new THREE.PlaneGeometry(P.borde * 2, P.borde * 2, 1, 1).rotateX(-Math.PI / 2)];
  var M = 32.5, paso = M + 5;
  [-1, 0, 1].forEach(function (i) { [-1, 0, 1].forEach(function (j) { if (!i && !j) return; geos.push(new THREE.PlaneGeometry(M, M, 1, 1).rotateX(-Math.PI / 2).translate(i * paso, 0, j * paso)); }); });
  var manzanas = new THREE.Mesh(A.unir(geos), mat); grupo.add(manzanas);
  /* los sardineles: el canto de cada manzana (15 cm) */
  var bord = [];
  function canto(cx, cz, lado) {
    var h = lado / 2;
    bord.push(new THREE.BoxGeometry(lado + .3, .16, .3).translate(cx, -.07, cz - h));
    bord.push(new THREE.BoxGeometry(lado + .3, .16, .3).translate(cx, -.07, cz + h));
    bord.push(new THREE.BoxGeometry(.3, .16, lado + .3).translate(cx - h, -.07, cz));
    bord.push(new THREE.BoxGeometry(.3, .16, lado + .3).translate(cx + h, -.07, cz));
  }
  canto(0, 0, P.borde * 2);
  [-1, 0, 1].forEach(function (i) { [-1, 0, 1].forEach(function (j) { if (!i && !j) return; canto(i * paso, j * paso, M); }); });
  var mBord = new THREE.MeshLambertMaterial({ color: '#8E8A84' });
  grupo.add(new THREE.Mesh(A.unir(bord), mBord));
  return { mat: mat, grupo: grupo };
};

/* ---------- el atlas de fachadas ----------
   4 × 2 módulos de 256 × 320 (un vano de un piso). Color + máscara: R vidrio, G elemento que
   conserva su color, B interior que se ve de noche (cortinas, lámpara, arbolito). */
function atlasFachadas() {
  var W = 1024, H = 640, cw = 256, ch = 320;
  var col = A.lienzo(W, H), x = col.getContext('2d'), mas = A.lienzo(W, H), m = mas.getContext('2d');
  x.fillStyle = '#888'; x.fillRect(0, 0, W, H); m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
  var rnd = A.azar(71);
  function el(px, py, w, h, color) { x.fillStyle = color; x.fillRect(px, py, w, h); m.fillStyle = 'rgb(0,255,0)'; m.fillRect(px, py, w, h); }
  function vidrio(px, py, w, h, cortina, b) {
    var g = x.createLinearGradient(px, py, px + w * .6, py + h); g.addColorStop(0, '#2B3546'); g.addColorStop(.55, '#151B26'); g.addColorStop(1, '#2E3A4C');
    x.fillStyle = g; x.fillRect(px, py, w, h);
    m.fillStyle = 'rgb(255,0,' + (b || 70) + ')'; m.fillRect(px, py, w, h);
    m.fillStyle = 'rgb(255,0,230)'; m.beginPath(); m.ellipse(px + w * .5, py + h * .28, w * .2, h * .16, 0, 0, 6.3); m.fill();   /* la lámpara */
    if (cortina) {
      m.fillStyle = 'rgb(255,0,120)'; m.fillRect(px, py, w * .24, h); m.fillRect(px + w * .76, py, w * .24, h);
      x.fillStyle = 'rgba(190,150,120,.35)'; x.fillRect(px, py, w * .24, h); x.fillRect(px + w * .76, py, w * .24, h);
    }
    m.fillStyle = 'rgb(255,0,40)'; m.fillRect(px + w * .08, py + h * .8, w * .84, h * .2);
  }
  function marco(px, py, w, h, color, g) { x.strokeStyle = color; x.lineWidth = g; x.strokeRect(px, py, w, h); m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = g; m.strokeRect(px, py, w, h); }
  function sombra(px, py, w, h, a) { x.fillStyle = 'rgba(0,0,0,' + (a || .2) + ')'; x.fillRect(px, py, w, h); }
  function reja(px, py, w, h) {
    x.fillStyle = '#17161A'; m.fillStyle = 'rgb(0,255,0)';
    for (var b = 0; b <= w; b += 13) { x.fillRect(px + b - 1.5, py, 3, h); m.fillRect(px + b - 1.5, py, 3, h); }
    [0, .45, 1].forEach(function (f) { x.fillRect(px - 2, py + h * f - 2, w + 4, 4); m.fillRect(px - 2, py + h * f - 2, w + 4, 4); });
    /* rulos de fierro arriba */
    x.strokeStyle = '#17161A'; m.strokeStyle = 'rgb(0,255,0)'; x.lineWidth = m.lineWidth = 2.5;
    for (var r = 0; r < w; r += 26) [x, m].forEach(function (c) { c.beginPath(); c.arc(px + r + 13, py + h * .22, 6, 0, 6.3); c.stroke(); });
  }
  var MAD = ['#2F5B6E', '#6B3B26', '#3C6448', '#7A2E2E', '#4A3C6A'];
  for (var k = 0; k < 8; k++) {
    var cx = (k % 4) * cw, cy = Math.floor(k / 4) * ch, mad = MAD[k % MAD.length], ox, oy, w, h;
    if (k === 0) {        /* ventana con reja colonial y alféizar */
      ox = cx + 66; oy = cy + 92; w = 124; h = 150;
      vidrio(ox, oy, w, h, true); marco(ox - 6, oy - 6, w + 12, h + 12, '#EDE5D5', 10);
      reja(ox + 4, oy + 2, w - 8, h - 4);
      el(ox - 18, oy + h + 6, w + 36, 12, '#E4DBCA'); sombra(ox - 18, oy + h + 18, w + 36, 8);
      el(ox - 12, oy - 26, w + 24, 12, '#E9E1D1'); sombra(ox - 12, oy - 14, w + 24, 6, .15);
    } else if (k === 1) { /* portón de dos hojas con arco y clavos */
      ox = cx + 58; oy = cy + 74; w = 140; h = 246;
      x.save(); x.beginPath(); x.moveTo(ox, cy + ch); x.lineTo(ox, oy + 70); x.arc(ox + w / 2, oy + 70, w / 2, Math.PI, 0); x.lineTo(ox + w, cy + ch); x.closePath(); x.clip();
      var gm = x.createLinearGradient(ox, 0, ox + w, 0); gm.addColorStop(0, '#4A2C18'); gm.addColorStop(.5, '#6A4226'); gm.addColorStop(1, '#4A2C18');
      x.fillStyle = gm; x.fillRect(ox, oy, w, h);
      for (var t = 0; t < 7; t++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(ox + t * 20, oy, 2, h); }
      for (var c1 = 0; c1 < 2; c1++) for (var f1 = 0; f1 < 4; f1++) { x.strokeStyle = 'rgba(20,10,4,.55)'; x.lineWidth = 3; x.strokeRect(ox + 12 + c1 * 62, oy + 84 + f1 * 40, 54, 32); }
      for (var cl = 0; cl < 40; cl++) { x.fillStyle = '#C9A15A'; x.beginPath(); x.arc(ox + 10 + (cl % 8) * 17, oy + 90 + Math.floor(cl / 8) * 32, 2.2, 0, 6.3); x.fill(); }
      x.fillStyle = '#120A06'; x.fillRect(ox + w / 2 - 2, oy, 4, h);
      x.restore();
      m.save(); m.beginPath(); m.moveTo(ox, cy + ch); m.lineTo(ox, oy + 70); m.arc(ox + w / 2, oy + 70, w / 2, Math.PI, 0); m.lineTo(ox + w, cy + ch); m.closePath(); m.fillStyle = 'rgb(0,255,0)'; m.fill(); m.restore();
      x.strokeStyle = '#E8DFCC'; x.lineWidth = 14; x.beginPath(); x.moveTo(ox - 7, cy + ch); x.lineTo(ox - 7, oy + 70); x.arc(ox + w / 2, oy + 70, w / 2 + 7, Math.PI, 0); x.lineTo(ox + w + 7, cy + ch); x.stroke();
      m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = 14; m.beginPath(); m.moveTo(ox - 7, cy + ch); m.lineTo(ox - 7, oy + 70); m.arc(ox + w / 2, oy + 70, w / 2 + 7, Math.PI, 0); m.lineTo(ox + w + 7, cy + ch); m.stroke();
      el(ox + w / 2 - 9, oy - 14, 18, 24, '#E8DFCC');      /* la clave del arco */
    } else if (k === 2) { /* puerta-ventana con balcón de fierro y macetas */
      ox = cx + 74; oy = cy + 56; w = 108; h = 210;
      vidrio(ox, oy, w, h, true); marco(ox - 5, oy - 5, w + 10, h + 10, '#F0EADF', 9);
      el(ox + w / 2 - 3, oy, 6, h, '#F0EADF');
      el(ox - 34, oy + h - 2, w + 68, 14, '#CFC4B2'); sombra(ox - 34, oy + h + 12, w + 68, 12, .28);
      x.strokeStyle = '#17161A'; m.strokeStyle = 'rgb(0,255,0)'; x.lineWidth = m.lineWidth = 4;
      [x, m].forEach(function (c) { c.beginPath(); c.moveTo(ox - 32, oy + h - 76); c.lineTo(ox + w + 32, oy + h - 76); c.stroke();
        for (var b = 0; b <= 16; b++) { c.beginPath(); c.moveTo(ox - 32 + b * (w + 64) / 16, oy + h - 76); c.lineTo(ox - 32 + b * (w + 64) / 16, oy + h - 2); c.stroke(); } });
      ['#C0392B', '#E67E22', '#D4458A'].forEach(function (fl, i) { el(ox - 18 + i * 54, oy + h - 30, 24, 22, '#9A5B3A'); x.fillStyle = '#2E6A30'; x.beginPath(); x.arc(ox - 6 + i * 54, oy + h - 34, 13, 0, 6.3); x.fill(); x.fillStyle = fl; x.beginPath(); x.arc(ox - 3 + i * 54, oy + h - 40, 5.5, 0, 6.3); x.arc(ox - 11 + i * 54, oy + h - 36, 4.5, 0, 6.3); x.fill(); m.fillStyle = 'rgb(0,255,0)'; m.beginPath(); m.arc(ox - 6 + i * 54, oy + h - 34, 14, 0, 6.3); m.fill(); });
    } else if (k === 3) { /* ventana con postigos abiertos y jardinera */
      ox = cx + 82; oy = cy + 88; w = 92; h = 128;
      vidrio(ox, oy, w, h, true); marco(ox - 4, oy - 4, w + 8, h + 8, '#ECE5D7', 8);
      el(ox + w / 2 - 3, oy, 6, h, '#ECE5D7'); el(ox, oy + h * .45, w, 5, '#ECE5D7');
      el(ox - 40, oy - 4, 34, h + 8, mad); el(ox + w + 6, oy - 4, 34, h + 8, mad);
      for (var l = 0; l < 11; l++) { sombra(ox - 40, oy + 4 + l * 11.5, 34, 3, .3); sombra(ox + w + 6, oy + 4 + l * 11.5, 34, 3, .3); }
      el(ox - 10, oy + h + 6, w + 20, 22, '#8C5634');
      for (var fl2 = 0; fl2 < 9; fl2++) { x.fillStyle = fl2 % 2 ? '#2F6B2F' : '#3B7D35'; x.beginPath(); x.arc(ox - 4 + fl2 * 12.5, oy + h + 4, 8, 0, 6.3); x.fill(); x.fillStyle = ['#D63A3A', '#F06A9A', '#F2F0EA'][fl2 % 3]; x.beginPath(); x.arc(ox - 2 + fl2 * 12.5, oy + h - 1, 3.6, 0, 6.3); x.fill(); m.fillStyle = 'rgb(0,255,0)'; m.beginPath(); m.arc(ox - 4 + fl2 * 12.5, oy + h + 3, 9, 0, 6.3); m.fill(); }
    } else if (k === 4 || k === 5) { /* tiendas: bodega y panadería, con letrero pintado */
      var NOM = k === 4 ? 'BODEGA' : 'PANADERÍA', FONDO = k === 4 ? '#1F5878' : '#8A4F24';
      ox = cx + 24; oy = cy + 110; w = 208; h = 210;
      vidrio(ox, oy, w, h, false, 150);
      /* estantes y cosas en la vitrina (se ven mejor de noche) */
      x.fillStyle = 'rgba(255,210,150,.2)'; for (var e = 0; e < 3; e++) x.fillRect(ox + 8, oy + 40 + e * 48, w * .5 - 16, 4);
      for (var it = 0; it < 18; it++) { x.fillStyle = ['#C94A3A', '#E8C060', '#5A8AB8', '#E9E1D0', '#7FB069'][it % 5]; x.fillRect(ox + 12 + (it % 6) * 14, oy + 20 + Math.floor(it / 6) * 48, 10, 18); }
      m.fillStyle = 'rgb(255,0,200)'; m.fillRect(ox + 8, oy + 14, w * .5 - 16, 150);
      el(ox + w * .5 + 6, oy + 6, w * .5 - 14, h - 6, mad);      /* la puerta */
      vidrio(ox + w * .5 + 18, oy + 22, w * .5 - 38, 70, false, 170);
      marco(ox, oy, w, h, '#2A2624', 8);
      el(cx + 14, cy + 42, 228, 50, FONDO); marco(cx + 14, cy + 42, 228, 50, '#F2EADB', 4);
      x.fillStyle = '#FFF4DE'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(NOM, cx + 128, cy + 68);
      sombra(cx + 14, cy + 92, 228, 8, .25);
    } else if (k === 6) { /* ventana en arco con moldura y clave */
      ox = cx + 72; oy = cy + 74; w = 112; h = 166;
      x.save(); x.beginPath(); x.moveTo(ox, oy + h); x.lineTo(ox, oy + 56); x.arc(ox + w / 2, oy + 56, w / 2, Math.PI, 0); x.lineTo(ox + w, oy + h); x.closePath(); x.clip(); vidrio(ox, oy, w, h, true); x.restore();
      m.save(); m.beginPath(); m.moveTo(ox, oy + h); m.lineTo(ox, oy + 56); m.arc(ox + w / 2, oy + 56, w / 2, Math.PI, 0); m.lineTo(ox + w, oy + h); m.closePath(); m.clip(); m.fillStyle = 'rgb(255,0,90)'; m.fillRect(ox, oy, w, h); m.fillStyle = 'rgb(255,0,220)'; m.beginPath(); m.ellipse(ox + w / 2, oy + h * .4, w * .2, h * .12, 0, 0, 6.3); m.fill(); m.restore();
      x.strokeStyle = '#EFE7D6'; x.lineWidth = 12; x.beginPath(); x.moveTo(ox, oy + h); x.lineTo(ox, oy + 56); x.arc(ox + w / 2, oy + 56, w / 2, Math.PI, 0); x.lineTo(ox + w, oy + h); x.stroke();
      m.strokeStyle = 'rgb(0,255,0)'; m.lineWidth = 12; m.beginPath(); m.moveTo(ox, oy + h); m.lineTo(ox, oy + 56); m.arc(ox + w / 2, oy + 56, w / 2, Math.PI, 0); m.lineTo(ox + w, oy + h); m.stroke();
      el(ox + w / 2 - 3, oy + 10, 6, h - 10, '#EFE7D6'); el(ox - 14, oy + h, w + 28, 12, '#E6DDCB'); el(ox + w / 2 - 10, oy - 16, 20, 26, '#EFE7D6');
      sombra(ox - 14, oy + h + 12, w + 28, 7);
    } else {              /* ventana con arbolito de Navidad adentro */
      ox = cx + 76; oy = cy + 80; w = 104; h = 150;
      vidrio(ox, oy, w, h, true, 60);
      /* el arbolito y sus luces (en la máscara B, para que brillen de noche) */
      x.fillStyle = '#1F4A2A'; x.beginPath(); x.moveTo(ox + w * .5, oy + 26); x.lineTo(ox + w * .2, oy + h - 22); x.lineTo(ox + w * .8, oy + h - 22); x.fill();
      m.fillStyle = 'rgb(255,0,150)'; m.beginPath(); m.moveTo(ox + w * .5, oy + 26); m.lineTo(ox + w * .2, oy + h - 22); m.lineTo(ox + w * .8, oy + h - 22); m.fill();
      for (var d = 0; d < 26; d++) { var yy = oy + 34 + rnd() * (h - 62), an = (yy - oy - 26) / (h - 48) * w * .3, xx = ox + w * .5 + (rnd() * 2 - 1) * an;
        x.fillStyle = ['#FF4040', '#FFD040', '#40B0FF', '#FF60C0', '#80FF60'][d % 5]; x.beginPath(); x.arc(xx, yy, 2.6, 0, 6.3); x.fill();
        m.fillStyle = 'rgb(255,0,255)'; m.beginPath(); m.arc(xx, yy, 3.4, 0, 6.3); m.fill(); }
      x.fillStyle = '#FFD24A'; x.beginPath(); x.arc(ox + w * .5, oy + 24, 5, 0, 6.3); x.fill(); m.beginPath(); m.arc(ox + w * .5, oy + 24, 6, 0, 6.3); m.fill();
      marco(ox - 5, oy - 5, w + 10, h + 10, '#EAE2D2', 9); el(ox + w / 2 - 2, oy, 4, h, '#EAE2D2');
      el(ox - 14, oy + h + 4, w + 28, 12, '#E3DACA'); sombra(ox - 14, oy + h + 16, w + 28, 7);
    }
  }
  var tc = A.texDe(col, true, false), tm = A.texDe(mas, false, false);
  [tc, tm].forEach(function (t) { t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; });
  return { color: tc, masc: tm };
}

/* ---------- las casas ---------- */
A.armarCasas = function (escena, aj) {
  var AT = atlasFachadas();
  var geos = [], partes = [];
  function pieza(g0, parte) { var g = g0.toNonIndexed(); g0.dispose(); var n = g.attributes.position.count; geos.push(g); for (var i = 0; i < n; i++) partes.push(parte); }
  pieza(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), 0);
  /* cornisa del techo y pretil (en proporción a la caja, por eso finitos) */
  pieza(new THREE.BoxGeometry(1.012, .022, 1.04).translate(0, .955, .0), 1);
  pieza(new THREE.BoxGeometry(1.0, .05, .03).translate(0, 1.0, .5), 1);
  var g = A.unir(geos);
  g.setAttribute('parte', new THREE.Float32BufferAttribute(partes, 1));
  var banador = null;   /* se llena abajo: 1 para la casona (luz de bañadores desde el piso) */

  var mat = new THREE.ShaderMaterial({
    uniforms: A.unif({ uFach: { value: AT.color }, uMasc: { value: AT.masc }, uRuido: { value: A.texRuido() }, uGuirnalda: { value: 1 } }),
    vertexShader: [
      'attribute float parte; attribute float banador;',
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl; varying float vParte; varying float vY; varying float vBan;',
      'void main(){',
      '  vec4 p = instanceMatrix * vec4(position, 1.0);',
      '  vEsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
      '  vSem = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);',
      '  vCol = instanceColor; vUv = uv; vNl = normal; vParte = parte; vY = position.y; vBan = banador;',
      '  vec4 wp = modelMatrix * p; vPos = wp.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: A.GLSL_LUZ + [
      '',
      'uniform sampler2D uFach, uMasc, uRuido; uniform float uGuirnalda;',
      'varying vec3 vPos; varying vec3 vCol; varying vec3 vN; varying vec2 vUv; varying vec3 vEsc; varying float vSem; varying vec3 vNl; varying float vParte; varying float vY; varying float vBan;',
      'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  vec3 V = vPos - cameraPosition; float d = length(V); V /= d;',
      '  vec3 n = normalize(vN);',
      '  float est = texture2D(uRuido, vPos.xy * .05 + vPos.zy * .05).r;',
      '  float est2 = texture2D(uRuido, vPos.xz * .17 + vPos.y * .23).g;',
      '  float grano = texture2D(uRuido, (vPos.xy + vPos.zy) * 1.7).b;',
      '  vec3 muro = vCol * (.8 + .32 * est) * (.93 + .1 * est2) * (.95 + .1 * grano);',
      '  float alto = vY * vEsc.y;',
      /* humedad que sube del piso */
      '  muro *= 1.0 - (1.0 - smoothstep(0.0, 1.6, alto + est * .8)) * .28;',
      '  vec3 base = muro; float vid = 0.0, inter = 0.0, lit = 0.0, tono = 0.0, frente = 0.0; vec4 ac = vec4(0.0);',
      '  if (vParte > .5) base = mix(vCol, vec3(.93, .9, .84), .65) * (.88 + .14 * est);',
      '  else if (abs(vNl.y) > .5) base = vec3(.3, .29, .28) * (.7 + .4 * est);',
      '  else {',
      '    frente = step(.5, vNl.z);',
      '    float an = abs(vNl.x) > .5 ? vEsc.z : vEsc.x;',
      '    vec2 q = vec2(vUv.x * an, vUv.y * vEsc.y);',
      '    float pisos = max(1.0, floor((vEsc.y - .45) / 3.3 + .05));',
      '    float vanos = max(1.0, floor(an / 2.75 + .5));',
      '    vec2 tam = vec2(an / vanos, 3.3);',
      '    vec2 cel = floor(q / tam); vec2 f = fract(q / tam);',
      '    float hh = h2(cel + vSem * 31.0);',
      '    float idx;',
      '    if (cel.y < .5) idx = (abs(cel.x - floor(vanos * .5)) < .5) ? 1.0 : (hh < .5 ? 0.0 : (hh < .72 ? 4.0 : (hh < .88 ? 5.0 : 1.0)));',
      '    else idx = hh < .3 ? 2.0 : (hh < .55 ? 3.0 : (hh < .78 ? 6.0 : 7.0));',
      '    float vacio = (frente < .5) ? step(hh, .7) : 0.0;',
      '    if (cel.y >= pisos) vacio = 1.0;',
      '    vec2 at = (vec2(mod(idx, 4.0), 1.0 - floor(idx / 4.0)) + f) / vec2(4.0, 2.0);',
      '    ac = texture2D(uFach, at); vec4 am = texture2D(uMasc, at);',
      '    float elem = am.g * (1.0 - vacio); vid = am.r * (1.0 - vacio); inter = am.b;',
      '    base = mix(muro, ac.rgb * (.85 + .2 * est2), elem);',
      /* zócalo pintado, pilastras en los bordes y la moldura de cada piso */
      '    float zoc = 1.0 - smoothstep(.72, .76, q.y);',
      '    base = mix(base, vCol * vec3(.55, .5, .48) * (.85 + .3 * est), zoc * (1.0 - elem) * frente);',
      '    float pil = (1.0 - smoothstep(.3, .34, q.x)) + smoothstep(an - .34, an - .3, q.x);',
      '    base = mix(base, mix(vCol, vec3(.95, .92, .86), .55) * (.9 + .12 * est), clamp(pil, 0.0, 1.0) * (1.0 - zoc) * frente * (1.0 - elem));',
      '    float mold = smoothstep(.0, .03, abs(fract(q.y / 3.3 + .5 / 3.3) - .5 / 3.3) ) ;',
      '    float banda = 1.0 - step(.18, abs(q.y - 3.3 * floor(q.y / 3.3 + .5)));',
      '    base = mix(base, mix(vCol, vec3(.95, .92, .86), .6), banda * step(1.0, q.y) * frente * (1.0 - elem));',
      '    base *= 1.0 - banda * step(1.0, q.y) * smoothstep(.0, .18, q.y - 3.3 * floor(q.y / 3.3 + .5)) * .0;',
      /* debajo de cada ventana, la lágrima de la humedad */
      '    base *= 1.0 - smoothstep(.0, .3, f.y) * (1.0 - smoothstep(.3, .62, abs(f.x - .5) * 2.0)) * .1 * (1.0 - elem) * (1.0 - vacio);',
      '    float prende = step(hh, .62) * step(.5, frente + step(.4, hh));',
      '    lit = vid * prende; tono = hh;',
      '    vec3 reflejo = mix(vec3(.012, .016, .03), vec3(.05, .06, .09), clamp(-V.y * 2.0 + .5, 0.0, 1.0));',
      '    base = mix(base, ac.rgb * .25 + reflejo, vid * (1.0 - lit));',
      '  }',
      '  vec3 c = base * luzPlaza(vPos, n, .15);',
      '  c += brilloPlaza(vPos, n, -V, 60.0) * vid * .5;',
      /* bañadores: luz cálida que sube desde el piso y se abre en abanicos por la fachada */
      '  float ban = vBan * frente * (1.0 - vid) * (1.0 - smoothstep(0.0, 7.5, alto)) * (.55 + .45 * pow(abs(sin(vUv.x * 3.14159 * 3.0)), .6));',
      '  c += base * vec3(1.0, .72, .45) * ban * .9;',
      /* ventana encendida: cálida, con su interior (cortinas, lámpara, arbolito) */
      '  vec3 calido = mix(vec3(1.0, .56, .24), vec3(1.0, .72, .45), tono) * (.18 + .9 * inter * inter);',
      '  vec3 adentro = mix(calido, ac.rgb * 1.6, step(.55, inter) * step(.5, length(ac.rgb - vec3(.12, .29, .16)) ) * .0 + step(.98, inter) * .85);',
      '  c = mix(c, adentro * .55, lit);',
      /* las guirnaldas de la fachada tiñen el estuco de colores (la franja de 3,2 m) */
      '  float gb = exp(-pow((alto - 3.0) / .38, 2.0)) * frente * (1.0 - vParte) * (1.0 - smoothstep(3.0, 3.6, alto) * .6);',
      '  float u = (vPos.x + vPos.z) * 1.3;',
      '  vec3 colG = vec3(.6 + .4 * sin(u), .55 + .45 * sin(u + 2.1), .55 + .45 * sin(u + 4.2));',
      '  c += base * colG * gb * .22 * uGuirnalda;',
      '  c = mix(c, vec3(.008, .01, .018), clamp(1.0 - exp(-d * .008), 0.0, .7));',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });

  /* colores de la costa: ocres, terracota, celeste, verde agua, salmón, blanco, amarillo */
  var PAL = ['#E3C27E', '#D58A5A', '#93BED2', '#9FCDB2', '#EEA27A', '#EEE8DA', '#F0CE62', '#C77666', '#79A9C4', '#E6D7BC', '#B0C487', '#E3B39C', '#D9A0B8'];
  var rnd = A.azar(23), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color();
  var lista = [], F = P.fachada, I = P.borde - 2.5;
  /* una fila de casas: desde (x0,z0) a lo largo de (dx,dz), mirando a "giro" */
  function fila(x0, z0, dx, dz, largo, giro, fijas) {
    var a = 0;
    while (a < largo - 2.5) {
      var w = Math.min(largo - a, 5.2 + rnd() * 3.8), pisos = rnd() < .38 ? 1 : 2, prof = 8 + rnd() * 3;
      if (fijas) { var fj = fijas(a, w); if (fj) { w = fj.w; pisos = fj.pisos; } }
      var cxm = x0 + dx * (a + w / 2), czm = z0 + dz * (a + w / 2);
      lista.push({ x: cxm - Math.sin(giro) * prof / 2, z: czm - Math.cos(giro) * prof / 2, w: w, h: pisos * 3.3 + .45, d: prof, g: giro, pisos: pisos, fx: cxm, fz: czm });
      a += w;
    }
  }
  /* norte (con la casona del reloj al centro y la casa del balcón a su izquierda) */
  fila(-I, -F, 1, 0, I - 6, 0, function (a, w) { return a + w > I - 9 - 3 && a < I - 9 + 3 ? null : null; });
  lista.push({ x: 0, z: -F - 6, w: 12, h: 2 * 3.3 + .6, d: 12, g: 0, pisos: 2, casona: true, fx: 0, fz: -F });
  fila(6, -F, 1, 0, I - 6, 0);
  fila(I, F, -1, 0, I * 2, Math.PI);
  fila(F, -I, 0, 1, I * 2, -Math.PI / 2);
  fila(-F, I, 0, -1, I * 2, Math.PI / 2);
  /* los costados de las manzanas de los lados (se ven al mirar por las calles) */
  [-1, 1].forEach(function (l) {
    fila(l * I, -F, 0, -1, 26, l > 0 ? -Math.PI / 2 : Math.PI / 2);
    fila(l * I, F, 0, 1, 26, l > 0 ? -Math.PI / 2 : Math.PI / 2);
    fila(-F, l * I, -1, 0, 26, l > 0 ? Math.PI : 0);
    fila(F, l * I, 1, 0, 26, l > 0 ? Math.PI : 0);
  });
  /* las manzanas de las esquinas: dos caras cada una */
  [[1, -1], [-1, -1], [1, 1], [-1, 1]].forEach(function (e) {
    var sx = e[0], sz = e[1];
    fila(sx * F, sz * F, sx, 0, 26, sz < 0 ? 0 : Math.PI);
    fila(sx * F, sz * F, 0, sz, 26, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  });
  banador = new Float32Array(lista.length); lista.forEach(function (c, k) { banador[k] = c.casona ? 1 : 0; });
  g.setAttribute('banador', new THREE.InstancedBufferAttribute(banador, 1));
  /* la ciudad de más allá: manzanas lejanas (sin detalle propio; el mismo shader les pone ventanas)
     para que desde arriba no se vea el vacío detrás de los techos */
  var M = 37.5;
  for (var bi = -3; bi <= 3; bi++) for (var bj = -3; bj <= 3; bj++) {
    if (Math.abs(bi) <= 1 && Math.abs(bj) <= 1) continue;
    for (var k2 = 0; k2 < 5; k2++) {
      var w2 = 9 + rnd() * 9, d2 = 9 + rnd() * 9, gx = bi * M + (rnd() - .5) * 18, gz = bj * M + (rnd() - .5) * 18;
      var giro2 = Math.atan2(-gx, -gz); giro2 = Math.round(giro2 / (Math.PI / 2)) * (Math.PI / 2);
      lista.push({ x: gx, z: gz, w: w2, h: (1 + Math.floor(rnd() * 3)) * 3.3 + .45, d: d2, g: giro2, pisos: 2, fx: gx, fz: gz, lejos: true });
    }
  }
  var casas = new THREE.InstancedMesh(g, mat, lista.length);
  lista.forEach(function (c, k) {
    p.set(c.x, 0, c.z); eu.set(0, c.g, 0); q.setFromEuler(eu); s.set(c.w, c.h, c.d);
    m4.compose(p, q, s); casas.setMatrixAt(k, m4);
    col.set(c.casona ? '#EFE6D2' : PAL[(rnd() * PAL.length) | 0]).convertSRGBToLinear(); casas.setColorAt(k, col);
  });
  casas.frustumCulled = false;
  escena.add(casas);
  return { casas: casas, mat: mat, lista: lista };
};

/* ---------- los balcones de cajón (madera con celosías) ---------- */
function texBalcon(prendido) {
  /* madera con celosías; si está "prendido", detrás de la celosía hay luz (y su mapa de brillo) */
  var c = A.lienzo(512, 256), x = c.getContext('2d'), e = A.lienzo(512, 256), xe = e.getContext('2d'), rnd = A.azar(prendido ? 5 : 9);
  x.fillStyle = '#6A4224'; x.fillRect(0, 0, 512, 256); xe.fillStyle = '#000'; xe.fillRect(0, 0, 512, 256);
  for (var i = 0; i < 180; i++) { x.fillStyle = 'rgba(' + (rnd() < .5 ? '30,15,6' : '120,78,44') + ',' + (.1 + rnd() * .14) + ')'; x.fillRect(0, rnd() * 256, 512, 1 + rnd() * 2); }
  for (var p = 0; p < 4; p++) { x.strokeStyle = '#2E1A0C'; x.lineWidth = 6; x.strokeRect(14 + p * 124, 160, 112, 80); x.strokeStyle = 'rgba(170,110,60,.7)'; x.lineWidth = 2; x.strokeRect(24 + p * 124, 170, 92, 60); }
  for (p = 0; p < 4; p++) {
    var ox = 14 + p * 124, oy = 14, w = 112, h = 128;
    x.fillStyle = prendido ? '#E8A050' : '#1E140C'; x.fillRect(ox, oy, w, h);
    if (prendido) { xe.fillStyle = '#FFB060'; xe.fillRect(ox, oy, w, h); }
    [x, xe].forEach(function (g, k) {
      g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip(); g.strokeStyle = k ? '#000' : '#4A2C16'; g.lineWidth = 4.5;
      for (var j = -h; j < w + h; j += 11) { g.beginPath(); g.moveTo(ox + j, oy); g.lineTo(ox + j + h, oy + h); g.stroke(); g.beginPath(); g.moveTo(ox + j + h, oy); g.lineTo(ox + j, oy + h); g.stroke(); }
      g.restore(); g.strokeStyle = k ? '#000' : '#2E1A0C'; g.lineWidth = 7; g.strokeRect(ox, oy, w, h);
    });
  }
  x.fillStyle = '#3E2512'; x.fillRect(0, 146, 512, 12); x.fillRect(0, 0, 512, 8); x.fillRect(0, 248, 512, 8);
  return { map: A.texDe(c, true, false), emis: A.texDe(e, true, false) };
}
A.armarBalcones = function (escena, lista) {
  /* en algunas casas de dos pisos que miran a la plaza; la del norte a x = −9 siempre (ahí cuelga una esfera) */
  var elegidos = [], rnd = A.azar(41);
  lista.forEach(function (c) {
    if (c.pisos < 2 || c.casona) return;
    var dentro = Math.abs(c.fx) <= P.fachada + .1 && Math.abs(c.fz) <= P.fachada + .1 && Math.max(Math.abs(c.fx), Math.abs(c.fz)) > P.fachada - .2;
    if (!dentro) return;
    var esNorte = Math.abs(c.fz + P.fachada) < .2 && c.fx < -6 && c.fx - c.w / 2 < -9 && c.fx + c.w / 2 > -9;
    if (esNorte || rnd() < .45) elegidos.push({ c: c, x: esNorte ? -9 : null });
  });
  var tA = texBalcon(true), tB = texBalcon(false);
  var mA = new THREE.MeshLambertMaterial({ map: tA.map, emissive: '#FFFFFF', emissiveMap: tA.emis, emissiveIntensity: .55 });
  var mB = new THREE.MeshLambertMaterial({ map: tB.map });
  tB.emis.dispose();
  /* caja + techito + repisa con canecillos, en una geometría */
  var piezas = [new THREE.BoxGeometry(2.4, 1.7, .7).translate(0, .85, .35), new THREE.BoxGeometry(2.6, .12, .85).translate(0, 1.76, .38), new THREE.BoxGeometry(2.6, .14, .85).translate(0, -.07, .38)];
  for (var i = 0; i < 4; i++) piezas.push(new THREE.BoxGeometry(.14, .3, .6).translate(-.9 + i * .6, -.28, .3));
  var gb = A.unir(piezas);
  var a = elegidos.filter(function (e, i) { return i % 2 === 0; }), b = elegidos.filter(function (e, i) { return i % 2 === 1; });
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), eu = new THREE.Euler();
  var balconNorte = null;
  [[a, mA], [b, mB]].forEach(function (par) {
    if (!par[0].length) return;
    var im = new THREE.InstancedMesh(gb, par[1], par[0].length);
    par[0].forEach(function (e, k) {
      var c = e.c, ox = e.x !== null ? e.x - c.fx : 0;
      var ux = Math.cos(c.g), uz = -Math.sin(c.g), nx = Math.sin(c.g), nz = Math.cos(c.g);
      p.set(c.fx + ux * ox, 3.55, c.fz + uz * ox); eu.set(0, c.g, 0); q.setFromEuler(eu); m4.compose(p, q, s); im.setMatrixAt(k, m4);
      if (e.x !== null) balconNorte = { x: p.x + nx * .7, y: 3.48, z: p.z + nz * .7 };
    });
    escena.add(im);
  });
  return { norte: balconNorte || { x: -9, y: 3.48, z: -P.fachada + .7 } };
};

/* ---------- la torre del reloj (sobre la casona del norte) ---------- */
function texReloj() {
  var c = A.lienzo(256, 256);
  var t = A.texDe(c, true, false);
  t.dibujar = function (h, mi, se) {
    var x = c.getContext('2d');
    x.clearRect(0, 0, 256, 256);
    var g = x.createRadialGradient(128, 128, 10, 128, 128, 124); g.addColorStop(0, '#FFF7E6'); g.addColorStop(1, '#EBDDBF');
    x.fillStyle = g; x.beginPath(); x.arc(128, 128, 122, 0, 6.3); x.fill();
    x.strokeStyle = '#2B2016'; x.lineWidth = 7; x.stroke();
    x.fillStyle = '#2B2016'; x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach(function (r, i) { var a = i / 12 * Math.PI * 2 - Math.PI / 2; x.fillText(r, 128 + Math.cos(a) * 94, 128 + Math.sin(a) * 94); });
    for (var i = 0; i < 60; i++) { var a = i / 60 * Math.PI * 2; x.lineWidth = i % 5 ? 2 : 4; x.beginPath(); x.moveTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); x.lineTo(128 + Math.cos(a) * (i % 5 ? 106 : 102), 128 + Math.sin(a) * (i % 5 ? 106 : 102)); x.stroke(); }
    function aguja(ang, largo, ancho) { x.save(); x.translate(128, 128); x.rotate(ang); x.fillStyle = '#1C140D'; x.beginPath(); x.moveTo(-ancho, 12); x.lineTo(0, -largo); x.lineTo(ancho, 12); x.fill(); x.restore(); }
    aguja((h % 12 + mi / 60) / 12 * Math.PI * 2, 54, 6);
    aguja((mi + se / 60) / 60 * Math.PI * 2, 84, 4.5);
    x.save(); x.translate(128, 128); x.rotate(se / 60 * Math.PI * 2); x.strokeStyle = '#9A2A22'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 16); x.lineTo(0, -96); x.stroke(); x.restore();
    x.fillStyle = '#1C140D'; x.beginPath(); x.arc(128, 128, 7, 0, 6.3); x.fill();
    t.needsUpdate = true;
  };
  return t;
}
function texCampanario() {
  var c = A.lienzo(256, 256), x = c.getContext('2d');
  x.fillStyle = '#EFE6D2'; x.fillRect(0, 0, 256, 256);
  /* arco con la campana adentro */
  x.fillStyle = '#120E0C'; x.beginPath(); x.moveTo(64, 236); x.lineTo(64, 100); x.arc(128, 100, 64, Math.PI, 0); x.lineTo(192, 236); x.fill();
  x.fillStyle = '#9A7A3C'; x.beginPath(); x.moveTo(104, 150); x.quadraticCurveTo(104, 100, 128, 98); x.quadraticCurveTo(152, 100, 152, 150); x.lineTo(160, 168); x.lineTo(96, 168); x.fill();
  x.strokeStyle = '#D7C9A9'; x.lineWidth = 12; x.beginPath(); x.moveTo(58, 240); x.lineTo(58, 100); x.arc(128, 100, 70, Math.PI, 0); x.lineTo(198, 240); x.stroke();
  return A.texDe(c, true, false);
}
A.armarTorre = function (escena) {
  var g = new THREE.Group(), F = P.fachada, z0 = -F - 2.2;
  g.position.set(0, 0, z0); escena.add(g);
  var cG = A.lienzo(4, 64), xG = cG.getContext('2d'), gG = xG.createLinearGradient(0, 64, 0, 0); gG.addColorStop(0, '#FFC890'); gG.addColorStop(.6, '#7A5A40'); gG.addColorStop(1, '#2A2018'); xG.fillStyle = gG; xG.fillRect(0, 0, 4, 64);
  var tG = A.texDe(cG, true, false);
  var crema = new THREE.MeshLambertMaterial({ color: '#E9DFC9', emissive: '#FFFFFF', emissiveMap: tG, emissiveIntensity: .32 }), ocre = new THREE.MeshLambertMaterial({ color: '#C99A55' });
  var cuerpo = A.unir([new THREE.BoxGeometry(3.4, 4.6, 3.4).translate(0, 6.9 + 2.3, 0), new THREE.BoxGeometry(3.7, .3, 3.7).translate(0, 11.65, 0), new THREE.BoxGeometry(3.6, .25, 3.6).translate(0, 7.0, 0)]);
  g.add(new THREE.Mesh(cuerpo, crema));
  /* campanario: cuatro caras con arco */
  var tC = texCampanario();
  var camp = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.4, 3.0).translate(0, 13.0, 0), [new THREE.MeshLambertMaterial({ map: tC }), new THREE.MeshLambertMaterial({ map: tC }), crema, crema, new THREE.MeshLambertMaterial({ map: tC }), new THREE.MeshLambertMaterial({ map: tC })]);
  g.add(camp);
  g.add(new THREE.Mesh(A.unir([new THREE.BoxGeometry(3.3, .22, 3.3).translate(0, 14.3, 0), new THREE.ConeGeometry(2.25, 1.8, 4).rotateY(Math.PI / 4).translate(0, 15.3, 0)]), ocre));
  /* remate: bola y veleta (genéricos) */
  var fierro = new THREE.MeshLambertMaterial({ color: '#2A2522' });
  g.add(new THREE.Mesh(A.unir([new THREE.SphereGeometry(.16, 12, 8).translate(0, 16.3, 0), new THREE.CylinderGeometry(.025, .025, 1.1, 6).translate(0, 16.7, 0), new THREE.BoxGeometry(.6, .03, .03).translate(0, 16.9, 0)]), fierro));
  /* el reloj (cara a la plaza), iluminado de noche */
  var tR = texReloj(); tR.dibujar(11, 52, 0);
  var mR = new THREE.MeshBasicMaterial({ map: tR, color: '#FFF1D2' });
  var cara = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), mR); cara.position.set(0, 9.4, 1.72); g.add(cara);
  var aro = new THREE.Mesh(new THREE.TorusGeometry(1.03, .07, 8, 40), ocre); aro.position.copy(cara.position); g.add(aro);
  var luz = A.agregarLuz(0, 9.4, z0 + 2.6, '#FFE3B0', .55, 6);
  return { reloj: tR, cara: cara, luz: luz, grupo: g };
};

/* ---------- los foquitos (todas las guirnaldas de la plaza, menos las del árbol) ----------
   Un solo sistema de puntos: cada foquito tiene su color, su fase y su grupo (0 fachadas,
   1 palmeras, 2 puesto, 3 nacimiento). Titilan suave; al final (uFiesta) corren en olas. */
A.Foquitos = function () {
  var pos = [], col = [], fas = [], gru = [];
  var COL = [[1, .22, .16], [.25, 1, .35], [.3, .45, 1], [1, .7, .22], [1, .95, .8], [1, .35, .75]];
  var rnd = A.azar(77);
  return {
    agregar: function (x, y, z, grupo, c) { var k = c || COL[(rnd() * COL.length) | 0]; pos.push(x, y, z); col.push(k[0], k[1], k[2]); fas.push(rnd() * 6.283); gru.push(grupo || 0); },
    /* una guirnalda colgada entre dos puntos, con su comba */
    colgar: function (a, b, comba, cada, grupo) {
      var L = a.distanceTo(b), n = Math.max(2, Math.round(L / cada));
      for (var i = 0; i <= n; i++) { var t = i / n; this.agregar(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * comba, a.z + (b.z - a.z) * t, grupo); }
    },
    armar: function (escena) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('fase', new THREE.Float32BufferAttribute(fas, 1));
      g.setAttribute('grupo', new THREE.Float32BufferAttribute(gru, 1));
      var m = new THREE.ShaderMaterial({
        uniforms: { uT: A.U.uT, uFiesta: A.U.uFiesta, uPr: { value: 1 }, uAlto: { value: 800 }, uTam: { value: .16 }, uTw: { value: A.reducido ? .3 : 1 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
        vertexShader: [
          'attribute float fase; attribute float grupo; uniform float uT, uFiesta, uPr, uAlto, uTam, uTw; varying vec3 vC; varying float vA;',
          'void main(){',
          '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
          '  float tw = 1.0 - uTw * .3 * (.5 + .5 * sin(uT * (1.2 + fract(fase) * 1.5) + fase * 5.0));',
          '  float ola = .5 + .5 * sin(position.x * .9 + position.z * .9 - uT * 5.0);',
          '  tw = mix(tw, .35 + .9 * ola, uFiesta * uTw * .7);',
          '  vC = color * tw * (1.0 + uFiesta * .25); vA = 1.0;',
          '  gl_PointSize = max(2.0, uTam * uAlto * .9 / -mv.z) * uPr;',
          '  gl_Position = projectionMatrix * mv;',
          '}'
        ].join('\n'),
        fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c); float a = exp(-r2 * 70.0) * 1.4 + exp(-r2 * 12.0) * .32; gl_FragColor = vec4((vC + vec3(.35) * exp(-r2 * 200.0)) * a * vA, 1.0); }'
      });
      var p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 4; escena.add(p);
      return { puntos: p, mat: m, medir: function (pr, alto) { m.uniforms.uPr.value = pr; m.uniforms.uAlto.value = alto; } };
    }
  };
};
/* las guirnaldas de las fachadas que miran a la plaza (a 3,1 m, con ganchos cada ~3 m) */
A.guirnaldasFachadas = function (F, lista) {
  var a = new THREE.Vector3(), b = new THREE.Vector3();
  lista.forEach(function (c) {
    var cerca = Math.max(Math.abs(c.fx), Math.abs(c.fz)) < P.fachada + 30;
    if (!cerca || c.casona || c.lejos) return;
    var ux = Math.cos(c.g), uz = -Math.sin(c.g), nx = Math.sin(c.g), nz = Math.cos(c.g), n = Math.max(1, Math.round(c.w / 3));
    for (var i = 0; i < n; i++) {
      var t0 = -c.w / 2 + c.w * i / n + .15, t1 = -c.w / 2 + c.w * (i + 1) / n - .15;
      a.set(c.fx + ux * t0 + nx * .12, 3.25, c.fz + uz * t0 + nz * .12); b.set(c.fx + ux * t1 + nx * .12, 3.25, c.fz + uz * t1 + nz * .12);
      F.colgar(a, b, .22, .3, 0);
    }
    if (c.pisos > 1) { a.set(c.fx - ux * c.w * .48 + nx * .1, c.h - .05, c.fz - uz * c.w * .48 + nz * .1); b.set(c.fx + ux * c.w * .48 + nx * .1, c.h - .05, c.fz + uz * c.w * .48 + nz * .1); F.colgar(a, b, .05, .34, 0); }
  });
};
})();

;
/* El árbol que se enciende — prototipo.
   adornos.js: lo que hay en la plaza. Faroles coloniales de tres farolas, bancas de madera y
   fierro, la pileta de dos tazas con su agua, palmeras con foquitos en espiral, jardines con
   flores, macetas, la escalinata de la casona, el nacimiento estilo retablo y el puesto de
   chocolatada con panetón. Todo genérico y propio: ningún objeto copia uno real ni lleva
   marcas (las cajas dicen "PANETÓN" y nada más).

   Cada cosa que se repite va instanciada (una llamada de dibujo para todas las bancas, otra
   para todos los faroles…). Lo que no se repite se une en una sola malla por material.
   Al final se registran las colisiones (círculos y cajas) para que nadie atraviese nada. */
(function () {
'use strict';
var A = window.Arbol, P = A.PLAZA;

/* ---------- colisiones ---------- */
A.colisiones = [];
function circulo(x, z, r) { A.colisiones.push({ t: 0, x: x, z: z, r: r }); }
function caja(x, z, hx, hz, giro) { A.colisiones.push({ t: 1, x: x, z: z, hx: hx, hz: hz, c: Math.cos(giro || 0), s: Math.sin(giro || 0) }); }
/* saca el punto p (con su radio) de todo lo que choca; devuelve true si chocó */
A.empujar = function (p, rad) {
  var hubo = false;
  for (var i = 0; i < A.colisiones.length; i++) {
    var o = A.colisiones[i], dx = p.x - o.x, dz = p.z - o.z;
    if (o.t === 0) {
      var d = Math.sqrt(dx * dx + dz * dz), pen = o.r + rad - d;
      if (pen > 0) { p.x += dx / (d || 1) * pen; p.z += dz / (d || 1) * pen; hubo = true; }
    } else {
      var lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      var qx = Math.max(-o.hx, Math.min(o.hx, lx)), qz = Math.max(-o.hz, Math.min(o.hz, lz));
      var ex = lx - qx, ez = lz - qz, e = Math.sqrt(ex * ex + ez * ez);
      if (e < rad) {
        var nx, nz, pn;
        if (e > 1e-4) { nx = ex / e; nz = ez / e; pn = rad - e; }
        else { var px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz); if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; pn = px + rad; } else { nx = 0; nz = lz < 0 ? -1 : 1; pn = pz + rad; } }
        p.x += (nx * o.c + nz * o.s) * pn; p.z += (-nx * o.s + nz * o.c) * pn; hubo = true;
      }
    }
  }
  /* el borde: hasta las fachadas */
  var L = P.fachada - .45;
  if (p.x > L) { p.x = L; hubo = true; } if (p.x < -L) { p.x = -L; hubo = true; }
  if (p.z > L) { p.z = L; hubo = true; } if (p.z < -L) { p.z = -L; hubo = true; }
  return hubo;
};

/* ---------- texturas ---------- */
function texPiedra(base, vetas, sem) {
  var c = A.lienzo(256, 256), x = c.getContext('2d'), rnd = A.azar(sem || 3), o = A.ruidoPer(8, rnd), o2 = A.ruidoPer(32, rnd);
  var im = x.createImageData(256, 256), d = im.data, b = new THREE.Color(base);
  for (var y = 0; y < 256; y++) for (var xx = 0; xx < 256; xx++) {
    var f = o(xx / 32, y / 32) * .6 + o2(xx / 8, y / 8) * .4, k = (y * 256 + xx) * 4, v = .78 + f * .34 + (rnd() - .5) * .08;
    d[k] = Math.min(255, b.r * 255 * v); d[k + 1] = Math.min(255, b.g * 255 * v); d[k + 2] = Math.min(255, b.b * 255 * v); d[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  if (vetas) for (var i = 0; i < 18; i++) { x.strokeStyle = 'rgba(60,50,45,' + (.05 + rnd() * .08) + ')'; x.lineWidth = 1 + rnd() * 2; x.beginPath(); x.moveTo(rnd() * 256, rnd() * 256); for (var s = 0; s < 4; s++) x.lineTo(rnd() * 256, rnd() * 256); x.stroke(); }
  return A.texDe(c, true, true);
}

/* una mata de geranios y flores de varios colores, pintada con transparencia */
A.texMata = (function () {
  var t = null;
  return function () {
    if (t) return t;
    var c = A.lienzo(256, 192), x = c.getContext('2d'), rnd = A.azar(83);
    x.clearRect(0, 0, 256, 192);
    for (var i = 0; i < 150; i++) {
      var px = 128 + (rnd() - .5) * 220 * (.4 + .6 * rnd()), py = 192 - rnd() * 150 * (1 - Math.abs(px - 128) / 160), r = 9 + rnd() * 9;
      x.fillStyle = ['#1F4A22', '#2A5C2A', '#173C1C', '#356B30'][(rnd() * 4) | 0];
      x.beginPath(); x.ellipse(px, py, r, r * .62, rnd() * 3, 0, 6.3); x.fill();
      x.strokeStyle = 'rgba(10,30,12,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - r * .8, py); x.lineTo(px + r * .8, py); x.stroke();
    }
    var COL = ['#D8243A', '#E8384F', '#F2F0EA', '#F06A9A', '#F2B53A'];
    for (i = 0; i < 26; i++) {
      var cx = 40 + rnd() * 176, cy = 30 + rnd() * 90, col = COL[i % COL.length];
      for (var k = 0; k < 7; k++) { var a = rnd() * 6.3, rr = rnd() * 7; x.fillStyle = col; x.beginPath(); x.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3.2 + rnd() * 1.6, 0, 6.3); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(cx - 2, cy - 2, 2, 0, 6.3); x.fill();
    }
    t = A.texDe(c, true, false); return t;
  };
})();

/* ---------- faroles: poste de fierro con tres farolas ---------- */
A.FAROLES = [[6.1, -6.1], [-6.1, -6.1], [6.1, 6.1], [-6.1, 6.1], [4.6, -13.2], [-4.6, -13.2], [3.4, 14.6], [-3.4, 14.6], [-14.6, -5.2], [14.6, 5.2]];
function geoFarol() {
  var fi = [], vi = [];
  fi.push(new THREE.CylinderGeometry(.22, .27, .5, 8).translate(0, .25, 0));
  fi.push(new THREE.CylinderGeometry(.17, .21, .14, 8).translate(0, .57, 0));
  fi.push(new THREE.CylinderGeometry(.07, .095, 2.55, 10).translate(0, 1.9, 0));
  [1.15, 2.95].forEach(function (y) { fi.push(new THREE.TorusGeometry(.09, .025, 6, 14).rotateX(Math.PI / 2).translate(0, y, 0)); });
  fi.push(new THREE.CylinderGeometry(.13, .08, .16, 10).translate(0, 3.2, 0));
  /* los brazos en curva, a cada lado */
  [-1, 1].forEach(function (l) {
    var cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 3.12, 0), new THREE.Vector3(l * .28, 3.08, 0), new THREE.Vector3(l * .5, 3.18, 0), new THREE.Vector3(l * .56, 3.32, 0)]);
    fi.push(new THREE.TubeGeometry(cur, 10, .028, 6, false));
    fi.push(new THREE.TorusGeometry(.07, .016, 5, 10, Math.PI * 1.4).rotateY(Math.PI / 2).translate(l * .2, 2.98, 0));
  });
  /* tres farolas: copa, techito, remate; el vidrio va aparte */
  [[0, 3.32], [-.56, 3.36], [.56, 3.36]].forEach(function (f) {
    var y = f[1];
    fi.push(new THREE.CylinderGeometry(.11, .06, .08, 6).translate(f[0], y + .02, 0));
    fi.push(new THREE.ConeGeometry(.19, .17, 6).translate(f[0], y + .45, 0));
    fi.push(new THREE.SphereGeometry(.035, 6, 5).translate(f[0], y + .57, 0));
    for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2 + Math.PI / 6; fi.push(new THREE.BoxGeometry(.016, .32, .016).translate(f[0] + Math.cos(a) * .125, y + .22, Math.sin(a) * .125)); }
    vi.push(new THREE.CylinderGeometry(.125, .1, .3, 6).translate(f[0], y + .21, 0));
  });
  return { fierro: A.unir(fi), vidrio: A.unir(vi) };
}

/* ---------- banca: listones de madera, costados de fierro con rulos ---------- */
function geoBanca() {
  var p = [], M = '#5C3A1F', M2 = '#4E301A', F = '#141316';
  for (var i = 0; i < 4; i++) p.push(A.pintar(new THREE.BoxGeometry(1.8, .04, .085).translate(0, .45, -.2 + i * .1), i % 2 ? M : M2));
  for (i = 0; i < 3; i++) p.push(A.pintar(new THREE.BoxGeometry(1.8, .085, .035).rotateX(-.22).translate(0, .62 + i * .11, -.29 - i * .025), i % 2 ? M2 : M));
  [-.78, .78].forEach(function (x) {
    p.push(A.pintar(new THREE.BoxGeometry(.05, .44, .05).translate(x, .22, .12), F));
    p.push(A.pintar(new THREE.BoxGeometry(.05, .82, .05).rotateX(-.2).translate(x, .4, -.26), F));
    p.push(A.pintar(new THREE.BoxGeometry(.05, .05, .5).translate(x, .43, -.07), F));
    p.push(A.pintar(new THREE.BoxGeometry(.06, .05, .45).translate(x, .66, -.02), F));
    p.push(A.pintar(new THREE.TorusGeometry(.08, .016, 5, 12).rotateY(Math.PI / 2).translate(x, .3, .02), F));
    p.push(A.pintar(new THREE.CylinderGeometry(.04, .04, .06, 8).rotateZ(Math.PI / 2).translate(x, .68, .2), F));
  });
  return A.unir(p);
}

/* ---------- la pileta ---------- */
function perfilPedestal() {
  var v = [[0, .1], [.52, .1], [.52, .22], [.42, .3], [.36, .48], [.24, .6], [.2, 1.0], [.26, 1.08], [.5, 1.16], [.9, 1.24], [1.16, 1.3], [1.18, 1.36], [1.08, 1.37], [.3, 1.33],
           [.16, 1.38], [.14, 1.9], [.18, 2.02], [.36, 2.12], [.6, 2.26], [.62, 2.32], [.55, 2.33], [.2, 2.3], [.1, 2.36], [.09, 2.55], [.14, 2.62], [.15, 2.7], [.1, 2.8], [.06, 2.86], [0, 2.9]];
  return v.map(function (q) { return new THREE.Vector2(q[0], q[1]); });
}
function matAgua(env) {
  return new THREE.ShaderMaterial({
    uniforms: A.unif({ uEnv: { value: env }, uRuido: { value: A.texRuido() }, uChorro: { value: new THREE.Vector3(0, .5, 1.36) } }),
    transparent: false,
    vertexShader: 'varying vec3 vPos; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: A.GLSL_LUZ + [
      '',
      'uniform samplerCube uEnv; uniform sampler2D uRuido; uniform vec3 uChorro;',
      'varying vec3 vPos;',
      'void main(){',
      '  vec3 V = normalize(vPos - cameraPosition); vec2 p = vPos.xz; float r = length(p) + 1e-4;',
      '  vec2 g1 = texture2D(uRuido, p * .32 + uT * vec2(.025, .018)).gb - .5;',
      '  vec2 g2 = texture2D(uRuido, p * .85 - uT * vec2(.05, .037)).gb - .5;',
      /* anillos donde cae el agua de la taza (r = uChorro.z según el nivel) */
      '  float rc = uChorro.z; float onda = sin((r - rc) * 30.0 - uT * 7.0) * exp(-abs(r - rc) * 2.6);',
      '  vec3 n = normalize(vec3(g1.x * .22 + g2.x * .12 + p.x / r * onda * .07, 1.0, g1.y * .22 + g2.y * .12 + p.y / r * onda * .07));',
      '  vec3 R = reflect(V, n); R.y = abs(R.y);',
      /* el cubemap guarda colores ya en sRGB: se pasan a lineal (aprox. γ 2) */
      '  vec3 refl = textureCube(uEnv, R).rgb; refl *= refl;',
      '  float fres = .03 + .97 * pow(1.0 - max(dot(-V, n), 0.0), 5.0);',
      /* el fondo: azulejo turquesa iluminado por las luces de adentro */
      '  float az = texture2D(uRuido, p * 2.2).a; vec2 tl = abs(fract(p * 3.3) - .5);',
      '  vec3 fondo = mix(vec3(.006, .03, .036), vec3(.012, .06, .065), az) * (1.0 - smoothstep(.44, .5, max(tl.x, tl.y)) * .4);',
      '  fondo *= 1.0 + 2.2 * exp(-r * r * .45) * vec3(.6, 1.0, .95);',
      '  vec3 c = mix(fondo, refl * 1.15, fres) + brilloPlaza(vPos, n, -V, 300.0) * 1.2;',
      /* espuma donde cae el agua */
      '  float esp = smoothstep(.62, .9, texture2D(uRuido, p * 3.0 + uT * .3).b) * exp(-abs(r - rc) * 7.0);',
      '  c += vec3(.75, .85, .9) * esp * .6 * (.4 + luzPlaza(vPos, vec3(0.0, 1.0, 0.0), 0.0).g);',
      '  gl_FragColor = vec4(c, 1.0);',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
}
/* agua que cae: una cortina con hilos que corren hacia abajo */
function matCaida() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: A.U.uT, uRuido: { value: A.texRuido() } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform float uT; uniform sampler2D uRuido; varying vec2 vUv;',
      'void main(){',
      '  float h = texture2D(uRuido, vec2(vUv.x * 9.0, vUv.y * .35 + uT * .9)).b;',
      '  float h2 = texture2D(uRuido, vec2(vUv.x * 23.0 + .3, vUv.y * .6 + uT * 1.4)).g;',
      '  float hilo = smoothstep(.45, .8, h) * .7 + smoothstep(.55, .85, h2) * .5;',
      '  float a = hilo * smoothstep(0.0, .12, vUv.y) * (.55 + .45 * smoothstep(.95, .6, vUv.y));',
      '  gl_FragColor = vec4(vec3(.5, .66, .72), a * .42);',
      '}'
    ].join('\n')
  });
}

/* ---------- palmeras ---------- */
A.PALMERAS = [[10.5, 10.5, 8.2, .3], [-10.5, 10.5, 7.6, -.2], [10.5, -10.5, 7.9, 2.4], [-10.5, -10.5, 8.4, 1.1]];
function texTronco() {
  var c = A.lienzo(128, 256), x = c.getContext('2d'), rnd = A.azar(13);
  x.fillStyle = '#6B5A48'; x.fillRect(0, 0, 128, 256);
  for (var y = 0; y < 256; y += 14) {
    var g = x.createLinearGradient(0, y, 0, y + 14); g.addColorStop(0, '#4A3D31'); g.addColorStop(.25, '#7C6A55'); g.addColorStop(.8, '#5E4F40'); g.addColorStop(1, '#3A3028');
    x.fillStyle = g; x.fillRect(0, y, 128, 14);
    for (var i = 0; i < 9; i++) { x.fillStyle = 'rgba(30,24,18,' + (.2 + rnd() * .3) + ')'; x.fillRect(rnd() * 128, y + 10 + rnd() * 3, 8 + rnd() * 18, 2); }
  }
  for (var k = 0; k < 400; k++) { x.fillStyle = 'rgba(' + (rnd() < .5 ? '20,15,10' : '140,125,105') + ',.12)'; x.fillRect(rnd() * 128, rnd() * 256, 2, 2); }
  return A.texDe(c, true, true);
}
function texHoja() {
  var c = A.lienzo(512, 128), x = c.getContext('2d'), rnd = A.azar(17);
  x.clearRect(0, 0, 512, 128);
  /* folíolos a los dos lados del nervio, más largos al medio */
  for (var i = 0; i < 70; i++) {
    var u = 12 + i * 7, largo = 56 * Math.sin(Math.PI * Math.pow(u / 512, .85)) + 6;
    [-1, 1].forEach(function (l) {
      var verde = ['#2F5A2A', '#3B6B31', '#28502A', '#45773A'][(rnd() * 4) | 0];
      x.strokeStyle = verde; x.lineWidth = 5 + rnd() * 2; x.lineCap = 'round';
      var ll = largo * (.85 + rnd() * .3);
      x.beginPath(); x.moveTo(u, 64); x.quadraticCurveTo(u + 9, 64 + l * ll * .5, u + 18 + rnd() * 8, 64 + l * ll); x.stroke();
    });
  }
  x.strokeStyle = '#6E7A3A'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, 64); x.lineTo(512, 64); x.stroke();
  var t = A.texDe(c, true, false); return t;
}
function geoHoja() {
  /* arco que sube y cae, plegado en V hacia abajo */
  var S = 12, pos = [], uv = [], idx = [];
  for (var i = 0; i <= S; i++) {
    var s = i / S, xx = s * 3.3, yy = 3.3 * (.42 * s - .78 * s * s), w = .62 * Math.sin(Math.PI * Math.pow(s, .8)) + .05;
    [-1, 0, 1].forEach(function (l, j) { pos.push(xx, yy - Math.abs(l) * w * .28, l * w); uv.push(s, j / 2); });
  }
  for (i = 0; i < S; i++) for (var j = 0; j < 2; j++) { var a = i * 3 + j, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------- el nacimiento (retablo) ---------- */
function texRetabloFondo() {
  var c = A.lienzo(512, 512), x = c.getContext('2d'), rnd = A.azar(29);
  /* dos niveles: arriba el cielo con la estrella, abajo los cerros */
  var g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#152A5C'); g.addColorStop(.5, '#24407A'); g.addColorStop(1, '#3A3A6E'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (var i = 0; i < 120; i++) { x.fillStyle = 'rgba(255,240,200,' + (.4 + rnd() * .6) + ')'; x.beginPath(); x.arc(rnd() * 512, rnd() * 300, .8 + rnd() * 1.6, 0, 6.3); x.fill(); }
  x.fillStyle = '#FFD24A'; x.beginPath(); for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 14 : 34; x.lineTo(256 + Math.cos(a) * r, 120 + Math.sin(a) * r); } x.fill();
  x.strokeStyle = 'rgba(255,220,120,.6)'; x.lineWidth = 3; for (i = 0; i < 12; i++) { var b = i / 12 * 6.283; x.beginPath(); x.moveTo(256 + Math.cos(b) * 40, 120 + Math.sin(b) * 40); x.lineTo(256 + Math.cos(b) * 70, 120 + Math.sin(b) * 70); x.stroke(); }
  [['#3E6B3A', 330], ['#2F5530', 380], ['#56803F', 430]].forEach(function (cc, k) { x.fillStyle = cc[0]; x.beginPath(); x.moveTo(0, 512); for (var p = 0; p <= 8; p++) x.lineTo(p * 64, cc[1] - Math.abs(Math.sin(p * 1.7 + k)) * 70); x.lineTo(512, 512); x.fill(); });
  /* casitas y florcitas pintadas, como en un retablo */
  for (i = 0; i < 6; i++) { var hx = 40 + i * 80, hy = 410 + (i % 2) * 20; x.fillStyle = '#F2E2C8'; x.fillRect(hx, hy, 26, 20); x.fillStyle = '#B5432E'; x.beginPath(); x.moveTo(hx - 4, hy); x.lineTo(hx + 13, hy - 12); x.lineTo(hx + 30, hy); x.fill(); }
  for (i = 0; i < 40; i++) { x.fillStyle = ['#FF5C7A', '#FFD24A', '#FFFFFF', '#FF9A3C'][i % 4]; x.beginPath(); x.arc(rnd() * 512, 470 + rnd() * 40, 3, 0, 6.3); x.fill(); }
  return A.texDe(c, true, false);
}
function texRetabloFlores(fondo) {
  var c = A.lienzo(256, 512), x = c.getContext('2d'), rnd = A.azar(31);
  x.fillStyle = fondo; x.fillRect(0, 0, 256, 512);
  x.strokeStyle = '#F2C94C'; x.lineWidth = 10; x.strokeRect(8, 8, 240, 496);
  x.strokeStyle = '#1E6E5A'; x.lineWidth = 4; x.strokeRect(22, 22, 212, 468);
  /* guirnalda de flores y hojas (diseño propio, al estilo de los retablos pintados) */
  for (var i = 0; i < 26; i++) {
    var cx = 128 + Math.sin(i * .9) * 60, cy = 40 + i * 17.5, col = ['#E8384F', '#F2994A', '#F2C94C', '#BB6BD9', '#FFFFFF'][i % 5];
    x.fillStyle = '#2E8B57'; x.beginPath(); x.ellipse(cx - 18, cy + 6, 12, 5, -.5, 0, 6.3); x.fill(); x.beginPath(); x.ellipse(cx + 18, cy + 6, 12, 5, .5, 0, 6.3); x.fill();
    x.fillStyle = col; for (var p = 0; p < 5; p++) { var a = p / 5 * 6.283; x.beginPath(); x.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 0, 6.3); x.fill(); }
    x.fillStyle = '#F2C94C'; x.beginPath(); x.arc(cx, cy, 4, 0, 6.3); x.fill();
  }
  return A.texDe(c, true, false);
}
function figurasNacimiento() {
  /* figuritas de yeso pintado (estilo retablo): cuerpos de cono, cabezas redondas, colores vivos */
  var p = [], PIEL = '#E2B48C';
  function cono(rb, rt, h, x, y, z, col) { p.push(A.pintar(new THREE.CylinderGeometry(rt, rb, h, 14).translate(x, y + h / 2, z), col)); }
  function bola(r, x, y, z, col, sx, sy, sz) { var g = new THREE.SphereGeometry(r, 14, 10); g.scale(sx || 1, sy || 1, sz || 1); p.push(A.pintar(g.translate(x, y, z), col)); }
  /* María (manto azul, de rodillas) y José (ocre, con bastón) */
  cono(.13, .06, .3, -.05, 0, .42, '#2F5DA8'); bola(.075, -.05, .37, .42, PIEL); bola(.085, -.06, .39, .42, '#2F5DA8', 1, .9, 1.05); bola(.07, -.02, .24, .42, '#F2EEE6', 1.1, .6, 1.2);
  cono(.14, .07, .42, -.08, 0, -.42, '#B07A2A'); bola(.08, -.08, .5, -.42, PIEL); bola(.05, -.04, .45, -.42, '#5A3A22', .9, 1.2, 1.1);
  p.push(A.pintar(new THREE.CylinderGeometry(.012, .012, .62, 6).translate(.04, .31, -.56), '#6B4423'));
  bola(.07, -.08, .56, -.42, '#7A2E2E', 1.05, .5, 1.05);
  /* el pesebre con paja y el Niño */
  p.push(A.pintar(new THREE.BoxGeometry(.2, .1, .34).translate(.02, .05, 0), '#8A5A2E'));
  p.push(A.pintar(new THREE.BoxGeometry(.18, .04, .3).translate(.02, .11, 0), '#E2C26A'));
  /* el Niño envuelto: un cilindro con puntas redondas (r128 no trae cápsulas) */
  bola(.055, .02, .15, -.07, PIEL); p.push(A.pintar(new THREE.CylinderGeometry(.045, .045, .12, 10).rotateX(Math.PI / 2).translate(.02, .15, .05), '#F7F2E8')); bola(.045, .02, .15, .11, '#F7F2E8');
  /* el ángel arriba, con alas y trompeta dorada */
  cono(.1, .05, .3, -.05, 1.0, 0, '#F4F0FF'); bola(.06, -.05, 1.36, 0, PIEL); bola(.064, -.06, 1.38, 0, '#F2C94C', 1, .55, 1);
  [-1, 1].forEach(function (l) { bola(.09, -.1, 1.22, l * .1, '#FFFFFF', .4, 1.2, .9); });
  p.push(A.pintar(new THREE.ConeGeometry(.03, .2, 8).rotateZ(-Math.PI / 2.4).translate(.06, 1.3, .05), '#E8B64A'));
  /* afuera, en la tarima: una llamita con borlas y un pastor con chullo y su ovejita */
  var lx = .55, lz = 1.05;
  bola(.13, lx, .42, lz, '#F4EEE2', 1.4, .9, .9);
  p.push(A.pintar(new THREE.CylinderGeometry(.045, .055, .3, 10).rotateZ(-.25).translate(lx + .14, .62, lz), '#F4EEE2'));
  bola(.06, lx + .2, .79, lz, '#F4EEE2', 1.3, .9, .9);
  [-1, 1].forEach(function (l) { p.push(A.pintar(new THREE.ConeGeometry(.018, .08, 6).translate(lx + .18, .88, lz + l * .035), '#F4EEE2')); bola(.022, lx + .18, .9, lz + l * .05, l < 0 ? '#E8384F' : '#F2C94C'); });
  [[-.08, -.06], [-.08, .06], [.08, -.06], [.08, .06]].forEach(function (q) { p.push(A.pintar(new THREE.CylinderGeometry(.022, .02, .32, 6).translate(lx + q[0], .16, lz + q[1]), '#E9E0D0')); });
  bola(.05, lx - .12, .5, lz, '#E8384F', 1, .6, 1.6);
  var px = .45, pz = -1.05;
  cono(.12, .07, .42, px, 0, pz, '#C0392B'); bola(.07, px, .5, pz, PIEL);
  bola(.075, px, .55, pz, '#2E8C83', 1, .75, 1); bola(.03, px, .63, pz, '#F2C94C');
  p.push(A.pintar(new THREE.CylinderGeometry(.012, .012, .55, 6).translate(px + .12, .27, pz + .05), '#6B4423'));
  bola(.09, px + .15, .14, pz + .25, '#F2EEE6', 1.3, .85, .85); bola(.04, px + .27, .2, pz + .25, '#3A3330');
  return A.unir(p);
}
A.armarNacimiento = function (escena) {
  var g = new THREE.Group(); g.position.set(-13.6, 0, 0); escena.add(g);   /* mira a +x (hacia la pileta) */
  var madera = new THREE.MeshLambertMaterial({ color: '#5A3A22' });
  var tarima = new THREE.Mesh(new THREE.BoxGeometry(1.7, .25, 3.0).translate(.2, .125, 0), new THREE.MeshLambertMaterial({ map: (function () { var c = A.lienzo(128, 128), x = c.getContext('2d'), r = A.azar(37); x.fillStyle = '#B8923E'; x.fillRect(0, 0, 128, 128); for (var i = 0; i < 300; i++) { x.strokeStyle = 'rgba(' + (r() < .5 ? '240,210,120' : '120,85,30') + ',.6)'; x.lineWidth = 1.2; var a = r() * 6.3, px = r() * 128, py = r() * 128; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 14, py + Math.sin(a) * 14); x.stroke(); } return A.texDe(c, true, true); })() }));
  g.add(tarima);
  /* la caja del retablo: fondo, costados, techo, repisa del medio y frontón */
  var fondo = new THREE.MeshLambertMaterial({ map: texRetabloFondo(), emissive: '#FFB070', emissiveIntensity: .06 });
  var flores = new THREE.MeshLambertMaterial({ map: texRetabloFlores('#B0302A') });
  var flores2 = new THREE.MeshLambertMaterial({ map: texRetabloFlores('#1F5E8C') });
  var cajaR = new THREE.Group(); cajaR.position.set(-.35, .25, 0); g.add(cajaR);
  cajaR.add(new THREE.Mesh(new THREE.PlaneGeometry(1.76, 1.96).rotateY(Math.PI / 2).translate(-.38, .98, 0), fondo));
  cajaR.add(new THREE.Mesh(A.unir([new THREE.BoxGeometry(.8, 2.0, .06).translate(0, 1.0, .91), new THREE.BoxGeometry(.8, 2.0, .06).translate(0, 1.0, -.91), new THREE.BoxGeometry(.8, .06, 1.88).translate(0, 2.0, 0), new THREE.BoxGeometry(.8, .06, 1.88).translate(0, 0, 0), new THREE.BoxGeometry(.8, .05, 1.8).translate(0, 1.0, 0), new THREE.BoxGeometry(.04, 2.0, 1.88).translate(-.41, 1.0, 0)]), flores));
  var fr = new THREE.Shape(); fr.moveTo(-.98, 0); fr.lineTo(0, .62); fr.lineTo(.98, 0); fr.lineTo(-.98, 0);
  cajaR.add(new THREE.Mesh(new THREE.ExtrudeGeometry(fr, { depth: .8, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-.4, 2.02, 0), flores2));
  /* puertas abiertas (bisagra en el borde de adelante) */
  [-1, 1].forEach(function (l) {
    var piv = new THREE.Group(); piv.position.set(.4, 0, l * .93); cajaR.add(piv);
    var pu = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.0, .9).translate(0, 1.0, l * .45), l < 0 ? flores2 : flores);
    piv.add(pu); piv.rotation.y = l * 2.0;
  });
  var fig = new THREE.Mesh(figurasNacimiento(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#3A2A20', emissiveIntensity: .25 }));
  fig.position.set(-.1, .28, 0); cajaR.add(fig);
  /* la estrella dorada del frontón */
  var es = new THREE.Shape(); for (var i = 0; i < 10; i++) { var a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .07 : .17; if (i) es.lineTo(Math.cos(a) * r, Math.sin(a) * r); else es.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  var est = new THREE.Mesh(new THREE.ExtrudeGeometry(es, { depth: .03, bevelEnabled: false }).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#FFD86A' }));
  est.position.set(.02, 2.82, 0); cajaR.add(est);
  var luz = A.agregarLuz(-13.0, 1.1, 0, '#FFC27A', .75, 4.5);
  caja(-13.75, 0, .95, 1.55);
  return { grupo: g, luz: luz, estrella: est };
};

/* ---------- el puesto de chocolatada ---------- */
function texMantel() {
  var c = A.lienzo(256, 128), x = c.getContext('2d');
  x.fillStyle = '#F4EFE4'; x.fillRect(0, 0, 256, 128);
  [['#C0392B', 70, 10], ['#1E6E5A', 84, 5], ['#F2C94C', 92, 6], ['#C0392B', 101, 8], ['#6C3483', 112, 4]].forEach(function (f) { x.fillStyle = f[0]; x.fillRect(0, f[1], 256, f[2]); });
  for (var i = 0; i < 16; i++) { x.fillStyle = '#C0392B'; x.beginPath(); x.moveTo(i * 16, 92); x.lineTo(i * 16 + 8, 84); x.lineTo(i * 16 + 16, 92); x.fill(); }
  return A.texDe(c, true, true);
}
function texToldo() {
  var c = A.lienzo(256, 256), x = c.getContext('2d');
  for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#F2E9D8' : '#B3262B'; x.fillRect(i * 32, 0, 32, 256); }
  x.fillStyle = 'rgba(0,0,0,.12)'; for (i = 0; i < 256; i += 3) x.fillRect(0, i, 256, 1);
  return A.texDe(c, true, true);
}
function texVolante() {
  var c = A.lienzo(256, 64), x = c.getContext('2d');
  x.clearRect(0, 0, 256, 64);
  for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#F2E9D8' : '#B3262B'; x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 32, 34); x.arc(i * 32 + 16, 34, 16, 0, Math.PI); x.fill(); }
  return A.texDe(c, true, false);
}
function texPaneton(fondo, letra) {
  var c = A.lienzo(256, 256), x = c.getContext('2d');
  x.fillStyle = fondo; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(255,255,255,.12)'; for (var i = 0; i < 9; i++) x.fillRect(0, i * 30, 256, 10);
  x.fillStyle = '#F2C94C'; x.beginPath(); for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42; x.lineTo(128 + Math.cos(a) * r, 92 + Math.sin(a) * r); } x.fill();
  x.fillStyle = letra; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.fillText('PANETÓN', 128, 186);
  x.fillStyle = '#E8B04A'; x.fillRect(0, 214, 256, 10);
  return A.texDe(c, true, false);
}
function texPizarra() {
  var c = A.lienzo(256, 320), x = c.getContext('2d');
  x.fillStyle = '#6B4423'; x.fillRect(0, 0, 256, 320);
  x.fillStyle = '#20302A'; x.fillRect(14, 14, 228, 292);
  x.fillStyle = 'rgba(255,255,255,.05)'; for (var i = 0; i < 40; i++) x.fillRect(14 + Math.random() * 228, 14 + Math.random() * 292, 30, 2);
  x.fillStyle = '#F4F1E6'; x.textAlign = 'center'; x.font = 'italic bold 36px "Segoe Print", "Comic Sans MS", cursive'; x.fillText('Chocolatada', 128, 80);
  x.font = 'italic 26px "Segoe Print", "Comic Sans MS", cursive'; x.fillText('con panetón', 128, 122); x.fillStyle = '#F2C94C'; x.fillText('¡para todos!', 128, 162);
  /* una tacita con su vapor, dibujada con tiza */
  x.strokeStyle = '#F4F1E6'; x.lineWidth = 4; x.beginPath(); x.moveTo(92, 214); x.lineTo(100, 262); x.lineTo(152, 262); x.lineTo(160, 214); x.closePath(); x.stroke();
  x.beginPath(); x.arc(166, 234, 12, -1.4, 1.4); x.stroke();
  x.strokeStyle = 'rgba(244,241,230,.7)'; x.lineWidth = 3; [112, 128, 144].forEach(function (vx) { x.beginPath(); x.moveTo(vx, 206); x.bezierCurveTo(vx - 8, 194, vx + 8, 186, vx, 172); x.stroke(); });
  return A.texDe(c, true, false);
}
A.armarPuesto = function (escena, F) {
  var g = new THREE.Group(); g.position.set(12.8, 0, 0); g.rotation.y = -Math.PI / 2; escena.add(g);   /* su frente (+z local) mira a −x */
  var tM = texMantel();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, .9, .75).translate(0, .45, 0), new THREE.MeshLambertMaterial({ color: '#6B4423' })));
  var mant = new THREE.Mesh(new THREE.BoxGeometry(2.68, .8, .82).translate(0, .52, 0), [new THREE.MeshLambertMaterial({ map: tM }), new THREE.MeshLambertMaterial({ map: tM }), new THREE.MeshLambertMaterial({ color: '#F4EFE4' }), new THREE.MeshLambertMaterial({ color: '#F4EFE4' }), new THREE.MeshLambertMaterial({ map: tM }), new THREE.MeshLambertMaterial({ map: tM })]);
  g.add(mant);
  /* parantes y toldo a rayas con su volante */
  var palo = new THREE.MeshLambertMaterial({ color: '#4A3020' });
  g.add(new THREE.Mesh(A.unir([[-1.3, .38], [1.3, .38], [-1.3, -.5], [1.3, -.5]].map(function (q) { return new THREE.CylinderGeometry(.035, .04, 2.45, 8).translate(q[0], 1.22, q[1]); })), palo));
  var tT = texToldo(); tT.repeat.set(1.3, 1);
  var toldo = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.25, 1, 1).rotateX(-Math.PI / 2 + .22).translate(0, 2.36, -.08), new THREE.MeshLambertMaterial({ map: tT, side: THREE.DoubleSide }));
  g.add(toldo);
  var vol = new THREE.Mesh(new THREE.PlaneGeometry(2.9, .3).translate(0, 2.08, .55), new THREE.MeshLambertMaterial({ map: texVolante(), side: THREE.DoubleSide, alphaTest: .5 }));
  g.add(vol);
  /* la olla grande, el fogón y el cucharón */
  var alu = new THREE.MeshLambertMaterial({ color: '#6E7176' });
  var ol = [new THREE.Vector2(0, 0), new THREE.Vector2(.26, 0), new THREE.Vector2(.28, .02), new THREE.Vector2(.28, .38), new THREE.Vector2(.3, .4), new THREE.Vector2(.27, .41), new THREE.Vector2(.25, .39)];
  var olla = new THREE.Mesh(A.unir([new THREE.LatheGeometry(ol, 24), new THREE.TorusGeometry(.05, .015, 6, 12).rotateY(Math.PI / 2).translate(.3, .3, 0), new THREE.TorusGeometry(.05, .015, 6, 12).rotateY(Math.PI / 2).translate(-.3, .3, 0)]), alu);
  olla.position.set(-.75, .98, .02); g.add(olla);
  var choco = new THREE.Mesh(new THREE.CircleGeometry(.25, 20).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4A2414', emissive: '#2A0E06', emissiveIntensity: .4 }));
  choco.position.set(-.75, 1.34, .02); g.add(choco);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .08, 16).translate(-.75, .94, .02), new THREE.MeshLambertMaterial({ color: '#1E1D20' })));
  g.add(new THREE.Mesh(A.unir([new THREE.CylinderGeometry(.012, .012, .5, 6).rotateZ(.5).translate(-.62, 1.5, .05), new THREE.SphereGeometry(.05, 8, 6, 0, 6.3, Math.PI / 2, Math.PI / 2).translate(-.75, 1.28, .05)]), alu));
  /* tazas enlozadas (blancas con borde azul) */
  var taza = [];
  var perf = [new THREE.Vector2(0, 0), new THREE.Vector2(.04, 0), new THREE.Vector2(.045, .01), new THREE.Vector2(.05, .085), new THREE.Vector2(.046, .09), new THREE.Vector2(.042, .02)];
  taza.push(A.pintar(new THREE.LatheGeometry(perf, 14), '#F4F4F0'));
  taza.push(A.pintar(new THREE.TorusGeometry(.05, .006, 4, 14).rotateX(Math.PI / 2).translate(0, .088, 0), '#2F5DA8'));
  taza.push(A.pintar(new THREE.TorusGeometry(.024, .007, 5, 10, Math.PI).rotateZ(-Math.PI / 2).translate(.05, .045, 0), '#F4F4F0'));
  var gTaza = A.unir(taza);
  A.geoTaza = gTaza;
  var tazas = new THREE.InstancedMesh(gTaza, new THREE.MeshLambertMaterial({ vertexColors: true }), 7);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), eu = new THREE.Euler();
  for (var i = 0; i < 7; i++) { p.set(-.2 + (i % 4) * .14, .92, .2 - Math.floor(i / 4) * .14); eu.set(0, i * 1.3, 0); q.setFromEuler(eu); m4.compose(p, q, s); tazas.setMatrixAt(i, m4); }
  g.add(tazas);
  /* cajas de panetón apiladas (dos colores) */
  var gCaja = new THREE.BoxGeometry(.24, .18, .24).translate(0, .09, 0);
  var pilas = [[[.55, .92, .12], [.82, .92, .12], [.55, .92, -.16], [.69, 1.1, -.02]], [[.82, .92, -.16], [.55, 1.1, .1], [.84, 1.1, .02], [.62, 1.28, .0]]];
  ['#1F4E8C', '#A82A2A'].forEach(function (fondo, k) {
    var mt = new THREE.MeshLambertMaterial({ map: texPaneton(fondo, '#FFF4DE') });
    var im = new THREE.InstancedMesh(gCaja, mt, pilas[k].length);
    pilas[k].forEach(function (pp, j) { p.set(pp[0], pp[1], pp[2]); eu.set(0, (j * .37) % .3 - .15, 0); q.setFromEuler(eu); m4.compose(p, q, s); im.setMatrixAt(j, m4); });
    g.add(im);
  });
  /* la pizarra en su caballete, adelante a un lado */
  var piz = new THREE.Group(); piz.position.set(1.55, 0, 1.05); piz.rotation.y = -.35; g.add(piz);
  piz.add(new THREE.Mesh(new THREE.PlaneGeometry(.62, .78).translate(0, 1.02, .02).rotateX(-.12), new THREE.MeshLambertMaterial({ map: texPizarra() })));
  piz.add(new THREE.Mesh(A.unir([new THREE.BoxGeometry(.04, 1.45, .04).rotateX(-.12).translate(-.28, .72, .02), new THREE.BoxGeometry(.04, 1.45, .04).rotateX(-.12).translate(.28, .72, .02), new THREE.BoxGeometry(.04, 1.4, .04).rotateX(.35).translate(0, .68, -.22)]), palo));
  /* foquitos cálidos colgando del volante */
  var w = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  g.updateMatrixWorld(true);
  a.set(-1.4, 2.12, .58).applyMatrix4(g.matrixWorld); b.set(1.4, 2.12, .58).applyMatrix4(g.matrixWorld);
  F.colgar(a, b, .18, .24, 2);
  var luz = A.agregarLuz(12.0, 2.0, 0, '#FFB870', .95, 6.5);
  g.localToWorld(w.set(-.75, 1.4, .02));
  caja(12.8, 0, .45, 1.35);
  return { grupo: g, luz: luz, olla: w.clone(), tazas: tazas };
};

/* ---------- todo lo demás de la plaza ---------- */
A.armarAdornos = function (escena, aj, env, F) {
  var R = {};
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), eu = new THREE.Euler();
  var sombras = [];
  function sombra(x, z, w, d, giro, y) { var g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); if (giro) g.rotateY(giro); sombras.push(g.translate(x, (y || 0) + .012, z)); }

  /* faroles */
  var gf = geoFarol(), n = A.FAROLES.length;
  var fierro = new THREE.MeshLambertMaterial({ color: '#0B0B0D' });
  var vidrio = new THREE.MeshBasicMaterial({ color: '#FFD9A0' });
  var postes = new THREE.InstancedMesh(gf.fierro, fierro, n), vidrios = new THREE.InstancedMesh(gf.vidrio, vidrio, n);
  R.resplandores = [];
  A.FAROLES.forEach(function (f, i) {
    p.set(f[0], 0, f[1]); eu.set(0, Math.atan2(f[0], f[1]), 0); q.setFromEuler(eu); m4.compose(p, q, s);
    postes.setMatrixAt(i, m4); vidrios.setMatrixAt(i, m4);
    A.agregarLuz(f[0], 3.45, f[1], '#FFB25C', 1.05, 7.2);
    [[0, 3.54], [-.56, 3.58], [.56, 3.58]].forEach(function (l) { var v = new THREE.Vector3(l[0], l[1], 0).applyEuler(eu); R.resplandores.push([f[0] + v.x, l[1], f[1] + v.z, 1.5]); });
    circulo(f[0], f[1], .32); sombra(f[0], f[1], 1.2, 1.2);
  });
  escena.add(postes); escena.add(vidrios);

  /* bancas: cuatro alrededor de la pileta (mirándola) y cuatro junto al paso este–oeste */
  A.BANCAS = [];
  [45, 135, 225, 315].forEach(function (g) { var a = g * Math.PI / 180, r = 5.25; A.BANCAS.push([Math.cos(a) * r, Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a))]); });
  [[9.4, -5.6, 0], [-9.4, -5.6, 0], [9.4, 5.6, Math.PI], [-9.4, 5.6, Math.PI]].forEach(function (b) { A.BANCAS.push(b); });
  var bancas = new THREE.InstancedMesh(geoBanca(), new THREE.MeshLambertMaterial({ vertexColors: true }), A.BANCAS.length);
  A.BANCAS.forEach(function (b, i) {
    p.set(b[0], 0, b[1]); eu.set(0, b[2], 0); q.setFromEuler(eu); m4.compose(p, q, s); bancas.setMatrixAt(i, m4);
    caja(b[0], b[1], .92, .3, b[2]); sombra(b[0], b[1], 2.3, 1.0, b[2]);
  });
  escena.add(bancas);

  /* la pileta */
  var tPied = texPiedra('#8E857A', false, 3), mPied = new THREE.MeshLambertMaterial({ map: tPied });
  var oct = [];
  oct.push(new THREE.CylinderGeometry(3.38, 3.42, .1, 8, 1).rotateY(Math.PI / 8).translate(0, .05, 0));
  /* el muro octogonal: anillo con su borde (cara de afuera, de adentro y la tapa) */
  var forma = new THREE.Shape(), hueco = new THREE.Path();
  for (var k = 0; k <= 8; k++) { var a = k / 8 * Math.PI * 2 + Math.PI / 8; var fx = Math.cos(a) * 3.05, fz = Math.sin(a) * 3.05; if (k) forma.lineTo(fx, fz); else forma.moveTo(fx, fz); var hx = Math.cos(a) * 2.72, hz = Math.sin(a) * 2.72; if (k) hueco.lineTo(hx, hz); else hueco.moveTo(hx, hz); }
  forma.holes.push(hueco);
  oct.push(new THREE.ExtrudeGeometry(forma, { depth: .62, bevelEnabled: true, bevelThickness: .03, bevelSize: .04, bevelSegments: 2 }).rotateX(-Math.PI / 2));
  oct.push(new THREE.CylinderGeometry(2.73, 2.73, .06, 8).rotateY(Math.PI / 8).translate(0, .12, 0));
  oct.push(new THREE.LatheGeometry(perfilPedestal(), 28));
  var pileta = new THREE.Mesh(A.unir(oct), mPied);
  escena.add(pileta);
  var mAgua = matAgua(env);
  var agua = new THREE.Mesh(new THREE.CircleGeometry(2.74, 48).rotateX(-Math.PI / 2).translate(0, .5, 0), mAgua); agua.name = 'agua'; escena.add(agua);
  var mAgua2 = matAgua(env); mAgua2.uniforms.uChorro.value.set(0, 1.32, .7);
  var agua2 = new THREE.Mesh(A.unir([new THREE.CircleGeometry(1.1, 36).rotateX(-Math.PI / 2).translate(0, 1.32, 0), new THREE.CircleGeometry(.56, 24).rotateX(-Math.PI / 2).translate(0, 2.3, 0)]), mAgua2); escena.add(agua2);
  /* las cortinas de agua: de la taza de arriba a la de abajo, y de la de abajo al pozo */
  var mC = matCaida();
  function cortina(r0, y0, r1, y1) { var pts = []; for (var i = 0; i <= 8; i++) { var t = i / 8; pts.push(new THREE.Vector2(r0 + (r1 - r0) * Math.pow(t, .6), y0 + (y1 - y0) * t)); } return new THREE.LatheGeometry(pts.reverse(), 36); }
  var caidas = new THREE.Mesh(A.unir([cortina(.62, 2.31, .74, 1.33), cortina(1.18, 1.34, 1.36, .5), cortina(.04, 3.05, .3, 2.32)]), mC);
  caidas.renderOrder = 3; caidas.name = 'caidas'; escena.add(caidas);
  A.agregarLuz(0, .9, 0, '#7FD6E6', .7, 6);
  circulo(0, 0, 3.15);
  R.agua = [mAgua, mAgua2];

  /* jardines: sardineles redondeados y flores */
  var bordes = [];
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (e) {
    var sh = new THREE.Shape(), ho = new THREE.Path(), cx = e[0] * 10.5, cz = e[1] * 10.5;
    function rr(path, h, r) { path.moveTo(cx - h + r, cz - h); path.lineTo(cx + h - r, cz - h); path.quadraticCurveTo(cx + h, cz - h, cx + h, cz - h + r); path.lineTo(cx + h, cz + h - r); path.quadraticCurveTo(cx + h, cz + h, cx + h - r, cz + h); path.lineTo(cx - h + r, cz + h); path.quadraticCurveTo(cx - h, cz + h, cx - h, cz + h - r); path.lineTo(cx - h, cz - h + r); path.quadraticCurveTo(cx - h, cz - h, cx - h + r, cz - h); }
    rr(sh, 4.08, 1.5); rr(ho, 3.85, 1.3); sh.holes.push(ho);
    bordes.push(new THREE.ExtrudeGeometry(sh, { depth: .14, bevelEnabled: false, curveSegments: 6 }).rotateX(Math.PI / 2).translate(0, .14, 0));
  });
  var mBorde = new THREE.MeshLambertMaterial({ color: '#A8A196' });
  escena.add(new THREE.Mesh(A.unir(bordes), mBorde));
  /* flores: matas pintadas sobre dos planos cruzados (de cerca se ven hojas y flores; de lejos,
     una mancha con volumen), en hileras junto al sardinel de cada jardín */
  var lugares = [], rnd = A.azar(55);
  for (var i2 = 0; i2 < aj.flores; i2++) {
    var e2 = [[1, 1], [-1, 1], [1, -1], [-1, -1]][i2 % 4], t = rnd(), lado = (rnd() * 4) | 0, d0 = 3.4 - rnd() * .45, u = (t * 2 - 1) * 2.7;
    var lx = lado < 2 ? u : (lado === 2 ? d0 : -d0), lz = lado === 0 ? d0 : lado === 1 ? -d0 : u;
    lugares.push([e2[0] * 10.5 + lx, e2[1] * 10.5 + lz]);
  }
  var gMata = A.unir([new THREE.PlaneGeometry(.9, .62).translate(0, .3, 0), new THREE.PlaneGeometry(.9, .62).rotateY(Math.PI / 2).translate(0, .3, 0)]);
  var mMat = new THREE.MeshLambertMaterial({ map: A.texMata(), alphaTest: .45, side: THREE.DoubleSide }); A.alfaNitida(mMat, 256, 192);
  var matas = new THREE.InstancedMesh(gMata, mMat, lugares.length), cc = new THREE.Color();
  lugares.forEach(function (l, i) {
    var e = .75 + rnd() * .5; p.set(l[0], 0, l[1]); eu.set(0, rnd() * 6, 0); q.setFromEuler(eu); s.set(e, e * (.85 + rnd() * .3), e); m4.compose(p, q, s);
    matas.setMatrixAt(i, m4);
  });
  s.set(1, 1, 1);
  escena.add(matas);

  /* palmeras: tronco curvo con anillos, penacho de hojas instanciadas y foquitos en espiral */
  var troncos = [], hojas = [], tH = texHoja();
  A.PALMERAS.forEach(function (pa, k) {
    var H = pa[2], inc = .35 + k * .1, dir = pa[3];
    var cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(dir) * inc * .2, H * .35, Math.sin(dir) * inc * .2), new THREE.Vector3(Math.cos(dir) * inc * .6, H * .7, Math.sin(dir) * inc * .6), new THREE.Vector3(Math.cos(dir) * inc, H, Math.sin(dir) * inc)]);
    var pos = [], uv = [], idx = [], RS = 10, NS = 28;
    for (var i = 0; i <= NS; i++) {
      var tt = i / NS, c = cur.getPoint(tt), r = .3 - .1 * tt + .14 * Math.exp(-tt * 18);
      for (var j = 0; j <= RS; j++) { var an = j / RS * Math.PI * 2; pos.push(pa[0] + c.x + Math.cos(an) * r, c.y, pa[1] + c.z + Math.sin(an) * r); uv.push(j / RS, tt * H * .9); }
    }
    for (i = 0; i < NS; i++) for (var j2 = 0; j2 < RS; j2++) { var a0 = i * (RS + 1) + j2, b0 = a0 + RS + 1; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
    var gt = new THREE.BufferGeometry(); gt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gt.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gt.setIndex(idx); gt.computeVertexNormals();
    troncos.push(gt);
    var top = cur.getPoint(1); top.x += pa[0]; top.z += pa[1];
    var NH = 17;
    for (var h = 0; h < NH; h++) hojas.push({ x: top.x, y: top.y, z: top.z, giro: h / NH * Math.PI * 2 + k, alza: (h % 3 === 0 ? .55 : h % 3 === 1 ? .15 : -.25) + (rnd() - .5) * .2, e: .85 + rnd() * .3, seca: h % 7 === 3 });
    /* foquitos en espiral por el tronco: cada palmera con sus colores */
    var COLP = [[[1, .9, .7], [1, .25, .2]], [[.35, .55, 1], [1, .95, .85]], [[.3, 1, .4], [1, .75, .25]], null][k];
    var vueltas = 8.5, NB = Math.round(H * 13);
    for (var b = 0; b < NB; b++) {
      var tb = b / NB, hb = .5 + tb * (H * .78), c2 = cur.getPoint(hb / H), rb = .3 - .1 * (hb / H) + .14 * Math.exp(-(hb / H) * 18) + .03, ab = tb * Math.PI * 2 * vueltas;
      F.agregar(pa[0] + c2.x + Math.cos(ab) * rb, hb, pa[1] + c2.z + Math.sin(ab) * rb, 1, COLP ? COLP[b % 2] : null);
    }
    circulo(pa[0], pa[1], .45); sombra(pa[0] + Math.cos(dir) * .3, pa[1] + Math.sin(dir) * .3, 2.6, 2.6);
  });
  var mTr = new THREE.MeshLambertMaterial({ map: texTronco() });
  escena.add(new THREE.Mesh(A.unir(troncos), mTr));
  var gH = geoHoja(), mH = new THREE.MeshLambertMaterial({ map: tH, alphaTest: .5, side: THREE.DoubleSide, color: '#ffffff' });
  A.alfaNitida(mH, 512, 128);
  var penachos = new THREE.InstancedMesh(gH, mH, hojas.length);
  hojas.forEach(function (h, i) { p.set(h.x, h.y - .1, h.z); eu.set(0, h.giro, h.alza, 'YXZ'); q.setFromEuler(eu); s.set(h.e, h.e, h.e); m4.compose(p, q, s); penachos.setMatrixAt(i, m4); penachos.setColorAt(i, cc.set(h.seca ? '#B8A060' : (i % 2 ? '#FFFFFF' : '#E4F0D8'))); });
  s.set(1, 1, 1);
  escena.add(penachos);

  /* macetas de barro con geranios */
  A.MACETAS = [[6.95, -5.25], [-6.95, 5.25], [-6.95, -5.25], [6.95, 5.25]];
  var pm = [new THREE.Vector2(0, 0), new THREE.Vector2(.26, 0), new THREE.Vector2(.36, .5), new THREE.Vector2(.42, .52), new THREE.Vector2(.42, .6), new THREE.Vector2(.36, .6), new THREE.Vector2(.34, .55)];
  var gMac = A.unir([A.pintar(new THREE.LatheGeometry(pm, 16), '#A9542E'), A.pintar(new THREE.CircleGeometry(.35, 12).rotateX(-Math.PI / 2).translate(0, .54, 0), '#3A2A1E'),
    A.pintar(new THREE.IcosahedronGeometry(.32, 1).scale(1, .7, 1).translate(0, .78, 0), '#2F5A2A'), A.pintar(new THREE.IcosahedronGeometry(.07, 0).translate(.12, 1.0, .05), '#D8243A'), A.pintar(new THREE.IcosahedronGeometry(.07, 0).translate(-.1, .98, -.08), '#E8384F'), A.pintar(new THREE.IcosahedronGeometry(.065, 0).translate(.0, 1.02, .14), '#D8243A'), A.pintar(new THREE.IcosahedronGeometry(.065, 0).translate(-.14, .95, .12), '#F06A9A')]);
  var macetas = new THREE.InstancedMesh(gMac, new THREE.MeshLambertMaterial({ vertexColors: true }), A.MACETAS.length);
  A.MACETAS.forEach(function (m, i) { p.set(m[0], 0, m[1]); eu.set(0, i * 1.7, 0); q.setFromEuler(eu); m4.compose(p, q, s); macetas.setMatrixAt(i, m4); circulo(m[0], m[1], .45); sombra(m[0], m[1], 1.1, 1.1); });
  escena.add(macetas);

  /* la escalinata de la casona del reloj */
  var esc = [];
  for (var e3 = 0; e3 < 3; e3++) esc.push(new THREE.BoxGeometry(4.6 - e3 * .3, .15 * (e3 + 1), .42).translate(0, .075 * (e3 + 1), -P.fachada + 1.26 - e3 * .42));
  escena.add(new THREE.Mesh(A.unir(esc), new THREE.MeshLambertMaterial({ map: texPiedra('#C9C0B0', false, 9) })));
  caja(0, -P.fachada + .63, 2.3, .63);

  /* sombras de contacto (una malla para todas) */
  var mS = new THREE.MeshBasicMaterial({ map: A.texSombra(), color: '#000000', transparent: true, depthWrite: false, opacity: .85 });
  var sombraM = new THREE.Mesh(A.unir(sombras), mS); sombraM.renderOrder = 1; escena.add(sombraM);
  R.mSombra = mS;
  return R;
};

/* un conjunto de resplandores grandes (farolas, vidrios iluminados): puntos aditivos */
A.armarResplandores = function (escena, lista) {
  var pos = [], tam = [];
  lista.forEach(function (r) { pos.push(r[0], r[1], r[2]); tam.push(r[3]); });
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('tam', new THREE.Float32BufferAttribute(tam, 1));
  var m = new THREE.ShaderMaterial({
    uniforms: { uPr: { value: 1 }, uAlto: { value: 800 }, uCol: { value: new THREE.Color('#FFB35E') }, uT: A.U.uT },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float tam; uniform float uPr, uAlto, uT; varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vF = .93 + .07 * sin(uT * 13.0 + position.x * 3.0) * sin(uT * 7.3 + position.z); gl_PointSize = max(3.0, tam * uAlto * .9 / -mv.z) * uPr; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; varying float vF; void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c); float a = (exp(-r2 * 26.0) * .55 + exp(-r2 * 7.0) * .16) * (1.0 - smoothstep(.16, .25, r2)) + exp(-r2 * 180.0) * .9; gl_FragColor = vec4(uCol * a * vF, 1.0); }'
  });
  var pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; escena.add(pts);
  return { puntos: pts, medir: function (pr, alto) { m.uniforms.uPr.value = pr; m.uniforms.uAlto.value = alto; } };
};
})();

;
/* El árbol que se enciende — prototipo.
   arbol.js: el pino de la plaza y sus adornos, y las esferas de cristal con las fotos.

   EL PINO. Ramas "de verdad": cada rama es una tarjeta curva (cae hacia la punta y se pliega
   en V) con una ramita pintada en un lienzo (tallo, ramitas laterales, cientos de agujas con
   la punta más clara). Se reparten en verticilos de abajo arriba, más cortas y más alzadas
   arriba, todas en UNA malla instanciada (una llamada de dibujo). El shader oscurece hacia el
   tronco (oclusión), toma la luz de la plaza y, cuando una sección se enciende, las agujas
   alrededor brillan del color de sus foquitos.

   SECCIONES. El árbol se divide en tantas franjas como fotos tenga el regalo (de abajo arriba).
   Cada esfera que vuelve enciende la suya: sus foquitos, el brillo de sus agujas y su esfera.
   Sin fotos, una sola franja (la enciende la estrella).

   LAS ESFERAS. Cristal con reflejo (cubemap de la plaza) y, adentro, la foto en un medallón
   con borde dorado que siempre mira a la cámara. Todas las fotos van en un atlas (un lienzo de
   1024): así las ocho esferas son tres llamadas de dibujo (medallones, cristales, tapitas). */
(function () {
'use strict';
var A = window.Arbol, P = A.PLAZA;
var C = P.arbol;                               /* centro del pie del árbol */
var Y0 = .95, Y1 = 7.15, RB = 2.45;            /* primera rama, punta y radio de abajo */
function radio(y) { return RB * Math.pow(Math.max(0, (Y1 + .25 - y) / (Y1 + .25 - Y0)), 1.04) + .05; }
A.ARBOL = { C: C, Y0: Y0, Y1: Y1, RB: RB, radio: radio };

/* ---------- la ramita pintada ---------- */
function texAgujas() {
  /* Una rama de pino vista desde arriba: tallo fino, ramitas alternadas y una mata densa de
     agujas cortas (las de adentro más oscuras, las puntas más claras). El tallo casi no se ve:
     las agujas lo tapan, como en un pino de verdad. */
  var W = 512, H = 256, c = A.lienzo(W, H), x = c.getContext('2d'), rnd = A.azar(101);
  x.clearRect(0, 0, W, H); x.lineCap = 'round';
  var OSC = ['#0F2A17', '#13311B', '#163A20', '#112E19'], MED = ['#1B4426', '#1F4C2A', '#22532E', '#1A4024'], CLA = ['#2E6235', '#36703C', '#3F7A40'];
  function aguja(px, py, ang, largo, cols, ancho) {
    x.strokeStyle = cols[(rnd() * cols.length) | 0]; x.lineWidth = ancho;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * largo, py + Math.sin(ang) * largo); x.stroke();
  }
  function ramita(x0, y0, ang, largo) {
    x.strokeStyle = '#2A2016'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(ang) * largo, y0 + Math.sin(ang) * largo); x.stroke();
    var pasos = Math.max(8, Math.round(largo / 2.6));
    for (var i = 0; i <= pasos; i++) {
      var t = i / pasos, px = x0 + Math.cos(ang) * largo * t, py = y0 + Math.sin(ang) * largo * t;
      var lg = (10 + rnd() * 6) * (1 - t * .4);
      for (var l = -1; l <= 1; l += 2) {
        aguja(px, py, ang + l * (.95 + rnd() * .5), lg * (.8 + rnd() * .4), t > .72 ? CLA : (rnd() < .5 ? MED : OSC), 1.9 + rnd() * .8);
      }
    }
  }
  /* primero una sombra de agujas oscuras a lo largo (da cuerpo), luego las ramitas */
  for (var i = 0; i < 900; i++) { var u = rnd() * 500, v = 128 + (rnd() - .5) * 150 * Math.sin(Math.min(1, (u + 30) / 300) * Math.PI / 2) * (1 - u / 700); aguja(u, v, rnd() * 6.28, 7 + rnd() * 6, OSC, 2.2); }
  for (var k = 0; k < 14; k++) {
    var u2 = 18 + k * 34, lado = k % 2 ? 1 : -1, lar = (112 - k * 5.5) * (.85 + rnd() * .3);
    ramita(u2, 128 + (rnd() - .5) * 6, lado * (.55 + rnd() * .2), lar);
  }
  ramita(0, 128, 0, 500);
  var t = A.texDe(c, true, false); t.anisotropy = 4; return t;
}
function geoRama() {
  /* Dos tarjetas cruzadas a lo largo de +x (0 → 1): una casi horizontal, que cae hacia la punta y
     se pliega en V, y otra vertical más angosta. Así la rama tiene cuerpo desde cualquier lado
     (una sola tarjeta, vista de canto, era una raya). */
  var S = 7, pos = [], uv = [], idx = [], base;
  function tira(vertical) {
    base = pos.length / 3;
    for (var i = 0; i <= S; i++) {
      var x = i / S, w = .5 * (.42 + .58 * Math.sin(Math.min(1, x * 1.25) * Math.PI / 2)), y = .06 * x - .2 * x * x;
      [-1, 0, 1].forEach(function (l, j) {
        if (vertical) pos.push(x, y + l * w * .62, 0);
        else pos.push(x, y - Math.abs(l) * .07 * (.4 + x), l * w);
        uv.push(x, j / 2);
      });
    }
    for (i = 0; i < S; i++) for (var j = 0; j < 2; j++) { var a = base + i * 3 + j, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  tira(false); tira(true);
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* GLSL de las secciones: cuánto está encendida la altura y (0 abajo, 1 arriba) */
var GLSL_SECCIONES = [
  'uniform float uSec[8]; uniform float uNSec; uniform float uTodo;',
  'float encendido(float hN){',
  '  float on = 0.0;',
  '  for (int i = 0; i < 8; i++) {',
  '    float fi = float(i); if (fi >= uNSec) break;',
  '    float a = fi / uNSec, b = (fi + 1.0) / uNSec;',
  '    on += uSec[i] * smoothstep(a - .06, a + .02, hN) * (1.0 - smoothstep(b - .02, b + .06, hN));',
  '  }',
  '  return clamp(max(on, uTodo), 0.0, 1.0);',
  '}'
].join('\n');

function matRamas(tex, aj) {
  var m = new THREE.ShaderMaterial({
    uniforms: A.unif({ uAgujas: { value: tex }, uSec: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, uNSec: { value: 1 }, uTodo: { value: 0 }, uC: { value: C }, uY0: { value: Y0 }, uY1: { value: Y1 }, uViento: { value: A.reducido ? 0 : 1 } }),
    side: THREE.DoubleSide, extensions: { derivatives: true }, defines: aj.aa ? { A2C: 1 } : {},
    vertexShader: [
      'uniform float uT, uViento;',
      'varying vec2 vUv; varying vec3 vPos; varying vec3 vN; varying vec3 vTinte;',
      'void main(){',
      '  vUv = uv; vTinte = instanceColor;',
      '  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);',
      /* la brisa: las puntas se mecen un poquito */
      '  float s = uv.x * uv.x * uViento; wp.xyz += vec3(sin(uT * 1.3 + wp.y * 1.7 + wp.x), sin(uT * 1.9 + wp.z * 2.1) * .6, cos(uT * 1.1 + wp.z * 1.3)) * .022 * s;',
      '  vPos = wp.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * wp;',
      '}'
    ].join('\n'),
    fragmentShader: A.GLSL_LUZ + '\n' + GLSL_SECCIONES + [
      '',
      'uniform sampler2D uAgujas; uniform vec3 uC; uniform float uY0, uY1;',
      'varying vec2 vUv; varying vec3 vPos; varying vec3 vN; varying vec3 vTinte;',
      'float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'void main(){',
      '  vec4 t = texture2D(uAgujas, vUv);',
      /* recorte nítido (y más alfa a lo lejos, para que el árbol no se vuelva ralo) */
      '  vec2 dx = dFdx(vUv * vec2(512.0, 256.0)), dy = dFdy(vUv * vec2(512.0, 256.0));',
      '  float lod = max(0.0, .5 * log2(max(dot(dx, dx), dot(dy, dy))));',
      '  float a = t.a * (1.0 + lod * .35);',
      '#ifdef A2C',
      '  a = clamp((a - .5) / max(fwidth(a), 1e-4) + .5, 0.0, 1.0); if (a < .02) discard;',
      '#else',
      '  if (a < .5) discard;',
      '#endif',
      '  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;',
      /* las agujas apuntan a todos lados: la normal se inclina hacia afuera del árbol */
      '  vec3 afuera = normalize(vec3(vPos.x - uC.x, .45, vPos.z - uC.z));',
      '  n = normalize(mix(n, afuera, .62));',
      '  float hN = clamp((vPos.y - uY0) / (uY1 - uY0), 0.0, 1.0);',
      '  float ao = mix(.22, 1.0, smoothstep(.0, .8, vUv.x)) * (.75 + .25 * hN);',
      '  vec3 alb = t.rgb * vTinte;',
      '  vec3 c = alb * luzPlaza(vPos, n, .5) * ao * .75;',
      /* las secciones encendidas: las agujas toman la luz de sus foquitos (manchas de color) */
      '  float on = encendido(hN);',
      '  if (on > .001) {',
      '    vec3 q = floor(vPos * 2.6); float h = h3(q), h2 = fract(h * 13.7);',
      '    vec3 colF = h < .22 ? vec3(1.0, .3, .2) : (h < .4 ? vec3(.35, 1.0, .45) : (h < .56 ? vec3(.4, .55, 1.0) : (h < .7 ? vec3(1.0, .5, .85) : vec3(1.0, .78, .42))));',
      '    vec3 f = fract(vPos * 2.6) - .5; float cerca = exp(-dot(f, f) * 20.0) * step(h, .6);',
      '    float titila = .75 + .25 * sin(uT * (2.0 + h2 * 3.0) + h * 30.0);',
      '    c += alb * (colF * cerca * 2.4 + vec3(1.0, .7, .4) * .1) * on * ao * titila + colF * cerca * cerca * .012 * on;',
      '  }',
      '#ifdef A2C',
      '  gl_FragColor = vec4(c, a);',
      '#else',
      '  gl_FragColor = vec4(c, 1.0);',
      '#endif',
      '#include <tonemapping_fragment>',
      '#include <encodings_fragment>',
      '}'
    ].join('\n')
  });
  m.alphaToCoverage = !!aj.aa;
  return m;
}

/* ---------- foquitos del árbol (por secciones) ---------- */
function matFoquitos() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: A.U.uT, uSec: { value: [0, 0, 0, 0, 0, 0, 0, 0] }, uNSec: { value: 1 }, uTodo: { value: 0 }, uFiesta: A.U.uFiesta, uPr: { value: 1 }, uAlto: { value: 800 }, uY0: { value: Y0 }, uY1: { value: Y1 }, uTw: { value: A.reducido ? .3 : 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: GLSL_SECCIONES + [
      '',
      'attribute float fase; uniform float uT, uFiesta, uPr, uAlto, uY0, uY1, uTw; varying vec3 vC; varying float vOn;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  float hN = clamp((position.y - uY0) / (uY1 - uY0), 0.0, 1.0);',
      '  float on = encendido(hN);',
      '  float tw = 1.0 - uTw * .35 * (.5 + .5 * sin(uT * (1.5 + fract(fase * 3.1) * 2.0) + fase * 6.0));',
      /* al final: olas de luz que suben por el árbol */
      '  float ola = .55 + .45 * sin(hN * 12.0 - uT * 4.0 + fase * .3);',
      '  tw = mix(tw, ola * 1.25, uFiesta * uTw * .6);',
      '  vOn = on; vC = mix(vec3(.05, .05, .045), color * tw * 1.15, on);',
      '  gl_PointSize = max(2.0, (.11 + .26 * on) * uAlto * .9 / -mv.z) * uPr;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: 'varying vec3 vC; varying float vOn; void main(){ vec2 c = gl_PointCoord - .5; float r2 = dot(c, c); float a = exp(-r2 * 70.0) * 1.5 + exp(-r2 * 10.0) * .36 * vOn; a *= 1.0 - smoothstep(.2, .25, r2); gl_FragColor = vec4((vC + vec3(.4) * exp(-r2 * 220.0) * vOn) * a, 1.0); }'
  });
}

/* ---------- texturas de los adornos ---------- */
function texRegalo(fondo, dibujo, cinta) {
  var c = A.lienzo(128, 128), x = c.getContext('2d'), rnd = A.azar(fondo.length * 7);
  x.fillStyle = fondo; x.fillRect(0, 0, 128, 128);
  x.fillStyle = dibujo;
  for (var i = 0; i < 14; i++) { var px = rnd() * 128, py = rnd() * 128; x.beginPath(); for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.5 : 6; x.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); } x.fill(); }
  x.fillStyle = cinta; x.fillRect(56, 0, 16, 128); x.fillRect(0, 56, 128, 16);
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(58, 0, 3, 128); x.fillRect(0, 58, 128, 3);
  return A.texDe(c, true, false);
}
function texPascua() {
  /* flor de Pascua: brácteas rojas en estrella sobre hojas verdes */
  var c = A.lienzo(256, 192), x = c.getContext('2d'), rnd = A.azar(141);
  x.clearRect(0, 0, 256, 192);
  for (var i = 0; i < 26; i++) { var a = rnd() * 6.3, px = 128 + Math.cos(a) * 60 * rnd(), py = 120 + Math.sin(a) * 40 * rnd(); x.fillStyle = ['#1F4A22', '#2A5C2A'][i % 2]; x.beginPath(); x.ellipse(px, py, 26, 10, a, 0, 6.3); x.fill(); }
  [[90, 90], [160, 84], [126, 62], [118, 112]].forEach(function (f) {
    for (var k = 0; k < 8; k++) { var b = k / 8 * 6.283 + rnd() * .3, l = 26 + rnd() * 10; x.fillStyle = k % 2 ? '#C8102E' : '#E0243E'; x.beginPath(); x.ellipse(f[0] + Math.cos(b) * l * .5, f[1] + Math.sin(b) * l * .5 * .7, l * .5, l * .2, b, 0, 6.3); x.fill(); }
    x.fillStyle = '#F2C94C'; for (k = 0; k < 5; k++) { x.beginPath(); x.arc(f[0] + (rnd() - .5) * 6, f[1] + (rnd() - .5) * 5, 2.2, 0, 6.3); x.fill(); }
  });
  return A.texDe(c, true, false);
}
function texCorteza() {
  var c = A.lienzo(64, 256), x = c.getContext('2d'), rnd = A.azar(151);
  x.fillStyle = '#3E2A1C'; x.fillRect(0, 0, 64, 256);
  for (var i = 0; i < 90; i++) { x.fillStyle = 'rgba(' + (rnd() < .5 ? '20,12,6' : '90,64,44') + ',.5)'; x.fillRect(rnd() * 64, rnd() * 256, 2 + rnd() * 3, 10 + rnd() * 30); }
  return A.texDe(c, true, true);
}

/* ---------- el árbol ---------- */
A.armarArbol = function (escena, aj, env) {
  var g = new THREE.Group(); g.position.copy(C); escena.add(g);
  var R = { grupo: g };
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color();
  var rnd = A.azar(303);

  /* jardinera de piedra con tierra */
  var piedra = new THREE.MeshLambertMaterial({ color: '#8A8278' });
  var forma = new THREE.Shape(), hueco = new THREE.Path(); forma.absarc(0, 0, 2.78, 0, Math.PI * 2, false); hueco.absarc(0, 0, 2.5, 0, Math.PI * 2, true); forma.holes.push(hueco);
  g.add(new THREE.Mesh(A.unir([new THREE.ExtrudeGeometry(forma, { depth: .46, bevelEnabled: true, bevelThickness: .03, bevelSize: .04, bevelSegments: 2, curveSegments: 40 }).rotateX(-Math.PI / 2)]), piedra));
  var tierra = new THREE.Mesh(new THREE.CircleGeometry(2.52, 40).rotateX(-Math.PI / 2).translate(0, .4, 0), new THREE.MeshLambertMaterial({ color: '#21160E' }));
  g.add(tierra);
  /* tronco */
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.11, .26, Y1 - .2, 10).translate(0, (Y1 - .2) / 2 + .35, 0), new THREE.MeshLambertMaterial({ map: texCorteza() })));
  /* el relleno oscuro de adentro (que no se vea a través) */
  var rel = new THREE.Mesh(new THREE.ConeGeometry(RB * .78, Y1 - Y0 + .2, 20, 1, true).translate(0, (Y1 + Y0) / 2 + .05, 0), new THREE.MeshLambertMaterial({ color: '#0B1D10' }));
  g.add(rel);

  /* las ramas */
  var sep = aj.detalle >= 2 ? .42 : aj.detalle >= 1 ? .5 : .62, capas = Math.max(10, Math.round(aj.ramas * sep / 7.66)), dy = (Y1 - .25 - Y0) / capas;
  var lista = [];
  for (var c = 0; c <= capas; c++) {
    var y = Y0 + c * dy, r = radio(y), n = Math.max(4, Math.round(2 * Math.PI * r / sep)), off = rnd() * 6.3;
    var arriba = (y - Y0) / (Y1 - Y0);
    for (var k = 0; k < n; k++) {
      var th = off + k / n * Math.PI * 2 + (rnd() - .5) * .25;
      var largo = r * (1.0 + rnd() * .14) + .18, ancho = Math.pow(largo, .55) * (aj.detalle >= 1 ? 1 : 1.25) * (.85 + rnd() * .3);
      var alza = -.08 + arriba * .5 + (rnd() - .5) * .18;
      lista.push({ y: y + (rnd() - .5) * dy * .6, th: th, largo: largo, ancho: ancho, alza: alza, giro: (rnd() - .5) * .5 });
    }
  }
  /* la punta: unas ramitas paradas */
  for (k = 0; k < 6; k++) lista.push({ y: Y1 - .35, th: k / 6 * 6.28, largo: .55, ancho: .45, alza: 1.1, giro: 0 });
  var mR = matRamas(texAgujas(), aj);
  var ramas = new THREE.InstancedMesh(geoRama(), mR, lista.length);
  lista.forEach(function (b, i) {
    p.set(Math.cos(b.th) * .12, b.y, -Math.sin(b.th) * .12);
    eu.set(b.giro, b.th, b.alza, 'YZX'); q.setFromEuler(eu); s.set(b.largo, 1, b.ancho); m4.compose(p, q, s);
    ramas.setMatrixAt(i, m4);
    var v = .62 + rnd() * .3; col.setRGB(v * (.9 + rnd() * .1), v, v * (.88 + rnd() * .15)); ramas.setColorAt(i, col);
  });
  g.add(ramas);
  R.ramas = ramas; R.mat = mR;

  /* foquitos: cuerdas en espiral (8 vueltas) apenas adentro de las puntas */
  var NL = aj.foquitos, fp = [], fc = [], ff = [];
  var COLS = [[1, .3, .2], [.35, 1, .4], [.38, .55, 1], [1, .78, .4], [1, .45, .85], [1, .92, .75], [1, .78, .4]];
  for (var i = 0; i < NL; i++) {
    var t = i / NL, yy = Y0 + .15 + t * (Y1 - Y0 - .35), an = t * Math.PI * 2 * 9 + Math.sin(i * 7.1) * .12, rr = radio(yy) * (.86 + (rnd() - .5) * .12);
    fp.push(Math.cos(an) * rr, yy + (rnd() - .5) * .12, Math.sin(an) * rr);
    var k3 = COLS[i % COLS.length]; fc.push(k3[0], k3[1], k3[2]); ff.push(rnd() * 6.283);
  }
  var gF = new THREE.BufferGeometry();
  gF.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); gF.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3)); gF.setAttribute('fase', new THREE.Float32BufferAttribute(ff, 1));
  var mF = matFoquitos(); var foq = new THREE.Points(gF, mF); foq.frustumCulled = false; foq.renderOrder = 4; g.add(foq);
  R.mFoq = mF;

  /* guirnaldas de cuentas doradas: dos, que cuelgan en festones */
  var cuentas = [], NC = aj.cuentas;
  for (var gi = 0; gi < 2; gi++) {
    for (var j = 0; j < NC / 2; j++) {
      var u = j / (NC / 2), y2 = Y0 + .35 + u * (Y1 - Y0 - 1.0) + gi * .5, a2 = u * Math.PI * 2 * 3.3 + gi * Math.PI;
      var fest = Math.abs(Math.sin(a2 * 3.0)) * .22;           /* la comba entre gancho y gancho */
      var r2 = radio(y2 - fest) * .97 + .04;
      cuentas.push([Math.cos(a2) * r2, y2 - fest, Math.sin(a2) * r2]);
    }
  }
  var mC = new THREE.MeshLambertMaterial({ color: '#F0C25E', emissive: '#1E1204', envMap: env, reflectivity: .85, combine: THREE.MixOperation });
  var gCu = new THREE.SphereGeometry(.034, 8, 6);
  var cu = new THREE.InstancedMesh(gCu, mC, cuentas.length);
  cuentas.forEach(function (c2, i) { p.set(c2[0], c2[1], c2[2]); m4.compose(p, q.identity(), s.set(1, 1, 1)); cu.setMatrixAt(i, m4); });
  g.add(cu); R.mCuentas = mC;

  /* bolitas chicas de colores (con tapita) */
  var bol = [], NB = aj.bolitas, BCOL = ['#B0122A', '#D9A93A', '#C9CDD6', '#1E3F8C', '#C8486E', '#B0122A', '#D9A93A'];
  for (i = 0; i < NB; i++) {
    var y3 = Y0 + .3 + Math.pow(rnd(), .85) * (Y1 - Y0 - .9), a3 = rnd() * Math.PI * 2, r3 = radio(y3) * .95 + .02;
    bol.push({ x: Math.cos(a3) * r3, y: y3 - .08, z: Math.sin(a3) * r3, c: BCOL[i % BCOL.length], e: .8 + rnd() * .45 });
  }
  var mB = new THREE.MeshLambertMaterial({ color: '#ffffff', envMap: env, reflectivity: .55, combine: THREE.MixOperation });
  var bo = new THREE.InstancedMesh(new THREE.SphereGeometry(.085, 14, 10), mB, bol.length);
  var tap = new THREE.InstancedMesh(new THREE.CylinderGeometry(.022, .022, .035, 8).translate(0, .095, 0), new THREE.MeshLambertMaterial({ color: '#C9A24A', envMap: env, reflectivity: .6, combine: THREE.MixOperation }), bol.length);
  bol.forEach(function (b, i) { p.set(b.x, b.y, b.z); s.set(b.e, b.e, b.e); m4.compose(p, q.identity(), s); bo.setMatrixAt(i, m4); tap.setMatrixAt(i, m4); bo.setColorAt(i, col.set(b.c)); });
  g.add(bo); g.add(tap);

  /* lazos rojos de terciopelo */
  var piezasLazo = [new THREE.TorusGeometry(.07, .028, 6, 14).scale(1, .65, .5).translate(-.075, 0, 0), new THREE.TorusGeometry(.07, .028, 6, 14).scale(1, .65, .5).translate(.075, 0, 0), new THREE.SphereGeometry(.035, 8, 6),
    new THREE.BoxGeometry(.035, .16, .01).rotateZ(.35).translate(-.04, -.09, 0), new THREE.BoxGeometry(.035, .16, .01).rotateZ(-.35).translate(.04, -.09, 0)];
  var lazos = new THREE.InstancedMesh(A.unir(piezasLazo), new THREE.MeshLambertMaterial({ color: '#9E1024', emissive: '#2A0408' }), 14);
  for (i = 0; i < 14; i++) { var y4 = Y0 + .6 + (i / 14) * (Y1 - Y0 - 1.3) + (rnd() - .5) * .3, a4 = i * 2.4 + rnd(), r4 = radio(y4) * .96 + .05; p.set(Math.cos(a4) * r4, y4, Math.sin(a4) * r4); eu.set(0, -a4 + Math.PI / 2, 0); q.setFromEuler(eu); m4.compose(p, q, s.set(1.3, 1.3, 1.3)); lazos.setMatrixAt(i, m4); }
  g.add(lazos);

  /* flores de Pascua alrededor del pie y regalos */
  var gP = A.unir([new THREE.PlaneGeometry(.75, .56).translate(0, .28, 0), new THREE.PlaneGeometry(.75, .56).rotateY(Math.PI / 2).translate(0, .28, 0)]);
  var mP = new THREE.MeshLambertMaterial({ map: texPascua(), alphaTest: .45, side: THREE.DoubleSide }); A.alfaNitida(mP, 256, 192);
  var NP = 20, pascua = new THREE.InstancedMesh(gP, mP, NP);
  for (i = 0; i < NP; i++) { var a5 = i / NP * Math.PI * 2; p.set(Math.cos(a5) * 2.2, .38, Math.sin(a5) * 2.2); eu.set(0, rnd() * 6, 0); q.setFromEuler(eu); var e5 = .85 + rnd() * .3; m4.compose(p, q, s.set(e5, e5, e5)); pascua.setMatrixAt(i, m4); }
  g.add(pascua);
  var REG = [['#1E5E8C', '#F2C94C', '#C8102E', .42, .3, [-.9, 1.55, .4]], ['#B0122A', '#FFFFFF', '#F2C94C', .34, .26, [.75, 1.62, -.3]], ['#2E7D4F', '#F2C94C', '#C8102E', .3, .3, [-.2, 1.75, .9]], ['#F2E6CF', '#C8102E', '#1E6E5A', .38, .24, [1.25, 1.2, .5]], ['#6C3483', '#F2C94C', '#F2C94C', .28, .34, [-1.4, 1.05, -.6]]];
  REG.forEach(function (r5) {
    var tR = texRegalo(r5[0], r5[1], r5[2]), m5 = new THREE.MeshLambertMaterial({ map: tR });
    var caja = new THREE.Mesh(new THREE.BoxGeometry(r5[3], r5[4], r5[3]).translate(0, r5[4] / 2 + .4, 0), m5);
    var dd = r5[5]; caja.position.set(Math.cos(dd[1]) * (1.0 + dd[2] * .2), 0, Math.sin(dd[1]) * (1.0 + dd[2] * .2) + .0); caja.rotation.y = dd[0];
    g.add(caja);
  });

  /* la estrella de la punta (empieza robada: escondida) */
  var forma2 = new THREE.Shape();
  for (i = 0; i < 10; i++) { var a6 = Math.PI / 2 + i * Math.PI / 5, r6 = i % 2 ? .16 : .4; if (i) forma2.lineTo(Math.cos(a6) * r6, Math.sin(a6) * r6); else forma2.moveTo(Math.cos(a6) * r6, Math.sin(a6) * r6); }
  var gE = new THREE.ExtrudeGeometry(forma2, { depth: .07, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 3 }); gE.translate(0, 0, -.055);
  var mE = new THREE.MeshLambertMaterial({ color: '#F2C24A', emissive: '#FFB020', emissiveIntensity: .15, envMap: env, reflectivity: .6, combine: THREE.MixOperation });
  var estrella = new THREE.Group(); var est = new THREE.Mesh(gE, mE); estrella.add(est);
  /* rayos: un plano que mira a la cámara con un shader de rayos que giran */
  var mRay = new THREE.ShaderMaterial({
    uniforms: { uT: A.U.uT, uOn: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * 3.2; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uT, uOn; varying vec2 vUv; void main(){ float r = length(vUv), a = atan(vUv.y, vUv.x); float ray = pow(abs(sin(a * 6.0 + uT * .4)), 18.0) * .7 + pow(abs(sin(a * 9.0 - uT * .3)), 30.0) * .5; float g = exp(-r * r * 9.0) * 1.2 + exp(-r * 4.0) * .35; float k = (g + ray * exp(-r * 2.6) * .8) * uOn * (1.0 - smoothstep(.8, 1.0, r)); gl_FragColor = vec4(vec3(1.0, .82, .5) * k, 1.0); }'
  });
  var rayos = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mRay); rayos.frustumCulled = false; rayos.renderOrder = 6; estrella.add(rayos);
  estrella.visible = false; escena.add(estrella);
  R.estrella = estrella; R.mEstrella = mE; R.mRayos = mRay;
  R.punta = new THREE.Vector3(C.x, C.y + Y1 + .42, C.z);

  /* su luz (crece con lo encendido) y su sombra */
  R.luz = A.agregarLuz(C.x, C.y + 3.2, C.z + 1.6, '#FFC27A', 0, 9); R.luz.on = 0;
  A.colisiones.push({ t: 0, x: C.x, z: C.z, r: 2.86 });

  /* ---------- secciones ---------- */
  var sec = [0, 0, 0, 0, 0, 0, 0, 0], meta = [0, 0, 0, 0, 0, 0, 0, 0], todo = 0, metaTodo = 0, nSec = 1, estOn = 0, metaEst = 0;
  R.secciones = function (n) { nSec = Math.max(1, Math.min(8, n)); [mR, mF].forEach(function (m) { m.uniforms.uNSec.value = nSec; }); };
  R.encender = function (i, k) { if (i >= 0 && i < 8) meta[i] = k === undefined ? 1 : k; };
  R.todo = function (k) { metaTodo = k; };
  R.estrellaOn = function (k) { metaEst = k; };
  R.encendidas = function () { var c2 = 0; for (var i2 = 0; i2 < nSec; i2++) if (meta[i2] > .5) c2++; return c2; };
  /* dónde cuelga la esfera i de n: en el centro de su franja, hacia el frente (+z), alternando lados */
  R.lugar = function (i, n, out) {
    n = Math.max(1, n); var hN = (i + .5) / n, y5 = Y0 + .25 + hN * (Y1 - Y0 - 1.0);
    var lado = n === 1 ? 0 : (i % 2 ? 1 : -1) * (.28 + .5 * ((i * 37) % 7) / 7), an = Math.PI / 2 + lado;
    var r7 = radio(y5) * .98 + .14;
    return (out || new THREE.Vector3()).set(C.x + Math.cos(an) * r7, C.y + y5 - .05, C.z + Math.sin(an) * r7);
  };
  R.lugarGrunon = function (out) { var y6 = 1.95, an = Math.PI / 2 - .55, r8 = radio(y6) * .96 + .1; return (out || new THREE.Vector3()).set(C.x + Math.cos(an) * r8, C.y + y6, C.z + Math.sin(an) * r8); };
  R.medir = function (pr, alto) { mF.uniforms.uPr.value = pr; mF.uniforms.uAlto.value = alto; };
  R.cuadro = function (dt, cam) {
    var k = Math.min(1, dt * 1.6), suma = 0;
    for (var i2 = 0; i2 < 8; i2++) { sec[i2] += (meta[i2] - sec[i2]) * k; suma += i2 < nSec ? sec[i2] : 0; }
    todo += (metaTodo - todo) * Math.min(1, dt * .9);
    estOn += (metaEst - estOn) * Math.min(1, dt * 2);
    mR.uniforms.uSec.value = sec; mF.uniforms.uSec.value = sec;
    mR.uniforms.uTodo.value = todo; mF.uniforms.uTodo.value = todo;
    var cuanto = Math.max(todo, suma / nSec);
    R.luz.on = cuanto; R.luz.i = .4 + .9 * cuanto;
    mE.emissiveIntensity = .15 + 1.6 * estOn; mRay.uniforms.uOn.value = estOn;
    mC.emissiveIntensity = 1 + 3 * cuanto;
    rayos.visible = estOn > .01;
    R.cuanto = cuanto;
  };
  return R;
};

/* ---------- las esferas con las fotos ----------
   fotos: [{img, frase}] ya cargadas (las rotas no llegan aquí). Devuelve una lista de esferas
   {p: posición, on: 0..1 (luz), foto: 0..1 (cuánto se ve la foto), visible, mira} que juego.js
   mueve como quiera; cada cuadro se copian a las mallas instanciadas. */
A.armarEsferas = function (escena, env, fotos) {
  var N = fotos.length, Rr = .3;
  /* el atlas de fotos (3 × 3) */
  var atlas = A.lienzo(1024, 1024), xa = atlas.getContext('2d'), celda = 1024 / 3;
  xa.fillStyle = '#1a1420'; xa.fillRect(0, 0, 1024, 1024);
  function dibujarFoto(i) {
    var f = fotos[i], im = f.img, cx = (i % 3) * celda, cy = Math.floor(i / 3) * celda, w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, l = Math.min(w, h);
    xa.save(); xa.beginPath(); xa.rect(cx, cy, celda, celda); xa.clip();
    try { xa.drawImage(im, (w - l) / 2, (h - l) / 2, l, l, cx, cy, celda, celda); } catch (e) {}
    var v = xa.createRadialGradient(cx + celda / 2, cy + celda / 2, celda * .3, cx + celda / 2, cy + celda / 2, celda * .5);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,0,.35)'); xa.fillStyle = v; xa.fillRect(cx, cy, celda, celda);
    xa.restore();
  }
  for (var i = 0; i < N; i++) dibujarFoto(i);
  var tAtlas = A.texDe(atlas, true, false);
  /* medallón: disco con la foto (uv según su celda) y aro dorado; mira a la cámara */
  var gD = new THREE.CircleGeometry(.215, 32);
  var celdas = new Float32Array(Math.max(1, N) * 2), luzF = new Float32Array(Math.max(1, N));
  for (i = 0; i < N; i++) { celdas[i * 2] = (i % 3) / 3; celdas[i * 2 + 1] = 1 - (Math.floor(i / 3) + 1) / 3; }
  gD.setAttribute('celda', new THREE.InstancedBufferAttribute(celdas, 2));
  gD.setAttribute('luzF', new THREE.InstancedBufferAttribute(luzF, 1));
  var mD = new THREE.ShaderMaterial({
    uniforms: { uFotos: { value: tAtlas } },
    vertexShader: 'attribute vec2 celda; attribute float luzF; varying vec2 vUv; varying float vL; varying float vR; void main(){ vUv = celda + uv / 3.0; vL = luzF; vR = length(position.xy) / .215; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uFotos; varying vec2 vUv; varying float vL; varying float vR; void main(){ vec3 f = texture2D(uFotos, vUv).rgb; vec3 c = f * (.08 + .95 * vL); float aro = smoothstep(.86, .9, vR); c = mix(c, vec3(1.0, .78, .38) * (.25 + .9 * vL), aro); gl_FragColor = vec4(c, 1.0);\n#include <encodings_fragment>\n}'
  });
  var discos = new THREE.InstancedMesh(gD, mD, Math.max(1, N)); discos.frustumCulled = false; escena.add(discos);
  /* el cristal: transparente al centro, reflejo y color en el borde */
  var gV = new THREE.SphereGeometry(Rr, 28, 20);
  var tinte = new Float32Array(Math.max(1, N) * 3), onV = new Float32Array(Math.max(1, N));
  var TINTES = [[1, .25, .3], [.3, .55, 1], [1, .75, .3], [.4, 1, .55], [1, .45, .85], [.6, .45, 1], [1, .55, .25], [.3, .9, 1]];
  for (i = 0; i < N; i++) { var tt = TINTES[i % 8]; tinte[i * 3] = tt[0]; tinte[i * 3 + 1] = tt[1]; tinte[i * 3 + 2] = tt[2]; }
  gV.setAttribute('tinte', new THREE.InstancedBufferAttribute(tinte, 3));
  gV.setAttribute('on', new THREE.InstancedBufferAttribute(onV, 1));
  var mV = new THREE.ShaderMaterial({
    uniforms: A.unif({ uEnv: { value: env } }), transparent: true, depthWrite: false,
    vertexShader: 'attribute vec3 tinte; attribute float on; varying vec3 vN; varying vec3 vPos; varying vec3 vT; varying float vOn; void main(){ vT = tinte; vOn = on; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vPos = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: A.GLSL_LUZ + '\nuniform samplerCube uEnv; varying vec3 vN; varying vec3 vPos; varying vec3 vT; varying float vOn;\nvoid main(){ vec3 V = normalize(vPos - cameraPosition); vec3 n = normalize(vN); float nv = max(dot(-V, n), 0.0); float f = pow(1.0 - nv, 2.4);\n vec3 refl = textureCube(uEnv, reflect(V, n)).rgb; refl *= refl;\n vec3 c = refl * (.35 + 1.3 * f) + vT * (.05 + .55 * vOn) * (.3 + .7 * f) + brilloPlaza(vPos, n, -V, 160.0) * 1.5;\n float a = clamp(.1 + .85 * f + (1.0 - vOn) * .12, 0.0, 1.0);\n gl_FragColor = vec4(c, a);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'
  });
  var vidrios = new THREE.InstancedMesh(gV, mV, Math.max(1, N)); vidrios.frustumCulled = false; vidrios.renderOrder = 5; escena.add(vidrios);
  var mTapa = new THREE.MeshLambertMaterial({ color: '#C9A24A', envMap: env, reflectivity: .7, combine: THREE.MixOperation });
  var gT = A.unir([new THREE.CylinderGeometry(.06, .07, .07, 12).translate(0, Rr + .02, 0), new THREE.TorusGeometry(.03, .008, 6, 12).translate(0, Rr + .08, 0)]);
  var tapas = new THREE.InstancedMesh(gT, mTapa, Math.max(1, N)); tapas.frustumCulled = false; escena.add(tapas);
  /* el hilito del que cuelga (cuando está en el árbol) */
  var hilos = new THREE.InstancedMesh(new THREE.CylinderGeometry(.006, .006, 1, 4).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: '#E8D6A8' }), Math.max(1, N)); hilos.frustumCulled = false; escena.add(hilos);

  var lista = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), cero = new THREE.Vector3(0, 0, 0), eu = new THREE.Euler();
  for (i = 0; i < N; i++) lista.push({ i: i, p: new THREE.Vector3(0, -50, 0), on: 0, foto: 0, visible: false, hilo: 0, gira: 0, escala: 1 });
  if (!N) { discos.visible = vidrios.visible = tapas.visible = hilos.visible = false; }
  return {
    lista: lista, atlas: tAtlas,
    redibujar: function (i, img) { if (img) fotos[i].img = img; dibujarFoto(i); tAtlas.needsUpdate = true; },
    cuadro: function (dt, cam) {
      for (var k = 0; k < N; k++) {
        var e = lista[k], esc = e.visible ? e.escala : 0;
        /* el medallón mira a la cámara (girando solo en y, como colgado) */
        var mira = Math.atan2(cam.position.x - e.p.x, cam.position.z - e.p.z);
        eu.set(0, mira + e.gira, 0); q.setFromEuler(eu);
        s.set(esc, esc, esc); m4.compose(e.p, q, s); discos.setMatrixAt(k, m4); vidrios.setMatrixAt(k, m4); tapas.setMatrixAt(k, m4);
        p.set(e.p.x, e.p.y + (Rr + .1) * esc, e.p.z); s.set(1, e.hilo * esc, 1); m4.compose(p, q.identity(), s); hilos.setMatrixAt(k, m4);
        luzF[k] = e.foto; onV[k] = e.on;
      }
      discos.instanceMatrix.needsUpdate = true; vidrios.instanceMatrix.needsUpdate = true; tapas.instanceMatrix.needsUpdate = true; hilos.instanceMatrix.needsUpdate = true;
      gD.attributes.luzF.needsUpdate = true; gV.attributes.on.needsUpdate = true;
    }
  };
};
})();

;
/* El árbol que se enciende — grunon.js: Don Gruñón, el muki de la mina. Personaje ORIGINAL.

   Quién es: un muki, el duende de las minas de los Andes del Perú. Vive solo, allá abajo, en la
   oscuridad de la mina. En Nochebuena sale atraído por las luces de la plaza y se lleva lo que
   brilla (las esferas y la estrella), porque brillan como el oro. Al final, con las fotos y un
   chocolate caliente, se ablanda, devuelve la estrella y se queda en el árbol alumbrando con su
   lamparita. Es un personaje del folclor minero, respetado: no es una burla.

   Lo que dicen de él (y de ahí sale cómo se ve):
   - Pequeño, "no más de 60 cm", ancho y musculoso, de cabeza grande y casi sin cuello; voz
     grave; pies muy grandes, que lo hacen andar como pato. Piel pálida, cara rojiza, pelo largo
     y rubio, barba larga y blanca; a veces orejas un poco en punta. Ojos que brillan y reflejan
     la luz como los metales de la mina. Antes: poncho y farol; hoy: casco, ropa de minero,
     botas y linterna. Silba para avisar del peligro a los mineros honrados; le gustan la coca y
     los tratos que se cumplen.
   - Fuentes (consultadas el 19 de octubre de 2026):
       · "Muki (mythology)", Wikipedia (en), que cita a Alfonsina Barrionuevo, "El Muki en el Perú
         minero" (en M. Samamé Boggio, El Perú minero, tomo II) y el Diccionario Kechua-Español
         de Jorge Lira.
       · Jordan Faries, "The mischievous Muki", CIM Magazine (Canadian Institute of Mining), 21
         de setiembre de 2018 (la tradición oral de Cerro de Pasco, Morococha y Casapalca).
       · Carmen Salazar-Soler, "Cuando los diablos moran y abandonan las minas", Fondo Editorial
         de la PUCP, 2013 (el muqui en Huancavelica).
   Cómo es el nuestro (nuestro diseño, no copiado de nadie): un hombrecito robusto de 1 m en la
   plaza (a la escala de Ruway), de cabeza un poco grande, nariz normal, cara pálida con mejillas
   coloradas por el frío, arrugas de viejo y cejas pobladas; ojos color miel con su brillo; pelo
   rubio ceniza largo por la espalda y barba blanca hasta la panza, en mechones sueltos; casco de
   minero gastado con su lamparita encendida (alumbra de verdad), poncho de lana granate tejido
   con franjas y rombos, chuspa de colores para la coca, camisa de lana, pantalón, botas grandes
   de jebe y una picota corta de madera que usa de bastón. Sin cuernos.

   Cómo está hecho:
   - Formas esculpidas por código (superficies paramétricas y tubos) en la pose de reposo, unidas
     en DOS mallas con piel (lo suave y lo duro) sobre UN esqueleto propio de 32 huesos. Los
     mechones de la espalda cuelgan de la cadena "bufanda" y los de los costados de las
     "trenzas": tienen resorte, se quedan atrás al correr y se mecen después.
   - Lo suave (piel, pelo, lana) con un shader propio: piel con arrugas, mejillas y nariz
     coloradas y luz que la atraviesa un poco; pelo con hebras, raíz más oscura y brillo; lana
     tejida (el poncho con sus franjas, la camisa de punto, la chuspa). Capas de pelusa en el pelo
     y la lana SOLO en calidad alta (AJUSTES.conchas); en media y baja, ninguna.
   - Lo duro (casco, botas, ojos, metal) con reflejos del entorno; el casco y las botas, gastados.
     La lamparita del casco es una luz de la plaza que lo sigue (A.agregarLuz).
   - Las poses por hueso se mezclan suave (como los avatares de Ruway): quieto apoyado en la
     picota, caminar, correr, reír, encogerse, triste, mirar arriba, ofrecer, tomar la taza,
     abrazar, colgado del árbol y saludar. */
(function () {
'use strict';
var A = window.Arbol;
var V3 = THREE.Vector3;

/* ---------- el esqueleto (posiciones de reposo en el mundo; el personaje mira a +z) ----------
   Los nombres no cambian (los usan las poses y el juego); "bufanda" es el pelo largo de la
   espalda y "trenza" los mechones de los costados. */
var HUESOS = [
  ['cadera', null, 0, .3, 0], ['columna', 'cadera', 0, .4, 0], ['pecho', 'columna', 0, .53, 0], ['cuello', 'pecho', 0, .63, 0], ['cabeza', 'cuello', 0, .69, .01],
  ['parpadoI', 'cabeza', .042, .805, .107], ['parpadoD', 'cabeza', -.042, .805, .107], ['cejaI', 'cabeza', .044, .831, .114], ['cejaD', 'cabeza', -.044, .831, .114], ['boca', 'cabeza', 0, .738, .114],
  ['trenzaI0', 'cabeza', .118, .76, -.02], ['trenzaI1', 'trenzaI0', .14, .66, -.01], ['trenzaI2', 'trenzaI1', .158, .57, .0],
  ['trenzaD0', 'cabeza', -.118, .76, -.02], ['trenzaD1', 'trenzaD0', -.14, .66, -.01], ['trenzaD2', 'trenzaD1', -.158, .57, .0],
  ['hombroI', 'pecho', .15, .565, 0], ['codoI', 'hombroI', .16, .445, .005], ['manoI', 'codoI', .163, .34, .025],
  ['hombroD', 'pecho', -.15, .565, 0], ['codoD', 'hombroD', -.16, .445, .005], ['manoD', 'codoD', -.163, .34, .025],
  ['bufanda0', 'cuello', 0, .78, -.125], ['bufanda1', 'bufanda0', 0, .68, -.16], ['bufanda2', 'bufanda1', 0, .58, -.185], ['bufanda3', 'bufanda2', 0, .48, -.2],
  ['musloI', 'cadera', .072, .3, 0], ['rodillaI', 'musloI', .074, .17, .01], ['pieI', 'rodillaI', .074, .05, 0],
  ['musloD', 'cadera', -.072, .3, 0], ['rodillaD', 'musloD', -.074, .17, .01], ['pieD', 'rodillaD', -.074, .05, 0]
];
var IDX = {}; HUESOS.forEach(function (h, i) { IDX[h[0]] = i; });
/* el gancho de arriba del casco (para colgarlo en el árbol al final) y la lamparita, en reposo */
var GANCHO = .985, LAMPARA = new V3(0, .9, .168);

/* ---------- constructores de forma ---------- */
/* superficie paramétrica: f(u, v, out) en [0,1]², con uv */
function superficie(f, nu, nv, cerrarU, voltear) {
  var pos = [], uv = [], idx = [], p = new V3();
  for (var j = 0; j <= nv; j++) for (var i = 0; i <= nu; i++) { f(i / nu, j / nv, p); pos.push(p.x, p.y, p.z); uv.push(i / nu, j / nv); }
  for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) { var a = j * (nu + 1) + i, b = a + nu + 1; if (voltear) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (cerrarU) arreglarCostura(g, nu, nv);
  return g;
}
/* una pieza delgada (el ala del casco) que se ve de los dos lados: se le suma su copia volteada,
   apenas despegada, con las normales al revés */
function dosCaras(g) {
  var a = g.index ? g.toNonIndexed() : g, b = a.clone(), P = b.attributes.position, N = b.attributes.normal, v = new V3(), n = new V3();
  for (var i = 0; i < P.count; i += 3) { var x = P.getX(i + 1), y = P.getY(i + 1), z = P.getZ(i + 1); P.setXYZ(i + 1, P.getX(i + 2), P.getY(i + 2), P.getZ(i + 2)); P.setXYZ(i + 2, x, y, z);
    var u1 = b.attributes.uv; if (u1) { var ux = u1.getX(i + 1), uy = u1.getY(i + 1); u1.setXY(i + 1, u1.getX(i + 2), u1.getY(i + 2)); u1.setXY(i + 2, ux, uy); } }
  for (i = 0; i < P.count; i++) { n.fromBufferAttribute(N, i).negate(); N.setXYZ(i, n.x, n.y, n.z); v.fromBufferAttribute(P, i).addScaledVector(n, .0015); P.setXYZ(i, v.x, v.y, v.z); }
  for (i = 0; i < P.count; i += 3) { var nx = N.getX(i + 1), ny = N.getY(i + 1), nz = N.getZ(i + 1); N.setXYZ(i + 1, N.getX(i + 2), N.getY(i + 2), N.getZ(i + 2)); N.setXYZ(i + 2, nx, ny, nz); }
  return A.unir([a, b]);
}
/* en una superficie cerrada en u, la primera y la última columna comparten normal */
function arreglarCostura(g, nu, nv) {
  var n = g.attributes.normal, v = new V3(), w = new V3();
  for (var j = 0; j <= nv; j++) { var a = j * (nu + 1), b = a + nu; v.fromBufferAttribute(n, a); w.fromBufferAttribute(n, b); v.add(w).normalize(); n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z); }
}
/* tubo por una lista de puntos con radio variable (marcos de transporte paralelo) */
function tubo(pts, radio, seg, tapas) {
  var N = pts.length, pos = [], uv = [], idx = [], T = [], Nn = [], B = [], i, j;
  for (i = 0; i < N; i++) { var t = new V3(); if (i === 0) t.subVectors(pts[1], pts[0]); else if (i === N - 1) t.subVectors(pts[N - 1], pts[N - 2]); else t.subVectors(pts[i + 1], pts[i - 1]); T.push(t.normalize()); }
  var n0 = new V3(0, 1, 0); if (Math.abs(T[0].dot(n0)) > .9) n0.set(1, 0, 0);
  var nn = new V3().crossVectors(T[0], n0).normalize(), bb = new V3();
  for (i = 0; i < N; i++) {
    if (i > 0) { var ax = new V3().crossVectors(T[i - 1], T[i]); if (ax.length() > 1e-6) { ax.normalize(); var an = Math.acos(Math.max(-1, Math.min(1, T[i - 1].dot(T[i])))); nn.applyAxisAngle(ax, an); } }
    bb.crossVectors(T[i], nn).normalize(); Nn.push(nn.clone()); B.push(bb.clone());
  }
  var largo = 0, acum = [0]; for (i = 1; i < N; i++) { largo += pts[i].distanceTo(pts[i - 1]); acum.push(largo); }
  for (i = 0; i < N; i++) {
    var r = typeof radio === 'function' ? radio(i / (N - 1)) : radio;
    for (j = 0; j <= seg; j++) {
      var a = j / seg * Math.PI * 2, cx = Math.cos(a), sx = Math.sin(a);
      pos.push(pts[i].x + (Nn[i].x * cx + B[i].x * sx) * r, pts[i].y + (Nn[i].y * cx + B[i].y * sx) * r, pts[i].z + (Nn[i].z * cx + B[i].z * sx) * r);
      uv.push(j / seg, acum[i] / Math.max(largo, 1e-6));
    }
  }
  for (i = 0; i < N - 1; i++) for (j = 0; j < seg; j++) { var p0 = i * (seg + 1) + j, p1 = p0 + seg + 1; idx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1); }
  if (tapas) [0, N - 1].forEach(function (k) {
    var c = pos.length / 3; pos.push(pts[k].x, pts[k].y, pts[k].z); uv.push(.5, k ? 1 : 0);
    for (j = 0; j < seg; j++) { var q0 = k * (seg + 1) + j; if (k) idx.push(c, q0, q0 + 1); else idx.push(c, q0 + 1, q0); }
  });
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* un mechón de pelo: un tubo que se afina hacia la punta por una curva suave (no un resorte) */
function mechon(pts, r0, r1, n, seg) {
  var cu = new THREE.CatmullRomCurve3(pts);
  /* sin tapa en la punta: con el radio tan fino no se ve el hueco, y la tapa salía como un puntito oscuro */
  return tubo(cu.getPoints(n || 16), function (t) { return r0 + (r1 - r0) * Math.pow(t, .85); }, seg || 5, false);
}
function esfera(r, cx, cy, cz, sx, sy, sz, wu, wv) { var g = new THREE.SphereGeometry(r, wu || 20, wv || 14); g.scale(sx || 1, sy || 1, sz || 1); return g.translate(cx, cy, cz); }
/* azar que no cambia de una vez a otra (el mismo muki siempre) */
function azar(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

/* ---------- atributos por parte ----------
   color, aux (lo suave: patrón, a lo largo, alrededor, pelusa; lo duro: tipo, brillo, gastado),
   surco (ya no se usa: era el enrollado de los limpiapipas) y pesos (hasta dos huesos). */
function parte(g, op) {
  if (g.index) { var g2 = g.toNonIndexed(); g.dispose(); g = g2; }
  var n = g.attributes.position.count, P = g.attributes.position, U = g.attributes.uv;
  var col = new Float32Array(n * 3), aux = new Float32Array(n * 4), surco = new Float32Array(n), si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
  var c = new THREE.Color(), v = new V3(), uv = new THREE.Vector2();
  for (var i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i); if (U) uv.fromBufferAttribute(U, i); else uv.set(0, 0);
    if (typeof op.color === 'function') c.copy(op.color(v, uv)); else c.set(op.color || '#ffffff');
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    var ax = op.aux ? (typeof op.aux === 'function' ? op.aux(v, uv) : op.aux) : [0, 0, 0, 0];
    aux[i * 4] = ax[0]; aux[i * 4 + 1] = ax[1]; aux[i * 4 + 2] = ax[2]; aux[i * 4 + 3] = ax[3];
    var w = typeof op.pesos === 'function' ? op.pesos(v, uv) : [op.pesos, 1];
    si[i * 4] = IDX[w[0]]; sw[i * 4] = w[1];
    si[i * 4 + 1] = w.length > 2 ? IDX[w[2]] : 0; sw[i * 4 + 1] = w.length > 2 ? w[3] : 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aux', new THREE.BufferAttribute(aux, 4));
  g.setAttribute('surco', new THREE.BufferAttribute(surco, 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}
/* mezcla de dos huesos según t (0 → a, 1 → b), con la transición entre t0 y t1 */
function entre(a, b, t, t0, t1) { var k = A.suave(t0, t1, t); return k < .001 ? [a, 1] : k > .999 ? [b, 1] : [a, 1 - k, b, k]; }
/* el pelo largo de la espalda: de la cabeza a la cadena "bufanda", según la altura */
function pesoEspalda(y) {
  if (y > .78) return entre('cabeza', 'bufanda0', (.86 - y) / .08, .2, 1);
  if (y > .68) return entre('bufanda0', 'bufanda1', (.78 - y) / .1, .5, 1);
  if (y > .58) return entre('bufanda1', 'bufanda2', (.68 - y) / .1, .5, 1);
  return entre('bufanda2', 'bufanda3', (.58 - y) / .1, .5, 1);
}
/* los mechones de los costados: de la cabeza a la "trenza" de su lado */
function pesoCostado(y, l) {
  if (y > .76) return entre('cabeza', 'trenza' + l + '0', (.84 - y) / .08, .2, 1);
  if (y > .66) return entre('trenza' + l + '0', 'trenza' + l + '1', (.76 - y) / .1, .5, 1);
  return entre('trenza' + l + '1', 'trenza' + l + '2', (.66 - y) / .09, .5, 1);
}

/* colores (el shader los toma como lineales: en pantalla salen más claros que el número) */
var PIEL = '#D6A288', MANO = '#A8735C', PELO = '#D6C08A', BARBA = '#E6E1D6', CEJA = '#DDD5C4';

/* curva de Bézier cúbica (sin crear nada) */
function bez3(a, b, c, d, t) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
/* la barba en un ángulo (−1 izquierda … 1 derecha) y una altura t (0 quijada … 1 punta): baja de la
   quijada, se apoya en el pecho y cae sobre la panza del poncho (sin despegarse del cuerpo) */
function puntoBarba(f, t, out, fuera) {
  var ab = f * 1.35, cs = Math.abs(f), d = fuera || 0, sa = Math.sin(ab);
  var x0 = sa * .113, y0 = .744 + .048 * Math.pow(cs, 1.4) - (1 - cs) * .012, z0 = Math.cos(ab) * .1 + .006;
  var x1 = sa * .118, y1 = .69, z1 = .118 + .012 * (1 - cs) - .02 * cs;
  var x2 = sa * .128, y2 = .58, z2 = .19 + .012 * (1 - cs) - .05 * cs;
  var x3 = sa * (.12 + .05 * cs), y3 = .47 + .09 * cs * cs, z3 = .245 + .02 * (1 - cs) - .062 * cs;
  out.set(bez3(x0, x1, x2, x3, t), bez3(y0, y1, y2, y3, t), bez3(z0, z1, z2, z3, t) + d);
  return out;
}
/* el pelo largo, en un ángulo alrededor de la cabeza (ah) y una altura t: sale por debajo del ala
   del casco; atrás cae derecho por la nuca hasta la espalda y la sigue; a los costados cae por
   detrás de la oreja hasta el hombro */
function puntoPelo(ah, t, out, fuera) {
  var atras = -Math.cos(ah), lado = Math.sin(ah), d = fuera || 0;
  var esp = Math.max(0, Math.min(1, (atras + .2) / .9));            /* 0 a los costados, 1 en la nuca */
  var r0 = .133, x0 = lado * r0, z0 = Math.cos(ah) * r0 * .98, y0 = .86 - .012 * Math.max(0, atras);
  var x1 = lado * (.142 * (1 - esp) + .13 * esp), y1 = .74, z1 = z0 * (1 - esp) * .5 - .03 * (1 - esp) - .152 * esp;
  var x2 = lado * (.19 * (1 - esp) + .12 * esp), y2 = .63, z2 = -.07 * (1 - esp) - .162 * esp;
  var x3 = lado * (.21 * (1 - esp) + .13 * esp * Math.abs(lado)), y3 = .575 - .055 * esp, z3 = -.1 * (1 - esp) - .207 * esp;
  out.set(bez3(x0, x1, x2, x3, t), bez3(y0, y1, y2, y3, t), bez3(z0, z1, z2, z3, t));
  if (d) { out.x += lado * d; out.z += Math.cos(ah) * d; }
  return out;
}
function pesoPelo(ah, y) { var atras = -Math.cos(ah); return atras > .35 ? pesoEspalda(y) : pesoCostado(y, Math.sin(ah) > 0 ? 'I' : 'D'); }

/* ---------- las piezas ---------- */
/* aj: los ajustes de calidad. En baja van menos mechones (la base del pelo y de la barba ya da el
   volumen): así pesa lo mismo que el Don Gruñón de antes en un celular sencillo. */
function construir(aj) {
  var suave = [], duro = [], pt = new V3(), fino = (aj && aj.detalle) >= 1;
  var cab = 'cabeza', HC = new V3(0, .79, 0);
  /* cabeza: un poco grande; la quijada se pierde en la barba */
  suave.push(parte(esfera(.128, HC.x, HC.y, HC.z, 1, 1.06, .98, 32, 24), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
  /* el ceño: apenas una curva sobre los ojos (le da sombra a la mirada) */
  suave.push(parte(esfera(.058, 0, .828, .088, 1.6, .36, .45, 22, 10), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
  /* nariz normal: tabique corto, punta redonda y alitas */
  suave.push(parte(tubo([new V3(0, .814, .117), new V3(0, .798, .128), new V3(0, .785, .136)], function (t) { return .0098 + .0055 * t; }, 10, true), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
  suave.push(parte(esfera(.0145, 0, .779, .135, 1.05, .9, 1, 14, 10), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
  [-1, 1].forEach(function (l) { suave.push(parte(esfera(.0088, l * .012, .775, .129, 1, .8, 1, 10, 8), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab })); });
  /* orejas: chicas y un poquito en punta, asomando entre el pelo */
  [-1, 1].forEach(function (l) {
    suave.push(parte(esfera(.027, l * .126, .79, -.008, .38, 1, .7, 12, 10), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
    suave.push(parte(new THREE.ConeGeometry(.011, .028, 8).rotateZ(-l * .35).translate(l * .132, .821, -.012), { color: PIEL, aux: [5, 0, 0, 0], pesos: cab }));
  });
  /* párpados (casquete de piel sobre la mitad de arriba del ojo; giran para abrir y cerrar) */
  [['parpadoI', .042], ['parpadoD', -.042]].forEach(function (p) {
    var g = new THREE.SphereGeometry(.0172, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5); g.rotateX(Math.PI * .5); g.translate(p[1], .805, .107);
    suave.push(parte(g, { color: '#CF9A80', aux: [5, 0, 0, 0], pesos: p[0] }));
  });
  /* ojos color miel, con su brillo: blanco, iris, pupila y un puntito de luz que no se apaga */
  [-1, 1].forEach(function (l) {
    duro.push(parte(esfera(.0155, l * .042, .804, .107, 1, 1, .9, 16, 12), { color: '#D9CFBF', aux: [0, .75, 0, 0], pesos: cab }));
    duro.push(parte(esfera(.0098, l * .042, .804, .1185, 1, 1, .5, 16, 10), { color: '#7A4A16', aux: [0, .95, 0, 0], pesos: cab }));
    duro.push(parte(esfera(.0052, l * .042, .804, .1222, 1, 1, .45, 10, 8), { color: '#070605', aux: [0, .95, 0, 0], pesos: cab }));
    duro.push(parte(esfera(.002, l * .042 + .0032, .8075, .1248, 1, 1, .6, 8, 6), { color: '#FFFFFF', aux: [3, 0, 0, 0], pesos: cab }));
  });
  /* la boca (adentro oscuro): el hueso "boca" la abre al reír */
  duro.push(parte(esfera(.024, 0, .736, .11, 1, .45, .45, 14, 10), { color: '#140606', aux: [0, .1, 0, 0], pesos: 'boca' }));
  /* cejas pobladas: mechoncitos claros que salen para afuera y caen un poco */
  [['cejaI', 1], ['cejaD', -1]].forEach(function (p) {
    for (var k = 0; k < 16; k++) {
      var f = k / 15, bx = p[1] * (.014 + f * .058), by = .83 + Math.sin(f * Math.PI) * .006 - f * .002 + (azar(k * 3 + 1) - .5) * .004, bz = .119 - f * f * .02;
      var largo = .016 + azar(k * 7 + p[1] * 3) * .014, dx = p[1] * (.55 + .45 * f);
      suave.push(parte(mechon([new V3(bx, by, bz), new V3(bx + dx * largo * .5, by + .005, bz + .006), new V3(bx + dx * largo, by - .001 - f * .005, bz + .002)], .0026, .0007, 8, 4),
        { color: CEJA, aux: function (v, uv) { return [6, uv.y, uv.x, .6]; }, pesos: p[0] }));
    }
  });
  /* bigote: dos lóbulos de base que tapan el labio y, encima, pelitos que se abren y caen hasta
     juntarse con la barba */
  [-1, 1].forEach(function (l) {
    suave.push(parte(esfera(.027, 0, 0, 0, 1.25, .62, .55, 16, 10).rotateZ(l * -.25).translate(l * .026, .752, .126), { color: BARBA, aux: function (v, uv) { return [6, uv.y, uv.x * 6, .8]; }, pesos: cab }));
    for (var k = 0, nk = fino ? 24 : 14; k < nk; k++) {
      var f = azar(k * 17 + l * 7), x0 = l * (.002 + f * .026), cae = .018 + azar(k * 5 + l) * .026, abre = .03 + azar(k * 3 + l * 11) * .03, dz = (azar(k * 13 + l) - .5) * .008;
      var y0 = .768 - f * .006, z0 = .136 - f * .008 + dz;
      suave.push(parte(mechon([new V3(x0, y0, z0), new V3(x0 + l * abre * .35, y0 - cae * .25, z0 + .006), new V3(x0 + l * abre * .7, y0 - cae * .6, z0 + .002), new V3(x0 + l * abre, y0 - cae - .012, z0 - .008)], .0036, .0007, 14, 4),
        { color: function () { return new THREE.Color(BARBA).multiplyScalar(.92 + Math.random() * .08); }, aux: function (v, uv) { return [6, uv.y, uv.x, .8]; }, pesos: cab }));
    }
  });
  /* barba larga y blanca: un volumen de base (para que no se vea el poncho entre los pelos) y
     encima mechones sueltos de distinto largo; arriba sigue a la cabeza, abajo al pecho */
  var pesoBarba = function (v) { return entre('cabeza', 'pecho', (.73 - v.y) / .26, .12, .7); };
  suave.push(parte(dosCaras(superficie(function (u, v, p) { puntoBarba(u * 2 - 1, v * (.96 - .1 * Math.pow(Math.abs(u * 2 - 1), 2)), p); }, 26, 14)),
    { color: new THREE.Color(BARBA).multiplyScalar(.8), aux: function (v, uv) { return [6, uv.y, uv.x * 9, .9]; }, pesos: pesoBarba }));
  for (var b = 0, nbb = fino ? 84 : 50; b < nbb; b++) {
    var fb = (azar(b * 3 + 7) * 2 - 1) * .98, largo = .7 + azar(b * 5 + 2) * .3, fuera = .004 + azar(b + 31) * .01, pts = [];
    for (var s = 0; s <= 4; s++) { var tt = s / 4 * largo; puntoBarba(fb + Math.sin(tt * 3 + b) * .03, tt, pt, fuera); pts.push(pt.clone()); }
    suave.push(parte(mechon(pts, .0048 + azar(b + 3) * .003, .0008, 18, 4), { color: function () { return new THREE.Color(BARBA).multiplyScalar(.9 + Math.random() * .1); },
      aux: function (v, uv) { return [6, uv.y, uv.x, 1]; }, pesos: pesoBarba }));
  }
  /* pelo largo rubio ceniza: volumen de base por los costados y la espalda, y mechones encima (con
     el resorte de la espalda y de los costados) */
  var A0 = 1.32, A1 = Math.PI * 2 - 1.32;                              /* de un costado al otro, por atrás */
  suave.push(parte(dosCaras(superficie(function (u, v, p) { puntoPelo(A0 + (A1 - A0) * u, v, p); }, 30, 12)),
    { color: new THREE.Color(PELO).multiplyScalar(.72), aux: function (v, uv) { return [6, uv.y, uv.x * 10, .9]; }, pesos: function (v) { return pesoPelo(Math.atan2(v.x, v.z), v.y); } }));
  for (var hh = 0, nhh = fino ? 70 : 42; hh < nhh; hh++) {
    var ah = A0 + (A1 - A0) * azar(hh * 7 + 3), largoH = 1 - azar(hh * 3 + 9) * .3, fueraH = .004 + azar(hh + 17) * .012, ptsH = [];
    var abre = (azar(hh * 9 + 4) - .5) * .05;
    for (var sh = 0; sh <= 4; sh++) { var th = sh / 4 * largoH; puntoPelo(ah + Math.sin(th * 5 + hh) * .07 + abre * th * th, th, pt, fueraH + th * th * .01); pt.y += Math.sin(th * 7 + hh * 1.3) * .006; ptsH.push(pt.clone()); }
    (function (ah) {
      suave.push(parte(mechon(ptsH, .0058 + azar(hh + 2) * .003, .001, 18, 4), { color: function () { return new THREE.Color(PELO).multiplyScalar(.88 + Math.random() * .14); },
        aux: function (v, uv) { return [6, uv.y, uv.x, 1]; }, pesos: function (v) { return pesoPelo(ah, v.y); } }));
    })(ah);
  }
  /* el casco de minero: copa con su cresta, ala alrededor y el gancho de arriba */
  duro.push(parte(superficie(function (u, v, p) {
    var a = u * Math.PI * 2, r = .149 * Math.pow(Math.cos(v * Math.PI * .5), .82) + .002, y = .855 + .106 * Math.sin(v * Math.PI * .5);
    p.set(Math.sin(a) * r, y, Math.cos(a) * r * 1.04 - .004);
  }, 40, 14, true, true), { color: '#7E5E1D', aux: [0, .14, 1, 0], pesos: cab }));
  duro.push(parte(tubo([new V3(0, .918, .138), new V3(0, .952, .078), new V3(0, .963, 0), new V3(0, .952, -.078), new V3(0, .918, -.138)], .008, 6, true), { color: '#755719', aux: [0, .14, 1, 0], pesos: cab }));
  duro.push(parte(dosCaras(superficie(function (u, v, p) {
    var a = u * Math.PI * 2, delante = Math.max(0, Math.cos(a)), atras = Math.max(0, -Math.cos(a)), r = .149 + v * (.024 + .03 * delante * delante + .012 * atras);
    p.set(Math.sin(a) * r, .855 - v * (.008 + .006 * (1 - delante) + .014 * atras), Math.cos(a) * r * 1.04 - .004);
  }, 48, 3, true)), { color: '#6E5219', aux: [0, .12, 1, 0], pesos: cab }));
  duro.push(parte(new THREE.TorusGeometry(.0105, .003, 6, 14).translate(0, GANCHO - .012, -.004), { color: '#857A68', aux: [1, .7, .4, 0], pesos: cab }));
  /* la lamparita: su caja de metal, el vidrio que alumbra y el cable que va a la espalda */
  duro.push(parte(new THREE.CylinderGeometry(.02, .022, .032, 14).rotateX(Math.PI / 2).translate(LAMPARA.x, LAMPARA.y, LAMPARA.z - .016), { color: '#4E4943', aux: [1, .55, .5, 0], pesos: cab }));
  duro.push(parte(new THREE.TorusGeometry(.018, .0032, 6, 16).translate(LAMPARA.x, LAMPARA.y, LAMPARA.z + .001), { color: '#7C746A', aux: [1, .75, .3, 0], pesos: cab }));
  duro.push(parte(new THREE.CircleGeometry(.016, 16).translate(LAMPARA.x, LAMPARA.y, LAMPARA.z + .002), { color: '#FFD08A', aux: [3, 0, 0, 0], pesos: cab }));
  duro.push(parte(new THREE.BoxGeometry(.028, .013, .02).translate(0, LAMPARA.y - .013, .145), { color: '#3E3A35', aux: [1, .45, .5, 0], pesos: cab }));
  duro.push(parte(tubo([new V3(.01, LAMPARA.y, .15), new V3(.045, .918, .108), new V3(.115, .89, -.02), new V3(.128, .8, -.1), new V3(.1, .63, -.18)], .0022, 5, false), { color: '#171513', aux: [0, .3, 0, 0],
    pesos: function (v) { return v.y > .82 ? ['cabeza', 1] : pesoEspalda(v.y); } }));
  /* el poncho de lana granate tejido: cae de los hombros a las rodillas con sus pliegues, más corto
     a los lados (ahí salen los brazos); con sus franjas y rombos */
  suave.push(parte(superficie(function (u, v, p) {
    var a = (u - .5) * Math.PI * 2, s2 = Math.sin(a) * Math.sin(a);
    var yH = .31 + .11 * s2 + .008 * Math.sin(a * 5);            /* el borde de abajo */
    var y = .648 + (yH - .648) * v;
    var r = .075 + .12 * A.suave(0, .25, v) + .016 * A.suave(.2, 1, v);
    r += .024 * Math.max(0, Math.cos(a)) * A.suave(.3, .7, v) * (1 - A.suave(.85, 1, v) * .5);
    r += .02 * s2 * A.suave(.1, .3, v) * (1 - A.suave(.4, .8, v));
    r *= 1 + .04 * Math.sin(a * 9 + v * 2) * A.suave(.25, 1, v);    /* la lana pesa y hace pliegues */
    p.set(Math.sin(a) * r, y, Math.cos(a) * r * .9);
  }, 64, 24, true), { color: '#ffffff', aux: function (v, uv) { return [2, uv.y, uv.x, .35]; },
    pesos: function (v) {
      if (v.y > .5 && Math.abs(v.x) > .11) return [v.x > 0 ? 'hombroI' : 'hombroD', .45, 'pecho', .55];
      return entre('pecho', 'cadera', (.6 - v.y) / .3, .2, .9);
    } }));
  /* el fondo del poncho (tapa oscura para que no se vea el hueco desde abajo) */
  suave.push(parte(new THREE.CircleGeometry(.2, 24).rotateX(Math.PI / 2).scale(1, 1, .85).translate(0, .36, 0), { color: '#0C0807', aux: [0, 0, 0, 0], pesos: 'cadera' }));
  /* flecos de lana cruda */
  for (var fl = 0; fl < 64; fl++) {
    var af = (fl / 64 - .5) * Math.PI * 2, s2f = Math.sin(af) * Math.sin(af), yH2 = .31 + .11 * s2f + .008 * Math.sin(af * 5);
    var rf = (.075 + .12 + .016 + .024 * Math.max(0, Math.cos(af)) * .5) * (1 + .04 * Math.sin(af * 9 + 2)) - .004;
    var px = Math.sin(af) * rf, pz = Math.cos(af) * rf * .9, lf = .028 + azar(fl) * .012;
    suave.push(parte(tubo([new V3(px, yH2 + .004, pz), new V3(px * 1.015, yH2 - lf * .5, pz * 1.015), new V3(px * 1.02, yH2 - lf, pz * 1.02)], .0036, 4, true), { color: '#C9BC9E', aux: [0, 0, 0, .5], pesos: 'cadera' }));
  }
  /* la chuspa (la bolsita tejida de la coca) colgada del hombro, al costado */
  suave.push(parte(tubo([new V3(.14, .61, .07), new V3(.05, .565, .212), new V3(-.08, .48, .25), new V3(-.19, .37, .15)], .0045, 5, false), { color: '#4E1A12', aux: [0, 0, 0, .3],
    pesos: function (v) { return entre('pecho', 'cadera', (.6 - v.y) / .22, .3, .9); } }));
  suave.push(parte(new THREE.BoxGeometry(.075, .085, .022, 3, 3, 1).translate(-.205, .315, .085), { color: '#ffffff', aux: function (v) { return [3, v.y, 0, .3]; }, pesos: 'cadera' }));
  for (var fc = 0; fc < 8; fc++) { var fx = -.237 + fc * .009; suave.push(parte(tubo([new V3(fx, .273, .085), new V3(fx - .001, .257, .086), new V3(fx - .002, .244, .088)], .003, 4, true), { color: ['#A82A1E', '#C99020', '#1F6347'][fc % 3], aux: [0, 0, 0, .3], pesos: 'cadera' })); }
  /* brazos: camisa de lana de punto, puños; manos fuertes de piel curtida */
  [[1, 'I'], [-1, 'D']].forEach(function (l) {
    var pS = new V3(l[0] * .15, .565, 0), pC = new V3(l[0] * .16, .445, .005), pM = new V3(l[0] * .163, .34, .025);
    var c1 = new THREE.CatmullRomCurve3([pS, pS.clone().lerp(pC, .5).add(new V3(l[0] * .007, 0, 0)), pC, pC.clone().lerp(pM, .5), pM]);
    suave.push(parte(tubo(c1.getPoints(20), function (t) { return .041 - .006 * t + .005 * Math.sin(t * Math.PI); }, 12, false), { color: '#3A1714', aux: function (v, uv) { return [7, uv.y, uv.x, .4]; },
      pesos: function (v) { return entre('hombro' + l[1], 'codo' + l[1], (.565 - v.y) / .225, .42, .62); } }));
    suave.push(parte(new THREE.TorusGeometry(.034, .009, 8, 16).rotateX(Math.PI / 2).translate(pM.x, pM.y + .004, pM.z), { color: '#2E1210', aux: function (v, uv) { return [7, uv.y, uv.x, .4]; }, pesos: 'mano' + l[1] }));
    /* la mano: palma, dedos juntos y el pulgar */
    suave.push(parte(esfera(.027, pM.x, pM.y - .03, pM.z + .004, .82, 1.08, .7, 14, 10), { color: MANO, aux: [5, 0, 0, 0], pesos: 'mano' + l[1] }));
    suave.push(parte(esfera(.022, pM.x, pM.y - .058, pM.z + .01, .78, .9, .66, 12, 10), { color: MANO, aux: [5, 0, 0, 0], pesos: 'mano' + l[1] }));
    suave.push(parte(esfera(.0115, pM.x - l[0] * .025, pM.y - .038, pM.z + .025, 1, 1.5, 1, 8, 6), { color: MANO, aux: [5, 0, 0, 0], pesos: 'mano' + l[1] }));
  });
  /* piernas cortas: pantalón de bayeta oscura; botas grandes de jebe (los pies del muki) */
  [[1, 'I'], [-1, 'D']].forEach(function (l) {
    var c2 = new THREE.CatmullRomCurve3([new V3(l[0] * .072, .33, 0), new V3(l[0] * .073, .26, .005), new V3(l[0] * .074, .19, .01)]);
    suave.push(parte(tubo(c2.getPoints(12), function (t) { return .05 - .004 * t; }, 12, false), { color: '#1C1511', aux: function (v, uv) { return [0, uv.y, uv.x, .2]; },
      pesos: function (v) { return entre('muslo' + l[1], 'rodilla' + l[1], (.33 - v.y) / .2, .55, .8); } }));
    duro.push(parte(tubo([new V3(l[0] * .074, .215, .01), new V3(l[0] * .074, .14, .008), new V3(l[0] * .074, .07, .004)], function (t) { return .055 - .004 * t; }, 14, false), { color: '#141210', aux: [0, .4, 1, 0],
      pesos: function (v) { return entre('rodilla' + l[1], 'pie' + l[1], (.2 - v.y) / .14, .5, .9); } }));
    duro.push(parte(new THREE.TorusGeometry(.056, .008, 6, 18).rotateX(Math.PI / 2).translate(l[0] * .074, .214, .01), { color: '#1C1916', aux: [0, .35, 1, 0], pesos: 'rodilla' + l[1] }));
    duro.push(parte(esfera(.057, l[0] * .076, .05, .045, .95, .7, 1.55, 18, 12), { color: '#141210', aux: [0, .45, 1, 0], pesos: 'pie' + l[1] }));
    duro.push(parte(new THREE.BoxGeometry(.098, .018, .175).translate(l[0] * .076, .009, .045), { color: '#0A0908', aux: [0, .12, 1, 0], pesos: 'pie' + l[1] }));
  });
  /* la picota corta (en la mano derecha), de madera con la cabeza de fierro: le sirve de bastón */
  var bc = new THREE.CatmullRomCurve3([new V3(-.17, .41, .035), new V3(-.168, .3, .045), new V3(-.172, .17, .052), new V3(-.176, .05, .056), new V3(-.178, .005, .056)]);
  duro.push(parte(tubo(bc.getPoints(16), function (t) { return .012 + .002 * Math.sin(t * 13); }, 8, true), { color: '#4E331D', aux: [0, .25, 1, 0], pesos: 'manoD' }));
  duro.push(parte(tubo([new V3(-.235, .392, .035), new V3(-.205, .418, .035), new V3(-.17, .425, .035), new V3(-.13, .418, .035), new V3(-.112, .4, .035)], function (t) { return .0095 - .003 * Math.abs(t - .5); }, 7, true), { color: '#3A3733', aux: [1, .5, .6, 0], pesos: 'manoD' }));
  duro.push(parte(new THREE.CylinderGeometry(.016, .016, .02, 10).translate(-.17, .414, .035), { color: '#2E2B28', aux: [1, .45, .6, 0], pesos: 'manoD' }));
  return { suave: A.unir(suave), duro: A.unir(duro) };
}

/* ---------- los shaders ---------- */
var VS = [
  '#include <common>',
  '#include <skinning_pars_vertex>',
  'attribute vec4 aux; attribute float surco;',
  'uniform float uConcha;',
  'varying vec3 vPos; varying vec3 vN; varying vec3 vCol; varying vec4 vAux; varying vec3 vObj;',
  'void main(){',
  '  #include <beginnormal_vertex>',
  '  #include <skinbase_vertex>',
  '  #include <skinnormal_vertex>',
  '  #include <begin_vertex>',
  '  #include <skinning_vertex>',
  '  transformed += normalize(objectNormal) * uConcha * aux.w;',
  '  vec4 wp = modelMatrix * vec4(transformed, 1.0);',
  '  vPos = wp.xyz; vN = normalize(mat3(modelMatrix) * objectNormal); vCol = color; vAux = aux; vObj = position;',
  '  gl_Position = projectionMatrix * viewMatrix * wp;',
  '}'
].join('\n');
/* lo suave: 0 tela lisa · 2 poncho tejido · 3 chuspa · 5 piel · 6 pelo · 7 lana de punto */
var FS_SUAVE = [
  'uniform sampler2D uRuido; uniform float uCapa, uLuz;',
  'varying vec3 vPos; varying vec3 vN; varying vec3 vCol; varying vec4 vAux; varying vec3 vObj;',
  'float linea(float d, float w){ return 1.0 - smoothstep(0.0, w, abs(d)); }',
  'void main(){',
  '  vec3 V = normalize(cameraPosition - vPos); vec3 n = normalize(vN);',
  '  vec3 alb = vCol; float pid = vAux.x, envuelve = .45, brillo = .06, dur = 10.0;',
  '  float fib = texture2D(uRuido, vObj.xy * 11.0 + vObj.zy * 9.0).a;',
  '  if (pid > 4.5 && pid < 5.5) {',
  /* la piel: pálida, mejillas y nariz coloradas por el frío, arrugas de viejo, poros */
  '    vec3 p = vObj - vec3(0.0, .79, 0.0);',
  '    vec2 mj = vec2(abs(p.x) - .062, p.y + .028);',
  '    float mej = exp(-dot(mj, mj) * 700.0) * smoothstep(.04, .1, p.z);',
  '    vec3 pn = p - vec3(0.0, -.014, .14); float nar = exp(-dot(pn, pn) * 1100.0);',
  '    alb = mix(alb, vec3(.86, .46, .40), clamp(mej * .5 + nar * .55, 0.0, 1.0));',
  '    float fz = smoothstep(.07, .115, p.z) * (1.0 - smoothstep(.055, .09, abs(p.x)));',
  '    float fy = p.y - .056 + p.x * p.x * 2.2;',
  '    float arr = linea(fy, .0026) + linea(fy - .012, .0022) * .8 + linea(fy + .011, .0022) * .55;',
  '    vec2 q = vec2(abs(p.x) - .064, p.y - .014); float cerca = step(0.0, q.x) * (1.0 - smoothstep(.012, .026, q.x));',
  '    float pata = (linea(q.y - q.x * .55, .0016) + linea(q.y, .0016) + linea(q.y + q.x * .55, .0016)) * cerca * smoothstep(.06, .1, p.z);',
  '    vec2 ce = vec2(abs(p.x) - .042, p.y - .012); float cuenca = exp(-dot(ce * vec2(1.0, 1.25), ce * vec2(1.0, 1.25)) * 1300.0) * smoothstep(.05, .1, p.z);',
  '    alb *= 1.0 - arr * fz * .24 - pata * .16 - cuenca * .16;',
  '    alb *= .94 + .1 * texture2D(uRuido, vObj.xy * 70.0 + vObj.zy * 50.0).a;',
  '    envuelve = .6; brillo = .16; dur = 28.0;',
  '  } else if (pid > 5.5 && pid < 6.5) {',
  /* el pelo: hebras a lo largo del mechón, raíz más oscura, puntas claras */
  '    float hebra = texture2D(uRuido, vec2(vAux.z * 1.7 + vObj.x * 23.0 + vObj.z * 19.0, vAux.y * .35 + vObj.y * .4)).a;',
  '    float hebra2 = texture2D(uRuido, vec2(vAux.z * 3.1 + vObj.z * 31.0, vAux.y * .9)).b;',
  '    alb *= (.74 + .42 * hebra) * (.9 + .16 * hebra2) * mix(.8, 1.06, smoothstep(0.0, .5, vAux.y));',
  '    envuelve = .7; brillo = .5; dur = 46.0;',
  '  } else if (pid > 1.5 && pid < 2.5) {',
  /* el poncho de lana granate: franjas y rombos tejidos (diseño propio), tejido en sarga */
  '    float v = vAux.y, u = vAux.z;',
  '    vec3 base = vec3(.2, .04, .035), ocre = vec3(.5, .29, .07), crema = vec3(.7, .62, .47), oscuro = vec3(.06, .03, .025), verde = vec3(.06, .2, .14);',
  '    vec3 c0 = base;',
  '    float b = fract(v * 3.2);',
  '    c0 = mix(c0, crema, linea(b - .28, .012) + linea(b - .38, .012));',
  '    float zz = abs(fract(u * 26.0) - .5) * 2.0;',
  '    c0 = mix(c0, ocre, step(abs(b - .33 - (zz - .5) * .03), .03));',
  '    if (v > .78 && v < .95) {',
  '      float fv = (v - .78) / .17, ru = abs(fract(u * 18.0) - .5) * 2.0;',
  '      float rombo = step(abs(fv - .5) * 1.6 + ru * .55, .48), centro = step(abs(fv - .5) * 1.6 + ru * .55, .2);',
  '      c0 = mix(oscuro, ocre, rombo); c0 = mix(c0, verde, centro);',
  '      c0 = mix(c0, crema, step(.9, fv) + step(fv, .08));',
  '    }',
  '    alb = c0 * (.9 + .12 * step(.5, fract(u * 300.0 + v * 110.0)));',
  '    alb *= .86 + .2 * fib;',
  '    envuelve = .55; brillo = .05;',
  '  } else if (pid > 2.5 && pid < 3.5) {',
  /* la chuspa: franjas de colores vivos */
  '    float k = mod(floor(vAux.y * 140.0), 4.0);',
  '    alb = k < .5 ? vec3(.5, .08, .06) : k < 1.5 ? vec3(.62, .42, .07) : k < 2.5 ? vec3(.05, .25, .18) : vec3(.7, .64, .52);',
  '    alb *= .86 + .2 * fib;',
  '  } else if (pid > 6.5) {',
  /* camisa de lana de punto: costillas a lo largo del brazo */
  '    alb *= (.84 + .16 * step(.5, fract(vAux.z * 26.0))) * (.86 + .2 * fib);',
  '    envuelve = .55;',
  '  } else {',
  '    alb *= .84 + .24 * fib;',
  '  }',
  '  vec3 L = luzPlaza(vPos, n, envuelve) * uLuz;',
  '  float nv = max(dot(n, V), 0.0), borde = pow(1.0 - nv, 2.8);',
  '  vec3 c = alb * L + alb * borde * L * (pid > 5.5 && pid < 6.5 ? .9 : .35);',
  /* la piel deja pasar un poco de luz (más tibia en las sombras) */
  '  if (pid > 4.5 && pid < 5.5) c += alb * vec3(.22, .07, .04) * (1.0 - nv) * L;',
  '  c += brilloPlaza(vPos, n, V, dur) * brillo * (pid > 5.5 && pid < 6.5 ? alb * 1.2 : vec3(1.0));',
  /* capas de pelusa (solo en alta): el pelo y la lana se deshilachan en el borde */
  '  if (uCapa > 0.0) {',
  '    float dens = texture2D(uRuido, vObj.xy * 42.0 + vObj.zy * 37.0 + vObj.xz * 23.0).a;',
  '    if (dens < uCapa * .9 + .08 || vAux.w < .05) discard;',
  '    c *= 1.0 + uCapa * .25;',
  '  }',
  '  gl_FragColor = vec4(c, 1.0);',
  '#include <tonemapping_fragment>',
  '#include <encodings_fragment>',
  '}'
].join('\n');
/* lo duro: 0 plástico, jebe o madera · 1 metal · 3 luz (la lamparita, el brillo de los ojos);
   aux.z: gastado (rayones y polvo de mina) */
var FS_DURO = [
  'uniform samplerCube uEnv; uniform sampler2D uRuido; uniform float uLuz;',
  'varying vec3 vPos; varying vec3 vN; varying vec3 vCol; varying vec4 vAux; varying vec3 vObj;',
  'void main(){',
  '  vec3 V = normalize(cameraPosition - vPos); vec3 n = normalize(vN);',
  '  if (vAux.x > 2.5) { gl_FragColor = vec4(vCol * 1.25, 1.0);',
  '#include <tonemapping_fragment>',
  '#include <encodings_fragment>',
  '    return; }',
  '  float metal = step(.5, vAux.x) * step(vAux.x, 1.5), brillo = vAux.y;',
  '  float sc = texture2D(uRuido, vObj.xy * 9.0 + vObj.zy * 7.0).a, ray = texture2D(uRuido, vObj.xz * 31.0 + vObj.yx * 4.0).b;',
  '  vec3 alb = vCol * mix(1.0, (.72 + .34 * sc) * (.92 + .1 * ray), vAux.z);',
  '  brillo *= mix(1.0, .55 + .5 * sc, vAux.z);',
  '  vec3 R = reflect(-V, n); vec3 env = textureCube(uEnv, R).rgb; env *= env;',
  '  float fres = .04 + .96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);',
  '  vec3 dif = alb * luzPlaza(vPos, n, .1) * uLuz * (1.0 - metal * .7);',
  '  vec3 spec = brilloPlaza(vPos, n, V, 20.0 + brillo * 280.0) * brillo * (metal > .5 ? alb * 2.0 : vec3(1.4));',
  '  vec3 c = dif + spec + env * mix(fres * brillo, 1.0, metal) * (metal > .5 ? alb * 1.2 : vec3(1.0)) * (.4 + .6 * brillo);',
  '  gl_FragColor = vec4(c, 1.0);',
  '#include <tonemapping_fragment>',
  '#include <encodings_fragment>',
  '}'
].join('\n');

/* ---------- armar a Don Gruñón ---------- */
A.armarGrunon = function (escena, aj, env) {
  var geo = construir(aj);
  /* huesos en la pose de reposo */
  var huesos = [], porNombre = {}, mundo = {};
  HUESOS.forEach(function (h) {
    var b = new THREE.Bone(); b.name = h[0]; mundo[h[0]] = new V3(h[2], h[3], h[4]);
    if (h[1]) { b.position.copy(mundo[h[0]]).sub(mundo[h[1]]); porNombre[h[1]].add(b); } else b.position.copy(mundo[h[0]]);
    huesos.push(b); porNombre[h[0]] = b;
  });
  /* las inversas del esqueleto salen de las matrices de mundo: hay que calcularlas ANTES (si no,
     cada parte se corre hacia arriba lo que mide la altura de su hueso) */
  var raiz = new THREE.Group(); raiz.add(huesos[0]); raiz.updateMatrixWorld(true);
  var esq = new THREE.Skeleton(huesos);
  var ruido = A.texRuido();
  function matSuave(capa, desplaza) {
    return new THREE.ShaderMaterial({
      uniforms: A.unif({ uRuido: { value: ruido }, uConcha: { value: desplaza }, uCapa: { value: capa }, uLuz: { value: 1 } }),
      vertexShader: VS, fragmentShader: A.GLSL_LUZ + '\n' + FS_SUAVE, skinning: true, vertexColors: true
    });
  }
  var mF = matSuave(0, 0);
  var mD = new THREE.ShaderMaterial({ uniforms: A.unif({ uEnv: { value: env }, uRuido: { value: ruido }, uConcha: { value: 0 }, uLuz: { value: 1 } }), vertexShader: VS, fragmentShader: A.GLSL_LUZ + '\n' + FS_DURO, skinning: true, vertexColors: true });
  var cuerpo = new THREE.SkinnedMesh(geo.suave, mF), duro = new THREE.SkinnedMesh(geo.duro, mD);
  [cuerpo, duro].forEach(function (m) { m.frustumCulled = false; raiz.add(m); m.bind(esq); });
  /* capas de pelusa (solo en alta; comparten geometría y esqueleto) */
  var conchas = [], NC = aj.conchas || 0;
  for (var i = 1; i <= NC; i++) {
    var mc = matSuave(i / (NC + 1), .0012 * i * (6 / Math.max(NC, 1)) * .7 + .0003 * i);
    var sm = new THREE.SkinnedMesh(geo.suave, mc); sm.frustumCulled = false; raiz.add(sm); sm.bind(esq); conchas.push(sm);
  }
  var mats = [mF, mD].concat(conchas.map(function (c) { return c.material; }));
  escena.add(raiz);
  /* la lamparita del casco alumbra de verdad: una luz cálida de la plaza que lo sigue */
  var luzLamp = A.agregarLuz(0, -50, 0, '#FFD7A0', .85, 4.2); luzLamp.on = 0;
  var lampLocal = new V3().copy(LAMPARA).sub(new V3(HUESOS[IDX.cabeza][2], HUESOS[IDX.cabeza][3], HUESOS[IDX.cabeza][4])).add(new V3(0, -.02, .14));

  /* ---------- las poses ---------- */
  var base = {}, meta = {}, H = porNombre;
  huesos.forEach(function (b) { base[b.name] = b.quaternion.clone(); meta[b.name] = b.quaternion.clone(); });
  var e = new THREE.Euler(), q = new THREE.Quaternion();
  function rot(n, x, y, z) { if (!H[n]) return; e.set(x || 0, y || 0, z || 0); meta[n].copy(base[n]).multiply(q.setFromEuler(e)); }
  var t = 0, fase = 0, parpa = 2, caderaY0 = H.cadera.position.y, caderaY = caderaY0, primera = true;
  /* resortes del pelo de la espalda ("bufanda") y de los costados ("trenzas") */
  var res = { buf: [0, 0, 0, 0], bufV: [0, 0, 0, 0], tri: [0, 0, 0], triV: [0, 0, 0] };
  var G = {
    raiz: raiz, huesos: H, mats: mats, alto: GANCHO, gancho: GANCHO,
    estado: 'quieto', vel: 0, giroV: 0,
    cara: { parpado: .45, ceja: -1, boca: 0 },
    /* objetos en la mano (esfera, estrella, taza): se cuelgan de manoI */
    mano: H.manoI,
    cuadro: function (dt) {
      t += dt;
      var st = G.estado, v = G.vel, k;
      for (var n in meta) meta[n].copy(base[n]);
      var resp = Math.sin(t * 2.2), cara = { parpado: .4, ceja: -.6, boca: 0 };
      var anda = st === 'anda' || st === 'corre', corre = st === 'corre';
      fase += dt * (anda ? (corre ? 13 : 8) * Math.max(.6, Math.min(1.4, v / (corre ? 2.6 : 1))) : 0);
      var s = Math.sin(fase), c = Math.cos(fase), A1 = corre ? 1 : anda ? .6 : 0, sube = 0;
      /* brazos bajos y relajados por defecto (en reposo cuelgan derechos) */
      rot('hombroI', 0, 0, .14); rot('hombroD', 0, 0, -.14);
      rot('codoI', -.15, 0, 0); rot('codoD', -.15, 0, 0);
      if (anda) {
        /* con sus pies grandes se bambolea un poco al andar, como pato */
        rot('cadera', 0, s * .12 * A1, c * .09 * A1);
        rot('columna', .08 * A1 + (corre ? .22 : 0), -s * .1 * A1, -c * .05 * A1);
        rot('musloI', -s * .7 * A1, 0, -.06 * A1); rot('musloD', s * .7 * A1, 0, .06 * A1);
        rot('rodillaI', Math.max(0, c) * 1.0 * A1 + .05, 0, 0); rot('rodillaD', Math.max(0, -c) * 1.0 * A1 + .05, 0, 0);
        rot('pieI', -Math.max(0, -c) * .35 * A1, -.15 * A1, 0); rot('pieD', -Math.max(0, c) * .35 * A1, .15 * A1, 0);
        rot('hombroI', s * .7 * A1, 0, .22); rot('hombroD', -s * .7 * A1, 0, -.22);
        rot('codoI', -.5 - (corre ? .7 : 0), 0, 0); rot('codoD', -.5 - (corre ? .7 : 0), 0, 0);
        rot('cabeza', -.05 * A1 + (corre ? -.15 : 0), s * .06 * A1, 0);
        sube = Math.abs(c) * (corre ? .035 : .015);
        cara.ceja = corre ? -.2 : -.6; cara.boca = corre ? .35 : 0; cara.parpado = corre ? .3 : .45;
      } else if (st === 'quieto') {
        /* apoyado en su picota, golpecitos con el pie, mira de reojo */
        rot('columna', .05 + resp * .015, 0, 0); rot('cabeza', .05, Math.sin(t * 1.3) * .22 * (Math.sin(t * .4) > .3 ? 1 : .15), 0);
        rot('hombroD', -.35, 0, -.12); rot('codoD', -.6, 0, 0);
        rot('hombroI', .1, 0, .35); rot('codoI', -1.2, .3, 0);
        var golpe = Math.max(0, Math.sin(t * 7)) * (Math.sin(t * .9) > 0 ? 1 : 0); rot('musloI', -.05, 0, 0); rot('pieI', -golpe * .3, 0, 0);
        cara.ceja = -.8; cara.parpado = .45;
      } else if (st === 'rie') {
        /* risa: echado atrás, panza que sacude, manos en la panza, boca abierta, ojos cerrados */
        var sac = Math.sin(t * 22) * .5 + .5;
        rot('columna', -.18 - sac * .04, 0, 0); rot('pecho', -.1, 0, Math.sin(t * 11) * .04); rot('cabeza', -.35 + sac * .05, 0, 0);
        rot('hombroI', -.55, 0, .55); rot('codoI', -1.65, 0, .2); rot('hombroD', -.55, 0, -.55); rot('codoD', -1.65, 0, -.2);
        sube = sac * .012; cara.boca = .65 + sac * .35; cara.parpado = 1; cara.ceja = .4;
      } else if (st === 'encoge') {
        /* encogido: agachado, brazos sobre el casco, tiembla */
        var tiem = Math.sin(t * 40) * .02;
        rot('columna', .45, 0, tiem); rot('cabeza', .4, 0, 0);
        rot('musloI', -1.0, 0, -.12); rot('musloD', -1.0, 0, .12); rot('rodillaI', 1.7, 0, 0); rot('rodillaD', 1.7, 0, 0); rot('pieI', -.6, 0, 0); rot('pieD', -.6, 0, 0);
        rot('hombroI', -2.3, 0, .45); rot('codoI', -1.4, 0, 0); rot('hombroD', -2.3, 0, -.45); rot('codoD', -1.4, 0, 0);
        sube = -.1; cara.parpado = 1; cara.ceja = .6; cara.boca = .15;
      } else if (st === 'triste') {
        rot('columna', .2, 0, 0); rot('cabeza', .32, 0, 0); rot('hombroI', 0, 0, .05); rot('hombroD', 0, 0, -.05);
        cara.parpado = .55; cara.ceja = 1; cara.boca = 0;
      } else if (st === 'mira') {
        /* mira para arriba, a las fotos del árbol, con la boca un poco abierta */
        rot('columna', -.08, 0, 0); rot('cuello', -.25, 0, 0); rot('cabeza', -.35, Math.sin(t * .6) * .15, 0);
        rot('hombroD', -.2, 0, -.1); rot('codoD', -.5, 0, 0);
        cara.parpado = .05; cara.ceja = .8; cara.boca = .25;
      } else if (st === 'ofrece') {
        rot('columna', .12, 0, 0); rot('cabeza', .1, 0, .12);
        rot('hombroI', -1.25, 0, -.1); rot('codoI', -.35, 0, 0); rot('hombroD', -1.25, 0, .1); rot('codoD', -.35, 0, 0);
        cara.parpado = .2; cara.ceja = .7; cara.boca = .1;
      } else if (st === 'toma') {
        /* sorbe el chocolate: la mano izquierda (con la taza) a la boca */
        var sorbo = (Math.sin(t * 1.6) > .2) ? 1 : 0;
        rot('hombroI', -1.05 - sorbo * .25, -.35, -.35); rot('codoI', -1.95, 0, 0); rot('cabeza', -.08 * sorbo, 0, 0);
        rot('hombroD', -.4, 0, -.15); rot('codoD', -.9, 0, 0);
        cara.parpado = sorbo ? .85 : .25; cara.ceja = .9; cara.boca = 0;
      } else if (st === 'abraza') {
        rot('columna', .1, 0, 0); rot('cabeza', .15, .35, .2);
        rot('hombroI', -1.35, .2, .55); rot('codoI', -.9, 0, -.4); rot('hombroD', -1.35, -.2, -.55); rot('codoD', -.9, 0, .4);
        cara.parpado = 1; cara.ceja = .9; cara.boca = 0;
      } else if (st === 'colgado') {
        /* colgado del árbol por el gancho del casco, alumbrando: piernas sueltas que se mecen, saluda */
        var mec = Math.sin(t * 1.4);
        rot('musloI', -.25 + mec * .25, 0, -.08); rot('musloD', -.25 - mec * .25, 0, .08); rot('rodillaI', .5 + mec * .2, 0, 0); rot('rodillaD', .5 - mec * .2, 0, 0);
        rot('hombroI', -2.6, 0, .2 + Math.sin(t * 7) * .25); rot('codoI', -.4, 0, 0);
        rot('hombroD', -.2, 0, -.3); rot('codoD', -.4, 0, 0);
        cara.parpado = .05; cara.ceja = .9; cara.boca = .35;
      } else if (st === 'saluda') {
        rot('hombroI', -2.5, 0, .25 + Math.sin(t * 8) * .3); rot('codoI', -.5, 0, 0); cara.parpado = .1; cara.ceja = .8; cara.boca = .3;
      }
      /* lo que pide la escena por encima (cara de "se ablanda", etc.) */
      if (G.forzarCara) { var fc = G.forzarCara; if (fc.parpado !== undefined) cara.parpado = fc.parpado; if (fc.ceja !== undefined) cara.ceja = fc.ceja; if (fc.boca !== undefined) cara.boca = fc.boca; }
      /* parpadeo */
      parpa -= dt; var bl = 0; if (parpa < .13) bl = Math.sin(Math.max(0, parpa) / .13 * Math.PI); if (parpa <= 0) parpa = 2.2 + Math.random() * 2.5;
      var cl = Math.max(cara.parpado, bl);
      G.cara.parpado += (cl - G.cara.parpado) * Math.min(1, dt * 18); G.cara.ceja += (cara.ceja - G.cara.ceja) * Math.min(1, dt * 6); G.cara.boca += (cara.boca - G.cara.boca) * Math.min(1, dt * 14);
      /* párpado: girado hacia arriba (abierto) o tapando el ojo (cerrado) */
      var pa = -2.4 + 2.4 * Math.pow(Math.max(0, G.cara.parpado), 1.8); rot('parpadoI', pa, 0, 0); rot('parpadoD', pa, 0, 0);
      /* cejas: −1 ceñudo (de adentro abajo), +1 tierno (de adentro arriba) */
      rot('cejaI', 0, 0, -G.cara.ceja * .28); rot('cejaD', 0, 0, G.cara.ceja * .28);
      rot('boca', G.cara.boca * .25, 0, 0);
      /* resortes: el pelo largo se queda atrás cuanto más rápido va, y se mece */
      var empuje = Math.min(1.6, v * .5), dtr = Math.min(dt, .033);
      for (var b = 0; b < 4; b++) {
        var obj = -empuje * (.32 + b * .1) - Math.sin(t * 2.1 + b) * .03 * (1 + empuje);
        res.bufV[b] += ((obj - res.buf[b]) * 60 - res.bufV[b] * 9) * dtr; res.buf[b] += res.bufV[b] * dtr;
        rot('bufanda' + b, res.buf[b], 0, Math.sin(t * 2.6 + b) * .04 * empuje);
      }
      for (b = 0; b < 3; b++) {
        var obj2 = -empuje * .25 - G.giroV * .06 + Math.sin(fase * .5 + b) * .08 * A1;
        res.triV[b] += ((obj2 - res.tri[b]) * 70 - res.triV[b] * 8) * dtr; res.tri[b] += res.triV[b] * dtr;
        rot('trenzaI' + b, res.tri[b], 0, -.03); rot('trenzaD' + b, res.tri[b], 0, .03);
      }
      k = primera ? 1 : 1 - Math.exp(-dt * (anda ? 16 : 9)); primera = false;
      for (n in meta) H[n].quaternion.slerp(meta[n], n.indexOf('parpado') === 0 || n === 'boca' ? 1 : k);
      caderaY += (caderaY0 + sube - caderaY) * Math.min(1, dt * 14); H.cadera.position.y = caderaY;
    },
    /* la lamparita: sigue a la cabeza; se apaga si él no se ve. Se llama cada cuadro (sin crear nada) */
    alumbrar: function () {
      if (!raiz.visible) { luzLamp.on = 0; return; }
      luzLamp.p.copy(lampLocal); H.cabeza.localToWorld(luzLamp.p); luzLamp.on = 1; luzLamp.i = .85 * raiz.scale.x;
    },
    /* la luz de su material (para atenuarlo en la portada, por ejemplo) */
    luz: function (k) { mats.forEach(function (m) { if (m.uniforms.uLuz) m.uniforms.uLuz.value = k; }); },
    /* dónde está su mano izquierda en el mundo (para poner la esfera o la taza) */
    puntoMano: function (out) { return H.manoI.getWorldPosition(out || new V3()); },
    cabezaMundo: function (out) { return H.cabeza.getWorldPosition(out || new V3()); }
  };
  return G;
};
})();

;
/* El árbol que se enciende — prototipo.
   ruway.js: Ruway (VRoid) con sus movimientos.

   Reglas (§23): el GLB se usa tal cual; no se cambian los huesos J_Bip_*, ni los índices de
   morph (0 ojos, 1 alegría, 2 boca), ni las zonas del atlas. Los movimientos salen de
   lib/ruway-movs.json (24 clips en Int16, mismo formato de siempre) y se reproducen con una
   capa propia por hueso (slerp), sin AnimationMixer, como en Experiencias.html: caminar y
   correr se mezclan con la velocidad; recoger, saltar y trepar son acciones de una vez.
   Si los movimientos no llegan, queda el paso hecho a mano.

   Piel: Lambert (barato, ilumina por vértice) con un brillo propio bajito para que de noche
   la cara no se apague. Lo que tiene en la mano (la esfera, la taza) cuelga de su mano derecha. */
(function () {
'use strict';
var A = window.Arbol;

A.cargarGLB = function (url, listo) {
  var hecho = false, reloj = setTimeout(function () { fin(null); }, 30000);
  function fin(x) { if (hecho) return; hecho = true; clearTimeout(reloj); listo(x); }
  try { new THREE.GLTFLoader().load(url, function (gl) { fin(gl.scene); }, null, function () { fin(null); }); }
  catch (e) { fin(null); }
};
/* ---- los movimientos (mismo lector que Experiencias.html) ---- */
var MOVS = null, esperan = [], pedido = false;
A.cargarMovs = function (url, cb) {
  if (MOVS) { if (cb) cb(MOVS); return; }
  if (cb) esperan.push(cb); if (pedido) return; pedido = true;
  try {
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      MOVS = leerMovs(j); var l = esperan; esperan = []; l.forEach(function (f) { try { f(MOVS); } catch (e) {} });
    }, function () { var l = esperan; esperan = []; l.forEach(function (f) { try { f(null); } catch (e) {} }); });
  } catch (e) {}
};
function leerMovs(j) {
  var out = {};
  Object.keys(j.clips || {}).forEach(function (nom) {
    var c = j.clips[nom], bin = atob(c.d), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var a = new Int16Array(u.buffer), o = 0, hs = [];
    j.huesos.forEach(function (nb) { var fijo = c.fijo.charAt(hs.length) === '1', k = fijo ? 1 : c.n, q = new Float32Array(k * 4); for (var m = 0; m < k * 4; m++) q[m] = a[o++] / 32767; hs.push({ n: nb, fijo: fijo, q: q }); });
    var p = new Float32Array(c.n * 3); for (var m = 0; m < c.n * 3; m++) p[m] = a[o++] / 1000;
    out[nom] = { n: c.n, fps: c.fps, loop: !!c.loop, dur: (c.n - 1) / c.fps, h: hs, p: p };
  });
  return out;
}

A.armarRuway = function (escena3d, op) {
  op = op || {};
  var H = {}, cara = null, mallas = [];
  escena3d.traverse(function (o) {
    if (o.isBone) H[o.name.replace(/^J_Bip_/, '')] = o;
    if (o.isMesh) { o.frustumCulled = false; mallas.push(o); if (o.morphTargetInfluences && o.morphTargetInfluences.length >= 3) cara = o; }
  });
  mallas.forEach(function (o) {
    var viejo = o.material, esCara = o === cara;
    var m = new THREE.MeshLambertMaterial({ map: viejo.map, alphaTest: .5, skinning: !!o.isSkinnedMesh, morphTargets: !!o.morphTargetInfluences,
      color: esCara ? '#FFE6DA' : '#FFFFFF', emissive: esCara ? '#FFC6A8' : '#E8D6CC', emissiveMap: viejo.map, emissiveIntensity: esCara ? .1 : .07 });
    if (viejo.map) viejo.map.anisotropy = 4;
    o.material = m; viejo.dispose();
  });
  var caja = new THREE.Box3().setFromObject(escena3d), v = new THREE.Vector3();
  var altoArchivo = caja.max.y - caja.min.y || 1.82;
  var raiz = new THREE.Group(), k = (op.alto || 1.45) / altoArchivo;
  var esc = new THREE.Group(); esc.scale.setScalar(k); esc.add(escena3d); raiz.add(esc);
  escena3d.position.y = -caja.min.y;
  escena3d.updateMatrixWorld(true);
  var base = {}, meta = {}; Object.keys(H).forEach(function (n) { base[n] = H[n].quaternion.clone(); meta[n] = H[n].quaternion.clone(); });
  var cadera0 = H.C_Hips ? H.C_Hips.position.clone() : new THREE.Vector3(), kC = cadera0.y ? cadera0.y / .663 : 1;
  var e = new THREE.Euler(), q = new THREE.Quaternion(), qc = new THREE.Quaternion(), qc2 = new THREE.Quaternion();
  function rot(n, x, y, z) { if (!H[n]) return; e.set(x || 0, y || 0, z || 0); meta[n].copy(base[n]).multiply(q.setFromEuler(e)); }
  function largo(a, b) { return H[a].getWorldPosition(new THREE.Vector3()).distanceTo(H[b].getWorldPosition(new THREE.Vector3())); }
  var LA = {};
  /* IK de dos huesos (hombro → codo → mano): destino y polo en el mundo */
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
    if (!H[lado + '_UpperArm']) return;
    if (!LA[lado]) LA[lado] = [largo(lado + '_UpperArm', lado + '_LowerArm'), largo(lado + '_LowerArm', lado + '_Hand')];
    var sup = H[lado + '_UpperArm'], inf = H[lado + '_LowerArm'], mano = H[lado + '_Hand'], a = LA[lado][0], b = LA[lado][1];
    sup.getWorldPosition(vS);
    vU.copy(destino).sub(vS); var d = Math.max(.001, Math.min(vU.length(), (a + b) * .999)); vU.normalize();
    var x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    vQ.copy(vU).multiplyScalar(polo.dot(vU)); vP.copy(polo).sub(vQ).normalize();
    vE.copy(vS).addScaledVector(vU, x).addScaledVector(vP, h);
    vT.copy(vS).addScaledVector(vU, d);
    apuntar(sup, inf, vE); apuntar(inf, mano, vT);
  }
  /* ---- la capa de movimientos ---- */
  var capa = { nom: '', c: null, t: 0, vel: 1, w: 0, sale: false, acc: null, fin: null, y: 0 };
  var SOLO_POSE = { saltar: 1, saltoCorre: 1, caer: 1, trepar: 1, recoger: 1 };
  A.cargarMovs(op.movs || 'lib/ruway-movs.json');
  function sonar(nom, o) { o = o || {}; var c = MOVS && MOVS[nom]; if (!c) return false;
    if (capa.nom === nom && !capa.sale && !o.otraVez) { capa.vel = o.vel || capa.vel; return true; }
    capa.nom = nom; capa.c = c; capa.t = o.desde || 0; capa.vel = o.vel || 1; capa.sale = false; return true; }
  function capaCuadro(dt, quiere, vel) {
    if (!MOVS) { capa.w = Math.max(0, capa.w - dt * 6); return; }
    if (capa.acc) quiere = capa.acc;
    if (quiere) { if (capa.nom !== quiere || capa.sale) sonar(quiere, { vel: vel, otraVez: !!capa.acc }); else if (!capa.acc) capa.vel = vel; }
    else if (capa.c) capa.sale = true;
    var c = capa.c; if (!c) { capa.w = 0; return; }
    capa.t += dt * capa.vel;
    if (capa.t >= c.dur) {
      if (c.loop && !capa.acc) capa.t %= c.dur;
      else if (capa.acc) { capa.acc = null; capa.t = c.dur; capa.sale = true; var f = capa.fin; capa.fin = null; if (f) setTimeout(f, 0); }
      else capa.t = c.dur;
    }
    capa.w += ((capa.sale ? 0 : 1) - capa.w) * Math.min(1, dt * (capa.sale ? 6 : 10));
    if (capa.sale && capa.w < .01) { capa.w = 0; capa.c = null; capa.nom = ''; return; }
    var x = Math.min(capa.t, c.dur) * c.fps, i = Math.min(c.n - 1, Math.floor(x)), j = Math.min(c.n - 1, i + 1), f2 = x - i, w = capa.w;
    if (c.loop && i === c.n - 1) j = 0;
    for (var b = 0; b < c.h.length; b++) {
      var hb = c.h[b]; if (!meta[hb.n]) continue; var qq = hb.q, o1 = hb.fijo ? 0 : i * 4, o2 = hb.fijo ? 0 : j * 4;
      qc.set(qq[o1], qq[o1 + 1], qq[o1 + 2], qq[o1 + 3]); if (!hb.fijo) { qc2.set(qq[o2], qq[o2 + 1], qq[o2 + 2], qq[o2 + 3]); qc.slerp(qc2, f2); } qc.normalize();
      meta[hb.n].slerp(qc, w);
    }
    var p = c.p, y = p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * f2; if (SOLO_POSE[capa.nom]) y = Math.max(-.4, Math.min(.35, y));
    capa.y = y * w;
  }
  var t = 0, fase = 0, parpa = 2, andar = 0, trote = 0, caderaY = cadera0.y, primera = true;
  var R = {
    raiz: raiz, H: H, cara: cara, mallas: mallas, alto: op.alto || 1.45, k: k, ik: ik, rot: rot,
    modo: 'quieto', vel: 0, pose: null, mirar: null, sonrisa: .35, boca: 0,
    movs: function () { return !!MOVS; },
    accion: function (nom, fin) { if (!MOVS || !MOVS[nom]) { if (fin) setTimeout(fin, 400); return false; } capa.acc = nom; capa.fin = fin || null; sonar(nom, { otraVez: 1 }); return true; },
    haciendo: function () { return capa.acc; },
    /* posa cada cuadro: locomoción + capa + pose propia (para el final) */
    cuadro: function (dt) {
      t += dt;
      for (var n in meta) meta[n].copy(base[n]);
      var modo = R.modo, anda = modo === 'anda' || modo === 'corre', corre = modo === 'corre', vel = R.vel;
      andar += ((anda ? 1 : 0) - andar) * Math.min(1, dt * 6); trote += ((corre ? 1 : 0) - trote) * Math.min(1, dt * 5);
      fase += dt * (7 + 4 * trote) * Math.max(.3, vel / (corre ? 4 : 1.6)) * Math.max(.001, andar);
      var s = Math.sin(fase), c = Math.cos(fase), Am = (.5 + .45 * trote) * andar, resp = Math.sin(t * 2.1), abajo = 1.2;
      /* de pie: brazos abajo, respiración, la cabeza mira un poquito alrededor */
      rot('C_Spine', .03 * andar + .18 * trote + resp * .012 * (1 - andar), 0, 0); rot('C_UpperChest', resp * .015, 0, 0);
      rot('L_UpperArm', -s * Am * .9, 0, -abajo + .06 * Am); rot('R_UpperArm', s * Am * .9, 0, abajo - .06 * Am);
      rot('L_LowerArm', 0, -(.15 + .25 * andar + .8 * trote), 0); rot('R_LowerArm', 0, (.15 + .25 * andar + .8 * trote), 0);
      rot('L_Hand', 0, 0, -.12); rot('R_Hand', 0, 0, .12);
      rot('L_UpperLeg', -s * Am * 1.05, 0, .02); rot('R_UpperLeg', s * Am * 1.05, 0, -.02);
      rot('L_LowerLeg', Math.max(0, c) * Am * 1.5 + .03, 0, 0); rot('R_LowerLeg', Math.max(0, -c) * Am * 1.5 + .03, 0, 0);
      rot('C_Head', (1 - andar) * Math.sin(t * .45) * .04, (1 - andar) * Math.sin(t * .7) * .12, 0);
      var arriba = -Math.abs(c) * .035 * Am;
      /* la capa de Mixamo: caminar o correr según la velocidad */
      var quiere = anda ? (corre ? 'correr' : 'caminar') : null, vc = corre ? Math.max(.7, Math.min(1.4, vel / 4.2)) : Math.max(.55, Math.min(1.5, vel / 1.5));
      capaCuadro(dt, quiere, vc);
      var wc = capa.c ? capa.w : 0;
      /* poses propias del final (encima de todo) */
      var P = R.pose;
      if (P === 'ofrece') { rot('R_UpperArm', -1.1, .2, .35); rot('R_LowerArm', 0, .9, 0); rot('L_UpperArm', 0, 0, -1.15); rot('C_Spine', .12, 0, 0); rot('C_Head', .25, 0, 0); }
      else if (P === 'agacha') { rot('L_UpperLeg', -1.2, 0, 0); rot('R_UpperLeg', -1.2, 0, 0); rot('L_LowerLeg', 1.9, 0, 0); rot('R_LowerLeg', 1.9, 0, 0); rot('C_Spine', .35, 0, 0); rot('C_Head', .2, 0, 0); arriba = -.32; }
      else if (P === 'alcanza') { rot('R_UpperArm', -2.35, 0, .3); rot('R_LowerArm', 0, .3, 0); rot('L_UpperArm', -2.2, 0, -.3); rot('L_LowerArm', 0, -.3, 0); rot('C_Spine', -.1, 0, 0); rot('C_Head', -.35, 0, 0); arriba = .03; }
      else if (P === 'mira') { rot('C_Head', -.4, 0, 0); rot('C_Spine', -.06, 0, 0); }
      else if (P === 'celebra') { var bb = Math.sin(t * 7); rot('R_UpperArm', -2.5, 0, .3 + bb * .2); rot('L_UpperArm', -2.5, 0, -.3 - bb * .2); rot('C_Head', -.3, bb * .1, 0); arriba = Math.max(0, bb) * .05; }
      var kq = primera ? 1 : 1 - Math.exp(-dt * (anda ? 16 : 10)); kq += (1 - kq) * wc * .85; primera = false;
      if (P) kq = Math.min(1, dt * 8);
      for (n in meta) H[n].quaternion.slerp(meta[n], kq);
      caderaY += (cadera0.y + arriba * (1 - wc) / k + (wc ? capa.y * kC : 0) - caderaY) * Math.min(1, dt * (wc > .5 ? 30 : 14));
      if (H.C_Hips) H.C_Hips.position.y = caderaY;
      /* cara: parpadea y sonríe */
      if (cara) {
        parpa -= dt; var bl = 0; if (parpa < .14) bl = Math.sin(Math.max(0, parpa) / .14 * Math.PI); if (parpa <= 0) parpa = 2 + Math.random() * 3;
        if (P === 'abraza') bl = .85;
        cara.morphTargetInfluences[0] = bl;
        cara.morphTargetInfluences[1] += ((corre ? .7 : R.sonrisa) - cara.morphTargetInfluences[1]) * Math.min(1, dt * 6);
        cara.morphTargetInfluences[2] = corre ? .25 : R.boca;
      }
      raiz.updateMatrixWorld(true);
    },
    manoDer: function (out) { return (H.R_Hand || raiz).getWorldPosition(out || new THREE.Vector3()); },
    pecho: function (out) { return (H.C_UpperChest || raiz).getWorldPosition(out || new THREE.Vector3()); },
    cabeza: function (out) { return (H.C_Head || raiz).getWorldPosition(out || new THREE.Vector3()); }
  };
  R.cuadro(0);
  return R;
};
})();

;
/* El árbol que se enciende — prototipo.
   efectos.js: chispas, fuegos artificiales, nieve mágica, vapor y los haces de luz.

   Todo son sistemas de puntos de tamaño fijo creados una vez (ningún objeto nuevo por cuadro):
   cada uno tiene su cola circular de partículas y un shader con caída gaussiana.

   - Chispas: brillitos de magia (cuando se encuentra una esfera, cuando Don Gruñón aparece o
     se achica, cuando sube la estrella).
   - Fuegos: los del chasqui (maquetas/chasqui/fuegos.js) sobre la plaza, con un tipo nuevo:
     ESTRELLA de cinco puntas, además de corazones, palmeras y crisantemos. Sin reflejo en el
     agua (aquí no hay mar). Con "reducido" salen menos y sin destellos fuertes.
   - Nieve mágica: en la costa no nieva, así que cae nieve DORADA, despacito, que titila.
   - Vapor: el del chocolate caliente (la olla del puesto y la taza).
   - Haz: la columna de luz suave que sube de cada esfera escondida (se ve desde lejos). */
(function () {
'use strict';
var A = window.Arbol;

function puntos(N, frag, extraU, orden) {
  var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tam = new Float32Array(N), alfa = new Float32Array(N);
  for (var i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('tam', new THREE.BufferAttribute(tam, 1)); g.setAttribute('alfa', new THREE.BufferAttribute(alfa, 1));
  var U = { uPr: { value: 1 }, uAlto: { value: 800 } }; if (extraU) for (var k in extraU) U[k] = extraU[k];
  var m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float tam; attribute float alfa; uniform float uPr, uAlto; varying vec3 vC; varying float vA; void main(){ vC = color; vA = alfa; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, tam * uAlto * .02 / -mv.z) * uPr; gl_Position = projectionMatrix * mv; }',
    fragmentShader: frag || 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); float a = (exp(-r * 40.0) + exp(-r * 9.0) * .35) * vA * (1.0 - smoothstep(.2, .25, r)); gl_FragColor = vec4(vC * a * 1.8, 1.0); }'
  });
  var p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = orden || 6;
  return { p: p, g: g, m: m, pos: pos, col: col, tam: tam, alfa: alfa, N: N, medir: function (pr, alto) { m.uniforms.uPr.value = pr; m.uniforms.uAlto.value = alto; } };
}

/* ---------- chispas ---------- */
A.armarChispas = function (escena, n) {
  var S = puntos(n), P = [], sig = 0, vivas = 0;
  for (var i = 0; i < n; i++) P.push({ v: 0 });
  escena.add(S.p);
  return {
    medir: S.medir,
    chispa: function (x, y, z, vx, vy, vz, dur, tam, r, g, b, gr) {
      var p = P[sig]; sig = (sig + 1) % n;
      p.v = 1; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.t = 0; p.d = dur; p.tam = tam; p.r = r; p.g = g; p.b = b; p.gr = gr === undefined ? 1.5 : gr;
    },
    /* un estallido de magia alrededor de un punto */
    estallido: function (c, cuantas, fuerza, col) {
      for (var i = 0; i < cuantas; i++) {
        var a = Math.random() * 6.283, u = Math.random() * 2 - 1, rr = Math.sqrt(1 - u * u), v = fuerza * (.4 + Math.random() * .6);
        this.chispa(c.x, c.y, c.z, Math.cos(a) * rr * v, u * v + fuerza * .3, Math.sin(a) * rr * v, .7 + Math.random() * .7, 5 + Math.random() * 5, col[0], col[1], col[2], .9);
      }
    },
    cuadro: function (dt) {
      vivas = 0;
      for (var i = 0; i < n; i++) {
        var p = P[i];
        if (!p.v) { S.alfa[i] = 0; continue; }
        p.t += dt; if (p.t >= p.d) { p.v = 0; S.alfa[i] = 0; S.pos[i * 3 + 1] = -999; continue; }
        vivas++;
        var dr = Math.exp(-1.6 * dt); p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - p.gr * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        var k = p.t / p.d;
        S.pos[i * 3] = p.x; S.pos[i * 3 + 1] = p.y; S.pos[i * 3 + 2] = p.z;
        S.col[i * 3] = p.r; S.col[i * 3 + 1] = p.g; S.col[i * 3 + 2] = p.b;
        S.tam[i] = p.tam * (1 - k * .5); S.alfa[i] = Math.min(1, (1 - k) * 2.2) * (.75 + .25 * Math.sin(p.t * 30 + i));
      }
      if (vivas || this._antes) { S.g.attributes.position.needsUpdate = true; S.g.attributes.color.needsUpdate = true; S.g.attributes.tam.needsUpdate = true; S.g.attributes.alfa.needsUpdate = true; }
      this._antes = vivas > 0;
    }
  };
};

/* ---------- fuegos artificiales ---------- */
A.armarFuegos = function (escena, aj, sonar) {
  var N = aj.fuegos, S = puntos(N, null, null, 7), P = [];
  for (var i = 0; i < N; i++) P.push({ v: 0 });
  S.p.visible = false; escena.add(S.p);
  /* una sola luz, siempre presente (no recompila shaders), apagada hasta que estalla algo */
  var luz = A.agregarLuz(0, 25, -20, '#ffffff', 0, 60); luz.on = 0;
  var luzI = 0, flash = new THREE.Color(0, 0, 0), flashCol = new THREE.Color();
  var sig = 0;
  function chispa(o) { var p = P[sig]; sig = (sig + 1) % N; for (var k in o) p[k] = o[k]; p.v = 1; p.t = 0; return p; }
  var COLORES = { rojo: [1.0, .16, .22], rosa: [1.0, .42, .7], oro: [1.0, .72, .3], blanco: [1, .95, .85], violeta: [.75, .45, 1], verde: [.4, 1, .55], celeste: [.45, .8, 1] };
  var cam = null, vr = new THREE.Vector3(), vu = new THREE.Vector3(), vf = new THREE.Vector3();
  var cohetes = [], libres = [];
  for (i = 0; i < 12; i++) libres.push({});
  var mult = N >= 3000 ? 1 : N >= 2000 ? .75 : .42, red = A.reducido;
  function lanzar(x, z, alto, tipo, color) {
    var c = libres.pop(); if (!c) return;
    c.x = x; c.y = 0; c.z = z; c.vy = 24 + alto * .28; c.ap = alto; c.tipo = tipo; c.col = color; c.t = 0; c.deriva = (Math.random() - .5) * 2;
    cohetes.push(c); if (sonar) sonar('silbido', 0);
  }
  function enPlano(c, hx, hy, s, d, tam, col, extra) {
    return chispa({ x: c.x, y: c.y, z: c.z, vx: (vr.x * hx + vu.x * hy) * s, vy: (vr.y * hx + vu.y * hy) * s, vz: (vr.z * hx + vu.z * hy) * s, d: d, tam: tam, r: col[0], g: col[1], b: col[2], gr: 1.2, drag: 1.25, rastro: 0, parpa: !!extra });
  }
  function estallar(c) {
    var col = COLORES[c.col], esc = .8 + Math.random() * .3, i;
    luz.p.set(c.x, c.y, c.z); luz.col.setRGB(col[0], col[1], col[2]); luzI = red ? .5 : 1.2;
    flashCol.setRGB(col[0], col[1], col[2]).multiplyScalar(red ? .015 : .04); flash.add(flashCol);
    chispa({ x: c.x, y: c.y, z: c.z, vx: 0, vy: 0, vz: 0, d: .25, tam: red ? 30 : 60, r: 1, g: .95, b: .85, gr: 0, drag: 0, rastro: 0 });
    if (cam) { cam.getWorldDirection(vf); vr.crossVectors(vf, cam.up).normalize(); vu.crossVectors(vr, vf).normalize(); }
    if (c.tipo === 'corazon') {
      var m2 = Math.round(150 * mult);
      for (i = 0; i < m2; i++) { var t = i / m2 * Math.PI * 2, hx = 16 * Math.pow(Math.sin(t), 3), hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); enPlano(c, hx, hy, 1.05 * esc * (.97 + Math.random() * .06), 2.4 + Math.random() * .5, 30, col, c.col === 'oro'); }
      var col2 = COLORES[c.col === 'oro' ? 'rojo' : 'oro'];
      for (i = 0; i < m2 * .45; i++) { var t2 = i / (m2 * .45) * Math.PI * 2; enPlano(c, 16 * Math.pow(Math.sin(t2), 3), 13 * Math.cos(t2) - 5 * Math.cos(2 * t2) - 2 * Math.cos(3 * t2) - Math.cos(4 * t2), .5 * esc, 2, 24, col2, true); }
    } else if (c.tipo === 'estrella') {
      /* estrella de cinco puntas: el contorno, en el plano que mira a la cámara */
      var m3 = Math.round(170 * mult), V = [];
      for (i = 0; i < 10; i++) { var a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 17; V.push([Math.cos(a) * r, Math.sin(a) * r]); }
      for (i = 0; i < m3; i++) { var f = i / m3 * 10, k0 = Math.floor(f), kk = f - k0, P0 = V[k0 % 10], P1 = V[(k0 + 1) % 10]; enPlano(c, P0[0] + (P1[0] - P0[0]) * kk, P0[1] + (P1[1] - P0[1]) * kk, 1.0 * esc, 2.3 + Math.random() * .4, 28, col, true); }
      for (i = 0; i < 26 * mult; i++) { var a2 = Math.random() * 6.283, rr = Math.random() * 4; enPlano(c, Math.cos(a2) * rr, Math.sin(a2) * rr, 1, 1.6, 22, COLORES.blanco, true); }
    } else if (c.tipo === 'palmera') {
      for (i = 0; i < 12; i++) { var a3 = i / 12 * Math.PI * 2, el = .35 + Math.random() * .3, v = 22 * esc; chispa({ x: c.x, y: c.y, z: c.z, vx: Math.cos(a3) * Math.cos(el) * v, vy: Math.sin(el) * v, vz: Math.sin(a3) * Math.cos(el) * v, d: 2.6, tam: 38, r: col[0], g: col[1], b: col[2], gr: 6, drag: .9, rastro: red ? 0 : .03 }); }
    } else {
      var m4 = Math.round(170 * mult);
      for (i = 0; i < m4; i++) { var u = Math.random() * 2 - 1, fi = Math.random() * Math.PI * 2, rr2 = Math.sqrt(1 - u * u), vv = 21 * esc * (.92 + Math.random() * .08); chispa({ x: c.x, y: c.y, z: c.z, vx: rr2 * Math.cos(fi) * vv, vy: u * vv, vz: rr2 * Math.sin(fi) * vv, d: 2 + Math.random() * .6, tam: 24, r: col[0], g: col[1], b: col[2], gr: 3, drag: 1.4, rastro: N >= 2000 && !red ? .05 : 0 }); }
    }
    if (sonar) sonar('estallido', cam ? Math.hypot(c.x - cam.position.x, c.z - cam.position.z) / 343 : 0);
  }
  var activo = false, prox = 0, orden = 0, centro = new THREE.Vector3(), ancho = 40;
  var SEC = [['corazon', 'rojo'], ['estrella', 'oro'], ['crisantemo', 'celeste'], ['corazon', 'rosa'], ['estrella', 'blanco'], ['palmera', 'oro'], ['corazon', 'oro'], ['crisantemo', 'violeta'], ['estrella', 'oro'], ['corazon', 'rojo'], ['crisantemo', 'verde'], ['estrella', 'rosa']];
  return {
    flash: flash,
    medir: S.medir,
    /* centro: dónde se ven (detrás del árbol, sobre la plaza) */
    empezar: function (c, an, camara) { activo = true; prox = .1; centro.copy(c); ancho = an || 40; cam = camara; S.p.visible = true; },
    parar: function () { activo = false; },
    cuadro: function (dt) {
      flash.multiplyScalar(Math.exp(-dt * 6));
      if (!S.p.visible) return;
      if (activo) {
        prox -= dt;
        if (prox <= 0) {
          var s = SEC[orden++ % SEC.length];
          lanzar(centro.x + (Math.random() - .5) * ancho, centro.z + (Math.random() - .5) * 14, 17 + Math.random() * 10, s[0], s[1]);
          prox = (red ? 1.1 : .5) + Math.random() * .6; if (!red && Math.random() < .3) prox = .14;
        }
      }
      for (var k = cohetes.length - 1; k >= 0; k--) {
        var c = cohetes[k]; c.t += dt; c.vy -= 9.8 * dt * .35; c.y += c.vy * dt; c.x += c.deriva * dt;
        if (Math.random() < .9) chispa({ x: c.x, y: c.y, z: c.z, vx: (Math.random() - .5) * .6, vy: -1, vz: (Math.random() - .5) * .6, d: .6, tam: 9, r: 1, g: .75, b: .45, gr: 2, drag: 1, rastro: 0 });
        if (c.y >= c.ap || c.vy < 3) { estallar(c); cohetes.splice(k, 1); libres.push(c); }
      }
      var vivas = 0;
      for (var i = 0; i < N; i++) {
        var p = P[i];
        if (!p.v) { S.alfa[i] = 0; continue; }
        p.t += dt; if (p.t >= p.d) { p.v = 0; S.alfa[i] = 0; S.pos[i * 3 + 1] = -999; continue; }
        vivas++;
        var dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr - p.gr * dt; p.vz *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.rastro && Math.random() < p.rastro * 60 * dt) chispa({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, d: .5, tam: p.tam * .6, r: p.r, g: p.g * .8, b: p.b * .6, gr: 1, drag: 2, rastro: 0 });
        var kk = p.t / p.d, a = kk < .08 ? kk / .08 : Math.pow(1 - kk, 1.4);
        if (p.parpa && kk > .5) a *= .4 + .6 * (Math.random() < .5 ? 1 : 0);
        S.pos[i * 3] = p.x; S.pos[i * 3 + 1] = p.y; S.pos[i * 3 + 2] = p.z;
        S.col[i * 3] = p.r; S.col[i * 3 + 1] = p.g; S.col[i * 3 + 2] = p.b;
        S.tam[i] = p.tam * (1 - kk * .35); S.alfa[i] = a;
      }
      S.g.attributes.position.needsUpdate = true; S.g.attributes.color.needsUpdate = true; S.g.attributes.tam.needsUpdate = true; S.g.attributes.alfa.needsUpdate = true;
      luzI = Math.max(0, luzI - dt * 2.2); luz.on = luzI > .01 ? 1 : 0; luz.i = luzI * 1.4;
      if (!activo && !vivas && !cohetes.length) S.p.visible = false;
    }
  };
};

/* ---------- nieve mágica dorada ---------- */
A.armarNieve = function (escena, n) {
  var S = puntos(n, 'varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float r = dot(c, c); float a = (exp(-r * 60.0) * 1.2 + exp(-r * 12.0) * .3) * vA * (1.0 - smoothstep(.2, .25, r)); gl_FragColor = vec4(vC * a, 1.0); }', null, 5);
  /* cae en un volumen de 16 m que sigue a lo que mira la cámara: así siempre hay copos cerca */
  var F = [], centro = new THREE.Vector3(), adelante = new THREE.Vector3(), activa = 0, meta = 0, R = 8, lento = A.reducido ? .5 : 1;
  for (var i = 0; i < n; i++) F.push({ x: (Math.random() - .5) * R * 2, y: Math.random() * 10, z: (Math.random() - .5) * R * 2, v: .35 + Math.random() * .45, f: Math.random() * 6.28, tam: 3.2 + Math.random() * 4.5, dor: Math.random() });
  S.p.visible = false; escena.add(S.p);
  return {
    medir: S.medir,
    caer: function (k, c) { meta = k; if (c) centro.copy(c); if (k > 0) S.p.visible = true; },
    cuadro: function (dt, cam) {
      activa += (meta - activa) * Math.min(1, dt * .6);
      if (!S.p.visible) return;
      if (activa < .005 && meta === 0) { S.p.visible = false; return; }
      if (cam) { cam.getWorldDirection(adelante); adelante.y = 0; adelante.normalize(); centro.x += (cam.position.x + adelante.x * 6 - centro.x) * Math.min(1, dt * 2); centro.z += (cam.position.z + adelante.z * 6 - centro.z) * Math.min(1, dt * 2); }
      for (var i = 0; i < n; i++) {
        var f = F[i]; f.y -= f.v * dt * lento; f.f += dt * (1.2 + f.dor);
        if (f.y < 0) { f.y = 9 + Math.random() * 2; f.x = (Math.random() - .5) * R * 2; f.z = (Math.random() - .5) * R * 2; }
        S.pos[i * 3] = centro.x + f.x + Math.sin(f.f) * .35 * lento; S.pos[i * 3 + 1] = f.y; S.pos[i * 3 + 2] = centro.z + f.z + Math.cos(f.f * .8) * .3 * lento;
        var tw = .55 + .45 * Math.sin(f.f * 2.3 + i);
        S.col[i * 3] = 1; S.col[i * 3 + 1] = .78 + .17 * f.dor; S.col[i * 3 + 2] = .38 + .45 * f.dor * f.dor;
        S.tam[i] = f.tam; S.alfa[i] = activa * tw * Math.min(1, f.y * 2) * 1.5;
      }
      S.g.attributes.position.needsUpdate = true; S.g.attributes.color.needsUpdate = true; S.g.attributes.tam.needsUpdate = true; S.g.attributes.alfa.needsUpdate = true;
    }
  };
};

/* ---------- vapor (sprites suaves que suben y se abren) ---------- */
A.armarVapor = function (escena) {
  var c = A.lienzo(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  var tex = new THREE.CanvasTexture(c), lista = [], fuentes = [];
  for (var i = 0; i < 18; i++) { var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#D8D0C8', transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; escena.add(s); lista.push({ s: s, t: Math.random(), f: 0 }); }
  return {
    /* fuentes: [{p: Vector3, k: 0..1 (cuánto humea)}] */
    fuente: function (p, k) { var f = { p: p, k: k }; fuentes.push(f); return f; },
    cuadro: function (dt) {
      for (var i = 0; i < lista.length; i++) {
        var o = lista[i], fu = fuentes[i % Math.max(1, fuentes.length)];
        if (!fu || fu.k <= 0) { o.s.visible = false; continue; }
        o.t += dt * .45; if (o.t > 1) o.t -= 1;
        var t = o.t; o.s.visible = true;
        o.s.position.set(fu.p.x + Math.sin(t * 6 + i) * .05 * t, fu.p.y + t * .55, fu.p.z + Math.cos(t * 5 + i) * .05 * t);
        o.s.scale.setScalar(.06 + t * .26); o.s.material.opacity = Math.sin(t * Math.PI) * .45 * fu.k;
      }
    }
  };
};

/* ---------- haces de luz (columnas suaves que suben de las esferas escondidas) ---------- */
A.armarHaces = function (escena, n) {
  var g = new THREE.CylinderGeometry(.18, .5, 9, 16, 1, true); g.translate(0, 4.5, 0);
  var m = new THREE.ShaderMaterial({
    uniforms: { uT: A.U.uT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying float vD; varying float vB; void main(){ vUv = uv; vec4 w = modelMatrix * instanceMatrix * vec4(position,1.0); vD = distance(w.xyz, cameraPosition); vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal); vB = abs(dot(n, normalize(cameraPosition - w.xyz))); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; varying float vD; varying float vB; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (.65 + .2 * sin(uT * 2.0 + vUv.x * 12.566 + vUv.y * 6.0)) * smoothstep(0.0, .04, vUv.y) * smoothstep(2.5, 9.0, vD) * vB * vB; gl_FragColor = vec4(vec3(1.0, .78, .42) * a * .45, 1.0); }'
  });
  var im = new THREE.InstancedMesh(g, m, Math.max(1, n)); im.frustumCulled = false; im.renderOrder = 3; im.count = 0; escena.add(im);
  var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    /* lista de {p, k}: posición y fuerza (0 = apagado) */
    poner: function (lista, t) {
      var c = 0;
      for (var i = 0; i < lista.length; i++) { var h = lista[i]; if (h.k <= .01) continue; var e = h.k * (1 + Math.sin(t * 1.4 + i) * .05); p.copy(h.p); s.set(e, e * (1 + .05 * Math.sin(t + i)), e); m4.compose(p, q, s); im.setMatrixAt(c++, m4); }
      im.count = c; im.instanceMatrix.needsUpdate = true;
    }
  };
};
})();

;
/* El árbol que se enciende — prototipo.
   musica.js: todo el sonido, sintetizado en WebAudio (no hay archivos de audio ni nada con dueño).

   - "Noche de paz" (Franz Xaver Gruber, 1818: dominio público) en un arreglo propio a 6/8:
     cajita de música con la melodía, colchón de cuerdas suave, arpa en arpegios y bajo. Dos
     niveles: "calma" mientras se busca (cajita y colchón, bajito) y "pleno" cuando el árbol se
     enciende (todo, con campanas en los tiempos fuertes).
   - Persecución: un tema propio, juguetón, en pizzicato (La menor), que se repite.
   - Campanas sintetizadas (parciales de campana de iglesia y de campanita), la risa de Don
     Gruñón ("¡ja, ja, ja!" con formantes de vocal a), su "¡bah!", el "mmm" del chocolate,
     el brillo al encontrar una esfera, el soplido de la esfera que vuela, los fuegos y el
     rumor de la pileta.
   Un solo AudioContext, creado en el primer toque (los celulares lo exigen). Se suspende
   cuando la página no se ve. */
(function () {
'use strict';
var A = window.Arbol;
var ac = null, maestro = null, musica = null, efectos = null, eco = null, ruido = null, mudo = false;
var modo = 'nada', reloj = 0, sig = 0, paso = 0, fuente = null, fuenteG = null;
/* callada: el regalo trae su propia canción (la página la toca) y "Noche de paz" no suena;
   los efectos sí. relojP: el programador de notas (se apaga al cerrar). */
var callada = false, relojP = 0, propio = false;

function nota(n) { return 440 * Math.pow(2, (n - 69) / 12); }
var N = { C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A2: 45, E2: 40, 'G#4': 68, 'G#3': 56, F2: 41, G2: 43, C2: 36 };

/* la melodía en corcheas (6 por compás) y los acordes por compás */
var MELODIA = [['G4', 1.5], ['A4', .5], ['G4', 1], ['E4', 3], ['G4', 1.5], ['A4', .5], ['G4', 1], ['E4', 3],
  ['D5', 2], ['D5', 1], ['B4', 3], ['C5', 2], ['C5', 1], ['G4', 3],
  ['A4', 2], ['A4', 1], ['C5', 1.5], ['B4', .5], ['A4', 1], ['G4', 1.5], ['A4', .5], ['G4', 1], ['E4', 3],
  ['A4', 2], ['A4', 1], ['C5', 1.5], ['B4', .5], ['A4', 1], ['G4', 1.5], ['A4', .5], ['G4', 1], ['E4', 3],
  ['D5', 2], ['D5', 1], ['F5', 1.5], ['D5', .5], ['B4', 1], ['C5', 3], ['E5', 3],
  ['C5', 1.5], ['G4', .5], ['E4', 1], ['G4', 1.5], ['F4', .5], ['D4', 1], ['C4', 6]];
var ACORDES = [['C', 'C'], ['C', 'C'], ['G7', 'G7'], ['C', 'C'], ['F', 'F'], ['C', 'C'], ['F', 'F'], ['C', 'C'], ['G7', 'G7'], ['C', 'C'], ['C', 'G7'], ['C', 'C']];
var NOTAS_AC = { C: [48, 52, 55, 60], F: [41, 53, 57, 60], G7: [43, 53, 55, 59] };
var CORCHEA = .36;

/* dado: un AudioContext que la página creó en un toque (en el iPhone el sonido solo arranca si
   el contexto nace o se reanuda dentro de un toque); si no, se crea aquí */
function iniciar(dado) {
  if (ac) return true;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx && !dado) return false;
    if (dado && dado.state !== 'closed') { ac = dado; propio = false; } else { ac = new Ctx(); propio = true; }
    maestro = ac.createGain(); maestro.gain.value = .85; maestro.connect(ac.destination);
    musica = ac.createGain(); musica.gain.value = .0; musica.connect(maestro);
    efectos = ac.createGain(); efectos.gain.value = .9; efectos.connect(maestro);
    /* eco de plaza: una reverberación corta hecha de ruido que se apaga */
    eco = ac.createConvolver();
    var largo = ac.sampleRate * 2.2, ir = ac.createBuffer(2, largo, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = ir.getChannelData(c); for (var i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2.6) * .5; }
    eco.buffer = ir; var gEco = ac.createGain(); gEco.gain.value = .32; eco.connect(gEco); gEco.connect(maestro);
    /* ruido rosado (para la pileta, la risa, los fuegos) */
    var n = ac.sampleRate * 2, buf = ac.createBuffer(1, n, ac.sampleRate), dd = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
    for (i = 0; i < n; i++) { var w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0527; dd[i] = (b0 + b1 + b2 + w * .1848) * .18; }
    ruido = buf;
    /* la pileta: ruido filtrado que se oye según la distancia */
    fuente = ac.createBufferSource(); fuente.buffer = ruido; fuente.loop = true;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .6;
    fuenteG = ac.createGain(); fuenteG.gain.value = 0; fuente.connect(bp); bp.connect(fuenteG); fuenteG.connect(efectos); fuente.start();
    relojP = setInterval(programar, 60);
    return true;
  } catch (e) { ac = null; return false; }
}
function salida(k) { return k === 'm' ? musica : efectos; }
/* ---------- instrumentos ---------- */
function env(g, t, a, sostiene, r, vol) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + a + sostiene); g.gain.exponentialRampToValueAtTime(.0001, t + a + sostiene + r); }
function cajita(t, f, vol, ir) {
  /* cajita de música: fundamental + un parcial inarmónico que se apaga rápido */
  [[1, 1, 1.4], [2.756, .35, .45], [5.4, .12, .2]].forEach(function (p) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * p[1], t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + p[2]);
    o.connect(g); g.connect(salida('m')); if (ir !== false) g.connect(eco); o.start(t); o.stop(t + p[2] + .05);
  });
}
function arpa(t, f, vol) {
  var o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.001;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + .8);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(salida('m')); g.connect(eco); o.start(t); o2.start(t); o.stop(t + 1.45); o2.stop(t + 1.45);
}
function colchon(t, notas, dur, vol) {
  notas.forEach(function (n, i) {
    [-6, 6].forEach(function (cent) {
      var o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = nota(n + 12) * Math.pow(2, cent / 1200);
      lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = .5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol / notas.length, t + .5); g.gain.setValueAtTime(vol / notas.length, t + Math.max(.5, dur - .4)); g.gain.linearRampToValueAtTime(0, t + dur + .3);
      o.connect(lp); lp.connect(g); g.connect(salida('m')); g.connect(eco); o.start(t); o.stop(t + dur + .35);
    });
  });
}
function bajo(t, f, dur, vol) {
  var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(salida('m')); o.start(t); o.stop(t + dur + .05);
}
/* campana: parciales de campana (hum, prima, tercera menor, quinta, nominal…) */
function campana(t, f, vol, dur, k) {
  var P = [[.5, .55, 1.0], [1, 1, .8], [1.183, .55, .55], [1.506, .4, .45], [2, .5, .35], [2.514, .25, .25], [2.662, .2, .2], [3.011, .18, .16], [4.166, .12, .1]];
  P.forEach(function (p) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
    var d = (dur || 3) * p[2];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * p[1], t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(salida(k || 'e')); g.connect(eco); o.start(t); o.stop(t + d + .05);
  });
}
function pizz(t, f, vol) {
  var o = ac.createOscillator(), bp = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 2.5;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .28);
  o.connect(bp); bp.connect(g); g.connect(salida('m')); g.connect(eco); o.start(t); o.stop(t + .3);
}
function ruidoCorto(t, f, q, vol, dur, rate, k) {
  var s = ac.createBufferSource(); s.buffer = ruido; s.playbackRate.value = rate || 1;
  var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
  var g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(bp); bp.connect(g); g.connect(salida(k || 'e')); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
  return bp;
}
/* una vocal "a" con formantes (para la voz de Don Gruñón) */
function vocal(t, f0, f1, dur, vol, nasal) {
  var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
  var vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 6; vg.gain.value = f0 * .025; vib.connect(vg); vg.connect(o.frequency);
  var g = ac.createGain(); env(g, t, .02, dur * .55, dur * .45, vol);
  var F = nasal ? [[260, 5, 1], [900, 8, .2]] : [[760, 6, 1], [1150, 7, .7], [2500, 8, .25]];
  F.forEach(function (fm) { var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; var gg = ac.createGain(); gg.gain.value = fm[2] * 3; o.connect(bp); bp.connect(gg); gg.connect(g); });
  g.connect(efectos); g.connect(eco);
  o.start(t); vib.start(t); o.stop(t + dur + .05); vib.stop(t + dur + .05);
}

/* ---------- el secuenciador ---------- */
var mel = [], pos0 = 0;
(function () { var tt = 0; MELODIA.forEach(function (m) { mel.push([tt, N[m[0]], m[1]]); tt += m[1]; }); pos0 = tt; })();
var LARGO = 72;   /* corcheas por vuelta (12 compases) */
var PERSE = [['A4', 'E2'], [null, null], ['E4', null], [null, null], ['A4', 'A2'], ['C5', null], ['B4', null], [null, null], ['G#4', 'E2'], [null, null], ['E4', null], [null, null], ['G#4', 'E2'], ['B4', null], ['A4', 'A2'], [null, null],
             ['C5', 'F2'], [null, null], ['A4', null], [null, null], ['D5', 'D3'], ['C5', null], ['B4', null], [null, null], ['A4', 'E2'], ['B4', null], ['C5', null], ['E5', null], ['B4', 'E2'], [null, null], ['G#4', null], [null, null]];
function programar() {
  if (!ac || modo === 'nada' || callada) return;
  var ahora = ac.currentTime;
  if (reloj < ahora) reloj = ahora + .05;
  while (reloj < ahora + .25) {
    if (modo === 'persecucion') {
      var p = PERSE[paso % PERSE.length];
      if (p[0]) pizz(reloj, nota(N[p[0]]), .16);
      if (p[1]) bajo(reloj, nota(N[p[1]]), .35, .22);
      if (paso % 4 === 0) ruidoCorto(reloj, 5200, 3, .025, .05, 2, 'm');
      reloj += .19; paso++;
    } else {
      /* "Noche de paz": cada paso es una corchea */
      var k = paso % LARGO, compas = Math.floor(k / 6), dentro = k % 6, pleno = modo === 'pleno';
      for (var i = 0; i < mel.length; i++) {
        var m = mel[i]; if (Math.abs(m[0] - k) < .01 || (m[0] > k && m[0] < k + 1)) {
          var desfase = (m[0] - k) * CORCHEA;
          cajita(reloj + desfase, nota(m[1] + 12), pleno ? .16 : .12);
          if (pleno) arpa(reloj + desfase, nota(m[1]), .05);
        }
      }
      var ac2 = ACORDES[compas][dentro < 3 ? 0 : 1], notas = NOTAS_AC[ac2];
      if (dentro === 0 || dentro === 3) {
        if (dentro === 0 || ACORDES[compas][0] !== ACORDES[compas][1]) colchon(reloj, notas.slice(1), (ACORDES[compas][0] !== ACORDES[compas][1] ? 3 : 6) * CORCHEA, pleno ? .1 : .07);
        if (pleno) bajo(reloj, nota(notas[0] - 12), 3 * CORCHEA, .26);
        if (pleno && dentro === 0 && compas % 2 === 0) campana(reloj, nota(notas[0] + 24), .05, 2.5, 'm');
      }
      if (pleno) { var arp = [0, 1, 2, 3, 2, 1][dentro]; arpa(reloj, nota(notas[arp] + 12), .035); }
      reloj += CORCHEA; paso++;
    }
  }
}

A.Audio = {
  iniciar: function (dado) { var ok = iniciar(dado); if (ac && ac.state === 'suspended') try { ac.resume(); } catch (e) {} return ok; },
  listo: function () { return !!ac; },
  sinMusica: function (si) { callada = !!si; if (callada && musica && ac) musica.gain.setTargetAtTime(0, ac.currentTime, .1); },
  /* al salir del juego: se apaga el programador y la pileta, y se cierra el contexto (si es nuestro) */
  cerrar: function () {
    clearInterval(relojP); relojP = 0;
    try { if (fuente) fuente.stop(); } catch (e) {}
    try { if (ac) { if (propio) ac.close(); else if (maestro) maestro.disconnect(); } } catch (e) {}
    ac = maestro = musica = efectos = eco = ruido = fuente = fuenteG = null;
    modo = 'nada'; reloj = 0; paso = 0; mudo = false; callada = false; propio = false;
  },
  mudo: function (m) { if (m === undefined) return mudo; mudo = m; if (maestro) maestro.gain.setTargetAtTime(m ? 0 : .85, ac.currentTime, .1); },
  pausar: function (si) { if (!ac) return; if (si) ac.suspend(); else if (!mudo || true) ac.resume(); },
  /* modo de la música: 'nada' | 'calma' | 'pleno' | 'persecucion' */
  musica: function (m) {
    if (!ac) { modo = m; return; }
    if (m === modo) return;
    var antes = modo; modo = m;
    if (m === 'persecucion' || antes === 'persecucion' || antes === 'nada') { paso = 0; reloj = ac.currentTime + .1; }
    musica.gain.cancelScheduledValues(ac.currentTime);
    musica.gain.setTargetAtTime(m === 'nada' || callada ? 0 : m === 'pleno' ? .9 : m === 'persecucion' ? .75 : .6, ac.currentTime, .4);
  },
  pileta: function (k) { if (fuenteG) fuenteG.gain.setTargetAtTime(Math.max(0, Math.min(1, k)) * .22, ac.currentTime, .3); },
  /* ---- efectos ---- */
  encontrar: function () { if (!ac) return; var t = ac.currentTime; [72, 76, 79, 84, 88].forEach(function (n, i) { cajita(t + i * .07, nota(n + 12), .12, true); }); campana(t, nota(84), .05, 2); },
  vuela: function () { if (!ac) return; var t = ac.currentTime, bp = ruidoCorto(t, 500, 2.5, .2, 1.4, 1.3); bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 1.2); },
  enciende: function () { if (!ac) return; var t = ac.currentTime; campana(t, nota(79), .1, 3); [84, 88, 91, 96].forEach(function (n, i) { cajita(t + .1 + i * .05, nota(n), .08); }); },
  estrella: function () { if (!ac) return; var t = ac.currentTime; [60, 64, 67, 72].forEach(function (n) { campana(t, nota(n), .07, 5); }); for (var i = 0; i < 12; i++) cajita(t + .15 + i * .06, nota(84 + [0, 4, 7, 12][i % 4] + (i > 7 ? 12 : 0)), .06); },
  tic: function (ultimo) { if (!ac) return; var t = ac.currentTime; campana(t, nota(ultimo ? 72 : 84), ultimo ? .16 : .07, ultimo ? 4 : 1.2); },
  /* las doce campanadas de la medianoche */
  campanadas: function () { if (!ac) return; var t = ac.currentTime; for (var i = 0; i < 12; i++) campana(t + i * .85, nota(55), .2, 4); },
  risa: function () {
    if (!ac) return; var t = ac.currentTime + .02;
    for (var k = 0; k < 4; k++) { var t0 = t + k * .19; ruidoCorto(t0, 1500, 1.2, .12, .07, 1.6); vocal(t0 + .04, 175 - k * 9, 150 - k * 12, .13, .32); }
  },
  bah: function () { if (!ac) return; var t = ac.currentTime + .02; ruidoCorto(t, 300, 1, .1, .05, .7); vocal(t + .03, 125, 88, .32, .38); },
  uf: function () { if (!ac) return; var t = ac.currentTime + .02; ruidoCorto(t, 900, .8, .14, .25, .8); ruidoCorto(t + .32, 800, .8, .12, .25, .8); },
  mmm: function () { if (!ac) return; var t = ac.currentTime + .02; vocal(t, 135, 175, .6, .3, true); },
  ay: function () { if (!ac) return; var t = ac.currentTime + .02; vocal(t, 210, 150, .22, .3); vocal(t + .28, 200, 140, .22, .26); },
  /* fuegos (los del chasqui): silbido que sube y estallido grave con chisporroteo */
  fuego: function (tipo, retraso) {
    if (!ac) return; var t0 = ac.currentTime + (retraso || 0);
    if (tipo === 'silbido') { var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(2200, t0 + 1.2); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.02, t0 + .1); g.gain.exponentialRampToValueAtTime(.0001, t0 + 1.3); o.connect(g); g.connect(efectos); o.start(t0); o.stop(t0 + 1.35); return; }
    var s = ac.createBufferSource(); s.buffer = ruido; s.playbackRate.value = .5;
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    var g2 = ac.createGain(); g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(.8, t0 + .02); g2.gain.exponentialRampToValueAtTime(.0001, t0 + 1.6);
    s.connect(lp); lp.connect(g2); g2.connect(efectos); s.start(t0, Math.random()); s.stop(t0 + 1.7);
    ruidoCorto(t0 + .3, 3600, .9, .07, 1.5, 2);
  }
};
})();

;
/* El árbol que se enciende — final.js: el final, cuando todas las esferas ya están en el árbol.

    0–3 s   Don Gruñón, el muki, llega con la estrella, cabizbajo.
    3–6,5   Mira las fotos del árbol y se ablanda ("Esas fotos… brillan más que el oro").
    6,5–11  Pide perdón y devuelve la estrella, que queda flotando entre los dos. La estrella trae
            la dedicatoria de quien regala: se lee en la plaza de 9,6 a 18,6 s (o.dedicatoria).
    11–15,5 Ruway le ofrece una taza de chocolate caliente; él la toma ("¡Mmm…!").
    15,5–19 Se abrazan (corazoncitos).
    19–23   Ruway lo levanta: se achica con chispas y queda colgado del árbol por el gancho de su
            casco, alumbrando con su lamparita.
    23–27   La estrella sube en espiral a la punta: el árbol se enciende entero, con campanas.
    29–39   Cuenta regresiva a las doce (el reloj de la torre también avanza).
    39–     ¡Feliz Navidad! Campanadas, fuegos artificiales con corazones y estrellas, nieve
            dorada; la cámara se eleva despacio. A los 52 s, la galería.

   Todo se mueve con los huesos de cada uno (sin clips nuevos) y una cámara por llaves.
   Las frases son textos fijos (no vienen del cliente); el nombre del saludo y la dedicatoria
   sí, y van con textContent (los pone juego.js). */
(function () {
'use strict';
var A = window.Arbol, S = A.suave;

function texCorazon() {
  var c = A.lienzo(64, 64), x = c.getContext('2d');
  x.fillStyle = '#FF5C8A'; x.beginPath(); x.moveTo(32, 56); x.bezierCurveTo(4, 36, 6, 10, 24, 12); x.bezierCurveTo(30, 13, 32, 18, 32, 22); x.bezierCurveTo(32, 18, 34, 13, 40, 12); x.bezierCurveTo(58, 10, 60, 36, 32, 56); x.fill();
  x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(22, 22, 5, 3, -.6, 0, 7); x.fill();
  return new THREE.CanvasTexture(c);
}

/* llaves de cámara: [t, posición, a dónde mira] */
var CAM = [
  [0, [3.4, 1.5, -1.0], [-1.2, .9, -5.4]],
  [3.0, [2.3, 1.3, -2.0], [-.2, .9, -4.9]],
  [3.6, [1.3, .85, -2.9], [0, 3.2, -9.0]],
  [6.3, [1.2, .95, -3.0], [0, 3.5, -9.0]],
  [6.9, [2.9, 1.3, -2.0], [-.15, .9, -4.45]],
  [15.4, [2.9, 1.3, -2.0], [-.15, .88, -4.45]],
  /* el abrazo: la cámara mira al medio de los dos (Ruway se agacha junto a Don Gruñón, en (.17, −4.65))
     y se aleja un poco, para que entren enteros; antes miraba a la izquierda y quedaban cortados */
  [16.0, [2.37, 1.1, -2.32], [.16, .76, -4.62]],
  [19.0, [2.37, 1.14, -2.32], [.18, .82, -4.66]],
  [20.0, [.8, 1.75, -4.6], [1.0, 1.75, -7.1]],
  [23.0, [.75, 1.8, -4.8], [1.0, 1.85, -7.1]],
  [24.0, [0, 1.35, -1.2], [0, 4.0, -9.0]],
  [27.0, [0, 1.6, .6], [0, 5.6, -9.0]],
  [30.0, [5.2, 2.2, 3.0], [0, 4.4, -9.5]],
  [39.0, [5.8, 2.3, 3.8], [0, 6.2, -11.0]],
  [52.0, [2.5, 3.0, 6.0], [0, 7.0, -12.0]],
  [70.0, [3.5, 3.4, 7.0], [0, 7.4, -12.5]]
];

A.armarFinal = function (o) {
  /* o: { escena, cam, ruway(), grunon, arbol, chispas, fuegos, nieve, vapor, torre, decir(quien, txt, ms, punto), alTerminar(), cuenta(n|null), feliz(si), fiesta(k), dedicatoria(si), alEncender() } */
  var t = -1, activo = false, listo = false, hecho = {};
  var taza = null, vTaza = null, corazones = [], tc = null;
  var v = new THREE.Vector3(), w = new THREE.Vector3(), u = new THREE.Vector3(), cPos = new THREE.Vector3(), cMira = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  /* el encuentro va a 4–5 m del tronco: más cerca, las ramas de abajo los tapan */
  var pR = new THREE.Vector3(-.6, 0, -4.0), pG0 = new THREE.Vector3(-3.3, 0, -6.4), pG = new THREE.Vector3(.35, 0, -4.8);
  var flota = new THREE.Vector3(-.1, 1.55, -4.45), colgar = new THREE.Vector3(), estIni = new THREE.Vector3(), estPos = new THREE.Vector3();
  function preparar() {
    var R = o.ruway(), G = o.grunon;
    /* la taza de chocolate (la de las tazas del puesto) con su chocolate y su vapor */
    taza = new THREE.Group();
    var mt = new THREE.Mesh(A.geoTaza, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a2a2a' })); mt.scale.setScalar(1.6); taza.add(mt);
    var ch = new THREE.Mesh(new THREE.CircleGeometry(.07, 16).rotateX(-Math.PI / 2).translate(0, .13, 0), new THREE.MeshLambertMaterial({ color: '#4A2414', emissive: '#2A0E06' })); taza.add(ch);
    taza.visible = false; o.escena.add(taza);
    vTaza = o.vapor.fuente(new THREE.Vector3(), 0);
    tc = texCorazon();
    for (var i = 0; i < 10; i++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tc, transparent: true, depthWrite: false })); sp.visible = false; o.escena.add(sp); corazones.push({ s: sp, t: -1, vx: 0, vy: 0, vz: 0 }); }
    o.arbol.lugarGrunon(colgar);
    if (R) { R.raiz.position.copy(pR); R.raiz.rotation.set(0, Math.PI - .25, 0); R.modo = 'quieto'; R.vel = 0; R.pose = null; }
    G.raiz.visible = true; G.raiz.scale.setScalar(1); G.raiz.position.copy(pG0); G.raiz.rotation.set(0, Math.atan2(pG.x - pG0.x, pG.z - pG0.z), 0);
    o.arbol.estrella.visible = true; o.arbol.estrellaOn(.25);
    listo = true;
  }
  function soltarCorazon(p) { for (var i = 0; i < corazones.length; i++) { var c = corazones[i]; if (c.t < 0) { c.t = 0; c.s.visible = true; c.s.position.copy(p); c.vx = (Math.random() - .5) * .25; c.vy = .35 + Math.random() * .2; c.vz = (Math.random() - .5) * .25; return; } } }
  function una(nombre, cuando, f) { if (t >= cuando && !hecho[nombre]) { hecho[nombre] = 1; f(); } }
  var corT = 0, ultCuenta = 11, estrellaSubio = false;
  function cuadro(dt) {
    if (!activo) return;
    if (!listo) preparar();
    t += dt;
    var R = o.ruway(), G = o.grunon, AR = o.arbol;
    /* ---------- Don Gruñón ---------- */
    var kLlega = S(0, 3, t);
    if (t < 19) {
      G.raiz.position.copy(pG0).lerp(pG, kLlega);
      var miraA = t < 3 ? Math.atan2(pG.x - pG0.x, pG.z - pG0.z) : t < 6.5 ? Math.atan2(0 - pG.x, -9 - pG.z) : Math.atan2(pR.x - pG.x, pR.z - pG.z);
      var dif = A.angDif(G.raiz.rotation.y, miraA); G.raiz.rotation.y += dif * Math.min(1, dt * 3);
      G.vel = t < 3 ? 1 : 0;
      G.estado = t < 3 ? 'anda' : t < 6.5 ? 'mira' : t < 9 ? 'triste' : t < 11 ? 'ofrece' : t < 13.1 ? 'quieto' : t < 15.5 ? 'toma' : 'abraza';
      G.forzarCara = t > 4.2 && t < 6.5 ? { ceja: 1, parpado: 0, boca: .2 } : t > 15.5 ? { parpado: 1, ceja: 1, boca: 0 } : t > 13.1 && t < 15.5 ? null : null;
    }
    /* el abrazo y después: Ruway lo levanta, se achica y queda colgado del árbol */
    var kSube = S(19.2, 21.6, t);
    if (t >= 19) {
      G.forzarCara = { parpado: .05, ceja: 1, boca: .3 };
      G.estado = t < 21.6 ? 'abraza' : 'colgado';
      var esc = 1 - .5 * S(19.4, 21.2, t);
      G.raiz.scale.setScalar(esc);
      /* de los brazos de Ruway al gancho del árbol: el gancho de su casco (G.gancho × escala) queda en el punto */
      v.copy(pG).lerp(w.copy(colgar).addScaledVector(UP, -(G.gancho || 1.06) * esc), kSube); v.y += Math.sin(kSube * Math.PI) * .6;
      G.raiz.position.copy(v);
      G.raiz.rotation.y += A.angDif(G.raiz.rotation.y, Math.atan2(0, 1) + .2) * Math.min(1, dt * 2);
      una('chispasAchica', 19.4, function () { G.raiz.updateMatrixWorld(true); o.chispas.estallido(G.cabezaMundo(u), 60, 2.2, [1, .85, .5]); });
      una('colgado', 21.6, function () { o.chispas.estallido(colgar, 40, 1.6, [1, .9, .6]); A.Audio.encontrar(); });
    }
    G.vel = G.estado === 'anda' ? 1 : 0;
    /* ---------- Ruway ---------- */
    if (R) {
      var rumR = Math.atan2(pG.x - pR.x, pG.z - pR.z);
      if (t > 19.4) rumR = Math.atan2(colgar.x - pR.x, colgar.z - pR.z);
      if (t > 27) rumR = Math.atan2(0 - pR.x, -9 - pR.z);
      R.raiz.rotation.y += A.angDif(R.raiz.rotation.y, rumR) * Math.min(1, dt * 3);
      R.modo = 'quieto';
      R.pose = t > 10.8 && t < 13.2 ? 'ofrece' : t >= 15.5 && t < 19.3 ? 'agacha' : t >= 19.3 && t < 23 ? 'alcanza' : t >= 23 && t < 27 ? 'mira' : t >= 27 ? 'celebra' : null;
      R.sonrisa = t > 15 ? 1 : .55; R.boca = t > 11 && t < 12.6 ? .25 : t > 27 ? .3 : 0;
      R.raiz.position.copy(pR);
      if (R.pose === 'agacha') R.raiz.position.lerp(v.copy(pG).addScaledVector(u.set(pR.x - pG.x, 0, pR.z - pG.z).normalize(), .48), S(15.5, 16.4, t));
    }
    if (R) R.cuadro(dt);
    G.cuadro(dt);
    /* el abrazo con IK: las manos de Ruway en la espalda de Don Gruñón */
    if (R && t > 15.7 && t < 19.4) {
      var kA = S(15.7, 16.5, t) * (1 - S(19.0, 19.4, t));
      G.raiz.updateMatrixWorld(true); var esp = G.cabezaMundo(u).addScaledVector(UP, -.32);
      var fG = w.set(Math.sin(G.raiz.rotation.y), 0, Math.cos(G.raiz.rotation.y)), lado = v.set(fG.z, 0, -fG.x);
      if (kA > .02) {
        var polo = cPos.copy(lado).addScaledVector(UP, -.5);
        R.ik('L', cMira.copy(esp).addScaledVector(fG, -.08).addScaledVector(lado, .14), polo);
        polo.copy(lado).multiplyScalar(-1).addScaledVector(UP, -.5);
        R.ik('R', cMira.copy(esp).addScaledVector(fG, -.08).addScaledVector(lado, -.14), polo);
      }
      corT -= dt; if (corT < 0) { corT = .32; soltarCorazon(u.copy(esp).addScaledVector(UP, .55)); }
    }
    /* ---------- la estrella ---------- */
    var E = AR.estrella;
    if (t < 10.4) { G.raiz.updateMatrixWorld(true); G.puntoMano(estPos); E.position.copy(estPos).addScaledVector(UP, .12); E.position.x += .1 * Math.sin(G.raiz.rotation.y + 1.57); E.rotation.set(0, G.raiz.rotation.y, 0); E.scale.setScalar(.55); }
    else if (t < 23) { estPos.copy(E.position); E.position.lerp(flota, Math.min(1, dt * 2)); E.position.y += Math.sin(t * 2) * .002; E.rotation.y += dt * .8; E.scale.setScalar(.55 + .1 * S(10.4, 11.4, t)); AR.estrellaOn(.35 + .1 * Math.sin(t * 3)); if (!hecho.ini) estIni.copy(flota); }
    else {
      /* sube en espiral hasta la punta */
      var kE = S(23, 26.2, t), r = (1 - kE) * 1.4, an = kE * Math.PI * 4;
      E.position.set(AR.punta.x + Math.sin(an) * r * .7, flota.y + (AR.punta.y - flota.y) * kE, AR.punta.z + Math.cos(an) * r);
      if (t > 26.2) E.position.copy(AR.punta);
      E.scale.setScalar(.65 + .35 * kE); E.rotation.y = t > 26.2 ? Math.sin(t * .8) * .25 : E.rotation.y + dt * 4;
      if (Math.random() < dt * 40 && t < 26.2) o.chispas.chispa(E.position.x, E.position.y, E.position.z, (Math.random() - .5) * .4, -.2, (Math.random() - .5) * .4, 1.1, 4, 1, .85, .45, .2);
    }
    una('estrellaArriba', 26.2, function () {
      AR.estrellaOn(1); A.Audio.estrella(); o.chispas.estallido(AR.punta, 90, 3.2, [1, .85, .45]);
      /* el árbol se enciende de abajo arriba, sección por sección, y después todo */
      AR.todo(1); o.fiesta(1); A.Audio.musica('pleno'); estrellaSubio = true;
      if (o.alEncender) o.alEncender();
    });
    /* ---------- la taza ---------- */
    if (t > 10.6 && t < 13.15 && R) { taza.visible = true; R.manoDer(taza.position); taza.position.y -= .06; taza.rotation.set(0, R.raiz.rotation.y, 0); }
    else if (t >= 13.15 && t < 15.6) { taza.visible = true; G.puntoMano(taza.position); taza.position.y -= .02; taza.rotation.set(0, G.raiz.rotation.y + 1.2, 0); }
    else taza.visible = false;
    vTaza.k = taza.visible ? 1 : 0; vTaza.p.copy(taza.position).addScaledVector(UP, .14);
    /* ---------- frases ---------- */
    var cabG = G.cabezaMundo(u).addScaledVector(UP, .32 * G.raiz.scale.y);
    una('f1', 3.6, function () { o.decir('Don Gruñón', 'Esas fotos… brillan más que el oro.', 2700); });
    una('f2', 6.7, function () { o.decir('Don Gruñón', 'Perdón. Allá abajo, en la mina, todo es oscuro y solito…', 2600); A.Audio.uf(); });
    una('f3', 9.0, function () { o.decir('Don Gruñón', 'Toma. La estrella es de ustedes… y trae un mensaje.', 2200); });
    una('dedica', 9.6, function () { if (o.dedicatoria) o.dedicatoria(true); });
    una('sinDedica', 18.6, function () { if (o.dedicatoria) o.dedicatoria(false); });
    una('f4', 11.0, function () { o.decir('Ruway', '¡Para usted, don muki! Un chocolate calientito.', 2200, 'ruway'); });
    una('mmm', 14.0, function () { A.Audio.mmm(); o.decir('Don Gruñón', '¡Mmm… esto calienta más que mi lamparita!', 2000); });
    una('f6', 21.8, function () { o.decir('Don Gruñón', '¡Desde aquí les alumbro la Navidad!', 2200); });
    o.globoEn(t > 11 && t < 13.2 && R ? R.cabeza(w).addScaledVector(UP, .35) : cabG);
    /* ---------- cuenta regresiva y fiesta ---------- */
    if (t >= 29 && t < 39.2) {
      var n = Math.max(0, 10 - Math.floor(t - 29));
      if (n !== ultCuenta) { ultCuenta = n; o.cuenta(n); A.Audio.tic(n === 0); o.torre.reloj.dibujar(11, 59, 50 + (10 - n)); }
    }
    una('feliz', 39.2, function () {
      o.cuenta(null); o.feliz(true); A.Audio.campanadas(); o.torre.reloj.dibujar(12, 0, 0);
      o.fuegos.empezar(new THREE.Vector3(0, 0, -30), 48, o.cam);
      o.chispas.estallido(AR.punta, 80, 3, [1, .7, .5]);
    });
    una('nieve', 41.5, function () { o.nieve.caer(1, new THREE.Vector3(0, 0, -4)); });
    una('sinFeliz', 47.5, function () { o.feliz(false); });
    una('galeria', 52, function () { if (o.alTerminar) o.alTerminar(); });
    /* ---------- corazones ---------- */
    corazones.forEach(function (c) {
      if (c.t < 0) return; c.t += dt; if (c.t > 2) { c.t = -1; c.s.visible = false; return; }
      c.s.position.x += c.vx * dt; c.s.position.y += c.vy * dt; c.s.position.z += c.vz * dt;
      c.s.scale.setScalar(.1 + c.t * .05); c.s.material.opacity = Math.min(1, (2 - c.t) * 1.5);
    });
    /* ---------- cámara ---------- */
    var i = 0; while (i < CAM.length - 2 && t > CAM[i + 1][0]) i++;
    var a = CAM[i], b = CAM[i + 1], kk = S(a[0], b[0], t);
    cPos.set(a[1][0] + (b[1][0] - a[1][0]) * kk, a[1][1] + (b[1][1] - a[1][1]) * kk, a[1][2] + (b[1][2] - a[1][2]) * kk);
    cMira.set(a[2][0] + (b[2][0] - a[2][0]) * kk, a[2][1] + (b[2][1] - a[2][1]) * kk, a[2][2] + (b[2][2] - a[2][2]) * kk);
    /* subiendo la estrella, la cámara la sigue */
    if (t > 23 && t < 27.5) cMira.lerp(E.position, S(23, 24, t) * (1 - S(26.8, 27.5, t)) * .8);
    o.cam.position.copy(cPos); o.cam.lookAt(cMira);
  }
  return {
    iniciar: function (desde) { activo = true; t = desde || 0; hecho = {}; ultCuenta = 11; if (desde) { hecho.f1 = hecho.f2 = hecho.f3 = hecho.f4 = hecho.mmm = hecho.f6 = desde > 22 ? 1 : 0; hecho.dedica = hecho.sinDedica = desde > 18.6 ? 1 : 0; if (desde > 18.6 && o.dedicatoria) o.dedicatoria(false); } },
    cuadro: cuadro,
    activo: function () { return activo; },
    tiempo: function () { return t; },
    subio: function () { return estrellaSubio; }
  };
};
})();

;
/* El árbol que se enciende — pantalla.js: los estilos y el DOM del juego.

   Todo vive dentro de <div id="aj"> y lleva el prefijo aj- (ids, clases y animaciones): la página
   que lo abre (u.html) tiene sus propios #globo, .oculto, .mini… y no se pueden pisar. El juego
   va encima del lienzo del universo y debajo de los botones de la página y de las hojas del
   núcleo (el premio, la mochila): #aj tiene z-index 5 y es su propio contexto de apilamiento.

   Los textos que vienen del cliente (frases, dedicatoria, nombre) se ponen siempre con
   textContent, nunca como HTML. Aquí solo hay HTML fijo, escrito por nosotros. */
(function () {
'use strict';
var A = window.Arbol;

var CSS = [
'#aj{--oro:#F2C46D;--oro2:#FFE3A3;--crema:#FBF3E2;--tinta:#2A1B33;--noche:#0B1022;--vidrio:rgba(14,18,38,.5);--borde:rgba(255,227,163,.3);',
'  --serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
'  position:fixed;inset:0;z-index:5;background:var(--noche);color:var(--crema);font-family:var(--sans);overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}',
'#aj *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
'#aj [hidden]{display:none!important}',
'#aj button{font:inherit;color:inherit}',
'#aj button:focus-visible{outline:3px solid #fff;outline-offset:3px}',
'#aj-escena{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}',
/* la espera: primero opaca (mientras se arma la plaza), después una etiqueta abajo (mientras llega Ruway) */
'#aj-carga{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px;text-align:center;padding:24px;',
'  background:radial-gradient(ellipse at 50% 40%,#18214a,#0B1022 70%);transition:opacity .6s}',
'#aj-carga.aj-plaza{background:linear-gradient(180deg,rgba(8,10,24,0) 55%,rgba(8,10,24,.75));justify-content:flex-end;padding-bottom:calc(60px + env(safe-area-inset-bottom));pointer-events:none}',
'#aj-carga.aj-fuera{opacity:0;pointer-events:none}',
'#aj-carga p{margin:0;font-family:var(--serif);font-size:19px;color:#FFF3DE;text-shadow:0 2px 14px rgba(0,0,0,.6)}',
'#aj-carga i{width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,227,163,.25);border-top-color:var(--oro);animation:aj-gira 1s linear infinite}',
'#aj-carga.aj-plaza i{width:26px;height:26px}',
'@keyframes aj-gira{to{transform:rotate(360deg)}}',
/* el HUD */
'#aj-hud{position:absolute;inset:0;pointer-events:none}',
'#aj .aj-arriba{position:absolute;top:calc(14px + env(safe-area-inset-top));left:14px;right:14px;display:flex;align-items:center;gap:8px}',
'#aj .aj-pill{display:flex;align-items:center;gap:7px;padding:8px 12px;border-radius:999px;background:var(--vidrio);border:1px solid var(--borde);',
'  font-size:13.5px;font-weight:650;color:#FFF1DA;text-shadow:0 1px 2px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
'#aj-esferas.aj-brilla{box-shadow:0 0 16px rgba(255,200,110,.6)}',
'#aj-rumbo{margin-left:auto;transition:background .3s}',
'#aj-rumbo.aj-caza{background:rgba(150,30,40,.62);border-color:rgba(255,170,170,.5)}',
'#aj-flecha{display:inline-block;color:var(--oro);font-size:15px;transform-origin:50% 50%;transition:transform .15s linear}',
'#aj-sonido{pointer-events:auto;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--vidrio);border:1px solid var(--borde);cursor:pointer;padding:0}',
'#aj-sonido svg{width:20px;height:20px}',
'#aj-sonido[aria-pressed=true] .aj-onda{display:none}',
'#aj-sonido .aj-tache{display:none}',
'#aj-sonido[aria-pressed=true] .aj-tache{display:inline}',
/* el aviso, debajo de la mochila y del Pase del núcleo (62 y 102 px), que van encima del juego */
'#aj-aviso{position:absolute;left:50%;top:calc(138px + env(safe-area-inset-top));transform:translate(-50%,-8px);max-width:88%;width:max-content;text-align:center;',
'  padding:10px 18px;border-radius:14px;background:var(--vidrio);border:1px solid var(--borde);font-size:14.5px;font-weight:600;line-height:1.35;opacity:0;transition:opacity .35s,transform .35s}',
'#aj-aviso.aj-ver{opacity:1;transform:translate(-50%,0)}',
'#aj-aviso.aj-oro{background:linear-gradient(180deg,rgba(255,214,140,.94),rgba(242,170,80,.94));color:#3A2410;border-color:#FFE3A3}',
'#aj-aviso.aj-caza{background:rgba(130,28,40,.7);border-color:rgba(255,170,170,.5)}',
'#aj-mirar,#aj-saltar{position:absolute;bottom:calc(22px + env(safe-area-inset-bottom));pointer-events:auto;border:1px solid var(--borde);border-radius:999px;padding:12px 17px;',
'  background:var(--vidrio);color:#FFF1DA;font-weight:700;font-size:14.5px;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
'#aj-mirar{right:16px}',
'#aj-mirar[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,214,140,.94),rgba(242,170,80,.94));color:#3A2410}',
'#aj-saltar{left:16px;z-index:8}',
'#aj-palanca{position:absolute;left:0;top:0;width:116px;height:116px;margin:-58px 0 0 -58px;border-radius:50%;border:2px solid rgba(255,241,218,.4);',
'  background:radial-gradient(circle,rgba(255,241,218,.05),rgba(255,241,218,.15));pointer-events:none;display:none;z-index:4}',
'#aj-palanca.aj-ver{display:block}',
'#aj-perilla{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFF6E4,#E9D2A6);box-shadow:0 4px 14px rgba(0,0,0,.35)}',
'#aj-destino{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(255,227,163,.9);box-shadow:0 0 14px rgba(255,200,110,.7);pointer-events:none;opacity:0;transition:opacity .4s;z-index:3}',
'#aj-destino.aj-ver{opacity:1;animation:aj-pulso 1s ease-out infinite}',
'@keyframes aj-pulso{from{transform:scale(.6)}to{transform:scale(1.2)}}',
/* el globo de diálogo sobre la cabeza de quien habla */
'#aj-globo{position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:250px;padding:10px 14px;border-radius:16px;background:#FFF9EE;color:#2A1B33;',
'  font-family:var(--serif);font-style:italic;font-size:16px;line-height:1.3;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;z-index:3;transition:opacity .25s}',
'#aj-globo::after{content:"";position:absolute;left:50%;bottom:-9px;margin-left:-9px;border:9px solid transparent;border-bottom:0;border-top-color:#FFF9EE}',
'#aj-globo.aj-oculto{opacity:0}',
'#aj-globo b{font-style:normal;font-family:var(--sans);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9A2A22;display:block;margin-bottom:2px}',
/* la tarjeta de la foto */
'#aj .aj-capa{position:absolute;inset:0;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 40%,rgba(20,24,52,.35),rgba(8,10,24,.8));opacity:0;transition:opacity .35s;z-index:6}',
'#aj .aj-capa.aj-ver{opacity:1}',
'#aj .aj-tarjeta{width:min(330px,100%);background:linear-gradient(180deg,#FFF9EC,#F4E6CB);color:var(--tinta);border-radius:18px;padding:16px 16px 18px;',
'  box-shadow:0 24px 60px rgba(0,0,0,.45),0 0 0 1px rgba(200,150,60,.35) inset;transform:translateY(16px) scale(.96);transition:transform .4s cubic-bezier(.2,.9,.3,1.2)}',
'#aj .aj-capa.aj-ver .aj-tarjeta{transform:none}',
'#aj .aj-num{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#9A6A2E;margin:2px 4px 10px;display:flex;align-items:center;gap:8px}',
'#aj .aj-num i{width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#E8384F 45%,#7A1020);display:inline-block}',
'#aj .aj-tarjeta img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;background:#E8D6B4;box-shadow:0 2px 0 #fff,0 6px 18px rgba(80,40,10,.18)}',
'#aj .aj-tarjeta p{font-family:var(--serif);font-style:italic;font-size:21px;line-height:1.35;margin:14px 6px 16px;color:#3A2410;overflow-wrap:anywhere}',
'#aj .aj-tarjeta p:empty{display:none}',
'#aj .aj-tarjeta button,#aj .aj-boton{width:100%;appearance:none;border:0;border-radius:12px;padding:14px;font-weight:650;font-size:16px;color:#3A2410;',
'  background:linear-gradient(180deg,#FFE3A3,#F2B55A);box-shadow:0 10px 30px rgba(242,150,70,.32),inset 0 1px 0 rgba(255,255,255,.7);cursor:pointer}',
/* la cuenta regresiva, el saludo y la dedicatoria que trae la estrella */
'#aj-cuenta{position:absolute;left:50%;top:17%;transform:translate(-50%,-50%);font-family:var(--serif);font-weight:600;font-size:110px;line-height:1;color:#FFF3D6;',
'  text-shadow:0 0 30px rgba(255,190,100,.95),0 0 80px rgba(255,140,60,.6),0 3px 6px rgba(0,0,0,.4);pointer-events:none;z-index:5}',
'#aj-cuenta.aj-late{animation:aj-late .9s ease-out}',
'@keyframes aj-late{from{transform:translate(-50%,-50%) scale(1.5);opacity:.2}30%{opacity:1}to{transform:translate(-50%,-50%) scale(1);opacity:.85}}',
'#aj-cuenta-rot{display:block;font-size:13px;letter-spacing:.3em;text-transform:uppercase;font-family:var(--sans);font-weight:700;color:var(--oro2);text-align:center;margin-top:6px;text-shadow:0 1px 4px rgba(0,0,0,.6)}',
'#aj-feliz{position:absolute;left:0;right:0;top:22%;text-align:center;font-family:var(--serif);font-weight:600;font-size:44px;line-height:1.08;color:#FFF3D6;padding:0 18px;',
'  text-shadow:0 0 26px rgba(255,190,100,.95),0 0 60px rgba(255,120,80,.55),0 2px 4px rgba(0,0,0,.45);pointer-events:none;z-index:5;opacity:0;transition:opacity 1.2s;overflow-wrap:anywhere}',
'#aj-feliz.aj-ver{opacity:1}',
'#aj-feliz small{display:block;font-size:.5em;font-style:italic;font-weight:400;color:var(--oro2);margin-top:8px}',
/* abajo, sobre el piso de la plaza y encima de "Saltar": arriba chocaba con los globos de diálogo
   (van sobre las cabezas) y con la mochila y el Pase del núcleo */
'#aj-dedica{position:absolute;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));width:min(340px,calc(100% - 32px));transform:translate(-50%,10px);z-index:5;',
'  padding:14px 18px 16px;border-radius:16px;text-align:center;background:linear-gradient(180deg,rgba(255,249,236,.95),rgba(244,230,203,.95));color:#3A2410;',
'  box-shadow:0 16px 40px rgba(0,0,0,.4),0 0 0 1px rgba(200,150,60,.4) inset,0 0 40px rgba(255,200,110,.35);opacity:0;transition:opacity .9s,transform .9s;cursor:pointer}',
'#aj-dedica.aj-ver{opacity:1;transform:translate(-50%,0)}',
'#aj-dedica small{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#9A6A2E;margin-bottom:6px}',
'#aj-dedica p{margin:0;font-family:var(--serif);font-style:italic;font-size:18px;line-height:1.38;white-space:pre-line;overflow-wrap:anywhere;max-height:9.6em;overflow:hidden}',
'#aj-dedica .aj-firma{margin-top:8px;font-size:14px;font-family:var(--serif);color:#7A4E1E}',
'#aj-dedica .aj-firma:empty{display:none}',
'#aj-velo{position:absolute;inset:0;background:#05060d;opacity:0;transition:opacity .7s ease;pointer-events:none;z-index:7}',
'#aj-velo.aj-ver{opacity:1}',
/* la galería */
/* la galería empieza debajo de la mochila del núcleo; "Seguir" queda siempre a la vista */
'#aj #aj-galeria{padding-top:calc(112px + env(safe-area-inset-top));padding-bottom:calc(12px + env(safe-area-inset-bottom))}',
'#aj .aj-gal{width:min(370px,100%);max-height:100%;overflow:auto;text-align:center;color:#FFF3DE;padding-bottom:0}',
'#aj .aj-gal h2{font-family:var(--serif);font-weight:600;font-size:27px;margin:0 0 6px;text-shadow:0 2px 18px rgba(255,170,90,.45)}',
'#aj .aj-mini{letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:var(--oro2);opacity:.92;margin:0 0 10px}',
'#aj .aj-sub{margin:0 0 16px;font-size:14px;opacity:.85}',
'#aj-gal-lista{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
'#aj .aj-foto{appearance:none;border:0;padding:6px 6px 8px;border-radius:12px;background:linear-gradient(180deg,#FFF9EC,#F4E6CB);color:#3A2410;cursor:pointer;text-align:left}',
'#aj .aj-foto:first-child{grid-column:1/3}',
'#aj .aj-foto img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}',
'#aj .aj-foto span{display:block;font-family:var(--serif);font-style:italic;font-size:13.5px;line-height:1.3;margin:6px 2px 0;overflow-wrap:anywhere}',
'#aj .aj-botones{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:14px;position:sticky;bottom:0;padding:14px 0 4px;background:linear-gradient(rgba(8,10,24,0),rgba(8,10,24,.92) 34%)}',
'#aj .aj-otra{appearance:none;border:1px solid var(--borde);border-radius:999px;padding:12px 26px;font-weight:650;font-size:15px;color:#FFF1DA;background:var(--vidrio);cursor:pointer}',
'#aj-grande figure{margin:0;width:min(360px,100%)}',
'#aj-grande img{width:100%;border-radius:12px}',
'#aj-grande figcaption{font-family:var(--serif);font-style:italic;font-size:19px;color:#FFF3DE;margin-top:10px;text-align:center;overflow-wrap:anywhere}',
'#aj-fps{position:absolute;left:8px;bottom:calc(8px + env(safe-area-inset-bottom));font:11px/1.3 ui-monospace,Consolas,monospace;color:#CFFFD8;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:6px;pointer-events:none;z-index:9}',
'@media (prefers-reduced-motion: reduce){#aj *{transition:none!important;animation:none!important}}',
'@media (orientation:landscape) and (max-height:500px){#aj-cuenta{font-size:80px}#aj-dedica,#aj-dedica.aj-ver{bottom:12px;left:auto;right:12px;transform:none;width:min(300px,45%)}}'
].join('\n');

function estilos() {
  if (document.getElementById('aj-estilo')) return;
  var s = document.createElement('style'); s.id = 'aj-estilo'; s.textContent = CSS; document.head.appendChild(s);
}
function el(tag, id, cls, padre, txt) {
  var e = document.createElement(tag); if (id) e.id = 'aj-' + id; if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (padre) padre.appendChild(e); return e;
}
var SVG_ESFERA = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><defs><radialGradient id="aj-gEs" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#E8384F"/><stop offset="1" stop-color="#6A0E1A"/></radialGradient></defs><rect x="10" y="2" width="4" height="3" rx="1" fill="#E8B64A"/><circle cx="12" cy="14" r="8.5" fill="url(#aj-gEs)"/></svg>';
var SVG_SONIDO = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFE3A3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="#FFE3A3" stroke="none"/><path class="aj-onda" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/><path class="aj-tache" d="M17 9l5 6M22 9l-5 6"/></svg>';

/* Arma la pantalla dentro de "caja" y devuelve sus piezas. $('x') es #aj-x. */
A.armarPantalla = function (caja) {
  estilos();
  var raiz = el('div', null, null, caja); raiz.id = 'aj';
  var lienzo = el('canvas', 'escena', null, raiz); lienzo.setAttribute('aria-label', 'Una placita de la costa en Nochebuena, con un árbol de Navidad apagado');
  var carga = el('div', 'carga', null, raiz); carga.setAttribute('role', 'status');
  el('i', null, null, carga).setAttribute('aria-hidden', 'true'); el('p', 'carga-txt', null, carga, 'Preparando la plaza…');
  var hud = el('div', 'hud', null, raiz); hud.hidden = true;
  var arriba = el('div', null, 'aj-arriba', hud);
  var esferas = el('div', 'esferas', 'aj-pill', arriba); esferas.setAttribute('aria-live', 'polite');
  esferas.innerHTML = SVG_ESFERA; el('span', 'esferas-n', null, esferas, '0 de 0');
  var rumbo = el('div', 'rumbo', 'aj-pill', arriba);
  el('span', 'flecha', null, rumbo, '➤').setAttribute('aria-hidden', 'true'); el('span', 'rumbo-txt', null, rumbo, 'Esfera');
  var sonido = el('button', 'sonido', null, arriba); sonido.type = 'button'; sonido.setAttribute('aria-label', 'Silenciar'); sonido.setAttribute('aria-pressed', 'false'); sonido.innerHTML = SVG_SONIDO;
  el('div', 'aviso', null, hud).setAttribute('role', 'status');
  var mirar = el('button', 'mirar', null, hud, '👀 Mirar'); mirar.type = 'button'; mirar.setAttribute('aria-pressed', 'false');
  var saltar = el('button', 'saltar', null, raiz, 'Saltar ⏭'); saltar.type = 'button'; saltar.hidden = true;
  var globo = el('div', 'globo', 'aj-oculto', raiz); globo.setAttribute('aria-live', 'polite');
  el('b', 'globo-quien', null, globo); el('span', 'globo-txt', null, globo);
  el('div', 'destino', null, raiz).setAttribute('aria-hidden', 'true');
  var palanca = el('div', 'palanca', null, raiz); palanca.setAttribute('aria-hidden', 'true'); el('i', 'perilla', null, palanca);
  /* la tarjeta de la foto */
  var carta = el('div', 'carta', 'aj-capa', raiz); carta.hidden = true;
  var tj = el('div', null, 'aj-tarjeta', carta); tj.setAttribute('role', 'dialog'); tj.setAttribute('aria-modal', 'true'); tj.setAttribute('aria-labelledby', 'aj-carta-num');
  var num = el('div', 'carta-num', 'aj-num', tj); el('i', null, null, num); el('span', 'carta-num-txt', null, num, 'Esfera 1');
  var fo = el('img', 'carta-foto', null, tj); fo.alt = '';
  el('p', 'carta-frase', null, tj); el('button', 'carta-seguir', null, tj, 'Seguir buscando').type = 'button';
  /* la cuenta regresiva, el saludo y la dedicatoria */
  var cuenta = el('div', 'cuenta', null, raiz); cuenta.hidden = true; el('span', 'cuenta-n', null, cuenta, '10'); el('span', 'cuenta-rot', null, cuenta, 'para las doce');
  var feliz = el('div', 'feliz', null, raiz); el('span', 'feliz-txt', null, feliz, '¡Feliz Navidad!'); el('small', 'feliz-sub', null, feliz, 'y que nadie pase la Navidad solito');
  var dedica = el('div', 'dedica', null, raiz); dedica.hidden = true; dedica.setAttribute('role', 'status');
  el('small', null, null, dedica, '⭐ La estrella trae un mensaje'); el('p', 'dedica-txt', null, dedica); el('div', 'dedica-firma', 'aj-firma', dedica);
  var velo = el('div', 'velo', null, raiz); velo.hidden = true;
  /* la galería */
  var gal = el('div', 'galeria', 'aj-capa', raiz); gal.hidden = true;
  var gg = el('div', null, 'aj-gal', gal); gg.setAttribute('role', 'dialog'); gg.setAttribute('aria-modal', 'true'); gg.setAttribute('aria-labelledby', 'aj-gal-tit');
  el('p', null, 'aj-mini', gg, 'El árbol está encendido'); el('h2', 'gal-tit', null, gg, 'Los recuerdos de tu árbol');
  el('p', 'gal-sub', 'aj-sub', gg, 'Toca una foto para verla grande'); el('div', 'gal-lista', null, gg);
  var bts = el('div', null, 'aj-botones', gg);
  el('button', 'gal-seguir', 'aj-boton', bts, 'Seguir').type = 'button';
  el('button', 'gal-otra', 'aj-otra', bts, 'Jugar otra vez').type = 'button';
  var grande = el('div', 'grande', 'aj-capa aj-ver', raiz); grande.hidden = true;
  var fig = el('figure', null, null, grande); var gi = el('img', 'grande-img', null, fig); gi.alt = ''; el('figcaption', 'grande-txt', null, fig);
  var fps = el('div', 'fps', null, raiz); fps.hidden = true;
  return { raiz: raiz, lienzo: lienzo, $: function (id) { return document.getElementById('aj-' + id); } };
};
})();

;
/* El árbol que se enciende — juego.js: el juego entero, como una función que se abre y se cierra.

   LA HISTORIA. Nochebuena en una placita de la costa. Don Gruñón, el muki de la mina (el duende
   de las minas de los Andes), sale de la oscuridad atraído por las luces y se lleva lo que
   brilla, como el oro: las esferas (cada una guarda una foto del regalo) y la estrella. Ruway recorre la plaza con la palanca (o tocando el piso) y una
   brújula suave lo guía. De vez en cuando Don Gruñón aparece, se ríe y sale corriendo con una
   esfera alrededor de la pileta: una persecución corta y fácil (se cansa, se para a resoplar y,
   si nadie lo alcanza, se tropieza solo). Cada esfera vuela al árbol, se cuelga, enciende su
   parte y muestra su foto con su frase. Con todas: el final (final.js), con la estrella que trae
   la dedicatoria, y la galería.

   Lo usan u.html (Universo.html, tipo 'arbol') y la maqueta (maquetas/arbol).

     var j = Arbol.jugar({
       contenedor: <div> de la página donde va la pantalla del juego (#aj, fija, a pantalla completa),
       fotos():    las fotos como están AHORA: [{im, txt, j, k, lista, rota, limpia}] (fotosConSitio()
                   de u.html, hasta 8). Se vuelve a mirar cada medio segundo: una foto que llega
                   tarde ocupa su escondite cuando llega; una rota no cuenta. limpia: se puede
                   pintar en WebGL (llegó con permiso de copia); si no, su esfera va sin foto
                   adentro y la tarjeta la muestra igual,
       vistas:     los j de las fotos que ya se vieron (un regalo de antes): empiezan colgadas,
       para, msg, de: el nombre del saludo, la dedicatoria y la firma (siempre como texto),
       glb, movs:  dónde están Ruway y sus movimientos,
       gpu:        el nombre de la tarjeta de video, si la página ya lo sabe (elige la calidad),
       musica:     false si el regalo trae su propia canción (el juego no pone la suya),
       ac:         un AudioContext creado en un toque de la página (el iPhone lo exige),
       tapado():   true si algo de la página tapa la plaza (entonces no se dibuja),
       al: { listo(), vio(k, j), encendido(), seguir(), otraVez(), fallo(motivo), sonido(mudo) }
     });
     j.pausar(true|false);   // p. ej. mientras se arma el video del estado
     j.cerrar();             // libera todo: geometrías, materiales, texturas, sonido y el contexto WebGL

   fallo(motivo): 'sin3d' (no hay WebGL), 'ruway' (no llegó Ruway), 'perdido' (se perdió el
   contexto). La página sigue con el árbol 2D de siempre.

   Celulares de gama baja primero: un solo WebGLRenderer; calidad automática (bajo, medio o alto);
   menos resolución si va lento; el bucle se para si la página no se ve o si hay algo encima;
   nada se crea por cuadro. Para pruebas deja window.__arbolJuego (solo con navigator.webdriver
   o window.__RUWAY_PRUEBA): en un regalo de verdad no hay atajos para llegar al final. */
(function () {
'use strict';
var A = window.Arbol;

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
A.liberar = liberar;

/* Si algo lanza mientras se arma, se cierra lo que alcanzó a abrirse y se relanza: la página
   sigue con el árbol 2D sin dejar nada vivo. */
A.jugar = function (o) {
  var cerrarLoAbierto = null;
  try { return jugarAdentro(o || {}, function (c) { cerrarLoAbierto = c; }); }
  catch (e) { if (cerrarLoAbierto) { try { cerrarLoAbierto(); } catch (x) {} } throw e; }
};

function jugarAdentro(o, registrar) {
var al = o.al || {};
var vivo = true, relojes = [], escuchas = [];
function luego(fn, ms) {
  var id = setTimeout(function () { var k = relojes.indexOf(id); if (k >= 0) relojes.splice(k, 1); if (vivo) fn(); }, ms || 0);
  relojes.push(id); return id;
}
function escuchar(t, ev, fn, op) { t.addEventListener(ev, fn, op); escuchas.push([t, ev, fn, op]); }
var R = null, escena = null, ruwayA = null, api = null, corriendo = false, raf = 0, rtEnv = null, lienzoVacio = null, PANT = null;
registrar(cerrar);
A.reiniciar();
PANT = A.armarPantalla(o.contenedor);
var $ = PANT.$, lienzo = PANT.lienzo;
var V3 = THREE.Vector3, P = A.PLAZA;
var VER_FPS = /[?&]fps=1/.test(location.search);
var DATOS = { para: String(o.para || '').trim().slice(0, 24), msg: String(o.msg || '').trim(), de: String(o.de || '').trim().slice(0, 40) };

/* ---------- escena ----------
   La calidad se decide ANTES de crear el lienzo (el antialias no se puede cambiar después),
   con el nombre de la tarjeta de video que averiguó la página (o.gpu), si lo trae. */
var calidad = A.calidad(o.gpu), AJ = A.AJUSTES[calidad];
try { R = new THREE.WebGLRenderer({ canvas: lienzo, antialias: AJ.aa, powerPreference: 'high-performance', alpha: false, stencil: false }); if (!R.getContext()) throw 0; }
catch (e) { R = null; }
if (!R) {
  luego(function () { var f = al.fallo; cerrar(); if (f) f('sin3d'); }, 0);
  return { cerrar: cerrar, pausar: function () {}, estado: function () { return { fallo: true }; }, fallo: true };
}
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
R.outputEncoding = THREE.sRGBEncoding;
A.webgl2 = R.capabilities.isWebGL2;
var prMax = Math.min(window.devicePixelRatio || 1, AJ.pr), pr = prMax, prMin = Math.min(prMax, .75);
R.setPixelRatio(pr);
escena = new THREE.Scene();
var cam = new THREE.PerspectiveCamera(55, 1, .1, 400);
cam.position.set(6, 2.4, -1); cam.lookAt(0, 3, -9);

A.prepararLuces(AJ.luces);
A.armarLuces(escena, AJ.luces);
escena.add(new THREE.HemisphereLight(A.U.uCieloCol.value, A.U.uSueloCol.value, 1));
var luna = new THREE.DirectionalLight(A.U.uLunaCol.value, 1); luna.position.copy(A.U.uLuna.value).multiplyScalar(50); escena.add(luna);

var cielo = A.armarCielo(escena, R, AJ);
A.armarPiso(escena);
var casas = A.armarCasas(escena, AJ);
var balcones = A.armarBalcones(escena, casas.lista);
var torre = A.armarTorre(escena);
var F = A.Foquitos();
A.guirnaldasFachadas(F, casas.lista);
rtEnv = new THREE.WebGLCubeRenderTarget(AJ.cubo, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, encoding: THREE.sRGBEncoding });
var camEnv = new THREE.CubeCamera(.2, 200, rtEnv); camEnv.position.set(0, 2.2, -3.2); escena.add(camEnv);
var adornos = A.armarAdornos(escena, AJ, rtEnv.texture, F);
A.armarNacimiento(escena);
var puesto = A.armarPuesto(escena, F);
var foquitos = F.armar(escena);
var resplandores = A.armarResplandores(escena, adornos.resplandores);
var arbol = A.armarArbol(escena, AJ, rtEnv.texture);
var grunon = A.armarGrunon(escena, AJ, rtEnv.texture);
var chispas = A.armarChispas(escena, A.reducido ? 160 : 420);
var fuegos = A.armarFuegos(escena, AJ, function (tipo, ret) { A.Audio.fuego(tipo, ret); });
var nieve = A.armarNieve(escena, A.reducido ? Math.round(AJ.nieve * .4) : AJ.nieve);
var vapor = A.armarVapor(escena);
vapor.fuente(puesto.olla, 1);
var haces = A.armarHaces(escena, 9);
/* sombras de contacto de los personajes (dos manchas que los siguen) */
var gSom = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mSom = new THREE.MeshBasicMaterial({ map: A.texSombra(), color: '#000', transparent: true, depthWrite: false, opacity: .9 });
var sombraR = new THREE.Mesh(gSom, mSom), sombraG = new THREE.Mesh(gSom, mSom); sombraR.renderOrder = sombraG.renderOrder = 1; escena.add(sombraR); escena.add(sombraG);
sombraR.visible = false;

function pintarEnv() {
  /* los puntos de luz miden en píxeles de pantalla: se achican al tamaño de cada cara del cubo */
  adornos.agua.forEach(function (m) { m.visible = false; });
  var gv = grunon.raiz.visible; grunon.raiz.visible = false;
  A.repartirLuces(camEnv.position);
  foquitos.medir(1, AJ.cubo); resplandores.medir(1, AJ.cubo); arbol.medir(1, AJ.cubo);
  camEnv.update(R, escena);
  adornos.agua.forEach(function (m) { m.visible = true; }); grunon.raiz.visible = gv;
  medir();
}

/* ---------- las fotos y sus esferas ----------
   Cada foto ocupa un escondite fijo (la tercera es siempre la tercera). Estado de cada una:
   'pendiente' (en camino) → 'escondida' → 'mano' / 'robada' → 'vuela' → 'colgada'; o 'rota'. */
var ESCONDITES = [
  { id: 'nacimiento', nom: 'junto al nacimiento', p: [-13.15, .5, 1.42], r: 1.5, acc: 'recoger' },
  { id: 'banca', nom: 'debajo de una banca', p: [9.4, .2, 5.5], r: 1.4, acc: 'recoger' },
  { id: 'balcon', nom: 'colgada de un balcón', p: [balcones.norte.x, 2.28, balcones.norte.z + .05], r: 1.5, acc: 'saltar' },
  { id: 'pileta', nom: 'flotando en la pileta', p: [1.65, .56, 1.5], r: 1.75, acc: 'recoger' },
  { id: 'chocolatada', nom: 'entre los panetones', p: [12.42, 1.13, .7], r: 1.5, acc: 'recoger' },
  { id: 'palmera', nom: 'al pie de una palmera', p: [-9.85, .26, 9.95], r: 1.4, acc: 'recoger' },
  { id: 'maceta', nom: 'en una maceta', p: [-6.95, 1.06, 5.25], r: 1.4, acc: 'recoger' },
  { id: 'escalinata', nom: 'en la escalinata de la casona', p: [1.7, .64, -23.3], r: 1.5, acc: 'recoger' }
];
var fuente = typeof o.fotos === 'function' ? o.fotos : function () { return o.fotos || []; };
var VISTAS = {}; (o.vistas || []).forEach(function (j) { VISTAS[j] = 1; });
var fotos = [], ES = [];
fuente().slice(0, ESCONDITES.length).forEach(function (f, i) {
  fotos.push({ i: i, j: f.j == null ? i : f.j, k: f.k == null ? i : f.k, img: null, limpia: false, frase: String(f.txt || ''), estado: 'pendiente' });
});
var nPed = fotos.length;
/* el atlas se arma con todos los sitios; cada foto se dibuja en el suyo cuando llega (y solo si
   se puede: una foto sin permiso de copia mancharía el atlas y WebGL no lo aceptaría) */
lienzoVacio = A.lienzo(8, 8);
var esferas = A.armarEsferas(escena, rtEnv.texture, fotos.map(function (f) { return { img: lienzoVacio, frase: f.frase }; }));
ES = esferas.lista;
ES.forEach(function (e, i) { e.estado = 'pendiente'; e.esc = ESCONDITES[i]; e.orden = -1; e.t = 0; e.desde = new V3(); e.ctrl = new V3(); e.hacia = new V3(); e.hiloK = 0; });
var totalValidas = 0, encontradas = 0;
function ponerFoto(f) {
  f.estado = 'lista'; var e = ES[f.i];
  if (f.limpia && f.img) esferas.redibujar(f.i, f.img);
  e.estado = 'escondida'; e.visible = true; e.escala = .55; e.on = .3; e.foto = .12; e.hilo = 0;
  e.p.set(e.esc.p[0], e.esc.p[1], e.esc.p[2]);
  recontar();
  /* lo ya visto en una visita anterior cuenta como encontrado: empieza colgada en el árbol */
  if (VISTAS[f.j]) colgarYa(e);
}
function colgarYa(e) {
  e.estado = 'colgada'; e.orden = encontradas; arbol.lugar(e.orden, Math.max(1, totalValidas), e.p); arbol.encender(e.orden, 1);
  e.on = 1; e.foto = 1; e.hilo = .34; e.escala = 1; encontradas++; pintarHud();
  revisarCompleto();
}
function recontar() {
  totalValidas = fotos.filter(function (f) { return f.estado !== 'rota'; }).length;
  arbol.secciones(Math.max(1, totalValidas));
  ES.forEach(function (e, i) { if (fotos[i].estado === 'rota') { e.visible = false; e.estado = 'rota'; } });
  pintarHud();
  revisarCompleto();
}
/* Si mientras se busca ya no queda nada por encontrar (la que faltaba llegar se dio por rota, o
   llegó tarde una que ya se había visto en otra visita), se enciende el árbol: si no, la persona
   quedaba en la plaza sin nada que buscar y sin final. */
function revisarCompleto() {
  if (estado !== 'juego' || !totalValidas || encontradas < totalValidas) return;
  aviso('¡Ya están todas! A encender el árbol', 'oro', 2400);
  cambiar('cine'); luego(empezarFinal, 1400);
}
/* cada medio segundo: las que llegaron ocupan su escondite; las que no llegan a los 25 s de empezar
   la búsqueda, no cuentan. (Se cuenta desde la búsqueda y no desde que se arma la plaza: en un
   celular lento, mientras baja Ruway las fotos siguen llegando, y antes alguna se daba por rota
   antes de que la persona pudiera buscar nada.) */
var inicioBusqueda = 0;
function revisarFotos() {
  var L = fuente(), cambio = false;
  fotos.forEach(function (f) {
    if (f.estado !== 'pendiente') return;
    var s = L[f.i];
    if (!s || s.rota || (inicioBusqueda && Date.now() - inicioBusqueda > 25000)) { f.estado = 'rota'; cambio = true; return; }
    if (s.lista && s.im) { f.img = s.im; f.limpia = !!s.limpia; ponerFoto(f); }
  });
  if (cambio) recontar();
  if (fotos.some(function (f) { return f.estado === 'pendiente'; })) luego(revisarFotos, 500);
}

/* ---------- estado del juego ---------- */
var estado = 'portada', t = 0, tEstado = 0, cargaRuway = 'esperando', listo = false;
function cambiar(e) { estado = e; tEstado = 0; pintarSaltar(); }
var RW = { x: 0, z: 6.5, rumbo: Math.PI, v: 0, y: 0 }, vRw = new V3(), mano = new V3();
var GR = { x: .9, z: -6.3, rumbo: 0, v: 0, ang: 0, dir: 1, cansado: 0, sigR: 0, t: 0, esfera: null, burla: false };
var destino = null, accionEsfera = null;

/* ---------- interfaz ---------- */
var avisoT = 0;
function aviso(txt, tipo, ms) { var el = $('aviso'); el.textContent = txt; el.className = 'aj-ver' + (tipo ? ' aj-' + tipo : ''); avisoT = (ms || 2000) / 1000; }
var globo = { t: 0, punto: new V3(), quien: '' };
function decir(quien, txt, ms, sigue) {
  $('globo-quien').textContent = quien; $('globo-txt').textContent = txt;
  $('globo').className = ''; globo.t = (ms || 2200) / 1000; globo.quien = sigue || 'grunon';
}
function globoEn(p) { globo.punto.copy(p); }
var vProy = new V3(), globoEl = $('globo');
function globoCuadro(dt) {
  if (globo.t <= 0) { if (globoEl.className !== 'aj-oculto') globoEl.className = 'aj-oculto'; return; }
  globo.t -= dt;
  vProy.copy(globo.punto).project(cam);
  if (vProy.z > 1) { globoEl.className = 'aj-oculto'; return; }
  var x = (vProy.x + 1) / 2 * innerWidth, y = (1 - vProy.y) / 2 * innerHeight;
  x = Math.max(130, Math.min(innerWidth - 130, x)); y = Math.max(110, Math.min(innerHeight - 20, y));
  globoEl.style.left = x.toFixed(1) + 'px'; globoEl.style.top = y.toFixed(1) + 'px';
}
function pintarHud() {
  var n = totalValidas;
  $('esferas-n').textContent = n ? (encontradas + ' de ' + n) : (encontradas ? 'La estrella' : 'Busca la estrella');
  $('esferas').className = 'aj-pill' + (encontradas ? ' aj-brilla' : '');
}
/* "Saltar": en la intro y en el final (el final es largo antes de la voz) */
function pintarSaltar() { var b = $('saltar'); if (b) b.hidden = !(estado === 'intro' || (estado === 'final' && finalT() < 50)); }
escuchar($('saltar'), 'click', function () {
  A.Audio.iniciar(o.ac);
  if (estado === 'intro') saltarIntro();
  else if (estado === 'final') saltarFinal();
});
escuchar($('sonido'), 'click', function () {
  A.Audio.iniciar(o.ac); var m = !A.Audio.mudo(); A.Audio.mudo(m); this.setAttribute('aria-pressed', m ? 'true' : 'false'); this.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar');
  if (al.sonido) al.sonido(m);
});

/* ---------- mandos: palanca, tocar el piso, Mirar, teclado ---------- */
var palanca = $('palanca'), perilla = $('perilla'), PAL_R = 50;
var joy = { x: 0, y: 0, id: null, x0: 0, y0: 0, t0: 0, mov: false };
var dedos = {}, mirando = false, orb = { yaw: 0, pitch: 0, dist: 1, quieto: 9 };
function nDedos() { return Object.keys(dedos).length; }
function separacion() { var k = Object.keys(dedos); if (k.length < 2) return 0; var a = dedos[k[0]], b = dedos[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
function soltarPalanca() { joy.id = null; joy.x = joy.y = 0; palanca.className = ''; perilla.style.transform = ''; }
function puedeMover() { return estado === 'juego' || estado === 'persecucion' || estado === 'libre'; }
function ponerMirar(m) {
  mirando = m; var b = $('mirar'); b.textContent = m ? '🚶 Caminar' : '👀 Mirar'; b.setAttribute('aria-pressed', m ? 'true' : 'false'); soltarPalanca();
  if (m) aviso('Arrastra para mirar alrededor · pellizca para acercar', '', 2600); else orb.quieto = 9;
}
escuchar($('mirar'), 'click', function () { ponerMirar(!mirando); });
escuchar(lienzo, 'pointerdown', function (e) {
  A.Audio.iniciar(o.ac);
  if (estado === 'intro') { saltarIntro(); return; }
  if (!puedeMover()) return;
  e.preventDefault();
  dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
  try { lienzo.setPointerCapture(e.pointerId); } catch (er) {}
  if (mirando || nDedos() >= 2) { soltarPalanca(); return; }
  joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY; joy.t0 = performance.now(); joy.mov = false;
  palanca.style.left = joy.x0 + 'px'; palanca.style.top = joy.y0 + 'px';
});
escuchar(lienzo, 'pointermove', function (e) {
  var d = dedos[e.pointerId]; if (!d) return;
  var n = nDedos();
  if (mirando || n >= 2) {
    var ant = separacion(); orb.yaw -= (e.clientX - d.x) / n * .009; orb.pitch = A.lim(orb.pitch + (e.clientY - d.y) / n * .006, -.35, 1.0); orb.quieto = 0;
    d.x = e.clientX; d.y = e.clientY; var nue = separacion(); if (n >= 2 && ant > 0 && nue > 0) orb.dist = A.lim(orb.dist * ant / nue, .5, 2.2);
    return;
  }
  d.x = e.clientX; d.y = e.clientY;
  if (joy.id !== e.pointerId) return;
  var dx = e.clientX - joy.x0, dy = e.clientY - joy.y0, l = Math.hypot(dx, dy), m = Math.min(l, PAL_R);
  if (l > 10) { joy.mov = true; palanca.className = 'aj-ver'; destino = null; }
  if (l > 0) { dx = dx / l * m; dy = dy / l * m; }
  perilla.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
  joy.x = dx / PAL_R; joy.y = -dy / PAL_R;
});
var rayo = new THREE.Raycaster(), v2 = new THREE.Vector2(), plano = new THREE.Plane(new V3(0, 1, 0), 0), golpe = new V3(), destinoV = new V3();
var destinoEl = $('destino');
function soltar(e) {
  var toque = joy.id === e.pointerId && !joy.mov && performance.now() - joy.t0 < 350 && !mirando;
  delete dedos[e.pointerId];
  if (joy.id === e.pointerId) soltarPalanca();
  if (!toque || !puedeMover()) return;
  /* tocar el piso: Ruway va hasta ahí (y si tocaste una esfera, va a ella) */
  v2.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rayo.setFromCamera(v2, cam);
  var mejor = null, dm = 1e9;
  ES.forEach(function (es) { if (es.estado !== 'escondida') return; var d = rayo.ray.distanceSqToPoint(es.p); if (d < 1.2 && d < dm) { dm = d; mejor = es; } });
  if (mejor) destino = destinoV.set(mejor.p.x, 0, mejor.p.z);
  else if (rayo.ray.intersectPlane(plano, golpe)) destino = destinoV.copy(golpe);
  if (destino) { destinoEl.style.left = e.clientX + 'px'; destinoEl.style.top = e.clientY + 'px'; destinoEl.className = 'aj-ver'; luego(function () { destinoEl.className = ''; }, 900); }
}
escuchar(lienzo, 'pointerup', soltar);
escuchar(lienzo, 'pointercancel', soltar);
escuchar(lienzo, 'wheel', function (e) { e.preventDefault(); orb.dist = A.lim(orb.dist * (1 + e.deltaY * .0012), .5, 2.2); orb.quieto = 0; }, { passive: false });
var teclas = {};
escuchar(window, 'keydown', function (e) {
  if (/^(Arrow|Space)/.test(e.code) && puedeMover()) e.preventDefault();
  if (e.code === 'KeyM' && puedeMover()) ponerMirar(!mirando);
  teclas[e.code] = 1; if (estado === 'intro' && e.code === 'Space') saltarIntro();
});
escuchar(window, 'keyup', function (e) { teclas[e.code] = 0; });

/* ---------- Ruway: moverse ---------- */
var camRumbo = 0, vMov = new V3(), fw = new V3(), dr = new V3();
function moverRuway(dt) {
  var jx = joy.x, jy = joy.y;
  var kx = (teclas.ArrowRight || teclas.KeyD ? 1 : 0) - (teclas.ArrowLeft || teclas.KeyA ? 1 : 0), ky = (teclas.ArrowUp || teclas.KeyW ? 1 : 0) - (teclas.ArrowDown || teclas.KeyS ? 1 : 0);
  if (kx || ky) { jx = kx; jy = ky; destino = null; }
  if (mirando) { jx = jy = 0; destino = null; }
  var objV = 0, objDir = null;
  var mag = Math.min(1, Math.hypot(jx, jy));
  if (mag > .12 && puedeMover()) {
    /* adelante es hacia donde mira la cámara */
    cam.getWorldDirection(fw); fw.y = 0; fw.normalize(); dr.set(-fw.z, 0, fw.x);
    vMov.copy(fw).multiplyScalar(jy).addScaledVector(dr, jx).normalize();
    objDir = Math.atan2(vMov.x, vMov.z);
    objV = mag < .68 ? 1.7 * mag / .68 : 4.2;
  } else if (destino && puedeMover()) {
    var dx = destino.x - RW.x, dz = destino.z - RW.z, d = Math.hypot(dx, dz);
    if (d < .35) destino = null;
    else { objDir = Math.atan2(dx, dz); objV = d > 5 ? 4.2 : Math.min(1.9, .8 + d * .5); }
  }
  if (objDir !== null) RW.rumbo += A.angDif(RW.rumbo, objDir) * Math.min(1, dt * 9);
  RW.v += (objV - RW.v) * Math.min(1, dt * (objV > RW.v ? 5 : 8));
  RW.x += Math.sin(RW.rumbo) * RW.v * dt; RW.z += Math.cos(RW.rumbo) * RW.v * dt;
  vRw.set(RW.x, 0, RW.z);
  if (A.empujar(vRw, .32) && destino) { /* si choca yendo a un destino, lo rodea un poco */ RW.rumbo += .02; }
  RW.x = vRw.x; RW.z = vRw.z;
  RW.y += (A.alturaPiso(RW.x, RW.z) - RW.y) * Math.min(1, dt * 12);
}
function posarRuway(dt) {
  if (!ruwayA) return;
  ruwayA.raiz.position.set(RW.x, RW.y, RW.z); ruwayA.raiz.rotation.set(0, RW.rumbo, 0);
  if (!ruwayA.haciendo()) { ruwayA.modo = RW.v > 2.4 ? 'corre' : RW.v > .25 ? 'anda' : 'quieto'; ruwayA.vel = RW.v; }
  else { ruwayA.modo = 'quieto'; ruwayA.vel = 0; }
  ruwayA.cuadro(dt);
  sombraR.position.set(RW.x, RW.y + .015, RW.z); sombraR.scale.set(.9, 1, .9);
}

/* ---------- la cámara ---------- */
var camPos = new V3(0, 3, 10), mira = new V3(), camCine = null, kCine = 0, camLibre = null;
var camCineP = new V3(), camCineM = new V3(), CINE = { p: camCineP, m: camCineM };
function cine(px, py, pz, mx, my, mz) { camCineP.set(px, py, pz); camCineM.set(mx, my, mz); camCine = CINE; }
var vObj = new V3(), vM = new V3();
function camaraCuadro(dt) {
  if (camLibre) { cam.position.fromArray(camLibre[0]); cam.lookAt(camLibre[1][0], camLibre[1][1], camLibre[1][2]); return; }
  if (estado === 'final' || estado === 'galeria') return;     /* la mueve final.js */
  /* detrás de Ruway, a 5 m; la órbita de Mirar encima */
  var objR = RW.v > .4 ? RW.rumbo : camRumbo;
  camRumbo += A.angDif(camRumbo, objR) * Math.min(1, dt * (RW.v > 2 ? 1.8 : 1.1));
  orb.quieto += dt;
  if (!mirando && nDedos() < 2 && orb.quieto > 1.2) { var kv = Math.min(1, dt * 1.6); orb.yaw *= 1 - kv; orb.pitch *= 1 - kv; orb.dist += (1 - orb.dist) * kv; }
  var D = 5.2 * orb.dist, el = A.lim(.42 + orb.pitch, .05, 1.35), ang = camRumbo + Math.PI + orb.yaw;
  vObj.set(RW.x + Math.sin(ang) * Math.cos(el) * D, RW.y + 1.0 + Math.sin(el) * D, RW.z + Math.cos(ang) * Math.cos(el) * D);
  /* que no se meta en las casas ni bajo el piso */
  var L = P.fachada - .6; vObj.x = A.lim(vObj.x, -L, L); vObj.z = A.lim(vObj.z, -L, L); vObj.y = Math.max(vObj.y, .6);
  vM.set(RW.x + Math.sin(camRumbo) * 1.2, RW.y + 1.05, RW.z + Math.cos(camRumbo) * 1.2);
  if (camCine) { kCine = Math.min(1, kCine + dt * 1.4); } else kCine = Math.max(0, kCine - dt * 1.2);
  if (kCine > 0 && camCine) { var ks = A.suave(0, 1, kCine); vObj.lerp(camCine.p, ks); vM.lerp(camCine.m, ks); }
  var kp = Math.min(1, dt * (kCine > 0 ? 3 : 5));
  camPos.lerp(vObj, kp); mira.lerp(vM, Math.min(1, dt * 6));
  cam.position.copy(camPos); cam.lookAt(mira);
}

/* ---------- la brújula ---------- */
var objetivo = new V3(), rumboEl = $('rumbo'), rumboTxt = $('rumbo-txt'), flecha = $('flecha'), rumboVer = '', rumboClase = '';
function brujulaCuadro() {
  var hay = false, txt = '', clase = 'aj-pill';
  if (estado === 'persecucion') { objetivo.set(GR.x, 0, GR.z); hay = true; txt = '¡Atrápalo!'; clase = 'aj-pill aj-caza'; }
  else if (estado === 'juego') {
    var mejor = null, dm = 1e9;
    for (var i = 0; i < ES.length; i++) { var e = ES[i]; if (e.estado !== 'escondida') continue; var d = Math.hypot(e.p.x - RW.x, e.p.z - RW.z); if (d < dm) { dm = d; mejor = e; } }
    if (mejor) { objetivo.set(mejor.p.x, 0, mejor.p.z); hay = true; txt = 'Esfera'; }
    else if (!totalValidas && !estrellaHallada) { objetivo.set(ESTRELLA_ESC.x, 0, ESTRELLA_ESC.z); hay = true; txt = 'Estrella'; }
  }
  var ver = hay ? 'visible' : 'hidden';
  if (ver !== rumboVer) { rumboVer = ver; rumboEl.style.visibility = ver; }
  if (!hay) return;
  var tb = Math.atan2(objetivo.x - RW.x, objetivo.z - RW.z), rel = A.angDif(camRumbo + orb.yaw, tb);
  flecha.style.transform = 'rotate(' + (-90 - rel * 180 / Math.PI).toFixed(1) + 'deg)';
  if ((t * 4 | 0) % 2 === 0) rumboTxt.textContent = txt + ' · ' + Math.round(Math.hypot(objetivo.x - RW.x, objetivo.z - RW.z)) + ' m';
  if (clase !== rumboClase) { rumboClase = clase; rumboEl.className = clase; }
}

/* ---------- encontrar una esfera ---------- */
var ESTRELLA_ESC = new V3(-13.15, .55, 1.42), estrellaHallada = false;
var robables = nPed === 1 ? [0] : nPed < 5 ? [1] : [1, 4], robos = 0, grunonDespues = false, RADIO_P = 4.25, ultimoRobo = -99;
function buscarCerca() {
  if (estado !== 'juego' || !ruwayA) return;
  for (var i = 0; i < ES.length; i++) {
    var e = ES[i]; if (e.estado !== 'escondida') continue;
    var d = Math.hypot(e.p.x - RW.x, e.p.z - RW.z);
    /* las esferas "robables": antes de llegar, aparece Don Gruñón y se la lleva */
    if (robables.indexOf(i) >= 0 && robos < robables.length && d < 7.5 && d > 2.2 && !e.yaRobada && !GR.yendo && t - ultimoRobo > 20) { empezarRobo(e); return; }
    if (d < e.esc.r) { empezarRecoger(e); return; }
  }
  if (!totalValidas && !estrellaHallada && Math.hypot(ESTRELLA_ESC.x - RW.x, ESTRELLA_ESC.z - RW.z) < 1.5) {
    estrellaHallada = true; encontradas = 1; pintarHud(); A.Audio.encontrar(); chispas.estallido(ESTRELLA_ESC, 50, 2, [1, .85, .45]); luego(empezarFinal, 1200); cambiar('cine');
  }
}
function empezarRecoger(e) {
  cambiar('recoger'); destino = null; RW.v = 0; accionEsfera = e;
  RW.rumbo = Math.atan2(e.p.x - RW.x, e.p.z - RW.z);
  var salta = e.esc.acc === 'saltar';
  if (salta) ruwayA.pose = 'alcanza';
  var fin = function () { if (salta) ruwayA.pose = null; if (estado === 'recoger') volar(e); };
  if (!ruwayA.accion(salta ? 'saltar' : 'recoger', fin)) luego(fin, 600);
  luego(function () { if (accionEsfera === e) { e.estado = 'mano'; A.Audio.encontrar(); chispas.estallido(e.p, 40, 1.8, [1, .85, .5]); } }, salta ? 380 : 450);
}
/* la esfera vuela al árbol, se cuelga, enciende su parte; después, la tarjeta con la foto */
var vueloE = null;
function volar(e) {
  cambiar('vuelo'); vueloE = e; accionEsfera = null;
  e.estado = 'vuela'; e.t = 0; e.desde.copy(e.p); e.orden = encontradas;
  arbol.lugar(e.orden, Math.max(1, totalValidas), e.hacia);
  e.ctrl.copy(e.desde).lerp(e.hacia, .5); e.ctrl.y = Math.max(e.desde.y, e.hacia.y) + 4;
  A.Audio.vuela();
  /* la cámara va a mirar el árbol desde el lado de la esfera */
  var dx = e.hacia.x - P.arbol.x, dz = e.hacia.z - P.arbol.z, l = Math.hypot(dx, dz) || 1;
  cine(e.hacia.x + dx / l * 4.6, e.hacia.y + .7, e.hacia.z + dz / l * 4.6, e.hacia.x, e.hacia.y, e.hacia.z);
}
function vueloCuadro(dt) {
  var e = vueloE; if (!e) return;
  e.t += dt / 1.9; var k = Math.min(1, e.t), s = A.suave(0, 1, k);
  var a = 1 - s; e.p.set(a * a * e.desde.x + 2 * a * s * e.ctrl.x + s * s * e.hacia.x, a * a * e.desde.y + 2 * a * s * e.ctrl.y + s * s * e.hacia.y, a * a * e.desde.z + 2 * a * s * e.ctrl.z + s * s * e.hacia.z);
  e.escala = .55 + .45 * s; e.on = .3 + .4 * s;
  if (Math.random() < dt * 45) chispas.chispa(e.p.x, e.p.y, e.p.z, (Math.random() - .5) * .5, -.3, (Math.random() - .5) * .5, .9, 4, 1, .85, .5, .3);
  if (k >= 1 && e.estado === 'vuela') {
    e.estado = 'colgada'; encontradas++; pintarHud();
    arbol.encender(e.orden, 1); A.Audio.enciende(); chispas.estallido(e.p, 60, 2.4, [1, .8, .45]);
    vueloE = null;
    luego(function () { abrirCarta(e); }, 900);
  }
}
function esferasCuadro(dt) {
  for (var i = 0; i < ES.length; i++) {
    var e = ES[i];
    if (e.estado === 'escondida') { e.on = .28 + .12 * Math.sin(t * 2.4 + i); e.foto = .1; e.hilo = e.esc.id === 'balcon' ? 1.0 : 0; }
    else if (e.estado === 'mano' && ruwayA) { ruwayA.manoDer(mano); e.p.lerp(mano.addScaledVector(fw.set(0, 1, 0), .05), Math.min(1, dt * 14)); e.hilo = 0; }
    else if (e.estado === 'robada') { grunon.puntoMano(mano); e.p.copy(mano); e.p.y += .02; e.escala = .5; e.hilo = 0; }
    else if (e.estado === 'suelta') { e.vy -= 9.8 * dt; e.p.y += e.vy * dt; if (e.p.y < .2) { e.p.y = .2; e.vy = Math.abs(e.vy) * .45; } }
    else if (e.estado === 'colgada') { e.on += (1 - e.on) * Math.min(1, dt * 2); e.foto += (1 - e.foto) * Math.min(1, dt * 1.5); e.hilo += (.34 - e.hilo) * Math.min(1, dt * 3); e.escala += (1 - e.escala) * Math.min(1, dt * 3); }
  }
  esferas.cuadro(dt, cam);
}

/* ---------- la tarjeta con la foto (datos del regalo: siempre como texto) ---------- */
function abrirCarta(e) {
  cambiar('carta');
  var f = fotos[e.i];
  $('carta-foto').src = f.img ? f.img.src : ''; $('carta-foto').alt = 'Foto ' + (e.orden + 1);
  $('carta-frase').textContent = f.frase;
  $('carta-num-txt').textContent = 'Esfera ' + encontradas + ' de ' + totalValidas;
  var ultima = encontradas >= totalValidas;
  $('carta-seguir').textContent = ultima ? '¡Ya están todas!' : 'Seguir buscando';
  var el = $('carta'); el.hidden = false; requestAnimationFrame(function () { el.classList.add('aj-ver'); });
  /* queda anotada en el progreso del regalo (N.vio con el índice de la foto) */
  if (al.vio) al.vio(f.k, f.j);
  $('carta-seguir').focus();
}
escuchar($('carta-seguir'), 'click', function () {
  if (estado !== 'carta') return;
  var el = $('carta'); el.classList.remove('aj-ver'); luego(function () { el.hidden = true; }, 300);
  camCine = null;
  if (encontradas >= totalValidas) { cambiar('cine'); luego(empezarFinal, 600); return; }
  cambiar('juego');
  if (grunonDespues) { grunonDespues = false; irseGrunon(); }
  var faltan = totalValidas - encontradas;
  aviso(faltan === 1 ? '¡Falta una sola esfera!' : 'Faltan ' + faltan + ' esferas. Sigue la flecha', 'oro', 2600);
});

/* ---------- Don Gruñón: el robo y la persecución ---------- */
var vG = new V3(), vT = new V3();
function empezarRobo(e) {
  cambiar('robo'); robos++; e.yaRobada = true; destino = null; RW.v *= .3;
  /* aparece al otro lado de la esfera, con un puf de chispas, y la agarra */
  var dx = e.p.x - RW.x, dz = e.p.z - RW.z, l = Math.hypot(dx, dz) || 1;
  GR.x = e.p.x + dx / l * 1.4; GR.z = e.p.z + dz / l * 1.4; vG.set(GR.x, 0, GR.z); A.empujar(vG, .3); GR.x = vG.x; GR.z = vG.z;
  GR.rumbo = Math.atan2(RW.x - GR.x, RW.z - GR.z); GR.v = 0; GR.esfera = e; GR.t = 0; GR.cansado = 0; GR.burla = false;
  grunon.raiz.visible = true; grunon.raiz.scale.setScalar(1); grunon.estado = 'rie';
  chispas.estallido(vT.set(GR.x, .7, GR.z), 50, 2.2, [.9, .95, 1]);
  e.estado = 'robada';
  A.Audio.risa(); decir('Don Gruñón', '¡Je, je! ¡Esta también brilla!', 2200);
  cine(RW.x + (GR.x - RW.x) * .3 - dz / l * 3.2, 1.6, RW.z + (GR.z - RW.z) * .3 + dx / l * 3.2, (RW.x + GR.x) / 2, .9, (RW.z + GR.z) / 2);
  luego(function () {
    if (estado !== 'robo') return;
    camCine = null; cambiar('persecucion'); A.Audio.musica('persecucion');
    GR.ang = Math.atan2(GR.z, GR.x); GR.dir = A.angDif(Math.atan2(RW.z, RW.x), GR.ang) > 0 ? 1 : -1;
    aviso('¡Don Gruñón se lleva una esfera! Alcánzalo', 'caza', 2600);
  }, 2300);
}
function persecucionCuadro(dt) {
  GR.t += dt;
  var dR = Math.hypot(RW.x - GR.x, RW.z - GR.z);
  /* corre alrededor de la pileta, siempre hacia el lado contrario a Ruway */
  if (GR.t - GR.sigR > 1.6) { GR.sigR = GR.t; var da = A.angDif(Math.atan2(RW.z, RW.x), Math.atan2(GR.z, GR.x)); GR.dir = da >= 0 ? 1 : -1; }
  var metaAng = Math.atan2(GR.z, GR.x) + GR.dir * .75;
  vT.set(Math.cos(metaAng) * RADIO_P, 0, Math.sin(metaAng) * RADIO_P);
  var objRumbo = Math.atan2(vT.x - GR.x, vT.z - GR.z);
  /* fácil: se cansa (para a resoplar), va más lento si Ruway está lejos y a los 22 s se tropieza */
  var objV = dR > 9 ? 1.7 : dR < 4 ? 3.0 : 2.6;
  GR.cansado -= dt;
  if (GR.cansado < -3.6) { GR.cansado = .85; A.Audio.uf(); decir('Don Gruñón', '¡Uf, uf… estas piernas!', 1100); }
  if (GR.cansado > 0) objV = 0;
  if (dR > 11 && !GR.burla) { GR.burla = true; A.Audio.risa(); decir('Don Gruñón', '¡Je! ¡En la mina corro más rápido!', 1600); }
  if (dR < 8) GR.burla = false;
  GR.rumbo += A.angDif(GR.rumbo, objV ? objRumbo : Math.atan2(RW.x - GR.x, RW.z - GR.z)) * Math.min(1, dt * 7);
  GR.v += (objV - GR.v) * Math.min(1, dt * 4);
  GR.x += Math.sin(GR.rumbo) * GR.v * dt; GR.z += Math.cos(GR.rumbo) * GR.v * dt;
  vG.set(GR.x, 0, GR.z); A.empujar(vG, .3); GR.x = vG.x; GR.z = vG.z;
  grunon.estado = GR.v > 1.9 ? 'corre' : GR.v > .3 ? 'anda' : 'quieto';
  if (dR < 1.35 || GR.t > 22) atrapado();
}
function atrapado() {
  cambiar('atrapado'); GR.v = 0; A.Audio.musica('calma'); ultimoRobo = t;
  grunon.estado = 'encoge'; A.Audio.ay(); decir('Don Gruñón', '¡Ay, ay! ¡Está bien, está bien!', 2000);
  var e = GR.esfera; GR.esfera = null;
  e.estado = 'suelta'; e.vy = 2.2; e.escala = .55;
  luego(function () { e.estado = 'escondida'; e.p.y = .3; e.esc = { r: 9, acc: 'recoger', id: 'suelta' }; RW.rumbo = Math.atan2(e.p.x - RW.x, e.p.z - RW.z); grunonDespues = true; cambiar('juego'); destino = destinoV.set(e.p.x, 0, e.p.z); }, 1300);
}
function irseGrunon() {
  /* refunfuña y se va caminando a esconderse detrás del árbol; ahí desaparece */
  grunon.estado = 'anda'; GR.v = 1; GR.yendo = true; decir('Don Gruñón', '¡Bah! Ya verás…', 1600); A.Audio.bah();
}
function grunonCuadro(dt) {
  if (estado === 'persecucion') persecucionCuadro(dt);
  else if (GR.yendo) {
    var tx = -3.2, tz = -10.5, d = Math.hypot(tx - GR.x, tz - GR.z);
    GR.rumbo += A.angDif(GR.rumbo, Math.atan2(tx - GR.x, tz - GR.z)) * Math.min(1, dt * 5);
    GR.x += Math.sin(GR.rumbo) * 1.1 * dt; GR.z += Math.cos(GR.rumbo) * 1.1 * dt;
    vG.set(GR.x, 0, GR.z); A.empujar(vG, .3); GR.x = vG.x; GR.z = vG.z;
    if (d < .8 || Math.hypot(GR.x - RW.x, GR.z - RW.z) > 16) { GR.yendo = false; chispas.estallido(vT.set(GR.x, .6, GR.z), 40, 1.8, [.9, .95, 1]); grunon.raiz.visible = false; }
  }
  if (estado === 'final' || estado === 'galeria' || estado === 'libre') return;     /* lo mueve final.js */
  if (!grunon.raiz.visible) return;
  grunon.raiz.position.set(GR.x, A.alturaPiso(GR.x, GR.z), GR.z); grunon.raiz.rotation.set(0, GR.rumbo, 0);
  grunon.vel = GR.v; grunon.giroV = 0;
  grunon.cuadro(dt);
  sombraG.position.set(GR.x, A.alturaPiso(GR.x, GR.z) + .016, GR.z); sombraG.scale.set(.6, 1, .6);
}

/* ---------- la intro (empieza sola cuando llega Ruway; se puede saltar) ---------- */
var introP = new V3(.7, 0, -5.85), introF2 = false;
function empezar() {
  A.Audio.iniciar(o.ac); A.Audio.musica('calma');
  /* Ruway entra por el sur; Don Gruñón está frente al árbol con la estrella */
  RW.x = .4; RW.z = 5.8; RW.rumbo = Math.PI; RW.v = 0; camRumbo = Math.PI; sombraR.visible = true;
  GR.x = introP.x; GR.z = introP.z; GR.rumbo = 0; grunon.raiz.visible = true; grunon.estado = 'rie';
  arbol.estrella.visible = true; arbol.estrellaOn(.3);
  cambiar('intro');
  A.Audio.risa(); decir('Don Gruñón', '¡Je, je! Desde la mina vi brillar sus luces…', 2300);
}
function introCuadro(dt) {
  var k = tEstado;
  cine(2.6, 1.35, -2.3, introP.x - .2, .8, introP.z); kCine = 1;
  if (k > 2.4 && !introF2) { introF2 = true; grunon.estado = 'ofrece'; decir('Don Gruñón', 'Brillan como el oro… ¡me llevo las esferas y la estrella!', 2400); }
  if (k > 4.9) { grunon.estado = 'corre'; GR.v = 2.6; GR.rumbo += A.angDif(GR.rumbo, Math.atan2(-6 - GR.x, -11 - GR.z)) * Math.min(1, dt * 6); GR.x += Math.sin(GR.rumbo) * GR.v * dt; GR.z += Math.cos(GR.rumbo) * GR.v * dt; vG.set(GR.x, 0, GR.z); A.empujar(vG, .3); GR.x = vG.x; GR.z = vG.z; }
  /* la estrella va en sus manos */
  grunon.raiz.updateMatrixWorld(true); grunon.puntoMano(mano); arbol.estrella.position.copy(mano).add(fw.set(0, .12, 0)); arbol.estrella.scale.setScalar(.5); arbol.estrella.rotation.y = GR.rumbo;
  if (k > 6.4) saltarIntro();
}
function saltarIntro() {
  if (estado !== 'intro') return;
  chispas.estallido(vT.set(GR.x, .6, GR.z), 50, 2, [.9, .95, 1]);
  grunon.raiz.visible = false; arbol.estrella.visible = false; arbol.estrellaOn(0); globo.t = 0;
  camCine = null; kCine = 0;
  $('hud').hidden = false; pintarHud();
  cambiar('juego'); inicioBusqueda = Date.now();
  /* un regalo de antes con todo ya visto: directo a encender el árbol */
  if (totalValidas && encontradas >= totalValidas) { aviso('Ya encontraste todas las esferas. ¡A encender el árbol!', 'oro', 2600); cambiar('cine'); luego(empezarFinal, 1800); return; }
  var faltan = totalValidas - encontradas;
  aviso(totalValidas ? (encontradas ? 'Te faltan ' + faltan + (faltan === 1 ? ' esfera' : ' esferas') : 'El muki se llevó ' + totalValidas + (totalValidas === 1 ? ' esfera' : ' esferas')) + '. Sigue la flecha'
    : 'El muki se llevó la estrella. Sigue la flecha', 'oro', 3200);
}

/* ---------- el final ---------- */
var metaFiesta = 0, terminado = false, dedicaVista = false;
var final = A.armarFinal({
  escena: escena, cam: cam, ruway: function () { return ruwayA; }, grunon: grunon, arbol: arbol, chispas: chispas, fuegos: fuegos, nieve: nieve, vapor: vapor, torre: torre,
  decir: function (q, txt, ms, s) { decir(q, txt, ms, s); }, globoEn: globoEn,
  cuenta: function (n) { var el = $('cuenta'); if (n === null) { el.hidden = true; return; } el.hidden = false; $('cuenta-n').textContent = n; $('cuenta-rot').textContent = n ? 'para las doce' : '¡las doce!'; el.classList.remove('aj-late'); void el.offsetWidth; el.classList.add('aj-late'); },
  feliz: function (si) { var p = DATOS.para; $('feliz-txt').textContent = '¡Feliz Navidad' + (p ? ', ' + p : '') + '!'; $('feliz').className = si ? 'aj-ver' : ''; },
  fiesta: function (k) { metaFiesta = k; },
  /* la estrella que devuelve Don Gruñón trae la dedicatoria de quien regala */
  dedicatoria: function (si) { dedicatoria(si); },
  alEncender: function () { if (terminado) return; terminado = true; if (al.encendido) al.encendido(); },
  alTerminar: function () { abrirGaleria(); }
});
function dedicatoria(si) {
  var d = $('dedica');
  if (si) {
    if (!DATOS.msg) return;
    dedicaVista = true;
    $('dedica-txt').textContent = DATOS.msg; $('dedica-firma').textContent = DATOS.de ? '— ' + DATOS.de : '';
    d.hidden = false; requestAnimationFrame(function () { d.classList.add('aj-ver'); });
  } else if (!d.hidden) { d.classList.remove('aj-ver'); luego(function () { if (!d.classList.contains('aj-ver')) d.hidden = true; }, 900); }
}
escuchar($('dedica'), 'click', function () { dedicatoria(false); });
function finalT() { return final.activo() ? final.tiempo() : -1; }
function empezarFinal(desde) {
  if (estado === 'final') return;
  var velo = $('velo'); velo.hidden = false; requestAnimationFrame(function () { velo.classList.add('aj-ver'); });
  $('hud').hidden = true; A.Audio.musica('nada'); globo.t = 0;
  luego(function () {
    cambiar('final');
    /* todas las esferas en su lugar (por si se saltó algo) */
    var k = 0; ES.forEach(function (e) { if (e.estado === 'rota' || e.estado === 'pendiente') return; e.estado = 'colgada'; e.orden = k; arbol.lugar(k, Math.max(1, totalValidas), e.p); arbol.encender(k, 1); k++; });
    final.iniciar(desde || 0); pintarSaltar();
    luego(function () { velo.classList.remove('aj-ver'); luego(function () { velo.hidden = true; }, 700); }, 200);
  }, desde ? 50 : 800);
}
/* Saltar en el final: primero al árbol ya encendido con el "¡Feliz Navidad!"; otra vez, a la galería */
function saltarFinal() {
  var ft = finalT(); if (ft < 0) return;
  dedicatoria(false); globo.t = 0;
  if (ft < 43.5) { final.iniciar(44); pintarSaltar(); }
  else abrirGaleria();
}
/* ---------- la galería ---------- */
var galeriaAbierta = false;
function abrirGaleria() {
  if (galeriaAbierta || estado === 'libre') return;
  cambiar('galeria'); galeriaAbierta = true; dedicatoria(false);
  var g = $('galeria'), lista = $('gal-lista');
  while (lista.firstChild) lista.removeChild(lista.firstChild);
  fotos.filter(function (f) { return f.estado === 'lista' && f.img; }).forEach(function (f, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'aj-foto'; b.setAttribute('aria-label', 'Ver foto ' + (i + 1));
    var im = document.createElement('img'); im.src = f.img.src; im.alt = ''; b.appendChild(im);
    var p = document.createElement('span'); p.textContent = f.frase; b.appendChild(p);
    b.addEventListener('click', function () { $('grande-img').src = f.img.src; $('grande-txt').textContent = f.frase; $('grande').hidden = false; });
    lista.appendChild(b);
  });
  $('gal-sub').textContent = totalValidas ? 'Toca una foto para verla grande' : 'Tu árbol ya brilla en la plaza';
  g.hidden = false; requestAnimationFrame(function () { g.classList.add('aj-ver'); });
}
function cerrarGaleria() { var g = $('galeria'); g.classList.remove('aj-ver'); luego(function () { g.hidden = true; }, 350); galeriaAbierta = false; }
escuchar($('grande'), 'click', function () { this.hidden = true; });
/* Seguir: la plaza queda con el árbol encendido para pasear, y la página sigue (el premio con la voz) */
escuchar($('gal-seguir'), 'click', function () {
  cerrarGaleria(); irLibre();
  if (al.seguir) al.seguir();
});
escuchar($('gal-otra'), 'click', function () { if (al.otraVez) al.otraVez(); });
function irLibre() {
  cambiar('libre'); camCine = null; kCine = 0; metaFiesta = .6;
  if (ruwayA) { RW.x = ruwayA.raiz.position.x; RW.z = ruwayA.raiz.position.z; RW.rumbo = ruwayA.raiz.rotation.y; ruwayA.pose = null; ruwayA.sonrisa = .6; ruwayA.boca = 0; }
  camRumbo = RW.rumbo; camPos.copy(cam.position);
  /* el HUD del juego se va: ahora mandan los botones de la página (Compartir, el corazón, Volver);
     Ruway igual se pasea arrastrando el dedo o tocando el piso */
  $('hud').hidden = true; rumboEl.style.visibility = 'hidden'; rumboVer = 'hidden'; if (mirando) ponerMirar(false);
  A.Audio.musica('calma');
}

/* ---------- tamaño, fluidez, visibilidad ---------- */
function medir() {
  var w = innerWidth, h = innerHeight;
  R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  cielo.medir(pr); foquitos.medir(pr, h); resplandores.medir(pr, h); arbol.medir(pr, h); chispas.medir(pr, h); fuegos.medir(pr, h); nieve.medir(pr, h);
}
escuchar(window, 'resize', medir); medir();
var fpsAcum = 0, fpsN = 0, fpsBueno = 0, fpsVisto = 60, fpsVent = 0, fpsMin = 999, fpsSuma = 0, fpsCuenta = 0, fpsEl = $('fps');
function fluidez(dt) {
  fpsAcum += dt; fpsN++;
  if (fpsAcum >= 1) {
    var fps = fpsN / fpsAcum; fpsVisto = fps; fpsAcum = 0; fpsN = 0; fpsVent++;
    if (fpsVent > 2) { fpsMin = Math.min(fpsMin, fps); fpsSuma += fps; fpsCuenta++; }
    if (fps < 42 && pr > prMin) { pr = Math.max(prMin, pr * .85); R.setPixelRatio(pr); medir(); fpsBueno = 0; }
    else if (fps > 57) { if (++fpsBueno > 4 && pr < prMax) { pr = Math.min(prMax, pr + .1); R.setPixelRatio(pr); medir(); fpsBueno = 0; } }
    else fpsBueno = 0;
    if (VER_FPS) { var inf = R.info.render; fpsEl.textContent = Math.round(fps) + ' fps · ' + (1000 / fps).toFixed(1) + ' ms · pr ' + pr.toFixed(2) + ' · ' + calidad + ' · ' + inf.calls + ' dib · ' + (inf.triangles / 1000).toFixed(1) + 'k tri'; }
  }
}
if (VER_FPS) fpsEl.hidden = false;

/* ---------- el bucle ---------- */
var vFoco = new V3(), envListo = false, portadaAng = 0, hacesL = [];
ES.forEach(function (e) { hacesL.push({ p: e.p, k: 0 }); });
var hacesEst = { p: ESTRELLA_ESC, k: 0 }; hacesL.push(hacesEst);   /* una sola lista, armada una vez */
var tapadoT = 0, tapadoYa = false, pausaFuera = false, antes = 0, saltarVisto = true, cuadros = 0;
function pintarSaltarSiCambia() { var v = finalT() < 50; if (v !== saltarVisto) { saltarVisto = v; pintarSaltar(); } }
function bucle(ahora) {
  if (!corriendo) return;
  raf = requestAnimationFrame(bucle);
  var dt = Math.min(.05, Math.max(.001, (ahora - antes) / 1000)); antes = ahora;
  /* si la página tapa la plaza (el premio, la mochila, el video), el bucle se detiene del todo (ni
     siquiera pide cuadros) y se mira dos veces por segundo si ya se destapó */
  tapadoT -= dt; if (tapadoT <= 0) { tapadoT = .5; tapadoYa = listo && !!(o.tapado && o.tapado()); }
  if (tapadoYa) { parar(); esperarDestapar(); return; }
  t += dt; tEstado += dt; A.U.uT.value = t;
  if (!envListo) { envListo = true; pintarEnv(); }
  if (estado === 'portada') {
    /* mientras llega Ruway: la cámara gira despacio frente al árbol apagado; Don Gruñón vigila */
    portadaAng += dt * .06;
    var a = -.35 + Math.sin(portadaAng) * .45;
    if (!camLibre) { cam.position.set(Math.sin(a) * 7.6, 1.55 + Math.sin(portadaAng * .7) * .25, -9 + Math.cos(a) * 7.6); cam.lookAt(0, 2.6, -9); }
    if (!grunon.raiz.visible) { grunon.raiz.visible = true; GR.x = 1.25; GR.z = -6.0; GR.rumbo = .25; grunon.estado = 'quieto'; }
  }
  else if (estado === 'intro') introCuadro(dt);
  if (puedeMover() || estado === 'recoger' || estado === 'robo' || estado === 'atrapado' || estado === 'vuelo' || estado === 'carta' || estado === 'cine') moverRuway(dt);
  if (estado !== 'final' && estado !== 'galeria' && estado !== 'portada') posarRuway(dt);
  buscarCerca();
  if (estado === 'vuelo') vueloCuadro(dt);
  grunonCuadro(dt);
  if (estado === 'final' || estado === 'galeria') { final.cuadro(dt); if (estado === 'final') pintarSaltarSiCambia(); }
  else if (estado === 'libre') grunon.cuadro(dt);
  esferasCuadro(dt);
  /* haces de luz sobre las esferas escondidas (más fuertes cuanto más lejos está Ruway) */
  for (var i = 0; i < ES.length; i++) { var e = ES[i]; hacesL[i].k = e.estado === 'escondida' && (estado === 'juego' || estado === 'persecucion') ? Math.min(1, Math.hypot(e.p.x - RW.x, e.p.z - RW.z) / 6) * .9 + .1 : 0; }
  hacesEst.k = !totalValidas && !estrellaHallada && estado === 'juego' ? 1 : 0;
  haces.poner(hacesL, t);
  if (estado !== 'portada') camaraCuadro(dt); else if (camLibre) camaraCuadro(dt);
  brujulaCuadro();
  /* la fiesta (al final): las guirnaldas corren en olas, todo brilla más */
  A.U.uFiesta.value += (metaFiesta - A.U.uFiesta.value) * Math.min(1, dt * .8);
  cielo.mat.uniforms.uFlash.value.copy(fuegos.flash);
  grunon.alumbrar();                                         /* su lamparita, donde esté su cabeza */
  cam.getWorldDirection(vFoco); vFoco.multiplyScalar(6).add(cam.position);
  A.repartirLuces(vFoco);
  cielo.cuadro(dt, cam);
  arbol.cuadro(dt, cam);
  chispas.cuadro(dt); fuegos.cuadro(dt); nieve.cuadro(dt, cam); vapor.cuadro(dt);
  if (A.Audio.listo()) A.Audio.pileta(1 - Math.min(1, Math.hypot(RW.x, RW.z) / 12));
  if (avisoT > 0) { avisoT -= dt; if (avisoT <= 0) $('aviso').className = ''; }
  globoCuadro(dt);
  if (globo.t > 0 && estado !== 'final') globoEn(grunon.cabezaMundo(vT).add(fw.set(0, .36, 0)));
  R.render(escena, cam); cuadros++;
  if (!listo) { listo = true; plazaLista(); }
  fluidez(dt);
}
var esperandoDestapar = false;
function esperarDestapar() {
  if (esperandoDestapar) return; esperandoDestapar = true;
  luego(function mirar() {
    if (!vivo) return;
    if (o.tapado && o.tapado()) { luego(mirar, 500); return; }
    esperandoDestapar = false; tapadoYa = false; arrancar();
  }, 500);
}
function arrancar() { if (corriendo || !vivo || pausaFuera || document.hidden) return; corriendo = true; tapadoT = 0; antes = performance.now(); raf = requestAnimationFrame(bucle); }
function parar() { corriendo = false; cancelAnimationFrame(raf); }
escuchar(document, 'visibilitychange', function () { if (document.hidden) { parar(); A.Audio.pausar(true); } else { arrancar(); A.Audio.pausar(false); } });
escuchar(lienzo, 'webglcontextlost', function (e) { e.preventDefault(); perdido(); });
function perdido() { if (!vivo) return; var f = al.fallo; cerrar(); if (f) f('perdido'); }

/* ---------- la plaza ya se ve: ahora, Ruway ---------- */
function plazaLista() {
  var c = $('carga'); c.classList.add('aj-plaza'); $('carga-txt').textContent = 'Trayendo a Ruway…';
  if (al.listo) al.listo();
  A.cargarGLB(o.glb || 'ruway-avatar.glb', function (sc) {
    if (!vivo) { if (sc) liberar(sc); return; }
    if (sc) { try { ruwayA = A.armarRuway(sc, { alto: 1.45, movs: o.movs || 'ruway-movs.json' }); escena.add(ruwayA.raiz); cargaRuway = 'listo'; } catch (e) { cargaRuway = 'error'; liberar(sc); } }
    else cargaRuway = 'error';
    if (cargaRuway === 'error') { var f = al.fallo; cerrar(); if (f) f('ruway'); return; }
    c.classList.add('aj-fuera'); luego(function () { c.hidden = true; }, 700);
    empezar();
  });
}

/* ---------- cerrar: se libera todo ---------- */
function cerrar() {
  if (!vivo) return; vivo = false; listo = false;
  parar();
  relojes.forEach(clearTimeout); relojes = [];
  escuchas.forEach(function (e) { e[0].removeEventListener(e[1], e[2], e[3]); }); escuchas = [];
  try { A.Audio.cerrar(); } catch (e) {}
  try { if (ruwayA && !ruwayA.raiz.parent) liberar(ruwayA.raiz); } catch (e) {}
  try { if (escena) liberar(escena); } catch (e) {}
  try { if (rtEnv) rtEnv.dispose(); } catch (e) {}
  try { if (lienzoVacio) lienzoVacio.width = 0; } catch (e) {}
  try { if (R) { R.dispose(); R.forceContextLoss(); } } catch (e) {}
  R = null; escena = null; ruwayA = null;
  if (PANT && PANT.raiz.parentNode) PANT.raiz.parentNode.removeChild(PANT.raiz);
  if (api && window.__arbolJuego === api) window.__arbolJuego = null;
}

/* ---------- para pruebas (solo con navigator.webdriver o __RUWAY_PRUEBA) ---------- */
api = {
  estado: function () { return { listo: listo, ruway: cargaRuway, estado: estado, encontradas: encontradas, total: totalValidas, calidad: calidad, conchas: AJ.conchas, corriendo: corriendo,
    pr: pr, fps: fpsVisto, fpsMin: fpsMin === 999 ? null : fpsMin, final: finalT(), galeria: galeriaAbierta, terminado: terminado, dedicatoria: dedicaVista, desdeRobo: t - ultimoRobo, gpu: A.gpu || '', cuadros: cuadros, pausa: pausaFuera, dib: R ? R.info.render.calls : 0, tri: R ? R.info.render.triangles : 0 }; },
  fotos: function () { return fotos.map(function (f) { return { src: f.img ? f.img.src : '', txt: f.frase, k: f.k, j: f.j, estado: f.estado }; }); },
  esferas: function () { return ES.map(function (e) { return { estado: e.estado, x: e.p.x, y: e.p.y, z: e.p.z, esc: e.esc && e.esc.id }; }); },
  saltarIntro: saltarIntro,
  /* recoger la esfera i: Ruway aparece a su lado y la toma */
  recoger: function (i) { var e = ES[i]; if (!e || e.estado !== 'escondida' || estado !== 'juego' || !ruwayA) return false; RW.x = e.p.x + .8; RW.z = e.p.z; RW.v = 0; empezarRecoger(e); return true; },
  robar: function (i) { var e = ES[i === undefined ? robables[0] : i]; if (e && e.estado === 'escondida' && estado === 'juego') { RW.x = e.p.x - 4; RW.z = e.p.z; empezarRobo(e); return true; } return false; },
  alcanzar: function () { RW.x = GR.x - Math.sin(GR.rumbo) * .9; RW.z = GR.z - Math.cos(GR.rumbo) * .9; },
  ir: function (x, z, rumbo) { RW.x = x; RW.z = z; RW.v = 0; if (rumbo !== undefined) { RW.rumbo = rumbo; camRumbo = rumbo; } camPos.set(x - Math.sin(RW.rumbo) * 5, 3, z - Math.cos(RW.rumbo) * 5); },
  irEstrella: function () { RW.x = ESTRELLA_ESC.x + .9; RW.z = ESTRELLA_ESC.z; RW.v = 0; },
  encontrar: function (n) { for (var k = 0; k < n && k < ES.length; k++) { var e = ES[k]; if (e.estado !== 'escondida') continue; colgarYa(e); } },
  final: function (desde) { if (estado === 'final' || estado === 'galeria') final.iniciar(desde || 0); else empezarFinal(desde || .01); },
  galeria: abrirGaleria,
  carta: function (i) { abrirCarta(ES[i || 0]); },
  palanca: function (x, y, px, py) { joy.x = x; joy.y = y; palanca.style.left = px + 'px'; palanca.style.top = py + 'px'; palanca.className = x || y ? 'aj-ver' : ''; perilla.style.transform = 'translate(' + (x * PAL_R) + 'px,' + (-y * PAL_R) + 'px)'; },
  perder: function () { try { var x = R.getContext().getExtension('WEBGL_lose_context'); if (x) { x.loseContext(); return; } } catch (e) {} perdido(); },
  camLibre: function (p, m, f) { camLibre = p ? [p, m] : null; if (f) { cam.fov = f; cam.updateProjectionMatrix(); } },
  mirar: function (m, yaw, pitch, dist) { ponerMirar(m); avisoT = 0; $('aviso').className = ''; orb.yaw = yaw || 0; orb.pitch = pitch || 0; orb.dist = dist || 1; orb.quieto = 0; },
  grunon: function (st, x, z, r) { grunon.raiz.visible = true; grunon.estado = st; if (x !== undefined) { GR.x = x; GR.z = z; } if (r !== undefined) GR.rumbo = r; },
  fugaz: function () { cielo.fugaz(); }
};
if (navigator.webdriver || window.__RUWAY_PRUEBA) window.__arbolJuego = api;

/* ---------- arranque ---------- */
A.Audio.sinMusica(o.musica === false);
var L0 = fuente();
fotos.forEach(function (f) { var s = L0[f.i]; if (s && s.rota) f.estado = 'rota'; });
recontar();
fotos.forEach(function (f) { var s = L0[f.i]; if (f.estado === 'pendiente' && s && s.lista && s.im) { f.img = s.im; f.limpia = !!s.limpia; ponerFoto(f); } });
if (fotos.some(function (f) { return f.estado === 'pendiente'; })) luego(revisarFotos, 500);
arrancar();
return {
  cerrar: cerrar,
  pausar: function (si) { pausaFuera = !!si; if (si) { parar(); A.Audio.pausar(true); } else { arrancar(); A.Audio.pausar(false); } },
  estado: api.estado
};
}
})();
