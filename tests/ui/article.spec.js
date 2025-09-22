const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "../../");
const articleUrl = pathToFileURL(path.join(root, "article.html")).href;

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("عرض المقال التفصيلي", () => {
  test("يعرض البنية الكاملة للمقال", async ({ page }) => {
    await page.goto(articleUrl);
    await delay();

    await expect(page.locator(".article-detail h1")).toHaveText(/كيف نبني خطاباً/);
    await expect(page.locator(".article-sidebar")).toBeVisible();
    await expect(page.locator(".read-also .article-card").first()).toBeVisible();

    const { project } = test.info();
    await expect(page).toHaveScreenshot(`article-${project.name}.png`, { fullPage: true });
  });

  test("يظهر تنبيه مناسب عند فشل إرسال التقييم", async ({ page }) => {
    await page.goto(articleUrl);
    await delay();

    await page.getByLabel("ممتاز").check();
    await page.getByRole("button", { name: "إرسال" }).click();

    await expect(page.locator(".rating-form .form-status")).toBeVisible();
    await expect(page.locator(".rating-form .form-status")).toContainText(/تعذّر|تم/);
  });
});

