/* ============================================================
   Arma las dos páginas que viven en GitHub Pages.

     index.html   el formulario donde el cliente arma su pedido
     u.html       el universo que se abre al escanear el QR

   Ninguna de las dos se escribe a mano: el diseño y el comportamiento salen
   de Codigo.gs y de Universo.html, que son los originales. Si mañana se
   cambia un color o un paso, se cambia allá y se vuelve a correr esto.
   Editar los archivos generados es condenarse a tener dos versiones.

   ¿Por qué viven en GitHub y no en Apps Script? Por una sola razón: Apps
   Script le pone encima un cartel que dice "Un usuario de Apps Script creó
   esta aplicación · Denunciar abuso". En la pantalla donde alguien escribe su
   nombre y su teléfono, y en el regalo que acaba de recibir, ese cartel
   espanta. No se puede quitar desde dentro porque lo pone Google por fuera.

   Uso:  node construir.js "<url que termina en /exec>"
   ============================================================ */
const fs = require('fs');
const vm = require('vm');

const EXEC = process.argv[2]
  || 'https://script.google.com/macros/s/AKfycbym_HuTN7HjpEy3IkKwvdamuJtExLvVnUJt83-vWxhhUR1kNx_hfNzd6GC53nNc-jYOGQ/exec';

const APP = '/home/claude/ruway-app';
const SALIDA = process.env.SALIDA_RUWAY || '/home/claude/ruway-github';

/* Codigo.gs es JavaScript corriente: se puede evaluar acá y pedirle las
   piezas, sin copiarlas ni mantener dos versiones. */
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(APP + '/Codigo.gs', 'utf8'), ctx);

const API_JSON = JSON.stringify(EXEC);

/* El logo va incrustado: así no hay que pedirlo por internet cada vez y la
   cabecera aparece de inmediato. */
let logo = '';
try {
  const L = fs.readFileSync(APP + '/Logo.html', 'utf8');
  const m = L.match(/var\s+LOGO\s*=\s*"([^"]+)"/);
  if (m) logo = m[1];
} catch (e) {}

/* Los nombres cortos de los QR ya impresos (c, para, de...) y su equivalente
   hacia Apps Script. Hace falta la "r" delante porque Google se reserva
   varios parámetros de una letra y se los queda antes de que el script llegue
   a ejecutarse: fue la causa de semanas de pantallas grises. Acá, en GitHub,
   los nombres cortos no molestan, así que los QR viejos siguen valiendo. */
const MAPA = `{ c:'rcod', cod:'rcod', rcod:'rcod', para:'rpara', rpara:'rpara',
                msg:'rmsg', rmsg:'rmsg', de:'rde', rde:'rde',
                tit:'rtit', rtit:'rtit', tem:'rtem', rtem:'rtem',
                v:'rver', rver:'rver' }`;

// ===================================================================
//  1. index.html — el formulario de pedidos, y el desvío de los QR
// ===================================================================

const puente = `
/* ---------------- el puente con Apps Script ----------------
   Esta página está en GitHub y los datos están en Google. Un navegador no
   deja leer de otro dominio así como así, con dos excepciones que acá se
   aprovechan:

   · Una etiqueta <script> puede cargar de donde sea. Por eso lo que se LEE
     viene como JavaScript que llama a una función nuestra (se le dice
     JSONP, y funciona en todos los teléfonos, viejos incluidos).

   · Un POST con el cuerpo en texto plano se manda sin pedir permiso
     previo. Por eso lo que se ESCRIBE (el pedido, las fotos, la canción)
     va por ahí: una foto no cabe en una dirección.
   ------------------------------------------------------------ */
var API = ${API_JSON};
var _n = 0;

/* Cuarenta segundos, no veinticinco. Google apaga el script cuando lleva
   rato sin usarse, y la primera visita del día tiene que esperar a que
   vuelva a encenderse: con veinticinco segundos se cortaba justo antes de
   tiempo y salía "revisa tu conexión" aunque la conexión estuviera bien. */
/* Pide algo y no se rinde a la primera.
   Desde el celular pasaba constantemente: la página se quedaba colgada, uno
   le daba a "Reintentar" y entraba al instante. Eso quiere decir que la
   petición no llegó nunca, no que no hubiera internet. Así que acá se hace
   solo lo que uno hacía a mano: a los doce segundos manda otra, sin cancelar
   la primera, y se queda con la que conteste antes. */
function pedirJSONP(fn, args, ok, mal) {
  var hecho = false, vivos = 0, fallos = 0;

  function terminar(bien, dato) {
    if (hecho) return;
    hecho = true;
    if (bien) ok && ok(dato); else mal && mal(dato);
  }

  function intento(esUltimo) {
    vivos++;
    var nombre = '__ruway' + (++_n);
    var t = document.createElement('script');

    function limpiar() {
      clearTimeout(refuerzo); clearTimeout(rendirse);
      try { delete window[nombre]; } catch (e) { window[nombre] = undefined; }
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    function murio(e) {
      limpiar(); fallos++;
      /* Solo se da por perdido cuando han muerto TODOS los intentos: si uno
         falló pero otro sigue en camino, todavía hay esperanza. */
      if (fallos >= vivos) {
        if (!esUltimo) { setTimeout(function () { intento(true); }, 900); return; }
        terminar(false, e);
      }
    }

    window[nombre] = function (r) {
      limpiar();
      if (r && r.ok) terminar(true, r.r);
      else terminar(false, new Error((r && r.error) || 'Error'));
    };
    t.onerror = function () { murio(new Error('No se pudo conectar')); };

    /* El refuerzo: otra petición en paralelo, por si la primera se perdió. */
    var refuerzo = esUltimo ? 0 : setTimeout(function () { intento(true); }, 12000);
    var rendirse = setTimeout(function () { murio(new Error('Sin respuesta')); }, 45000);

    t.src = API + (API.indexOf('?') >= 0 ? '&' : '?')
      + 'vista=api&rfn=' + encodeURIComponent(fn)
      + '&rargs=' + encodeURIComponent(JSON.stringify(args || []))
      + '&rcb=' + nombre;
    document.head.appendChild(t);
  }

  intento(false);
}

/* Lo que se ESCRIBE (fotos, canción, nota de voz, el pedido).

   Tres cosas que antes no estaban y por las que el envío se quedaba colgado
   y luego decía "no se pudo enviar":

     · Un plazo. Sin AbortController, un fetch que se pierde en una red móvil
       no falla nunca: se queda esperando para siempre y el cliente ve la
       pantalla de envío sin avanzar hasta que se cansa y cierra.

     · Reintentos. Una subida que falla por un bache de red se reintenta sola
       tres veces, esperando cada vez un poco más. Casi todos los fallos de
       verdad son eso, un bache, y se arreglan al segundo intento.

     · Distinguir el fallo de red del fallo del servidor. Si el servidor dice
       "esa foto pesa demasiado", reintentar es perder el tiempo: eso se
       cuenta tal cual. Solo se reintenta lo que puede salir bien. */
function mandarPOST(fn, args, ok, mal, intento) {
  intento = intento || 1;
  var cuerpo = JSON.stringify({ fn: fn, args: args || [] });
  /* El plazo según lo que pesa: una foto no puede esperar dos minutos a que
     la den por perdida, y un pedazo de canción en una señal floja sí
     necesita su tiempo. Juntar la canción es trabajo del servidor y tarda
     aunque lo que viaje sea poco. */
  var plazo = fn === 'guardarPedido' ? 45000
            : fn === 'juntarAudio' ? 90000
            : Math.min(120000, 35000 + Math.round(cuerpo.length / 10));
  var corta = null, reloj = null;

  try { corta = new AbortController(); } catch (e) {}
  if (corta) reloj = setTimeout(function () { try { corta.abort(); } catch (e) {} }, plazo);

  function otraVez(e) {
    if (reloj) clearTimeout(reloj);
    if (intento >= 3) { mal && mal(e); return; }
    /* 1,5 s, luego 4 s: darle tiempo a la red a recomponerse */
    setTimeout(function () {
      mandarPOST(fn, args, ok, mal, intento + 1);
    }, intento === 1 ? 1500 : 4000);
  }

  fetch(API, {
    method: 'POST',
    /* texto plano a propósito: con 'application/json' el navegador pide
       permiso antes y Apps Script no sabe contestar a esa pregunta */
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: cuerpo,
    signal: corta ? corta.signal : undefined
  })
    .then(function (r) {
      if (!r.ok) throw new Error('El servidor contestó ' + r.status);
      return r.json();
    })
    .then(function (r) {
      if (reloj) clearTimeout(reloj);
      /* Los avisos salen FUERA de la cadena de promesas, a propósito.
         Estando dentro, cualquier tropiezo del código que recibe la respuesta
         caía en el .catch de abajo y se tomaba por un fallo de red: se
         reenviaba una petición que YA había salido bien, y con eso se
         duplicaba la foto, el pedido o el universo. Con el setTimeout(0) lo
         que pase al recibir es problema de quien recibe, no de la red. */
      if (r && r.ok) { var f = ok; setTimeout(function () { f && f(r.r); }, 0); return; }
      /* Esto lo dijo el servidor a propósito: no se reintenta. */
      var g = mal, fallo = new Error((r && r.error) || 'Error');
      setTimeout(function () { g && g(fallo); }, 0);
    })
    .catch(otraVez);
}

/* Imita a google.script.run para que el resto de la página no cambie. */
function runner() {
  var r = { ok: null, mal: null };
  r.withSuccessHandler = function (f) { r.ok = f; return r; };
  r.withFailureHandler = function (f) { r.mal = f; return r; };

  var porPOST = ['crearUniverso', 'subirFotoUniverso', 'subirCancionUniverso',
                 'subirVozUniverso', 'subirTrozoAudio', 'juntarAudio', 'guardarPedido'];
  porPOST.forEach(function (fn) {
    r[fn] = function () {
      var args = Array.prototype.slice.call(arguments);
      mandarPOST(fn, args, function (x) { r.ok && r.ok(x); },
                           function (e) { r.mal && r.mal(e); });
    };
  });
  return r;
}
var google = { script: { get run() { return runner(); } } };

/* ---------------- la puerta de entrada ----------------
   Esta misma dirección atiende tres cosas, según lo que traiga detrás:

     sin nada        el formulario de pedidos
     ?c=MMALSQ       el universo de esa tarjeta  ->  u.html, acá al lado
     ?cat=Navidad    ese catálogo

   Va así porque los QR de las tarjetas ya impresas apuntan acá, y un archivo
   que solo supiera hacer una cosa las dejaría muertas.
   -------------------------------------------------------- */
var D = null;

function irseA(destino, aviso) {
  var c = document.getElementById('cargando');
  if (c) c.querySelector('p').textContent = aviso;
  location.replace(destino);
}

function mostrarCatalogo(cat) {
  var aviso = document.querySelector('#cargando p');
  if (aviso) aviso.textContent = 'Abriendo el catálogo';
  var t0 = Date.now();
  var contando = setInterval(function () {
    var seg = Math.round((Date.now() - t0) / 1000);
    if (!aviso) return;
    if (seg > 26) aviso.innerHTML = 'Está tardando más de lo normal<br>pero seguimos intentando';
    else if (seg > 12) aviso.innerHTML = 'Despertando el catálogo<br>un momentito más';
  }, 1000);
  pedirJSONP('catalogo', [cat], function (r) {
    clearInterval(contando);
    if (!r || !r.html) { sinCatalogo(); return; }
    /* Se reemplaza la página entera por el catálogo: es un documento completo,
       con su propio diseño para imprimir, y así se ve exactamente igual. */
    document.open(); document.write(r.html); document.close();
  }, function () { clearInterval(contando); sinCatalogo(); });

  function sinCatalogo() {
    var c = document.getElementById('cargando');
    if (!c) return;
    c.innerHTML = '<p>No pudimos abrir el catálogo.<br>Revisa tu conexión y vuelve a intentar.</p>'
      + '<button onclick="location.reload()">Reintentar</button>';
  }
}

/* ---------------- el seguimiento del pedido ----------------
   Lo que más reclaman los clientes de florerías no es el precio: es no saber
   nada mientras esperan. Acá ven en qué va su pedido, la foto de cómo quedó
   y, si llevaba universo, si ya lo abrieron. */
var PASOS_SEG = [
  { e: 'Recibido', t: 'Recibimos tu pedido', i: '📥' },
  { e: 'Confirmado', t: 'Lo estamos haciendo a mano', i: '🌻' },
  { e: 'Listo', t: 'Listo · así quedó', i: '📷' },
  { e: 'En camino', t: 'En camino', i: '🛵' },
  { e: 'Entregado', t: 'Entregado', i: '✅' }
];
function escS(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function cuandoSeg(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: 'numeric',
                                       month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch (e) { return d.toLocaleString(); }
}
function diaSeg(t) {
  /* [0-9] y no la barra con d: esto va dentro de una plantilla de texto y
     la barra se perdería al construir la página. */
  var m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(t || ''));
  if (!m) return '';
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
             'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return (+m[3]) + ' de ' + MES[+m[2] - 1];
}
function mostrarSeguimiento(ref) {
  var c = document.getElementById('cargando');
  if (c) c.querySelector('p').textContent = 'Buscando tu pedido';
  document.getElementById('barra').style.display = 'none';
  document.getElementById('lema').textContent = 'Tu pedido';
  pedirJSONP('seguimiento', [ref], function (r) {
    if (!r || !r.ok) { sinSeguimiento(); return; }
    if (c) c.style.display = 'none';
    var hechos = {};
    (r.pasos || []).forEach(function (p) { hechos[p.e] = p; });
    var ultimo = -1;
    PASOS_SEG.forEach(function (p, i) { if (hechos[p.e]) ultimo = i; });
    var h = '<div class="seg"><p class="seg-hola">Hola' + (r.cliente ? ' ' + escS(r.cliente) : '') + ' 🌻</p>'
      + (r.entrega ? '<p class="seg-sub">Tu pedido es para el <b>' + diaSeg(r.entrega) + '</b></p>' : '')
      + '<ol class="seg-pasos">';
    PASOS_SEG.forEach(function (p, i) {
      var hecho = hechos[p.e];
      /* "En camino" y "Listo" son opcionales: si ya se entregó y no se
         marcaron, no se enseñan como pendientes. */
      if (!hecho && i < ultimo && (p.e === 'Listo' || p.e === 'En camino')) return;
      var clase = hecho ? (i === ultimo ? 'ahora' : 'hecho') : 'falta';
      h += '<li class="' + clase + '"><span class="ic">' + (hecho ? p.i : '·') + '</span><div>'
        + '<b>' + p.t + '</b>' + (hecho && hecho.t ? '<small>' + escS(cuandoSeg(hecho.t)) + '</small>' : '')
        + (p.e === 'Listo' && hecho && r.foto
            ? '<img class="seg-foto" src="' + escS(r.foto) + '" alt="Así quedó tu detalle">' : '')
        + '</div></li>';
    });
    h += '</ol>';
    if (r.foto && !hechos['Listo']) h += '<img class="seg-foto" src="' + escS(r.foto) + '" alt="">';
    h += '<div class="seg-caja"><b>Lo que pediste</b><span>' + escS(r.detalle || '—') + '</span></div>';
    var u = r.universo;
    if (u) {
      /* El universo, el árbol o la vela: cada uno dicho con sus palabras. */
      var vela = u.tipo === 'vela';
      h += '<div class="seg-caja uni"><b>' + (vela ? '🕯️ Tu vela' : u.tipo === 'arbol' ? '🎄 Tu árbol' : '🌌 Tu universo') + '</b>';
      if (!u.aprobado) h += '<span>' + (vela ? 'La' : 'Lo') + ' estamos revisando para que las fotos se vean perfectas.</span>';
      else {
        h += u.abierto ? '<span>💌 ' + (vela ? 'La abrieron' : 'Lo abrió') + ' el ' + escS(cuandoSeg(u.abierto)) + '</span>'
                       : '<span>' + (vela ? 'Todavía nadie la abre.' : 'Todavía no lo abre.') + ' Te avisamos cuando pase.</span>';
        if (u.corazones) h += '<span>' + (vela
          ? '🕯️ ' + u.corazones + (u.corazones === 1 ? ' vela encendida' : ' velas encendidas')
          : '❤️ Te mandó ' + u.corazones + (u.corazones === 1 ? ' corazón' : ' corazones')) + '</span>';
        if (u.ver) h += '<a href="' + escS(u.ver) + '" target="_blank" rel="noopener">Ver cómo quedó</a>';
      }
      h += '</div>';
    }
    if (r.whatsapp) h += '<a class="seg-wa" target="_blank" rel="noopener" href="https://wa.me/' + escS(r.whatsapp)
      + '?text=' + encodeURIComponent('Hola Ruway! Tengo una consulta sobre mi pedido') + '">¿Alguna duda? Escríbenos</a>';
    h += '<a class="seg-otro" href="' + escS(location.pathname) + '">Hacer otro pedido</a></div>';
    document.getElementById('app').innerHTML = h;
  }, sinSeguimiento);
  function sinSeguimiento() {
    var c2 = document.getElementById('cargando');
    if (!c2) return;
    c2.style.display = '';
    c2.innerHTML = '<p>No encontramos ese pedido.<br>Revisa el enlace o escríbenos por WhatsApp.</p>'
      + '<button onclick="location.reload()">Reintentar</button>';
  }
}

function arrancar() {
  var q = new URLSearchParams(location.search);

  /* El universo se abre en u.html, que está en este mismo GitHub: no lleva el
     cartel de "denunciar abuso" de Apps Script, que es de lo último que uno
     quiere ver en un regalo. */
  var pide = ['c', 'cod', 'rcod', 'para', 'rpara', 'msg', 'rmsg',
              'de', 'rde', 'tit', 'rtit', 'tem', 'rtem'];
  for (var i = 0; i < pide.length; i++) {
    if (q.get(pide[i])) {
      irseA('u.html' + location.search, 'Abriendo tu regalo');
      return;
    }
  }

  /* El catálogo también se queda en GitHub. Antes mandaba a la página de Apps
     Script, con su cartel de "Denunciar abuso" encima de cada foto; ahora se
     pide el catálogo ya armado y se dibuja acá mismo. Sus botones "Lo quiero"
     y "Hacer mi pedido" vuelven a esta misma página con ?pedir=. */
  var cat = q.get('cat');
  if (cat) { mostrarCatalogo(cat); return; }
  /* El seguimiento de un pedido: "?seg=PD-xxx.firma". */
  var seg = q.get('seg');
  if (seg) { mostrarSeguimiento(seg); return; }
  /* Google apaga el script cuando lleva rato sin usarse y la primera visita
     tiene que esperar a que despierte. Desde el celular eso se nota mucho más
     que desde una computadora. En vez de dejar al cliente mirando una flor
     que late, se le va contando: la espera se aguanta cuando uno sabe que
     algo está pasando. */
  var aviso = document.querySelector('#cargando p');
  var t0 = Date.now();
  var contando = setInterval(function () {
    var seg = Math.round((Date.now() - t0) / 1000);
    if (!aviso) return;
    if (seg > 26) aviso.innerHTML = 'Está tardando más de lo normal<br>pero seguimos intentando';
    else if (seg > 14) aviso.innerHTML = 'Despertando el catálogo<br>un momentito más';
    else if (seg > 6) aviso.textContent = 'Casi listo';
  }, 1000);

  pedirJSONP('datos', [], function (d) {
    clearInterval(contando);
    /* Si el catálogo llega vacío o a medias, prender() revienta en la primera
       línea — y para entonces la pantalla de carga ya se quitó, así que el
       cliente se queda mirando una página muerta sin nada que tocar. */
    if (!d || !d.cats || !d.agr) { noHayCatalogo(); return; }
    D = d;
    document.getElementById('cargando').style.display = 'none';
    try { prender(); } catch (e) { noHayCatalogo(); }
  }, noHayCatalogo);

  function noHayCatalogo() {
    clearInterval(contando);
    var c = document.getElementById('cargando');
    c.style.display = '';
    c.innerHTML =
      '<p>No pudimos cargar el catálogo.<br>Revisa tu conexión y vuelve a intentar.</p>'
      + '<button onclick="location.reload()">Reintentar</button>';
  }
}
`;

/* jsPedido_ está escrito para correr en cuanto se carga. Acá tiene que
   esperar a que lleguen los datos, así que se envuelve en prender(). */
const cuerpoJS = 'function prender(){\n' + ctx.jsPedido_() + '\n}';

const FLOR_SVG = `<svg class="flor" viewBox="0 0 64 64" aria-hidden="true">
    <g fill="#F0C64A">
      <ellipse cx="32" cy="14" rx="7" ry="13"/><ellipse cx="32" cy="50" rx="7" ry="13"/>
      <ellipse cx="14" cy="32" rx="13" ry="7"/><ellipse cx="50" cy="32" rx="13" ry="7"/>
      <ellipse cx="19" cy="19" rx="11" ry="6" transform="rotate(-45 19 19)"/>
      <ellipse cx="45" cy="45" rx="11" ry="6" transform="rotate(-45 45 45)"/>
      <ellipse cx="45" cy="19" rx="11" ry="6" transform="rotate(45 45 19)"/>
      <ellipse cx="19" cy="45" rx="11" ry="6" transform="rotate(45 19 45)"/>
    </g>
    <circle cx="32" cy="32" r="10" fill="#8A5A22"/>
  </svg>`;

const indexHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ruway · Arma tu pedido</title>
<meta name="theme-color" content="#FFFBF4">
<meta name="description" content="Flores de limpiapipas hechas a mano en Trujillo. Arma tu detalle y te decimos el precio al instante.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Baloo+2:wght@600;800&display=swap" rel="stylesheet">
<!-- GENERADO POR construir.js · NO EDITAR A MANO -->
<style>
${ctx.cssPublico_()}
#cargando{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;background:#FFFBF4;text-align:center;padding:28px}
#cargando .flor{width:56px;height:56px;animation:latirflor 1.5s ease-in-out infinite}
@keyframes latirflor{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
#cargando p{color:#8A9280;font-size:13px;letter-spacing:.12em;text-transform:uppercase;line-height:1.8}
#cargando button{margin-top:6px;padding:14px 26px;border:0;border-radius:26px;color:#fff;
  font-size:14px;font-weight:800;font-family:inherit;
  background:linear-gradient(135deg,#7C9A5E,#5C6B4A)}
/* el seguimiento del pedido */
.seg{padding:6px 0 30px}
.seg-hola{font-family:"Baloo 2",sans-serif;font-size:24px;font-weight:800;color:var(--verde);margin:16px 4px 2px}
.seg-sub{color:var(--gris);font-size:14px;margin:0 4px 14px}
.seg-pasos{list-style:none;margin:8px 0 16px;padding:0}
.seg-pasos li{display:flex;gap:12px;padding:0 0 18px;position:relative}
.seg-pasos li:not(:last-child)::before{content:"";position:absolute;left:17px;top:36px;bottom:2px;width:2px;background:rgba(92,107,74,.18)}
.seg-pasos .ic{flex:none;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;background:#fff;border:1.5px solid var(--borde)}
.seg-pasos li.hecho .ic{background:rgba(124,154,94,.14);border-color:rgba(124,154,94,.35)}
.seg-pasos li.ahora .ic{background:linear-gradient(135deg,#FFE27A,#FFC531);border-color:#F0C64A;box-shadow:0 0 0 5px rgba(255,197,49,.18)}
.seg-pasos li.falta{opacity:.45}
.seg-pasos b{display:block;font-size:15px;padding-top:7px}
.seg-pasos small{display:block;font-size:12.5px;color:var(--gris);margin-top:1px}
.seg-foto{display:block;width:100%;max-width:340px;border-radius:18px;margin:10px 0 2px;box-shadow:var(--sombra)}
.seg-caja{background:var(--vidrio);border:1px solid var(--borde);border-radius:18px;padding:14px 16px;margin-top:12px;box-shadow:var(--sombra)}
.seg-caja b{display:block;font-size:14px;margin-bottom:4px}
.seg-caja span{display:block;font-size:13.5px;color:#4A5540;line-height:1.5;margin-top:3px}
.seg-caja a,.seg-wa{display:block;text-align:center;margin-top:12px;padding:13px;border-radius:15px;text-decoration:none;font-weight:800;font-size:14px;color:#fff;background:linear-gradient(135deg,#7C9A5E,#5C6B4A)}
.seg-wa{background:#25D366;margin-top:18px}
.seg-otro{display:block;text-align:center;margin-top:14px;color:var(--verde);font-weight:700;font-size:13.5px}
</style>
</head>
<body>

<div class="fondo"><div class="burbuja b1"></div><div class="burbuja b2"></div><div class="burbuja b3"></div></div>

<header>
  ${logo ? '<img src="' + logo + '" alt="Ruway">' : '<div class="marca">RUWAY</div>'}
  <p id="lema">Arma tu detalle en un minuto</p>
  <div class="pasos" id="pasos"></div>
</header>

<main id="app"></main>

<div class="barra" id="barra">
  <div class="tot"><span id="rot">Va quedando</span><b id="tot">S/ 0.00</b></div>
  <div class="bts">
    <button class="atras" id="btnAtras" onclick="irA(-1)">Atrás</button>
    <button class="ok" id="btnSig" onclick="irA(1)">Continuar</button>
  </div>
</div>

<input type="file" id="pick" accept="image/*" multiple>
<input type="file" id="picksong" accept="audio/*">
<div id="toast"></div>
<div id="lupa" onclick="cerrarLupa()"><img id="lupaImg" src=""><span>Toca para cerrar</span></div>

${ctx.bloqueEnviando_()}

<div id="cargando">
  ${FLOR_SVG}
  <p>Preparando tu catálogo</p>
</div>

<script>
${puente}
</script>
<script>
${cuerpoJS}
arrancar();
</script>
</body>
</html>
`;

// ===================================================================
//  2. u.html — el universo
// ===================================================================

/* Universo.html es una plantilla de Apps Script con dos huecos: los datos y
   la etiqueta de los ramos. Acá se rellenan de otra manera —pidiéndoselos al
   script por internet— pero el resto del archivo no se toca ni una coma, para
   que las dos versiones no se separen nunca. */
let uni = fs.readFileSync(APP + '/Universo.html', 'utf8');

if (uni.indexOf('<?!= DATOS ?>') < 0 || uni.indexOf('<?!= RAMOS_TAG ?>') < 0) {
  throw new Error('Universo.html cambió de forma: ya no encuentro sus dos huecos.');
}

/* Los ramos los pone el cargador, que sabe cuál pide el tema del universo. */
uni = uni.replace('<?!= RAMOS_TAG ?>', '');

/* ---------------------------------------------------------------
   El cargador del universo.

   Antes esto era una etiqueta <script> escrita mientras la página se leía, lo
   que DETIENE la lectura hasta que el servidor conteste. Sobre el papel era
   elegante: cuando el motor arrancaba, los datos ya estaban. En la práctica
   era el problema. Google apaga el script cuando lleva rato sin usarse, y
   despertarlo tarda. Todo ese rato la pantalla estaba EN BLANCO, sin un
   aviso y sin forma de reintentar; y si la petición se perdía, en blanco
   para siempre. De ahí lo de "demora mucho y a veces hay que reintentar".

   Ahora:
     · la pantalla de espera se pinta de inmediato, sin pedir nada a nadie,
     · los datos se piden por detrás, con refuerzos si tardan,
     · lo que ya se abrió una vez se guarda en el teléfono y la siguiente vez
       entra al instante,
     · y si de verdad no hay manera, hay un botón, no una pantalla muerta.

   Nada de esto toca el dibujo del universo: el motor es el mismo, solo
   cambia CUÁNDO se enciende.
   --------------------------------------------------------------- */
const PRECONECTA = `
<!-- Avisar de con quién vamos a hablar ahorra medio segundo largo en el
     celular: el saludo a cada servidor (DNS, TLS) se hace mientras la página
     todavía se está leyendo, en vez de cuando ya hace falta. -->
<link rel="preconnect" href="https://script.google.com" crossorigin>
<link rel="preconnect" href="https://script.googleusercontent.com" crossorigin>
<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>
<link rel="dns-prefetch" href="https://drive.google.com">
`;

const cargador = `
<script>
var API = ${API_JSON};
var DATOS = null;
var _n = 0;

function espera(txt, perdido) {
  var c = document.getElementById('esperando');
  var t = document.getElementById('esp-txt');
  if (t && txt) t.textContent = txt;
  if (c && perdido) c.classList.add('perdido');
}

function paramsUniverso() {
  var q = new URLSearchParams(location.search);
  var mapa = ${MAPA};
  var par = {};
  Object.keys(mapa).forEach(function (k) {
    var v = q.get(k);
    if (v && !par[mapa[k]]) par[mapa[k]] = v;
  });
  return par;
}

/* Lo que ya se vio una vez se guarda acá. Un universo se abre muchas veces
   —se lo enseñas a tu mamá, a tu hermana, al de al lado— y esas veces tienen
   que entrar de golpe, no esperar otra vez a que Google despierte. */
/* El código sale de la dirección, así que se comprueba antes de usarlo como
   llave: sin esto, un enlace manipulado podía dejar una entrada por cada
   valor inventado y llenarle el almacenamiento al cliente. */
function llave(par) {
  var c = String(par.rcod || '').trim().toUpperCase();
  return 'ruway:uni:' + (/^[A-Z0-9]{4,10}$/.test(c) ? c : '-');
}

function guardado(par) {
  try {
    var v = JSON.parse(localStorage.getItem(llave(par)) || 'null');
    if (v && v.d && (Date.now() - v.t) < 30 * 24 * 3600 * 1000) return v.d;
  } catch (e) {}
  return null;
}
function guardar(par, d) {
  /* Ni el universo cerrado ni la vista previa del dueño se guardan.
     El cerrado, porque la próxima vez ya puede estar abierto y la copia vieja
     taparía el regalo con la cuenta atrás. La vista previa, porque dejaría el
     universo abierto en el teléfono del dueño, y al probar el enlace público
     creería que el candado no funciona. */
  if (!d || d.bloqueado || d.vistaPrevia) return;
  try { localStorage.setItem(llave(par), JSON.stringify({ t: Date.now(), d: d })); }
  catch (e) {}
}

/* Los ramos y figuras del tema. Se piden en cuanto se sabe cuáles son y no
   frenan nada: si llegan tarde, el universo ya está girando y aparecen. */
function traerRamos(url) {
  if (!url || window.__ramosPedidos) return;
  window.__ramosPedidos = true;
  var t = document.createElement('script');
  t.src = url; t.async = true;
  /* Al llegar hay que repartir las figuras entre los ramos decorativos. Si el
     universo ya está girando cuando esto termina, aparecen sin más. */
  t.onload = function () { if (typeof window.ponerRamos === 'function') window.ponerRamos(); };
  document.head.appendChild(t);
}

function pedirDatos() {
  var par = paramsUniverso();

  /* 1. ¿Ya lo tenemos de otra vez? Adentro sin esperar a nadie. */
  var viejo = guardado(par);
  if (viejo && viejo.ok) {
    traerRamos(viejo.ramos);
    DATOS = viejo;
    setTimeout(function () { encender(); }, 0);
    /* Y por detrás se pide la versión fresca, por si el dueño cambió algo:
       se guarda para la próxima vez, sin interrumpir esta. */
    traer(par, function (d) { if (d && d.ok) guardar(par, d); }, function () {});
    return;
  }

  /* "Regalo" y no "universo": todavía no se sabe si es un universo, un árbol
     o una vela. */
  espera('Abriendo tu regalo');
  var t0 = Date.now();
  var contando = setInterval(function () {
    var s = Math.round((Date.now() - t0) / 1000);
    if (s > 22) espera('Está tardando, pero seguimos');
    else if (s > 11) espera('Despertando tu regalo');
  }, 1000);

  traer(par, function (d) {
    clearInterval(contando);
    if (!d || !d.ok) {
      espera('No encontramos este regalo.\\nRevisa el enlace o escríbenos.', true);
      return;
    }
    guardar(par, d);
    traerRamos(d.ramos);
    DATOS = d;
    encender();
  }, function () {
    clearInterval(contando);
    espera('No pudimos abrirlo.\\nRevisa tu conexión.', true);
  });
}

/* Pide los datos y no se rinde a la primera: a los siete segundos manda otra
   petición en paralelo sin cancelar la anterior, y se queda con la que
   conteste antes. Es exactamente lo que uno hacía a mano cuando le daba a
   "reintentar" y entraba de golpe. */
function traer(par, ok, mal) {
  var hecho = false, vivos = 0, muertos = 0;

  function intento(ultimo) {
    vivos++;
    var nombre = '__uni' + (++_n);
    var t = document.createElement('script');
    t.async = true;

    function limpiar() {
      clearTimeout(refuerzo); clearTimeout(tope);
      try { delete window[nombre]; } catch (e) { window[nombre] = undefined; }
      if (t.parentNode) t.parentNode.removeChild(t);
    }
    function murio() {
      limpiar(); muertos++;
      if (muertos < vivos) return;          /* todavía queda otro en camino */
      if (!ultimo) { setTimeout(function () { intento(true); }, 900); return; }
      if (!hecho) { hecho = true; mal(); }
    }
    window[nombre] = function (r) {
      limpiar();
      if (hecho) return;
      hecho = true;
      ok(r && r.ok ? r.r : null);
    };
    t.onerror = murio;

    var refuerzo = ultimo ? 0 : setTimeout(function () { intento(true); }, 7000);
    var tope = setTimeout(murio, 45000);

    t.src = API + (API.indexOf('?') >= 0 ? '&' : '?')
      + 'vista=api&rfn=universo&rcb=' + nombre
      + '&rargs=' + encodeURIComponent(JSON.stringify([par]));
    document.head.appendChild(t);
  }
  intento(false);
}
<\/script>`;

/* El servidor ya no rellena este hueco: acá los datos llegan por internet y
   el motor se enciende cuando estén. */
uni = uni.replace('var DATOS = <?!= DATOS ?>;', '/* los datos los trae el cargador */');

/* El cargador va al final de la cabecera. No bloquea: solo declara funciones.
   Quien las llama es el arranque, al final del propio universo. */
uni = uni.replace('</head>', PRECONECTA + cargador + '\n</head>');

uni = uni.replace('<head>',
  '<head>\n<!-- GENERADO POR construir.js desde Universo.html · NO EDITAR A MANO -->');

// ===================================================================
//  3. nfc.html — grabar el enlace en una etiqueta NFC
// ===================================================================

/* No todo el mundo sabe escanear un QR, pero cualquiera sabe acercar el
   celular. Una etiqueta NFC pegada en la tarjeta abre el mismo universo que
   el QR, sin cámara y sin aplicación: en el iPhone desde el XS y en los
   Android que tienen NFC, basta con acercarlo.

   Esta página la abre la app del taller con el enlace ya puesto. Vive aparte,
   en GitHub, porque Chrome solo deja usar el NFC desde una página abierta de
   frente, no desde dentro de otra (y la app va dentro de un marco). En el
   iPhone no se puede grabar desde una página: ahí explica cómo hacerlo con
   una aplicación gratuita. */
const nfcHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Ruway · Grabar etiqueta NFC</title>
<meta name="theme-color" content="#FFFBF4">
<!-- GENERADO POR construir.js · NO EDITAR A MANO -->
<style>
:root{--verde:#5C6B4A;--vivo:#7C9A5E;--oro:#D2A877;--crema:#FFFBF4;--tinta:#23291E;--gris:#8A9280;--rojo:#B5553F}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--crema);color:var(--tinta);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:26px 18px 40px}
main{max-width:460px;margin:0 auto}
h1{font-size:22px;color:var(--verde);margin-bottom:4px}
.sub{color:var(--gris);font-size:13px;margin-bottom:18px}
.caja{background:#fff;border:1px solid rgba(92,107,74,.14);border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(47,56,38,.07)}
.enlace{font:12.5px/1.45 ui-monospace,Menlo,monospace;word-break:break-all;background:#F6F2E8;border-radius:10px;padding:10px 12px;color:#3F4B33}
.que{font-weight:700;margin-bottom:8px}
button{font:inherit;font-weight:800;border:0;border-radius:16px;padding:15px;width:100%;cursor:pointer}
.ok{background:linear-gradient(135deg,var(--vivo),var(--verde));color:#fff;box-shadow:0 10px 22px rgba(92,107,74,.28)}
.suave{background:#fff;color:var(--verde);border:1.5px solid rgba(92,107,74,.25);margin-top:10px}
label.ch{display:flex;gap:10px;align-items:flex-start;margin:14px 2px 4px;font-size:13.5px}
label.ch input{margin-top:3px;width:18px;height:18px;flex:none}
#estado{margin-top:14px;padding:13px 14px;border-radius:14px;font-weight:700;display:none}
#estado.espera{display:block;background:#FFF3D6;color:#7A5A1E}
#estado.ok{display:block;background:#E6F0DC;color:#3D5A26}
#estado.mal{display:block;background:#F8E1DA;color:var(--rojo)}
.onda{display:inline-block;animation:late 1.2s ease-in-out infinite}
@keyframes late{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
ol{padding-left:20px;font-size:13.5px}ol li{margin:5px 0}
.nota{font-size:12.5px;color:var(--gris);margin-top:8px}
.oculto{display:none}
</style>
</head>
<body>
<main>
  <h1>📲 Grabar etiqueta NFC</h1>
  <p class="sub" id="rotulo">Para que se abra acercando el celular, sin escanear.</p>

  <div class="caja">
    <div class="que">Lo que va a abrir la etiqueta</div>
    <div class="enlace" id="enlace">—</div>
    <button class="suave" id="copiar" type="button">Copiar el enlace</button>
  </div>

  <div class="caja" id="conNfc">
    <label class="ch"><input type="checkbox" id="bloquear" checked>
      <span><b>Bloquearla al terminar</b> (recomendado). Así nadie la puede cambiar después.
      Una etiqueta bloqueada ya no se puede volver a grabar.</span></label>
    <button class="ok" id="grabar" type="button" style="margin-top:10px">Grabar la etiqueta</button>
    <button class="suave" id="probar" type="button">Probar una etiqueta</button>
    <div id="estado"></div>
  </div>

  <div class="caja oculto" id="sinNfc">
    <div class="que">Desde este celular se graba con una app gratuita</div>
    <ol>
      <li>Instala <b>NFC Tools</b> (App Store o Play Store).</li>
      <li>Copia el enlace con el botón de arriba.</li>
      <li>En la app: <b>Escribir</b> → <b>Agregar un registro</b> → <b>URL / URI</b> → pega el enlace → <b>OK</b>.</li>
      <li>Toca <b>Escribir</b> y acerca la etiqueta a la parte de arriba de tu iPhone (en Android, a la parte de atrás).</li>
      <li>Para que nadie la cambie: <b>Otros</b> → <b>Bloquear la etiqueta</b>. Es para siempre.</li>
    </ol>
    <p class="nota">En Android con Chrome también se puede grabar desde acá mismo: abre esta página en Chrome.</p>
  </div>

  <div class="caja">
    <div class="que">Consejos</div>
    <ol>
      <li>Usa etiquetas <b>NTAG213</b> (stickers redondos de 25 a 30 mm): las leen todos los celulares con NFC.</li>
      <li>Pégala detrás de la tarjeta, justo donde dice «acerca tu celular».</li>
      <li>Lejos del alambre de los limpiapipas y de cualquier metal: el metal apaga la señal.</li>
      <li>Pruébala siempre con tu celular antes de entregar. El QR sigue en la tarjeta para quien no tenga NFC.</li>
    </ol>
  </div>
</main>
<script>
(function(){
  var h=new URLSearchParams(location.hash.replace(/^#/,''));
  var URL_=String(h.get('u')||'');
  var rot=String(h.get('t')||'');
  /* Solo enlaces seguros (https): esta página no graba cualquier cosa. */
  if(!/^https:\\/\\/[^\\s"'<>]{4,300}$/.test(URL_)) URL_='';
  var $=function(i){return document.getElementById(i);};
  $('enlace').textContent=URL_||'Falta el enlace: ábrela desde la app de Ruway.';
  /* Una etiqueta NTAG213 guarda unas 130 letras de enlace. Las tarjetas que
     llevan la dedicatoria escrita en el enlace pasan de eso: se avisa antes
     de intentarlo, que el error del celular no lo explica. */
  var largo=0;
  try{ largo=new TextEncoder().encode(URL_.replace(/^https:\\/\\/(www\\.)?/,'')).length; }catch(e){ largo=URL_.length; }
  if(largo>130){
    var av=document.createElement('p'); av.className='nota';
    av.style.color='#B5553F';
    av.textContent='Este enlace es largo ('+largo+' letras): no entra en una NTAG213. Usa una NTAG215 o NTAG216, '
      +'o arma la tarjeta con el código del universo, que es corto.';
    $('enlace').parentNode.appendChild(av);
  }
  if(rot) $('rotulo').textContent=rot;
  $('copiar').onclick=function(){
    if(!URL_) return;
    var hecho=function(){ $('copiar').textContent='✓ Copiado'; setTimeout(function(){ $('copiar').textContent='Copiar el enlace'; },1800); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(URL_).then(hecho,function(){});
    else { var t=document.createElement('textarea'); t.value=URL_; document.body.appendChild(t); t.select();
           try{ document.execCommand('copy'); hecho(); }catch(e){} t.remove(); }
  };
  var hay=('NDEFReader' in window);
  if(!hay){ $('conNfc').classList.add('oculto'); $('sinNfc').classList.remove('oculto'); return; }
  if(!URL_){ $('grabar').disabled=true; }

  var corta=null;
  function estado(t,clase){ var e=$('estado'); e.className=clase; e.innerHTML=t; }
  function parar(){ if(corta){ try{ corta.abort(); }catch(e){} corta=null; } }
  function explicar(e){
    var n=(e&&e.name)||'';
    if(n==='AbortError') return;
    if(n==='NotAllowedError') estado('Chrome necesita permiso para usar el NFC. Vuelve a tocar el botón y dale «Permitir».','mal');
    else if(n==='NotSupportedError') estado('Este celular no tiene NFC, o está apagado. Actívalo en Ajustes → Conexiones → NFC y vuelve a intentar.','mal');
    else if(n==='NetworkError') estado('Se movió la etiqueta antes de terminar. Vuelve a intentar, sin moverla.','mal');
    else estado('No se pudo: '+((e&&e.message)||'error desconocido'),'mal');
  }

  $('grabar').onclick=function(){
    if(!URL_) return;
    parar(); corta=new AbortController();
    var nd=new NDEFReader(), senal=corta.signal;
    estado('<span class="onda">📲</span> Acerca la etiqueta a la parte de atrás de tu celular y déjala quieta…','espera');
    nd.write({records:[{recordType:'url',data:URL_}]},{overwrite:true,signal:senal}).then(function(){
      if(!$('bloquear').checked || typeof nd.makeReadOnly!=='function'){
        estado('✓ Grabada. Aléjala y vuelve a acercarla para probarla.','ok'); return;
      }
      estado('✓ Grabada. <b>No la muevas</b>: ahora se bloquea…','espera');
      return nd.makeReadOnly({signal:senal}).then(function(){
        estado('✓ Grabada y bloqueada. Ya nadie la puede cambiar.','ok');
      });
    })['catch'](explicar);
  };

  $('probar').onclick=function(){
    parar(); corta=new AbortController();
    var nd=new NDEFReader();
    estado('<span class="onda">📲</span> Acerca la etiqueta para leerla…','espera');
    nd.scan({signal:corta.signal}).then(function(){
      nd.onreading=function(ev){
        var leido='';
        (ev.message.records||[]).forEach(function(r){
          if(r.recordType==='url' && !leido){ try{ leido=new TextDecoder().decode(r.data); }catch(e){} }
        });
        parar();
        if(!leido) estado('Esa etiqueta está vacía o tiene otra cosa.','mal');
        else if(URL_ && leido===URL_) estado('✓ Esta etiqueta abre el enlace correcto.','ok');
        else estado('Esta etiqueta abre otro enlace: '+leido.replace(/[<>&]/g,''),'mal');
      };
      nd.onreadingerror=function(){ estado('No se pudo leer. Acércala otra vez, sin moverla.','mal'); };
    })['catch'](explicar);
  };
})();
</script>
</body>
</html>
`;

fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(SALIDA + '/index.html', indexHtml);
fs.writeFileSync(SALIDA + '/u.html', uni);
fs.writeFileSync(SALIDA + '/nfc.html', nfcHtml);

// ===================================================================
//  4. x.html — las experiencias del llavero (juegos, planeta, cartas…)
//     Sale de Experiencias.html con la dirección del servidor puesta.
// ===================================================================
const xOrigen = fs.readFileSync(APP + '/Experiencias.html', 'utf8');
if (xOrigen.indexOf('/*@@API@@*/') < 0) throw new Error('Experiencias.html cambió de forma: no encuentro dónde va la dirección.');
const xHtml = xOrigen.replace('/*@@API@@*/', 'var API = ' + API_JSON + ';\nvar MAPA = ' + MAPA + ';')
  .replace('<head>', '<head>\n<!-- GENERADO POR construir.js desde Experiencias.html · NO EDITAR A MANO -->');
fs.writeFileSync(SALIDA + '/x.html', xHtml);

/* Las librerías que las páginas piden solo cuando hacen falta: la que
   rehace la canción en mp3 ligero (formulario) y la que arma el video
   (universo). Van al lado de las páginas, en el mismo GitHub. */
const LIBRERIAS = ['lame.min.js', 'mp4-muxer.min.js'];
LIBRERIAS.forEach(function (n) {
  const origen = APP + '/lib/' + n;
  if (fs.existsSync(origen)) fs.copyFileSync(origen, SALIDA + '/' + n);
  else console.log('OJO: falta lib/' + n);
});

console.log('index.html  ' + Math.round(indexHtml.length / 1024) + ' KB   (pedidos)');
console.log('u.html      ' + Math.round(uni.length / 1024) + ' KB   (universo)');
console.log('x.html      ' + Math.round(xHtml.length / 1024) + ' KB   (experiencias del llavero)');
console.log('apuntan a   ' + EXEC);
