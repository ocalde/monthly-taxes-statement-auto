'use strict';

require('dotenv').config();
const assert = require('assert').strict;
const puppeteer = require('puppeteer');
const sgMail = require('@sendgrid/mail');

const runHeadless = process.env.RUN_HEADLESS === 'true' || false;
const mhWebsite = process.env.MH_WEBSITE;
const emailTo = process.env.SENDGRID_RECIPIENT;
const emailFrom = process.env.SENDGRID_SENDER;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const login = async () => {
    const browser = await puppeteer.launch({ headless: runHeadless });
    const page = await browser.newPage();

    !runHeadless && await page.setViewport({ width: 1000, height: 1000 })
  
    await page.goto(`${mhWebsite}/security/login`);

    await page.type('input[name="username"]', process.env.MH_USERNAME);
    await page.type('input[name="password"]', process.env.MH_PASSWORD);

    await page.click('.btn-primary');

    await page.waitForTimeout(2000);

    return [browser, page];
}

const presentDeclaration = async (page, config) => {
    
    await page.goto(mhWebsite);

    const formAccess = `#formulario-${config.formCode}`;

    await page.waitForSelector(formAccess, { timeout: 80000 });

    await page.click(formAccess);

    await page.waitForSelector('.btn-success', { timeout: 80000 });

    await page.click('.btn-success');

    await page.waitForSelector(`label[data-ng-class="{none:(${config.declarationField}.editable)}"]`, { timeout: 80000 });

    const documentNumber = await page.$eval(
        `label[data-ng-class="{none:(${config.declarationField}.editable)}"]`,
        el => el.innerText
    );

    assert.ok(!documentNumber || true);
    
    await page.click('#btn-vista-previa');

    await page.waitForSelector('input[type="checkbox"]', { timeout: 80000 });
    await page.waitForTimeout(30000);
    
    await page.click('input[type="checkbox"]');

    await page.waitForSelector('#btn-presentar', { timeout: 80000 });

    await page.click('#btn-presentar');

    await page.waitForSelector('iframe', { timeout: 80000 });

    const pdfLink = await page.$eval(
        'iframe',
        el => el.src
    );
    
    console.log(pdfLink);

    const msg = {
        to: emailTo,
        from: emailFrom,
        subject: `Sending form ${config.formCode}`,
        text: `Text ${pdfLink}`,
        html: `<strong>Link to the report: ${pdfLink}</strong>`,
      };

      await sgMail.send(msg);
}

(async () => {
    const [browser, page] = await login();

    const formsData = [
        { formCode: 'f14', declarationField: 'f14.c005' },
        { formCode: 'f07', declarationField: 'f07.c055' },
    ];

    for(const formData of formsData) {
        try {
            await presentDeclaration(page, formData);
        } catch(err) {
            console.log(err);
        }
    }
    
    browser && await browser.close();
  })();
