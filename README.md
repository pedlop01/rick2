# Rick Dangerous 2 Remake

Rick Dangerous 2 remake game

## Build and run on Linux

The game currently uses Allegro 5 and `pkg-config`. On Debian/Ubuntu, install a
C++ compiler, Make, pkg-config and the Allegro development packages required by
the modules listed in `bin/Makefile`.

Build from a clean state:

```sh
cd bin
make clean
make -j2
```

Run the executable from `bin/`. Asset paths are currently relative to that
directory:

```sh
./rick2
```

Controls implemented by the current prototype include the arrow keys, Space,
`A`, `K`, `M`, `Z` and Escape.

## Diagnostic build

To check the initial load with AddressSanitizer and UndefinedBehaviorSanitizer:

```sh
g++ -std=c++11 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined -Wall -Wextra -Werror=return-type \
  src/*.cpp -o /tmp/rick2-sanitized \
  $(pkg-config --cflags --libs allegro-5 allegro_primitives-5 \
    allegro_image-5 allegro_font-5 allegro_ttf-5 allegro_audio-5 \
    allegro_acodec-5)

cd bin
/tmp/rick2-sanitized
```

The current Makefile does not track header dependencies. Until the build system
is modernized, use `make clean` after changing a header to avoid linking stale
object files.

The fixed-timestep clock has a standalone timing check:

```sh
g++ -std=c++11 -pthread tests/timer_test.cpp src/timer.cpp \
  -o /tmp/rick2-timer-test
/tmp/rick2-timer-test
```
