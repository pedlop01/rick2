CXX ?= g++
CXXFLAGS ?= -O3 -std=c++11
DEPFLAGS = -MMD -MP

SOURCES = world keyboard camera camera_view sprite animation character player enemy \
	colbox timer object platform item laser shoot bomb static_object block hazard \
	checkpoint trigger enemy_ia sound_handler json_level_loader \
	character_state_machine gameplay_program game_shell project_archive \
	presentation_state resource_cache combat main
OBJECTS = $(addsuffix .o,$(SOURCES))
DEPS = $(OBJECTS:.o=.d)

PLATFORM := $(shell uname -o)
ifeq ($(PLATFORM),GNU/Linux)
LDLIBS = $(shell pkg-config --libs allegro-5 allegro_primitives-5 allegro_image-5 allegro_font-5 allegro_ttf-5 allegro_audio-5 allegro_acodec-5) -lz
else
LDLIBS = -static -lallegro-5.0.10-monolith-md -lz
endif

rick2: $(OBJECTS)
	$(CXX) -o $@ $(OBJECTS) $(CXXFLAGS) $(LDLIBS)

%.o: ../src/%.cpp
	$(CXX) $(CXXFLAGS) $(DEPFLAGS) -c $< -o $@

-include $(DEPS)

clean:
	rm -f $(OBJECTS) $(DEPS) rick2
