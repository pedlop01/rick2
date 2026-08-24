# Revisión de paridad del runtime C++

Este documento sigue la tarea 33. Cada lección del port web se contrasta con el
runtime nativo antes de modificarlo. Una fila solo se considera corregida si la
divergencia está confirmada y dispone de una comprobación reproducible.

| Área | Invariante aprendido en el port web | Estado C++ | Comprobación / siguiente paso |
|---|---|---|---|
| Ajustes aleatorios de IA | `ia_randomness` define una probabilidad distinta para cada enemigo y nunca puede producir módulo por cero. | Corregido | `enemy_ia_rules_test.cpp` cubre 32, 64, 512 y la normalización de cero; el constructor ya no sustituye todos los valores por 15. |
| Secuencia aleatoria de IA | Reset debe reproducir las mismas decisiones para poder comparar una partida y depurarla. | Corregido | Cada enemigo usa un LCG local sembrado por su ID, idéntico al port web. El fixture fija los primeros valores, la independencia entre enemigos y el reinicio de la semilla. |
| Escaleras de `chaser` | El enemigo debe centrarse, abandonar `CLIMBING` fuera de la escalera y escoger una salida transitable. | Corregido | Cubiertas pertenencia, entrada autónoma, recolocación ante techo y transición lateral `CLIMBING` → `RUNNING` al alcanzar suelo. Las colisiones normales validan la salida elegida. |
| Aterrizaje y gravedad | El borde inferior se ajusta al soporte y no genera falsos choques laterales ni giros continuos. | Corregido | Regla de apoyo compartida y resolución exacta contra ambos bordes del tile cubiertas. `Object::SetY` ya no suma erróneamente el intento de ascenso al chocar. |
| Caja agachada | La caja mantiene los pies, cae sin apoyo y solo recupera la altura si hay espacio superior. | Corregido | La altura agachada procede de su animación y al levantarse se restauran las dimensiones originales; las reglas de apoyo y hueco superior están cubiertas. |
| Bloques y bombas | Los bloques en reposo son sólidos y una bomba detenida adyacente puede destruir el bloque tocado. | Corregido | Filtros y dimensiones corregidos; personajes aterrizan sobre bloques sin falsos laterales y la bomba conserva el bloque que la detuvo hasta explotar. |
| Acciones con `wait` | Un `wait` no se añade tras un desplazamiento y una acción terminal inmóvil permanece activa hasta agotarlo. | Corregido | Temporización y distancia cubiertas; plataformas y hazards reaplican `cond` al reiniciar y esperan de forma segura si ninguna rama coincide. |
| Estados y animaciones | Cada estado emitido resuelve una animación; los relojes son locales y se reinician al cambiar de estado. | Corregido | Política de reloj cubierta y contrato nativo cruza estados emitidos con ID, nombre, frames y duración de cada definición real del nivel 1. |
| Muerte y cámara | La cámara se congela durante `DYING` y el respawn ocurre al cruzar su borde inferior. | Corregido | Umbral de subida, borde de respawn y congelación de posición/vista durante `DYING` y `DEAD` cubiertos; Reset limpia estado transitorio y restaura dimensiones originales. |
| Checkpoints y triggers | Solo se activan checkpoints alcanzables por `nxt_chks`; `hits` exige entrar realmente en `HITTING`. | Corregido | La intersección AABB compartida cubre contención y excluye el mero contacto; fixtures nativos fijan enlaces, respawn, cara y transiciones `enters/stays/exits/hits`. |

## Primer hallazgo confirmado

El cargador pasaba correctamente `ia_randomness`, pero el constructor de
`EnemyIA` lo sobrescribía con `RANDOM_DECISION_VALUE` (15). En el nivel 1 hay
valores 32, 64, 256 y 512, por lo que todos los enemigos aleatorios se desviaban
de la configuración compartida con el editor. El runtime conserva ahora el
valor configurado y aplica el mismo mínimo seguro de 1 que el port web.

El segundo hallazgo era el uso compartido de `rand()` y la llamada a
`srand(time(0))` desde cada constructor. Además de impedir una reproducción
determinista, construir un enemigo reiniciaba la secuencia global de todos los
demás. Cada `EnemyIA` conserva ahora su propio estado de 32 bits, sembrado por
el ID y avanzado con el mismo LCG que el runtime web. Recargar el nivel restaura
la secuencia y las decisiones de un enemigo ya no dependen de sus vecinos.

La primera revisión geométrica descubrió que `ComputeCollisions` repetía las
dos esquinas superiores al calcular `inStairs`: nunca reconocía
`TILE_STAIRS` en las esquinas inferiores y solo aceptaba allí el tile superior.
La regla extraída considera las cuatro muestras y ambos GID de la escalera. El
mismo cálculo sirve a `Character`, por lo que corrige a Rick y a los enemigos.

La decisión vertical del `chaser` solo contemplaba iniciar un descenso. Para
subir emitía `KEY_UP` exclusivamente si el enemigo ya estaba en `CLIMBING`, de
modo que un enemigo en suelo no podía entrar por sí mismo en ese estado. La
regla aislada inicia ahora el ascenso al tocar una escalera con Rick más de 10
píxeles por encima, conserva el descenso desde el tile superior y evita cambiar
al eje vertical dentro de la tolerancia.

La recolocación anterior solo reconocía dos combinaciones exactas de esquinas
`pared + escalera`. Ahora, si el ascenso encuentra un techo, `Character` busca
la franja continua de escalera en la fila bajo su centro y limita su caja al
intervalo transitable. La fórmula está cubierta también para cajas más anchas
que una escalera de un solo tile y el ajuste solo se aplica durante ese choque.

Al alcanzar suelo, `ChaserDecision` elegía correctamente izquierda o derecha,
pero `IAStepChaser` borraba ambas teclas por observar todavía el estado
`CLIMBING`. Incluso conservándolas, `Character` no cambiaba a `RUNNING`. La
salida lateral mantiene ahora la tecla cuando hay suelo y realiza la transición
explícita; dentro del hueco se siguen anulando movimientos horizontales para no
abandonar accidentalmente la escalera.

La gravedad tampoco compartía una única definición de apoyo. Rick y las bombas
atravesaban correctamente `TILE_STAIRS`, mientras `Item` y la FSM base detenían
la caída al encontrar ese mismo GID. Todos usan ahora `IsBodyUnsupported`: aire
y escalera normal permiten caer, y sólido, plataforma unidireccional o parte
superior de escalera sostienen el cuerpo si aparecen bajo cualquiera de sus dos
extremos.

Las fórmulas de resolución vertical estaban duplicadas. La de aterrizaje era
equivalente en `Character` y `Object`, pero no tenía un fixture que garantizase
que la caja termina exactamente un píxel antes del tile. Peor aún, la rama de
choque superior de `Object::SetY` hacía `y + desplazamiento + corrección` aunque
el movimiento solicitado era ascendente. Ambas clases usan ahora las mismas
funciones puras para resolver los bordes superior e inferior.

Las búsquedas de colisión dinámica se interrumpían con `break` al encontrar un
bloque muerto o el primer objeto que no fuera un ítem. Esto ocultaba entidades
válidas situadas después en sus listas. Ahora esos casos usan `continue`, y las
cuatro esquinas emplean las dimensiones efectivas incluso cuando el objeto no
tiene bounding box. Rick también ignora bloques `DYING/DEAD` y prueba el primer
píxel adyacente de la caja, no uno adicional más allá del contacto.

Los personajes solo comprobaban las caras laterales de un bloque. Ahora una
caída que alcanza o penetra ligeramente su cara superior se corrige al borde
exacto antes de evaluar paredes; esto permite apoyarse y evita el giro falso de
un enemigo al aterrizar. La bomba guarda además el bloque que detuvo su avance:
al entrar después en `DYING` puede activarlo aunque las cajas ya solo sean
adyacentes o la búsqueda dinámica haya cambiado de candidato.

La temporización de acciones inmóviles ya coincidía con el port web y queda
fijada por test (`wait = 20` completa con `elapsed = 20`). En cambio, las
acciones con desplazamiento aplicaban siempre la velocidad completa. La
plataforma de 728 px a 6 px/tick terminaba en 732; plataforma y hazard limitan
ahora el último paso a los 2 px restantes. Como en el formato compartido, el
campo `wait` se ignora cuando `desp` es mayor que cero.

Al volver al principio de una secuencia recursiva, C++ no filtraba de nuevo las
acciones condicionales y podía ejecutar durante un tick la primera rama aunque
`cond_actions` seleccionase la contraria. El reinicio de plataformas y hazards
repite ahora la selección; si ninguna acción coincide, conserva el estado y
espera al siguiente tick sin acceder al iterador final. El filtro iterativo
evita además recursión proporcional al número de acciones descartadas.

Los relojes ya pertenecían a cada `Animation`, pero `CharacterStep` no
reiniciaba la animación al entrar en un estado y reseteaba cada tick cualquier
estado sin dirección. Ahora una transición conserva el frame 0 durante un tick,
agachado quieto reproduce la transición una sola vez y queda en su último frame,
y caminar agachado sigue siendo cíclico. `ObjectStep` aplica la misma regla de
entrada. Un enemigo congelado deja además de ejecutar la FSM base, conservando
posición, estado y frame hasta el tick posterior al fin de la congelación.
La pausa no bloquea un impacto letal: si un láser, disparo o bomba marca
`killed`, se cancela la congelación y `DYING` comienza en ese mismo tick.

La auditoría `native_animation_contract_test.py` deriva los estados posibles de
cada familia nativa —incluida la diferencia entre hazards móviles y puramente
estáticos— y comprueba el paquete canónico. Cada ID emitido debe tener el nombre
`RICK_STATE_*`, `CHAR_STATE_*` u `OBJ_STATE_*` correspondiente, al menos un
sprite y una duración positiva. De este modo una definición válida para el
editor pero incompleta para C++ falla en la suite antes de llegar a
`AnimationForState` durante una partida.

El arco de muerte usa ahora reglas explícitas para los 80 px de subida y el
borde inferior de la cámara. La congelación incluye tanto la posición como la
`cameraView`, y se mantiene durante el tick `DEAD` para evitar seguir al cuerpo
fuera de pantalla justo antes del respawn. `Reset` restaura las dimensiones
originales en lugar de imponer 23×21/13×21 y limpia contadores, escala y
referencias transitorias antes de reaparecer en el checkpoint.

Checkpoints y triggers comprobaban si alguna esquina del personaje caía dentro
de la zona. Esa aproximación fallaba cuando una zona pequeña quedaba contenida
por completo en su caja o cuando dos rectángulos se cruzaban sin contener sus
esquinas; además consideraba entrar el simple contacto entre bordes. Ambos usan
ahora la misma intersección AABB estricta que el runtime web. Las reglas aisladas
fijan también la cara requerida y las transiciones `enters`, `stays`, `exits` y
`hits`; esta última solo se cumple al entrar realmente en `HITTING` mientras
Rick permanece dentro. El reset limpia asimismo el estado anterior usado por
esa transición, y un fixture pequeño verifica el orden del grafo `nxt_chks` y
los datos de respawn.

La transición de agachado ya no impone las alturas literales 15 y 21. Toma la
altura del primer frame de `CHAR_STATE_CROUCHING`, desplaza la caja para
conservar los pies y restaura `height_orig`/`bb_height_orig` al levantarse. Así
se mantiene el comportamiento validado en el nivel 1 sin acoplar la colisión a
las dimensiones concretas del sprite actual.
