import { useState, type FormEvent } from "react";
import { verifyCredential } from "@campus-pulse/api";
import { Badge, Button, Input } from "@campus-pulse/ui";

export interface VerifiedCredential { token: string; bookingRef: string }

export function CredentialVerifier({ onVerified }: { onVerified?: (credential: VerifiedCredential) => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyCredential>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const verified = await verifyCredential(token.trim());
      setResult(verified);
      if (verified.valid && verified.bookingRef) onVerified?.({ token: token.trim(), bookingRef: verified.bookingRef });
    } catch { setError("Verification unavailable. Please retry."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="credential-verifier-title">
    <h2 id="credential-verifier-title" className="cp-page__h2">Verify credential</h2>
    <form onSubmit={submit}>
      <Input label="Credential token" value={token} onChange={(event) => { setToken(event.target.value); setResult(null); setError(null); }} required />
      <Button type="submit" loading={busy} disabled={!token.trim()}>Verify</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    {result && <div role="status"><Badge type={result.valid ? "success" : "error"}>{result.valid ? "Valid credential" : "Invalid credential"}</Badge><p>{result.eventTitle ?? result.reason}</p></div>}
  </section>;
}