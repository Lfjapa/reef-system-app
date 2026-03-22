type LightingPhase = {
  id: string
  name: string
  time: string
  uv: number
  white: number
  blue: number
}

type Props = {
  lightingPhases: LightingPhase[]
  timeToMinutes: (time: string) => number
  openEditLightingModal: (phase: LightingPhase) => void
  isLightingModalOpen: boolean
  closeLightingModal: () => void
  lightingEditName: string
  setLightingEditName: (next: string) => void
  lightingEditTime: string
  setLightingEditTime: (next: string) => void
  lightingEditUv: string
  setLightingEditUv: (next: string) => void
  lightingEditWhite: string
  setLightingEditWhite: (next: string) => void
  lightingEditBlue: string
  setLightingEditBlue: (next: string) => void
  onSaveLightingPhase: () => void
}

export default function LightingTab({
  lightingPhases,
  timeToMinutes,
  openEditLightingModal,
  isLightingModalOpen,
  closeLightingModal,
  lightingEditName,
  setLightingEditName,
  lightingEditTime,
  setLightingEditTime,
  lightingEditUv,
  setLightingEditUv,
  lightingEditWhite,
  setLightingEditWhite,
  lightingEditBlue,
  setLightingEditBlue,
  onSaveLightingPhase,
}: Props) {
  return (
    <section className="panel">
      <h2>Iluminação (Rampa de LED)</h2>
      <p className="helper">Edite horários e potências reais por canal. 19:30 é o desligamento.</p>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fase</th>
              <th>Horário</th>
              <th>R (UV)</th>
              <th>G (Branco)</th>
              <th>B (Azul)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lightingPhases
              .slice()
              .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
              .map((phase) => (
                <tr key={phase.id}>
                  <td>{phase.name}</td>
                  <td>{phase.time}</td>
                  <td>{phase.uv}</td>
                  <td>{phase.white}</td>
                  <td>{phase.blue}</td>
                  <td className="table-actions">
                    <button className="secondary-btn" onClick={() => openEditLightingModal(phase)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isLightingModalOpen && (
        <div className="modal-backdrop" onClick={closeLightingModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>Editar fase</h3>
              <button className="secondary-btn" onClick={closeLightingModal}>
                Fechar
              </button>
            </div>

            <label className="fauna-search">
              Nome da fase
              <input type="text" value={lightingEditName} onChange={(event) => setLightingEditName(event.target.value)} />
            </label>

            <div className="protocol-dose">
              <label>
                Horário
                <input type="time" value={lightingEditTime} onChange={(event) => setLightingEditTime(event.target.value)} />
              </label>
              <label>
                UV
                <input type="number" value={lightingEditUv} onChange={(event) => setLightingEditUv(event.target.value)} />
              </label>
              <label>
                Branco
                <input
                  type="number"
                  value={lightingEditWhite}
                  onChange={(event) => setLightingEditWhite(event.target.value)}
                />
              </label>
              <label>
                Azul
                <input type="number" value={lightingEditBlue} onChange={(event) => setLightingEditBlue(event.target.value)} />
              </label>
            </div>

            <div className="modal-actions">
              <button className="secondary-btn" onClick={onSaveLightingPhase}>
                Salvar
              </button>
              <button className="danger-btn" onClick={closeLightingModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

