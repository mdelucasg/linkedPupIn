const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const fs = require("fs");
const { Command } = require("commander");
const program = new Command();

program
  .name("puppetin")
  .description("Scrap LinkedIn profiles")
  .version("0.1.1");

program
  .option(
    "-c, --cookie <string>",
    "provide li_at cookie instead of credentials"
  )
  .option("-t, --timeout <milliseconds>", "Set global timeout", 30000)
  .option("--headful", "Launch browser in headful mode", false)
  .option(
    "--slowMo <milliseconds>",
    "Slows down Puppeteer operations by the specified amount of time"
  );

program.parse();

// global variable to store results
const nodes = {};

// Auxiliar functions
async function startBrowser(options = { headless: true, slowMo: 0 }) {
  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  return { browser, page };
}

async function closeBrowser(browser) {
  return browser.close();
}

async function auth({ page, cookie }) {
  if (cookie) {
    await page.setCookie({ name: "li_at", value: cookie });
    await page.reload();
  }
}

async function waitForSelectors(selectors, frame, options) {
  for (const selector of selectors) {
    try {
      return await waitForSelector(selector, frame, options);
    } catch (err) {
      console.error(err);
    }
  }
  throw new Error(
    "Could not find element for selectors: " + JSON.stringify(selectors)
  );
}

async function waitForSelector(selector, frame, options) {
  if (!Array.isArray(selector)) {
    selector = [selector];
  }
  if (!selector.length) {
    throw new Error("Empty selector provided to waitForSelector");
  }
  let element = null;
  for (let i = 0; i < selector.length; i++) {
    const part = selector[i];
    if (element) {
      element = await element.waitForSelector(part, options);
    } else {
      element = await frame.waitForSelector(part, options);
    }
    if (!element) {
      throw new Error("Could not find element: " + selector.join(">>"));
    }
    if (i < selector.length - 1) {
      element = (
        await element.evaluateHandle((el) =>
          el.shadowRoot ? el.shadowRoot : el
        )
      ).asElement();
    }
  }
  if (!element) {
    throw new Error("Could not find element: " + selector.join("|"));
  }
  return element;
}

async function waitForElement(step, frame, timeout) {
  const count = step.count || 1;
  const operator = step.operator || ">=";
  const comp = {
    "==": (a, b) => a === b,
    ">=": (a, b) => a >= b,
    "<=": (a, b) => a <= b,
  };
  const compFn = comp[operator];
  await waitForFunction(async () => {
    const elements = await querySelectorsAll(step.selectors, frame);
    return compFn(elements.length, count);
  }, timeout);
}

async function querySelectorsAll(selectors, frame) {
  for (const selector of selectors) {
    const result = await querySelectorAll(selector, frame);
    if (result.length) {
      return result;
    }
  }
  return [];
}

async function querySelectorAll(selector, frame) {
  if (!Array.isArray(selector)) {
    selector = [selector];
  }
  if (!selector.length) {
    throw new Error("Empty selector provided to querySelectorAll");
  }
  let elements = [];
  for (let i = 0; i < selector.length; i++) {
    const part = selector[i];
    if (i === 0) {
      elements = await frame.$$(part);
    } else {
      const tmpElements = elements;
      elements = [];
      for (const el of tmpElements) {
        elements.push(...(await el.$$(part)));
      }
    }
    if (elements.length === 0) {
      return [];
    }
    if (i < selector.length - 1) {
      const tmpElements = [];
      for (const el of elements) {
        const newEl = (
          await el.evaluateHandle((el) => (el.shadowRoot ? el.shadowRoot : el))
        ).asElement();
        if (newEl) {
          tmpElements.push(newEl);
        }
      }
      elements = tmpElements;
    }
  }
  return elements;
}

async function waitForFunction(fn, timeout) {
  let isActive = true;
  setTimeout(() => {
    isActive = false;
  }, timeout);
  while (isActive) {
    const result = await fn();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out");
}

async function scrap(opts) {
  const url = "https://linkedin.com";
  const timeout = opts.timeout;
  const { browser, page } = await startBrowser({
    headless: !opts.headful,
    slowMo: opts.slowMo,
  });
  page.setDefaultTimeout(timeout);
  await page.goto(url);
  await auth({
    page: page,
    cookie: opts.cookie,
  });

  // Scrapping contacts
  // Initial
  let current = await page.$(
    "div > div > div > div > div > div > div > div > div > a"
  );
  let currentName = await page.evaluate((el) => el.innerText, current);
  await current.click();

  // From profile page to contacts
  const goToContacts = async () => {
    await page.click(
      "div > div > div > div > div > div > div > main > section > div > ul > li > a > span.link-without-visited-state"
    );
  };
  await goToContacts();

  // List of contacts
  let myContacts = await page.$$(
    "div > div > div > div > div > main > div > section > div > div > ul > li"
  );

  const getOtherContacts = async () => {
    const names = await page.$$(
      "div > div > div > div > div > main > div > div > div > div > ul > li"
    );
    return names;
  };

  // Get names
  const regex = /Nombre del miembro\s+(.*)\n/;

  nodes[currentName] = [];

  for (let contact of myContacts) {
    const string = await page.evaluate((el) => el.innerText, contact);
    const name = string.match(regex)[1];
    nodes[currentName].push(name);
  }
  console.log(nodes);
  // Iterate over current contacts to extract their contacts
  const INPUT_SELECTOR = await page.$("#global-nav-typeahead > input");

  for (let contact of nodes[currentName]) {
    currentName = contact;
    await page.evaluate(
      (el, value) => (el.value = value),
      INPUT_SELECTOR,
      currentName
    );
    await page.evaluate((inputElement) => {
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        which: 13,
        keyCode: 13,
      });
      inputElement.dispatchEvent(enterEvent);
    }, INPUT_SELECTOR);

    nodes[currentName] = [];
    // Click on the first result
    await page
      .waitForSelector(
        "div > div > div > div > div > main > div >  div > div > div > ul > li > div > a"
      )
      .then((el) => el.click());
    // Click on the contacts
    await goToContacts();
    contactsProfiles = await getOtherContacts();
    nodes[currentName] = [];
    const regex = /Ver el perfil de\s+(.*)\n/;
    for (contact of contactsProfiles) {
      const string = contact.innerText;
      if (string.includes("¿Estos")) {
        continue;
      }
      const name = string.match(regex)[1];
      nodes[currentName].push(name);
    }
  }

  await page.waitForTimeout(1500);
  await closeBrowser(browser);
}

////////////////////////////////
// MAIN PROGRAM
////////////////////////////////
(async () => {
  try {
    await scrap(program.opts());
  } catch (error) {
    console.log(
      "LinkedIn changed the structure of the page, please update the selectors\n",
      error
    );
  }
  // Write JSON file with nodes
  fs.writeFileSync("nodes.json", JSON.stringify(nodes, null, 2));
  process.exit(0);
})();
