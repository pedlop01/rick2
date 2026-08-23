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

## Alcance implementado en la primera iteración

- Movimiento horizontal, salto, caída, agachado y subida/bajada por escaleras.
- Semántica de los cuatro GID de colisión definidos tras el tileset: sólido,
  plataforma unidireccional, escalera y parte superior de escalera.
- Apoyo y arrastre sobre plataformas móviles; los hazards no se confunden con
  superficies transitables.
- Activación de checkpoints, caída fuera del mapa y respawn determinista.
- Colisión letal con hazards visibles y láseres activos por defecto; las fases
  `deactivate` de los hazards se ocultan y dejan de producir daño.
- Movimiento horizontal, vertical y diagonal de láseres según su velocidad y
  dirección, con colisión contra el mapa y relanzamiento desde su origen.
- Triggers espaciales `enters`, `stays`, `exits` y `hits`, con filtro de cara,
  retardos por destino y activación de láseres, hazards y plataformas. `hits`
  utiliza una pulsación nueva de la acción Espacio mientras Rick permanece en
  la zona.
- Modo de depuración invulnerable, activado por defecto en el editor: conserva
  la detección y señala el contacto peligroso sin interrumpir la exploración.
- Encuadre de una pantalla lógica del juego, usando las dimensiones de cámara
  del nivel y centrado en la posición actual del personaje.
- Seguimiento de cámara sin incluir zoom o pan del editor en deshacer/rehacer.

Todavía faltan IA, armas, objetos, vidas, animaciones y audio. Se incorporarán
como subsistemas independientes sobre este mismo reloj y modelo de datos.
