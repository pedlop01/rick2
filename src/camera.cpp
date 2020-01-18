#include "camera.h"
#include "enemy.h"

Camera::Camera() {
  pos_x = 0;
  pos_y = 0;
  pixels_width = 0;
  pixels_height = 0;
  tiles_width = 0;
  tiles_height = 0;
  tile_width = 0;
  tile_height = 0;
  view_x = 0;
  view_y = 0;
  view_width = 0;
  view_height = 0;
  camera_bitmap = 0;
  screen = 0;
  current_camera_view = 0;
  prev_camera_view = 0;
  steps_drawing = 0;
}

Camera::~Camera() {

}

void Camera::InitCamera(int _pos_x, int _pos_y, int _pixels_width, int _pixels_height, World* _map, ALLEGRO_BITMAP* _screen) {
  map = _map;

  pixels_width = _pixels_width;
  pixels_height = _pixels_height;

  tiles_width = pixels_width / map->GetTilesetTileWidth();
  tiles_height = pixels_height / map->GetTilesetTileHeight();

  tile_width = pixels_width / tiles_width;
  tile_height = pixels_height / tiles_height;

  // REVISIT: Need to pass map
  // REVISIT: by default passing full size of map
  view_x = 0;
  view_y = 0;
  view_width = map->GetMapWidth()*tile_width;
  view_height = map->GetMapHeight()*tile_height;

  // Using methods to set x and y because they control the limits of the camera in the world
  // These methods need to be call after initializing the other width parameters
  SetPosX(_pos_x);
  SetPosY(_pos_y);

  // If bitmap exists, then destroy it first
  al_destroy_bitmap(camera_bitmap);
  camera_bitmap = al_create_bitmap(pixels_width, pixels_height);

  // Finally, link the screen bitmap
  screen = _screen;
}

void Camera::PositionBasedOnPlayer(Character* player) {
  int camera_width  = (view_width > pixels_width ? pixels_width : view_width);
  int camera_height = (view_height > pixels_height ? pixels_height : view_height);

  // Do not move the camera when DYING
  if (player->GetState() == CHAR_STATE_DYING) return;
  SetPosX(player->GetCorrectedPosX() - camera_width/2);
  SetPosY(player->GetCorrectedPosY() - camera_height/2);
}

void Camera::SetPosX(int _pos_x) {
  int camera_width = (view_width > pixels_width ? pixels_width : view_width);
  if (_pos_x < view_x) {
    pos_x = view_x;
  } else if (_pos_x > (view_x + view_width - camera_width)) {
    pos_x = (view_x + view_width - camera_width);
  } else {
    pos_x = _pos_x;
}
}

void Camera::SetPosY(int _pos_y) {
  int camera_height = (view_height > pixels_height ? pixels_height : view_height);
  if (_pos_y < view_y) {
    pos_y = view_y;
  } else if (_pos_y > (view_y + view_height - camera_height)) {
    pos_y = (view_y + view_height - camera_height);
  } else {
    pos_y = _pos_y;
  }
}

void Camera::SetPixelsWidth(int _pixels_width) {
  pixels_width = _pixels_width;
}

void Camera::SetPixelsHeight(int _pixels_height) {
  pixels_height = _pixels_height;
}

void Camera::SetTilesWidth(int _tiles_width) {
  tiles_width = _tiles_width;
}

void Camera::SetTilesHeight(int _tiles_height) {
  tiles_height = _tiles_height;
}

void Camera::DrawBackTiles(World* world, Character* player, ALLEGRO_FONT *font) {
  Tile* tile;
  int left_up_x;
  int left_up_y;
  ALLEGRO_BITMAP* tileset_bitmap;

  // Compute x and y corrections to draw world
  int correct_x = pos_x % tile_width;
  int correct_y = pos_y % tile_height;

  // Get the tileset bitmap
  tileset_bitmap = map->GetWorldImage();

  // Check if it is needed to add an extra tile
  int tiles_width_corrected = (pos_x % tile_width) ? tiles_width + 1 : tiles_width;
  int tiles_height_corrected = (pos_y % tile_height) ? tiles_height + 1 : tiles_height;

  int tile_y = pos_y / tile_height;
  for (int y = 0; y < tiles_height_corrected; y++) {

    int tile_x = pos_x / tile_width;
    for (int x = 0; x < tiles_width_corrected; x++) {

      tile = map->GetTile(tile_x, tile_y);
      if (tile->GetValue() != 0) {
        left_up_x = tile->GetLeftUpX();
        left_up_y = tile->GetLeftUpY();

        int dest_x = x*tile_width - correct_x;
        int dest_y = y*tile_height - correct_y;
    
        if ((dest_x < view_width) && (dest_y < view_height)) {        
          al_draw_bitmap_region(tileset_bitmap,
                                left_up_x,
                                left_up_y,
                                tile_width,
                                tile_height,
                                dest_x,
                                dest_y,
                                0);
        }
      }
      tile_x++;
    }
    tile_y++;
  }

}

void Camera::DrawFrontTiles(World* world, Character* player, ALLEGRO_FONT *font) {
  Tile* tile;
  int left_up_x;
  int left_up_y;
  ALLEGRO_BITMAP* tileset_bitmap;

  // Compute x and y corrections to draw world
  int correct_x = pos_x % tile_width;
  int correct_y = pos_y % tile_height;

  // Get the tileset bitmap
  tileset_bitmap = map->GetWorldImage();

  // Check if it is needed to add an extra tile
  int tiles_width_corrected = (pos_x % tile_width) ? tiles_width + 1 : tiles_width;
  int tiles_height_corrected = (pos_y % tile_height) ? tiles_height + 1 : tiles_height;

  int tile_y = pos_y / tile_height;
  for (int y = 0; y < tiles_height_corrected; y++) {
    int tile_x = pos_x / tile_width;    
    for (int x = 0; x < tiles_width_corrected; x++) {
      tile = map->GetTileFront(tile_x, tile_y);
      if (tile->GetValue() != 0) {
        left_up_x = tile->GetLeftUpX();
        left_up_y = tile->GetLeftUpY();
  
        int dest_x = x*tile_width - correct_x;
        int dest_y = y*tile_height - correct_y;
  
        if ((dest_x < view_width) && (dest_y < view_height)) {        
          al_draw_bitmap_region(tileset_bitmap,
                                left_up_x,
                                left_up_y,
                                tile_width,
                                tile_height,
                                dest_x,
                                dest_y,
                                0);
        }
      }
      tile_x++;
    }
    tile_y++;
  }
}

void Camera::DrawBackObjects(World* world, Character* player, ALLEGRO_FONT *font) {
  list<Object*>* back_objects = world->GetBackObjects();
  for (list<Object*>::iterator it = back_objects->begin() ; it != back_objects->end(); ++it) {
    Object* object = *it;    
    if (object->GetState() != OBJ_STATE_DEAD) {
      // Only draw object in camera
      if (CoordsWithinCamera(object->GetX(),                      object->GetY()) ||
          CoordsWithinCamera(object->GetX() + object->GetWidth(), object->GetY()) ||
          CoordsWithinCamera(object->GetX(),                      object->GetY() + object->GetHeight()) ||
          CoordsWithinCamera(object->GetX() + object->GetWidth(), object->GetY() + object->GetHeight())) {
        ALLEGRO_BITMAP* object_sprite = object->GetCurrentAnimationBitmap();
        al_draw_bitmap(object_sprite,
                       object->GetX() - GetPosX(),
                       object->GetY() - GetPosY(),
                       object->GetCurrentAnimationBitmapAttributes());
#ifdef SHOW_BOUNDING_BOXES
        char buffer[30];
        sprintf(buffer, "%d", object->GetId());
        al_draw_text(font,
                     al_map_rgb(255, 255, 0),
                     object->GetX() - GetPosX(),
                     object->GetY() - GetPosY(),
                     ALLEGRO_ALIGN_LEFT,
                     buffer);
#endif
      }
    }
  }
}

void Camera::DrawFrontObjects(World* world, Character* player, ALLEGRO_FONT *font) {
  // Draw objects
  list<Object*>* objects = world->GetObjects();
  for (list<Object*>::iterator it = objects->begin() ; it != objects->end(); ++it) {
    Object* object = *it;    
    if (object->GetVisible() && (object->GetState() != OBJ_STATE_DEAD)) {
      // Only draw object in camera
      if (CoordsWithinCamera(object->GetX(),                      object->GetY()) ||
          CoordsWithinCamera(object->GetX() + object->GetWidth(), object->GetY()) ||
          CoordsWithinCamera(object->GetX(),                      object->GetY() + object->GetHeight()) ||
          CoordsWithinCamera(object->GetX() + object->GetWidth(), object->GetY() + object->GetHeight())) {
        ALLEGRO_BITMAP* object_sprite = object->GetCurrentAnimationBitmap();
        al_draw_bitmap(object_sprite,
                       object->GetX() - GetPosX(),
                       object->GetY() - GetPosY(),
                       object->GetCurrentAnimationBitmapAttributes());
#ifdef SHOW_BOUNDING_BOXES
        char buffer[30];
        sprintf(buffer, "%d", object->GetTypeId());
        al_draw_text(font,
                     al_map_rgb(255, 255, 0),
                     object->GetX() + object->GetBBX() - GetPosX(),
                     object->GetY() + object->GetBBY() - GetPosY(),
                     ALLEGRO_ALIGN_LEFT,
                     buffer);
        al_draw_rectangle(object->GetX() + object->GetBBX() - GetPosX() + 1,
                          object->GetY() + object->GetBBY() - GetPosY() + 1,
                          object->GetX() + object->GetBBX() + (object->GetBBWidth() - 1) - GetPosX() + 1,
                          object->GetY() + object->GetBBY() + (object->GetBBHeight() - 1) - GetPosY() + 1,
                          al_map_rgb(0xFF, 0xFF, 0xFF), 1.0);
        al_draw_rectangle(object->GetX() + object->GetBBX() - 1 - GetPosX() + 1,
                          object->GetY() + object->GetBBY() - 1 - GetPosY() + 1,
                          object->GetX() + object->GetBBX() + (object->GetBBWidth() - 1) + 1 - GetPosX() + 1,
                          object->GetY() + object->GetBBY() + (object->GetBBHeight() - 1) + 1 - GetPosY() + 1,
                          al_map_rgb(0xFF, 0x0F, 0x0F), 1.0);
#endif
      }
    }
  }
}

void Camera::DrawPlayer(World* world, Character* player, ALLEGRO_FONT *font) {
  // DYING animation requires an special function to scale the sprite
  if ((player->GetState() == CHAR_STATE_DEAD) || (player->GetState() == CHAR_STATE_DYING))
    return;

  ALLEGRO_BITMAP* player_bitmap = player->GetCurrentAnimationBitmap();
  al_draw_bitmap(player_bitmap,
                 player->GetPosX() - GetPosX(),
                 player->GetPosY() - GetPosY(),
                 player->GetCurrentAnimationBitmapAttributes());
#ifdef SHOW_BOUNDING_BOXES
  // Draw the player in front of back tiles
  al_draw_rectangle(player->GetPosX() - GetPosX() + 1,
                    player->GetPosY() - GetPosY() + 1,
                    player->GetPosX() + player->GetWidth() - 1 - GetPosX() + 1,
                    player->GetPosY() + player->GetHeight() - 1 - GetPosY() + 1,
                    al_map_rgb(0xAD, 0x21, 0x56), 1.0);
  // - External
  al_draw_rectangle(player->GetPosX() - 1 - GetPosX() + 1,
                    player->GetPosY() - 1 - GetPosY() + 1,
                    player->GetPosX() + player->GetWidth() - GetPosX() + 1,
                    player->GetPosY() + player->GetHeight() - GetPosY() + 1,
                    al_map_rgb(0xDF, 0xDF, 0xDF), 1.0);
  // - Bounding box
  al_draw_rectangle(player->GetPosX() + player->GetBBX() - GetPosX() + 1,
                    player->GetPosY() + player->GetBBY() - GetPosY() + 1,
                    player->GetPosX() + player->GetBBX() + player->GetBBWidth() - 1 - GetPosX() + 1,
                    player->GetPosY() + player->GetBBY() + player->GetBBHeight() - 1 - GetPosY() + 1,
                    al_map_rgb(0xAF, 0xAF, 0xAF), 1.0);
#endif
}

void Camera::DrawPlayerDying(World* world, Character* player, ALLEGRO_FONT *font) {

  if ((player->GetState() != CHAR_STATE_DYING))
    return;

  ALLEGRO_BITMAP* player_bitmap = player->GetCurrentAnimationBitmap();
  al_draw_scaled_bitmap(player_bitmap,
                        0,
                        0,
                        player->GetCurrentAnimationWidth(),
                        player->GetCurrentAnimationHeight(),
                        player->GetPosX() - GetPosX(),
                        player->GetPosY() - GetPosY(),
                        player->GetCurrentAnimationWidth()*player->GetCurrentAnimationScalingFactor(),
                        player->GetCurrentAnimationHeight()*player->GetCurrentAnimationScalingFactor(),
                        player->GetCurrentAnimationBitmapAttributes());
}

void Camera::DrawPlatforms(World* world, Character* player, ALLEGRO_FONT *font) {
  vector<Platform*>* platforms = world->GetPlatforms();
  for (vector<Platform*>::iterator it = platforms->begin() ; it != platforms->end(); ++it) {
    Platform* platform = *it;
    ALLEGRO_BITMAP* platform_sprite = platform->GetCurrentAnimationBitmap();
    al_draw_bitmap(platform_sprite,
                   platform->GetX() - GetPosX(),
                   platform->GetY() - GetPosY(),
                   platform->GetCurrentAnimationBitmapAttributes());
#ifdef SHOW_BOUNDING_BOXES
    char buffer[30];
    sprintf(buffer, "%d", platform->GetTypeId());
    al_draw_text(font,
                 al_map_rgb(255, 255, 0),
                 platform->GetX() - GetPosX(),
                 platform->GetY() - GetPosY(),
                 ALLEGRO_ALIGN_LEFT,
                 buffer);
#endif
  }
}

void Camera::DrawBlocks(World* world, Character* player, ALLEGRO_FONT *font) {
  list<Block*>* blocks = world->GetBlocks();
  for (list<Block*>::iterator it = blocks->begin() ; it != blocks->end(); ++it) {
    Block* block = *it;
    if (block->GetState() != OBJ_STATE_DEAD) {
      ALLEGRO_BITMAP* block_sprite = block->GetCurrentAnimationBitmap();
      al_draw_bitmap(block_sprite,
                     block->GetX() - GetPosX(),
                     block->GetY() - GetPosY(),
                     block->GetCurrentAnimationBitmapAttributes());
    }
  }
}

void Camera::DrawCheckpoints(World* world, Character* player, ALLEGRO_FONT *font) {
#ifdef SHOW_BOUNDING_BOXES
  list<Checkpoint*>* checkpoints = world->GetCheckpoints();
  for (list<Checkpoint*>::iterator it = checkpoints->begin(); it != checkpoints->end(); it++) {
    Checkpoint* checkpoint = *it;
    al_draw_rectangle(checkpoint->GetChkX() - GetPosX() + 1,
                      checkpoint->GetChkY() - GetPosY() + 1,
                      checkpoint->GetChkX() + checkpoint->GetChkWidth() - GetPosX() + 1,
                      checkpoint->GetChkY() + checkpoint->GetChkHeight() - GetPosY() + 1,
                      al_map_rgb(0xFF, 0xFF, 0xFF), 1.0);
  }
  // Now draw the current checkpoint
  al_draw_rectangle(world->GetCurrentCheckpoint()->GetChkX() - GetPosX() + 1,
                    world->GetCurrentCheckpoint()->GetChkY() - GetPosY() + 1,
                    world->GetCurrentCheckpoint()->GetChkX() + world->GetCurrentCheckpoint()->GetChkWidth() - GetPosX() + 1,
                    world->GetCurrentCheckpoint()->GetChkY() + world->GetCurrentCheckpoint()->GetChkHeight() - GetPosY() + 1,
                    al_map_rgb(0x0, 0xFF, 0xFF), 1.0);
#endif
}

void Camera::DrawTriggers(World* world, Character* player, ALLEGRO_FONT *font) {
#ifdef SHOW_BOUNDING_BOXES
  list<Trigger*>* triggers = world->GetTriggers();
  for (list<Trigger*>::iterator it = triggers->begin(); it != triggers->end(); it++) {
    Trigger* trigger = *it;
    al_draw_rectangle(trigger->GetX() - GetPosX() + 1,
                      trigger->GetY() - GetPosY() + 1,
                      trigger->GetX() + trigger->GetWidth() - GetPosX() + 1,
                      trigger->GetY() + trigger->GetHeight() - GetPosY() + 1,
                      al_map_rgb(0xFF, 0xFF, 0xFF), 1.0);
    char buffer[30];
    sprintf(buffer, "%d", trigger->GetId());
    al_draw_text(font,
                 al_map_rgb(255, 255, 0),
                 trigger->GetX() - GetPosX(),
                 trigger->GetY() - GetPosY(),
                 ALLEGRO_ALIGN_LEFT,
                 buffer);
  }
#endif
}

void Camera::DrawEnemies(World* world, Character* player, ALLEGRO_FONT *font) {
  for(vector<Character*>::iterator it = world->GetEnemies()->begin(); it != world->GetEnemies()->end(); it++) {
    Enemy* enemy = (Enemy*)*it;

    if (enemy->GetState() != CHAR_STATE_DEAD) {

      ALLEGRO_BITMAP* enemy_bitmap = enemy->GetCurrentAnimationBitmap();
      if(!enemy->GetFreezed() || ((steps_drawing % 4) == 0)) {
        al_draw_bitmap(enemy_bitmap,                       
                       enemy->GetPosX() - GetPosX(),
                       enemy->GetPosY() - GetPosY(),
                       enemy->GetCurrentAnimationBitmapAttributes());
      } else {
        al_draw_tinted_bitmap(enemy_bitmap,
                              al_map_rgba_f(1, 0, 0, 1),
                              enemy->GetPosX() - GetPosX(),
                              enemy->GetPosY() - GetPosY(),
                              enemy->GetCurrentAnimationBitmapAttributes());
      }
#ifdef SHOW_BOUNDING_BOXES
      // Draw the enemy in front of back tiles
      al_draw_rectangle(enemy->GetPosX() - GetPosX() + 1,
                        enemy->GetPosY() - GetPosY() + 1,
                        enemy->GetPosX() + enemy->GetWidth() - 1 - GetPosX() + 1,
                        enemy->GetPosY() + enemy->GetHeight() - 1 - GetPosY() + 1,
                        al_map_rgb(0xAD, 0x21, 0x56), 1.0);
      // - External
      al_draw_rectangle(enemy->GetPosX() - 1 - GetPosX() + 1,
                        enemy->GetPosY() - 1 - GetPosY() + 1,
                        enemy->GetPosX() + enemy->GetWidth() - GetPosX() + 1,
                        enemy->GetPosY() + enemy->GetHeight() - GetPosY() + 1,
                        al_map_rgb(0xDF, 0xDF, 0xDF), 1.0);
      // - Bounding box
      al_draw_rectangle(enemy->GetPosX() + enemy->GetBBX() - GetPosX() + 1,
                        enemy->GetPosY() + enemy->GetBBY() - GetPosY() + 1,
                        enemy->GetPosX() + enemy->GetBBX() + enemy->GetBBWidth() - 1 - GetPosX() + 1,
                        enemy->GetPosY() + enemy->GetBBY() + enemy->GetBBHeight() - 1 - GetPosY() + 1,
                        al_map_rgb(0xAF, 0xAF, 0xAF), 1.0);
      char buffer[30];
      sprintf(buffer, "%d", enemy->GetId());
      al_draw_text(font,
                   al_map_rgb(255, 255, 0),
                   enemy->GetPosX() - GetPosX(),
                   enemy->GetPosY() - GetPosY(),
                   ALLEGRO_ALIGN_LEFT,
                   buffer);
      // If limited area for IA then show the limits
      if (enemy->GetEnemyIA()->IsLimited()) {
        al_draw_rectangle(enemy->GetEnemyIA()->GetOrigX() - GetPosX() + 1,
                          enemy->GetEnemyIA()->GetOrigY() - GetPosY() + 1,
                          enemy->GetEnemyIA()->GetOrigX() + enemy->GetEnemyIA()->GetLimitX() - 1 - GetPosX() + 1,
                          enemy->GetEnemyIA()->GetOrigY() + enemy->GetEnemyIA()->GetLimitY() - 1 - GetPosY() + 1,
                          al_map_rgb(0xAD, 0x00, 0xF6), 1.0);
      }
#endif
    }
  }
}

void Camera::DrawCameraViews(World* world, Character* player, ALLEGRO_FONT *font) {
#ifdef SHOW_BOUNDING_BOXES
  vector<CameraView*>* camera_views = world->GetCameraViews();
  for (vector<CameraView*>::iterator it = camera_views->begin(); it != camera_views->end(); it++) {
    CameraView* view = *it;
    al_draw_rectangle(view->GetLeftUpX() - GetPosX() + 1,
                      view->GetLeftUpY() - GetPosY() + 1,
                      view->GetRightDownX() - GetPosX() + 1,
                      view->GetRightDownY() - GetPosY() + 1,
                      al_map_rgb(0xFF, 0xFF, 0xFF), 4.0);
  }
#endif
}

void Camera::DrawScreen(World* world, Character* player, ALLEGRO_FONT *font) {

  // Draw everything on internal bitmap before resizing it
  // into the screen bitmap  
  al_set_target_bitmap(camera_bitmap);  
  al_clear_to_color(al_map_rgb(0, 0, 0));   // REVISIT: Drawing background as black. This helps with transparent tiles drawing  
    
  // Traverse map and draw background tiles in the screen
  this->DrawBackTiles(map, player, font);
  // Draw back objects
  this->DrawBackObjects(map, player, font);
  // Draw the player if he is not dying
  this->DrawPlayer(map, player, font);
  // Draw the enemies
  this->DrawEnemies(map, player, font);
  // Draw resting objects
  this->DrawFrontObjects(map, player, font);
  // Draw platforms
  this->DrawPlatforms(map, player, font);
  // Traverse map and draw front tiles in the screen
  this->DrawFrontTiles(map, player, font);
  // Draw blocks
  this->DrawBlocks(map, player, font);
  // Draw checkpoints (only for debug)
  this->DrawCheckpoints(map, player, font);
  // Draw triggers (only for debug)
  this->DrawTriggers(map, player, font);
  // Draw player dying if required
  this->DrawPlayerDying(map, player, font);
  // Draw camera views
  this->DrawCameraViews(map, player, font);

  // Move camera to screen
  al_set_target_bitmap(screen);

  al_draw_scaled_bitmap(camera_bitmap,
                        0, 0, pixels_width, pixels_height,
                        0, 0, SCREEN_X, SCREEN_Y, 0);

  steps_drawing++;
}

void Camera::SetCameraView(CameraView* camera_view) {
  if(camera_view) {
    view_x = camera_view->GetLeftUpX();
    view_y = camera_view->GetLeftUpY();
    view_width = camera_view->GetRightDownX() - camera_view->GetLeftUpX();
    view_height = camera_view->GetRightDownY() - camera_view->GetLeftUpY();

    if(current_camera_view != camera_view->GetId()) {
      prev_camera_view = current_camera_view;
      current_camera_view = camera_view->GetId();
    }
  }
}

bool Camera::CoordsWithinCamera(int x, int y) {
  // Make the camera slightly bigger to allow
  // drawing of objects that may be in the limits
  // of the camera
  int camera_x = pos_x - 32;
  int camera_y = pos_y - 32;
  int camera_width = pixels_width + 32;
  int camera_height = pixels_height + 32;
  return ((x >= camera_x) &&
          (x <= camera_x + camera_width) &&
          (y >= camera_y) &&
          (y <= camera_y + camera_height));
}

void Camera::CameraStep(World* world, Character *player, ALLEGRO_FONT *font) {
  // Check in which camera view the player is
  //printf("[CameraStep] Calling to set camera view\n");
  CameraView* camera_view = world->GetCurrentCameraView(player);
  this->SetCameraView(camera_view);

  this->PositionBasedOnPlayer(player);
  //printf("[CameraStep] Camera draw screen\n");
  this->DrawScreen(world, player, font);
}