<!-- Replaced by the current phase-3 handoff below. -->
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


La fase 2 se convierte ya mediante `tools/convert_camelot.py` como segundo nivel de una campaña conjunta. Antes de ampliar la fase 3, revisa `docs/TASK_44_HANDOFF.md` y `tests/camelot_phase2_conversion_test.py`; conserva el flujo de televisor, los 18 enemigos acuáticos, los cuatro checkpoints y los dos planos de agua. El bloque está implementado sin commit y espera la revisión global acordada.

## Estado actual de fase 3

Las fases 1 y 2 están aceptadas y comprometidas en `cc622c6`. La fase 3 está
implementada en el árbol de trabajo y espera revisión nativa. Regenera el
proyecto combinado con `python3 tools/convert_camelot.py --output
/tmp/camelot.rick2-project`.

La fase 3 contiene el mapa 236x24, 81 marcas históricas `stairs_right`, dos planos de
parallax, seis checkpoints, dos cámaras, 16 enemigos y el flujo completo de
recogida y entrega de Coca-Cola. Conserva la inmunidad a espada de la planta.
La pérdida `PHASE3_ENEMY_RESET_SCRIPT_DEFERRED` cubre las zonas de
reinicio/activación de los enemigos 7 y 16. El dragón queda fijo y su fuego se
compone con cinco objetos animados tras la espera histórica de 250 ticks. La
entrega y el objetivo requieren tocar la franja de suelo en `y=703`.
Las marcas `stairs_right` se emiten sin colisión porque el grafo original no
consume esa señal; convertirlas en rampas generaba escaleras invisibles.
Las zonas de agua/muerte disparan `killed` al entrar. Las dos formas de Camelot
usan `ceilingEndsAscent: false`: un techo bloquea el desplazamiento vertical,
pero el salto conserva el ascenso hasta `jumpAscentTicks` (46 para el guerrero,
48 para la rana), aunque tampoco pueda avanzar horizontalmente. Rick conserva
el comportamiento previo por defecto.
El archivo regenerado tiene SHA-256
`31b3ed320e3663f557657c3596cbe892aad354cefb6c96dd97113dc19578f332`.
No hagas commit sin autorización.

## Estado actual de fase 4

La fase 3 fue aceptada y quedó cerrada en `53b704c`. La fase 4 está convertida
como cuarto nivel de la campaña y fue aceptada en revisión nativa. Incluye el mapa de
castillo 128x72, las 23 pendientes izquierdas, el parallax, seis checkpoints,
31 enemigos y el flujo de recogida y entrega del teléfono. La entrega y el
objetivo exigen tocar el suelo en `y=703`. Regenera el paquete con
`python3 tools/convert_camelot.py --output /tmp/camelot.rick2-project` y prueba
`/tmp/camelot-phase4-review/levels/phase-4/level.json`. El archivo combinado actual tiene SHA-256
`ceb0485cd6e3732496aa8b926f615bcbfeed0e7afc6d6421de4d0e759f2669d8`.

## Próximo bloque tras las cuatro fases

Las cuatro fases jugables están aceptadas y comprometidas hasta `e124e05`.
La revisión manual confirma expresamente que las escaleras funcionan bien y
que las pendientes izquierdas reales de fase 4 se recorren correctamente. Las
marcas decorativas `stairs_right` de fase 3 deben seguir sin colisión.

Task 44 continúa abierta únicamente para completar el final histórico de
Camelot, auditar los diálogos/mensajes y resolver las dos pérdidas declaradas:
las zonas de activación/reset de los enemigos 7 y 16 de fase 3 y el residuo de
la gramática histórica de estados. Empieza por una auditoría acotada del final
y los textos antes de ampliar contratos del runtime.

El postprocesado de agua de fase 2 está implementado mediante el contrato
genérico `horizontalStripDisplacement`, con 48 franjas, desplazamiento máximo
de 4 píxeles y periodo de 25 ms en web y C++. Espera revisión nativa; la pérdida
`LEGACY_PRESENTATION_FILTERS_DEFERRED` ya no se emite.

La última pérdida, `STATE_TRANSITIONS_DEFERRED`, está resuelta y aceptada. La
auditoría fija las 48 transiciones históricas y convierte
el único flujo de pendiente alcanzable mediante la señal genérica
`onSlopeLeft`; los aliases `RIGHT` no tienen transiciones en el original. El
paquete regenerado tiene `losses: []`. La regresión de cierre y la revisión
manual fueron aceptadas; Task 44 quedó autorizada para su commit final y se
marca `Completada` junto con él.
