import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { User } from "../../lib/api";
import { ConsentDialog } from "./ConsentDialog";

const { consent, logoutAndLeave } = vi.hoisted(() => ({ consent: vi.fn(), logoutAndLeave: vi.fn() }));
vi.mock("../../lib/api", () => ({ api: { consent, logoutAndLeave } }));

const user: User = {
  id: "u1",
  displayName: "Test Learner",
  email: "test@example.com",
  consentRequired: true,
  consentVersion: "2026-01-01",
  currentConsentVersion: "2026-10-12",
};

function renderDialog(onAccepted = vi.fn()) {
  render(
    <MemoryRouter>
      <ConsentDialog user={user} onAccepted={onAccepted} />
    </MemoryRouter>,
  );
  return onAccepted;
}

describe("ConsentDialog", () => {
  it("blocks until every policy is accepted, then records consent", async () => {
    const accepted: User = { ...user, consentRequired: false, consentVersion: "2026-10-12" };
    consent.mockResolvedValue(accepted);
    const onAccepted = renderDialog();
    const events = userEvent.setup();

    expect(screen.getByText(/terms have been updated/i)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /agree and continue/i });
    expect(button).toBeDisabled();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    await events.click(boxes[0]);
    await events.click(boxes[1]);
    expect(button).toBeDisabled();
    await events.click(boxes[2]);
    expect(button).toBeEnabled();

    await events.click(button);
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(accepted));
    expect(consent).toHaveBeenCalledTimes(1);
  });

  it("shows the server message when consent cannot be saved", async () => {
    consent.mockRejectedValue(new Error("Could not reach the server"));
    renderDialog();
    const events = userEvent.setup();
    for (const box of screen.getAllByRole("checkbox")) await events.click(box);
    await events.click(screen.getByRole("button", { name: /agree and continue/i }));
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });

  it("offers a way out: signing out", async () => {
    renderDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: /sign out/i }));
    expect(logoutAndLeave).toHaveBeenCalled();
  });
});
