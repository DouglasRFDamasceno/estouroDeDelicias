import { pageSizes, totalPages } from '../domain/pagination';
interface Props {
  page: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}
export function Pagination({ page, pageSize, total, disabled, onPage, onPageSize }: Props) {
  const pages = totalPages(total, pageSize);
  const start = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <nav className="table-pagination" aria-label="Paginação da tabela">
      <p role="status">
        {start}–{Math.min(page * pageSize, total)} de {total} itens
      </p>
      <label>
        Itens por página{' '}
        <select
          value={pageSize}
          disabled={disabled}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button type="button" disabled={disabled || page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <span>
          Página {page} de {pages}
        </span>
        <button type="button" disabled={disabled || page >= pages} onClick={() => onPage(page + 1)}>
          Próxima
        </button>
      </div>
    </nav>
  );
}
