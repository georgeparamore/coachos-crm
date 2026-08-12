"use client";

export function PreviewCloseButton() {
  function closePreview() {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return;
    }
    window.location.assign("/courses");
  }

  return <button className="btn btn-primary" onClick={closePreview}>Back to editor</button>;
}
