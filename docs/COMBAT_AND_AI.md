# Contrato de combate e IA

La tarea 43 separa tres conceptos que los motores antiguos mezclaban dentro de
las clases de personaje: geometría de combate, estado del combatiente y decisión
de movimiento. Ninguno depende del nombre del juego o de un asset concreto.

## Combate

El bloque opcional `combat` declara tipos de daño y perfiles reutilizables. Un
perfil contiene facción, salud, invulnerabilidad tras recibir daño y tres clases
de cajas:

- `hurtboxes`: zonas que pueden recibir golpes;
- `attacks`: zonas activas únicamente en determinados estados y frames;
- `guards`: zonas que bloquean tipos de daño, opcionalmente sólo hacia el lado
  al que mira el personaje.

Las coordenadas son relativas al sprite mirando a la derecha. El runtime las
refleja horizontalmente al mirar a la izquierda. Una activación de ataque sólo
puede impactar una vez por objetivo salvo que `hitOnce` sea `false`. Salud,
invulnerabilidad, daño y knockback se calculan en ticks y píxeles, igual que el
resto del formato.

Los perfiles se referencian mediante `player.combatProfile`,
`runtimeProfile.characterForms.forms[].combatProfile` o
`entities.enemies[].combatProfile`. Una forma puede así cambiar simultáneamente
animación, física y capacidades de combate.

## Behaviors enemigos

`entities.enemies[].behavior` es una unión discriminada y cerrada:

- `patrol`: movimiento terrestre y giro en paredes o bordes;
- `chase`: persecución con detección configurable y escaleras opcionales;
- `flyPatrol`: vuelo horizontal, vertical o en ambos ejes;
- `verticalPatrol`: recorrido vertical con bucle opcional;
- `jumper`: saltos periódicos con componente horizontal;
- `bossSequence`: patrón compuesto mediante una secuencia declarativa.

Los campos históricos `ia_type` continúan aceptándose durante la migración de
Rick: `walker` equivale a `patrol` y `chaser` a `chase`. Los nuevos proyectos
deben usar `behavior`; la retirada del formato histórico requiere una migración
de versión y no se hará silenciosamente. Cada enemigo declara exactamente una
de las dos ramas, por lo que no puede haber dos fuentes de decisión simultáneas.

## Editor y diagnóstico

La sección **Profile → Combat profiles** permite crear el catálogo, editar los
tipos de daño, salud, facción y las cajas numéricas. El selector de estado se
alimenta de las definiciones de personaje disponibles. Durante la preview, el
menú **Test** contiene una leyenda y controles independientes para hurtboxes
cian, ataques rojos y guardias azules. `Bounds` sigue controlando el overlay de
depuración completo.

El runtime C++ muestra las mismas cajas con `--debug`. Web y C++ convierten el
tick transcurrido de la animación a frame visual antes de filtrar una ventana y
mantienen una identidad de activación separada del tick global.

El fixture `tests/fixtures/combat_and_ai.json` documenta espada, guardia y dos
enemigos derivados de la escena de validación: uno terrestre y otro aéreo. Es
un fragmento de datos reutilizable y no introduce nombres ni ramas específicas
del juego histórico.

## Límites

El registro no acepta nombres de clases ni scripts. Un nuevo algoritmo necesita
un nuevo behavior tipado, implementación equivalente web/C++ y pruebas. La
primera fase de Camelot validará espada, guardia, enemigo terrestre y enemigo
aéreo; el dragón se expresará como secuencia de boss, no como rama especial.
