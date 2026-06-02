import { useEffect, useMemo, useState } from 'react';
import { getRuntimeInfo } from './runtime';
import { getWebRoleCapabilities, getWebStoreContext, webRoleLabel, type WebRoleCapabilities, type WebStoreRole } from './webApi';

export type PermissionRole = WebStoreRole | 'sem login';

interface WebPermissionState {
  isWeb: boolean;
  loading: boolean;
  role: PermissionRole;
  roleLabel: string;
  capabilities: WebRoleCapabilities;
  canRead: boolean;
  canOperate: boolean;
  canManageStore: boolean;
  canManageMembers: boolean;
  readonlyMessage: string;
}

const LOCAL_ROLE: PermissionRole = 'owner';

export function useWebPermissions(refreshToken = 0): WebPermissionState {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [role, setRole] = useState<PermissionRole>(runtimeInfo.isWeb ? 'sem login' : LOCAL_ROLE);
  const [loading, setLoading] = useState(Boolean(runtimeInfo.isWeb));

  useEffect(() => {
    if (!runtimeInfo.isWeb) {
      setRole(LOCAL_ROLE);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    void getWebStoreContext({ createIfMissing: false })
      .then((context) => {
        if (!active) return;
        setRole(context.role);
      })
      .catch(() => {
        if (!active) return;
        setRole('sem login');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshToken, runtimeInfo.isWeb]);

  const capabilities = useMemo(() => getWebRoleCapabilities(role), [role]);
  const roleLabel = webRoleLabel(role);
  const readonlyMessage = !runtimeInfo.isWeb
    ? ''
    : role === 'sem login'
      ? 'Entre com login Supabase para liberar alterações nesta loja.'
      : capabilities.canOperate
        ? ''
        : 'Seu perfil é somente leitura. Você pode consultar, mas não pode salvar, excluir, receber, vender ou alterar dados.';

  return {
    isWeb: runtimeInfo.isWeb,
    loading,
    role,
    roleLabel,
    capabilities,
    canRead: capabilities.canRead,
    canOperate: capabilities.canOperate,
    canManageStore: capabilities.canManageStore,
    canManageMembers: capabilities.canManageMembers,
    readonlyMessage,
  };
}
