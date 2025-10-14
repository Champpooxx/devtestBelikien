import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Construct the absolute file path
        file_path = "file://" + os.path.abspath("index.html")
        await page.goto(file_path)

        # Start the timer
        await page.press("body", " ")
        await page.wait_for_timeout(2000)

        # Pause the timer
        await page.press("body", "p")
        await page.wait_for_timeout(2000)

        # Resume the timer
        await page.press("body", "p")
        await page.wait_for_timeout(2000)

        # Stop the timer
        await page.press("body", " ")

        # Take a screenshot
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
