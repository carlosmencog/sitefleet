# Arquitectura — primer vertical slice

```text
WordPress + SiteFleet Agent
          | HTTPS + HMAC
          v
Fastify API ---> PostgreSQL
          |         |- sitios y agentes
          |         |- secretos cifrados
          |         `- eventos idempotentes
          `--> próximo: cola de alertas
```

El token de registro solo sirve para emitir una credencial inicial. Cada agente recibe un secreto distinto; el servidor guarda su hash y una copia cifrada con AES-256-GCM. La clave de cifrado no está en PostgreSQL; en producción debe provenir de un gestor de secretos/KMS.

Un evento repetido con la misma `idempotency-key` devuelve `duplicate: true` y no vuelve a modificar el inventario.
