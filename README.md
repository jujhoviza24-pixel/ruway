# Ruway

Página del universo animado que se abre al escanear el QR de las tarjetas de
Ruway, y lanzador de la app de gestión.

- `index.html` + `ramos.js` — el universo. Se abre con `?c=CODIGO`.
- `app/` — lanzador de la app del negocio, para agregarlo a la pantalla de inicio.

## Importante

Este repositorio es **público**. Nunca escribas acá dentro:

- el enlace privado de la app (el que lleva `?k=`),
- la clave,
- ningún dato de clientes.

`index.html` sí lleva la dirección `/exec` del Apps Script en la variable `API`,
y eso está bien: esa dirección sola no abre nada. La app de gestión pide la
clave, y las funciones que leen o escriben datos no se pueden llamar desde
ningún navegador.

`app/index.html` no lleva ninguna clave: la pide una vez en el celular y la
guarda solo ahí.
