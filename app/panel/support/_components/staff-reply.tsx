"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import TextArea from "@/app/panel/_components/ui/text-area";
import { staffReplyAction, type StaffReplyState } from "../_actions";

const idle: StaffReplyState = { status: "idle", message: "" };

export default function StaffReply({ ticketId }: { ticketId: string }) {
  const [state, submit, pending] = useActionState(staffReplyAction.bind(null, ticketId), idle);
  const [body, setBody] = useState("");
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state.status === "ok") setBody("");
    wasPending.current = pending;
  }, [pending, state.status]);
  return (
    <form className="wform" action={submit}>
      <TextArea
        id="staff-reply"
        name="body"
        label="Reply to the customer"
        hint="The customer sees it in their account and gets an email."
        value={body}
        onChange={setBody}
        rows={6}
        maxLength={5000}
        disabled={pending}
      />
      {state.status === "error" && (
        <p className="wdialog-error" role="alert">
          {state.message}
        </p>
      )}
      <div className="wsettings-foot">
        <label className="wsupport-close">
          <input type="checkbox" name="close" disabled={pending} /> Close the request after replying
        </label>
        <span className="wsettings-state" role="status">
          {state.status === "ok" ? state.message : ""}
        </span>
        <button className="wbtn wbtn-primary" type="submit" disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Send reply"}
        </button>
      </div>
    </form>
  );
}
