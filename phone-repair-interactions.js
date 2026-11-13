const repairProbePoints = [{ x: 445, y: 248 }, { x: 555, y: 248 }];

function getManualRepairGuide(stepId, job = gameState.currentJob) {
    const opened = job ? getRepairProcedure(job).some(step => step.id === 'open') : true;
    const guides = {
        screws: { kind: 'screws', direction: -1 },
        close: { kind: 'screws', direction: 1 },
        heat: { kind: 'edge' },
        open: { kind: 'edge' },
        lift: { kind: 'drag', start: { x: 500, y: 320 }, end: { x: 500, y: 180 } },
        disconnect: { kind: 'drag', start: { x: 500, y: 250 }, end: { x: 555, y: 295 } },
        remove: { kind: 'drag', start: { x: 500, y: 350 }, end: { x: 660, y: 160 } },
        replace: { kind: 'drag', start: { x: 860, y: 410 }, end: { x: 500, y: 350 } },
        connect: { kind: 'drag', start: { x: 555, y: 295 }, end: { x: 500, y: 250 } },
        seat: { kind: 'drag', start: { x: 660, y: 320 }, end: { x: 500, y: 320 } },
        pulltab: { kind: 'drag', start: { x: 500, y: 442 }, end: { x: 500, y: 545 } },
        shield: { kind: 'drag', start: { x: 500, y: 199 }, end: { x: 690, y: 110 } },
        clean: {
            kind: 'scrub', required: 1400,
            area: opened ? { x: 430, y: 259, width: 140, height: 180 } : { x: 420, y: 165, width: 160, height: 310 }
        },
        measure: { kind: 'points', targets: repairProbePoints }
    };
    return guides[stepId];
}

function getManualRepairHint(stepId) {
    const hints = {
        screws: 'Drag the screwdriver to each bottom screw and circle counterclockwise once.',
        close: 'Drag the screwdriver to each bottom screw and circle clockwise once.',
        heat: 'Sweep the heat gun around all four edges. Hold near an edge until coverage and warmth reach 100%; then switch to the suction cup.',
        open: 'Drag the opening pick around all four highlighted edges. The phone opens automatically at 100% seam coverage.',
        lift: 'Drag the suction cup to the screen center, then pull it up to the arrow.',
        disconnect: 'Drag tweezers to the battery connector, then pull toward the arrow.',
        remove: 'Grab the component with tweezers and drag it to the upper-right parts tray.',
        replace: 'Drag the spare part from the desk into the highlighted component bay.',
        connect: 'Use tweezers to drag the loose cable back onto its socket.',
        seat: 'Grab the cover on the right with the suction cup and slide it onto the phone.',
        pulltab: 'Grip the white adhesive tab with tweezers and pull it straight down to the arrow.',
        shield: 'Grab the silver EMI shield with tweezers and drag it to the parts tray.',
        clean: 'Scrub back and forth inside the dashed area with the brush until it reaches 100%.',
        measure: 'Drag the multimeter probe onto the red (+) pad, then onto the black (-) pad.'
    };
    return hints[stepId];
}

const repairScrewPositions = [{ x: 461, y: 493 }, { x: 539, y: 493 }];
const repairEdgePositions = [];
for (let i = 0; i < 4; i++) {
    repairEdgePositions.push(
        { x: 408 + i * 184 / 3, y: 145 },
        { x: 592, y: 145 + i * 350 / 3 },
        { x: 592 - i * 184 / 3, y: 495 },
        { x: 408, y: 495 - i * 350 / 3 }
    );
}

const repairGesture = { active: null };
const requiredHeatTime = 650;

(() => {
    const canvas = document.getElementById('repairCanvas');
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const currentStep = job => getRepairProcedure(job)[job.repairProgress];
    const freshWork = () => ({ screws: [0, 0], edges: [], heatTime: 0, scrub: 0, points: 0 });
    const nearPhoneEdge = point =>
        ((Math.abs(point.x - 408) <= 38 || Math.abs(point.x - 592) <= 38) &&
            point.y >= 107 && point.y <= 533) ||
        ((Math.abs(point.y - 145) <= 38 || Math.abs(point.y - 495) <= 38) &&
            point.x >= 370 && point.x <= 630);
    const distanceToStroke = (target, start, end) => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
            ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared));
        return distance(target, { x: start.x + t * dx, y: start.y + t * dy });
    };

    function updateHeat(gesture, now) {
        if (nearPhoneEdge(gesture.point)) {
            gesture.job.manualWork.heatTime += Math.max(0, now - gesture.lastTime);
        }
        gesture.lastTime = Math.max(gesture.lastTime, now);
    }

    function heatFrame(now) {
        const gesture = repairGesture.active;
        if (!gesture || gesture.stepId !== 'heat') return;
        updateHeat(gesture, now);
        const work = gesture.job.manualWork;
        if (gesture.moved && work.edges.length === repairEdgePositions.length &&
            work.heatTime >= requiredHeatTime) {
            releaseGesture(false);
            finishManualRepairStep();
            showNotification('Adhesive warmed. Use the suction cup to lift the glass next.', 'success');
            return;
        }
        window.renderGameCanvases?.();
        gesture.heatFrame = requestAnimationFrame(heatFrame);
    }

    function releaseGesture(restore) {
        const gesture = repairGesture.active;
        if (!gesture) return;
        cancelAnimationFrame(gesture.heatFrame);
        if (restore) gesture.job.manualWork = gesture.before;
        repairGesture.active = null;
        canvas.classList.remove('is-dragging');
        if (canvas.hasPointerCapture(gesture.pointerId)) canvas.releasePointerCapture(gesture.pointerId);
        window.renderGameCanvases?.();
    }

    window.cancelRepairGesture = () => releaseGesture(true);
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0 || repairGesture.active) return;
        const job = gameState.currentJob;
        if (!job) return;
        const point = getCanvasScenePoint(event, canvas, 1000, 600);
        const area = repairToolAreas.find(area =>
            point.x >= area.x && point.x <= area.x + area.width &&
            point.y >= area.y && point.y <= area.y + area.height
        );
        if (area) selectRepairTool(area.tool);
        if (!diagnosticsAreComplete(job)) {
            if (!area) showNotification('Complete all four diagnostic checks before using tools.', 'warning');
            return;
        }
        const step = currentStep(job);
        if (!step) {
            showNotification('Reassembly is complete. Test the phone next.', 'warning');
            return;
        }
        if (job.selectedTool !== step.tool) {
            if (!area) showNotification(`Use ${step.tool} for this step.`, 'warning');
            return;
        }
        job.manualWork = { ...freshWork(), ...job.manualWork };
        const guide = getManualRepairGuide(step.id);
        const screwIndex = guide.kind === 'screws' ? repairScrewPositions.findIndex((screw, i) =>
            job.manualWork.screws[i] < Math.PI * 2 &&
            distance(point, screw) >= 8 && distance(point, screw) <= 40
        ) : -1;
        repairGesture.active = {
            job, stepId: step.id, pointerId: event.pointerId, point, previous: point,
            before: structuredClone(job.manualWork),
            screw: screwIndex < 0 ? null : screwIndex,
            angle: screwIndex < 0 ? null : Math.atan2(
                point.y - repairScrewPositions[screwIndex].y,
                point.x - repairScrewPositions[screwIndex].x
            ),
            attached: guide.kind === 'drag' && distance(point, guide.start) <= 38,
            lastTime: performance.now(), moved: false
        };
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add('is-dragging');
        if (step.id === 'heat') {
            repairGesture.active.heatFrame = requestAnimationFrame(heatFrame);
        }
        event.preventDefault();
        window.renderGameCanvases?.();
    });

    canvas.addEventListener('pointermove', event => {
        const gesture = repairGesture.active;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        if (gameState.currentJob !== gesture.job || currentStep(gesture.job)?.id !== gesture.stepId) {
            releaseGesture(true);
            return;
        }
        const point = getCanvasScenePoint(event, canvas, 1000, 600);
        const delta = distance(point, gesture.previous);
        const guide = getManualRepairGuide(gesture.stepId);
        const work = gesture.job.manualWork;
        const now = performance.now();
        if (gesture.stepId === 'heat') updateHeat(gesture, now);
        if (delta > 1) gesture.moved = true;
        if (guide.kind === 'screws') {
            const index = repairScrewPositions.findIndex((screw, i) =>
                work.screws[i] < Math.PI * 2 && distance(point, screw) <= 40
            );
            if (index < 0 || distance(point, repairScrewPositions[index]) < 8) {
                gesture.screw = null;
                gesture.angle = null;
            } else {
                const screw = repairScrewPositions[index];
                const angle = Math.atan2(point.y - screw.y, point.x - screw.x);
                if (gesture.screw === index && gesture.angle !== null) {
                    let turn = angle - gesture.angle;
                    if (turn > Math.PI) turn -= Math.PI * 2;
                    if (turn < -Math.PI) turn += Math.PI * 2;
                    // Quarter-turn samples still describe a circle; half-turn jumps do not.
                    if (Math.abs(turn) <= Math.PI / 2 + 0.000001) {
                        const rotation = Math.max(0, work.screws[index] + turn * guide.direction);
                        work.screws[index] = rotation >= Math.PI * 2 - 0.000001
                            ? Math.PI * 2 : rotation;
                    }
                }
                gesture.screw = index;
                gesture.angle = angle;
            }
        } else if (guide.kind === 'edge') {
            const nearby = repairEdgePositions
                .map((target, i) => distanceToStroke(target, gesture.previous, point) <= 38 ? i : -1)
                .filter(i => i >= 0);
            if (delta > 0 && nearby.length) {
                nearby.forEach(i => {
                    if (!work.edges.includes(i)) work.edges.push(i);
                });
            }
        } else if (guide.kind === 'scrub') {
            const { area } = guide;
            const inside = p => p.x >= area.x && p.x <= area.x + area.width &&
                p.y >= area.y && p.y <= area.y + area.height;
            // Both ends inside the (convex) area means the whole stroke brushed the dirt.
            if (inside(point) && inside(gesture.previous)) {
                work.scrub = Math.min(guide.required, work.scrub + delta);
            }
        } else if (guide.kind === 'points') {
            // One pad per sample, so sweeping back from black to red cannot count both.
            if (work.points < guide.targets.length &&
                distanceToStroke(guide.targets[work.points], gesture.previous, point) <= 22) {
                work.points++;
            }
        } else if (!gesture.attached && distance(point, guide.start) <= 38) {
            gesture.attached = true;
        }
        gesture.previous = point;
        gesture.point = point;
        gesture.lastTime = now;
        event.preventDefault();
        if (guide.kind === 'screws' && work.screws.every(turn => turn >= Math.PI * 2)) {
            releaseGesture(false);
            finishManualRepairStep();
            return;
        }
        if (guide.kind === 'scrub' && work.scrub >= guide.required) {
            releaseGesture(false);
            finishManualRepairStep();
            showNotification('Surface cleaned with isopropyl alcohol.', 'success');
            return;
        }
        if (guide.kind === 'points' && gesture.moved && work.points === guide.targets.length) {
            const reading = getMultimeterReading(gesture.job);
            releaseGesture(false);
            finishManualRepairStep();
            showNotification(`Multimeter: ${reading}`, 'success');
            return;
        }
        if (gesture.stepId === 'open' && gesture.moved &&
            work.edges.length === repairEdgePositions.length) {
            releaseGesture(false);
            finishManualRepairStep();
            showNotification('Phone opened. Use tweezers to disconnect the battery next.', 'success');
            return;
        }
        window.renderGameCanvases?.();
    });

    canvas.addEventListener('pointerup', event => {
        const gesture = repairGesture.active;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const point = getCanvasScenePoint(event, canvas, 1000, 600);
        const guide = getManualRepairGuide(gesture.stepId);
        const work = gesture.job.manualWork;
        if (gesture.stepId === 'heat') updateHeat(gesture, performance.now());
        const complete = gesture.moved && (
            guide.kind === 'screws' ? work.screws.every(turn => turn >= Math.PI * 2) :
                guide.kind === 'edge' ? work.edges.length === repairEdgePositions.length &&
                    (gesture.stepId !== 'heat' || work.heatTime >= requiredHeatTime) :
                guide.kind === 'scrub' ? work.scrub >= guide.required :
                guide.kind === 'points' ? work.points === guide.targets.length :
                    gesture.attached && distance(point, guide.end) <= 32
        );
        releaseGesture(false);
        if (complete) finishManualRepairStep();
        else {
            showNotification(`Keep working: ${getManualRepairHint(gesture.stepId)}`, 'info');
            window.renderGameCanvases?.();
        }
    });
    canvas.addEventListener('pointercancel', () => releaseGesture(true));
    canvas.addEventListener('lostpointercapture', () => releaseGesture(true));
    window.addEventListener('blur', () => releaseGesture(true));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) releaseGesture(true);
    });
    window.addEventListener('resize', () => releaseGesture(true));
})();

function getMultimeterReading(job) {
    return {
        battery: '3.87 V on the new cell - battery healthy.',
        board: '0.2 ohm short traced to the faulty part.',
        water: 'No remaining shorts after cleaning.',
        clean: 'Continuity restored (0.4 ohm).'
    }[job.procedureType] || 'Reading within specification.';
}

function drawManualRepairOverlay(context, job) {
    const step = getRepairProcedure(job)[job.repairProgress];
    if (!step || !diagnosticsAreComplete(job)) return;
    const guide = getManualRepairGuide(step.id);
    const work = job.manualWork;
    const gesture = repairGesture.active;
    const ring = (point, radius, label, complete = false) => {
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fillStyle = complete ? '#54d5a333' : '#f2c56b25';
        context.fill();
        context.strokeStyle = complete ? '#86ebbd' : '#f2d082';
        context.lineWidth = 3;
        context.stroke();
        if (label) caption(context, label, point.x - radius, point.y - radius - 7, 11, '#fff0bd');
    };
    context.save();
    if (guide.kind === 'screws') {
        repairScrewPositions.forEach((screw, i) => {
            const turns = work?.screws[i] || 0;
            ring(screw, 30, guide.direction < 0 ? 'TURN LEFT' : 'TURN RIGHT', turns >= Math.PI * 2);
            context.beginPath();
            context.arc(screw.x, screw.y, 24, 0, Math.min(turns, Math.PI * 2));
            context.strokeStyle = '#8affcb';
            context.lineWidth = 5;
            context.stroke();
        });
    } else if (guide.kind === 'edge') {
        repairEdgePositions.forEach((point, i) => ring(point, 11, '', work?.edges.includes(i)));
        const percent = Math.round((work?.edges.length || 0) / repairEdgePositions.length * 100);
        caption(context, `${step.id === 'heat' ? 'HEAT' : 'SEAM'} COVERAGE ${percent}%`, 407, 123, 12, '#fff0bd');
        if (step.id === 'heat') {
            caption(context, `WARMTH ${Math.min(100, Math.floor((work?.heatTime || 0) / requiredHeatTime * 100))}%`, 407, 530, 12, '#fff0bd');
        }
    } else if (guide.kind === 'scrub') {
        const { area } = guide;
        const percent = Math.floor((work?.scrub || 0) / guide.required * 100);
        context.setLineDash([8, 6]);
        context.strokeStyle = '#f2d082';
        context.lineWidth = 3;
        context.strokeRect(area.x, area.y, area.width, area.height);
        context.setLineDash([]);
        caption(context, `SCRUB ${percent}%`, area.x, area.y - 8, 12, '#fff0bd');
    } else if (guide.kind === 'points') {
        guide.targets.forEach((point, i) => {
            ring(point, 16, i === 0 ? 'RED +' : 'BLACK -', (work?.points || 0) > i);
            context.beginPath();
            context.arc(point.x, point.y, 6, 0, Math.PI * 2);
            context.fillStyle = i === 0 ? '#e5484d' : '#1b1f24';
            context.fill();
        });
    } else {
        if (!gesture?.attached) ring(guide.start, 32, 'GRAB HERE');
        ring(guide.end, 30, ['remove', 'shield'].includes(step.id) ? 'PARTS TRAY' : step.id === 'pulltab' ? 'PULL HERE' : 'MOVE HERE');
        drawingLine(context, [[guide.start.x, guide.start.y], [guide.end.x, guide.end.y]], '#f2d08270', 2);
        const angle = Math.atan2(guide.end.y - guide.start.y, guide.end.x - guide.start.x);
        context.save();
        context.translate(guide.end.x, guide.end.y);
        context.rotate(angle);
        drawingLine(context, [[-14, -8], [0, 0], [-14, 8]], '#ffe4a3', 3);
        context.restore();
        if (step.id === 'seat') {
            roundedPanel(context, 628, 270, 64, 100, 8, '#7f9da3aa', '#d2e0e6');
        }
    }
    if (gesture) {
        const point = gesture.point;
        context.globalAlpha = 0.9;
        if (step.tool === 'Precision screwdriver') drawScrewdriver(context, point.x, point.y - 52, '#f2c56b');
        if (step.tool === 'Tweezers') drawTweezers(context, point.x, point.y - 43);
        if (step.tool === 'Heat gun') drawHeatGun(context, point.x - 45, point.y);
        if (step.tool === 'Opening pick') drawOpeningPick(context, point.x, point.y);
        if (step.tool === 'Suction cup') drawSuctionCup(context, point.x, point.y);
        if (step.tool === 'Cleaning brush') drawCleaningBrush(context, point.x, point.y - 50);
        if (step.tool === 'Multimeter') drawMultimeterProbe(context, point.x, point.y);
        if (gesture.attached && step.id === 'shield') {
            roundedPanel(context, point.x - 72, point.y - 39, 144, 78, 6, '#b9c4c9cc', '#eef4f6');
        }
        if (gesture.attached && step.id === 'pulltab') {
            drawingLine(context, [[500, 430], [point.x, point.y]], '#f4f1e6', 8);
        }
        if (step.tool === 'Replacement part' || (gesture.attached && step.id === 'remove')) {
            roundedPanel(context, point.x - 27, point.y - 42, 54, 84, 5, '#689e8b', '#ccf1de');
        }
        if (gesture.attached && ['lift', 'seat'].includes(step.id)) {
            roundedPanel(context, point.x - 45, point.y - 85, 90, 170, 12, '#7f9da3bb', '#e3f0f3');
        }
    }
    context.restore();
}
