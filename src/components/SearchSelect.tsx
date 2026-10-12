import { useEffect, useId, useRef, useState } from 'react';
import { FieldClearButton } from './ClearableInput';
export interface SearchOption {
  id: string;
  label: string;
  description?: string;
}
interface Props {
  label: string;
  value: SearchOption | null;
  placeholder?: string;
  disabled?: boolean;
  showHint?: boolean;
  load: (
    search: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<{ rows: SearchOption[]; total: number }>;
  onSelect: (option: SearchOption | null) => void;
  onCreate?: (name: string) => Promise<SearchOption>;
}
export function SearchSelect({
  label,
  value,
  placeholder,
  disabled,
  showHint = true,
  load,
  onSelect,
  onCreate,
}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const [rows, setRows] = useState<SearchOption[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [active, setActive] = useState(-1),
    [revision, setRevision] = useState(0),
    [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setRows([]);
    setError('');
    setActive(-1);
    const timeout = setTimeout(() => controller.abort(), 15000);
    const debounce = setTimeout(() => {
      load(search, page, controller.signal)
        .then((r) => {
          if (current) {
            setRows(r.rows);
            setTotal(r.total);
          }
        })
        .catch(() => {
          if (current) setError('Não foi possível buscar as opções.');
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(debounce);
    };
  }, [open, disabled, search, page, load, revision]);
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);
  function choose(option: SearchOption) {
    onSelect(option);
    input.current?.focus();
    setOpen(false);
    setSearch('');
  }
  function close() {
    setOpen(false);
    setSearch('');
    setPage(1);
  }
  async function create() {
    if (!onCreate || creating) return;
    setCreating(true);
    setError('');
    try {
      choose(await onCreate(search.trim()));
    } catch {
      setError('Não foi possível cadastrar o cliente. Tente novamente.');
    } finally {
      setCreating(false);
    }
  }
  return (
    <div
      ref={root}
      className="search-select"
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="clearable-field">
        <input
          id={id}
          className="clearable-input"
          ref={input}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && !disabled}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-describedby={`${id}-hint`}
          disabled={disabled || creating}
          maxLength={120}
          placeholder={placeholder}
          value={open ? search : (value?.label ?? '')}
          onFocus={() => {
            setOpen(true);
            setSearch('');
            setPage(1);
          }}
          onClick={() => {
            if (!open) {
              setSearch('');
              setPage(1);
              setActive(-1);
              setOpen(true);
            }
          }}
          onChange={(e) => {
            if (value) onSelect(null);
            setSearch(e.target.value);
            setPage(1);
            setActive(-1);
            setRows([]);
            setLoading(true);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              setActive((a) =>
                rows.length
                  ? Math.max(0, Math.min(rows.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1)))
                  : -1,
              );
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open && active >= 0 && rows[active]) choose(rows[active]);
            }
          }}
        />
        {(value || (open && search)) && (
          <FieldClearButton
            label={label}
            disabled={disabled || creating}
            onClear={() => {
              if (value) onSelect(null);
              input.current?.focus();
              close();
            }}
          />
        )}
      </div>
      <small id={`${id}-hint`} className={showHint ? undefined : 'sr-only'}>
        {value ? `Selecionado: ${value.label}` : 'Digite para buscar e selecione uma opção.'}
      </small>
      {open && !disabled && (
        <div className="search-select-popup">
          <ul id={`${id}-list`} role="listbox" aria-label={label} aria-busy={loading}>
            {rows.map((option, index) => (
              <li
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value?.id === option.id}
                key={option.id}
                className={active === index ? 'focused' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
              >
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </li>
            ))}
          </ul>
          {loading ? (
            <p role="status">Buscando…</p>
          ) : error ? (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => setRevision((v) => v + 1)}>
                Tentar novamente
              </button>
            </p>
          ) : (
            !rows.length && <p role="status">Nenhum resultado encontrado.</p>
          )}
          {!loading && !error && total > 10 && (
            <div className="search-select-pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
                Anterior
              </button>
              <span>
                {page} de {Math.max(1, Math.ceil(total / 10))}
              </span>
              <button
                type="button"
                disabled={page * 10 >= total}
                onClick={() => setPage((v) => v + 1)}
              >
                Próxima
              </button>
            </div>
          )}
          {onCreate && search.trim().length >= 2 && !loading && !error && (
            <button
              type="button"
              className="search-select-create"
              disabled={creating}
              onClick={create}
            >
              {creating ? 'Cadastrando…' : `Cadastrar cliente “${search.trim()}”`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
