#ifndef POSTPROCESS_RULES_H
#define POSTPROCESS_RULES_H

#include <cstddef>

inline int HorizontalStripBaseOffset(std::size_t strip, int max_offset) {
  if (max_offset <= 0) return 0;
  const std::size_t span = static_cast<std::size_t>(max_offset) * 2;
  const std::size_t position = strip % span;
  return static_cast<int>(position <= static_cast<std::size_t>(max_offset)
                              ? position
                              : span - position);
}

inline int HorizontalStripOffset(std::size_t strip, std::size_t strips,
                                 int max_offset,
                                 unsigned long long elapsed_ms,
                                 unsigned int period_ms) {
  if (!strips || !period_ms) return 0;
  const std::size_t rotations =
      static_cast<std::size_t>((elapsed_ms / period_ms) % strips);
  const std::size_t source = (strip + strips - rotations) % strips;
  return HorizontalStripBaseOffset(source, max_offset);
}

#endif  // POSTPROCESS_RULES_H
