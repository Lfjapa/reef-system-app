import type { ChangeEvent, RefObject } from 'react'
import type { User } from '@supabase/supabase-js'

type HeaderMode = 'loading' | 'login' | 'main'

type UiSettingsLike = {
  title: string
  subtitle: string
  subtitleEnabled: boolean
}

type SyncState = 'local' | 'online' | 'syncing' | 'error'

type Props = {
  mode: HeaderMode
  message?: string
  uiSettings: UiSettingsLike
  isSupabaseEnabled: boolean
  authUser: User | null
  profileAvatarUrl: string | null
  isProfileMenuOpen: boolean
  setIsProfileMenuOpen: (next: boolean | ((current: boolean) => boolean)) => void
  handleRequestAvatarChange: () => void
  handleOpenSettings: () => void
  handleRemoveAvatar: () => void
  handleLogout: () => void
  avatarInputRef: RefObject<HTMLInputElement | null>
  handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void
  syncState: SyncState
  syncErrorDetail: string | null
  pendingWrites: number
  storageError: string | null
  onRetrySync?: () => void
}

export default function Header({
  mode,
  message,
  uiSettings,
  isSupabaseEnabled,
  authUser,
  profileAvatarUrl,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  handleRequestAvatarChange,
  handleOpenSettings,
  handleRemoveAvatar,
  handleLogout,
  avatarInputRef,
  handleAvatarChange,
  syncState,
  syncErrorDetail,
  pendingWrites,
  storageError,
  onRetrySync,
}: Props) {
  const initial = (authUser?.email?.trim()?.[0] ?? 'U').toUpperCase()
  const showSubtitle = mode === 'main' && uiSettings.subtitleEnabled
  const showSyncBadge = syncState !== 'local' || storageError || pendingWrites > 0
  const syncBadgeState = storageError ? 'error' : syncState
  const syncBadgeTitle =
    storageError ? storageError : syncState === 'error' && syncErrorDetail ? syncErrorDetail : undefined
  const syncBadgeText = storageError
    ? storageError
    : pendingWrites > 0
      ? `Enviando (${pendingWrites})...`
      : syncState === 'online'
        ? 'Sincronização online'
        : syncState === 'syncing'
          ? 'Sincronizando...'
          : 'Falha na sincronização'

  return (
    <header className="header">
      <div className="header-top">
        <div className="brand">
          <h1>{uiSettings.title}</h1>
          {showSubtitle && <p className="header-subtitle">{uiSettings.subtitle}</p>}
          {message && <p className="header-message">{message}</p>}
        </div>

        {isSupabaseEnabled && authUser && mode === 'main' && (
          <div className="profile">
            <button
              type="button"
              className="profile-btn"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
            >
              {profileAvatarUrl ? (
                <img className="profile-avatar" src={profileAvatarUrl} alt="Foto do perfil" />
              ) : (
                <span className="profile-avatar-fallback">{initial}</span>
              )}
            </button>

            {isProfileMenuOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-meta">{authUser.email ?? ''}</div>
                <button type="button" className="secondary-btn" onClick={handleRequestAvatarChange}>
                  Trocar foto
                </button>
                <button type="button" className="secondary-btn" onClick={handleOpenSettings}>
                  Configurações
                </button>
                <button type="button" className="secondary-btn" onClick={handleRemoveAvatar}>
                  Remover foto
                </button>
                <button type="button" className="danger-btn" onClick={handleLogout}>
                  Sair
                </button>
              </div>
            )}

            <input
              ref={avatarInputRef}
              hidden
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>
        )}
      </div>

      {showSyncBadge && (
        <div className="sync-status">
          <span className={`sync-badge ${syncBadgeState}`} title={syncBadgeTitle}>
            {syncBadgeText}
          </span>
          {syncState === 'error' && onRetrySync && (
            <button type="button" className="secondary-btn" onClick={onRetrySync}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </header>
  )
}
