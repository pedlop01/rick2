PLATFORM := $(shell uname -o)
ifeq  ($(PLATFORM),GNU/Linux)
rick2: ../src/main.cpp world.o keyboard.o camera.o camera_view.o sprite.o animation.o character.o player.o enemy.o colbox.o timer.o object.o platform.o item.o laser.o shoot.o bomb.o static_object.o block.o hazard.o checkpoint.o trigger.o enemy_ia.o sound_handler.o pugixml.o
	g++ -o rick2 ../src/main.cpp world.o keyboard.o camera.o camera_view.o sprite.o animation.o character.o player.o enemy.o colbox.o timer.o object.o platform.o item.o laser.o shoot.o bomb.o static_object.o block.o hazard.o checkpoint.o trigger.o enemy_ia.o sound_handler.o pugixml.o -O3 -std=c++11 `pkg-config --libs allegro-5 allegro_primitives-5 allegro_image-5 allegro_font-5 allegro_ttf-5 allegro_audio-5 allegro_acodec-5`
else
rick2: ../src/main.cpp world.o keyboard.o camera.o camera_view.o sprite.o animation.o character.o player.o enemy.o colbox.o timer.o object.o platform.o item.o laser.o shoot.o bomb.o static_object.o block.o hazard.o checkpoint.o trigger.o enemy_ia.o sound_handler.o pugixml.o
	g++ -o rick2 ../src/main.cpp world.o keyboard.o camera.o camera_view.o sprite.o animation.o character.o player.o enemy.o colbox.o timer.o object.o platform.o item.o laser.o shoot.o bomb.o static_object.o block.o hazard.o checkpoint.o trigger.o enemy_ia.o sound_handler.o pugixml.o -O3 -std=c++11 -static -lallegro-5.0.10-monolith-md
endif

world.o: ../src/world.cpp
	g++ -std=c++11 -c ../src/world.cpp

keyboard.o: ../src/keyboard.cpp
	g++ -c ../src/keyboard.cpp

camera.o: ../src/camera.cpp
	g++ -c ../src/camera.cpp

camera_view.o: ../src/camera_view.cpp
	g++ -c ../src/camera_view.cpp

sprite.o: ../src/sprite.cpp
	g++ -c ../src/sprite.cpp

animation.o: ../src/animation.cpp
	g++ -c ../src/animation.cpp

character.o: ../src/character.cpp
	g++ -std=c++11 -c ../src/character.cpp

player.o: ../src/player.cpp
	g++ -c ../src/player.cpp

enemy.o: ../src/enemy.cpp
	g++ -c ../src/enemy.cpp

colbox.o: ../src/colbox.cpp
	g++ -c ../src/colbox.cpp

timer.o: ../src/timer.cpp
	g++ -c ../src/timer.cpp

object.o: ../src/object.cpp
	g++ -c ../src/object.cpp

platform.o: ../src/platform.cpp
	g++ -c ../src/platform.cpp

item.o: ../src/item.cpp
	g++ -c ../src/item.cpp

laser.o: ../src/laser.cpp
	g++ -c ../src/laser.cpp

shoot.o: ../src/shoot.cpp
	g++ -c ../src/shoot.cpp

bomb.o: ../src/bomb.cpp
	g++ -c ../src/bomb.cpp

static_object.o: ../src/static_object.cpp
	g++ -c ../src/static_object.cpp

block.o: ../src/block.cpp
	g++ -c ../src/block.cpp

hazard.o: ../src/hazard.cpp
	g++ -c ../src/hazard.cpp

checkpoint.o: ../src/checkpoint.cpp
	g++ -c ../src/checkpoint.cpp

trigger.o: ../src/trigger.cpp
	g++ -c ../src/trigger.cpp

enemy_ia.o: ../src/enemy_ia.cpp
	g++ -c ../src/enemy_ia.cpp

sound_handler.o: ../src/sound_handler.cpp
	g++ -c ../src/sound_handler.cpp

pugixml.o: ../src/pugixml.cpp
	g++ -c ../src/pugixml.cpp
