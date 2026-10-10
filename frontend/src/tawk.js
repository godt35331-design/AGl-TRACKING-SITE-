// Tawk.to live-chat widget, shown only while a customer is signed in to their portal.
// Both IDs come from the Tawk.to embed code (https://embed.tawk.to/<PROPERTY_ID>/<WIDGET_ID>).
// They are public identifiers, not secrets.
let wanted = false

function applyVisibility() {
  const api = window.Tawk_API
  if (!api) return
  if (wanted) api.showWidget?.()
  else api.hideWidget?.()
}

function loadScript() {
  const propertyId = import.meta.env.VITE_TAWK_PROPERTY_ID
  const widgetId = import.meta.env.VITE_TAWK_WIDGET_ID || 'default'
  if (!propertyId || window.Tawk_LoadStart) return

  window.Tawk_API = window.Tawk_API || {}
  window.Tawk_LoadStart = new Date()
  // Re-check on load so a logout that happened mid-download still hides the bubble.
  window.Tawk_API.onLoad = applyVisibility

  const script = document.createElement('script')
  script.async = true
  script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`
  script.charset = 'UTF-8'
  script.setAttribute('crossorigin', '*')
  document.head.appendChild(script)
}

export function setTawkVisible(visible) {
  wanted = visible
  if (visible) loadScript()
  applyVisibility()
}
