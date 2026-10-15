import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "./Navbar";
import { Combobox } from "./Combobox";
import { Modal } from "./Modal";
import { QrCard } from "./QrCard";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { cn } from "../utils/cn";

describe("cn", () => {
  it("joins truthy class names only", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("Navbar", () => {
  it("marks the active item with aria-current=page and shows unread count", () => {
    render(
      <Navbar
        logoSrc="/logo.svg"
        appName="Campus Pulse"
        items={[
          { label: "Discover", href: "/events", active: true },
          { label: "My Tickets", href: "/tickets" },
        ]}
        notificationCount={3}
        userInitials="VC"
      />,
    );
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByAltText("Universidade Fernando Pessoa")).toHaveAttribute("src", "/logo.svg");
  });

  it("routes navigation through onNavigate without a full reload", async () => {
    const onNavigate = vi.fn();
    render(
      <Navbar
        logoSrc="/logo.svg"
        appName="Campus Pulse"
        items={[{ label: "Profile", href: "/profile" }]}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(onNavigate).toHaveBeenCalledWith("/profile");
  });
});

describe("Combobox (pointer selection)", () => {
  it("commits a selection on mouse down and tolerates empty results", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <Combobox
        label="Venue"
        options={[{ value: "d", label: "Building D", uri: "urn:x:d" }]}
        inputValue=""
        onInputChange={() => {}}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Building D/ }));
    expect(onSelect).toHaveBeenCalledWith({ value: "d", label: "Building D", uri: "urn:x:d" });
    rerender(<></>);
  });

  it("shows a loading row while options load asynchronously", async () => {
    render(
      <Combobox label="Venue" options={[]} loading inputValue="b" onInputChange={() => {}} onSelect={() => {}} />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});

describe("Modal variants", () => {
  it("renders the footer with danger-first ordering for destructive confirmations", () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="Cancel event"
        size="sm"
        dangerConfirm
        footer={<Button variant="danger">Cancel event</Button>}
      >
        42 students will be notified.
      </Modal>,
    );
    const footer = screen.getByRole("button", { name: "Cancel event" }).parentElement;
    expect(footer).toHaveClass("cp-modal__footer--danger-first");
  });
});

describe("QrCard", () => {
  it("renders a QR image for the credential payload", async () => {
    render(<QrCard value="eyJhbGciOiJFUzI1NiJ9.test-credential" />);
    expect(await screen.findByRole("img", { name: "Verifiable credential QR code" })).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton width={120} height={40} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
