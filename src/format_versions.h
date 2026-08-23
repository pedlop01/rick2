#ifndef FORMAT_VERSIONS_H
#define FORMAT_VERSIONS_H

// Mirrored from schema/format_versions.json. The compatibility regression test
// fails if the native runtime and editor contract drift apart.
namespace FormatVersions {
constexpr int GAME = 1;
constexpr int LEVEL = 1;
}

#endif
