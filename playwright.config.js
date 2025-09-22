const { devices } = require("@playwright/test");
const path = require("path");

/** @type {import("@playwright/test").PlaywrightTestConfig} */
const config = {
  testDir: path.join(__dirname, "tests", "ui"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "test-report" }]],
  use: {
    headless: true,
    locale: "ar-SA",
    colorScheme: "light",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["iPhone 12"],
        viewport: { width: 414, height: 896 },
        deviceScaleFactor: 3
      }
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 }
      }
    }
  ],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 120 }
  }
};

module.exports = config;

