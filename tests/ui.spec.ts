import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("preview supports discovery and accessible studio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Desktop connection unavailable.")).toBeVisible();
  await page.getByLabel("Game", { exact: true }).selectOption("Terraria");
  await page.getByRole("button", { name: /The Wildwood/ }).click();
  await expect(
    page.getByRole("heading", { name: "The Wildwood" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Make it mine" }).click();
  await expect(
    page.getByRole("heading", { name: "Make it yours." }),
  ).toBeVisible();
  await page.getByLabel("Enemy health").fill("1.5");
  await expect(page.getByLabel("Enemy health")).toHaveValue("1.5");
  await page.getByRole("button", { name: "Build my change" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("narrow preview navigation and unavailable action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "My library" }).click();
  await expect(
    page.getByRole("heading", { name: "My library." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Import project" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Desktop connection unavailable",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("long project names and keyboard review work with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Long strides/ }).click();
  await page.getByRole("button", { name: "Make it mine" }).click();
  const name = page.getByLabel("Project name");
  await name.fill("W".repeat(80));
  await expect(name).toHaveValue("W".repeat(80));
  await expect(
    page.getByRole("heading", { name: "W".repeat(80) }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const trigger = page.getByRole("button", { name: "Build my change" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(
    await page
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("1e-05s");
});

test("game filters and studio controls follow the selected recipe", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Long strides/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Long strides/ }).click();
  await expect(page.getByText("Minetest Game / Luanti")).toBeVisible();
  await page.getByRole("button", { name: "Make it mine" }).click();
  await expect(page.getByLabel("Speed")).toHaveValue("1.5");
  await expect(page.getByLabel("Jump")).toBeVisible();
  await expect(page.getByLabel("Gravity")).toBeVisible();
  await expect(page.getByLabel("Enemy health")).toHaveCount(0);
  await page.getByRole("button", { name: "Choose another idea" }).click();
  await page.getByLabel("Game", { exact: true }).selectOption("Terraria");
  await expect(page.getByRole("button", { name: /Long strides/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /The Wildwood/ }).click();
  await expect(
    page.getByText("Terraria / tModLoader · experimental"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Make it mine" }).click();
  await expect(page.getByLabel("Enemy health")).toBeVisible();
  await expect(page.getByLabel("Damage")).toBeVisible();
  await expect(page.getByLabel("Coins")).toBeVisible();
  await expect(page.getByLabel("Speed")).toHaveCount(0);
});

test("free game setup is unavailable in preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Setup and help/ }).click();
  await expect(
    page.getByRole("heading", { name: "Free game: Minetest Game" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Set up free game" }),
  ).toBeDisabled();
  await expect(page.getByText(/approximately 25 MB/)).toBeVisible();
});
