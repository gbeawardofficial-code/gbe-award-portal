import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NominationsClosed } from "@/components/shared/nominations-closed";

vi.mock("@/components/brand/app-logo", () => ({
  AppLogo: () => <span>GBE Awards</span>,
}));
afterEach(cleanup);

describe("closed nomination page", () => {
  it("shows only the fixed ribbon, winners message and essential navigation", () => {
    const { container } = render(<NominationsClosed />);
    expect(screen.getByLabelText("Nominations closed")).toHaveClass(
      "fixed",
      "top-0",
      "h-12",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Congratulations to our 2026 winners.",
    );
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.queryByText(
        /Step 1|Nominee details|Download Event Brochure|View Program Details/,
      ),
    ).not.toBeInTheDocument();
    expect(container.querySelector("header")).toHaveClass("top-12");
    expect(container.firstChild).toHaveClass("min-h-svh", "pt-12");
    expect(
      screen.getByRole("link", { name: "info@gbeaward.com" }),
    ).toHaveAttribute("href", "mailto:info@gbeaward.com");
  });
});
