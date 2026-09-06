#include "sound_handler.h"

SoundHandler::SoundHandler() {
  playing_music_id = -1;
}

SoundHandler::~SoundHandler() {
  for (std::size_t index = 0; index < music.size(); ++index) {
    if (music_instance[index]) {
      al_stop_sample_instance(music_instance[index]);
      al_destroy_sample_instance(music_instance[index]);
    }
  }
}

void SoundHandler::InitializeSounds() {
  for (std::size_t index = 0; index < music_instance.size(); ++index) {
    if (music_instance[index]) {
      al_stop_sample_instance(music_instance[index]);
      al_destroy_sample_instance(music_instance[index]);
    }
  }
  music_instance.clear();
  playing_music_id = -1;
  const std::vector<std::string>& configured_music = GetLevelMusicFiles();
  const std::vector<std::string>& configured_effects = GetLevelEffectFiles();
  if (configured_music.empty()) {
    throw DataLoadError("Level audio must define at least one music track");
  }
  music.assign(configured_music.size(), SampleResource());
  music_instance.assign(configured_music.size(), nullptr);
  for (std::size_t index = 0; index < configured_music.size(); ++index) {
    music[index] = ResourceCache::Instance().LoadSample(configured_music[index]);
    if (!music[index]) {
      throw DataLoadError(std::string("Cannot load audio '") +
                          configured_music[index] + "'");
    }
    music_instance[index] = al_create_sample_instance(music[index].get());
    if (!music_instance[index] ||
        !al_attach_sample_instance_to_mixer(music_instance[index],
                                            al_get_default_mixer())) {
      throw DataLoadError("Cannot create the music playback instance");
    }
  }

  if (configured_effects.size() != 7) {
    throw DataLoadError("Level audio must define exactly 7 sound effects");
  }
  fx.assign(configured_effects.size(), SampleResource());
  fx_id.resize(configured_effects.size());
  for (int index = FX_WALK; index <= FX_EXPLOSION; ++index) {
    const char* effect_file = configured_effects[index].c_str();
    fx[index] = ResourceCache::Instance().LoadSample(effect_file);
    if (!fx[index]) {
      throw DataLoadError(std::string("Cannot load audio '") +
                          effect_file + "'");
    }
  }
}

void SoundHandler::PlayMusic(int id) {
  if (id < 0 || static_cast<std::size_t>(id) >= music_instance.size()) {
    throw DataLoadError("Invalid initial music index");
  }
  if (playing_music_id >= 0 &&
      al_get_sample_instance_playing(music_instance[playing_music_id])) {
    al_stop_sample_instance(music_instance[playing_music_id]);
  }
  al_play_sample_instance(music_instance[id]);
  playing_music_id = id;
}

void SoundHandler::PlaySound(int id, bool loop) {
  if (id < 0 || static_cast<std::size_t>(id) >= fx.size()) {
    return;
  }
  if (loop) {
    al_play_sample(fx[id].get(), 1.0, 0.0, 1.0, ALLEGRO_PLAYMODE_LOOP, &fx_id[id]);
  } else {
    al_play_sample(fx[id].get(), 1.0, 0.0, 1.0, ALLEGRO_PLAYMODE_ONCE, &fx_id[id]);
  }
}

void SoundHandler::StopSound(int id) {
  if (id < 0 || static_cast<std::size_t>(id) >= fx_id.size()) {
    return;
  }
  al_stop_sample(&fx_id[id]);
}
