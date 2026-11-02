import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../utils/cn";
import { FieldError } from "./FieldError";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Ontology concept URI — shown as a caption (defence-visible linked-data detail). */
  uri?: string;
}

export interface ComboboxProps {
  label: string;
  options: ComboboxOption[];
  loading?: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
}

/**
 * ARIA combobox (components.md §4): async option list, keyboard navigation,
 * concept URI shown under each option. Free text is never a valid selection —
 * the parent commits only via onSelect.
 */
export function Combobox({
  label, options, loading, inputValue, onInputChange, onSelect, placeholder, error, helperText,
}: ComboboxProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const showList = open && (loading || options.length > 0);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onSelect(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commit(activeIndex);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={cn("cp-field", "cp-combobox", error && "cp-field--error")}>
      <label className="cp-field__label" htmlFor={id}>{label}</label>
      <div className="cp-field__control">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={inputValue}
          placeholder={placeholder}
          onChange={(e) => {
            onInputChange(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so click on an option registers before the listbox unmounts.
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {showList ? (
        <ul className="cp-combobox__listbox" role="listbox" id={listboxId} aria-label={`${label} suggestions`}>
          {loading ? (
            <li className="cp-combobox__option">Loading…</li>
          ) : (
            options.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={cn("cp-combobox__option", i === activeIndex && "cp-combobox__option--active")}
                title={option.uri}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(i);
                }}
              >
                {option.label}
                {option.uri ? <span className="cp-combobox__option-uri">{option.uri}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <FieldError id={errorId} message={error} /> : helperText ? <span className="cp-field__helper">{helperText}</span> : null}
    </div>
  );
}
