import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "@testing-library/react"; // Ensure React is imported
import Page from "./Page.jsx"; // Adjust path to your component

describe("Page Component", () => {
  test("submits the form successfully", async () => {
    // 1. Spy on console.log to catch the "hello world!" message
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // 2. Render the component (this replaces "creating an instance")
	render(React.createElement(Page));

    // 3. Find the checkbox and button elements
    const checkbox = screen.getByLabelText(/some checkbox/i);
    const submitButton = screen.getByRole("button", { name: /submit form/i });

    // 4. Simulate user checking the box
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // 5. Simulate user clicking the submit button
    await userEvent.click(submitButton);

    // 6. Assert that the form action was triggered
    expect(logSpy).toHaveBeenCalledWith("hello world!");

    // Cleanup the spy
    logSpy.mockRestore();
  });
});
