import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, ScanResultModal } from "./Modal";
import { ToastRegion, type ToastData } from "./Toast";
import { Button } from "./Button";

describe("Modal", () => {
  it("renders a labelled dialog with a close button when open", () => {
    render(<Modal open onClose={() => {}} title="Cancel event">Body</Modal>);
    expect(screen.getByRole("dialog", { name: "Cancel event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden">Body</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Dialog">Body</Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the scrim is clicked, but not when the dialog body is clicked", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Dialog">Body</Modal>);
    await userEvent.click(screen.getByText("Body"));
    expect(onClose).not.toHaveBeenCalled();
    const scrim = screen.getByRole("dialog").parentElement as HTMLElement;
    await userEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog on open", () => {
    render(
      <Modal open onClose={() => {}} title="Focus" footer={<Button>Confirm</Button>}>
        Body
      </Modal>,
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

describe("ScanResultModal", () => {
  it("announces the result as an alertdialog with the attendee name", () => {
    render(<ScanResultModal open type="success" name="Ana Silva" detail="20220123" />);
    expect(screen.getByRole("alertdialog", { name: "Ana Silva" })).toBeInTheDocument();
    expect(screen.getByText("20220123")).toBeInTheDocument();
  });
});

describe("ToastRegion", () => {
  const make = (id: string): ToastData => ({ id, type: "success", message: `Saved ${id}` });

  it("renders toasts in a polite live region", () => {
    render(<ToastRegion toasts={[make("1")]} onDismiss={() => {}} />);
    expect(screen.getByText("Saved 1")).toBeInTheDocument();
  });

  it("stacks at most 3 toasts", () => {
    render(<ToastRegion toasts={[make("1"), make("2"), make("3"), make("4")]} onDismiss={() => {}} />);
    expect(screen.queryByText("Saved 1")).not.toBeInTheDocument();
    expect(screen.getByText("Saved 4")).toBeInTheDocument();
  });

  it("auto-dismisses after 4s", async () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<ToastRegion toasts={[make("1")]} onDismiss={onDismiss} />);
      vi.advanceTimersByTime(4100);
      expect(onDismiss).toHaveBeenCalledWith("1");
    } finally {
      vi.useRealTimers();
    }
  });
});
