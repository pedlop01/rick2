# Presentación declarativa

El bloque opcional `presentation` contiene recursos visuales y narrativos de un
nivel. No ejecuta código: las secuencias y triggers del programa de gameplay
activan un catálogo cerrado de acciones, validado antes de iniciar el nivel.

```json
{
  "presentation": {
    "parallaxLayers": [{
      "id": "stars", "image": "assets/stars.png", "plane": "back",
      "factorX": 0.2, "factorY": 0.1,
      "offsetX": 0, "offsetY": 0,
      "repeatX": true, "repeatY": true, "opacity": 1
    }],
    "messages": [{
      "id": "warning", "speaker": "HQ", "text": "Danger ahead",
      "durationTicks": 100
    }],
    "effects": [{
      "id": "flash", "kind": "flash", "color": "#ffffff",
      "durationTicks": 12
    }]
  }
}
```

`plane` decide si la capa se dibuja detrás o delante del mundo. Los factores
indican qué fracción del desplazamiento de cámara recorre la imagen; `0` queda
fijo a pantalla y `1` acompaña al mundo. Repetición, offsets y opacidad son
opcionales. Las rutas se resuelven respecto al JSON del nivel.

Los mensajes con duración `0` permanecen hasta `hideMessage`. Los demás se
ocultan al cumplirse su duración. Los efectos disponibles son `fadeIn`,
`fadeOut` y `flash`, con color hexadecimal `#rrggbb`.

## Acciones

- `setCamera`: selecciona `follow` o una posición `fixed` (`x`, `y`) y suaviza
  el cambio durante `durationTicks`; con cero ticks el cambio es inmediato.
- `showMessage`: muestra el mensaje indicado por `message`.
- `hideMessage`: oculta el mensaje activo.
- `playEffect`: reproduce el efecto indicado por `effect`.

El editor las expone en **Edit · Gameplay logic**: la pestaña **Presentation**
mantiene los catálogos y los editores de secuencia/trigger ofrecen las acciones.
El preview web y el runtime C++ comparten semántica y reloj de 50 Hz. IDs
duplicados, assets ausentes y referencias rotas bloquean la exportación.
