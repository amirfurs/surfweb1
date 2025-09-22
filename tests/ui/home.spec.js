const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "../../");
const homeUrl = pathToFileURL(path.join(root, "index.html")).href;

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("واجهة الصفحة الرئيسية", () => {
  test("تظهر العناصر الأساسية وتجتاز لقطة الشاشة", async ({ page }) => {
    await page.goto(homeUrl);
    await delay();

    await expect(page.locator(".top-bar")).toBeVisible();
    await expect(page.locator(".hero")).toBeVisible();
    await expect(page.locator(".article-card").first()).toBeVisible();
    await expect(page.locator(".sidebar")).toBeVisible();

    const { project } = test.info();
    await expect(page).toHaveScreenshot(`home-${project.name}.png`, { fullPage: true });
  });

  test("التصفية حسب الوسوم تعمل دون إعادة تحميل", async ({ page }) => {
    await page.goto(homeUrl);
    await delay();

    const logicTagButton = page.getByRole("button", { name: /#المنطق/ });
    await logicTagButton.click();
    await expect(logicTagButton).toHaveClass(/active/);

    const visibleCount = await page.locator(".article-card:visible").count();
    expect(visibleCount).toBeGreaterThan(0);
    await expect(page.locator(".results-count")).toHaveText(/مقالة|مقالات/);
  });
});
