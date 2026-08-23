# Plan de estabilización y evolución

Este documento mantiene el estado de las mejoras del motor y sirve como lista de
comprobación para desarrollar, validar y hacer commits incrementales.

## Estados

- `Pendiente`: todavía no se ha comenzado.
- `En curso`: implementación activa.
- `En revisión`: implementada, pendiente de comprobación conjunta.
- `Completada`: validada y registrada en un commit.
- `Bloqueada`: necesita una decisión o dependencia previa.

## Plan de trabajo

| # | Mejora | Prioridad | Dependencias | Estado | Criterio de aceptación y comprobación |
|---:|---|---|---|---|---|
| 0 | Recuperar un punto de partida funcional en el entorno actual | Crítica | — | Completada | El proyecto se construye desde cero y el nivel 1 arranca sin crash en el entorno actual; se documentan dependencias y comandos, se obtiene un diagnóstico reproducible de cada fallo inicial y se realiza una prueba manual mínima de movimiento, cámara, colisiones y audio. |
| 1 | Corregir temporización y establecer un timestep fijo | Crítica | — | Completada | La simulación avanza a una frecuencia estable en Linux y Windows; se mide el ritmo y se prueba que animación, movimiento e IA no dependan de los FPS de renderizado. |
| 2 | Corregir la eliminación de entidades y la invalidación de iteradores | Crítica | — | Completada | Se pueden eliminar varios bloques, objetos, bombas o disparos consecutivos sin saltos, crashes ni accesos inválidos; prueba automatizada del caso consecutivo. |
| 3 | Proteger todos los accesos a tiles y definir el comportamiento fuera del mapa | Crítica | — | Completada | Ninguna consulta acepta índices inválidos; jugador y objetos pueden alcanzar todos los bordes sin crash; pruebas para coordenadas negativas y superiores al mapa. |
| 4 | Corregir funciones no `void` sin retorno y contratos virtuales | Crítica | — | Completada | El código compila con `-Wall -Wextra -Wreturn-type -Werror=return-type`; las interfaces base tienen valores o abstracciones explícitas. |
| 5 | Hacer segura la jerarquía polimórfica de `Object` | Crítica | 4 | Completada | El destructor base es virtual o se elimina la destrucción polimórfica; destructores derivados se ejecutan correctamente bajo sanitizers. |
| 6 | Completar la gestión de memoria y recursos mediante RAII | Alta | 2, 5 | Completada | Tiles, bitmaps, audio, fuentes, eventos, mundo y entidades se liberan siempre; ejecución y cierre limpios con AddressSanitizer/LeakSanitizer. |
| 7 | Hacer que los cargadores fallen de forma segura y validen los datos | Alta | 4 | Completada | Un archivo ausente, mal formado o incompleto produce un error descriptivo sin continuar con punteros nulos ni un mundo parcialmente inicializado; pruebas de entradas inválidas. |
| 8 | Eliminar rutas y parámetros del nivel 1 incrustados en el código | Alta | 7, 14 | Completada | El nivel, jugador, música, proyectiles, cámara y parámetros configurables se obtienen del paquete de juego; se puede seleccionar otro nivel sin recompilar. |
| 9 | Desacoplar los estados de animación del orden de declaración | Alta | 7, 14 | Completada | Estados con identificadores únicos como `running` o `dying`; reordenar su declaración no cambia el comportamiento; IDs duplicados generan un error. |
| 10 | Generalizar y validar la importación de mapas TMX | Media | 3, 7, 14 | Completada | El importador comprueba capas, dimensiones, GID y tileset; distingue tile vacío del primer tile y da errores claros para variantes no soportadas. |
| 11 | Incorporar una caché de recursos gráficos y de audio | Media | 6, 7 | Completada | Una ruta se carga una sola vez y se comparte con propiedad segura; existen métricas o pruebas que confirman que no se duplican bitmaps. |
| 12 | Expresar duraciones y velocidades independientemente del framerate | Alta | 1 | Completada | Animaciones, IA, triggers, muerte y efectos mantienen su duración al variar los FPS de renderizado; valores temporales tienen unidades documentadas. |
| 13 | Separar herramientas de depuración de las reglas del juego | Media | 1 | Completada | Coordenadas del ratón, bounding boxes y activaciones de prueba se controlan mediante un modo de depuración y no alteran una partida normal. |
| 14 | Migrar XML/TMX disperso a un formato JSON canónico y versionado | Alta | 7 | Completada | Existe JSON Schema, `formatVersion`, conversor desde los datos actuales y cargador JSON nativo; ninguna clase del runtime depende de PugiXML ni de archivos XML/TMX; el nivel 1 migrado conserva su contenido y comportamiento. |
| 15 | Corregir el crash al morir por un láser | Crítica | 0 | Completada | La muerte causada por el láser de la primera escalera completa la animación y el respawn sin crash; el reset de láseres no restaura valores indeterminados y pasa las comprobaciones con optimización y sanitizers. |

## Rick2 Engine: editor web y runtime reutilizable

La segunda fase parte del formato JSON canónico ya consumido por el juego. El
primer objetivo es un editor de niveles útil para el runtime C++ actual. La
previsualización jugable en navegador y la generalización como motor se harán
después, sin bloquear la creación de nuevos niveles.

La aplicación se distribuirá como archivos estáticos y podrá abrirse localmente
sin servidor. El build agrupará JavaScript y CSS para evitar dependencias de CDN
y problemas de módulos al usar `file://`. Canvas 2D será la base inicial: encaja
con los mapas de tiles y sprites del juego y mantiene el proyecto ligero.

### Política de sincronización entre juego y engine

El juego C++ seguirá evolucionando durante el desarrollo del editor. Desde el
inicio de Rick2 Engine, cualquier cambio del juego que afecte al paquete JSON,
entidades, propiedades, assets, unidades, validaciones o comportamiento
previsualizado debe incluir en la misma unidad de trabajo:

1. La actualización del modelo, editor y runtime web que resulte aplicable.
2. La actualización del schema, migración y documentación del formato cuando
   cambie el contrato de datos.
3. Una prueba de compatibilidad que abra y reexporte los proyectos existentes
   sin pérdidas inesperadas.
4. Una anotación explícita cuando una función nueva del juego todavía no pueda
   editarse o previsualizarse, registrada como tarea bloqueante y no como deuda
   implícita.

Una tarea que cambie capacidades compartidas no se considerará completada si el
juego y Rick2 Engine quedan en versiones incompatibles. Mientras el runtime web
no exista, se actualizarán como mínimo el modelo del editor, sus validaciones y
la representación visual correspondiente.

| # | Mejora | Prioridad | Dependencias | Estado | Criterio de aceptación y comprobación |
|---:|---|---|---|---|---|
| 16 | Especificar la arquitectura y el formato de proyecto del editor | Crítica | 14 | Completada | Se documentan módulos, flujo de datos y límites entre editor, formato y runtime; se decide un proyecto portable con JSON y assets, importable/exportable sin servidor; quedan catalogados todos los elementos editables del nivel 1. |
| 17 | Crear el esqueleto de la aplicación web estática | Crítica | 16 | Completada | Existe un build reproducible que genera una aplicación autocontenida abrible mediante `file://`; incluye layout base, barra de herramientas, paneles y manejo visible de errores, sin CDN ni backend. |
| 18 | Implementar apertura, guardado e intercambio de proyectos | Crítica | 16, 17 | Completada | Se puede abrir un paquete portable, resolver sus assets, crear un proyecto vacío y exportarlo de nuevo; se ofrece ZIP/descarga como vía universal y acceso a directorio cuando el navegador lo permita; ningún cambio se pierde sin aviso. |
| 19 | Compartir y aplicar el contrato JSON versionado | Crítica | 16, 18 | Completada | El editor valida contra el schema canónico, muestra errores con ubicación y no exporta datos incompatibles; las versiones futuras tienen un punto explícito de migración; las reglas comunes no se duplican manualmente y CI detecta incompatibilidades entre juego y editor. |
| 20 | Renderizar el mapa y navegar por el lienzo | Alta | 17, 18, 19 | Completada | Canvas muestra tiles, front tiles, colisiones y fondo con orden correcto; zoom, desplazamiento, rejilla y visibilidad de capas funcionan con mapas del tamaño del nivel 1 de forma fluida. |
| 21 | Añadir herramientas de edición de tiles y capas | Alta | 20 | Pendiente | Selector de tileset, lápiz, borrador, relleno y selección modifican la capa activa; las coordenadas y GID respetan el schema; copiar, cortar y pegar no corrompen los límites del mapa. |
| 22 | Editar entidades y sus propiedades | Alta | 20, 19 | Pendiente | Se pueden crear, seleccionar, mover, duplicar y borrar plataformas, objetos, hazards, bloques, láseres, enemigos e ítems; un inspector tipado edita únicamente propiedades válidas. |
| 23 | Editar relaciones y zonas de gameplay | Alta | 22 | Pendiente | Checkpoints, triggers, targets, vistas de cámara, bounding boxes, rutas, límites de IA y acciones se editan visualmente; referencias inexistentes o ciclos no permitidos se detectan antes de exportar. |
| 24 | Gestionar assets, definiciones y animaciones | Alta | 18, 19, 22 | Pendiente | Se importan tilesets, sprites y audio; pueden definirse estados, frames y `frameDurationTicks`, con previsualización de animaciones; IDs, nombres, dimensiones y rutas duplicadas o inválidas generan diagnósticos claros. |
| 25 | Incorporar historial, portapapeles y recuperación local | Alta | 21, 22, 23, 24 | Pendiente | Todas las operaciones editables ofrecen undo/redo; hay indicador de cambios, confirmación al cerrar y recuperación local mediante IndexedDB; un guardado confirmado establece un nuevo punto limpio. |
| 26 | Añadir validación integral y diagnóstico visual | Alta | 21, 23, 24 | Pendiente | Antes de exportar se comprueban schema, assets, GID, referencias, geometría y parámetros de gameplay; los errores se listan y llevan al elemento o celda afectada; las advertencias no bloqueantes se distinguen de los errores. |
| 27 | Crear una previsualización fiel dentro del editor | Media | 23, 24, 26 | Pendiente | Se previsualizan capas, colisiones, cámara, animaciones, movimientos, triggers y zonas sin modificar el documento; play/pause/step y reinicio producen resultados deterministas con el timestep de 50 Hz. |
| 28 | Asegurar accesibilidad, atajos y rendimiento del editor | Media | 20, 25, 26 | Pendiente | Atajos y foco no interfieren con formularios; las herramientas principales pueden usarse con teclado; mapas grandes mantienen interacción fluida y las operaciones costosas informan progreso o se ejecutan fuera del hilo de UI. |
| 29 | Automatizar pruebas, empaquetado y publicación estática | Alta | 17-28 | Pendiente | Pruebas unitarias cubren modelo, comandos, conversión y validación; pruebas de integración abren, editan y reexportan el nivel 1 sin diferencias inesperadas; CI verifica la compatibilidad juego/engine, genera un artefacto estático versionado y documenta su uso offline. |
| 30 | Portar el runtime jugable a JavaScript | Media | 27, 29 | Pendiente | El navegador carga el mismo paquete que C++, ejecuta movimiento, colisiones, IA, triggers, cámara, audio y ciclo de vidas con comportamiento comparable; editor y runtime comparten modelo y reloj, sin una segunda variante del formato. |
| 31 | Extraer un núcleo configurable para juegos de plataformas sencillos | Baja | 30 | Pendiente | Las reglas específicas de Rick se registran como componentes o comportamientos configurables; un pequeño juego de ejemplo distinto puede construirse sin modificar el núcleo, con documentación de extensiones y límites soportados. |

## Orden recomendado

Las tareas se ejecutarán inicialmente en este orden:

1. Tarea 0: recuperar y documentar un baseline funcional en el entorno actual.
2. Tareas 4 y 5: contratos básicos y destrucción polimórfica.
3. Tarea 2: eliminación segura durante la simulación.
4. Tarea 3: límites del mundo.
5. Tareas 1 y 12: reloj, timestep y unidades temporales.
6. Tarea 6: propiedad y liberación de recursos.
7. Tarea 7: errores y validación de carga.
8. Tarea 14: especificación JSON y migración.
9. Tareas 8 y 9: eliminar acoplamientos al nivel y al orden del XML.
10. Tarea 10: dejar TMX como formato de importación compatible.
11. Tarea 11: caché de assets.
12. Tarea 13: modo de depuración separado.

### Orden recomendado para Rick2 Engine

1. Tarea 16: cerrar arquitectura, alcance y formato portable antes de elegir librerías.
2. Tareas 17-19: aplicación offline, ciclo de archivos y contrato de datos.
3. Tareas 20-21: primer editor útil para pintar mapas.
4. Tareas 22-24: entidades, relaciones, assets y animaciones.
5. Tareas 25-26: seguridad de edición y validación integral.
6. Tareas 27-29: previsualización, experiencia de uso, pruebas y distribución.
7. Tarea 30: runtime completo en navegador sobre el mismo formato.
8. Tarea 31: generalización del núcleo una vez comprobado con el juego real.

El orden puede ajustarse si una prueba revela un bloqueo, pero cada cambio debe
mantener el juego ejecutable.

## Ciclo de trabajo por tarea

Para cada tarea:

1. Cambiar su estado a `En curso`.
2. Reproducir el problema o añadir primero una comprobación que lo detecte.
3. Implementar el cambio más pequeño que resuelva la tarea.
4. Compilar con avisos estrictos y ejecutar las pruebas automatizadas relevantes.
5. Probar manualmente el nivel 1 cuando el cambio afecte al comportamiento.
6. Cambiar el estado a `En revisión` y revisar conjuntamente el resultado.
7. Tras la validación, marcarla `Completada` y crear un commit dedicado.
8. Si cambia una capacidad compartida con Rick2 Engine, aplicar la política de
   sincronización y comprobar ambos consumidores antes de cerrar la tarea.

Para la tarea 0, antes de modificar código se guardarán el comando exacto, la
salida del fallo y un backtrace. Se probará una compilación limpia y otra con
AddressSanitizer/UndefinedBehaviorSanitizer. Las correcciones se limitarán a lo
necesario para recuperar el arranque; cualquier refactor adicional permanecerá
en su tarea correspondiente.

## Política de commits

- Un commit por unidad funcional validada; una tarea puede necesitar varios
  commits si cada uno deja el proyecto correcto y verificable.
- No mezclar refactors no relacionados con una corrección.
- No incluir los objetos compilados ni el ejecutable de `bin/`.
- Usar mensajes descriptivos, por ejemplo:
  `fix: make object destruction polymorphic`.
- No marcar una tarea como `Completada` hasta que su commit exista.

## Registro

| Fecha | Tarea | Cambio | Comprobación | Commit |
|---|---:|---|---|---|
| 2026-08-22 | 0 | Corregidos contratos sin retorno que provocaban `SIGTRAP` con el compilador actual; documentados build, ejecución y diagnóstico. | Build limpio y ASan/UBSan correctos; arranque automatizado y prueba manual de nivel, controles, cámara, colisiones y audio superados. | Commit de baseline funcional |
| 2026-08-22 | 4, 5 | Completados los contratos virtuales, añadido `override`, convertidos `Object` y `Character` en bases con destrucción virtual y resuelto el método oculto de `Block`. | Build limpio y ASan/UBSan correctos; prueba manual del nivel, lanzamiento de bombas y destrucción de bloques superada. | Commit de contratos virtuales |
| 2026-08-22 | 1 | Sustituido el reloj dependiente de plataforma por `steady_clock`; simulación fijada a 50 Hz con recuperación limitada a cinco ticks y renderizado desacoplado de los ticks pendientes. | Build limpio correcto; prueba aislada: 50 ticks en 1001 ms; prueba manual aceptada provisionalmente bajo WSL. | Commit de timestep fijo |
| 2026-08-22 | 15 | Inicializadas las velocidades antes de capturar el estado de reset y preservada su precisión como `float`, evitando que `Laser::Reset()` restaure valores indeterminados tras la muerte. | Build limpio optimizado y sanitizers correctos; muerte por el láser de la primera escalera y respawn validados manualmente. | Commit de reset de láseres |
| 2026-08-22 | 2 | Sustituida la eliminación dentro de bucles incrementales por una utilidad segura; bloques y objetos transitorios muertos se retiran antes de actualizar supervivientes. | Build limpio y ASan/UBSan correctos; prueba automatizada y eliminación manual de bloques, objetos, bombas y disparos superadas. | Commit de eliminación segura |
| 2026-08-22 | 6 | Aplicada propiedad RAII al runtime principal; liberados tiles, entidades, animaciones, bitmaps, cámara, audio, fuentes y eventos; eliminado el sub-bitmap creado en cada frame. | Build normal y estricto correctos; regresiones automatizadas, ASan/UBSan, LSan y prueba manual del nivel superados. | Commit de gestión RAII |
| 2026-08-22 | 8 | Extraídos a JSON el nivel inicial, resolución, cámara, jugador, proyectiles y audio; rutas de assets relativas al paquete y selección de nivel mediante argumento. | Build limpio y estricto, schemas, conversión, regresiones, arranques por manifiesto y ruta explícita, y prueba manual correctos. | Commit de configuración de nivel |
| 2026-08-22 | 9 | Sustituido el índice posicional de animaciones por mapas de ID; corregidos IDs heredados duplicados y añadida validación de IDs y nombres. | Build limpio y estricto; carga con estados invertidos correcta; IDs duplicados rechazados; definiciones fuente, arranque y prueba manual correctos. | Commit de IDs de animación |
| 2026-08-22 | 10 | Extraído un importador TMX validado con soporte XML/CSV; comprobadas capas, dimensiones, tilesets y rangos GID; separados GID vacío y primer tile en runtime. | Siete regresiones TMX, conversión reproducible, prueba de GID, build limpio y prueba manual correctos. | Commit de importación TMX |
| 2026-08-22 | 11 | Añadida caché de sesión con propiedad compartida para bitmaps, regiones de sprite y muestras de audio; un guard RAII la vacía antes de cerrar Allegro. | Prueba de identidad de recursos, cierre automatizado y prueba manual correctos; nivel 1: 9 cargas/530 aciertos de bitmap y 99 creaciones/998 aciertos de sub-bitmap. | Commit de caché de recursos |
| 2026-08-22 | 12 | Centralizado el timestep de 50 Hz y documentado el contrato de unidades del paquete; las animaciones declaran su duración en ticks y el parpadeo de congelación usa tiempo de simulación. | Build limpio; conversiones temporales, cargador JSON, paquete reproducible, siete regresiones TMX y prueba manual correctos. | Commit de unidades temporales |
| 2026-08-22 | 13 | Sustituida la macro global de overlays por el modo `--debug`; el ratón y sus coordenadas de mundo sólo se habilitan en ese modo, sin exponer opciones debug a la simulación. | Build limpio, parser de argumentos, cargador JSON, conversión, regresiones TMX y comprobación visual normal/debug correctos. | Commit de modo de depuración |
| 2026-08-23 | 16 | Definida la arquitectura offline de Rick2 Engine, su contenedor portable versionado, los límites de módulos y el catálogo completo de datos y assets editables del nivel 1. | Schema de proyecto válido; baseline de 10 grupos, 24 definiciones y todos los assets comprobado automáticamente y revisado conjuntamente. | Commit de arquitectura del editor |
| 2026-08-23 | 17 | Creado el shell offline de Rick2 Engine con TypeScript estricto, DOM, Canvas 2D, layout adaptable, estados vacíos y errores visibles; build local sin framework, CDN ni backend. | Typecheck correcto; build produce HTML, JS clásico, CSS y sourcemap con rutas relativas; pruebas del artefacto y revisión visual mediante `file://` correctas. | Commit del shell web offline |
| 2026-08-23 | 18 | Implementado el ciclo de proyectos: creación vacía, importación/exportación ZIP, acceso opcional a carpetas, resolución segura de assets, estado sucio y avisos antes de descartar cambios. | Typecheck y build correctos; round-trip conserva JSON/assets byte a byte; rutas inseguras, duplicados y niveles ausentes rechazados; auditoría npm y prueba manual correctas. | Commit del ciclo de proyectos |
| 2026-08-23 | 19 | Tipadas las diez familias de entidades en JSON Schema; integrada validación offline estructural/semántica con rutas de diagnóstico y bloqueo de exportación; añadido registro de migraciones y contrato compartido de versiones. | Nivel 1 y proyecto vacío válidos; fixtures inválidos rechazados; versiones de schemas, C++ y editor sincronizadas; build web, C++ y prueba manual correctos. | Commit del contrato JSON compartido |
| 2026-08-23 | 20 | Conectado el Canvas al nivel y tileset reales con composición de capas, overlay de colisiones, culling, zoom centrado, pan, encaje, rejilla y controles de visibilidad; añadido empaquetador portable del nivel 1. | Paquete determinista de 22 archivos/768 KiB sin referencias externas y sin diagnósticos; typecheck, build, pruebas de viewport/GID y revisión visual correctos. | Commit del render de mapas |
