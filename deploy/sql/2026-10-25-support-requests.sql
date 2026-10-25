-- Parent help requests (refunds, missing credits, a story that came out wrong).
CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "orderId" uuid,
  "storyId" uuid,
  reason text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  "adminReply" text,
  "resolvedBy" uuid,
  "resolvedAt" timestamptz,
  "isSandbox" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_status_created ON support_requests (status, "createdAt");
CREATE INDEX IF NOT EXISTS support_requests_user ON support_requests ("userId");
