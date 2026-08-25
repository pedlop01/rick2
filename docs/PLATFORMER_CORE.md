# Núcleo configurable de plataformas

Este documento guía la tarea 31. El objetivo no es convertir Rick2 Engine en
un motor universal, sino permitir crear juegos 2D de plataformas del mismo
orden de complejidad sin modificar el núcleo de simulación.

## Frontera del motor

| Capa | Responsabilidad | Ejemplos actuales |
|---|---|---|
| Núcleo | Tiempo fijo, geometría, colisiones, mapa, cámara y ciclo de entidades. | Tick de 50 Hz, AABB, tiles sólidos, plataformas y escaleras. |
| Componentes | Comportamientos reutilizables registrados y combinables. | Movimiento de jugador, patrulla, persecución, daño, proyectil y coleccionable. |
| Perfil de juego | Selección y parámetros de componentes, estados, controles y reglas de sesión. | Perfil Rick: salto, agachado, golpe, disparo, bomba, tres vidas y checkpoints. |
| Presentación | Definiciones de animación, audio y herramientas de editor. | Estados `RICK_STATE_*`, sprites, música y overlays. |

El núcleo no debe comprobar nombres de assets, prefijos de estado ni claves de
entidades propias de Rick. Los componentes pueden conocer sus datos tipados,
pero no acceder directamente al DOM, Canvas o almacenamiento del editor.

## Acoplamientos encontrados

La primera auditoría localiza la mayor parte de las reglas específicas en:

- `web-player.ts`: dimensiones 23/13/21/15, física, altura de salto, muerte y
  combinaciones de input para disparar, lanzar bomba y golpear;
- `preview-runtime.ts`: prefijos `RICK_STATE_*`, familias `shoot`/`bomb`, slots
  de audio, vidas, daño, recogida de objetos e IA `walker`/`chaser`;
- `editor-shell.ts` y `workspace-preview.ts`: textos y colores que identifican
  directamente a Rick, sus proyectiles y sus enemigos;
- schema y proyecto vacío: `player`, dos proyectiles obligatorios y estados
  heredados del formato original.

## Estrategia incremental

1. Extraer un perfil tipado de geometría y física del jugador, inyectable en
   `WebPlayer` y `PreviewRuntime`, manteniendo el perfil Rick como default.
2. Separar el mapeo de inputs y capacidades opcionales (`crouch`, `hit`,
   `shoot`, `bomb`) de la locomoción común.
3. Registrar comportamientos de entidades (`moving`, `hazard`, `collectible`,
   `patrol`, `chaser`, `projectile`) sin despachos por prefijo de clave.
4. Extraer reglas de sesión: daño, invulnerabilidad, vidas, respawn y objetivo.
5. Sustituir nombres de estado y slots de audio fijos por bindings del perfil.
6. Exponer los perfiles en el formato compartido, su schema e inspector. Este
   paso incluirá migración y soporte C++ antes de declarar escribible la nueva
   versión, conforme a la política de sincronización.
7. Construir un juego mínimo distinto de Rick que use el mismo núcleo sin
   añadir condiciones a éste.

## Primer corte implementado

`platformer-core.ts` define `PlayerControllerConfig`, valida perfiles parciales
y conserva `RICK_PLAYER_CONTROLLER` como compatibilidad. `WebPlayer` ya no
contiene constantes físicas literales y `PreviewRuntime` acepta el perfil por
inyección. Todavía no se serializa en `level.json`: primero se estabilizará la
API interna y luego se actualizarán conjuntamente schema, editor y C++.

La regresión exige simultáneamente que el perfil por defecto conserve el
comportamiento del nivel 1 y que otro perfil pueda cambiar ancho de colisión,
offset, velocidad y altura agachada sin tocar el runtime.

## Segundo corte implementado

`PlayerCapabilities` permite habilitar o retirar de un perfil `jump`, `crouch`,
`climb`, `shoot`, `bomb` y `hit`. `PlayerActionBindings` separa además las tres
combinaciones contextuales del botón de acción: arriba, abajo y dirección
horizontal. El perfil Rick conserva respectivamente disparo, bomba y golpe,
pero otro juego puede remapearlas o dejarlas vacías.

La resolución de la acción es una función pura del núcleo y `WebPlayer` ya no
decide explícitamente esas tres combinaciones. `PreviewRuntime` recibe ambas
configuraciones y solo crea un proyectil si el estado habilitado y enlazado lo
solicita. Los controles direccionales físicos del navegador siguen siendo un
adaptador de UI; este corte configura su significado dentro del juego.

## Tercer corte implementado

Cada cuerpo de simulación expone ahora un `kind` semántico independiente de su
clave estable: `platform`, `hazard`, `item`, `block`, `background`, `laser`,
`enemy`, `shoot`, `bomb` o `player`. Ni la simulación ni el overlay de debug
deducen ya esas categorías mediante prefijos como `blocks:` o `items:`.

`RuntimeBehaviorRegistry` asocia los tipos persistentes con su actualización:
movimiento por acciones, hazard, caída de ítems, escape de bloques, animación de
fondo y láser. El registro rechaza duplicados y tipos sin implementación, lo
que permite añadir componentes de forma explícita y comprobable. Las claves se
mantienen únicamente como identidad y para resolver referencias de triggers.

## Cuarto corte implementado

Los cuerpos persistentes incorporan rasgos funcionales explícitos: `solid`,
`damaging`, `collectible` y `destructible`. Colisión con bloques, daño, disparos,
explosiones y recogida consultan esos rasgos en lugar de comprobar el grupo de
la entidad. La forma de destruirse (`instant`, `animated` o `escape`) y el
efecto de recogida (`instant` o `rise`, sonido, duración y velocidad) son datos
del comportamiento en memoria.

El adaptador del formato v1 traduce las familias actuales a estos componentes.
Para conservar los paquetes antiguos reconoce el bonus por `definition.name` y
solo usa el último segmento de la referencia si un fixture legado omite ese
campo. Una vez adaptado, ningún paso de simulación inspecciona nombres o rutas
de assets; una regresión usa deliberadamente `custom/treasure` para demostrarlo.

## Quinto corte implementado

Las decisiones específicas de los enemigos ya se resuelven mediante el mismo
registro explícito de comportamientos. `walker` aporta patrulla y decisiones
aleatorias; `chaser` añade persecución, entrada y salida de escaleras. El paso
común conserva congelación, muerte, movimiento horizontal, gravedad y animación.

El runtime valida el identificador de IA al adaptar el nivel y falla con un
mensaje concreto si no existe un comportamiento registrado. Así, añadir una IA
nueva exige registrarla deliberadamente y no introducir otra rama en el bucle
central de simulación.

Queda registrada una limitación de diseño compartida con el juego nativo: si
Rick abandona la zona de detección mientras un `chaser` está en una escalera,
la transición inmediata a patrulla aún no define cómo debe salir de ella. Se
resolverá al formalizar el alcance y las transiciones de las IA, no mediante
otra excepción específica del nivel 1.

## Sexto corte implementado

`SessionRules` separa de la simulación las vidas iniciales, la aplicación de
daño, la política de respawn, el reinicio de triggers al morir y el slot de
audio de muerte. El perfil Rick mantiene tres vidas, daño letal, respawn desde
checkpoint, reset del escenario transitorio y el efecto de audio actual.

Otros perfiles pueden ejecutar sesiones sin daño o sin respawn, conservar el
estado de triggers tras morir y omitir o cambiar el sonido, sin modificar el
bucle de simulación. La invulnerabilidad continúa siendo un override temporal
de depuración y no una regla persistida del juego.

## Séptimo corte implementado

`RuntimeProfileBindings` enlaza los estados semánticos del jugador, enemigos y
objetos con los nombres de animación de cada juego. También enlaza de manera
independiente los sonidos de disparo, bomba, explosión y recogida; cualquier
slot puede omitirse con `null`. El perfil Rick conserva sus nombres históricos
`RICK_STATE_*`, `CHAR_STATE_*`, `OBJ_STATE_*` y sus slots actuales.

El adaptador v1 es el único punto que reconoce los identificadores antiguos al
cargar los cuerpos iniciales. Tras esa traducción, movimiento, colisiones,
destrucción, render y audio utilizan los bindings seleccionados. Una regresión
ejecuta el preview con estados `HERO_FIRE`, `IDLE`, `ACTIVE` y un slot distinto,
demostrando que no requiere convenciones de nombres de Rick.

## Octavo corte implementado

El schema v1 admite ahora una sección opcional `runtimeProfile` con overrides
de controlador, capacidades, acciones, sesión y bindings. Al ser opcional, los
niveles existentes conservan íntegramente sus defaults y no necesitan una
migración destructiva. El preview web ya consume esta sección directamente;
las opciones de depuración inyectadas por la UI tienen precedencia sin alterar
el documento.

El loader C++ valida que la sección tenga forma de objeto y la expone como
datos del paquete, de modo que editor y runtime reconocen el mismo contrato.
En este corte el juego nativo aún no aplica sus valores a `Character` ni a las
reglas globales: esa conexión se hará antes de que el inspector permita guardar
perfiles, evitando generar proyectos que solo funcionen en el preview web.

## Noveno corte implementado

El juego C++ traduce `runtimeProfile.controller` a una estructura tipada y la
aplica exclusivamente a `Player`. Ya son compartidos con el preview el tamaño
visual, bounding box, offset horizontal, velocidad de carrera, velocidades y
aceleración vertical, velocidad de escalada, altura de salto y agachado, arco
de muerte y duración del golpe. Los enemigos conservan su configuración propia.

Los defaults nativos reproducen el perfil histórico de Rick cuando la sección
no existe. `deathRespawnTicks` se lee y valida como parte del contrato, pero el
runtime C++ conserva por ahora su condición de respawn al cruzar el borde de la
cámara; será necesario unificar ambas políticas antes de editar ese campo.

## Décimo corte implementado

El runtime C++ consume también `capabilities` y `actionBindings`. Salto,
agachado y escalada pueden retirarse del jugador; disparo, bomba y golpe se
filtran antes de enlazar las combinaciones de acción. `up`, `down` y
`horizontal` aceptan cualquiera de esas acciones o `null`, igual que el preview.

La combinación enlazada gobierna tanto la entrada como la permanencia en el
estado. Esto evita que, por ejemplo, un disparo remapeado a `down` se cree en el
primer tick pero se cancele inmediatamente porque el código nativo siguiera
esperando `up`. Sin perfil se mantienen disparo arriba, bomba abajo y golpe con
dirección horizontal.

## Undécimo corte implementado

El loader nativo resuelve las animaciones por los nombres declarados en
`bindings` y las conecta con los estados internos de jugador, enemigos y
objetos. Los IDs escritos en cada definición dejan de ser una condición oculta
para esos estados: un perfil puede usar, por ejemplo, `HERO_RUN`,
`ENEMY_LADDER` o `BROKEN` conservando la misma máquina de estados.

Disparo, bomba, muerte, explosión y las dos recogidas consultan también sus
slots configurados. Un binding `null` omite el sonido en ambos runtimes y C++
rechaza índices fuera del array de efectos. Los nombres y slots históricos se
mantienen como fallback de los paquetes v1.

## Duodécimo corte implementado

C++ consume ya las reglas de sesión que afectan a la simulación existente.
`damageEnabled: false` mantiene contactos y colisiones sin iniciar la muerte;
`respawn: none` deja al jugador en el final de su arco de muerte, y
`resetTriggersOnDeath: false` conserva triggers y láseres en su estado actual.
Los defaults reproducen daño letal, respawn por checkpoint y reset transitorio.

`initialLives` se lee y valida en ambos runtimes, pero continúa siendo una
mejora exclusiva del preview: el juego nativo aún no tiene HUD, contador ni
flujo de game over. Implementar esas piezas pertenece a la futura tarea de
vidas del juego y no debe bloquear el núcleo genérico del editor.

## Decimotercer corte implementado

El nivel puede declarar un `objective` opcional. El primer comportamiento
registrado es `reachZone`, definido en coordenadas del mundo y evaluado contra
el bounding box del jugador. `onComplete: continue` conserva la simulación y
`freeze` la detiene en el frame de victoria. Sin objetivo, los paquetes v1 no
cambian de comportamiento.

Preview y C++ comparten la misma detección, exponen el estado completado y
validan dimensiones positivas. El editor lo muestra en la barra de estado. El
contrato discriminado permite añadir después objetivos como `collectAll` o
`defeatAll` sin introducir condiciones implícitas por nombres de entidades.

## Decimocuarto corte implementado

La validación integral comprueba las referencias cruzadas que JSON Schema no
puede expresar: estados del jugador y familias usados por los bindings, slots
respecto a `audio.effects`, bounding box dentro de la anchura visual, zona del
objetivo dentro del mapa y acciones enlazadas cuya capacidad está desactivada.
Estas últimas son advertencias; estados, audio y geometrías rotas bloquean la
exportación.

El loader C++ replica las comprobaciones críticas de estados del jugador y
audio, de modo que un paquete manipulado fuera del editor falla durante la
carga con un diagnóstico concreto. Con este corte el contrato ya es seguro para
su futura exposición en el inspector.

## Decimoquinto corte implementado

La herramienta `Perfil` expone en el inspector los overrides del controlador,
capacidades, acciones, sesión, estados, audio y objetivo. Los controles muestran
siempre el valor efectivo; el botón de restablecimiento elimina únicamente el
override y vuelve a heredar el perfil base, sin copiar innecesariamente todos
los defaults al nivel.

Cada cambio se serializa en `level.json`, reconstruye el preview y entra en el
mismo historial que tiles, entidades y assets. Deshacer y rehacer conservan
abierta la herramienta, y la validación inmediata puede bloquear una
configuración incoherente antes de exportarla.

## Decimosexto corte implementado

`Demo genérica` crea **Tiny Runner** mediante el mismo formato público que un
proyecto importado. Su héroe mide 8 píxeles, utiliza estados `HERO_*`, carece de
escalada, bomba y golpe, dispara con un binding opcional y tiene reglas de
sesión propias. Incluye un walker con estados `CRITTER_*` y una zona de meta que
congela la simulación.

La regresión automatizada exporta el proyecto a ZIP, vuelve a abrirlo, lo valida
y ejecuta el preview hasta completar la meta. También comprueba que jugador y
enemigo emiten sus estados configurados, no los nombres históricos de Rick.
Esta demo se puede crear desde la aplicación offline, editar con `Perfil` y
guardar como cualquier otro paquete.

La zona `reachZone` se representa siempre sobre el mapa con una guía violeta y
la etiqueta `META`, tanto durante la edición como durante el preview.

### Fuera del alcance de esta primera versión

El runtime C++ ya consume el `level.json`, las definiciones embebidas y el
`runtimeProfile` de un proyecto genérico. Sin embargo, no abre directamente el
contenedor `.rick2-project`: actualmente hay que extraer el ZIP y pasar la ruta
del nivel al ejecutable. Además, una demo destinada al runtime nativo necesita
assets gráficos y de audio reales; los placeholders vacíos del generador sólo
son apropiados para el preview del editor.

La interoperabilidad directa con C++, los proyectos multinivel, el modelo de
campaña y el shell de juego —intro, menú, progreso y transiciones— quedan como
tareas independientes. Esta separación permite cerrar y pulir primero un
editor completo para un único nivel sin fijar prematuramente las reglas de
progresión del juego final.

## Criterio de finalización

La tarea termina cuando el nivel 1 mantiene su paridad y un segundo proyecto
pequeño puede definir otro jugador, capacidades, enemigo y meta utilizando solo
configuración y componentes registrados. Ambos deben abrirse, validarse,
ejecutarse y exportarse desde la misma aplicación offline.
