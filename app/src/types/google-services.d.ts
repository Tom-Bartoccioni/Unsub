// Type fallback for `google-services.json`, which is gitignored (downloaded
// per machine from Firebase). When the real file is present, TypeScript
// resolves it directly and infers the full shape; when it is absent (CI,
// fresh clone), this ambient declaration keeps `typecheck` green. Metro still
// needs the real file to bundle Android builds.
declare module '*google-services.json' {
  type OAuthClient = { client_id: string; client_type: number };
  type Client = { oauth_client?: OAuthClient[] };
  const googleServices: { client?: Client[] };
  export default googleServices;
}
