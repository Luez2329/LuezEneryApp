# Proxy solar PVGIS

Worker público para que `https://luez2329.github.io/LuezEneryApp/` consulte el año meteorológico típico de PVGIS sin bloqueo CORS.

## Publicación desde el panel de Cloudflare

1. Ingresar a **Workers & Pages** y seleccionar **Create application**.
2. Crear un Worker con el nombre `luez-energy-solar`.
3. Reemplazar el código de ejemplo por el contenido de `worker.js`.
4. Desplegar y copiar la URL `https://luez-energy-solar.<subdominio>.workers.dev`.
5. Colocar esa URL en `PVGIS_PROXY_URL` dentro de `dist/app.js`.

## Prueba

Abrir en el navegador:

```text
https://luez-energy-solar.<subdominio>.workers.dev/api/tmy?lat=-9.938198&lon=-76.250821
```

La respuesta debe ser JSON y contener `outputs.tmy_hourly`.
