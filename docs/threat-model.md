# Amenazas iniciales

| Riesgo | Mitigación actual | Pendiente |
| --- | --- | --- |
| Registro no autorizado | Token de registro configurable | Tokens por organización y un solo uso persistidos |
| Suplantación de agente | HMAC SHA-256 por agente y secretos cifrados en reposo | Rotación de secretos |
| Replay | Ventana de 5 minutos y clave idempotente | Nonces persistidos |
| Alteración del payload | Firma sobre método, ruta, timestamp y cuerpo bruto | — |
| Fuga de secretos | El plugin no los muestra tras registro; `.env` ignorado; AES-256-GCM en base de datos | KMS/secret manager |
| Abuso del endpoint | Límite de tamaño del cuerpo | Rate limit por agente/IP |
| Fallo al evaluar alertas | Cola con reintentos, alertas idempotentes y re-encolado al reintentar el mismo evento | Patrón outbox para tolerar caída sin reintento del agente |
