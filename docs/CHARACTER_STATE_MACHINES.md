# Máquinas de estados y formas de personaje

## Alcance del primer corte

`character-state-machine.ts` es un ejecutor determinista y ajeno a Rick,
Camelot, render, colisiones y DOM. Recibe un grafo JSON y, en cada tick, un
contexto ya calculado por el adaptador del juego.

Las transiciones se evalúan en el orden escrito. Se ejecuta únicamente la
primera cuyas condiciones sean todas ciertas. Una transición cambia el estado,
reinicia su reloj y aplica sus acciones en orden. Si ninguna coincide, aumenta
`ticksInState`.

## Contrato inicial

```json
{
  "initialState": "idle",
  "states": [
    {
      "id": "idle",
      "behavior": "stop",
      "animation": "WARRIOR_IDLE",
      "transitions": [
        {
          "to": "running",
          "conditions": [
            { "type": "control", "control": "right", "pressed": true },
            { "type": "signal", "signal": "grounded", "value": true }
          ],
          "actions": [
            { "type": "setFacing", "value": "input" },
            { "type": "capturePosition", "axis": "both" }
          ]
        }
      ]
    },
    { "id": "running", "transitions": [] }
  ]
}
```

Condiciones admitidas:

- `control`: estado pulsado/liberado de `left`, `right`, `up`, `down` o
  `action`;
- `signal`: `grounded`, `onStairs` o `ceilingBlocked`, calculadas por el
  controlador de movimiento;
- `elapsedTicks`: reloj local del estado;
- `distance`: distancia absoluta X/Y desde la posición capturada;
- `previousState`: estado inmediatamente anterior.

Las comparaciones numéricas son `equal`, `notEqual`, `greater`,
`greaterOrEqual`, `lower` y `lowerOrEqual`.

Acciones admitidas en esta tarea:

- `setFacing`: izquierda, derecha o dirección horizontal del input;
- `capturePosition`: guardar X, Y o ambos como origen de distancias;
- `setForm`: solicitar al adaptador un cambio a una forma declarada.

Los IDs de estado pertenecen al juego y no tienen que llamarse como los de
Rick. Cada estado puede declarar independientemente `behavior` (la semántica
física acotada: reposo, carrera, salto, agachado, escalera, acciones o muerte)
y `animation` (el estado visual de su definición). Por ejemplo, `swordDraw`
puede usar behavior `stop` y animación `WARRIOR_DRAW_SWORD`.

`setForm` produce una solicitud; el ejecutor puro no conoce geometría,
animaciones ni recursos. El registro de formas aplica después el nuevo perfil
sin reiniciar el nivel. Acciones generales de mundo, flags y secuencias quedan deliberadamente
fuera de este contrato y pertenecen a la tarea 41.

## Validación

Antes de ejecutar se rechazan:

- grafos sin estados o sin estado inicial válido;
- IDs duplicados y destinos inexistentes;
- transiciones sin condiciones;
- tiempos y distancias negativos o no finitos;
- nombres vacíos de estados o formas.

La definición se clona al construir la máquina web para que una edición externa
no cambie una simulación en curso. `level.schema.json` publica ya el contrato
bajo `runtimeProfile.characterForms`; el validador semántico comprueba IDs,
destinos de estados y cambios de forma que JSON Schema no puede cruzar.

El cargador C++ valida el mismo bloque y su ejecutor C++11 implementa las mismas
condiciones, comparaciones y acciones. La fixture
`tests/fixtures/character_forms.json` se ejecuta en ambas implementaciones para
evitar que sus contratos diverjan silenciosamente.

## Registro de formas

`character-forms.ts` agrupa un ID, perfil físico, capacidades, bindings de
acción y máquina de estados. Valida IDs, forma inicial, perfiles y todos los
destinos de `setForm`. Al cambiar de forma se conserva la dirección y se toma
la posición actual como nuevo origen, sin recrear el nivel.

El controlador web ya obtiene las constantes históricas mediante una forma
declarada `rick`. Este primer adaptador conserva la API anterior y todo su
movimiento. La máquina declarativa es además la única propietaria del estado,
estado anterior y reloj local: `WebPlayer` ya no guarda una copia paralela. El
respawn reinicia también historial, reloj, origen y dirección del grafo.

Las decisiones de locomoción todavía son propuestas por el behavior compatible
existente. El siguiente corte trasladará esas condiciones al grafo por grupos,
usando las regresiones actuales como comparación tick a tick.

### Primer grupo de decisiones migrado

Disparo, bomba y golpe ya entran, permanecen y salen mediante transiciones del
grafo `rick`. Los controles físicos se traducen primero a acciones semánticas
según `actionBindings`; por eso el grafo no conoce combinaciones concretas como
“acción + arriba”. La condición `action` consulta ese conjunto semántico y
permite conservar remapeos y capacidades opcionales.

El behavior de locomoción consume después el estado elegido por el grafo y ya
no asigna estos tres estados. Las pruebas cubren las combinaciones históricas,
acciones mantenidas, duración del golpe, capacidades deshabilitadas y bindings
remapeados.

### Locomoción y cambio de forma conectados

El grafo `rick` decide también reposo, carrera, entrada y salida de agachado,
inicio de salto o caída y entrada o abandono de escaleras. El adaptador físico
se limita a aplicar velocidad y resolver colisiones a partir del estado. La
duración máxima del golpe usa `elapsedTicks`, por lo que ya no existe un segundo
contador en `WebPlayer`.

`WebPlayer` acepta además un registro de formas y aplica una solicitud
`setForm` durante la simulación. El cambio conserva la coordenada de los pies y
reemplaza perfil físico, capacidades, bindings y grafo. Una regresión completa
usa `warrior` de 40 píxeles y `frog` de 31 píxeles con distinto ancho y
velocidad, y comprueba la transformación sin reiniciar el mundo.
Cada forma puede seleccionar además otra `definition`; el renderer cambia de
sprites y de estado de animación en el mismo tick que el perfil físico.

`PreviewRuntime` toma el registro directamente del paquete; si no existe,
genera la forma compatible `rick`, conservando los niveles anteriores.

En C++, `Character::ComputeNextState` y `Reset` son puntos de extensión
polimórficos. `Player` los reemplaza únicamente cuando el paquete contiene
`characterForms`: traduce teclado y colisiones al contexto común, deja que el
grafo decida y aplica después el behavior al movimiento histórico. Al cambiar
de forma conserva los pies, actualiza geometría, velocidades, capacidades y
bindings, carga su definición de animaciones y selecciona el estado visual
declarado. Sin `characterForms` sigue ejecutándose literalmente el camino
anterior, que mantiene compatible el nivel 1.

## Edición visual

El modo **Edit · Character states** (`M`) permite editar este contrato sin
modificar JSON manualmente. En niveles antiguos, **Create Rick state machine**
materializa primero el perfil compatible que antes se generaba implícitamente.

La columna izquierda administra formas y estados. El inspector permite definir
el behavior físico, la animación, el estado inicial y la prioridad de sus
transiciones. Cada condición y acción se edita con controles tipados; añadir,
eliminar y reordenar reglas forma parte del historial normal del proyecto.

El lienzo presenta el grafo dirigido y permite mover sus nodos para leerlo
mejor. Esa disposición es una preferencia visual y no contamina el paquete del
juego. Durante **Test · Play**, el nodo activo se resalta para relacionar el
comportamiento observado con la transición que lo produjo.

Las condiciones de tipo `event` se eligen desde un catálogo compartido por la
interfaz y el validador. La primera versión registra `killed` (daño mortal) y
`landed` (fin de salto o caída), e indica en el propio selector cuándo los emite
el runtime. Un nombre antiguo o desconocido se conserva al cargar, pero aparece
como advertencia porque no podrá ocurrir sin un emisor. Los eventos
personalizados se declaran ahora en el programa de gameplay y aparecen en el
mismo selector; una acción o secuencia `emitEvent` los entrega al grafo en web
y C++. El contrato completo está en `GAMEPLAY_PROGRAMS.md`.
