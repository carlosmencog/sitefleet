# SiteFleet

SiteFleet centraliza inventario y salud técnica de instalaciones WordPress para agencias.

## Primer vertical slice

El plugin `wordpress-plugin/sitefleet-agent.php` registra una instalación mediante un token de un solo uso. La API devuelve una credencial del agente una sola vez. Los inventarios posteriores se firman con HMAC SHA-256, incluyen marca de tiempo y una clave de idempotencia.

La API persiste agentes e inventarios en PostgreSQL. Los secretos de agentes se cifran con AES-256-GCM; la clave de cifrado se entrega por variable de entorno y nunca se guarda en la base de datos. Redis, alertas y el dashboard quedan para los siguientes hitos.

## Ejecutar la API

```bash
npm install
Copy-Item .env.example .env
docker compose up --build
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
POST\n/v1/agent/inventory\n<unix timestamp>\n<JSON body>
```

Encabezados requeridos: `x-sitefleet-agent-id`, `x-sitefleet-timestamp`, `x-sitefleet-signature` y `idempotency-key`.

La API verifica primero el cuerpo recibido y, para interoperar con serializadores JSON equivalentes, su representación canónica. En ambos casos, cualquier cambio semántico del inventario invalida la firma.

## Próximos pasos

1. Enviar inventarios a una cola Redis y evaluar alertas en un worker.
2. Crear dashboard con autenticación por organización.
