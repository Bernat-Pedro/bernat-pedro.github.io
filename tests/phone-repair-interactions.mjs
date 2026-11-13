import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../phone-repair-interactions.js', import.meta.url), 'utf8');

function createRepair(pointerType, stepId = 'open') {
    const listeners = {};
    let captured = false;
    const job = {
        selectedTool: null, repairProgress: 0,
        manualWork: null, diagnosticResults: {}
    };
    const canvas = {
        addEventListener(name, callback) { listeners[name] = callback; },
        classList: { add() {}, remove() {} },
        setPointerCapture() { captured = true; },
        hasPointerCapture() { return captured; },
        releasePointerCapture() {
            captured = false;
            listeners.lostpointercapture?.();
        }
    };
    const notifications = [];
    const context = vm.createContext({
        document: { getElementById: () => canvas, addEventListener() {} },
        window: { addEventListener() {}, renderGameCanvases() {} },
        gameState: { currentJob: job },
        repairToolAreas: [
            { tool: 'Opening pick', x: 192, y: 365, width: 90, height: 125 },
            { tool: 'Precision screwdriver', x: 108, y: 170, width: 70, height: 135 }
        ],
        getRepairProcedure: () => [
            { id: stepId, tool: stepId === 'open' ? 'Opening pick' : 'Precision screwdriver' },
            { id: 'disconnect', tool: 'Tweezers' }
        ],
        diagnosticsAreComplete: () => true,
        selectRepairTool(tool) { job.selectedTool = tool; },
        getCanvasScenePoint: event => ({ x: event.clientX, y: event.clientY }),
        finishManualRepairStep() {
            job.repairProgress++;
            job.selectedTool = null;
            job.manualWork = null;
        },
        showNotification(message) { notifications.push(message); },
        performance, structuredClone, cancelAnimationFrame() {}
    });
    vm.runInContext(source, context);
    const fire = (type, x, y) => listeners[type]({
        button: 0, pointerId: 1, pointerType, clientX: x, clientY: y, preventDefault() {}
    });
    return { job, fire, notifications };
}

function turnScrew(fire, x, direction, { cancel = false } = {}) {
    fire('pointerdown', x + 30, 493);
    for (let i = 1; i <= 4; i++) {
        const angle = direction * i * Math.PI / 2;
        fire('pointermove', x + 30 * Math.cos(angle), 493 + 30 * Math.sin(angle));
    }
    fire(cancel ? 'pointercancel' : 'pointerup', x + 30, 493);
}

for (const pointerType of ['mouse', 'touch']) {
    for (const stepId of ['screws', 'close']) {
        const repair = createRepair(pointerType, stepId);
        const direction = stepId === 'screws' ? -1 : 1;
        repair.fire('pointerdown', 143, 224);
        repair.fire('pointerup', 143, 224);
        repair.fire('pointerdown', 491, 493);
        repair.fire('pointerup', 491, 493);
        assert.equal(repair.job.manualWork.screws[0], 0, 'Clicking a screw cannot rotate it');
        repair.fire('pointerdown', 491, 493);
        repair.fire('pointermove', 431, 493);
        repair.fire('pointermove', 491, 493);
        repair.fire('pointerup', 491, 493);
        assert.equal(repair.job.manualWork.screws[0], 0, 'Straight jumps across a screw cannot count as turning');
        turnScrew(repair.fire, 461, -direction);
        assert.equal(repair.job.manualWork.screws[0], 0, 'Wrong direction cannot turn a screw');
        turnScrew(repair.fire, 461, direction, { cancel: true });
        assert.equal(repair.job.manualWork.screws[0], 0, 'Cancellation restores screw progress');
        turnScrew(repair.fire, 461, direction);
        assert.equal(repair.job.repairProgress, 0, 'Both screws are required');
        assert.ok(repair.job.manualWork.screws[0] >= Math.PI * 2,
            'Exactly one revolution on the visible ring must finish the first screw');
        repair.fire('pointerdown', 569, 493);
        for (let i = 1; i <= 4; i++) {
            const angle = direction * i * Math.PI / 2;
            repair.fire('pointermove', 539 + 30 * Math.cos(angle), 493 + 30 * Math.sin(angle));
        }
        assert.equal(repair.job.repairProgress, 1, 'Finishing both screws advances before release');
        repair.fire('pointerup', 569, 493);
        assert.equal(repair.job.repairProgress, 1, 'Two complete screw turns must advance once');
        repair.fire('pointerup', 569, 493);
        assert.equal(repair.job.repairProgress, 1, 'Completion cannot advance twice');
        console.log(`PASS ${pointerType} ${stepId}: exact ring rotations, sparse movement, cancellation, direction, and both screws`);
    }
    const { job, fire, notifications } = createRepair(pointerType);
    fire('pointerdown', 237, 410);
    fire('pointerup', 237, 410);
    assert.equal(job.repairProgress, 0, 'Selecting a tool must not open the phone');

    fire('pointerdown', 408, 145);
    fire('pointermove', 592, 145);
    fire('pointerup', 592, 145);
    assert.equal(job.repairProgress, 0, 'One edge must not open the phone');
    const retainedEdges = [...job.manualWork.edges];
    fire('pointerdown', 592, 145);
    fire('pointermove', 592, 495);
    fire('pointercancel', 592, 495);
    assert.deepEqual([...job.manualWork.edges], retainedEdges, 'Cancelled strokes must roll back');

    fire('pointerdown', 592, 145);
    fire('pointermove', 592, 495);
    fire('pointermove', 408, 495);
    assert.equal(job.repairProgress, 0, 'Missing the last seam edge must not complete');
    fire('pointermove', 408, 145);
    assert.equal(job.repairProgress, 1, 'Full coverage must advance before pointerup');
    assert.match(notifications.at(-1), /Phone opened.*tweezers/);
    fire('pointermove', 500, 250);
    fire('pointerup', 500, 250);
    assert.equal(job.repairProgress, 1, 'Releasing after automatic completion must not advance twice');
    console.log(`PASS ${pointerType}: partial seam, cancellation, automatic opening, and no double completion`);
}

function createStep(pointerType, step, guide) {
    const listeners = {};
    let captured = false;
    const job = { selectedTool: null, repairProgress: 0, manualWork: null, diagnosticResults: {}, procedureType: 'battery' };
    const canvas = {
        addEventListener(name, callback) { listeners[name] = callback; },
        classList: { add() {}, remove() {} },
        setPointerCapture() { captured = true; },
        hasPointerCapture() { return captured; },
        releasePointerCapture() { captured = false; listeners.lostpointercapture?.(); }
    };
    const notifications = [];
    const context = vm.createContext({
        document: { getElementById: () => canvas, addEventListener() {} },
        window: { addEventListener() {}, renderGameCanvases() {} },
        gameState: { currentJob: job },
        repairToolAreas: [{ tool: step.tool, x: 288, y: 355, width: 76, height: 135 }],
        getRepairProcedure: () => [step, { id: 'connect', tool: 'Tweezers' }],
        diagnosticsAreComplete: () => true,
        selectRepairTool(tool) { job.selectedTool = tool; },
        getCanvasScenePoint: event => ({ x: event.clientX, y: event.clientY }),
        finishManualRepairStep() { job.repairProgress++; job.selectedTool = null; job.manualWork = null; },
        showNotification(message) { notifications.push(message); },
        performance, structuredClone, cancelAnimationFrame() {}
    });
    vm.runInContext(source, context);
    const fire = (type, x, y) => listeners[type]({
        button: 0, pointerId: 1, pointerType, clientX: x, clientY: y, preventDefault() {}
    });
    return { job, fire, notifications };
}

for (const pointerType of ['mouse', 'touch']) {
    const probe = createStep(pointerType, { id: 'measure', tool: 'Multimeter' });
    probe.fire('pointerdown', 320, 420);
    probe.fire('pointermove', 555, 248);
    probe.fire('pointermove', 445, 248);
    probe.fire('pointerup', 445, 248);
    assert.equal(probe.job.repairProgress, 0, 'Probes must touch red before black');
    assert.equal(probe.job.manualWork.points, 1, 'Only the red pad counts when touched out of order');
    probe.fire('pointerdown', 445, 248);
    probe.fire('pointermove', 500, 300);
    probe.fire('pointercancel', 500, 300);
    assert.equal(probe.job.manualWork.points, 1, 'Cancelled probing keeps the earlier reading only');
    probe.fire('pointerdown', 445, 300);
    probe.fire('pointermove', 555, 248);
    assert.equal(probe.job.repairProgress, 1, 'Touching black after red completes the measurement');
    assert.match(probe.notifications.at(-1), /Multimeter: 3\.87 V/);

    const scrub = createStep(pointerType, { id: 'clean', tool: 'Cleaning brush' });
    scrub.fire('pointerdown', 320, 420);
    scrub.fire('pointermove', 440, 350);
    scrub.fire('pointermove', 560, 350);
    scrub.fire('pointerup', 560, 350);
    assert.equal(scrub.job.repairProgress, 0, 'A single brush stroke must not finish cleaning');
    scrub.fire('pointerdown', 440, 350);
    scrub.fire('pointermove', 700, 350);
    scrub.fire('pointermove', 440, 350);
    scrub.fire('pointerup', 440, 350);
    assert.ok(scrub.job.manualWork.scrub < 300, 'Brushing outside the dirty area cannot count');
    scrub.fire('pointerdown', 440, 350);
    for (let i = 1; i <= 24 && scrub.job.repairProgress === 0; i++) {
        scrub.fire('pointermove', i % 2 ? 560 : 440, 350);
    }
    assert.equal(scrub.job.repairProgress, 1, 'Back-and-forth scrubbing completes cleaning before release');
    scrub.fire('pointerup', 440, 350);
    assert.equal(scrub.job.repairProgress, 1, 'Cleaning cannot complete twice');
    console.log(`PASS ${pointerType}: ordered multimeter probes and area-bound brush scrubbing`);
}
