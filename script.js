// Loaded via script tags to support local file execution (no CORS requirements)

// --- State Management ---
const STATE_KEYS = {
  ENTRIES: 'mindmate_wellness_entries',
  CUSTOM_TRIGGERS: 'mindmate_custom_triggers',
  SELECTED_EXAM: 'mindmate_selected_exam'
};

const DEFAULT_TRIGGERS = [
  'Upcoming Exam',
  'Mock Test Performance',
  'Results Anxiety',
  'Family Pressure',
  'Time Management',
  'Lack of Preparation',
  'Comparison with Others',
  'Burnout'
];

let state = {
  entries: [],
  customTriggers: [],
  selectedExam: 'JEE'
};

/**
 * Load state from LocalStorage
 */
function loadState() {
  try {
    const rawEntries = localStorage.getItem(STATE_KEYS.ENTRIES);
    state.entries = rawEntries ? JSON.parse(rawEntries) : [];
    
    const rawCustom = localStorage.getItem(STATE_KEYS.CUSTOM_TRIGGERS);
    state.customTriggers = rawCustom ? JSON.parse(rawCustom) : [];

    const rawExam = localStorage.getItem(STATE_KEYS.SELECTED_EXAM);
    state.selectedExam = rawExam || 'JEE';
  } catch (error) {
    console.error('Failed to load application state:', error);
    state.entries = [];
    state.customTriggers = [];
    state.selectedExam = 'JEE';
  }
}

/**
 * Save state to LocalStorage
 */
function saveState() {
  try {
    localStorage.setItem(STATE_KEYS.ENTRIES, JSON.stringify(state.entries));
    localStorage.setItem(STATE_KEYS.CUSTOM_TRIGGERS, JSON.stringify(state.customTriggers));
    localStorage.setItem(STATE_KEYS.SELECTED_EXAM, state.selectedExam);
  } catch (error) {
    console.error('Failed to save application state:', error);
  }
}

// --- Calculation Logic ---

/**
 * Compute local wellness score (0 - 100) based on inputs
 */
function calculateWellnessScore(entry) {
  // 1. Mood Component (25%)
  let moodScore = 60;
  switch (entry.mood) {
    case 'Excellent': moodScore = 100; break;
    case 'Good': moodScore = 80; break;
    case 'Neutral': moodScore = 60; break;
    case 'Stressed': moodScore = 35; break;
    case 'Overwhelmed': moodScore = 10; break;
  }

  // 2. Sleep Component (20%)
  const sleepHrs = Number(entry.sleepHours) || 0;
  let sleepScore = 20;
  if (sleepHrs >= 8) sleepScore = 100;
  else if (sleepHrs >= 7) sleepScore = 90;
  else if (sleepHrs >= 6) sleepScore = 70;
  else if (sleepHrs >= 5) sleepScore = 50;

  // 3. Energy Component (15%)
  let energyScore = 70;
  switch (entry.energy) {
    case 'High': energyScore = 100; break;
    case 'Medium': energyScore = 70; break;
    case 'Low': energyScore = 30; break;
  }

  // 4. Confidence Component (15%)
  let confidenceScore = 70;
  switch (entry.confidence) {
    case 'High': confidenceScore = 100; break;
    case 'Medium': confidenceScore = 70; break;
    case 'Low': confidenceScore = 30; break;
  }

  // 5. Stress Trigger Component (25%)
  const triggerCount = Array.isArray(entry.triggers) ? entry.triggers.length : 0;
  let stressScore = 100;
  if (triggerCount >= 5) stressScore = 10;
  else if (triggerCount >= 3) stressScore = 40;
  else if (triggerCount >= 1) stressScore = 70;

  const score = (moodScore * 0.25) + (sleepScore * 0.20) + (energyScore * 0.15) + (confidenceScore * 0.15) + (stressScore * 0.25);
  return Math.round(score);
}

/**
 * Evaluate score status category
 */
function getScoreCategory(score) {
  if (score >= 70) return { label: 'Healthy', color: 'var(--color-healthy)', class: 'bg-healthy' };
  if (score >= 40) return { label: 'Moderate Risk', color: 'var(--color-warning)', class: 'bg-warning' };
  return { label: 'Burnout Risk', color: 'var(--color-danger)', class: 'bg-danger' };
}

/**
 * Check if the user is demonstrating chronic burnout indicators
 */
function checkEmergencyCondition() {
  if (state.entries.length === 0) return false;

  // Rule 1: Latest entry score has a critical burnout category
  const latestEntry = state.entries[state.entries.length - 1];
  if (latestEntry.wellnessScore < 40) return true;

  // Rule 2: Reported Stressed or Overwhelmed for 3 consecutive days
  if (state.entries.length >= 3) {
    const consecutiveStress = state.entries.slice(-3).every(e => 
      e.mood === 'Stressed' || e.mood === 'Overwhelmed'
    );
    if (consecutiveStress) return true;
  }

  return false;
}

// --- Dynamic Rendering & Canvas Charts ---

/**
 * Draw a clean line chart inside a canvas element
 */
function drawLineChart(canvasId, dataPoints, dates, colorHex) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  if (dataPoints.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No history data yet. Submit a check-in to see trends.', width / 2, height / 2);
    return;
  }

  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + chartHeight * (1 - i / gridSteps);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Draw grid labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(i * 25), paddingLeft - 8, y + 3);
  }

  // Draw X labels & dots
  const pointsCount = dataPoints.length;
  const getX = (idx) => {
    if (pointsCount === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (pointsCount - 1)) * chartWidth;
  };
  const getY = (val) => {
    return paddingTop + chartHeight * (1 - val / 100);
  };

  // Draw the gradient line
  ctx.beginPath();
  dataPoints.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Draw area gradient under the line
  ctx.lineTo(getX(pointsCount - 1), paddingTop + chartHeight);
  ctx.lineTo(getX(0), paddingTop + chartHeight);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  gradient.addColorStop(0, colorHex.replace('1)', '0.22)'));
  gradient.addColorStop(1, colorHex.replace('1)', '0.0)'));
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw points
  dataPoints.forEach((val, i) => {
    const x = getX(i);
    const y = getY(val);
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = colorHex;
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw date text below (only show few for clean layout)
    if (pointsCount <= 7 || i === 0 || i === pointsCount - 1 || i === Math.floor(pointsCount / 2)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      const dateObj = new Date(dates[i]);
      const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })}`;
      ctx.fillText(dateStr, x, paddingTop + chartHeight + 16);
    }
  });
}

/**
 * Draw Sleep and Study comparison bar chart
 */
function drawStudySleepBarChart(canvasId, studyData, sleepData, dates) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  if (studyData.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No history data yet. Submit a check-in to see trends.', width / 2, height / 2);
    return;
  }

  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(12, ...studyData, ...sleepData);

  // Draw grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = paddingTop + chartHeight * (1 - i / steps);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(i * (maxVal / steps))}h`, paddingLeft - 6, y + 3);
  }

  const pointsCount = studyData.length;
  const groupWidth = chartWidth / pointsCount;
  const barWidth = Math.max(3, Math.min(15, groupWidth * 0.28));

  for (let i = 0; i < pointsCount; i++) {
    const groupCenterX = paddingLeft + (i * groupWidth) + groupWidth / 2;
    const studyY = paddingTop + chartHeight * (1 - studyData[i] / maxVal);
    const sleepY = paddingTop + chartHeight * (1 - sleepData[i] / maxVal);

    // Study hours bar
    ctx.fillStyle = 'rgba(139, 92, 246, 0.85)'; // Purple-ish
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(groupCenterX - barWidth - 1.5, studyY, barWidth, paddingTop + chartHeight - studyY, [3, 3, 0, 0]);
    } else {
      ctx.rect(groupCenterX - barWidth - 1.5, studyY, barWidth, paddingTop + chartHeight - studyY);
    }
    ctx.fill();

    // Sleep hours bar
    ctx.fillStyle = 'rgba(14, 165, 233, 0.85)'; // Blue-ish
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(groupCenterX + 1.5, sleepY, barWidth, paddingTop + chartHeight - sleepY, [3, 3, 0, 0]);
    } else {
      ctx.rect(groupCenterX + 1.5, sleepY, barWidth, paddingTop + chartHeight - sleepY);
    }
    ctx.fill();

    // X axis label
    if (pointsCount <= 7 || i === 0 || i === pointsCount - 1 || i === Math.floor(pointsCount / 2)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const dateObj = new Date(dates[i]);
      const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })}`;
      ctx.fillText(dateStr, groupCenterX, paddingTop + chartHeight + 16);
    }
  }
}

/**
 * Redraw all trends dashboard widgets
 */
function updateDashboardMetrics() {
  const container = document.getElementById('dashboard-metrics-container');
  const emptyState = document.getElementById('dashboard-empty-state');
  
  if (state.entries.length === 0) {
    if (container) container.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (container) container.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  // Subset recent entries (max 10 for clean visualization)
  const recentEntries = state.entries.slice(-10);
  const dates = recentEntries.map(e => e.date);
  
  // Calculate average sleep / study
  const sumSleep = state.entries.reduce((acc, curr) => acc + (Number(curr.sleepHours) || 0), 0);
  const sumStudy = state.entries.reduce((acc, curr) => acc + (Number(curr.studyHours) || 0), 0);
  const avgSleep = (sumSleep / state.entries.length).toFixed(1);
  const avgStudy = (sumStudy / state.entries.length).toFixed(1);

  // Update DOM metric values
  const avgSleepEl = document.getElementById('avg-sleep-value');
  const avgStudyEl = document.getElementById('avg-study-value');
  if (avgSleepEl) avgSleepEl.textContent = `${avgSleep} hours`;
  if (avgStudyEl) avgStudyEl.textContent = `${avgStudy} hours`;

  // Draw Wellness score trend line
  const scores = recentEntries.map(e => e.wellnessScore);
  drawLineChart('wellness-trend-canvas', scores, dates, 'rgba(99, 102, 241, 1)'); // Indigo

  // Draw Confidence trend line (mapped: High=100, Medium=70, Low=30)
  const confidences = recentEntries.map(e => {
    if (e.confidence === 'High') return 100;
    if (e.confidence === 'Medium') return 70;
    return 30;
  });
  drawLineChart('confidence-trend-canvas', confidences, dates, 'rgba(236, 72, 153, 1)'); // Pink

  // Draw Study & Sleep side-by-side bars
  const studyHours = recentEntries.map(e => Number(e.studyHours) || 0);
  const sleepHours = recentEntries.map(e => Number(e.sleepHours) || 0);
  drawStudySleepBarChart('sleep-study-canvas', studyHours, sleepHours, dates);

  // Render recent triggers counts
  updateFrequentTriggersList();
  
  // Update overall Wellness Score gauge widget
  const latestEntry = state.entries[state.entries.length - 1];
  updateWellnessScoreGauge(latestEntry.wellnessScore);
}

/**
 * Render details in the Wellness Score radial ring
 */
function updateWellnessScoreGauge(score) {
  const scoreEl = document.getElementById('dashboard-score-number');
  const statusEl = document.getElementById('dashboard-score-status');
  const ringEl = document.getElementById('dashboard-score-ring');

  if (scoreEl) scoreEl.textContent = String(score);
  
  const category = getScoreCategory(score);
  if (statusEl) {
    statusEl.textContent = category.label;
    statusEl.className = 'dashboard-badge ' + category.class;
  }

  // Update ring dashoffset (visual circular percentage)
  if (ringEl) {
    const radius = 54; // Matches r in SVG
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    ringEl.style.strokeDasharray = `${circumference} ${circumference}`;
    ringEl.style.strokeDashoffset = String(offset);
    ringEl.style.stroke = category.color;
  }
}

/**
 * Calculate trigger frequency ranking and draw/update in the UI
 */
function updateFrequentTriggersList() {
  const listEl = document.getElementById('frequent-triggers-list');
  if (!listEl) return;

  listEl.textContent = ''; // Safe to clear since we re-append clean textContent elements

  const frequencies = {};
  state.entries.forEach(e => {
    if (Array.isArray(e.triggers)) {
      e.triggers.forEach(t => {
        frequencies[t] = (frequencies[t] || 0) + 1;
      });
    }
  });

  const sortedTriggers = Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedTriggers.length === 0) {
    const fallbackItem = document.createElement('li');
    fallbackItem.className = 'text-muted py-1';
    fallbackItem.textContent = 'No stress triggers recorded yet.';
    listEl.appendChild(fallbackItem);
    return;
  }

  const maxCount = sortedTriggers[0][1];

  sortedTriggers.forEach(([trigger, count]) => {
    const li = document.createElement('li');
    li.className = 'trigger-freq-item';

    const textSpan = document.createElement('span');
    textSpan.className = 'trigger-freq-name';
    textSpan.textContent = trigger;

    const barContainer = document.createElement('div');
    barContainer.className = 'trigger-freq-bar-bg';

    const barFill = document.createElement('div');
    barFill.className = 'trigger-freq-bar-fill';
    barFill.style.width = `${(count / maxCount) * 100}%`;

    const countSpan = document.createElement('span');
    countSpan.className = 'trigger-freq-count';
    countSpan.textContent = `${count}x`;

    barContainer.appendChild(barFill);
    li.appendChild(textSpan);
    li.appendChild(barContainer);
    li.appendChild(countSpan);
    listEl.appendChild(li);
  });
}

/**
 * Add an item to the history log table
 */
function renderHistoryLog() {
  const tbody = document.getElementById('history-log-body');
  if (!tbody) return;

  tbody.textContent = ''; // Safe to clear

  if (state.entries.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.setAttribute('colspan', '7');
    td.className = 'text-center text-muted py-4';
    td.textContent = 'No entry logs found. Complete a daily check-in above.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // Reverse list to show newest entries first
  const entriesCopy = [...state.entries].reverse();

  entriesCopy.forEach(e => {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    const dateObj = new Date(e.date);
    tdDate.textContent = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short', year: '2-digit' })}`;

    const tdExam = document.createElement('td');
    tdExam.textContent = e.examType;

    const tdMood = document.createElement('td');
    tdMood.textContent = e.mood;

    const tdHours = document.createElement('td');
    tdHours.textContent = `Study: ${e.studyHours}h | Sleep: ${e.sleepHours}h`;

    const tdScore = document.createElement('td');
    const badge = document.createElement('span');
    const category = getScoreCategory(e.wellnessScore);
    badge.className = 'dashboard-badge ' + category.class;
    badge.textContent = `${e.wellnessScore} (${category.label})`;
    tdScore.appendChild(badge);

    const tdTriggers = document.createElement('td');
    tdTriggers.textContent = e.triggers && e.triggers.length > 0
      ? e.triggers.slice(0, 2).join(', ') + (e.triggers.length > 2 ? '...' : '')
      : 'None';

    const tdActions = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete check-in for ${e.date}`);
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete the check-in for ${e.date}?`)) {
        deleteEntry(e.date);
      }
    });
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdDate);
    tr.appendChild(tdExam);
    tr.appendChild(tdMood);
    tr.appendChild(tdHours);
    tr.appendChild(tdScore);
    tr.appendChild(tdTriggers);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

/**
 * Handle deletion of a log entry
 */
function deleteEntry(dateStr) {
  state.entries = state.entries.filter(e => e.date !== dateStr);
  saveState();
  updateDashboardMetrics();
  renderHistoryLog();
  updateEmergencySection();
}

// --- Dynamic Trigger Generation ---

/**
 * Render list of triggers dynamically in the check-in section
 */
function renderTriggerCheckboxes() {
  const container = document.getElementById('triggers-checkbox-container');
  if (!container) return;

  container.textContent = ''; // Safe to clear

  const allTriggers = [...DEFAULT_TRIGGERS, ...state.customTriggers];

  allTriggers.forEach((trigger, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'checkbox-wrapper';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `trigger-${idx}`;
    input.name = 'triggers';
    input.value = trigger;

    const label = document.createElement('label');
    label.setAttribute('for', `trigger-${idx}`);
    label.textContent = trigger;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  });
}

// --- Emergency Support Handling ---

/**
 * Evaluate if emergency warning must display
 */
function updateEmergencySection() {
  const emergencyEl = document.getElementById('emergency-support-section');
  if (!emergencyEl) return;

  const isEmergency = checkEmergencyCondition();
  if (isEmergency) {
    emergencyEl.classList.remove('hidden');
    // Ensure screen readers read out the alert message
    emergencyEl.setAttribute('aria-hidden', 'false');
  } else {
    emergencyEl.classList.add('hidden');
    emergencyEl.setAttribute('aria-hidden', 'true');
  }
}

// --- Event Handlers & Submission Flow ---

/**
 * Validate daily check-in input parameters
 */
function validateFormInputs(data) {
  const mood = data.mood;
  const energy = data.energy;
  const confidence = data.confidence;
  const studyHours = Number(data.studyHours);
  const sleepHours = Number(data.sleepHours);

  if (!mood || !energy || !confidence) {
    return { valid: false, message: 'Please fill out all daily mood and energy check-in criteria.' };
  }

  if (isNaN(studyHours) || studyHours < 0 || studyHours > 24) {
    return { valid: false, message: 'Study completed hours must be between 0 and 24.' };
  }

  if (isNaN(sleepHours) || sleepHours < 0 || sleepHours > 24) {
    return { valid: false, message: 'Sleep duration hours must be between 0 and 24.' };
  }

  return { valid: true, message: 'Success' };
}

/**
 * Process new check-in and journal submission
 */
function handleCheckInSubmit(event) {
  event.preventDefault();

  const form = event.target;
  
  // Collect inputs
  const mood = form.mood.value;
  const energy = form.energy.value;
  const confidence = form.confidence.value;
  const studyHours = form.studyHours.value;
  const sleepHours = form.sleepHours.value;
  const waterIntake = Number(form.waterIntake.value) || 0;
  const examType = form.examType.value;

  // Perform validation
  const validation = validateFormInputs({ mood, energy, confidence, studyHours, sleepHours });
  if (!validation.valid) {
    alert(validation.message);
    return;
  }

  // Gather selected triggers
  const checkedTriggers = [];
  const triggerCheckboxes = form.querySelectorAll('input[name="triggers"]:checked');
  triggerCheckboxes.forEach(cb => {
    checkedTriggers.push(cb.value);
  });

  // Reflections
  const journal = {
    wentWell: form.wentWell.value.trim(),
    challenges: form.challenges.value.trim(),
    proudOf: form.proudOf.value.trim(),
    improveTomorrow: form.improveTomorrow.value.trim()
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const newEntry = {
    date: todayStr,
    examType,
    mood,
    energy,
    confidence,
    studyHours,
    sleepHours,
    waterIntake,
    triggers: checkedTriggers,
    journal,
    wellnessScore: 0 // Will compute below
  };

  newEntry.wellnessScore = calculateWellnessScore(newEntry);

  // Check if today already exists, and overwrite or insert
  const existingIndex = state.entries.findIndex(e => e.date === todayStr);
  if (existingIndex >= 0) {
    state.entries[existingIndex] = newEntry;
  } else {
    state.entries.push(newEntry);
  }

  // Save selection preference
  state.selectedExam = examType;

  // Persist and update
  saveState();
  updateDashboardMetrics();
  renderHistoryLog();
  updateEmergencySection();

  // Reset reflection fields and triggers, show success indicator
  form.wentWell.value = '';
  form.challenges.value = '';
  form.proudOf.value = '';
  form.improveTomorrow.value = '';
  form.querySelectorAll('input[name="triggers"]').forEach(cb => {
    cb.checked = false;
  });

  const successAlert = document.getElementById('form-success-alert');
  if (successAlert) {
    successAlert.classList.remove('hidden');
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
      announcer.textContent = 'Daily check-in recorded successfully and wellness dashboard updated.';
    }
    setTimeout(() => {
      successAlert.classList.add('hidden');
    }, 4000);
  }

  // Scroll to dashboard for feedback
  const dashboardSec = document.getElementById('wellness-dashboard');
  if (dashboardSec) {
    dashboardSec.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * Handle custom trigger addition
 */
function handleCustomTriggerAdd() {
  const input = document.getElementById('custom-trigger-input');
  if (!input) return;

  const value = input.value.trim();
  if (!value) return;

  if (DEFAULT_TRIGGERS.includes(value) || state.customTriggers.includes(value)) {
    alert('This trigger already exists.');
    input.value = '';
    return;
  }

  // Save custom trigger
  state.customTriggers.push(value);
  saveState();
  
  // Re-render
  renderTriggerCheckboxes();
  
  // Check the newly added trigger automatically
  const container = document.getElementById('triggers-checkbox-container');
  if (container) {
    const checkboxes = container.querySelectorAll('input[name="triggers"]');
    checkboxes.forEach(cb => {
      if (cb.value === value) cb.checked = true;
    });
  }

  input.value = '';
}

/**
 * Connect to Gemini and update the coaching view
 */
async function handleConsultCoach() {
  const btn = document.getElementById('btn-consult-coach');
  const loader = document.getElementById('coach-loader');
  const responseContainer = document.getElementById('coach-response-container');
  const errorContainer = document.getElementById('coach-error-container');

  if (!window.MindMateGemini.hasApiKey()) {
    alert('Please enter a Gemini API Key in the settings section (top-right) first.');
    const settingsSec = document.getElementById('api-settings-panel');
    if (settingsSec) {
      settingsSec.classList.remove('hidden');
      settingsSec.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }

  if (state.entries.length === 0) {
    alert('Please complete at least one daily wellness check-in first so the AI Coach has context.');
    return;
  }

  const latestEntry = state.entries[state.entries.length - 1];

  if (btn) btn.disabled = true;
  if (loader) loader.classList.remove('hidden');
  if (responseContainer) responseContainer.classList.add('hidden');
  if (errorContainer) errorContainer.classList.add('hidden');

  try {
    const response = await window.MindMateGemini.getWellnessCoaching(latestEntry);
    renderCoachingResponse(response);
  } catch (error) {
    console.error('Coaching service issue:', error);
    if (errorContainer) {
      errorContainer.classList.remove('hidden');
      const errorText = errorContainer.querySelector('.error-msg-text');
      if (errorText) errorText.textContent = error.message || 'An error occurred during communication.';
    }
  } finally {
    if (btn) btn.disabled = false;
    if (loader) loader.classList.add('hidden');
  }
}

/**
 * Programmatically render instructions from AI Coach safely
 */
function renderCoachingResponse(data) {
  const responseContainer = document.getElementById('coach-response-container');
  if (!responseContainer) return;

  const scoreNum = document.getElementById('ai-score-number');
  const encouragement = document.getElementById('ai-encouragement');
  const tipsList = document.getElementById('ai-tips-list');
  const recsList = document.getElementById('ai-recs-list');
  const quote = document.getElementById('ai-quote');
  const riskBadge = document.getElementById('ai-risk-badge');

  if (scoreNum) scoreNum.textContent = String(data.wellnessScore);
  if (encouragement) encouragement.textContent = data.encouragement;
  if (quote) quote.textContent = data.motivationMessage;

  if (riskBadge) {
    riskBadge.textContent = data.riskLevel;
    const category = getScoreCategory(data.wellnessScore);
    riskBadge.className = 'dashboard-badge ' + category.class;
  }

  // Clear lists safely
  if (tipsList) {
    tipsList.textContent = '';
    data.stressManagementTips.forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsList.appendChild(li);
    });
  }

  if (recsList) {
    recsList.textContent = '';
    data.studyRecommendations.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      recsList.appendChild(li);
    });
  }

  responseContainer.classList.remove('hidden');
  responseContainer.scrollIntoView({ behavior: 'smooth' });
}

// --- Key Management Panel Handlers ---

function initApiKeyPanel() {
  const panel = document.getElementById('api-settings-panel');
  const toggleBtn = document.getElementById('btn-toggle-settings');
  const keyInput = document.getElementById('gemini-key-input');
  const saveBtn = document.getElementById('btn-save-key');
  const statusEl = document.getElementById('key-status-message');

  if (!panel || !toggleBtn || !keyInput || !saveBtn || !statusEl) return;

  // Set initial input field
  const currentKey = window.MindMateGemini.getApiKey();
  if (currentKey) {
    keyInput.value = currentKey;
    statusEl.textContent = 'API Key is active (configured).';
    statusEl.className = 'status-success';
  } else {
    statusEl.textContent = 'No API Key configured. Please enter your Gemini API Key.';
    statusEl.className = 'status-warning';
  }

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  saveBtn.addEventListener('click', () => {
    const val = keyInput.value.trim();
    if (!val) {
      window.MindMateGemini.clearApiKey();
      statusEl.textContent = 'API Key cleared.';
      statusEl.className = 'status-warning';
      alert('API Key cleared. The coach will not run without a key.');
    } else {
      window.MindMateGemini.saveApiKey(val);
      statusEl.textContent = 'API Key saved successfully!';
      statusEl.className = 'status-success';
      alert('API Key configured.');
      panel.classList.add('hidden');
    }
  });
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Populate dynamic form elements
  renderTriggerCheckboxes();
  initApiKeyPanel();

  // Set default values in check-in form based on preference
  const form = document.getElementById('check-in-form');
  if (form) {
    form.examType.value = state.selectedExam;
    form.addEventListener('submit', handleCheckInSubmit);
  }

  // Custom trigger handler
  const addTriggerBtn = document.getElementById('btn-add-custom-trigger');
  if (addTriggerBtn) {
    addTriggerBtn.addEventListener('click', handleCustomTriggerAdd);
  }

  // Gemini Coach handler
  const consultCoachBtn = document.getElementById('btn-consult-coach');
  if (consultCoachBtn) {
    consultCoachBtn.addEventListener('click', handleConsultCoach);
  }

  // Render initial dashboard & history
  updateDashboardMetrics();
  renderHistoryLog();
  updateEmergencySection();

  // Handle window resizing with debounced Redraw of Canvas Charts
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateDashboardMetrics();
    }, 200);
  });
});

// Expose controller interface globally for automated testing and browser console debugging
window.MindMateController = {
  state,
  loadState,
  saveState,
  calculateWellnessScore,
  getScoreCategory,
  checkEmergencyCondition,
  updateDashboardMetrics,
  renderHistoryLog,
  deleteEntry,
  validateFormInputs
};
