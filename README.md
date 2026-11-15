# SiteFleet

SiteFleet centraliza inventario y salud técnica de instalaciones WordPress para agencias.

## Primer vertical slice

El plugin `wordpress-plugin/sitefleet-agent.php` registra una instalación mediante un token de un solo uso. La API devuelve una credencial del agente una sola vez. Los inventarios posteriores se firman con HMAC SHA-256, incluyen marca de tiempo y una clave de idempotencia.

Por ahora, los datos viven en memoria: esto hace verificable el protocolo antes de introducir PostgreSQL y Redis. No es un despliegue de producción todavía.

## Ejecutar la API

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api
```

En desarrollo, el token de registro predeterminado es `local-registration-token`. Cambiarlo antes de instalar el plugin fuera de local.

## Verificar

```bash
npm test
npm run typecheck
npm run build
```

## Contrato de firma

El agente firma exactamente esta cadena UTF-8:

```text
POST\n/v1/agent/inventory\n<unix timestamp>\n<raw JSON body>
```

Encabezados requeridos: `x-sitefleet-agent-id`, `x-sitefleet-timestamp`, `x-sitefleet-signature` y `idempotency-key`.

## Próximos pasos

1. Sustituir el repositorio en memoria por PostgreSQL y persistir claves cifradas.
2. Enviar inventarios a una cola Redis y evaluar alertas en un worker.
3. Crear dashboard con autenticación por organización.
