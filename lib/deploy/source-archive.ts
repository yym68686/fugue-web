export const SOURCE_ARCHIVE_MAX_MIB = 128;
export const SOURCE_ARCHIVE_MAX_BYTES = SOURCE_ARCHIVE_MAX_MIB * 1024 * 1024;

export function hasSourceArchiveExtension(filename: string): boolean {
  return /\.(zip|tgz|tar\.gz)$/i.test(filename.trim());
}
