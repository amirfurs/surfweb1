const { test, expect } = require("@playwright/test");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "../../");
const adminUrl = pathToFileURL(path.join(root, "admin.html")).href;

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const loginAsAdmin = async (page) => {
  const popup = page.locator("#authPopup");
  await popup.waitFor({ state: "visible" });
  await popup.getByLabel("البريد الإلكتروني").fill("admin@aqala.com");
  await popup.getByLabel("كلمة المرور").fill("aqala123");
  await popup.getByRole("button", { name: "دخول" }).click();
  await popup.waitFor({ state: "hidden" });
  await delay();
};

test.describe("لوحة التحكم", () => {
  test("تعرض المؤشرات واللوحات الرئيسة", async ({ page }) => {
    await page.goto(adminUrl);
    await delay();
    await loginAsAdmin(page);

    await expect(page.locator(".metrics .metric-card").first()).toBeVisible();
    await expect(page.locator(".panel#articles-panel")).toBeVisible();
    await expect(page.locator(".panel#polls-panel")).toBeVisible();

    const { project } = test.info();
    await expect(page).toHaveScreenshot(`admin-${project.name}.png`, { fullPage: true });
  });

  test("يمكن حفظ مقال جديد بعد تسجيل الدخول", async ({ page }) => {
    await page.goto(adminUrl);
    await delay();
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "+ إضافة مقال" }).click();
    const modal = page.locator("#articleModal[aria-hidden='false']");
    await expect(modal).toBeVisible();

    await modal.getByLabel("العنوان").fill("مقال تجريبي من Playwright");
    await modal.getByLabel("التصنيف").selectOption("logic");
    await modal.getByLabel("الوسوم").fill("اختبار, Playwright");
    await modal.locator(".wysiwyg").fill("هذا المحتوى تمت إضافته تلقائياً للتأكد من أن تدفق الإدارة يعمل.");
    await modal.getByRole("button", { name: "حفظ ونشر" }).click();

    const status = modal.locator(".form-status");
    await expect(status).toBeVisible();
    await expect(status).toContainText(/تم حفظ المقال|تم الحفظ/);
  });
});
