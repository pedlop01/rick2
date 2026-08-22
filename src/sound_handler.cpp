#include "sound_handler.h"

SoundHandler::SoundHandler() {
  playing_music_id = 0;
}

SoundHandler::~SoundHandler() {

}

void SoundHandler::InitializeSounds() {
  music[0] = al_load_sample("../music/level1.ogg");
  if (!music[0]) {
    throw DataLoadError("Cannot load audio '../music/level1.ogg'");
  }
  music_instance[0] = al_create_sample_instance(music[0]);
  if (!music_instance[0] ||
      !al_attach_sample_instance_to_mixer(music_instance[0],
                                          al_get_default_mixer())) {
    throw DataLoadError("Cannot create the music playback instance");
  }

  fx[FX_WALK] = al_load_sample("../fx/walk.wav");
  fx[FX_SHOT] = al_load_sample("../fx/zap.wav");
  fx[FX_BOMB] = al_load_sample("../fx/kickbomb.wav");
  fx[FX_SCREAM] = al_load_sample("../fx/waaaaaa1.wav");
  fx[FX_BONUS] = al_load_sample("../fx/bonus.wav");
  fx[FX_RING] = al_load_sample("../fx/ring.wav");
  fx[FX_EXPLOSION] = al_load_sample("../fx/explosion.wav");

  const char* fx_files[] = {"../fx/walk.wav", "../fx/zap.wav",
                            "../fx/kickbomb.wav", "../fx/waaaaaa1.wav",
                            "../fx/bonus.wav", "../fx/ring.wav",
                            "../fx/explosion.wav"};
  for (int index = FX_WALK; index <= FX_EXPLOSION; ++index) {
    if (!fx[index]) {
      throw DataLoadError(std::string("Cannot load audio '") +
                          fx_files[index] + "'");
    }
  }
}

void SoundHandler::PlayMusic(int id) {
  if (al_get_sample_instance_playing(music_instance[playing_music_id])) {
    al_stop_sample_instance(music_instance[playing_music_id]);
  }
  al_play_sample_instance(music_instance[id]);
  playing_music_id = id;
}

void SoundHandler::PlaySound(int id, bool loop) {
  if (loop) {
    al_play_sample(fx[id], 1.0, 0.0, 1.0, ALLEGRO_PLAYMODE_LOOP, &fx_id[id]);
  } else {
    al_play_sample(fx[id], 1.0, 0.0, 1.0, ALLEGRO_PLAYMODE_ONCE, &fx_id[id]);
  }
}

void SoundHandler::StopSound(int id) {
  al_stop_sample(&fx_id[id]);
}
