import { useState } from 'react';
import { measureFamily, measureUnits } from '../domain/costs';
import type { MeasureUnit } from '../domain/costs';
import { money } from '../domain/format';
import { recipeLineCost, searchMaterials } from '../services/costs';
import type { MaterialOption, RecipeLine, RecipeOption } from '../services/costs';
import { ActionIconButton } from './ActionIconButton';
import { SearchSelect } from './SearchSelect';
import type { SearchOption } from './SearchSelect';

export function RecipeLinesEditor({
  lines,
  onChange,
  disabled,
  loadBases,
  packagingFor,
}: {
  lines: RecipeLine[];
  onChange: (lines: RecipeLine[]) => void;
  disabled: boolean;
  loadBases?: (
    search: string,
    page: number,
    signal: AbortSignal,
  ) => Promise<{ rows: SearchOption[]; total: number }>;
  packagingFor?: string;
}) {
  const [error, setError] = useState('');
  const GroupHeading = packagingFor ? 'h5' : 'h4';
  const groups = new Map<
    string,
    { label: string; entries: { line: RecipeLine; index: number }[] }
  >();
  lines.forEach((line, index) => {
    const key = line.kind === 'recipe' ? 'recipe' : `material:${line.material.category || ''}`;
    if (!groups.has(key))
      groups.set(key, {
        label: line.kind === 'recipe' ? 'Receitas base' : line.material.category || 'Sem categoria',
        entries: [],
      });
    groups.get(key)!.entries.push({ line, index });
  });
  function add(line: RecipeLine) {
    const sourceId = line.kind === 'material' ? line.material.id : line.recipe.id;
    if (
      lines.some(
        (l) =>
          l.kind === line.kind &&
          (l.kind === 'material' ? l.material.id : l.recipe.id) === sourceId,
      )
    ) {
      setError('Item já adicionado. Ajuste sua quantidade abaixo.');
      return;
    }
    setError('');
    onChange([...lines, line]);
  }
  return (
    <>
      <SearchSelect
        label={packagingFor ? `Adicionar embalagem para ${packagingFor}` : 'Adicionar insumo'}
        value={null}
        load={searchMaterials}
        placeholder="Buscar insumo por nome"
        disabled={disabled || lines.length >= (packagingFor ? 10 : 50)}
        onSelect={(option) => {
          if (!option) return;
          const material = (option as MaterialOption).material;
          add({
            kind: 'material',
            material,
            quantity: '',
            unit: packagingFor
              ? material.purchase_unit
              : material.purchase_unit === 'kg'
                ? 'g'
                : material.purchase_unit === 'l'
                  ? 'ml'
                  : material.purchase_unit,
          });
        }}
      />
      {loadBases && (
        <SearchSelect
          label="Adicionar receita base"
          value={null}
          load={loadBases}
          placeholder="Buscar receita já cadastrada"
          disabled={disabled || lines.length >= 50}
          onSelect={(option) => {
            if (!option) return;
            const recipe = (option as RecipeOption).recipe;
            add({
              kind: 'recipe',
              recipe,
              quantity: '',
              unit:
                recipe.output_unit === 'kg'
                  ? 'g'
                  : recipe.output_unit === 'l'
                    ? 'ml'
                    : recipe.output_unit,
            });
          }}
        />
      )}
      {error && <p role="alert">{error}</p>}
      {[...groups.entries()].map(([key, group]) => (
        <section className="recipe-ingredient-group" key={key} aria-label={group.label}>
          <GroupHeading>{group.label}</GroupHeading>
          <ul className="recipe-lines">
            {group.entries.map(({ line: l, index }) => {
              const source = l.kind === 'material' ? l.material : l.recipe;
              const unit = l.kind === 'material' ? l.material.purchase_unit : l.recipe.output_unit;
              const quantity =
                l.kind === 'material' ? l.material.purchase_quantity : l.recipe.output_quantity;
              const price =
                l.kind === 'material' ? l.material.price_cents : l.recipe.raw_total_cents;
              const cost = recipeLineCost(l);
              return (
                <li key={`${l.kind}:${source.id}`}>
                  <strong>
                    {source.name}
                    <small>
                      {quantity} {unit} por {money(price)}
                    </small>
                  </strong>
                  <div className="sale-fields">
                    <label>
                      {packagingFor
                        ? 'Quantidade por pacote'
                        : `Quantidade usada de ${source.name}`}
                      <input
                        aria-label={
                          packagingFor
                            ? `Quantidade por pacote de ${source.name} (${packagingFor})`
                            : undefined
                        }
                        required
                        inputMode="decimal"
                        value={l.quantity}
                        placeholder={packagingFor ? '1' : '200'}
                        onChange={(e) =>
                          onChange(
                            lines.map((r, i) =>
                              i === index ? { ...r, quantity: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      {packagingFor ? 'Unidade' : `Unidade de ${source.name}`}
                      <select
                        aria-label={
                          packagingFor ? `Unidade de ${source.name} (${packagingFor})` : undefined
                        }
                        value={l.unit}
                        onChange={(e) =>
                          onChange(
                            lines.map((r, i) =>
                              i === index ? { ...r, unit: e.target.value as MeasureUnit } : r,
                            ),
                          )
                        }
                      >
                        {measureUnits
                          .filter((u) => measureFamily(u) === measureFamily(unit))
                          .map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="recipe-line-total">
                    <span>
                      {cost === null ? 'Informe uma quantidade válida' : `Custo: ${money(cost)}`}
                    </span>
                    <ActionIconButton
                      action="remove"
                      label={`Remover ${source.name}${packagingFor ? ` de ${packagingFor}` : ' da receita'}`}
                      disabled={disabled}
                      onClick={() => onChange(lines.filter((_, i) => i !== index))}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
