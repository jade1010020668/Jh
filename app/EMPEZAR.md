# Poner Amara a funcionar — 15 minutos

Todo el código está listo y probado. Faltan **3 registros** que solo puedes hacer tú (van a tu nombre). **Costo: $0.**

---

## Paso 1 · La llave de la IA (5 min, gratis)

Sin esto la app responde frases de relleno. Con esto ella piensa de verdad.

1. Entra a **https://openrouter.ai** → *Sign in* (con Google o email).
2. Ve a **https://openrouter.ai/keys** → botón **Create Key** → ponle nombre "Amara".
3. **Copia la llave** (empieza con `sk-or-v1-...`). Guárdala, solo se muestra una vez.

> No necesitas poner tarjeta. La app detecta sola los modelos de **costo $0** y usa el mejor disponible. Si un día quieres más calidad, recargas $5 y listo.

---

## Paso 2 · La base de datos (5 min, gratis)

Aquí viven las cuentas, las compañeras y las conversaciones. Sin esto se pierde todo al cerrar.

1. Entra a **https://neon.tech** → *Sign up* (con GitHub es lo más rápido).
2. Crea un proyecto (cualquier nombre, deja la región por defecto).
3. En la pantalla de inicio copia el **Connection string**. Se ve así:
   `postgres://usuario:clave@ep-algo.neon.tech/neondb?sslmode=require`

---

## Paso 3 · Publicar la app (5 min, gratis)

1. Entra a **https://vercel.com** → *Sign up* **con GitHub**.
2. **Add New… → Project** → busca el repositorio **`jade1010020668/Jh`** → *Import*.
3. ⚠️ **IMPORTANTE**: en *Root Directory* haz clic en **Edit** y selecciona la carpeta **`app`**.
4. Abre **Environment Variables** y pega estas tres:

   | Nombre | Valor |
   |---|---|
   | `OPENROUTER_API_KEY` | la llave del Paso 1 (`sk-or-v1-...`) |
   | `DATABASE_URL` | el connection string del Paso 2 |
   | `AUTH_SECRET` | inventa una frase larga, ej. `amara-2026-clave-secreta-larga-9f3k` |

5. Clic en **Deploy** y espera ~2 minutos.

---

## Paso 4 · Comprobar que quedó bien

1. Abre tu URL + `/api/health` → por ejemplo `https://tu-app.vercel.app/api/health`
2. Debe decir: **"✅ Todo configurado: la app está funcionando de verdad"**
   - Si dice que falta algo, te dice exactamente cuál variable corregir en Vercel.

## Paso 5 · Instalarla en tu teléfono

- **Android (Chrome)**: abre la URL → menú ⋮ → *Instalar app*
- **iPhone (Safari)**: abre la URL → botón Compartir → *Añadir a pantalla de inicio*

Queda con ícono y a pantalla completa, como cualquier app — sin pasar por las tiendas.

---

## Opcional · Fotos reales (después)

Las fotos salen como marcadores de color hasta que conectes un generador de imágenes:

1. Crea cuenta en **https://novita.ai** → API Keys → copia la llave.
2. En Vercel: *Settings → Environment Variables* → agrega `NOVITA_API_KEY` → *Redeploy*.

Cuesta centavos por imagen. Todo lo demás funciona sin esto.

---

## Probar en tu computador (sin publicar)

```bash
cd app
cp .env.example .env.local     # pega tu OPENROUTER_API_KEY dentro
npm install
npm run dev                    # abre http://localhost:3000
```

Sin `DATABASE_URL` guarda en archivos locales — perfecto para probar.
