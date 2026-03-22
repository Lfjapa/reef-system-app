type ParameterAlert = {
  title: string
  message: string
}

type Props = {
  alert: ParameterAlert | null
  onClose: () => void
}

export default function ParameterAlertModal({ alert, onClose }: Props) {
  if (!alert) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <h3>{alert.title}</h3>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
        <p className="modal-text">{alert.message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

