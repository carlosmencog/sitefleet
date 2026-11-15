# Arquitectura — primer vertical slice

```text
WordPress + SiteFleet Agent
          | HTTPS + HMAC
          v
Fastify API ---> AgentRepository (temporal: memoria)
          |
          +--> inventario idempotente
```

El token de registro solo sirve para emitir una credencial inicial. Cada agente recibe un secreto distinto; el servidor conserva únicamente su hash SHA-256. Para verificar HMAC, esta versión de desarrollo conserva el secreto en memoria, una limitación que será reemplazada por cifrado con una clave de aplicación/KMS al introducir PostgreSQL.

Un evento repetido con la misma `idempotency-key` devuelve `duplicate: true` y no vuelve a modificar el inventario.
