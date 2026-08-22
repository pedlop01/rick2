#include "sound_handler.h"

SoundHandler::SoundHandler() {
  playing_music_id = 0;
}

SoundHandler::~SoundHandler() {

}

void SoundHandler::InitializeSounds() {
  const std::vector<std::string>& configured_music = GetLevelMusicFiles();
  const std::vector<std::string>& configured_effects = GetLevelEffectFiles();
  const char* music_file = configured_music.empty()
                               ? "../music/level1.ogg"
                               : configured_music[0].c_str();
  music[0] = al_load_sample(music_file);
  if (!music[0]) {
    throw DataLoadError(std::string("Cannot load audio '") + music_file + "'");
  }
  music_instance[0] = al_create_sample_instance(music[0]);
  if (!music_instance[0] ||
      !al_attach_sample_instance_to_mixer(music_instance[0],
                                          al_get_default_mixer())) {
    throw DataLoadError("Cannot create the music playback instance");
  }

  const char* fx_files[] = {"../fx/walk.wav", "../fx/zap.wav",
                            "../fx/kickbomb.wav", "../fx/waaaaaa1.wav",
                            "../fx/bonus.wav", "../fx/ring.wav",
                            "../fx/explosion.wav"};
  if (!configured_effects.empty() && configured_effects.size() != 7) {
    throw DataLoadError("Level audio must define exactly 7 sound effects");
  }
  for (int index = FX_WALK; index <= FX_EXPLOSION; ++index) {
    const char* effect_file = configured_effects.empty()
                                  ? fx_files[index]
                                  : configured_effects[index].c_str();
    fx[index] = al_load_sample(effect_file);
    if (!fx[index]) {
      throw DataLoadError(std::string("Cannot load audio '") +
                          effect_file + "'");
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
