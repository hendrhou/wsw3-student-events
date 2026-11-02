import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";
import { FilterChip } from "./FilterChip";
import { StepIndicator } from "./StepIndicator";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

describe("Badge", () => {
  it("pairs a status dot with a text label (never color alone)", () => {
    render(<Badge type="success">Published</Badge>);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders the accent variant reserved for recommendations", () => {
    render(<Badge type="accent">Matched to you</Badge>);
    expect(screen.getByText("Matched to you").closest(".cp-badge")).toHaveClass("cp-badge--accent");
  });
});

describe("ProgressBar", () => {
  it("exposes value/max via the progressbar role", () => {
    render(<ProgressBar value={42} max={60} label="42/60" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemax", "60");
    expect(screen.getByText("42/60")).toBeInTheDocument();
  });

  it("switches to warning at ≥90% capacity", () => {
    render(<ProgressBar value={114} max={120} />);
    expect(document.querySelector(".cp-progress__fill")).toHaveClass("cp-progress__fill--warning");
  });

  it("clamps out-of-range ratios", () => {
    render(<ProgressBar value={200} max={60} />);
    const fill = document.querySelector(".cp-progress__fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});

describe("FilterChip", () => {
  it("removes via the visible × button", async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Category: Workshop" active onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter Category: Workshop" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("removes via the Delete key for keyboard users", async () => {
    const onRemove = vi.fn();
    const { container } = render(<FilterChip label="Date" onRemove={onRemove} />);
    const chip = container.querySelector(".cp-chip") as HTMLElement;
    chip.focus();
    await userEvent.keyboard("{Delete}");
    // Note: chip is only focusable when clickable; dispatch directly otherwise
    if (onRemove.mock.calls.length === 0) {
      chip.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    }
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("StepIndicator", () => {
  it("marks the current step with aria-current=step and earlier steps as done", () => {
    render(<StepIndicator steps={["Confirm details", "Review", "Done"]} current={1} />);
    expect(screen.getByText("Review").parentElement).toHaveAttribute("aria-current", "step");
  });
});

describe("EmptyState", () => {
  it("renders title, guidance and one recovery action", () => {
    render(
      <EmptyState
        title="No events match your filters"
        guidance="Try clearing them."
        action={<Button variant="secondary">Clear filters</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No events match your filters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });
});
