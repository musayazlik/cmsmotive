"use client";

import { useEffect, useId, useState } from "react";
import { isActiveActivity, type AssistantActivity, type ActivityStatus } from "@/lib/assistant-activity-shared";

const STATUS: Record<ActivityStatus, string> = {
  running: "In progress", waiting: "Waiting for you", completed: "Completed",
  failed: "Failed", cancelled: "Cancelled", expired: "Expired",
};
const SOURCE = { chat: "Chat", mcp: "MCP", telegram: "Telegram" };
type Connection = "connecting" | "live" | "reconnecting" | "unavailable";

function duration(activity: AssistantActivity, now: number): string {
  const seconds = Math.max(0, Math.round(((activity.finishedAt ? Date.parse(activity.finishedAt) : now) - Date.parse(activity.createdAt)) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function AssistantActivityMenu({ storeId, open, onToggle, onClose }: {
  storeId: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const [activities, setActivities] = useState<AssistantActivity[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let delay = 3000;
    const connect = () => {
      if (disposed || document.visibilityState === "hidden") return;
      const current = new EventSource(`/api/admin/activities/stream?storeId=${encodeURIComponent(storeId)}`);
      source = current;
      const reconnect = () => {
        if (disposed || source !== current) return;
        current.close();
        setConnection("unavailable");
        clearTimeout(retry);
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      };
      current.addEventListener("activities", (event: MessageEvent<string>) => {
        if (disposed || source !== current) return;
        try {
          const payload = JSON.parse(event.data) as { activities: AssistantActivity[] };
          if (!Array.isArray(payload.activities)) throw new Error("Invalid activities");
          setActivities(payload.activities);
          setConnection("live");
          delay = 3000;
        } catch { reconnect(); }
      });
      current.addEventListener("unavailable", reconnect);
      current.onerror = () => {
        if (disposed || source !== current) return;
        if (current.readyState === EventSource.CLOSED) reconnect();
        else setConnection("reconnecting");
      };
    };
    const visibility = () => {
      source?.close();
      source = null;
      clearTimeout(retry);
      if (document.visibilityState === "visible") connect();
    };
    connect();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      source?.close();
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [storeId, attempt]);

  const running = activities.filter((activity) => activity.status === "running");
  const waiting = activities.filter((activity) => activity.status === "waiting");
  const active = activities.filter((activity) => isActiveActivity(activity.status));
  const runningCount = running.length;
  useEffect(() => {
    if (!open || runningCount === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, runningCount]);
  const summary = connection !== "live" ? "Activity connection is reconnecting. Last known results are shown."
    : `${running.length} operations in progress, ${waiting.length} waiting for your response.`;

  return (
    <div className="wmenu-anchor assistant-activity-anchor" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) onClose();
    }}>
      <button type="button" className="workspace-tool assistant-activity-trigger" aria-haspopup="dialog"
        data-active={active.length > 0 && connection === "live"}
        aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`Assistant activity. ${summary}`} title={`Assistant activity. ${summary}`} onClick={onToggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-12h-7z" /></svg>
        {active.length > 0 ? <span className="assistant-activity-count" aria-hidden="true">{active.length > 9 ? "9+" : active.length}</span> : null}
      </button>
      <span className="assistant-activity-sr" role="status" aria-atomic="true">{summary}</span>
      {open ? (
        <div className="wmenu assistant-activity-menu" id={id} role="dialog" aria-label="Assistant activity">
          <div className="assistant-activity-head">
            <div className="assistant-activity-heading">
              <span className="assistant-activity-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m13 2-9 12h7l-1 8 10-12h-7z" /></svg></span>
              <div><h2>Assistant activity</h2><p>Live operations for this store</p></div>
            </div>
            <span className="assistant-activity-connection" data-connected={connection === "live"}>
              {connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…"}
            </span>
          </div>
          {connection !== "live" ? <div className="assistant-activity-offline">
            <span>{active.length ? "Showing the last received activity." : "Waiting for the activity connection."}</span>
            <button type="button" className="wbtn wbtn-ghost wbtn-sm" onClick={() => setAttempt((value) => value + 1)}>Reconnect</button>
          </div> : null}
          {active.length === 0 && connection === "live" ? <div className="assistant-activity-empty">
            <span className="assistant-activity-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h4l3-8 4 16 3-8h2" /></svg></span>
            <strong>All quiet for now</strong>
            <p>Active operations will appear here<br />as your assistant gets to work.</p>
          </div> : null}
          {active.length ? <ActivityList title="Active" activities={active} now={now} /> : null}
          <div className="assistant-activity-footer">Chat, MCP &amp; Telegram<span>Active operations only</span></div>
        </div>
      ) : null}
    </div>
  );
}

function ActivityList({ title, activities, now }: { title: string; activities: AssistantActivity[]; now: number }) {
  return <section className="assistant-activity-section" aria-label={title}>
    <h3>{title} operations <span>{activities.length}</span></h3>
    <ul>{activities.map((activity) => <li key={activity.id} className="assistant-activity-item" data-status={activity.status}>
      <div className="assistant-activity-meta"><span>{SOURCE[activity.source]}</span>
        <span className="assistant-activity-status" data-status={activity.status}>{STATUS[activity.status]}</span></div>
      <strong>{activity.title}</strong>
      <p>{activity.detail}</p>
      <div className="assistant-activity-time"><time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
        <span>{activity.status === "waiting" ? "Continue in Telegram" : duration(activity, now)}</span></div>
      {activity.steps.length ? <details><summary>{activity.steps.length} recorded steps</summary>
        <ol>{activity.steps.map((step, index) => <li key={`${step.at}:${index}`} data-failed={step.failed || undefined}>
          <span>{step.detail}</span><time dateTime={step.at}>{new Date(step.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
        </li>)}</ol>
      </details> : null}
    </li>)}</ul>
  </section>;
}
