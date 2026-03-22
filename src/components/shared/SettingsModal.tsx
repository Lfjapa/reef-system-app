import { useState } from 'react'

type UiSettingsLike = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

type Props = {
  uiSettings: UiSettingsLike
  defaultTitle: string
  onClose: () => void
  onSave: (next: UiSettingsLike) => void
}

export default function SettingsModal({ uiSettings, defaultTitle, onClose, onSave }: Props) {
  const [draftTitle, setDraftTitle] = useState<string>(uiSettings.title)
  const [draftSubtitle, setDraftSubtitle] = useState<string>(uiSettings.subtitle)
  const [draftSubtitleEnabled, setDraftSubtitleEnabled] = useState<boolean>(uiSettings.subtitleEnabled)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <h3>Configurações</h3>
          <button type="button" className="secondary-btn" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmedTitle = draftTitle.trim()
            const trimmedSubtitle = draftSubtitle.trim()
            onSave({
              title: trimmedTitle || defaultTitle,
              subtitle: trimmedSubtitle,
              subtitleEnabled: draftSubtitleEnabled && trimmedSubtitle.length > 0,
            })
          }}
        >
          <label>
            Título
            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
          </label>

          <label>
            <span>Mostrar subtítulo</span>
            <input
              type="checkbox"
              checked={draftSubtitleEnabled}
              onChange={(e) => setDraftSubtitleEnabled(e.target.checked)}
            />
          </label>

          <label>
            Subtítulo
            <input
              value={draftSubtitle}
              onChange={(e) => setDraftSubtitle(e.target.value)}
              disabled={!draftSubtitleEnabled}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
