# Ruway · las páginas de los clientes

Acá viven las dos páginas que ve la gente. **Ninguna se edita a mano**: las
genera `construir.js` a partir de `Codigo.gs` y `Universo.html`, que son los
originales. Si editas estos archivos, la próxima vez que se generen pierdes el
cambio y además quedan dos versiones distintas del mismo sitio.

| archivo | qué es |
|---|---|
| `index.html` | El formulario donde el cliente arma su pedido. También es la puerta de entrada: si el enlace trae un código de universo, manda a `u.html`. |
| `u.html` | El universo (o el árbol, o la vela) que se abre al escanear el QR o al acercar el celular a la etiqueta NFC de la tarjeta. |
| `x.html` | Las experiencias del llavero: constelaciones, planeta 3D, laberinto del osito, avenida del amor 3D, bitácora de pareja y cartas para abrir cuando… `u.html` manda acá cuando el regalo es una de ellas. |
| `nfc.html` | La página para grabar el enlace de una tarjeta en una etiqueta NFC desde un Android con Chrome. En iPhone explica cómo hacerlo con NFC Tools. |
| `lame.min.js` | Convierte la canción y la nota de voz del cliente a mp3 liviano en su propio celular, antes de subirlas (licencia LGPL, va sin cambios). |
| `mp4-muxer.min.js` | Arma el video para el estado en alta, cuadro por cuadro (licencia MIT). |
| `ramos.js` | Los ramos de flores que flotan en el universo. |
| `obj-corazones.js` | Otro juego de objetos, para las campañas de corazones. |
| `app/` | El lanzador que instala la app en el celular. |

## Por qué viven acá y no en Apps Script

Apps Script le pone a cada página un cartel encima: *"Un usuario de Apps Script
creó esta aplicación · Denunciar abuso"*. En la pantalla donde alguien escribe
su nombre y su teléfono, y sobre todo en el regalo que acaba de recibir, ese
cartel espanta. No se puede quitar desde dentro porque lo pone Google por
fuera de la página. En GitHub Pages no existe.

Los datos siguen viviendo en Google: estas páginas se los piden al script por
internet.

## Para actualizarlas

```
node construir.js "https://script.google.com/macros/s/.../exec"
```

Genera `index.html`, `u.html`, `x.html` y `nfc.html` apuntando a esa dirección, y copia
al lado `lame.min.js` y `mp4-muxer.min.js`. Después se suben todos a este
repositorio.

## Lo que nunca va acá

Este repositorio es público. No se sube:

- el enlace con `?k=` (la clave de la app),
- la clave en sí,
- nada de los clientes: fotos, teléfonos, pedidos.

La dirección que termina en `/exec`, sin clave, sí es pública a propósito: es
la que usan estas páginas para pedir el catálogo y mandar los pedidos.
