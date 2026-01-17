import { useUIStore } from "@/stores/uiStore"

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  const clearToast = useUIStore((s) => s.clearToast)

  if (!toast) return null

  const bgColor = toast.kind === "error" ? "bg-red-600" : "bg-blue-600"

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 p-4 rounded-lg shadow-lg text-white flex items-start gap-3 z-50">
      <div className={`flex-1 ${bgColor} rounded p-3`}>
        <p className="text-sm">{toast.message}</p>
      </div>
      <button onClick={clearToast} className="text-white/70 hover:text-white text-xl leading-none">
        ×
      </button>
    </div>
  )
}
