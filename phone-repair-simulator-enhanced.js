// All artwork uses logical coordinates; canvas backing pixels follow the display.
function prepareGameCanvas(canvas, width, height) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const density = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(rect.width * density);
    const pixelHeight = Math.round(rect.height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#101b24';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(rect.width / width, rect.height / height);
    context.setTransform(
        scale * pixelWidth / rect.width, 0, 0, scale * pixelHeight / rect.height,
        (rect.width - width * scale) * pixelWidth / rect.width / 2,
        (rect.height - height * scale) * pixelHeight / rect.height / 2
    );
    return context;
}

function roundedPanel(context, x, y, width, height, radius, fill, stroke) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1.5;
        context.stroke();
    }
}

function surface(context, x, y, width, height, fill) {
    context.save();
    context.shadowColor = '#0008';
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    roundedPanel(context, x, y, width, height, 12, fill, '#ffffff20');
    context.restore();
}

function caption(context, text, x, y, size = 14, color = '#d3e3e9') {
    context.fillStyle = color;
    context.font = `600 ${size}px system-ui, sans-serif`;
    context.textAlign = 'left';
    context.fillText(text, x, y);
}

function drawingLine(context, points, color, width = 2) {
    context.beginPath();
    context.moveTo(...points[0]);
    points.slice(1).forEach(point => context.lineTo(...point));
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
}

function drawScrewdriver(context, x, y, color = '#e3ad56', angle = 0) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    roundedPanel(context, -7, -36, 14, 43, 5, color, '#ffffff50');
    for (let i = -3; i <= 3; i += 3) {
        drawingLine(context, [[i, -29], [i, -2]], '#0003', 1);
    }
    roundedPanel(context, -4, 7, 8, 8, 2, '#26343f');
    roundedPanel(context, -2, 15, 4, 35, 1, '#c7d6df');
    drawingLine(context, [[-2, 50], [0, 54], [2, 50]], '#dce8ef', 2);
    context.restore();
}

function drawTweezers(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    drawingLine(context, [[-8, -35], [-8, 25], [-2, 43]], '#c1d0db', 4);
    drawingLine(context, [[8, -35], [8, 25], [2, 43]], '#e3eaf0', 4);
    drawingLine(context, [[-8, -35], [8, -35]], '#93a6b5', 4);
    context.restore();
}

function drawSuctionCup(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.beginPath();
    context.ellipse(0, 12, 23, 14, 0, 0, Math.PI * 2);
    context.fillStyle = '#59cddc60';
    context.fill();
    context.strokeStyle = '#89e1e9';
    context.lineWidth = 2;
    context.stroke();
    roundedPanel(context, -4, -8, 8, 24, 3, '#97c0ce');
    roundedPanel(context, -15, -27, 30, 25, 10, '#304451', '#b7ccd4');
    roundedPanel(context, -9, -22, 18, 14, 6, '#14232b');
    context.restore();
}

function drawOpeningPick(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.beginPath();
    context.moveTo(0, -23);
    context.quadraticCurveTo(6, -25, 26, 18);
    context.quadraticCurveTo(0, 31, -26, 18);
    context.quadraticCurveTo(-6, -25, 0, -23);
    context.fillStyle = '#619edb';
    context.fill();
    context.strokeStyle = '#abd6ff';
    context.lineWidth = 2;
    context.stroke();
    caption(context, '0.5', -10, 14, 10, '#16354f');
    context.restore();
}

function drawHeatGun(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    roundedPanel(context, -9, 4, 18, 37, 5, '#20313f', '#7d9aa8');
    roundedPanel(context, -35, -24, 65, 32, 8, '#e0a456', '#f1c794');
    roundedPanel(context, 30, -20, 20, 24, 3, '#c2d0d9', '#f1f7fa');
    for (let i = 0; i < 4; i++) {
        drawingLine(context, [[-26 + i * 7, -18], [-26 + i * 7, 0]], '#785337', 2);
    }
    drawingLine(context, [[0, 41], [0, 50], [-28, 65], [-48, 61]], '#16232b', 3);
    context.restore();
}

function drawCleaningBrush(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    roundedPanel(context, -5, -38, 10, 58, 4, '#4a8f6f', '#9fe0bf');
    roundedPanel(context, -7, 18, 14, 10, 2, '#c7d6df');
    for (let i = -6; i <= 6; i += 3) {
        drawingLine(context, [[i, 28], [i * 1.2, 46]], '#f1e3b5', 2);
    }
    context.restore();
}

function drawMultimeter(context, x, y, scale = 1) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    roundedPanel(context, -27, -42, 54, 84, 9, '#e0a456', '#f1c794');
    roundedPanel(context, -20, -34, 40, 20, 3, '#c6dccb', '#2c3a32');
    caption(context, '3.87', -15, -19, 12, '#18261d');
    context.beginPath();
    context.arc(0, 12, 13, 0, Math.PI * 2);
    context.fillStyle = '#26343f';
    context.fill();
    drawingLine(context, [[0, 12], [7, 4]], '#e4eff2', 2);
    drawingLine(context, [[-12, 42], [-18, 58]], '#e5484d', 3);
    drawingLine(context, [[12, 42], [18, 58]], '#1b1f24', 3);
    context.restore();
}

function drawMultimeterProbe(context, x, y) {
    drawingLine(context, [[x, y], [x + 10, y - 22]], '#c7d6df', 2);
    drawingLine(context, [[x + 10, y - 22], [x + 22, y - 52]], '#e5484d', 7);
}

function drawPhone(context, x, y, scale = 1, cracked = false) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    surface(context, -58, -112, 116, 224, '#9bafb9');
    roundedPanel(context, -54, -108, 108, 216, 15, '#10151e', '#d6e0e5');
    const screen = context.createLinearGradient(-47, -100, 47, 100);
    screen.addColorStop(0, '#194b6d');
    screen.addColorStop(0.5, '#255f76');
    screen.addColorStop(1, '#111e32');
    roundedPanel(context, -47, -100, 94, 200, 11, screen);
    roundedPanel(context, -20, -97, 40, 8, 4, '#09111a');
    caption(context, '09:41', -34, -57, 20, '#f3f7fa');
    caption(context, 'THURSDAY', -33, -38, 8, '#c3dde7');
    roundedPanel(context, -36, 14, 72, 30, 6, '#ffffff15', '#ffffff25');
    caption(context, cracked ? 'SERVICE NEEDED' : 'REPAIR LAB', -30, 33, 7);
    drawingLine(context, [[-14, 91], [14, 91]], '#ffffffb0', 3);
    if (cracked) {
        drawingLine(context, [[34, -86], [10, -45], [27, -14], [-5, 23], [8, 61], [-14, 98]], '#dceef0b0', 1);
        drawingLine(context, [[10, -45], [-20, -57], [-46, -28]], '#dceef080', 1);
        drawingLine(context, [[27, -14], [46, -2]], '#dceef0b0', 1);
        drawingLine(context, [[-5, 23], [-44, 12]], '#dceef080', 1);
    }
    drawingLine(context, [[58, -49], [58, -13]], '#c3d0d7', 3);
    context.restore();
}

function drawRepairMat(context, x, y, width, height) {
    roundedPanel(context, x, y, width, height, 10, '#23525d', '#6096a1');
    context.save();
    context.beginPath();
    context.roundRect(x + 5, y + 5, width - 10, height - 10, 7);
    context.clip();
    for (let i = 20; i < width; i += 20) {
        drawingLine(context, [[x + i, y], [x + i, y + height]], '#8bd1d00d', 1);
    }
    for (let i = 20; i < height; i += 20) {
        drawingLine(context, [[x, y + i], [x + width, y + i]], '#8bd1d00d', 1);
    }
    context.restore();
    for (let i = 0; i < 5; i++) {
        roundedPanel(context, x + 12 + i * 36, y + 12, 28, 18, 3, '#163d47', '#55828c');
    }
}

function drawWorkshopEnhanced() {
    const context = prepareGameCanvas(workshopCanvas, 1200, 700);
    if (!context) return;
    const floor = context.createLinearGradient(0, 0, 1200, 700);
    floor.addColorStop(0, '#354653');
    floor.addColorStop(1, '#172b34');
    context.fillStyle = floor;
    context.fillRect(0, 0, 1200, 700);
    for (let x = 0; x <= 1200; x += 80) {
        drawingLine(context, [[x, 0], [x, 700]], '#101d2660', 1);
    }
    for (let y = 0; y <= 700; y += 80) {
        drawingLine(context, [[0, y], [1200, y]], '#101d2660', 1);
    }
    roundedPanel(context, 18, 16, 1164, 46, 8, '#10212de0', '#b9d7e520');
    caption(context, 'REPAIR LAB', 40, 46, 20, '#b6edf0');
    caption(context, 'Tap the computer to browse repair jobs', 720, 44, 16);

    surface(context, 50, 100, 300, 200, '#987b5d');
    for (let i = 0; i < 9; i++) {
        drawingLine(context, [[60, 108 + i * 21], [340, 111 + i * 21]], '#cdb18b25', 1);
    }
    surface(context, 100, 120, 160, 100, '#182632');
    roundedPanel(context, 108, 127, 144, 85, 4, '#113542', '#70b5c4');
    caption(context, 'REPAIR OS', 121, 149, 14, '#a5eeed');
    for (let i = 0; i < 3; i++) {
        roundedPanel(context, 121, 159 + i * 14, 114 - i * 16, 7, 2, '#5ec3cf40');
    }
    roundedPanel(context, 167, 220, 26, 10, 2, '#1b2d39');
    roundedPanel(context, 117, 244, 132, 34, 4, '#20313b', '#a2b2b9');
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 12; col++) {
            roundedPanel(context, 123 + col * 10, 249 + row * 8, 7, 5, 1, '#83949c');
        }
    }
    roundedPanel(context, 273, 246, 22, 32, 10, '#d0dbe0', '#657d89');
    caption(context, 'JOB MANAGEMENT', 65, 328, 14);

    surface(context, 410, 100, 350, 310, '#bbc7c9');
    drawRepairMat(context, 429, 119, 312, 270);
    drawPhone(context, 591, 257, 0.65, true);
    drawScrewdriver(context, 462, 238);
    drawTweezers(context, 704, 242, 0.8);
    drawSuctionCup(context, 477, 330, 0.7);
    drawOpeningPick(context, 698, 331, 0.7);
    caption(context, 'REPAIR STATION', 430, 438, 14);

    surface(context, 800, 100, 350, 350, '#233641');
    const labels = ['SCREENS', 'BATTERIES', 'PORTS', 'SMALL PARTS'];
    for (let row = 0; row < 4; row++) {
        const y = 115 + row * 80;
        for (let col = 0; col < 4; col++) {
            const x = 813 + col * 82;
            roundedPanel(context, x, y, 73, 64, 5, '#768f9a', '#aac1cb');
            roundedPanel(context, x + 7, y + 7, 59, 30, 3, '#1b303c');
            roundedPanel(context, x + 27, y + 44, 19, 5, 2, '#263d48');
            caption(context, labels[row], x + 6, y + 58, 7, '#e6f1f4');
            if (row === 0) roundedPanel(context, x + 23, y + 11, 25, 23, 3, '#427389', '#cbdde4');
            if (row === 1) roundedPanel(context, x + 19, y + 14, 35, 16, 2, '#8fa68a', '#d5ddaf');
            if (row === 2) drawingLine(context, [[x + 22, y + 20], [x + 51, y + 20]], '#d6b874', 6);
            if (row === 3) {
                for (let i = 0; i < 3; i++) roundedPanel(context, x + 18 + i * 12, y + 18, 7, 7, 2, '#cbd6dc');
            }
        }
        drawingLine(context, [[808, y + 72], [1142, y + 72]], '#afc1ca', 3);
    }
    caption(context, 'PARTS INVENTORY', 818, 478, 14);

    roundedPanel(context, 50, 390, 300, 242, 14, '#15293290', '#b4cdd320');
    for (let i = 0; i < 3; i++) {
        surface(context, 68 + i * 88, 415, 70, 74, '#506e79');
        roundedPanel(context, 73 + i * 88, 421, 60, 15, 5, '#71909a');
        roundedPanel(context, 76 + i * 88, 443, 54, 39, 7, '#617f8a');
    }
    surface(context, 111, 521, 176, 61, '#967e62');
    roundedPanel(context, 139, 532, 45, 32, 2, '#d7e1dd');
    caption(context, 'TECH', 144, 552, 10, '#47626b');
    caption(context, 'CUSTOMER LOUNGE', 69, 614, 14);

    surface(context, 410, 473, 350, 159, '#263b47');
    drawScrewdriver(context, 451, 540, '#d3a25d', -0.18);
    drawScrewdriver(context, 490, 540, '#74b8c9', 0.12);
    drawTweezers(context, 537, 540, 0.8);
    drawHeatGun(context, 652, 539, 0.9);
    caption(context, 'PRECISION TOOLKIT', 430, 617, 13);

    surface(context, 825, 533, 140, 99, '#71878c');
    roundedPanel(context, 838, 546, 114, 69, 5, '#183641', '#6ab4bc');
    caption(context, 'ESD SAFE', 861, 586, 15, '#94d8d5');
    roundedPanel(context, 1036, 548, 80, 81, 10, '#6a6253', '#ad9b7b');
    for (let i = 0; i < 7; i++) {
        context.beginPath();
        context.ellipse(1076, 567, 12, 39, i * Math.PI / 3.5, 0, Math.PI * 2);
        context.fillStyle = i % 2 ? '#709681' : '#507c68';
        context.fill();
    }
}

function drawRepairTableEnhanced() {
    const canvas = document.getElementById('repairCanvas');
    const context = prepareGameCanvas(canvas, 1000, 600);
    if (!context) return;
    const desk = context.createLinearGradient(0, 0, 1000, 600);
    desk.addColorStop(0, '#b5c0c1');
    desk.addColorStop(1, '#6d828b');
    context.fillStyle = desk;
    context.fillRect(0, 0, 1000, 600);
    drawRepairMat(context, 45, 40, 910, 520);
    caption(context, 'PRECISION REPAIR / ESD SAFE WORKSPACE', 67, 102, 16, '#c4e2e3');
    const job = gameState.currentJob;
    repairToolAreas.forEach(area => {
        if (area.tool === job.selectedTool) {
            roundedPanel(context, area.x, area.y, area.width, area.height, 8, '#7ce9e12b', '#a6fff0');
        }
    });
    const procedure = getRepairProcedure(job);
    const procedureIds = procedure.map(step => step.id);
    const finishedSteps = procedure.slice(0, job.repairProgress).map(step => step.id);
    const activeStep = procedure[job.repairProgress];
    const scrubLeft = step => !procedureIds.includes(step) || finishedSteps.includes(step) ? 0 :
        activeStep?.id === step ? 1 - (job.manualWork?.scrub || 0) / getManualRepairGuide(step, job).required : 1;
    const drawDirt = (x, y, width, height, amount, color) => {
        if (amount <= 0) return;
        context.save();
        context.globalAlpha = amount;
        for (let i = 0; i < 14; i++) {
            const px = x + ((i * 37) % width);
            const py = y + ((i * 53) % height);
            context.beginPath();
            context.ellipse(px, py, 7 + (i % 3) * 4, 4 + (i % 2) * 3, i, 0, Math.PI * 2);
            context.fillStyle = color;
            context.fill();
        }
        context.restore();
    };
    const partLabel = (job.requiredParts[0] || (job.procedureType === 'clean' ? 'contacts' : 'component')).toUpperCase();
    const opened = finishedSteps.includes('open') && !finishedSteps.includes('seat');
    const replaced = finishedSteps.includes('replace');
    if (opened) {
        surface(context, 404, 135, 192, 370, '#a2b3bb');
        roundedPanel(context, 415, 146, 170, 348, 14, '#15242d', '#d2e0e6');
        roundedPanel(context, 428, 160, 144, 78, 6, '#2b695c', '#7fa38f');
        for (let i = 0; i < 4; i++) {
            roundedPanel(context, 438 + i * 31, 175, 22, 38, 2, '#c2c9bd', '#e3d6a4');
        }
        if (procedureIds.includes('shield') && (!finishedSteps.includes('shield') || finishedSteps.includes('connect'))) {
            roundedPanel(context, 428, 160, 144, 78, 6, '#b9c4c9', '#eef4f6');
            caption(context, 'EMI SHIELD', 462, 204, 11, '#3b4c55');
        }
        if (!finishedSteps.includes('remove') || replaced) {
            roundedPanel(context, 430, 259, 140, 180, 7, replaced ? '#397b6c' : '#303b46', '#a5b7bf');
            caption(context, replaced ? `NEW ${partLabel}` : partLabel, 440, 341, 12);
            caption(context, replaced ? 'INSTALLED' : 'SERVICE NEEDED', 447, 365, 10);
            if (job.procedureType === 'battery' && !finishedSteps.includes('pulltab')) {
                roundedPanel(context, 488, 426, 24, 32, 3, '#f4f1e6', '#ffffff');
                caption(context, 'PULL', 489, 446, 8, '#59646a');
            }
            drawDirt(436, 266, 128, 166, scrubLeft('clean'),
                job.procedureType === 'clean' && job.category !== 'battery' ? '#8b7a5ccc' : '#5fae8dcc');
        } else {
            caption(context, 'PART REMOVED', 443, 344, 12);
        }
        const disconnected = finishedSteps.includes('disconnect') && !finishedSteps.includes('connect');
        drawingLine(context, [[500, 238], [500, disconnected ? 247 : 275]], '#d9ac67', 8);
        if (finishedSteps.includes('measure')) {
            roundedPanel(context, 600, 220, 96, 40, 6, '#c6dccb', '#2c3a32');
            caption(context, 'METER OK', 614, 245, 12, '#18261d');
        }
        caption(context, disconnected ? 'BATTERY ISOLATED' : 'CABLES CONNECTED', 432, 475, 11);
    } else {
        const glassOff = ['backglass', 'adhesive'].includes(job.procedureType) &&
            finishedSteps.includes('lift') && !finishedSteps.includes('seat');
        if (glassOff) {
            surface(context, 404, 135, 192, 370, '#a2b3bb');
            roundedPanel(context, 415, 146, 170, 348, 14, '#2a3640', '#d2e0e6');
            caption(context, job.procedureType === 'backglass' ? 'GLASS REMOVED' : 'SCREEN LIFTED', 447, 320, 12);
            drawDirt(426, 175, 148, 290, scrubLeft('clean'), '#e8e2cfcc');
        } else {
            drawPhone(context, 500, 320, 1.65, job.procedureType === 'backglass'
                ? !finishedSteps.includes('lift')
                : job.category === 'screen' && !replaced && job.procedureType !== 'adhesive');
        }
        if (job.tested) {
            roundedPanel(context, 432, 300, 136, 60, 8, '#225e50', '#a6e1ba');
            caption(context, 'TEST PASSED', 443, 334, 16, '#dbffe9');
        }
    }
    for (const [index, x] of [461, 539].entries()) {
        const turned = (job.manualWork?.screws[index] || 0) >= Math.PI * 2;
        const visible = activeStep?.id === 'screws' ? !turned :
            activeStep?.id === 'close' ? turned :
                !finishedSteps.includes('screws') || finishedSteps.includes('close') || !procedureIds.includes('screws');
        if (visible) {
            drawingLine(context, [[x - 3, 493], [x + 3, 493]], '#e4eff2', 2);
            drawingLine(context, [[x, 490], [x, 496]], '#e4eff2', 2);
        }
    }
    drawScrewdriver(context, 143, 224, '#dca552');
    caption(context, 'PHILLIPS', 112, 296, 12);
    drawScrewdriver(context, 233, 224, '#71baca');
    caption(context, 'PENTALOBE', 196, 296, 12);
    drawTweezers(context, 146, 405, 1.2);
    caption(context, 'TWEEZERS', 108, 483, 12);
    drawOpeningPick(context, 237, 410, 1.25);
    caption(context, 'OPENING PICK', 192, 483, 11);
    drawCleaningBrush(context, 326, 230, 1.2);
    caption(context, 'IPA BRUSH', 296, 296, 12);
    drawMultimeter(context, 326, 412, 0.95);
    caption(context, 'MULTIMETER', 302, 483, 10);
    drawHeatGun(context, 803, 221, 1.3);
    caption(context, 'HEAT GUN', 769, 324, 12);
    drawSuctionCup(context, 742, 411, 1.3);
    caption(context, 'SUCTION CUP', 699, 483, 12);
    roundedPanel(context, 815, 363, 88, 103, 7, '#d6e0e0', '#8cabb0');
    roundedPanel(context, 833, 374, 52, 63, 6, '#1c3443', '#94becb');
    caption(context, 'SPARE PART', 822, 453, 10, '#345663');
    for (let i = 0; i < (finishedSteps.includes('screws') && !finishedSteps.includes('close') ? 5 : 0); i++) {
        const x = 70 + i * 36;
        drawingLine(context, [[x, 61], [x + 8, 61]], '#cbd8df', 2);
        drawingLine(context, [[x + 4, 57], [x + 4, 65]], '#cbd8df', 2);
    }
    drawManualRepairOverlay(context, job);
}

window.drawWorkshop = drawWorkshopEnhanced;
window.renderGameCanvases = function() {
    if (document.getElementById('workshopView').classList.contains('active')) {
        drawWorkshopEnhanced();
    }
    if (document.getElementById('repairTableView').classList.contains('active')) {
        drawRepairTableEnhanced();
    }
};

let pendingCanvasFrame = 0;
function scheduleCanvasRender() {
    if (pendingCanvasFrame) return;
    pendingCanvasFrame = requestAnimationFrame(() => {
        pendingCanvasFrame = 0;
        window.renderGameCanvases();
    });
}

const gameCanvasObserver = new ResizeObserver(scheduleCanvasRender);
gameCanvasObserver.observe(workshopCanvas);
gameCanvasObserver.observe(document.getElementById('repairCanvas'));
window.addEventListener('resize', scheduleCanvasRender);

function watchDisplayDensity() {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', () => {
        scheduleCanvasRender();
        watchDisplayDensity();
    }, { once: true });
}

watchDisplayDensity();
scheduleCanvasRender();
