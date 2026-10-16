import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, TextArea } from "./Input";
import { Select } from "./Select";
import { Checkbox } from "./Checkbox";
import { Combobox } from "./Combobox";

describe("Input", () => {
  it("associates a visible label with the control", () => {
    render(<Input label="Title" />);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("surfaces errors via role=alert and marks the control invalid", () => {
    render(<Input label="Title" error="Title is required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Title is required");
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when there is no error", () => {
    render(<Input label="Capacity" helperText="Minimum 1" />);
    expect(screen.getByText("Minimum 1")).toBeInTheDocument();
  });
});

describe("TextArea", () => {
  it("renders a character counter when maxLength is set", () => {
    render(<TextArea label="Short description" maxLength={200} value="Hello" onChange={() => {}} />);
    expect(screen.getByText("5/200")).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("renders options and placeholder", () => {
    render(<Select label="Category" placeholder="Select…" options={[{ value: "ws", label: "Workshop" }]} />);
    const select = screen.getByLabelText("Category");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Workshop" })).toBeInTheDocument();
  });
});

describe("Checkbox", () => {
  it("toggles via the clickable label", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="I agree to the attendance policy" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("I agree to the attendance policy"));
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Combobox", () => {
  const options = [
    { value: "sw", label: "Semantic Web", uri: "https://campus-pulse.ufp.pt/ontology#SemanticWeb" },
    { value: "ld", label: "Linked Data", uri: "https://campus-pulse.ufp.pt/ontology#LinkedData" },
  ];

  function setup() {
    const onSelect = vi.fn();
    const onInputChange = vi.fn();
    render(
      <Combobox
        label="Add interest"
        options={options}
        inputValue="sem"
        onInputChange={onInputChange}
        onSelect={onSelect}
      />,
    );
    return { onSelect, onInputChange };
  }

  it("follows the ARIA combobox pattern", () => {
    setup();
    const input = screen.getByRole("combobox", { name: "Add interest" });
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("commits a selection with the keyboard (ArrowDown + Enter) and shows concept URIs", async () => {
    const { onSelect } = setup();
    const input = screen.getByRole("combobox");
    input.focus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(options[0]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the listbox on Escape without selecting", async () => {
    const { onSelect } = setup();
    const input = screen.getByRole("combobox");
    input.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
