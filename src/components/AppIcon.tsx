import React from 'react';
import type { DelphiIconName, DelphiIconSize } from '../lib/icons';

interface AppIconProps {
  name: DelphiIconName;
  size: DelphiIconSize;
  alt?: string;
  className?: string;
}

interface IconSvgProps {
  name: DelphiIconName;
}

function strokeProps() {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

function IconSvg({ name }: IconSvgProps): JSX.Element {
  const stroke = strokeProps();

  const store = (
    <>
      <path {...stroke} d="M4.5 10.5h15v9h-15z" />
      <path {...stroke} d="M6 10.5 7.5 5h9L18 10.5" />
      <path {...stroke} d="M9 19.5v-4.2h6v4.2" />
      <path {...stroke} d="M7.2 13.3h.01M12 13.3h.01M16.8 13.3h.01" />
    </>
  );

  const bag = (
    <>
      <path {...stroke} d="M6.5 9.5h11l-1 10h-9z" />
      <path {...stroke} d="M9 10V8a3 3 0 0 1 6 0v2" />
    </>
  );

  const cart = (
    <>
      <circle {...stroke} cx="10" cy="18" r="1.2" />
      <circle {...stroke} cx="17" cy="18" r="1.2" />
      <path {...stroke} d="M4.5 6.5h2l1.8 8h8.4l2.1-6H8.1" />
    </>
  );

  const logo = (
    <>
      <path {...stroke} d="M12 3.4 19.2 7v6.4c0 3.5-2.6 5.9-7.2 7.2-4.6-1.3-7.2-3.7-7.2-7.2V7z" />
      <path {...stroke} d="M8 10.2h8" />
      <path {...stroke} d="M8.8 10.2 9.8 7h4.4l1 3.2" />
      <path {...stroke} d="M9.5 13h5v4h-5z" />
      <path {...stroke} d="M13 15h4.2l1.5 2.5" />
      <circle {...stroke} cx="17.1" cy="18" r="0.9" />
    </>
  );

  switch (name) {
    case 'app_logo_cadeado_carrinho':
      return logo;
    case 'painel_da_loja':
      return (
        <>
          <rect {...stroke} x="4.5" y="4.5" width="6.2" height="6.2" rx="1.8" />
          <rect {...stroke} x="13.3" y="4.5" width="6.2" height="4.2" rx="1.6" />
          <rect {...stroke} x="13.3" y="10.9" width="6.2" height="8.6" rx="1.8" />
          <rect {...stroke} x="4.5" y="13.3" width="6.2" height="6.2" rx="1.8" />
        </>
      );
    case 'produtos':
      return (
        <>
          <path {...stroke} d="M12 3.8 18.2 7 12 10.2 5.8 7z" />
          <path {...stroke} d="M18.2 7v7.8L12 18" />
          <path {...stroke} d="M5.8 7v7.8L12 18" />
        </>
      );
    case 'categorias':
      return (
        <>
          <rect {...stroke} x="4.5" y="4.5" width="6" height="6" rx="1.5" />
          <rect {...stroke} x="13.5" y="4.5" width="6" height="6" rx="1.5" />
          <rect {...stroke} x="4.5" y="13.5" width="6" height="6" rx="1.5" />
          <rect {...stroke} x="13.5" y="13.5" width="6" height="6" rx="1.5" />
        </>
      );
    case 'clientes':
    case 'usuario_administrador':
      return (
        <>
          <circle {...stroke} cx="9" cy="9" r="3" />
          <path {...stroke} d="M4.8 18c.9-2.4 2.8-3.8 5.2-3.8s4.3 1.4 5.2 3.8" />
          <circle {...stroke} cx="17.5" cy="8.5" r="2.2" />
          <path {...stroke} d="M15.8 12.6c1.7.3 3 1.3 3.8 3" />
        </>
      );
    case 'pedidos':
      return (
        <>
          <rect {...stroke} x="6.5" y="4.5" width="11" height="15" rx="2" />
          <path {...stroke} d="M9 8.2h6M9 12h6M9 15.8h4" />
          <path {...stroke} d="M9 4.5h6v2.2H9z" />
        </>
      );
    case 'vendas_pdv':
      return (
        <>
          <rect {...stroke} x="5" y="5.3" width="14" height="10.5" rx="2.2" />
          <path {...stroke} d="M8 8.5h8" />
          <path {...stroke} d="M7.2 19h9.6" />
          <path {...stroke} d="M9.4 15.8v3.2M14.6 15.8v3.2" />
        </>
      );
    case 'caixa':
    case 'abrir_caixa':
      return (
        <>
          <rect {...stroke} x="4.5" y="7.2" width="15" height="10.8" rx="2.2" />
          <path {...stroke} d="M4.5 10.8h15" />
          <path {...stroke} d="M9.2 14.6h5.6" />
        </>
      );
    case 'crediario':
      return (
        <>
          <rect {...stroke} x="4.5" y="6" width="15" height="12" rx="2.5" />
          <path {...stroke} d="M8 10h8M8 14h5" />
          <circle {...stroke} cx="16.6" cy="8" r="2.1" />
        </>
      );
    case 'comprovantes':
      return (
        <>
          <path {...stroke} d="M7 4.5h10v15l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
          <path {...stroke} d="M9 9h6M9 12.5h6M9 16h4" />
        </>
      );
    case 'relatorios':
      return (
        <>
          <path {...stroke} d="M5.5 18.5h13" />
          <path {...stroke} d="M8 16v-5" />
          <path {...stroke} d="M12 16V8" />
          <path {...stroke} d="M16 16v-7" />
        </>
      );
    case 'backup':
      return (
        <>
          <path {...stroke} d="M7.5 17.5a4.5 4.5 0 1 1 .8-8.9A5.6 5.6 0 0 1 19 10.5a3.5 3.5 0 0 1-.5 7" />
          <path {...stroke} d="M12 10v8" />
          <path {...stroke} d="m9.5 12.5 2.5-2.5 2.5 2.5" />
        </>
      );
    case 'configuracoes':
    case 'manutencao_ajuste':
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="2.8" />
          <path {...stroke} d="M12 4.5v2.1M12 17.4v2.1M19.5 12h-2.1M6.6 12H4.5M17.1 6.9l-1.5 1.5M8.4 15.6l-1.5 1.5M17.1 17.1l-1.5-1.5M8.4 8.4 6.9 6.9" />
        </>
      );
    case 'auditoria_logs':
      return (
        <>
          <path {...stroke} d="M7 4.5h10v15l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
          <path {...stroke} d="M9 9h6M9 12.5h6M9 16h4" />
          <circle {...stroke} cx="17.4" cy="17.4" r="2.1" />
          <path {...stroke} d="m19 19 1.2 1.2" />
        </>
      );
    case 'bloqueio_seguro':
      return (
        <>
          <path {...stroke} d="M12 3.6 18.6 6v6c0 3.5-2.2 6.1-6.6 8.4C7.6 18.1 5.4 15.5 5.4 12V6z" />
          <path {...stroke} d="m9.2 12.4 1.8 1.8 3.8-4" />
        </>
      );
    case 'ajuda':
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="7.5" />
          <path {...stroke} d="M9.7 9.3a2.6 2.6 0 0 1 4.7 1.4c0 1.8-2.4 2.2-2.4 4" />
          <path {...stroke} d="M12 17.2h.01" />
        </>
      );
    case 'atualizar':
      return (
        <>
          <path {...stroke} d="M18 8a7 7 0 0 0-11.7-1.7" />
          <path {...stroke} d="M6.3 6.3H10" />
          <path {...stroke} d="M6 16a7 7 0 0 0 11.7 1.7" />
          <path {...stroke} d="M18 17.7h-3.7" />
          <path {...stroke} d="m17.7 6.3.3 1.7M6 16l-.3 1.7" />
        </>
      );
    case 'atalhos':
      return (
        <>
          <rect {...stroke} x="5" y="6.2" width="5.2" height="5.2" rx="1.4" />
          <rect {...stroke} x="13.8" y="6.2" width="5.2" height="5.2" rx="1.4" />
          <rect {...stroke} x="5" y="14.6" width="5.2" height="5.2" rx="1.4" />
          <rect {...stroke} x="13.8" y="14.6" width="5.2" height="5.2" rx="1.4" />
        </>
      );
    case 'offline_local':
      return (
        <>
          <path {...stroke} d="M4.5 9a11.4 11.4 0 0 1 15 0" />
          <path {...stroke} d="M7.5 12a7.3 7.3 0 0 1 9 0" />
          <path {...stroke} d="M10.5 15a3.4 3.4 0 0 1 3 0" />
          <circle {...stroke} cx="12" cy="18" r="1" />
          <path {...stroke} d="M5 5 19 19" />
        </>
      );
    case 'sqlite_ativo':
    case 'arquivo_banco_sqlite':
      return (
        <>
          <ellipse {...stroke} cx="12" cy="6.8" rx="5.8" ry="2.6" />
          <path {...stroke} d="M6.2 6.8v6.8c0 1.4 2.6 2.6 5.8 2.6s5.8-1.2 5.8-2.6V6.8" />
          <path {...stroke} d="M6.2 10.2c0 1.4 2.6 2.6 5.8 2.6s5.8-1.2 5.8-2.6" />
          <path {...stroke} d="M6.2 13.6c0 1.4 2.6 2.6 5.8 2.6s5.8-1.2 5.8-2.6" />
        </>
      );
    case 'buscar':
      return (
        <>
          <circle {...stroke} cx="10.5" cy="10.5" r="5" />
          <path {...stroke} d="m15 15 4 4" />
        </>
      );
    case 'calendario_data':
      return (
        <>
          <rect {...stroke} x="5" y="6" width="14" height="13" rx="2" />
          <path {...stroke} d="M8 4.5v3M16 4.5v3M5 10h14" />
          <path {...stroke} d="M9 13h3v3H9z" />
        </>
      );
    case 'dinheiro':
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="7.2" />
          <path {...stroke} d="M12 7.8v8.4" />
          <path {...stroke} d="M14.6 9.6c-.5-.7-1.5-1.2-2.6-1.2-1.7 0-3 .9-3 2.2 0 1.3 1.1 1.9 3 2.3 1.7.3 2.6.9 2.6 2.1 0 1.3-1.1 2.2-2.8 2.2-1.3 0-2.3-.4-3.1-1.2" />
        </>
      );
    case 'cancelar_venda':
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="7.3" />
          <path {...stroke} d="m9 9 6 6M15 9l-6 6" />
        </>
      );
    case 'finalizar_venda':
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="7.3" />
          <path {...stroke} d="m8.8 12.2 2.2 2.2 4.4-4.4" />
        </>
      );
    case 'cartao_credito':
    case 'cartao_debito':
      return (
        <>
          <rect {...stroke} x="4.5" y="6.5" width="15" height="11" rx="2.2" />
          <path {...stroke} d="M4.5 10h15" />
          <path {...stroke} d="M8 14.2h3" />
        </>
      );
    case 'pix':
      return (
        <>
          <path {...stroke} d="m12 4.8 3.2 3.2-3.2 3.2L8.8 8z" />
          <path {...stroke} d="m12 12.8 3.2 3.2-3.2 3.2-3.2-3.2z" />
          <path {...stroke} d="M10.2 9.8 6.8 13.2l2 2" />
          <path {...stroke} d="m13.8 14.2 3.4-3.4-2-2" />
        </>
      );
    case 'editar':
      return (
        <>
          <path {...stroke} d="m8 16 7.9-7.9 2 2L10 18H8z" />
          <path {...stroke} d="m14.8 6.2 2 2" />
        </>
      );
    case 'excluir':
      return (
        <>
          <path {...stroke} d="M7 7.5h10" />
          <path {...stroke} d="M9 7.5V6.3h6v1.2" />
          <path {...stroke} d="M8 7.5l.8 11h6.4l.8-11" />
          <path {...stroke} d="M10 10.2v5.2M14 10.2v5.2" />
        </>
      );
    case 'novo_item_adicionar':
      return (
        <>
          <rect {...stroke} x="5" y="5" width="14" height="14" rx="3" />
          <path {...stroke} d="M12 8v8M8 12h8" />
        </>
      );
    case 'remover_menos':
      return (
        <>
          <rect {...stroke} x="5" y="5" width="14" height="14" rx="3" />
          <path {...stroke} d="M8 12h8" />
        </>
      );
    case 'estoque_baixo':
      return (
        <>
          <path {...stroke} d="M12 5.5 4.8 18.5h14.4z" />
          <path {...stroke} d="M12 10v4" />
          <path {...stroke} d="M12 16.5h.01" />
        </>
      );
    case 'fornecedores':
      return (
        <>
          <path {...stroke} d="M4.5 15.5h10V7.5l4 2.2v5.8h1" />
          <circle {...stroke} cx="8.2" cy="17.8" r="1.4" />
          <circle {...stroke} cx="16.2" cy="17.8" r="1.4" />
        </>
      );
    case 'etiquetas':
      return (
        <>
          <path {...stroke} d="M12 4.5h7.5V12L12 19.5 4.5 12V4.5z" />
          <circle {...stroke} cx="16.3" cy="7.7" r="1" />
        </>
      );
    case 'exportar_pdf':
      return (
        <>
          <path {...stroke} d="M8 4.5h6l4 4v11H8z" />
          <path {...stroke} d="M14 4.5v4h4" />
          <path {...stroke} d="M12 10v6" />
          <path {...stroke} d="m9.5 13.5 2.5 2.5 2.5-2.5" />
        </>
      );
    case 'filtro':
      return (
        <>
          <path {...stroke} d="M5 6h14l-5.2 5.7v5.5l-3.6 1.3v-6.8z" />
        </>
      );
    case 'importar_produtos':
      return (
        <>
          <path {...stroke} d="M8 4.5h6l4 4v11H8z" />
          <path {...stroke} d="M14 4.5v4h4" />
          <path {...stroke} d="M12 16v-6" />
          <path {...stroke} d="m9.5 12.5 2.5-2.5 2.5 2.5" />
        </>
      );
    case 'imprimir':
      return (
        <>
          <path {...stroke} d="M7 8V4.8h10V8" />
          <rect {...stroke} x="5" y="8" width="14" height="7" rx="2" />
          <path {...stroke} d="M8 14.5h8v4.5H8z" />
        </>
      );
    case 'loja_ativa':
    case 'sistema_local':
      return store;
    case 'observacao':
      return (
        <>
          <path {...stroke} d="M6 5.5h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 16.5H10l-4 3v-3H6A1.5 1.5 0 0 1 4.5 15V7A1.5 1.5 0 0 1 6 5.5Z" />
        </>
      );
    case 'transferir_estoque':
      return (
        <>
          <path {...stroke} d="M7 8h9" />
          <path {...stroke} d="m13.5 5.5 2.5 2.5-2.5 2.5" />
          <path {...stroke} d="M17 16H8" />
          <path {...stroke} d="m10.5 13.5-2.5 2.5 2.5 2.5" />
        </>
      );
    case 'unidades':
      return (
        <>
          <rect {...stroke} x="5" y="6" width="5" height="5" rx="1.3" />
          <rect {...stroke} x="14" y="6" width="5" height="5" rx="1.3" />
          <rect {...stroke} x="9.5" y="13" width="5" height="5" rx="1.3" />
        </>
      );
    case 'whatsapp':
      return (
        <>
          <path {...stroke} d="M12 4.7a6.9 6.9 0 0 1 6.9 6.9c0 3.8-3.1 6.9-6.9 6.9a6.8 6.8 0 0 1-3.4-.9L5.5 18.5l.9-3.1a6.8 6.8 0 0 1-1.3-3.8A6.9 6.9 0 0 1 12 4.7Z" />
          <path {...stroke} d="M9.6 9.8c.7 1.9 2 3.2 3.9 3.9" />
        </>
      );
    default:
      return bag;
  }
}

function iconTone(name: DelphiIconName): string {
  const toneMap: Partial<Record<DelphiIconName, string>> = {
    app_logo_cadeado_carrinho: '#66a7ff',
    painel_da_loja: '#72a5ff',
    produtos: '#70a3ff',
    categorias: '#7d90ff',
    clientes: '#bb7bff',
    usuario_administrador: '#9dc2ff',
    pedidos: '#ffbf66',
    vendas_pdv: '#6ca1ff',
    caixa: '#52d38f',
    abrir_caixa: '#52d38f',
    crediario: '#a482ff',
    comprovantes: '#7ec8ff',
    relatorios: '#9b7bff',
    backup: '#68b8ff',
    configuracoes: '#92a4ff',
    auditoria_logs: '#7eb6ff',
    bloqueio_seguro: '#66e2a0',
    ajuda: '#8bb1ff',
    atualizar: '#61d6ff',
    atalhos: '#86a8ff',
    offline_local: '#5fe190',
    sqlite_ativo: '#67baff',
    arquivo_banco_sqlite: '#67baff',
    buscar: '#9ab0ff',
    calendario_data: '#9fd4ff',
    dinheiro: '#67e48e',
    cartao_credito: '#7bd5ff',
    cartao_debito: '#7bd5ff',
    pix: '#56e0c0',
    editar: '#ffd46f',
    excluir: '#ff7d8c',
    novo_item_adicionar: '#83a5ff',
    remover_menos: '#ff947f',
    estoque_baixo: '#ffad5f',
    fornecedores: '#79c6ff',
    imprimir: '#9ab4ff',
    loja_ativa: '#8a72ff',
    sistema_local: '#7f8bff',
    transferir_estoque: '#74c3ff',
    whatsapp: '#52d38f',
  };

  return toneMap[name] ?? '#8ea6ff';
}

export function AppIcon({ name, size, alt = '', className = '' }: AppIconProps): JSX.Element {
  const ariaHidden = alt ? undefined : true;

  return (
    <span
      className={`app-svg-icon ${className}`.trim()}
      style={{ width: `${size}px`, height: `${size}px`, color: iconTone(name) }}
      role={alt ? 'img' : 'presentation'}
      aria-label={alt || undefined}
      aria-hidden={ariaHidden}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" focusable="false">
        {IconSvg({ name })}
      </svg>
    </span>
  );
}
