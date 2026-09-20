Continúa la tarea 44 de `DEVELOPMENT_PLAN.md` en `/home/plopez/proj/rick2`,
por un único bloque revisable. Lee `docs/TASK_44_HANDOFF.md`,
`docs/TASK_44_PHASE1_CONVERSION.md` y `docs/CAMELOT_VALIDATION.md`.
Comprueba `git status --short`, rama y HEAD antes de actuar. Task 44 fase 1 fue
aceptada y autorizada para commit antes de iniciar la fase 2.

Regenera el archivo antes de probar:

```bash
python3 tools/convert_camelot_phase1.py --output /tmp/camelot-phase-1.rick2-project
```

La revisión de la fase 1 queda cerrada. Se aceptaron las correcciones de caja
de espada, muerte diferenciada, música inicial en bucle y bloqueo de la rana
sobre la piedra estrecha. La
captura mostró `rana-cayendo-derecha` en `x=3140, y=1344`: el aterrizaje veía
la baldosa situada bajo el centro de su cuerpo ancho, pero el estado de suelo
solo miraba las esquinas. Web y C++ recorren ahora todo el borde inferior. La
esquina superior izquierda de `--debug` conserva el estado declarado y las
coordenadas exactas para la revisión.

La paleta, los overlays y la geometría de pendientes web/C++ también fueron
aceptados tras probarlos con una modificación de la fase 1. La fase 1 original
no contiene pendientes y su archivo regenerado permanece idéntico.

`STATE_TRANSITIONS_DEFERRED` sigue siendo una pérdida real limitada a los
estados históricos de animación. No continúes ahora con esas transiciones.
Reabre los estados al convertir
la primera fase posterior que contenga un ejemplo real: la auditoría encontró
81 pendientes derechas en la fase 3 y 23 izquierdas en la fase 4. El siguiente
bloque revisable debe iniciar la extensión determinista hacia la fase 2, que
solo usa colisiones 0/1: audita su inventario histórico y añade únicamente la
base de mapa/nivel necesaria, dejando sus entidades, scripts y presentación
para bloques posteriores según lo que revele esa auditoría.

La conversión reproducible y schema, las 20 suites web, el test focal de la
máquina de estados, el archivo nativo y la compilación limpia oficial pasaron.
El archivo regenerado tiene SHA-256
`9e844eff37790aa10ead2e8b0aa4662d764fdbe7bfadfff2de268e35d757b270`;
regénéralo antes de nuevas pruebas. La ejecución nativa alcanza el error
esperable `failed to create display` en este entorno headless.

Mantén el parsing histórico en `tools/`. No portes Allegro 4 ni añadas nombres
históricos como discriminadores del runtime. Conserva compatibilidad web/C++.
Tras cambios nativos, ejecuta `make -C bin clean && make -C bin -j2`.
Trabaja en un bloque revisable y no hagas un commit adicional sin autorización.
