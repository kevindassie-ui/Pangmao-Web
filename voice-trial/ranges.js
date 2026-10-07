// Cached full audio must satisfy Safari's byte-range requests as well.
export async function withByteRange(response, range) {
  if (!range) return response;
  const bytes = await response.arrayBuffer();
  const total = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const unsatisfied = () => new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  if (!match || (!match[1] && !match[2])) return unsatisfied();
  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= total) return unsatisfied();
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.delete("Transfer-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
