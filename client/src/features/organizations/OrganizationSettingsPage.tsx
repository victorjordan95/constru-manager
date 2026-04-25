import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCurrentOrganization, useUploadOrgLogo } from './hooks'

export function OrganizationSettingsPage() {
  const { user } = useAuthStore()
  const { data: org, isLoading } = useCurrentOrganization()
  const uploadMutation = useUploadOrgLogo()
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 2 MB.')
      return
    }
    setError(null)
    setSuccess(false)
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !user?.organizationId) return
    setError(null)
    setSuccess(false)
    try {
      await uploadMutation.mutateAsync({ id: user.organizationId, file: selectedFile })
      setSuccess(true)
      setSelectedFile(null)
      setPreview(null)
    } catch {
      setError('Erro ao fazer upload. Tente novamente.')
    }
  }

  if (isLoading) return <p style={{ color: 'var(--color-neutral-600)' }}>Carregando...</p>

  const currentLogo = preview ?? org?.logoUrl ?? null

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>Configurações</h1>

      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          border: '1px solid var(--color-neutral-300)',
          padding: 'var(--space-3)',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Logo da empresa</h2>

        {/* Logo preview */}
        <div
          style={{
            width: 160,
            height: 80,
            border: '1px dashed var(--color-neutral-300)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-2)',
            background: 'var(--color-neutral-100)',
            overflow: 'hidden',
          }}
        >
          {currentLogo ? (
            <img
              src={currentLogo}
              alt="Logo da empresa"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-neutral-600)' }}>Sem logo</span>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-neutral-600)', fontWeight: 500 }}>
              Selecionar imagem (máx. 2 MB)
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ fontSize: '0.875rem' }}
            />
          </label>

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>
          )}
          {success && (
            <p style={{ color: 'var(--color-success)', fontSize: '0.875rem' }}>Logo atualizado com sucesso!</p>
          )}

          <button
            type="submit"
            disabled={!selectedFile || uploadMutation.isPending}
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 4,
              cursor: !selectedFile || uploadMutation.isPending ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: !selectedFile || uploadMutation.isPending ? 0.6 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {uploadMutation.isPending ? 'Enviando...' : 'Salvar logo'}
          </button>
        </form>
      </div>
    </div>
  )
}
