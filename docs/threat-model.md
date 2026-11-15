# Amenazas iniciales

| Riesgo | Mitigación actual | Pendiente |
| --- | --- | --- |
| Registro no autorizado | Token de registro configurable | Tokens por organización y un solo uso persistidos |
| Suplantación de agente | HMAC SHA-256 por agente | Rotación y cifrado de secretos en reposo |
| Replay | Ventana de 5 minutos y clave idempotente | Nonces persistidos |
| Alteración del payload | Firma sobre método, ruta, timestamp y cuerpo bruto | — |
| Fuga de secretos | El plugin no los muestra tras registro; `.env` ignorado | KMS/secret manager |
| Abuso del endpoint | Límite de tamaño del cuerpo | Rate limit por agente/IP |
