# SiteFleet

SiteFleet centraliza inventario y salud técnica de instalaciones WordPress para agencias.

## Primer vertical slice

El plugin `wordpress-plugin/sitefleet-agent.php` registra una instalación mediante un token de enrolamiento de un solo uso. La API guarda únicamente el hash del token y devuelve una credencial del agente una sola vez. Los inventarios posteriores se firman con HMAC SHA-256, incluyen marca de tiempo y una clave de idempotencia.

La API persiste agentes e inventarios en PostgreSQL. Los secretos de agentes se cifran con AES-256-GCM; la clave de cifrado se entrega por variable de entorno y nunca se guarda en la base de datos. Redis desacopla la recepción del inventario de la evaluación de alertas, que realiza un worker con reintentos.

## Ejecutar la API

```bash
npm install
Copy-Item .env.example .env
docker compose up --build
```

Para generar un token de enrolamiento local o productivo, usa `npm run registration-token --workspace=@sitefleet/api -- --expires-hours=72` después de aplicar migraciones. El token se muestra una sola vez.

## Conectar WordPress local

1. Copia `wordpress-plugin/sitefleet-agent.php` a una carpeta llamada `sitefleet-agent` dentro de `wp-content/plugins/` de una instalación WordPress local y actívalo.
2. Abre **Herramientas → SiteFleet Agent** dentro de WordPress.
3. Genera un token de enrolamiento con el comando anterior y úsalo una sola vez.
4. Para una instalación WordPress que corre directamente en tu equipo, usa `http://localhost:3001` como URL de API. Si WordPress corre en Docker, usa `http://host.docker.internal:3001` para que el contenedor llegue a la API expuesta por el equipo.

Después de actualizar WordPress, PHP o plugins, el administrador verá **Update SiteFleet** en la barra superior de WordPress. Ese botón envía un inventario nuevo a SiteFleet y confirma el resultado en la pantalla actual. No instala actualizaciones ni inicia sesión automáticamente en ningún sitio.

La respuesta de la ruta raíz (`http://localhost:3001`) solo confirma que la API está disponible; el dashboard todavía es el siguiente hito.

## Dashboard local

El dashboard se publica en `http://localhost:3000` y usa autenticación básica. Define `DASHBOARD_USERNAME` y `DASHBOARD_PASSWORD` en `.env` antes de iniciarlo. Muestra los sitios conectados, la hora de su último inventario y las alertas abiertas.

Si el registro falla, el panel ahora muestra un aviso explícito. En WordPress nativo usa `http://localhost:3001`; si WordPress usa Docker, `localhost` apunta al propio contenedor y debes usar `http://host.docker.internal:3001`.

## Verificar

```bash
npm test
npm run typecheck
npm run build
```

## Contrato de firma

El agente firma exactamente esta cadena UTF-8:

```text
POST\n/v1/agent/inventory\n<unix timestamp>\n<JSON body>
```

Encabezados requeridos: `x-sitefleet-agent-id`, `x-sitefleet-timestamp`, `x-sitefleet-signature` y `idempotency-key`.

La API verifica primero el cuerpo recibido y, para interoperar con serializadores JSON equivalentes, su representación canónica. En ambos casos, cualquier cambio semántico del inventario invalida la firma.

## Próximos pasos

1. Enviar inventarios a una cola Redis y evaluar alertas en un worker.
2. Crear dashboard con autenticación por organización.

## Producción

Consulta [la guía de onboarding productivo](docs/production-onboarding.md) antes de conectar un sitio público. El agente 0.3.0 exige HTTPS fuera de los entornos WordPress `local` y `development`.
