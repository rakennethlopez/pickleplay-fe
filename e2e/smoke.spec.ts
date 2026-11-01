import { expect, test } from "@playwright/test";

test("home page offers to book a court", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your court is waiting." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Book a Court" })).toBeVisible();
});
