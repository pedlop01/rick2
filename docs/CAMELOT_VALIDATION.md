# Camelot Warriors como proyecto de validación

## Objetivo

Camelot Warriors no se portará mediante excepciones con nombres propios. Se usa
como segundo juego real para comprobar que Rick2 Engine puede describir un
plataformas distinto. El código histórico situado en
`/home/plopez/proj/camelot/game` es una especificación ejecutable y una fuente
de fixtures; no será una dependencia del nuevo juego.

Cada diferencia se asigna a una de estas capas:

- **Núcleo genérico**: capacidad reutilizable que deben compartir web y C++.
- **Behavior de juego**: regla registrada y configurable, sin modificar el
  núcleo ni comprobar el nombre del juego.
- **Conversión de datos**: traducción reproducible desde el formato histórico
  al proyecto JSON; no añade reglas al runtime.

## Escena vertical elegida

La primera fase es el corte de validación. Es la opción más pequeña que reúne
los sistemas que realmente diferencian Camelot de Rick:

1. comenzar como guerrero y conservar caminar, saltar, caer y escaleras;
2. sacar la espada, golpear y entrar en guardia mediante su máquina de estados;
3. recoger la bombilla y mostrar el mensaje asociado;
4. activar la secuencia de bombilla y rayo en paralelo, seguida de la explosión;
5. transformarse en rana y cambiar estados, animaciones, forma y movimiento;
6. atravesar una zona que mata al guerrero pero permite progresar a la rana;
7. completar la fase mediante el flag de salida;
8. recorrer las seis zonas de cámara y comprobar planos traseros, mapa, objetos,
   personajes, tiles delanteros y plano delantero;
9. reproducir música y efectos relevantes de la escena.

Evidencias históricas principales:

- `data/levels/phase1.txt`: punto inicial, forma inicial y recursos de fase.
- `data/characters/warrior_def_states.txt`: estados, condiciones y acciones.
- `data/characters/warrior.txt`: asociación de estados con animaciones y formas.
- `data/scripts/phase1.txt`: doce zonas, flags y transformación.
- `data/machinimia/phase1.txt`: composición paralela/secuencial de la escena.
- `data/levels/scroll_zones_phase1.txt`: seis regiones de cámara.
- `game.cpp`: orden de render y scroll delantero/trasero.

El corte no exige inicialmente menú, campaña completa, las otras tres fases ni
compatibilidad binaria con Allegro 4. Esas partes pertenecen a las tareas 35-38
y 44.

## Comparación de capacidades

| Capacidad | Camelot histórico | Rick2 Engine actual | Mejor base | Tratamiento |
|---|---|---|---|---|
| Proyecto portable y validado | Ficheros de texto enlazados por rutas y `assert` | JSON versionado, schema, diagnósticos y ZIP offline | Rick2 | Conversión de datos |
| Editor visual | Editor histórico limitado y formatos separados | Tiles, entidades, assets, inspector, historial y preview integrado | Rick2 | Reutilizar |
| Paridad web/C++ | Solo runtime C++/Allegro | Núcleo configurable y runtimes web/C++ | Rick2 | Núcleo genérico |
| Estados de personaje | Grafo declarativo con condiciones de tecla, colisión, tiempo, distancia y estado previo | Controlador configurable, pero flujo de Rick todavía codificado | Camelot | Núcleo genérico, tarea 40 |
| Formas del personaje | Guerrero y rana con estados y animaciones propias | Un único perfil de Rick | Camelot | Núcleo genérico, tarea 40 |
| Combate | Espada, golpe, guardia y contacto con enemigos | Disparo, bombas y contacto específicos de Rick | Camelot en melee; Rick en proyectiles | Núcleo + behaviors, tarea 43 |
| Flags y scripts espaciales | Tabla de símbolos y zonas con entradas/salidas | Triggers y targets tipados, sin flags generales | Camelot conceptualmente | Núcleo genérico seguro, tarea 41 |
| Secuencias | Pasos secuenciales y paralelos sobre objetos | Acciones y triggers, sin compositor general | Camelot | Núcleo genérico, tarea 41 |
| Cámara | Regiones y desplazamiento normal/rápido en ambos ejes | Camera views, seguimiento y cámara libre de depuración | Empate con fortalezas distintas | Núcleo genérico, tarea 42 |
| Presentación | Planos de scroll traseros y delanteros, mensajes y postprocesado | Fondo, tiles y front tiles; mejor inspección | Camelot | Núcleo genérico, tarea 42 |
| IA | Varios movimientos, vuelo, eje vertical y dragón | Walker y chaser con navegación por escaleras | Camelot en variedad; Rick en depuración | Behaviors registrados, tarea 43 |
| Audio | Sonidos con loop habilitable y música por fase | Música intro/loop y efectos previsualizables | Rick2 | Reutilizar y convertir |
| Seguridad y pruebas | Punteros, límites fijos y comprobaciones mediante `assert` | Ownership más seguro, validación previa y regresiones | Rick2 | No portar la implementación antigua |

## Matriz de carencias y aceptación

| ID | Carencia revelada por la fase 1 | Capa | Destino | Criterio de aceptación |
|---|---|---|---|---|
| C1 | Grafo de estados declarativo | Núcleo genérico | 40 | Web y C++ ejecutan el mismo JSON; Rick conserva sus movimientos y Camelot reproduce las transiciones del fixture. |
| C2 | Perfiles o formas intercambiables | Núcleo genérico | 40 | Una acción cambia guerrero↔rana, incluyendo estados permitidos, animación, colisión y movimiento, sin recrear el mundo. |
| C3 | Espada, guardia y daño cuerpo a cuerpo | Núcleo + behavior | 43 | Hitboxes activas por frame dañan o bloquean según configuración y se visualizan en el editor. |
| C4 | Flags tipados y condiciones | Núcleo genérico | 41 | Los scripts leen y escriben flags declarados; nombres, tipos y referencias inválidos fallan al validar. |
| C5 | Acciones registradas | Núcleo + behavior | 41 | Transformar, mostrar mensaje, activar objeto, matar y completar nivel son acciones registradas, no código arbitrario. |
| C6 | Secuencias seriales/paralelas | Núcleo genérico | 41 | Bombilla y rayo terminan en paralelo antes de iniciar explosión; reset y step son deterministas. |
| C7 | Transiciones y regiones de cámara | Núcleo genérico | 42 | Las seis regiones mantienen al personaje encuadrado y permiten una transición configurable y previsualizable. |
| C8 | Parallax anterior y posterior | Núcleo genérico | 42 | Ambos planos usan factores X/Y declarados y respetan el orden de render en web y C++. |
| C9 | Mensajes y presentación | Núcleo + datos | 42 | Una acción muestra contenido localizado y el preview permite avanzar/cerrar el mensaje. |
| C10 | Nuevos patrones enemigos | Behaviors de juego | 43 | Al menos un enemigo terrestre y uno aéreo de fase 1 se describen mediante behaviors registrados. |
| C11 | Importación del legado | Conversión de datos | 44 | Un conversor produce siempre el mismo JSON y assets desde los ficheros de fase 1, con informe de pérdidas. |

## Invariantes arquitectónicos

- El schema no contiene `camelot`, `rick`, `frog`, `warrior` ni nombres de
  niveles como discriminadores de lógica.
- Los runtimes no ejecutan JavaScript ni expresiones de texto procedentes del
  proyecto. Condiciones y acciones pertenecen a registros cerrados y tipados.
- El editor utiliza el mismo contrato que los runtimes y permite inspeccionar,
  validar, deshacer y previsualizar las nuevas capacidades.
- La conversión conserva IDs mediante una tabla explícita y emite advertencias
  cuando una construcción antigua no tiene equivalencia.
- Cada capacidad nueva incorpora al menos un fixture genérico, uno de Camelot y
  una regresión de Rick cuando pueda afectarlo.

## Definition of done de la tarea 39

- La escena vertical y sus límites están acordados.
- Todas sus carencias están clasificadas en la matriz anterior.
- Las tareas 40-44 cubren cada carencia sin excepciones específicas por juego.
- Se ha identificado la evidencia histórica necesaria para construir fixtures.
- La matriz sirve como contrato de aceptación; todavía no requiere implementar
  ni convertir la fase.
