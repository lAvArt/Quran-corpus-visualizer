import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="child">Works fine</div>;
}

describe("ErrorBoundary", () => {
  it("should render children when no error", () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(getByTestId("child")).toBeInTheDocument();
  });

  it("should render fallback UI when child throws", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getByRole, getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByRole("alert")).toBeInTheDocument();
    expect(getByText("Test error")).toBeInTheDocument();
    expect(getByText("Try Again")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should render custom fallback when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getByText } = render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("Custom fallback")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should show component name in error message", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { getByText } = render(
      <ErrorBoundary name="Visualization">
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText("Visualization encountered an error")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("should call onError callback when error occurs", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe("Test error");

    consoleSpy.mockRestore();
  });
});
