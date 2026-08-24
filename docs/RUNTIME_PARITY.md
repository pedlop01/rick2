# Runtime parity plan

The browser runtime consumes the same `rick2.level` document as C++. Porting is
verified by observable tick results, not by reproducing the C++ class layout.

| Subsystem | Native authority | Web module / milestone |
|---|---|---|
| 50 Hz clock | `main.cpp`, `timer.cpp` | `preview-runtime.ts` (implemented) |
| Player FSM and speeds | `character.cpp`, `rick_params.h` | `web-player.ts` (movimiento básico implementado) |
| Tile and stair collisions | `character.cpp`, `world.cpp` | sólidos, plataformas unidireccionales y escaleras implementados |
| Platforms, hazards and triggers | `object.cpp`, `world.cpp` | preview runtime expansion |
| Enemies and AI | `enemy.cpp`, `enemy_ia.cpp` | deterministic AI actors |
| Camera/checkpoints/death | `camera.cpp`, `checkpoint.cpp` | seguimiento, activación y respawn básico implementados |
| Bombs, shots, blocks and items | corresponding C++ classes | transient actor system |
| Animation and audio | `animation.cpp`, `sound_handler.cpp` | shared definitions/assets |

Native constants currently preserved for parity are horizontal speed 2 px/tick,
vertical speed range 1–3 px/tick, vertical acceleration 0.1 px/tick², player
sprite 23×21 and collision box `(5, 0, 13, 21)`. The first checkpoint supplies
the initial position and facing; no level-1 coordinates are embedded in web
code.

Each subsystem needs deterministic unit fixtures and a level-1 smoke scenario.
The editor preview remains read-only; the full runtime is allowed to create
transient actors but never serializes them into the project.

El nivel 1 completo forma parte de la suite automática: dos runtimes avanzan
300 ticks con la misma entrada y deben producir exactamente el mismo jugador,
cámara y conjunto de cuerpos. Otra prueba confirma que Reset recupera el
snapshot inicial tras ejecutar el nivel real. El smoke test exige además que
cada par `definition + state` emitido tenga una animación resoluble; esto cubre
la nomenclatura `OBJ_STATE_*` corregida de `cube_hazard`. El renderer acepta
también el alias histórico `CHAR_STATE_*` para poder abrir proyectos anteriores
sin ocultar sus sprites antes de guardarlos con la definición normalizada. Una
auditoría estática adicional deriva los estados posibles de cada tipo y de las
acciones reales: por ejemplo, un hazard eléctrico compuesto solo por `stop` no
necesita inventar una animación `MOVING`.

## Alcance implementado en la primera iteración

- Movimiento horizontal, salto, caída, agachado y subida/bajada por escaleras.
- Semántica de los cuatro GID de colisión definidos tras el tileset: sólido,
  plataforma unidireccional, escalera y parte superior de escalera.
- Apoyo y arrastre sobre plataformas móviles; el desplazamiento vertical pasa
  por la resolución de colisiones y no puede incrustar a Rick en un techo. Los
  hazards no se confunden con superficies transitables.
- Activación de checkpoints limitada al grafo `nxt_chks` del checkpoint actual,
  caída fuera del mapa y respawn determinista. La
  muerte reproduce el arco nativo: impulso ascendente de 80 px, aceleración de
  regreso, desplazamiento horizontal y crecimiento progresivo del sprite antes
  de reaparecer al cruzar el borde inferior de la cámara congelada. La escala
  visual no altera la caja de colisión de depuración.
- Mejora exclusiva del preview web: sesión de depuración con vidas configurables
  mediante `session.initialLives`, decremento en cada muerte y estado de game
  over. El C++ todavía reinicia indefinidamente y no consume este valor. Esta
  extensión sirve para comprobar checkpoints y estimar la dificultad sin
  convertir el editor en el modo de juego definitivo; Reset restaura la sesión.
- Colisión letal con hazards visibles y láseres activos por defecto; las fases
  `deactivate` de los hazards se ocultan y dejan de producir daño.
- Movimiento horizontal, vertical y diagonal de láseres según su velocidad y
  dirección, con colisión contra el mapa, animación `DYING` y relanzamiento
  desde su origen. El contacto de un láser activo elimina también enemigos sin
  detener su trayectoria. Tras su primera activación externa, los láseres
  `recursive` continúan relanzándose aunque `default_trigger` sea falso; los
  one-shot permanecen detenidos.
- Triggers espaciales `enters`, `stays`, `exits` y `hits`, con filtro de cara,
  retardos por destino y activación de láseres, hazards y plataformas. `hits`
  exige una transición nueva al estado efectivo `HITTING` mientras Rick
  permanece en la zona; pulsar la combinación en el aire o en escaleras no
  activa el trigger. `trigger_cond` conmuta las ramas `cond` 1/2 sin detener una secuencia
  activa; `trigger: 0` solo desactiva directamente los láseres, de acuerdo con
  los contratos `UnsetTrigger` del runtime C++. Las plataformas `one_use`
  permanecen agotadas tras completar su recorrido y los hazards no recursivos
  respetan `stop_inactive` al terminar, quedando además sin colisión letal.
  En las secuencias, `wait` temporiza acciones sin desplazamiento; igual que en
  C++, no añade una pausa posterior cuando `desp` es mayor que cero. Una acción
  terminal conserva el objeto activo —y letal si es un hazard visible— hasta
  consumir por completo ese tiempo antes de cerrar la secuencia.
- Acciones básicas de Rick mediante combinaciones con Espacio: disparo, bomba y
  golpe. El preview limita bala y bomba a una instancia, usa la velocidad nativa
  del disparo y obtiene mecha/explosión de las animaciones JSON de la bomba. Las
  bombas apoyadas sobre plataformas móviles ajustan su altura y heredan el
  desplazamiento horizontal después de que la plataforma avance en el tick.
  También aterrizan desde arriba sobre tiles de plataforma unidireccional y
  partes superiores de escalera sin tratarlos como paredes laterales.
  Rick permanece inmóvil durante los tres estados de acción y el golpe mantenido
  expira tras los 20 ticks nativos antes de poder iniciarse de nuevo.
- Recogida de ítems por contacto, impactos de bala contra ítems/bloques y
  destrucción de ítems y bloques dentro del bounding box de una explosión. Los
  ítems sin apoyo caen con aceleración hasta su velocidad vertical máxima y se
  ajustan al borde del primer sólido, plataforma o parte superior de escalera.
  Los
  bloques explosivos reproducen `DYING`; los demás salen despedidos a velocidad
  nativa hasta recorrer una anchura de cámara. Mientras permanecen visibles y
  en reposo, los bloques actúan también como sólidos dinámicos para Rick: frenan
  el movimiento lateral, el salto y la caída, y permiten caminar o saltar sobre
  ellos. Los enemigos invierten su marcha ante ellos y las bombas lanzadas se
  detienen al alcanzarlos antes de ejecutar la explosión; la bomba conserva la
  referencia del bloque de contacto para destruirlo aunque las cajas queden
  adyacentes en vez de solapadas.
- Enemigos con gravedad y colisiones, patrulla `walker`, persecución `chaser`
  dentro de sus límites de IA y navegación vertical por escaleras. El contacto
  es letal, el golpe frontal los congela durante dos segundos y disparos y
  bombas los eliminan. Tras encontrar una pared o un borde, `ia_block_steps`
  impide que un `chaser` reoriente inmediatamente su marcha y quede bloqueado
  intentando alcanzar a Rick a través de un hueco sin escalera. `ia_random` e
  `ia_randomness` producen cambios de patrulla mediante una secuencia estable:
  Reset reproduce exactamente las mismas decisiones. Un enemigo congelado
  parpadea cada cuatro ticks durante dos segundos; solo se oculta el sprite y
  su caja de depuración permanece visible.
- Modo de depuración invulnerable, activado por defecto en el editor: conserva
  la detección y señala el contacto peligroso sin interrumpir la exploración;
  además permite atravesar bloques sólidos sin ocultarlos ni modificar el nivel.
- Encuadre de una pantalla lógica del juego, usando las dimensiones de cámara
  del nivel y centrado en la posición actual del personaje.
- Seguimiento de cámara sin incluir zoom o pan del editor en deshacer/rehacer.
- Selección y límites de `cameraViews` equivalentes al runtime nativo: en zonas
  solapadas se elige la vista situada en la dirección hacia la que mira Rick,
  el viewport se restringe a sus bordes y permanece congelado durante `DYING`.
  El interruptor de depuración `Vistas cámara` permite ignorar temporalmente
  esos límites durante Play sin modificar ni serializar el nivel.
- Render de sprites desde las animaciones JSON para Rick, enemigos, proyectiles,
  plataformas, hazards, ítems, bloques, objetos de fondo y láseres. `Sprites` y
  `Cajas` son capas independientes y pueden mostrarse simultáneamente o por
  separado. Los objetos animados de fondo usan `OBJ_STATE_MOVING` y aplican
  `skip_num_anims` como desfase inicial; los hazards detenidos seleccionan
  `OBJ_STATE_STOP` durante sus esperas o fases desactivadas.
- Música enlazada a Play/Pause/Reset y efectos para disparo, bomba, explosión y
  muerte. El interruptor `Audio` silencia todo sin modificar la simulación.
- Política musical configurable: pista inicial one-shot o en bucle y una pista
  posterior opcional con su propio modo. El nivel 1 conserva su música one-shot.
- Recogida con efectos diferenciados (`bonus` o `ring`) y estados `DYING`
  temporizados para bonus, bloques, ítems destruibles y enemigos. El bonus
  recogido asciende durante 30 ticks a la velocidad nativa de 3 px/tick.
- Caja de Rick dinámica: 13×21 de pie y 13×15 agachado, manteniendo los pies y
  comprobando el espacio superior antes de recuperar la altura normal. La
  transición de agachado se reproduce una vez y conserva su último frame cuando
  Rick está quieto; al caminar agachado los frames vuelven a ser cíclicos. Al
  abandonar el suelo recupera la caja de pie y cae; solo el centro de la caja
  permite iniciar el descenso por una escalera, evitando entradas laterales.
- Los `chaser` alinean toda su caja con el ancho continuo de una escalera tanto
  al subir como al bajar; ante un techo se recolocan o buscan una salida lateral.
  En suelo, una dirección bloqueada solo cambia la orientación si la alternativa
  es transitable y el enemigo avanza por ella en el mismo tick. Al aterrizar,
  los enemigos se ajustan al borde exacto del tile para evitar falsos choques
  laterales y giros continuos.
- Los relojes de animación son locales a cada actor: se reinician al cambiar de
  estado, un enemigo congelado conserva también su frame y Rick anima la subida
  o bajada de escaleras solo mientras existe desplazamiento.

La tarea 30 queda cerrada con el nivel 1 reproducible, el smoke determinista y
las pruebas del editor en verde. Las comparaciones visuales finas de offsets y
duraciones contra el ejecutable nativo pasan a la tarea 33: allí se revisarán
como posibles divergencias del motor C++ y se convertirán en fixtures cuando
sean reproducibles, sin añadir otro modelo paralelo.
