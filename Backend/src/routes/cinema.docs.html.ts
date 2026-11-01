// Use serveFiles' per-document initializer. Calling swaggerUi.setup/generateHTML here
// would replace swagger-ui-express's global initializer used by the legacy /api-docs.
export const cinemaDocsHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TROOND Cinema API</title><link rel="stylesheet" href="./swagger-ui.css"><link rel="icon" type="image/png" href="./favicon-32x32.png"></head>
<body><div id="swagger-ui"></div><script src="./swagger-ui-bundle.js"></script><script src="./swagger-ui-standalone-preset.js"></script><script src="./swagger-ui-init.js"></script></body></html>`;
