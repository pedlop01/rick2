# Gameplay declarativo

La tarea 41 añade un programa de gameplay pequeño, tipado y determinista al
formato de nivel. Permite describir mecanismos, reglas y cinemáticas sencillas
sin guardar punteros a variables ni ejecutar JavaScript o C++ del proyecto.

## Modelo de datos

El bloque opcional `gameplay` contiene tres catálogos:

- `flags`: valores persistentes de tipo `boolean`, `number` o `string`, con un
  valor inicial del mismo tipo;
- `events`: eventos personalizados que una acción emite y una zona o transición
  de personaje puede consumir;
- `sequences`: árboles de pasos `action`, `wait`, `serial` y `parallel`.

Las acciones registradas son `setFlag`, `toggleFlag`, `incrementFlag`,
`emitEvent`, `setCamera`, `showMessage`, `hideMessage` y `playEffect`. Las
cuatro últimas consumen catálogos tipados del bloque `presentation`, descrito
en [PRESENTATION.md](PRESENTATION.md). Las comparaciones ordenadas sólo admiten números. Los eventos
viven durante el tick en que se emiten; los flags viven hasta reiniciar el
nivel. `killed` y `landed` son eventos incorporados y sus nombres están
reservados.

```json
{
  "gameplay": {
    "flags": [{ "id": "doorOpen", "type": "boolean", "initial": false }],
    "events": [{ "id": "doorOpened", "description": "The door finished opening" }],
    "sequences": [{
      "id": "openDoor",
      "steps": [{ "type": "parallel", "steps": [
        { "type": "action", "action": { "type": "setFlag", "flag": "doorOpen", "value": true } },
        { "type": "serial", "steps": [
          { "type": "wait", "ticks": 20 },
          { "type": "action", "action": { "type": "emitEvent", "event": "doorOpened" } }
        ] }
      ] }]
    }]
  }
}
```

## Zonas y triggers

Un trigger puede conservar sus `targets` históricos y añadir `gameplay`, o ser
una zona exclusivamente declarativa sin `targets`:

```json
{
  "id": 20,
  "attributes": {
    "x": 80, "y": 40, "width": 24, "height": 32,
    "recursive": 0, "onehot": 1, "action": "enters", "face": "any"
  },
  "gameplay": {
    "conditions": [{ "type": "flag", "flag": "doorOpen", "comparison": "equal", "value": false }],
    "actions": [],
    "sequence": "openDoor"
  }
}
```

Las condiciones se evalúan además del evento espacial y la orientación. Al
activarse se ejecutan primero las acciones inmediatas y después se inicia la
secuencia. Una referencia inexistente, un tipo incorrecto o una acción
desconocida invalida el nivel antes de jugarlo.

## Editor y runtime

**Edit · Gameplay logic** (`L`) ofrece cuatro vistas: flags, eventos,
secuencias y bindings de triggers. Todas las modificaciones pasan por el
historial normal y participan en undo/redo. Los pasos anidados se editan con
controles tipados, nunca como código libre.

Los eventos declarados aparecen también en **Edit · Character states**. Una
acción `emitEvent` puede provocar una transición o cambio de forma en el mismo
tick. Preview web y runtime C++ implementan el mismo orden y validan las mismas
referencias cruzadas.

## Límites deliberados

El registro de acciones es cerrado. Nuevas capacidades se incorporan mediante
acciones tipadas; no se añadirá una acción de “ejecutar script”. Así
los proyectos siguen siendo portables, validables y equivalentes entre web y
C++.
