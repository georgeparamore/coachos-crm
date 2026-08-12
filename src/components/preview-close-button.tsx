"use client";

export function PreviewCloseButton() {
  function closePreview() {
    if (window.opener && !window.opener.closed) {
      window.opener.location.reload();
      window.opener.focus();
      window.close();
      return;
    }
    window.close();
    window.setTimeout(() => window.location.assign("/courses"), 150);
  }

  return <button className="btn btn-primary" onClick={closePreview}>Back to editor</button>;
}
