import { useEffect, useState } from "react";
import { Skeleton } from "./Skeleton";

export interface QrCardProps {
  /** VC-JWT or DID proof string encoded into the QR. */
  value: string;
  alt?: string;
}

type QrState = { status: "loading" } | { status: "ready"; dataUrl: string } | { status: "error" };

/**
 * 264×264 QR on a white card with quiet zone (components.md §8).
 * High-contrast only — never brand-colored.
 */
export function QrCard({ value, alt = "Verifiable credential QR code" }: QrCardProps) {
  const [state, setState] = useState<QrState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    import("qrcode")
      .then((qr) => qr.toDataURL(value, { margin: 0, errorCorrectionLevel: "M" }))
      .then((dataUrl) => {
        if (!cancelled) setState({ status: "ready", dataUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (state.status === "error") {
    return (
      <div className="cp-qr" role="alert">
        QR could not be generated. Retry or use manual verification.
      </div>
    );
  }
  return (
    <div className="cp-qr">
      {state.status === "ready" ? <img src={state.dataUrl} alt={alt} /> : <Skeleton width={232} height={232} />}
    </div>
  );
}
