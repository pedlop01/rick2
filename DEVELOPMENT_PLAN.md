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
| 6 | Completar la gestión de memoria y recursos mediante RAII | Alta | 2, 5 | Pendiente | Tiles, bitmaps, audio, fuentes, eventos, mundo y entidades se liberan siempre; ejecución y cierre limpios con AddressSanitizer/LeakSanitizer. |
| 7 | Hacer que los cargadores fallen de forma segura y validen los datos | Alta | 4 | Completada | Un archivo ausente, mal formado o incompleto produce un error descriptivo sin continuar con punteros nulos ni un mundo parcialmente inicializado; pruebas de entradas inválidas. |
| 8 | Eliminar rutas y parámetros del nivel 1 incrustados en el código | Alta | 7, 14 | Pendiente | El nivel, jugador, música, proyectiles, cámara y parámetros configurables se obtienen del paquete de juego; se puede seleccionar otro nivel sin recompilar. |
| 9 | Desacoplar los estados de animación del orden de declaración | Alta | 7, 14 | Pendiente | Estados con identificadores únicos como `running` o `dying`; reordenar su declaración no cambia el comportamiento; IDs duplicados generan un error. |
| 10 | Generalizar y validar la importación de mapas TMX | Media | 3, 7, 14 | Pendiente | El importador comprueba capas, dimensiones, GID y tileset; distingue tile vacío del primer tile y da errores claros para variantes no soportadas. |
| 11 | Incorporar una caché de recursos gráficos y de audio | Media | 6, 7 | Pendiente | Una ruta se carga una sola vez y se comparte con propiedad segura; existen métricas o pruebas que confirman que no se duplican bitmaps. |
| 12 | Expresar duraciones y velocidades independientemente del framerate | Alta | 1 | Pendiente | Animaciones, IA, triggers, muerte y efectos mantienen su duración al variar los FPS de renderizado; valores temporales tienen unidades documentadas. |
| 13 | Separar herramientas de depuración de las reglas del juego | Media | 1 | Pendiente | Coordenadas del ratón, bounding boxes y activaciones de prueba se controlan mediante un modo de depuración y no alteran una partida normal. |
| 14 | Migrar XML/TMX disperso a un formato JSON canónico y versionado | Alta | 7 | En curso | Existe JSON Schema, `formatVersion`, conversor desde los datos actuales y cargador JSON nativo; ninguna clase del runtime depende de PugiXML ni de archivos XML/TMX; el nivel 1 migrado conserva su contenido y comportamiento. |
| 15 | Corregir el crash al morir por un láser | Crítica | 0 | Completada | La muerte causada por el láser de la primera escalera completa la animación y el respawn sin crash; el reset de láseres no restaura valores indeterminados y pasa las comprobaciones con optimización y sanitizers. |

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
