type ProtocolDefinition = {
  key: string
  label: string
  days: number[]
  quantity: number | null
  unit: string
}

type ProtocolCheckLog = {
  id: string
  protocolKey: string
  checkedAt: string
  quantity: number | null
  unit: string
  note: string
}

type Props = {
  protocolNote: string
  setProtocolNote: (next: string) => void
  protocolDefinitions: ProtocolDefinition[]
  latestProtocolByKey: ReadonlyMap<string, { checkedAt: string }>
  formatDays: (days: number[]) => string
  formatDate: (iso: string) => string
  dayLabels: string[]
  isDoneThisWeek: (protocolKey: string, dayIndex: number) => boolean
  onToggleProtocolCheck: (protocolKey: string, dayIndex: number) => void
  openAddRoutineModal: () => void
  openEditRoutineModal: (definition: ProtocolDefinition) => void
  onDeleteRoutine: (protocolKey: string) => void
  protocolChecksSorted: ProtocolCheckLog[]
  onDeleteProtocolHistoryEntry: (entryId: string) => void
  isProtocolModalOpen: boolean
  closeProtocolModal: () => void
  protocolModalMode: 'add' | 'edit'
  protocolEditingKey: string | null
  protocolAddLabel: string
  setProtocolAddLabel: (next: string) => void
  protocolAddDays: number[]
  setProtocolAddDays: (next: number[] | ((current: number[]) => number[])) => void
  protocolAddQuantity: string
  setProtocolAddQuantity: (next: string) => void
  protocolAddUnit: string
  setProtocolAddUnit: (next: string) => void
  onAddRoutine: () => void
  protocolEditLabel: string
  setProtocolEditLabel: (next: string) => void
  protocolEditDays: number[]
  setProtocolEditDays: (next: number[] | ((current: number[]) => number[])) => void
  protocolEditQuantity: string
  setProtocolEditQuantity: (next: string) => void
  protocolEditUnit: string
  setProtocolEditUnit: (next: string) => void
  onSaveProtocol: (protocolKey: string) => void
}

export default function ProtocolsTab({
  protocolNote,
  setProtocolNote,
  protocolDefinitions,
  latestProtocolByKey,
  formatDays,
  formatDate,
  dayLabels,
  isDoneThisWeek,
  onToggleProtocolCheck,
  openAddRoutineModal,
  openEditRoutineModal,
  onDeleteRoutine,
  protocolChecksSorted,
  onDeleteProtocolHistoryEntry,
  isProtocolModalOpen,
  closeProtocolModal,
  protocolModalMode,
  protocolEditingKey,
  protocolAddLabel,
  setProtocolAddLabel,
  protocolAddDays,
  setProtocolAddDays,
  protocolAddQuantity,
  setProtocolAddQuantity,
  protocolAddUnit,
  setProtocolAddUnit,
  onAddRoutine,
  protocolEditLabel,
  setProtocolEditLabel,
  protocolEditDays,
  setProtocolEditDays,
  protocolEditQuantity,
  setProtocolEditQuantity,
  protocolEditUnit,
  setProtocolEditUnit,
  onSaveProtocol,
}: Props) {
  return (
    <section className="panel">
      <h2>Protocolos e dosagens</h2>
      <label className="fauna-search">
        Observação rápida
        <input
          type="text"
          value={protocolNote}
          onChange={(event) => setProtocolNote(event.target.value)}
          placeholder="Opcional (ex.: dose ajustada, produto, etc.)"
        />
      </label>

      <div className="protocol-toolbar">
        <button className="secondary-btn" onClick={openAddRoutineModal}>
          Adicionar rotina
        </button>
      </div>

      <div className="history">
        {protocolDefinitions.map((definition) => {
          const latest = latestProtocolByKey.get(definition.key)
          const scheduledDays = definition.days.slice().sort((a, b) => a - b)
          const doseLabel =
            definition.quantity === null ? 'Sem quantidade' : `${definition.quantity} ${definition.unit}`.trim()
          return (
            <article key={definition.key} className="history-item">
              <div>
                <strong>{definition.label}</strong>
                <p>
                  {formatDays(scheduledDays)} · {doseLabel}
                  {latest ? ` · Último: ${formatDate(latest.checkedAt)}` : ''}
                </p>
                <div className="week-checks">
                  {scheduledDays.map((dayIndex) => (
                    <button
                      key={`${definition.key}-${dayIndex}`}
                      className={isDoneThisWeek(definition.key, dayIndex) ? 'week-check active' : 'week-check'}
                      onClick={() => onToggleProtocolCheck(definition.key, dayIndex)}
                    >
                      {dayLabels[(dayIndex + 6) % 7]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="history-actions">
                <button className="secondary-btn" onClick={() => openEditRoutineModal(definition)}>
                  Editar
                </button>
                <button className="danger-btn" onClick={() => onDeleteRoutine(definition.key)}>
                  Excluir
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {isProtocolModalOpen && (
        <div className="modal-backdrop" onClick={closeProtocolModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h3>{protocolModalMode === 'add' ? 'Adicionar rotina' : 'Editar rotina'}</h3>
              <button className="secondary-btn" onClick={closeProtocolModal}>
                Fechar
              </button>
            </div>

            {protocolModalMode === 'add' && (
              <>
                <label className="fauna-search">
                  Nome da rotina
                  <input
                    type="text"
                    value={protocolAddLabel}
                    onChange={(event) => setProtocolAddLabel(event.target.value)}
                    placeholder="Ex.: Alimentar, Dosar iodo, Limpar skimmer"
                  />
                </label>
                <div className="week-checks">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <button
                      key={`add-routine-${index}`}
                      className={protocolAddDays.includes(index) ? 'week-check active' : 'week-check'}
                      onClick={() => {
                        setProtocolAddDays((current) =>
                          current.includes(index) ? current.filter((d) => d !== index) : [...current, index],
                        )
                      }}
                    >
                      {dayLabels[(index + 6) % 7]}
                    </button>
                  ))}
                </div>
                <div className="protocol-dose">
                  <label>
                    Quantidade
                    <input
                      type="number"
                      step="0.01"
                      value={protocolAddQuantity}
                      onChange={(event) => setProtocolAddQuantity(event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Unidade
                    <input type="text" value={protocolAddUnit} onChange={(event) => setProtocolAddUnit(event.target.value)} />
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={onAddRoutine}>
                    Adicionar
                  </button>
                  <button className="danger-btn" onClick={closeProtocolModal}>
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {protocolModalMode === 'edit' && protocolEditingKey && (
              <>
                <label className="fauna-search">
                  Nome da rotina
                  <input type="text" value={protocolEditLabel} onChange={(event) => setProtocolEditLabel(event.target.value)} />
                </label>
                <div className="week-checks">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <button
                      key={`edit-routine-${index}`}
                      className={protocolEditDays.includes(index) ? 'week-check active' : 'week-check'}
                      onClick={() => {
                        setProtocolEditDays((current) =>
                          current.includes(index) ? current.filter((d) => d !== index) : [...current, index],
                        )
                      }}
                    >
                      {dayLabels[(index + 6) % 7]}
                    </button>
                  ))}
                </div>
                <div className="protocol-dose">
                  <label>
                    Quantidade
                    <input
                      type="number"
                      step="0.01"
                      value={protocolEditQuantity}
                      onChange={(event) => setProtocolEditQuantity(event.target.value)}
                    />
                  </label>
                  <label>
                    Unidade
                    <input type="text" value={protocolEditUnit} onChange={(event) => setProtocolEditUnit(event.target.value)} />
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => onSaveProtocol(protocolEditingKey)}>
                    Salvar
                  </button>
                  <button className="danger-btn" onClick={closeProtocolModal}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <h3 className="subsection-title">Histórico</h3>
      <div className="history">
        {protocolChecksSorted.slice(0, 30).map((log) => {
          const def = protocolDefinitions.find((d) => d.key === log.protocolKey)
          return (
            <article key={log.id} className="history-item">
              <div>
                <strong>{def?.label ?? log.protocolKey}</strong>
                <p>
                  {formatDate(log.checkedAt)}
                  {log.quantity !== null ? ` · ${log.quantity} ${log.unit}`.trim() : ''}
                  {log.note ? ` · ${log.note}` : ''}
                </p>
              </div>
              <div className="history-actions">
                <button className="danger-btn" onClick={() => onDeleteProtocolHistoryEntry(log.id)}>
                  Apagar
                </button>
              </div>
            </article>
          )
        })}
        {protocolChecksSorted.length === 0 && <p>Nenhum registro de protocolo.</p>}
      </div>
    </section>
  )
}

