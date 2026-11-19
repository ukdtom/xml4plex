const HOST_ID = "custom-ext-spinner-host";

function showSpinner(message = "Loading...") {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    display: "grid",
    placeItems: "center",
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(2px)",
    zIndex: "2147483647"
  });

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .card {
        background: #ffffff;
        padding: 20px 28px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        color: #1e293b;
        font-size: 14px;
        font-weight: 500;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.75s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner { animation-duration: 3s; }
      }
    </style>
    <div class="card" role="status" aria-live="polite">
      <div class="spinner"></div>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(host);
}

function hideSpinner() {
  document.getElementById(HOST_ID)?.remove();
}