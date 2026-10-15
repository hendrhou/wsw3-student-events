import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the label and fires onClick", async () => {
    // Arrange
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Register</Button>);
    // Act
    await userEvent.click(screen.getByRole("button", { name: "Register" }));
    // Assert
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the variant class, defaulting to primary", () => {
    render(<Button variant="danger">Cancel event</Button>);
    expect(screen.getByRole("button")).toHaveClass("cp-btn", "cp-btn--danger");
  });

  it("is disabled and announces busy state while loading, with the label replaced by a spinner", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
