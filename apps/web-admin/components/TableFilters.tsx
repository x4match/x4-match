'use client';

type SelectOption = { value: string; label: string };

type SelectField = {
  type: 'select';
  key: string;
  label: string;
  options: readonly SelectOption[];
};

type SearchField = {
  type: 'search';
  key: string;
  label?: string;
  placeholder: string;
};

export type TableFilterField = SelectField | SearchField;

type TableFiltersProps = {
  fields: TableFilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  total?: number;
  error?: string | null;
};

export function TableFilters({
  fields,
  values,
  onChange,
  onReset,
  hasActiveFilters,
  total,
  error,
}: TableFiltersProps) {
  return (
    <div className="card table-filters-card">
      <div className="filter-grid">
        {fields.map((field) => {
          const label = field.type === 'search' ? field.label ?? 'Buscar' : field.label;

          return (
            <label key={field.key} className="filter-field">
              <span className="filter-label">{label}</span>
              {field.type === 'search' ? (
                <input
                  className="input filter-control"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                />
              ) : (
                <select
                  className="input filter-control"
                  value={values[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                >
                  {field.options.map((option) => (
                    <option key={option.value || '__all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
          );
        })}
      </div>

      <div className="table-filters-meta">
        {error ? <span className="table-filters-error">{error}</span> : null}
        {total != null && !error ? <span className="table-filters-count">{total} resultados</span> : null}
        {hasActiveFilters && onReset ? (
          <button className="btn btn-outline table-filters-reset" type="button" onClick={onReset}>
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
