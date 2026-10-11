# Tabelas da gestão

- Toda tabela com dados reais deve ter paginação no backend. Não carregar todos os registros para paginar com slice no frontend.
- Filtros, ordenação e total de registros também devem ser calculados no backend, respeitando RLS.
- Reutilizar `src/components/Pagination.tsx` e `src/domain/pagination.ts`. Limitar tamanhos de página e permitir apenas colunas de ordenação conhecidas, com desempate por chave única.
- Ao alterar filtros, ordenação ou tamanho de página, voltar à primeira página. Após exclusões, corrigir páginas vazias.
