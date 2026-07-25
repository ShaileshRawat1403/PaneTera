import React, { useState, useCallback, useMemo } from 'react';
import { surface, ink, accent, status, radius, elevation, typography } from '../../theme/cssTokens';

type FormValue = string | number | boolean | string[];

interface RichField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'markdown' | 'code' | 'url' | 'date' | 'file' | 'array';
  required?: boolean;
  validate?: (value: FormValue) => string | null;
  placeholder?: string;
  description?: string;
  options?: string[];
  dependsOn?: string;
  dependsOnValue?: FormValue;
}

interface Action {
  id: string;
  label: string;
  kind: string;
  risk: string;
  requiresApproval: boolean;
}

interface RichSchemaFormProps {
  inputSchema: {
    fields: RichField[];
  };
  actions?: Action[];
  initialValues?: Record<string, FormValue>;
  onSubmitProposal?: (actionId: string, formValues: Record<string, FormValue>) => void;
  onDryRun?: (actionId: string, formValues: Record<string, FormValue>) => void;
}

const inputStyles = {
  backgroundColor: surface.sunken,
  border: `1px solid ${surface.border}`,
  borderRadius: `${radius.sm}px`,
  padding: '12px 16px',
  fontSize: '14px',
  color: ink.primary,
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s ease',
};

const labelStyles = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: ink.secondary,
  marginBottom: '6px',
};

const errorTextStyles = {
  fontSize: '12px',
  color: status.danger,
  marginTop: '4px',
};

const descriptionStyles = {
  fontSize: '12px',
  color: ink.muted,
  marginTop: '4px',
};

export const RichSchemaFormView: React.FC<RichSchemaFormProps> = ({
  inputSchema,
  actions = [],
  initialValues = {},
  onSubmitProposal,
  onDryRun,
}) => {
  const fields = inputSchema?.fields || [];
  const proposalActions = actions.filter((act) => act.kind === 'proposal' && act.requiresApproval === true);
  const unsafeActionCount = actions.length - proposalActions.length;

  const [formValues, setFormValues] = useState<Record<string, FormValue>>(() => {
    const initial: Record<string, FormValue> = {};
    fields.forEach((f) => {
      initial[f.name] = initialValues[f.name] ?? (f.type === 'boolean' ? false : f.type === 'number' ? 0 : f.type === 'array' ? [] : '');
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedAction, setSubmittedAction] = useState<string | null>(null);
  const [showDryRunPreview, setShowDryRunPreview] = useState<string | null>(null);

  const visibleFields = useMemo(() => {
    return fields.filter((f) => {
      if (!f.dependsOn) return true;
      const dependentValue = formValues[f.dependsOn];
      return dependentValue === f.dependsOnValue;
    });
  }, [fields, formValues]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    visibleFields.forEach((f) => {
      if (f.required && !formValues[f.name] && formValues[f.name] !== 0 && formValues[f.name] !== false) {
        newErrors[f.name] = `${f.label} is required`;
      }
      if (f.validate && formValues[f.name] !== undefined) {
        const error = f.validate(formValues[f.name]);
        if (error) newErrors[f.name] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [visibleFields, formValues]);

  const isFormValid = useMemo(() => {
    return visibleFields.every((f) => {
      if (f.required && !formValues[f.name] && formValues[f.name] !== 0 && formValues[f.name] !== false) {
        return false;
      }
      return true;
    });
  }, [visibleFields, formValues]);

  const handleFieldChange = (name: string, value: FormValue) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleTriggerAction = (actionId: string) => {
    if (!validate()) return;
    setSubmittedAction(actionId);
    if (onSubmitProposal) {
      onSubmitProposal(actionId, formValues);
    }
  };

  const handleDryRun = (actionId: string) => {
    if (!validate()) return;
    setShowDryRunPreview(actionId);
    if (onDryRun) {
      onDryRun(actionId, formValues);
    }
  };

  return (
    <div
      style={{
        backgroundColor: surface.raised,
        border: `1px solid ${surface.border}`,
        borderRadius: `${radius.md}px`,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxShadow: elevation.card,
      }}
    >
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: ink.primary }}>
          Interactive Execution Inputs
        </div>
        <div style={{ fontSize: '12px', color: ink.muted, marginTop: '4px' }}>
          Input schemas are owned by the native application and synced dynamically.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {visibleFields.map((f) => (
          <RichFieldRenderer
            key={f.name}
            field={f}
            value={formValues[f.name]}
            error={errors[f.name]}
            onChange={(val) => handleFieldChange(f.name, val)}
          />
        ))}
      </div>

      {/* Governing Rules Notice */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          padding: '12px',
          backgroundColor: accent.violetMuted,
          border: `1px solid ${accent.violetBorder}`,
          borderRadius: `${radius.sm}px`,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: '2px', flexShrink: 0 }}>
          <circle cx="8" cy="8" r="7" stroke={accent.violet} strokeWidth="1.5" />
          <path d="M8 5v3.5M8 10.5v.5" stroke={accent.violet} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: '12px', color: ink.secondary, lineHeight: '1.5' }}>
          <strong style={{ color: ink.primary }}>Governed Space:</strong> Direct mutations are blocked. Action triggers generate a formal execution proposal that must be signed off by the local workspace operator before runs commence.
        </div>
      </div>

      {unsafeActionCount > 0 && (
        <div
          style={{
            padding: '12px',
            backgroundColor: status.dangerMuted,
            border: `1px solid ${status.danger}`,
            borderRadius: `${radius.sm}px`,
          }}
        >
          <div style={{ fontSize: '12px', color: status.danger, fontWeight: 600 }}>
            {unsafeActionCount} app action{unsafeActionCount === 1 ? '' : 's'} hidden because only proposal actions requiring approval can be rendered.
          </div>
        </div>
      )}

      {/* Dynamic Actions Render */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
        {proposalActions.length === 0 && (
          <div style={{ fontSize: '12px', color: ink.muted, fontWeight: 600 }}>
            No approved proposal actions are available for this form.
          </div>
        )}
        {proposalActions.map((act) => {
          const isSubmitted = submittedAction === act.id;
          const label = act.label?.toLowerCase().includes('propose') ? act.label : 'Propose governed run';
          return (
            <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {act.risk && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: act.risk === 'high' ? status.dangerMuted : status.brassMuted,
                    color: act.risk === 'high' ? status.danger : status.brass,
                    border: `1px solid ${act.risk === 'high' ? status.danger : status.brass}`,
                  }}
                >
                  {act.risk.toUpperCase()} RISK
                </span>
              )}
              {onDryRun && (
                <button
                  onClick={() => handleDryRun(act.id)}
                  disabled={!isFormValid || isSubmitted}
                  style={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${surface.border}`,
                    color: ink.secondary,
                    padding: '8px 16px',
                    borderRadius: `${radius.sm}px`,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isFormValid && !isSubmitted ? 'pointer' : 'not-allowed',
                    opacity: isFormValid && !isSubmitted ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Dry Run
                </button>
              )}
              <button
                onClick={() => handleTriggerAction(act.id)}
                disabled={!isFormValid || isSubmitted}
                style={{
                  backgroundColor: accent.violet,
                  color: ink.onAccent,
                  padding: '8px 16px',
                  borderRadius: `${radius.sm}px`,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isFormValid && !isSubmitted ? 'pointer' : 'not-allowed',
                  opacity: isFormValid && !isSubmitted ? 1 : 0.5,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSubmitted ? 'Proposal Submitted' : label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Dry Run Preview */}
      {showDryRunPreview && (
        <div
          style={{
            padding: '16px',
            backgroundColor: surface.sunken,
            border: `1px solid ${surface.border}`,
            borderRadius: `${radius.sm}px`,
            marginTop: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: ink.primary, marginBottom: '8px' }}>
            Dry Run Preview
          </div>
          <div style={{ fontSize: '12px', color: ink.muted }}>
            This action would generate a proposal with the following inputs:
          </div>
          <pre
            style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: surface.base,
              borderRadius: `${radius.sm}px`,
              fontSize: '11px',
              fontFamily: typography.mono,
              color: ink.secondary,
              overflow: 'auto',
              maxHeight: '200px',
            }}
          >
            {JSON.stringify(formValues, null, 2)}
          </pre>
          <button
            onClick={() => setShowDryRunPreview(null)}
            style={{
              marginTop: '12px',
              backgroundColor: 'transparent',
              border: `1px solid ${surface.border}`,
              color: ink.secondary,
              padding: '6px 12px',
              borderRadius: `${radius.sm}px`,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Close Preview
          </button>
        </div>
      )}
    </div>
  );
};

function RichFieldRenderer({
  field,
  value,
  error,
  onChange,
}: {
  field: RichField;
  value: FormValue;
  error?: string;
  onChange: (value: FormValue) => void;
}) {
  const [arrayInput, setArrayInput] = useState('');

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = accent.violet;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = error ? status.danger : surface.border;
  };

  switch (field.type) {
    case 'boolean':
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div>
            <label style={{ ...labelStyles, marginBottom: 0 }}>
              {field.label}
              {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
            </label>
            {field.description && <div style={descriptionStyles}>{field.description}</div>}
          </div>
          <button
            type="button"
            onClick={() => onChange(!value)}
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              backgroundColor: value ? accent.violet : surface.border,
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.2s ease',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: ink.onAccent,
                position: 'absolute',
                top: '3px',
                left: value ? '23px' : '3px',
                transition: 'left 0.2s ease',
              }}
            />
          </button>
        </div>
      );

    case 'select':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              ...inputStyles,
              cursor: 'pointer',
              appearance: 'none' as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23968C82' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '32px',
            }}
          >
            <option value="">Select...</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'textarea':
    case 'markdown':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            rows={6}
            style={{
              ...inputStyles,
              resize: 'vertical' as const,
              fontFamily: typography.sans,
            }}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'code':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            rows={8}
            style={{
              ...inputStyles,
              resize: 'vertical' as const,
              fontFamily: typography.mono,
              fontSize: '13px',
              lineHeight: '1.5',
            }}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'array':
      const arrayValue = Array.isArray(value) ? value : [];
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <div
            style={{
              ...inputStyles,
              display: 'flex',
              flexWrap: 'wrap' as const,
              gap: '6px',
              minHeight: '44px',
            }}
          >
            {arrayValue.map((item, index) => (
              <span
                key={index}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: accent.violetMuted,
                  border: `1px solid ${accent.violetBorder}`,
                  borderRadius: `${radius.sm}px`,
                  fontSize: '12px',
                  color: ink.primary,
                }}
              >
                {String(item)}
                <button
                  type="button"
                  onClick={() => {
                    const newValue = arrayValue.filter((_, i) => i !== index);
                    onChange(newValue);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: ink.muted,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '14px',
                    lineHeight: '1',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={arrayInput}
              onChange={(e) => setArrayInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && arrayInput.trim()) {
                  e.preventDefault();
                  onChange([...arrayValue, arrayInput.trim()]);
                  setArrayInput('');
                }
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={arrayValue.length === 0 ? field.placeholder || 'Type and press Enter to add' : ''}
              style={{
                flex: 1,
                minWidth: '100px',
                border: 'none',
                backgroundColor: 'transparent',
                color: ink.primary,
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'url':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <input
            type="url"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder || 'https://'}
            style={inputStyles}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'date':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <input
            type="date"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              ...inputStyles,
              cursor: 'pointer',
            }}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'number':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <input
            type="number"
            value={Number(value || 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            style={inputStyles}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    case 'file':
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder || 'File path'}
            style={inputStyles}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );

    default:
      return (
        <div>
          <label style={labelStyles}>
            {field.label}
            {field.required && <span style={{ color: status.danger, marginLeft: '4px' }}>*</span>}
          </label>
          {field.description && <div style={descriptionStyles}>{field.description}</div>}
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={field.placeholder}
            style={inputStyles}
          />
          {error && <div style={errorTextStyles}>{error}</div>}
        </div>
      );
  }
}
