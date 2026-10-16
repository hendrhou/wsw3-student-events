import { useState } from "react";
import { cn } from "../utils/cn";
import { Badge, type BadgeType } from "./Badge";
import { Button } from "./Button";

export type CredentialStatus = "Issued" | "Verified" | "Pending" | "Revoked" | "Expired";

const STATUS_BADGE: Record<CredentialStatus, BadgeType> = {
  Issued: "success",
  Verified: "success",
  Pending: "info",
  Revoked: "error",
  Expired: "neutral",
};

export interface CredentialCardProps {
  issuer: string;
  status: CredentialStatus;
  /** Raw JSON-LD credential — rendered in the expandable viewer. */
  jsonLd: Record<string, unknown>;
}

/**
 * Verifiable-credential preview (components.md §2): issuer + status badge +
 * expandable JSON-LD viewer (the semantic/linked-data artifact for the defence).
 */
export function CredentialCard({ issuer, status, jsonLd }: CredentialCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(jsonLd, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="cp-credential">
      <div className="cp-credential__header">
        <span className="cp-credential__issuer">{issuer}</span>
        <Badge type={STATUS_BADGE[status]}>{status}</Badge>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide credential" : "View credential"}
      </Button>
      {open ? (
        <>
          <pre className={cn("cp-credential__json")} aria-label="Credential JSON-LD">
            {json}
          </pre>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? "Copied ✓" : "Copy JSON-LD"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
