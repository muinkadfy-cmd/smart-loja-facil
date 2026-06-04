# Legado CSS desativado — Lote 118

## Decisão
A partir do Lote 118, o carregamento principal da interface passa a usar somente:

- `src/styles.css`
- `src/styles/lote118-foundation-final.css`

O arquivo `src/master-ui.css` deixa de ser carregado no `src/main.tsx` para reduzir conflito visual, `overflow`, `height: 100vh`, `position: fixed/sticky` e excesso de `!important` acumulado.

## CSS antigos que não devem voltar ao main.tsx
Os arquivos de `src/styles/lote77` até `src/styles/lote117` são considerados legado visual. Eles podem permanecer no repositório como histórico, mas não devem ser importados novamente sem auditoria.

## Limpeza física controlada
Para remover os arquivos antigos do diretório `src/styles`, rode:

```powershell
npm run css:clean-legacy
```

Esse comando remove apenas CSS com nome `lote77` até `lote117`, preservando `lote118-foundation-final.css`.

## Motivo
A base tinha muitas camadas ativas competindo sobre os mesmos seletores:

- `.neo-shell`
- `.neo-layout`
- `.neo-main`
- `.neo-topbar`
- `.neo-sidebar`
- `.neo-page-shell`
- `.neo-mobile-dock`
- `.neo-kpi-card`
- `.classic-panel`
- `.data-table-shell`

Isso causava scroll preso, conteúdo atrás do bottom nav, cards grandes demais, tela espremida e comportamento diferente entre abas.

## Regra daqui para frente
Todo novo ajuste visual deve entrar em uma camada atual controlada, não em dezenas de arquivos por cima. Se precisar criar lote novo, ele deve substituir a fundação anterior ou ser integrado nela depois de validado.
