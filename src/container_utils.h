#ifndef CONTAINER_UTILS_H
#define CONTAINER_UTILS_H

#include <cstddef>

// Dispose and erase matching pointer elements without incrementing an iterator
// returned by erase(). The deleter owns any type-specific cleanup.
template <typename Container, typename Predicate, typename Deleter>
std::size_t EraseAndDisposeIf(Container& container,
                              Predicate predicate,
                              Deleter deleter) {
  std::size_t erased = 0;
  typename Container::iterator it = container.begin();

  while (it != container.end()) {
    if (predicate(*it)) {
      deleter(*it);
      it = container.erase(it);
      ++erased;
    } else {
      ++it;
    }
  }

  return erased;
}

template <typename Container>
typename Container::value_type FindByTypeId(Container& container, int id) {
  for (typename Container::iterator it = container.begin(); it != container.end(); ++it) {
    if ((*it)->GetTypeId() == id) return *it;
  }
  return nullptr;
}

#endif // CONTAINER_UTILS_H
