export const WEB_VERSION = "0.3.1";

export function versionedAsset(path, version = WEB_VERSION) {
  const separator = String(path).includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(version)}`;
}
