
"use strict";

/*
 * THERMOSENSE
 * Panel de monitoreo de temperatura ambiental.
 *
 * No genera mediciones ficticias.
 * Las lecturas deben llegar desde un dispositivo conectado.
 */

const CONFIG = {
    maxHistory: 50,
    chartPoints: 30,
    defaultMin: 18,
    defaultMax: 30
};

const state = {
    connected: false,
    readings: [],
    minimum: CONFIG.defaultMin,
    maximum: CONFIG.defaultMax,
    firstReadingId: 0,
    lastReadingTime: null
};

const $ = (id) => document.getElementById(id);

const elements = {
    sidebar: $("sidebar"),
    menuToggle: $("menu-toggle"),
    overlay: $("sidebar-overlay"),
    connectionLabel: $("connection-label"),
    currentDate: $("current-date"),
    currentTime: $("current-time"),
    currentTemperature: $("current-temperature"),
    maxTemperature: $("max-temperature"),
    minTemperature: $("min-temperature"),
    temperatureDescription: $("temperature-description"),
    readingStatus: $("reading-status"),
    deviceState: $("device-state"),
    deviceDetail: $("device-detail"),
    sensorStatus: $("sensor-status"),
    lastReading: $("last-reading"),
    totalReadings: $("total-readings"),
    sidebarStatus: $("sidebar-status"),
    sidebarDot: $("sidebar-dot"),
    topDot: $("top-dot"),
    deviceDot: $("device-dot"),
    notice: $("connection-notice"),
    noticeBadge: document.querySelector(".notice-badge"),
    noticeTitle: $("connection-notice").querySelector("strong"),
    noticeText: $("connection-notice").querySelector("p"),
    systemTitle: $("system-status-title"),
    systemDescription: $("system-status-description"),
    chart: $("temperature-chart"),
    chartEmpty: $("chart-empty"),
    chartCount: $("chart-reading-count"),
    chartUpdated: $("chart-updated"),
    historyBody: $("history-body"),
    historyCount: $("history-count"),
    minimumInput: $("minimum-limit"),
    maximumInput: $("maximum-limit"),
    settingsForm: $("settings-form"),
    alertResult: $("alert-result"),
    exportButton: $("export-button"),
    toast: $("toast")
};

let toastTimeout;

/* ----------------------------------------
   FECHA Y RELOJ
---------------------------------------- */

function updateClock() {
    const now = new Date();

    elements.currentDate.textContent =
        new Intl.DateTimeFormat("es-BO", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(now);

    elements.currentTime.textContent =
        now.toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

    $("footer-year").textContent = now.getFullYear();
}

updateClock();
setInterval(updateClock, 1000);

/* ----------------------------------------
   MENÚ PARA TELÉFONOS
---------------------------------------- */

function setMenu(open) {
    elements.sidebar.classList.toggle("open", open);
    elements.overlay.classList.toggle("visible", open);

    elements.menuToggle.setAttribute(
        "aria-expanded",
        String(open)
    );

    elements.menuToggle.setAttribute(
        "aria-label",
        open ? "Cerrar menú" : "Abrir menú"
    );

    document.body.style.overflow = open ? "hidden" : "";
}

elements.menuToggle.addEventListener("click", () => {
    const open = !elements.sidebar.classList.contains("open");
    setMenu(open);
});

elements.overlay.addEventListener("click", () => {
    setMenu(false);
});

document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        setMenu(false);

        document.querySelectorAll(".nav-link").forEach((item) => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setMenu(false);
    }
});

/* ----------------------------------------
   NOTIFICACIONES
---------------------------------------- */

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("visible");
    }, 3000);
}

/* ----------------------------------------
   CONEXIÓN CON EL DISPOSITIVO
---------------------------------------- */

function setConnectionStatus(connected) {
    state.connected = connected;

    const dots = [
        elements.sidebarDot,
        elements.topDot,
        elements.deviceDot
    ];

    dots.forEach((dot) => {
        dot.classList.toggle("online", connected);
        dot.classList.toggle("offline", !connected);
    });

    elements.connectionLabel.textContent =
        connected ? "CONECTADO" : "DESCONECTADO";

    elements.sidebarStatus.textContent =
        connected ? "Recibiendo datos" : "Sin conexión";

    elements.deviceState.textContent =
        connected ? "Conectado" : "Desconectado";

    elements.deviceDetail.textContent =
        connected ? "Comunicación activa" : "No se reciben datos";

    elements.sensorStatus.textContent =
        connected ? "Activo" : "Sin datos";

    elements.systemTitle.textContent =
        connected ? "Dispositivo conectado" : "Esperando dispositivo";

    elements.systemDescription.textContent =
        connected
            ? "Se están recibiendo mediciones."
            : "Conecta el sensor para comenzar.";

    elements.notice.classList.toggle("connected", connected);

    elements.noticeTitle.textContent =
        connected
            ? "Conexión con el dispositivo establecida"
            : "Esperando conexión con el sensor";

    elements.noticeText.textContent =
        connected
            ? "El panel ha recibido una medición válida del dispositivo."
            : "Los datos reales aparecerán cuando conectes el dispositivo a la plataforma.";

    elements.noticeBadge.textContent =
        connected ? "CONECTADO" : "SIN DATOS";

    if (!connected) {
        elements.readingStatus.textContent = "Esperando medición";
    }
}

/*
 * Punto de entrada para la futura integración.
 *
 * Ejemplo de uso desde el código de comunicación:
 * window.receiveTemperatureData(27.4);
 *
 * También acepta un objeto:
 * window.receiveTemperatureData({
 *     temperature: 27.4,
 *     timestamp: new Date().toISOString()
 * });
 *
 * IMPORTANTE:
 * Esta función no conecta por sí sola el Arduino o ESP32.
 * Debe ser llamada por una integración real de comunicación.
 */

window.receiveTemperatureData = function (payload) {
    const temperature =
        typeof payload === "number"
            ? payload
            : payload?.temperature;

    if (
        typeof temperature !== "number" ||
        !Number.isFinite(temperature) ||
        temperature < -100 ||
        temperature > 200
    ) {
        console.error("Lectura de temperatura inválida:", payload);
        return false;
    }

    let timestamp = new Date();

    if (
        typeof payload === "object" &&
        payload !== null &&
        payload.timestamp !== undefined
    ) {
        const parsedDate = new Date(payload.timestamp);

        if (Number.isNaN(parsedDate.getTime())) {
            console.error("Fecha de medición inválida.");
            return false;
        }

        timestamp = parsedDate;
    }

    /*
     * Evita incorporar dos veces la misma lectura
     * cuando se reenvía el mismo instante.
     */
    const lastReading = state.readings[0];

    if (
        lastReading &&
        lastReading.timestamp.getTime() === timestamp.getTime()
    ) {
        return false;
    }

    const reading = {
        id: ++state.firstReadingId,
        temperature: Number(temperature.toFixed(2)),
        timestamp,
        origin: "Sensor"
    };

    state.readings.unshift(reading);

    if (state.readings.length > CONFIG.maxHistory) {
        state.readings.length = CONFIG.maxHistory;
    }

    state.lastReadingTime = timestamp;

    setConnectionStatus(true);
    renderDashboard();

    return true;
};

/* ----------------------------------------
   RESUMEN DE TEMPERATURA
---------------------------------------- */

function formatTemperature(value) {
    return value.toFixed(1);
}

function getTemperatureDescription(value) {
    if (value < state.minimum) {
        return "Por debajo del límite configurado";
    }

    if (value > state.maximum) {
        return "Por encima del límite configurado";
    }

    return "Dentro del rango configurado";
}

function renderMetrics() {
    if (state.readings.length === 0) {
        elements.currentTemperature.textContent = "--.-";
        elements.maxTemperature.textContent = "--.-";
        elements.minTemperature.textContent = "--.-";

        elements.temperatureDescription.textContent =
            "No hay una lectura disponible";

        elements.readingStatus.textContent =
            "Esperando medición";

        elements.lastReading.textContent = "--:--:--";
        elements.totalReadings.textContent = "0";

        return;
    }

    const temperatures = state.readings.map(
        (reading) => reading.temperature
    );

    const latest = state.readings[0];

    elements.currentTemperature.textContent =
        formatTemperature(latest.temperature);

    elements.maxTemperature.textContent =
        formatTemperature(Math.max(...temperatures));

    elements.minTemperature.textContent =
        formatTemperature(Math.min(...temperatures));

    elements.temperatureDescription.textContent =
        getTemperatureDescription(latest.temperature);

    elements.readingStatus.textContent =
        "Última medición recibida";

    elements.lastReading.textContent =
        latest.timestamp.toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

    elements.totalReadings.textContent =
        String(state.readings.length);
}

/* ----------------------------------------
   HISTORIAL DE MEDICIONES
---------------------------------------- */

function renderHistory() {
    elements.historyBody.replaceChildren();

    if (state.readings.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.className = "empty-table";
        cell.textContent = "No existen mediciones registradas.";

        row.appendChild(cell);
        elements.historyBody.appendChild(row);
    } else {
        state.readings.forEach((reading, index) => {
            const row = document.createElement("tr");

            const numberCell = document.createElement("td");
            numberCell.textContent = String(index + 1);

            const timeCell = document.createElement("td");
            timeCell.textContent =
                reading.timestamp.toLocaleTimeString("es-BO", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                });

            const temperatureCell = document.createElement("td");
            temperatureCell.className = "temperature-cell";
            temperatureCell.textContent =
                `${formatTemperature(reading.temperature)} °C`;

            const originCell = document.createElement("td");
            const originTag = document.createElement("span");

            originTag.className = "origin-tag";
            originTag.textContent = reading.origin;

            originCell.appendChild(originTag);

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");

            const outOfRange =
                reading.temperature < state.minimum ||
                reading.temperature > state.maximum;

            badge.className = outOfRange
                ? "reading-badge warning"
                : "reading-badge";

            badge.textContent = outOfRange
                ? "Fuera de rango"
                : "Registrada";

            statusCell.appendChild(badge);

            [
                numberCell,
                timeCell,
                temperatureCell,
                originCell,
                statusCell
            ].forEach((cell) => row.appendChild(cell));

            elements.historyBody.appendChild(row);
        });
    }

    elements.historyCount.textContent =
        `${state.readings.length} registros`;
}

/* ----------------------------------------
   GRÁFICA CON CANVAS
---------------------------------------- */

function drawChart() {
    const canvas = elements.chart;
    const context = canvas.getContext("2d");

    if (!context) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
        return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);

    context.setTransform(
        pixelRatio, 0, 0, pixelRatio, 0, 0
    );

    const width = rect.width;
    const height = rect.height;

    context.clearRect(0, 0, width, height);

    const readings = state.readings
        .slice(0, CONFIG.chartPoints)
        .reverse();

    elements.chartEmpty.hidden = readings.length > 0;

    elements.chartCount.textContent =
        `${state.readings.length} lecturas`;

    if (readings.length === 0) {
        return;
    }

    const left = 38;
    const right = 12;
    const top = 16;
    const bottom = 28;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = readings.map((reading) => reading.temperature);

    let minValue = Math.min(...values, state.minimum);
    let maxValue = Math.max(...values, state.maximum);

    if (maxValue === minValue) {
        maxValue += 1;
        minValue -= 1;
    }

    const padding = (maxValue - minValue) * 0.15;

    minValue -= padding;
    maxValue += padding;

    function xPosition(index) {
        if (readings.length === 1) {
            return left + plotWidth / 2;
        }

        return left +
            (index / (readings.length - 1)) * plotWidth;
    }

    function yPosition(value) {
        return top +
            ((maxValue - value) / (maxValue - minValue)) * plotHeight;
    }

    // Líneas horizontales de referencia.

    context.font = "10px Inter, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
        const y = top + (plotHeight / 4) * i;
        const value = maxValue -
            ((maxValue - minValue) / 4) * i;

        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.strokeStyle = "#253248";
        context.lineWidth = 1;
        context.stroke();

        context.fillStyle = "#8294ad";
        context.fillText(value.toFixed(1), left - 7, y);
    }

    // Área bajo la línea.

    const gradient = context.createLinearGradient(
        0, top, 0, height - bottom
    );

    gradient.addColorStop(0, "rgba(53,216,244,0.24)");
    gradient.addColorStop(1, "rgba(53,216,244,0.01)");

    context.beginPath();

    readings.forEach((reading, index) => {
        const x = xPosition(index);
        const y = yPosition(reading.temperature);

        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    });

    context.lineTo(
        xPosition(readings.length - 1),
        height - bottom
    );

    context.lineTo(xPosition(0), height - bottom);
    context.closePath();

    context.fillStyle = gradient;
    context.fill();

    // Línea principal.

    context.beginPath();

    readings.forEach((reading, index) => {
        const x = xPosition(index);
        const y = yPosition(reading.temperature);

        if (index === 0) {
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
        }
    });

    context.strokeStyle = "#35d8f4";
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();

    // Puntos de lectura.

    readings.forEach((reading, index) => {
        const x = xPosition(index);
        const y = yPosition(reading.temperature);

        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);

        context.fillStyle = "#35d8f4";
        context.fill();

        context.strokeStyle = "#101a2b";
        context.lineWidth = 1.5;
        context.stroke();
    });

    // Horas del eje inferior.

    context.fillStyle = "#8294ad";
    context.font = "9px Inter, sans-serif";
    context.textBaseline = "top";

    const labels = [
        0,
        Math.floor((readings.length - 1) / 2),
        readings.length - 1
    ];

    labels.forEach((index, position) => {
        const reading = readings[index];
        const x = xPosition(index);

        context.textAlign =
            position === 0 ? "left" :
            position === labels.length - 1 ? "right" : "center";

        context.fillText(
            reading.timestamp.toLocaleTimeString("es-BO", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }),
            x,
            height - bottom + 9
        );
    });

    elements.chartUpdated.textContent =
        "Actualizado: " +
        state.readings[0].timestamp.toLocaleTimeString("es-BO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
}

/* ----------------------------------------
   ALERTAS
---------------------------------------- */

function renderAlerts() {
    const latest = state.readings[0];

    elements.alertResult.className = "alert-result";

    if (!latest) {
        elements.alertResult.querySelector("span:last-child")
            .textContent =
                "Las alertas se evaluarán cuando existan lecturas válidas.";

        return;
    }

    if (latest.temperature < state.minimum) {
        elements.alertResult.classList.add("warning");

        elements.alertResult.querySelector("span:last-child")
            .textContent =
                `Temperatura baja: ${formatTemperature(latest.temperature)} °C. ` +
                `El límite mínimo es ${state.minimum} °C.`;

        return;
    }

    if (latest.temperature > state.maximum) {
        elements.alertResult.classList.add("warning");

        elements.alertResult.querySelector("span:last-child")
            .textContent =
                `Temperatura alta: ${formatTemperature(latest.temperature)} °C. ` +
                `El límite máximo es ${state.maximum} °C.`;

        return;
    }

    elements.alertResult.classList.add("success");

    elements.alertResult.querySelector("span:last-child")
        .textContent =
            `La última lectura está dentro del rango de ${state.minimum} °C a ${state.maximum} °C.`;
}

/* ----------------------------------------
   ACTUALIZAR EL PANEL
---------------------------------------- */

function renderDashboard() {
    renderMetrics();
    renderHistory();
    drawChart();
    renderAlerts();
}

/* ----------------------------------------
   CONFIGURACIÓN DE LÍMITES
---------------------------------------- */

elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const minimum = Number(elements.minimumInput.value);
    const maximum = Number(elements.maximumInput.value);

    if (
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum < -50 ||
        maximum > 100 ||
        minimum >= maximum
    ) {
        showToast(
            "Revisa los límites: el mínimo debe ser menor que el máximo."
        );

        return;
    }

    state.minimum = minimum;
    state.maximum = maximum;

    renderDashboard();

    showToast("Límites de temperatura actualizados.");
});

/* ----------------------------------------
   EXPORTAR HISTORIAL CSV
---------------------------------------- */

elements.exportButton.addEventListener("click", () => {
    if (state.readings.length === 0) {
        showToast("Todavía no existen mediciones para exportar.");
        return;
    }

    const rows = [
        ["Numero", "Fecha", "Hora", "Temperatura_C", "Origen"]
    ];

    state.readings.slice().reverse().forEach((reading, index) => {
        const date = reading.timestamp;

        rows.push([
            index + 1,
            date.toLocaleDateString("sv-SE"),
            date.toLocaleTimeString("es-BO", {
                hour12: false
            }),
            reading.temperature,
            reading.origin
        ]);
    });

    function escapeCSV(value) {
        const text = String(value);

        return '"' + text.replace(/"/g, '""') + '"';
    }

    const csv = "\uFEFF" + rows
        .map((row) => row.map(escapeCSV).join(";"))
        .join("\r\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "historial_temperaturas.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showToast("Historial exportado correctamente.");
});

/* ----------------------------------------
   INICIO
---------------------------------------- */

setConnectionStatus(false);
renderDashboard();

window.addEventListener("resize", drawChart);

window.addEventListener("beforeprint", drawChart);
