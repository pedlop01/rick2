#include "keyboard.h"

Keyboard::Keyboard() {
  keys = 0;
}

Keyboard::~Keyboard() {

}

int Keyboard::ReadKeyboard(ALLEGRO_EVENT_QUEUE *event_queue) {
  bool keyEvent = false;
  bool keyDown  = false;
  ALLEGRO_EVENT ev;
 
  while(!al_is_event_queue_empty(event_queue)) {

    al_wait_for_event(event_queue, &ev);
    keyEvent = false;
    keyDown = false;

    if (ev.type == ALLEGRO_EVENT_KEY_DOWN) {
      keyEvent = true;
      keyDown  = true;
    } else if (ev.type == ALLEGRO_EVENT_KEY_UP) {
      keyEvent = true;
      keyDown  = false;
    }

    if (keyEvent) {
      switch (ev.keyboard.keycode) {
        case ALLEGRO_KEY_LEFT   : (keyDown ? keys |= KEY_LEFT  : keys &= ~KEY_LEFT);  break;
        case ALLEGRO_KEY_RIGHT  : (keyDown ? keys |= KEY_RIGHT : keys &= ~KEY_RIGHT); break;
        case ALLEGRO_KEY_UP     : (keyDown ? keys |= KEY_UP    : keys &= ~KEY_UP);    break;
        case ALLEGRO_KEY_DOWN   : (keyDown ? keys |= KEY_DOWN  : keys &= ~KEY_DOWN);  break;
        case ALLEGRO_KEY_SPACE  : (keyDown ? keys |= KEY_SPACE : keys &= ~KEY_SPACE); break;
        case ALLEGRO_KEY_A      : (keyDown ? keys |= KEY_A     : keys &= ~KEY_A);     break;
        case ALLEGRO_KEY_K      : (keyDown ? keys |= KEY_K     : keys &= ~KEY_K);     break;
        case ALLEGRO_KEY_M      : (keyDown ? keys |= KEY_M     : keys &= ~KEY_M);     break;
        case ALLEGRO_KEY_Z      : (keyDown ? keys |= KEY_Z     : keys &= ~KEY_Z);     break;
        case ALLEGRO_KEY_ESCAPE : (keyDown ? keys |= KEY_ESC   : keys &= ~KEY_ESC);   break;
      }
    }
  }

  return keys;
}

void Keyboard::SetKeys(int _keys) {
  keys = _keys;
}

int Keyboard::GetKeys() {
  return keys;
}

int Keyboard::PressedLeft() {
  return (keys & KEY_LEFT);
}

int Keyboard::PressedRight() {
  return (keys & KEY_RIGHT);
}

int Keyboard::PressedUp() {
  return (keys & KEY_UP);
}

int Keyboard::PressedDown() {
  return (keys & KEY_DOWN);
}

int Keyboard::PressedSpace() {
  return (keys & KEY_SPACE);
}

int Keyboard::PressedA() {
  return (keys & KEY_A);
}

int Keyboard::PressedK() {
  return (keys & KEY_K);
}

int Keyboard::PressedM() {
  return (keys & KEY_M);
}

int Keyboard::PressedZ() {
  return (keys & KEY_Z);
}

int Keyboard::PressedESC() {
  return (keys & KEY_ESC);
}