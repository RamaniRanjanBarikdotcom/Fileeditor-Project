'use client';

import React from 'react';
import {
  TOOL_OPTION_FIELDS,
  ToolOptionField,
  ToolOptionValue,
  isFieldVisible,
} from '../lib/tool-options';

interface Props {
  operation: string;
  values: Record<string, ToolOptionValue>;
  onChange: (key: string, value: ToolOptionValue) => void;
}

const labelClass = 'block text-xs font-semibold';
const labelStyle = { color: 'var(--text-secondary)' } as const;
const helpStyle = { color: 'var(--text-muted)' } as const;

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolOptionField;
  value: ToolOptionValue;
  onChange: (value: ToolOptionValue) => void;
}) {
  const id = `tool-option-${field.key}`;
  if (field.type === 'select') {
    return (
      <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {field.choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'color') {
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value || field.default}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border p-1"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
        />
        <span className="text-xs font-mono" style={helpStyle}>
          {(value || field.default).toUpperCase()}
        </span>
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        id={id}
        className="input"
        rows={3}
        value={value}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      id={id}
      className="input"
      type={field.type === 'password' ? 'password' : 'text'}
      autoComplete={field.type === 'password' ? 'new-password' : 'off'}
      value={value}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Renders the declarative settings for one operation (see lib/tool-options.ts). */
export function ToolOptionsForm({ operation, values, onChange }: Props) {
  const fields = TOOL_OPTION_FIELDS[operation] || [];
  return (
    <>
      {fields
        .filter((field) => isFieldVisible(field, values))
        .map((field) => (
          <div
            key={field.key}
            className={field.wide || field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : undefined}
          >
            <label htmlFor={`tool-option-${field.key}`} className={`${labelClass} mb-1.5`} style={labelStyle}>
              {field.label}
            </label>
            <FieldInput
              field={field}
              value={values[field.key] ?? field.default}
              onChange={(value) => onChange(field.key, value)}
            />
            {field.help && (
              <p className="mt-1 text-xs" style={helpStyle}>
                {field.help}
              </p>
            )}
          </div>
        ))}
    </>
  );
}
