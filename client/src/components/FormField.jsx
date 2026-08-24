import { useId } from 'react';

/**
 * Labelled form control. The label is bound to the input, errors are announced,
 * and aria-invalid/aria-describedby are wired up so validation is accessible.
 */
export default function FormField({
  label,
  error,
  hint,
  required = false,
  as = 'input',
  children,
  className = '',
  id: providedId,
  ...rest
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  const controlProps = {
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    required: required || undefined,
    ...rest,
  };

  let control;
  if (as === 'select') {
    control = (
      <select className={`select ${error ? 'has-error' : ''}`} {...controlProps}>
        {children}
      </select>
    );
  } else if (as === 'textarea') {
    control = <textarea className={`textarea ${error ? 'has-error' : ''}`} {...controlProps} />;
  } else if (as === 'custom') {
    control = children;
  } else {
    control = <input className={`input ${error ? 'has-error' : ''}`} {...controlProps} />;
  }

  return (
    <div className={`field ${className}`}>
      {label ? (
        <label className="field__label" htmlFor={as === 'custom' ? undefined : id}>
          {label}
          {required ? <span className="req" aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      {control}
      {hint && !error ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
