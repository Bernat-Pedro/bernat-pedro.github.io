import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modules = process.env.PHONE_REPAIR_TEST_MODULES || '/tmp/gather-validation/node_modules';
const { chromium } = await import(pathToFileURL(`${modules}/playwright/index.mjs`).href);
const base = process.env.PHONE_REPAIR_TEST_URL || 'http://127.0.0.1:8000';
const browser = await chromium.launch({ headless: true });

async function checkCanvas(page, id, logicalWidth, logicalHeight) {
    await page.waitForFunction((canvasId) => {
        const canvas = document.getElementById(canvasId);
        const rect = canvas.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
            canvas.width === Math.round(rect.width * devicePixelRatio) &&
            canvas.height === Math.round(rect.height * devicePixelRatio);
    }, id);
    const result = await page.evaluate(({ id, logicalWidth, logicalHeight }) => {
        const canvas = document.getElementById(id);
        const rect = canvas.getBoundingClientRect();
        const context = canvas.getContext('2d');
        const transform = context.getTransform();
        const scale = Math.min(rect.width / logicalWidth, rect.height / logicalHeight);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const colors = new Set();
        for (let i = 0; i < image.data.length; i += 400) {
            colors.add(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`);
        }
        return {
            xScale: transform.a * rect.width / canvas.width,
            yScale: transform.d * rect.height / canvas.height,
            scale,
            colors: colors.size
        };
    }, { id, logicalWidth, logicalHeight });
    assert.ok(Math.abs(result.xScale - result.scale) < 0.0001, `${id}: horizontal scale`);
    assert.ok(Math.abs(result.yScale - result.scale) < 0.0001, `${id}: vertical scale`);
    assert.ok(result.colors > 100, `${id}: detailed artwork must not be blank`);
}

async function clickComputer(page, touch) {
    const point = await page.locator('#workshopCanvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / 1200, rect.height / 700);
        return {
            x: rect.left + (rect.width - 1200 * scale) / 2 + 180 * scale,
            y: rect.top + (rect.height - 700 * scale) / 2 + 170 * scale
        };
    });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.locator('#computerScreen.active').waitFor();
    await page.locator('[data-tab="jobs"]').click();
}

async function offerIds(page) {
    return page.locator('#jobsGrid .job-card').evaluateAll(cards =>
        cards.map(card => card.dataset.jobId));
}

async function checkJobRefresh(page, touch, initialOffers) {
    await clickComputer(page, touch);
    const refreshed = await offerIds(page);
    assert.equal(refreshed.length, 6);
    assert.ok(!refreshed.includes(initialOffers[0]), 'Completed job must leave the board');
    assert.deepEqual(refreshed.slice(0, 5), initialOffers.slice(1), 'Other offers stay available');
    assert.ok(!initialOffers.includes(refreshed[5]), 'A new offer fills the vacant slot');

    await page.reload();
    await clickComputer(page, touch);
    assert.deepEqual(await offerIds(page), refreshed, 'Completed offers stay retired after reload');
    await page.locator('#jobsGrid .job-card').first().getByRole('button', { name: 'REJECT' }).click();
    const afterReject = await offerIds(page);
    assert.equal(afterReject.length, 6);
    assert.ok(!afterReject.includes(refreshed[0]), 'Rejected job must leave the board');
    assert.deepEqual(afterReject.slice(0, 5), refreshed.slice(1), 'Other offers survive rejection');
    await page.reload();
    await clickComputer(page, touch);
    assert.deepEqual(await offerIds(page), afterReject, 'Rejected offers stay retired after reload');
    console.log('PASS job board: completion and rejection replace offers and persist after reload');
}

async function checkJobBoardRollover(browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto(`${base}/phone-repair-simulator.html`);
        await page.evaluate(() => {
            diagnosticDatabase = diagnosticDatabase.slice(0, 3);
            gameState.activeRepairs = [{ ...diagnosticDatabase[0], repairProgress: 0 }];
            gameState.retiredJobIds = [];
            openComputer();
        });
        assert.deepEqual(await offerIds(page), ['diag_1', 'diag_2']);
        await page.locator('#jobsGrid .job-card').first().getByRole('button', { name: 'REJECT' }).click();
        assert.deepEqual(await offerIds(page), ['diag_2']);
        await page.locator('#jobsGrid .job-card').first().getByRole('button', { name: 'REJECT' }).click();
        assert.deepEqual(await offerIds(page), ['diag_1', 'diag_2'], 'Exhausted catalog cycles without offering active jobs');
        assert.deepEqual(await page.evaluate(() => gameState.activeRepairs.map(job => job.id)), ['diag_0']);
        console.log('PASS job board: exhausted offers cycle without losing or offering paused jobs');
    } finally {
        await context.close();
    }
}

async function checkJobBoardVariety(browser) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
        await page.goto(`${base}/phone-repair-simulator.html`);
        const catalog = await page.evaluate(() => ({
            ids: diagnosticDatabase.map(job => job.id),
            problems: diagnosticDatabase.map(job => job.problem),
            ordered: getJobOfferOrder().map(({ job }) => ({ id: job.id, problem: job.problem }))
        }));
        assert.equal(catalog.ordered.length, catalog.ids.length);
        const ids = catalog.ordered.map(job => job.id);
        assert.equal(new Set(ids).size, catalog.ids.length);
        assert.deepEqual(ids.sort(), [...catalog.ids].sort(), 'Every scenario remains available');
        const problemCount = new Set(catalog.problems).size;
        assert.equal(new Set(catalog.ordered.slice(0, problemCount).map(job => job.problem)).size,
            problemCount, 'Every fault appears before any fault repeats');

        await clickComputer(page, false);
        const cards = page.locator('#jobsGrid .job-card');
        assert.equal(await cards.count(), 6);
        assert.equal(await cards.filter({ hasText: 'Corroded battery connector' }).count(), 1);
        assert.equal(await cards.filter({ hasText: 'Back glass shattered' }).count(), 1);
        const cleaningCard = cards.filter({ hasText: 'Corroded battery connector' });
        assert.match(await cleaningCard.textContent(), /Service:\s*Cleaning/);
        const cleaningId = await cleaningCard.getAttribute('data-job-id');
        await cleaningCard.getByRole('button', { name: 'ACCEPT' }).click();
        await page.locator('#diagnosticsBtn').click();
        for (const id of ['visual', 'symptoms', 'power', 'component']) {
            await page.locator(`[data-diagnostic="${id}"] button`).click();
        }
        await page.locator('#diagnosticsModal .close').click();
        const steps = await page.evaluate(() => getRepairProcedure(gameState.currentJob));
        assert.ok(steps.some(step => step.id === 'clean'), 'Offer starts a cleaning procedure');
        for (const [index, step] of steps.entries()) {
            await performManualGesture(page, step, false);
            assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index + 1);
        }
        await page.locator('#testBtn').click();
        await page.locator('#completeBtn').click();
        await page.locator('#workshopView.active').waitFor();
        await clickComputer(page, false);
        assert.ok(!(await offerIds(page)).includes(cleaningId), 'Completed cleaning offer leaves the board');
        console.log('PASS job board: varied offers, complete catalog, and playable cleaning job');
    } finally {
        await context.close();
    }
}

async function checkDiagnostics(page) {
    await page.locator('#diagnosticsBtn').click();
    assert.equal(await page.locator('.diagnostic-summary').textContent(), '0 / 4 checks completed');
    for (const [index, id] of ['visual', 'symptoms', 'power', 'component'].entries()) {
        const card = page.locator(`[data-diagnostic="${id}"]`);
        assert.match(await card.locator('.diagnostic-result').textContent(), /Not checked yet/);
        await card.locator('button').click();
        assert.ok(!(await card.locator('.diagnostic-result').textContent()).includes('Not checked yet'));
        assert.equal(await card.locator('button').isDisabled(), true);
        assert.equal(await page.locator('.diagnostic-summary').textContent(), `${index + 1} / 4 checks completed`);
    }
    assert.match(await page.locator('[data-diagnostic="component"] .diagnostic-result').textContent(), /Cracked screen.*screen/);
    const findings = await page.locator('.diagnostic-result').allTextContents();
    await page.locator('#diagnosticsModal .close').click();
    assert.equal(await page.locator('#repairLog .log-entry').count(), 4);
    assert.ok(await page.locator('#repairSteps .step-item').first().evaluate(node => node.classList.contains('completed')));
    await page.locator('#diagnosticsBtn').click();
    assert.deepEqual(await page.locator('.diagnostic-result').allTextContents(), findings);
    await page.locator('#diagnosticsModal .close').click();
    console.log('PASS diagnostics: four working checks, findings, repair log, progress, and retained results');
}

async function clickRepairScene(page, x, y, touch) {
    const canvas = page.locator('#repairCanvas');
    await canvas.scrollIntoViewIfNeeded();
    const point = await canvas.evaluate((canvas, { x, y }) => {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / 1000, rect.height / 600);
        return {
            x: rect.left + (rect.width - 1000 * scale) / 2 + x * scale,
            y: rect.top + (rect.height - 600 * scale) / 2 + y * scale
        };
    }, { x, y });
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
}

async function checkResume(page, touch, reload = false) {
    const snapshot = await page.evaluate(() => JSON.stringify(gameState.currentJob));
    const id = await page.evaluate(() => gameState.currentJob.id);
    const activeCount = await page.evaluate(() => gameState.activeRepairs.length);
    const log = await page.locator('#repairLog').textContent();
    await page.locator('#cancelRepairBtn').click();
    if (reload) {
        await page.reload();
        await page.locator('#workshopView.active').waitFor();
        await checkCanvas(page, 'workshopCanvas', 1200, 700);
    }
    await clickComputer(page, touch);
    await page.locator('[data-tab="repairs"]').click();
    const card = page.locator(`[data-job-id="${id}"]`);
    if (reload && !touch) {
        await card.focus();
        await page.keyboard.press('Enter');
    } else if (touch) await card.locator('strong').tap();
    else await card.locator('strong').click();
    await page.locator('#repairTableView.active').waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(gameState.currentJob)), snapshot);
    assert.equal(await page.evaluate(() => gameState.activeRepairs.length), activeCount);
    assert.equal(await page.locator('#repairLog').textContent(), log);
}

async function repairGesturePath(page, points, touch, {
    delay = 0, cancel = false, hold = 0, beforeHold, afterHold
} = {}) {
    const canvas = page.locator('#repairCanvas');
    await canvas.scrollIntoViewIfNeeded();
    const mapped = await canvas.evaluate((canvas, points) => {
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / 1000, rect.height / 600);
        return points.map(([x, y]) => ({
            x: rect.left + (rect.width - 1000 * scale) / 2 + x * scale,
            y: rect.top + (rect.height - 600 * scale) / 2 + y * scale
        }));
    }, points);
    const client = touch ? await page.context().newCDPSession(page) : null;
    const hit = await page.evaluate(point => {
        const element = document.elementFromPoint(point.x, point.y);
        return {
            id: element?.id, tag: element?.tagName, class: element?.className,
            layout: ['repairCanvas', 'repairLog', 'repairToolHint'].map(id => ({
                id, rect: document.getElementById(id).getBoundingClientRect().toJSON()
            }))
        };
    }, mapped[0]);
    assert.equal(hit.id, 'repairCanvas', `Tool must be visible at ${JSON.stringify(mapped[0])}: ${JSON.stringify(hit)}`);
    try {
        if (touch) await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [mapped[0]] });
        else {
            await page.mouse.move(mapped[0].x, mapped[0].y);
            await page.mouse.down();
        }
        for (const point of mapped.slice(1)) {
            if (delay) await page.waitForTimeout(delay);
            if (touch) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
            else await page.mouse.move(point.x, point.y);
        }
        await beforeHold?.();
        if (hold) await page.waitForTimeout(hold);
        await afterHold?.();
        if (touch) await client.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        else if (cancel) {
            await page.evaluate(() => window.cancelRepairGesture());
            await page.mouse.up();
        } else await page.mouse.up();
    } finally {
        await client?.detach();
    }
}

function linePoints(start, end, count = 12) {
    return Array.from({ length: count }, (_, i) => [
        start[0] + (end[0] - start[0]) * (i + 1) / count,
        start[1] + (end[1] - start[1]) * (i + 1) / count
    ]);
}

async function performManualGesture(page, step, touch) {
    const tool = await page.evaluate(tool => repairToolAreas.find(area => area.tool === tool), step.tool);
    const origin = [tool.x + tool.width / 2, tool.y + tool.height / 2];
    if (['screws', 'close'].includes(step.id)) {
        const direction = step.id === 'screws' ? -1 : 1;
        const progress = await page.evaluate(() => gameState.currentJob.repairProgress);
        for (const x of [461, 539]) {
            const circle = Array.from({ length: 42 }, (_, i) => {
                const angle = direction * i / 41 * Math.PI * 2.2;
                return [x + 22 * Math.cos(angle), 493 + 22 * Math.sin(angle)];
            });
            await repairGesturePath(page, [origin, ...circle], touch);
            if (x === 461) {
                assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), progress, 'Both screws must be turned');
                assert.ok(await page.evaluate(() => gameState.currentJob.manualWork.screws[0] >= Math.PI * 2));
                await checkResume(page, touch, step.id === 'screws');
            }
        }
    } else if (['heat', 'open'].includes(step.id)) {
        const corners = [[408, 145], [592, 145], [592, 495], [408, 495], [408, 145]];
        if (step.id === 'heat') {
            const progress = await page.evaluate(() => gameState.currentJob.repairProgress);
            await repairGesturePath(page, [origin, ...corners], touch, {
                hold: 800,
                beforeHold: async () => {
                    await page.waitForFunction(progress =>
                        gameState.currentJob.repairProgress === progress + 1 ||
                        gameState.currentJob.manualWork?.edges.length === 16, progress);
                    const state = await page.evaluate(() => ({
                        progress: gameState.currentJob.repairProgress,
                        work: gameState.currentJob.manualWork
                    }));
                    if (state.progress === progress) {
                        assert.equal(state.work.edges.length, 16,
                            'Sparse pointer events must still cover every swept edge');
                    } else {
                        assert.equal(state.progress, progress + 1,
                            'Already-warmed adhesive may finish during the sweep');
                    }
                },
                afterHold: async () => {
                    assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), progress + 1,
                        'Heat must complete while holding the nozzle still at the final edge');
                    assert.match(await page.locator('#repairToolHint').textContent(), /suction cup/i);
                }
            });
            return;
        }
        const path = [origin, corners[0]];
        for (let i = 1; i < corners.length; i++) path.push(...linePoints(corners[i - 1], corners[i]));
        const progress = await page.evaluate(() => gameState.currentJob.repairProgress);
        await repairGesturePath(page, path, touch, {
            beforeHold: async () => {
                await page.waitForFunction(progress =>
                    gameState.currentJob.repairProgress === progress + 1, progress);
                assert.match(await page.locator('#repairToolHint').textContent(), /battery connector/i);
            }
        });
    } else if (step.id === 'clean') {
        const area = await page.evaluate(() => getManualRepairGuide('clean').area);
        const y = area.y + area.height / 2;
        const path = [origin, [area.x + 10, y]];
        for (let i = 0; i < 12; i++) {
            path.push(...linePoints(path.at(-1), [i % 2 ? area.x + 10 : area.x + area.width - 10, y], 4));
        }
        await repairGesturePath(page, path, touch);
    } else if (step.id === 'measure') {
        await repairGesturePath(page, [origin, ...linePoints(origin, [445, 248]), [500, 290],
            ...linePoints([500, 290], [555, 248], 4)], touch);
    } else {
        const targets = {
            pulltab: [[500, 442], [500, 545]],
            shield: [[500, 199], [690, 110]],
            lift: [[500, 320], [500, 180]],
            disconnect: [[500, 250], [555, 295]],
            remove: [[500, 350], [660, 160]],
            replace: [[860, 410], [500, 350]],
            connect: [[555, 295], [500, 250]],
            seat: [[660, 320], [500, 320]]
        };
        const [start, end] = targets[step.id];
        await repairGesturePath(page, [origin, ...linePoints(origin, start), ...linePoints(start, end)], touch);
    }
}

async function checkRepair(page, touch = false) {
    const balance = await page.evaluate(() => gameState.money);
    const rewardsBefore = await page.evaluate(() => ({
        money: gameState.money, phones: gameState.phonesRepaired,
        reputation: gameState.reputation, earnings: gameState.totalEarnings,
        completed: gameState.completedRepairs.length
    }));
    await page.locator('#completeBtn').click();
    assert.deepEqual(await page.evaluate(() => ({
        money: gameState.money, phones: gameState.phonesRepaired,
        reputation: gameState.reputation, earnings: gameState.totalEarnings,
        completed: gameState.completedRepairs.length
    })), rewardsBefore);
    assert.match(await page.locator('#notificationToast').textContent(), /Repair and test/);
    await page.locator('#testBtn').click();
    assert.match(await page.locator('#notificationToast').textContent(), /Finish the repair/);
    await page.locator('#repairBtn').click();
    assert.equal(await page.locator('#performRepairStepBtn').count(), 0);
    await page.getByRole('button', { name: 'Tweezers', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Tweezers', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.locator('#repairInstructionsModal .close').click();
    await repairGesturePath(page, [[144, 405], [461, 493]], touch);
    assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), 0, 'Wrong tool cannot repair');
    await clickRepairScene(page, 143, 224, touch);
    await clickRepairScene(page, 461, 493, touch);
    assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), 0, 'Clicks cannot repair');
    await repairGesturePath(page, [[143, 224], [483, 493], [461, 515], [439, 493]], touch, { cancel: true });
    assert.deepEqual(await page.evaluate(() => gameState.currentJob.manualWork.screws), [0, 0], 'Cancelled gestures roll back');
    const wrongDirection = Array.from({ length: 42 }, (_, i) => {
        const angle = i / 41 * Math.PI * 2.2;
        return [461 + 22 * Math.cos(angle), 493 + 22 * Math.sin(angle)];
    });
    await repairGesturePath(page, [[143, 224], ...wrongDirection], touch);
    assert.equal(await page.evaluate(() => gameState.currentJob.manualWork.screws[0]), 0, 'Wrong rotation direction cannot loosen screws');
    const steps = await page.evaluate(() => getRepairProcedure(gameState.currentJob));
    for (const [index, step] of steps.entries()) {
        if (index === 1) await checkResume(page, touch);
        if (step.id === 'open' || step.id === 'heat') {
            const tool = await page.evaluate(tool => repairToolAreas.find(area => area.tool === tool), step.tool);
            await repairGesturePath(page, [
                [tool.x + tool.width / 2, tool.y + tool.height / 2],
                [408, 145], ...linePoints([408, 145], [592, 145])
            ], touch);
            assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index, 'One edge is insufficient');
        } else if (step.id === 'replace') {
            await repairGesturePath(page, [[860, 410], ...linePoints([860, 410], [350, 350])], touch);
            assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index, 'Part must land inside its bay');
        }
        await performManualGesture(page, step, touch);
        assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index + 1,
            `${step.id}: ${JSON.stringify(await page.evaluate(() => gameState.currentJob.manualWork))}`);
        await page.locator('#completeBtn').click();
        assert.equal(await page.evaluate(() => gameState.money), balance);
    }
    assert.match(await page.locator('#repairToolHint').textContent(), /Reassembly complete/);
    await page.locator('#completeBtn').click();
    assert.equal(await page.evaluate(() => gameState.money), balance);
    await page.locator('#testBtn').click();
    assert.equal(await page.evaluate(() => gameState.currentJob.tested), true);
    const payment = await page.evaluate(() => gameState.currentJob.payment);
    await page.locator('#completeBtn').click();
    await page.locator('#workshopView.active').waitFor();
    assert.equal(await page.evaluate(() => gameState.money), balance + payment);
    await page.evaluate(() => completeRepair());
    assert.equal(await page.evaluate(() => gameState.money), balance + payment);
    console.log(`PASS manual ${touch ? 'touch' : 'mouse'} repair: screw rotation, edge tracing, part dragging, resume, cancelled/wrong gestures, and payment guards`);
}

async function checkProcedureFamilies(page, touch) {
    for (const type of ['standard', 'display', 'battery', 'clean', 'water', 'board', 'backglass', 'adhesive']) {
        const balance = await page.evaluate(() => gameState.money);
        await page.evaluate(type => {
            acceptJob(diagnosticDatabase.findIndex(job => job.procedureType === type &&
                !gameState.activeRepairs.some(active => active.id === job.id)));
            diagnosticTests.forEach(test => runDiagnosticTest(test.id));
        }, type);
        const steps = await page.evaluate(() => getRepairProcedure(gameState.currentJob));
        for (const [index, step] of steps.entries()) {
            if (step.id === 'measure') {
                await repairGesturePath(page, [[326, 412], ...linePoints([326, 412], [555, 248]),
                    ...linePoints([555, 248], [445, 248], 4)], touch);
                assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index,
                    'Black probe first must not count');
            }
            await performManualGesture(page, step, touch);
            assert.equal(await page.evaluate(() => gameState.currentJob.repairProgress), index + 1,
                `${type}/${step.id}: ${JSON.stringify(await page.evaluate(() => gameState.currentJob.manualWork))}`);
        }
        await page.locator('#testBtn').click();
        const payment = await page.evaluate(() => gameState.currentJob.payment);
        await page.locator('#completeBtn').click();
        await page.locator('#workshopView.active').waitFor();
        assert.equal(await page.evaluate(() => gameState.money), balance + payment, `${type} pays once complete`);
    }
    console.log(`PASS ${touch ? 'touch' : 'mouse'} procedure families: standard, display, battery, clean, water, board, back glass, adhesive`);
}

try {
    await checkJobBoardRollover(browser);
    await checkJobBoardVariety(browser);
    for (const config of [
        { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false },
        { name: 'retina', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, hasTouch: false },
        { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true }
    ].filter(config => !process.env.PHONE_REPAIR_TEST_DEVICE || config.name === process.env.PHONE_REPAIR_TEST_DEVICE)) {
        const context = await browser.newContext(config);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/phone-repair-simulator.html`);
        await checkCanvas(page, 'workshopCanvas', 1200, 700);
        if (process.env.PHONE_REPAIR_SCREENSHOTS) {
            await page.screenshot({ path: `${process.env.PHONE_REPAIR_SCREENSHOTS}/${config.name}-workshop.png` });
        }
        await clickComputer(page, config.hasTouch);
        const initialOffers = await offerIds(page);
        assert.equal(initialOffers.length, 6);
        await page.getByRole('button', { name: 'ACCEPT', exact: true }).first().click();
        await page.locator('#repairTableView.active').waitFor();
        await checkCanvas(page, 'repairCanvas', 1000, 600);
        const initialBalance = await page.evaluate(() => gameState.money);
        await page.locator('#completeBtn').click();
        assert.equal(await page.evaluate(() => gameState.money), initialBalance);
        assert.equal(await page.evaluate(() => gameState.phonesRepaired), 0);
        await clickRepairScene(page, 143, 224, config.hasTouch);
        assert.equal(await page.evaluate(() => gameState.currentJob.selectedTool), null);
        assert.match(await page.locator('#notificationToast').textContent(), /diagnostic checks/);
        await page.locator('#repairBtn').click();
        assert.match(await page.locator('#notificationToast').textContent(), /Complete all four/);
        await checkDiagnostics(page);
        if (process.env.PHONE_REPAIR_SCREENSHOTS) {
            await page.screenshot({ path: `${process.env.PHONE_REPAIR_SCREENSHOTS}/${config.name}-repair.png` });
        }
        await checkRepair(page, config.hasTouch);
        await checkCanvas(page, 'workshopCanvas', 1200, 700);
        await checkJobRefresh(page, config.hasTouch, initialOffers);
        await page.getByRole('button', { name: 'ACCEPT', exact: true }).first().click();
        await page.setViewportSize({ width: config.hasTouch ? 720 : 1920, height: 600 });
        await checkCanvas(page, 'repairCanvas', 1000, 600);
        await page.locator('#diagnosticsBtn').click();
        assert.equal(await page.locator('.diagnostic-summary').textContent(), '0 / 4 checks completed');
        assert.equal(await page.locator('#repairLog .log-entry').count(), 0);
        await page.locator('#diagnosticsModal .close').click();
        for (const [problem, expected] of [
            ['Black screen', /draws power.*display remains black/],
            ['Battery not charging', /Charging test failed/],
            ['Swollen battery', /stopped for safety/]
        ]) {
            await page.evaluate(problem => {
                acceptJob(diagnosticDatabase.findIndex(job => job.problem === problem));
            }, problem);
            await page.locator('#diagnosticsBtn').click();
            await page.locator('[data-diagnostic="power"] button').click();
            assert.match(await page.locator('[data-diagnostic="power"] .diagnostic-result').textContent(), expected);
            await page.locator('#diagnosticsModal .close').click();
        }
        await page.locator('#diagnosticsBtn').click();
        for (const id of ['visual', 'symptoms', 'component']) {
            await page.locator(`[data-diagnostic="${id}"] button`).click();
        }
        await page.locator('#diagnosticsModal .close').click();
        await checkRepair(page, config.hasTouch);
        await checkProcedureFamilies(page, config.hasTouch);
        await page.evaluate(() => acceptJob(0));
        await page.evaluate(() => runDiagnosticTest('unknown'));
        assert.equal(await page.locator('#notificationToast').textContent(), 'Unknown diagnostic test.');
        await page.locator('#cancelRepairBtn').click();
        await page.evaluate(() => runDiagnosticTest('power'));
        assert.match(await page.locator('#notificationToast').textContent(), /Accept a repair job/);
        assert.deepEqual(errors, [], `${config.name}: browser errors`);
        console.log(`PASS ${config.name}: native pixel density, proportional artwork, repair rendering, resize, computer ${config.hasTouch ? 'tap' : 'click'}`);
        await context.close();
    }
} finally {
    await browser.close();
}
