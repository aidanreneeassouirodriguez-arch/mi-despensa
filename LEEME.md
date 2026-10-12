# Mi Despensa — prototipo 1

App web móvil (PWA) para 2 iPhone, sin servicios obligatorios de pago.

## Probar sin sincronización

Publica los archivos de esta carpeta en un alojamiento HTTPS estático (GitHub Pages o equivalente). Abre la URL en Safari en el iPhone y usa Compartir → Añadir a pantalla de inicio.

Sin configurar Supabase, los datos se guardan **solo en ese iPhone**. Para evitar perderlos, usa Ajustes → Exportar JSON.

## Configurar el inventario compartido (2 iPhone)

1. Crea un proyecto gratuito en Supabase y habilita inicio de sesión por correo en Authentication.
2. Ejecuta `supabase.sql` en SQL Editor.
3. En Supabase Auth → URL Configuration, establece como Site URL la URL HTTPS publicada de la app y agrégala a Redirect URLs.
4. En los dos teléfonos, en Ajustes de la app, introduce URL del proyecto y **clave pública** (publishable o anon). Nunca introduzcas la service_role ni secretos.
5. En cada iPhone inicia sesión con su correo individual. Abre el enlace de confirmación de ese teléfono.
6. En el primer teléfono pulsa Crear hogar; copia el código UUID. En el segundo, pega el código y pulsa Unirme al hogar. Guarda el código de invitación en privado: quien lo posea y se autentique podrá unirse.
7. Para recibir cambios push sin recargar, activa replicación de tabla `lots` para `supabase_realtime`. Incluso sin ello, puedes cambiar de pantalla o refrescar la app para obtener los datos recientes (en esta versión, recarga la página).

**Precaución:** Las pruebas de sincronización deben realizarse con los dos usuarios antes de fiarse del stock. No se garantiza modo offline sincronizado ni resolución de modificaciones simultáneas. Las entradas existentes en el modo local no se copian automáticamente a la nube.

## Captura fotográfica

Pulsa Fotos, selecciona foto y pulsa Leer texto. Usa Tesseract.js por CDN (requiere internet para primera lectura y descarga de idioma). Se intenta extraer un nombre, peso y primera fecha con formato DD/MM/AAAA o similar. **No es reconocimiento visual general de productos, no cuenta envases y puede confundir lotes, fabricación y caducidades**. La fecha y cantidad son siempre editables antes de guardar.

## Conceptos de inventario

Los movimientos de congelación parcial separan lotes: gramos en nevera y gramos en congelador. Los lotes congelados tienen fecha de congelación; la aplicación no inventa vida útil segura. Una descongelación se registra como traslado del lote a Nevera y mantiene la fecha original. No volver a congelar alimentos descongelados sin atender a las recomendaciones de seguridad alimentaria.

Los mínimos son: huevos 6, agua 6 botellas, leche 6 bricks, cápsulas Dolce Gusto normal 4, descafeinado 4, barritas 4 unidades y pasta 500 g. El conteo de mínimos depende de que registres con unidades consistentes.

## Estado

Prototipo funcional de interfaz, movimientos, congelación, mínimos, respaldo y OCR de texto, con conexión Supabase configurable. No es una app ya desplegada ni verificada con un proyecto real Supabase. Falta detección visual robusta de varios artículos, lectura inteligente de tickets, reglas de seguridad alimentaria específicas, y pruebas extremo a extremo en dos iPhone.
