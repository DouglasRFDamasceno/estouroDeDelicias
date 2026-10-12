import { useState } from 'react';
import { parseQuantity, recipeComponentCost } from '../domain/costs';
import type { MeasureUnit } from '../domain/costs';
import { money } from '../domain/format';
import { recipeLineCost } from '../services/costs';
import type { RecipePresentation } from '../services/costs';
import { searchSaleProducts } from '../services/saleOptions';
import type { ProductOption } from '../services/saleOptions';
import { ActionIconButton } from './ActionIconButton';
import { SearchSelect } from './SearchSelect';
import { RecipeLinesEditor } from './RecipeLinesEditor';

export function RecipePresentations({
  value,
  onChange,
  total,
  outputQuantity,
  outputUnit,
  disabled,
}: {
  value: RecipePresentation[];
  onChange: (value: RecipePresentation[]) => void;
  total: number | null;
  outputQuantity: string;
  outputUnit: MeasureUnit;
  disabled: boolean;
}) {
  const [error, setError] = useState('');
  return (
    <section className="recipe-presentations" aria-label="Apresentações da receita">
      <h3>Apresentações e embalagens</h3>
      <p className="fine">
        Adicione os produtos que usam esta preparação, como 50 g, 100 g e 150 g. O peso líquido vem
        do cadastro de produtos. A categoria da receita acompanha a primeira apresentação.
      </p>
      <SearchSelect
        label="Adicionar apresentação"
        value={null}
        load={searchSaleProducts}
        placeholder="Buscar produto do mesmo sabor"
        disabled={disabled || value.length >= 50}
        onSelect={(option) => {
          if (!option) return;
          const product = (option as ProductOption).product;
          if (value.some((p) => p.product.id === product.id)) {
            setError('Esta apresentação já foi adicionada.');
            return;
          }
          if (!product.weight_grams) {
            setError(
              `Informe o peso líquido (g) em Produtos para ${product.name} · ${product.presentation} antes de adicioná-lo.`,
            );
            return;
          }
          setError('');
          onChange([...value, { product, packaging: [] }]);
        }}
      />
      {error && <p role="alert">{error}</p>}
      {!value.length && (
        <p className="fine">
          Sem apresentações, a receita fica disponível como base de outras preparações.
        </p>
      )}
      {value.map((p, index) => {
        const label = `${p.product.name} · ${p.product.presentation}`;
        const packageCosts = p.packaging.map(recipeLineCost);
        const packaging = packageCosts.every((c) => c !== null)
          ? packageCosts.reduce<number>((sum, c) => sum + (c ?? 0), 0)
          : null;
        let ingredients: number | null = null;
        try {
          if (total !== null && p.product.weight_grams)
            ingredients = recipeComponentCost(
              total,
              parseQuantity(outputQuantity),
              outputUnit,
              p.product.weight_grams,
              'g',
            );
        } catch {
          /* A prévia aguarda rendimento compatível. */
        }
        return (
          <section key={p.product.id} className="recipe-presentation" aria-label={label}>
            <div className="panel-heading">
              <div>
                <h4>{label}</h4>
                <p>{p.product.weight_grams} g líquidos</p>
              </div>
              <ActionIconButton
                action="remove"
                label={`Remover apresentação ${label}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              />
            </div>
            <details
              className="recipe-packaging-details"
              onInvalidCapture={(event) => {
                event.currentTarget.open = true;
              }}
            >
              <summary>
                Embalagens por pacote · {p.packaging.length}{' '}
                {p.packaging.length === 1 ? 'insumo' : 'insumos'}
              </summary>
              <p className="fine">
                Embalagens por pacote: adicione saco, etiqueta, laço ou outros insumos. Eles serão
                somados integralmente ao custo desta apresentação.
              </p>
              <RecipeLinesEditor
                lines={p.packaging}
                onChange={(packaging) =>
                  onChange(value.map((r, i) => (i === index ? { ...r, packaging } : r)))
                }
                disabled={disabled}
                packagingFor={label}
              />
            </details>
            {!p.packaging.length && (
              <p className="fine">
                Sem embalagem configurada. A prévia inclui apenas o custo da preparação.
              </p>
            )}
            <dl className="recipe-portion-cost">
              <div>
                <dt>Pipoca</dt>
                <dd>{ingredients === null ? '—' : money(ingredients)}</dd>
              </div>
              <div>
                <dt>Embalagem</dt>
                <dd>{packaging === null ? '—' : money(packaging)}</dd>
              </div>
              <div>
                <dt>Custo por pacote</dt>
                <dd>
                  {ingredients === null || packaging === null
                    ? '—'
                    : money(ingredients + packaging)}
                </dd>
              </div>
            </dl>
          </section>
        );
      })}
    </section>
  );
}
