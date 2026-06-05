const monthlySalaryInput = document.getElementById("salary");
const workDaysPerMonthInput = document.getElementById("workDays");
const sickDaysCountInput = document.getElementById("sickDays");
const sickPayPercentInput = document.getElementById("sickPercent");
const enableSickDaysCheckbox = document.getElementById("enableSickDays");
const sickDaysSection = document.getElementById("sickSection");
const sickDeductionRow = document.getElementById("sickDeductionRow");
const grossAfterSickRow = document.getElementById("grossAfterSickRow");
const resultsPanel = document.getElementById("resultsCard");
const monthlySickRatioDisplay = document.getElementById("sickRatio");
const calculateButton = document.getElementById("calculateBtn");

const salaryTypeButtons = document.querySelectorAll(".type-btn");
const taxPeriodButtons = document.querySelectorAll(".period-btn");

const EMPLOYEE_SOCIAL_RATE = 0.095;
const EMPLOYEE_HEALTH_RATE = 0.017;
const EMPLOYER_SOCIAL_RATE = 0.15;
const EMPLOYER_HEALTH_RATE = 0.017;
const DEFAULT_WORK_DAYS = 22;
const DEFAULT_SICK_DAYS = 0;
const DEFAULT_SICK_PAY_PERCENT = 70;

const NET_RETENTION_RATE = 1 - EMPLOYEE_SOCIAL_RATE - EMPLOYEE_HEALTH_RATE;
const MID_BRACKET_NET_RATE = NET_RETENTION_RATE - 0.13;
const HIGH_BRACKET_NET_RATE = NET_RETENTION_RATE - 0.23;

const TAX_BRACKET_BEFORE_2026 = createIncomeTaxBracket(30000, 150000, 0.13, 0.23);

const resultFields = {
  initialGross: document.getElementById("initialGross"),
  sickDeduction: document.getElementById("sickDeduction"),
  grossAfterSick: document.getElementById("grossAfterSick"),
  employeeSocial: document.getElementById("employeeSocial"),
  employeeHealth: document.getElementById("employeeHealth"),
  tap: document.getElementById("tap"),
  netSalary: document.getElementById("netSalary"),
  employerGross: document.getElementById("employerGross"),
  employerSocial: document.getElementById("employerSocial"),
  employerHealth: document.getElementById("employerHealth"),
  totalCost: document.getElementById("totalCost"),
  sickFormula: document.getElementById("sickFormula")
};

let activeSalaryType = "gross";
let activeTaxPeriod = "after";

const THEME_STORAGE_KEY = "pagacalcTheme";

function themeFromSystem() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.checked = input.value === theme;
  });
}

function initTheme() {
  let theme = themeFromSystem();
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      theme = stored;
    }
  } catch (_) {
    /* ignore */
  }

  applyTheme(theme);

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      applyTheme(input.value);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, input.value);
      } catch (_) {
        /* ignore */
      }
    });
  });
}

function initFooterYear() {
  const yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

function init() {
  initTheme();
  initFooterYear();

  salaryTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveToggleButton(salaryTypeButtons, button);
      activeSalaryType = button.dataset.type;
      updateResultsIfShown();
    });
  });

  taxPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveToggleButton(taxPeriodButtons, button);
      activeTaxPeriod = button.dataset.period;
      updateResultsIfShown();
    });
  });

  calculateButton.addEventListener("click", () => {
    renderSalaryCalculation();
    resultsPanel.classList.remove("hidden");
    scrollToResults();
  });

  enableSickDaysCheckbox.addEventListener("change", () => {
    sickDaysSection.classList.toggle("hidden", !enableSickDaysCheckbox.checked);
    applyInputConstraints();
  });

  [monthlySalaryInput, workDaysPerMonthInput, sickDaysCountInput, sickPayPercentInput].forEach(
    (input) => {
      input.addEventListener("input", applyInputConstraints);
      input.addEventListener("change", () => {
        applyDefaultFormValues();
        applyInputConstraints();
      });
    }
  );

  applyDefaultFormValues();
  applyInputConstraints();
}

function applyDefaultFormValues() {
  if (workDaysPerMonthInput.value === "") {
    workDaysPerMonthInput.value = DEFAULT_WORK_DAYS;
  }

  if (sickDaysCountInput.value === "") {
    sickDaysCountInput.value = DEFAULT_SICK_DAYS;
  }

  if (sickPayPercentInput.value === "") {
    sickPayPercentInput.value = DEFAULT_SICK_PAY_PERCENT;
  }
}

function readNumericInput(input, defaultValue) {
  if (input.value === "") {
    return defaultValue;
  }

  const value = Number(input.value);
  return Number.isFinite(value) ? value : defaultValue;
}

function createIncomeTaxBracket(taxFreeLimit, upperMidBandLimit, midBandRate, highBandRate) {
  return {
    taxFreeLimit,
    upperMidBandLimit,
    midBandRate,
    highBandRate,
    highBandBaseTax: (upperMidBandLimit - taxFreeLimit) * midBandRate
  };
}

function setActiveToggleButton(buttons, activeButton) {
  buttons.forEach((button) => button.classList.remove("active"));
  activeButton.classList.add("active");
}

function updateResultsIfShown() {
  if (!resultsPanel.classList.contains("hidden")) {
    renderSalaryCalculation();
  }
}

function scrollToResults() {
  resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyInputConstraints() {
  limitInputValue(monthlySalaryInput, 0, Infinity);
  limitInputValue(workDaysPerMonthInput, 0, 31);
  updateSickDaysMaximum();
  limitInputValue(sickPayPercentInput, 0, 100);
  updateMonthlySickDayRatio();
}

function limitInputValue(input, minValue, maxValue) {
  if (input.value === "") {
    return;
  }

  let value = Number(input.value);
  if (!Number.isFinite(value)) {
    return;
  }

  value = Math.max(minValue, Math.min(maxValue, value));
  input.value = value;
}

function updateSickDaysMaximum() {
  const workDays = Math.max(readNumericInput(workDaysPerMonthInput, DEFAULT_WORK_DAYS), 0);
  sickDaysCountInput.max = workDays;
  limitInputValue(sickDaysCountInput, 0, workDays);
}

function updateMonthlySickDayRatio() {
  const workDays = Math.max(readNumericInput(workDaysPerMonthInput, DEFAULT_WORK_DAYS), 1);
  const sickDays = Math.min(
    Math.max(readNumericInput(sickDaysCountInput, DEFAULT_SICK_DAYS), 0),
    workDays
  );
  const sickDaySharePercent = (sickDays / workDays) * 100;

  monthlySickRatioDisplay.textContent = `${sickDaySharePercent.toFixed(1)}%`;
}

function hasSickDays() {
  return enableSickDaysCheckbox.checked;
}

function formatNumericAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value * 100) / 100;
  const isWholeNumber = Math.abs(rounded - Math.round(rounded)) < 0.001;
  if (isWholeNumber) {
    return Math.round(rounded).toLocaleString("sq-AL");
  }

  const trimmed = parseFloat(rounded.toFixed(2));
  return trimmed.toLocaleString("sq-AL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatCurrency(amount) {
  return `${formatNumericAmount(amount)} LEK`;
}

function calculatePersonalIncomeTaxBefore2026(grossSalary) {
  const brackets = TAX_BRACKET_BEFORE_2026;

  if (grossSalary <= brackets.taxFreeLimit) {
    return 0;
  }

  if (grossSalary <= brackets.upperMidBandLimit) {
    return (grossSalary - brackets.taxFreeLimit) * brackets.midBandRate;
  }

  return (
    brackets.highBandBaseTax +
    (grossSalary - brackets.upperMidBandLimit) * brackets.highBandRate
  );
}

function calculatePersonalIncomeTaxFrom2026(grossSalary) {
  if (grossSalary <= 50000) {
    return 0;
  }

  if (grossSalary <= 60000) {
    return (grossSalary - 35000) * 0.13;
  }

  if (grossSalary - 30000 <= 170000) {
    return (grossSalary - 30000) * 0.13;
  }

  return 22100 + (grossSalary - 170001 - 30000) * 0.23;
}

function calculatePersonalIncomeTax(grossSalary) {
  if (activeTaxPeriod === "before") {
    return calculatePersonalIncomeTaxBefore2026(grossSalary);
  }

  return calculatePersonalIncomeTaxFrom2026(grossSalary);
}

function calculatePayrollFromGross(grossSalary, options = {}) {
  const includeSickDays = options.includeSickDays !== false;
  const workDays = readNumericInput(workDaysPerMonthInput, DEFAULT_WORK_DAYS);
  const sickDays =
    includeSickDays && hasSickDays()
      ? readNumericInput(sickDaysCountInput, DEFAULT_SICK_DAYS)
      : DEFAULT_SICK_DAYS;
  const sickPayPercent =
    includeSickDays && hasSickDays()
      ? readNumericInput(sickPayPercentInput, DEFAULT_SICK_PAY_PERCENT)
      : 100;

  const safeWorkDays = Math.max(workDays, 1);
  const safeSickDays = Math.min(Math.max(sickDays, 0), safeWorkDays);
  const safeSickPayPercent = Math.min(Math.max(sickPayPercent, 0), 100);

  const dailyGrossSalary = grossSalary / safeWorkDays;
  const unpaidSickDayRate = (100 - safeSickPayPercent) / 100;
  const sickDayDeduction = dailyGrossSalary * safeSickDays * unpaidSickDayRate;
  const grossAfterSick = grossSalary - sickDayDeduction;

  const employeeSocialContribution = roundAmount(grossAfterSick * EMPLOYEE_SOCIAL_RATE);
  const employeeHealthContribution = roundAmount(grossAfterSick * EMPLOYEE_HEALTH_RATE);
  const personalIncomeTax = roundAmount(calculatePersonalIncomeTax(grossAfterSick));
  const netSalary =
    grossAfterSick - employeeSocialContribution - employeeHealthContribution - personalIncomeTax;

  const employerSocialContribution = roundAmount(grossAfterSick * EMPLOYER_SOCIAL_RATE);
  const employerHealthContribution = roundAmount(grossAfterSick * EMPLOYER_HEALTH_RATE);
  const totalEmployerCost =
    grossAfterSick + employerSocialContribution + employerHealthContribution;

  return {
    initialGross: grossSalary,
    sickDeduction: sickDayDeduction,
    grossAfterSick,
    employeeSocial: employeeSocialContribution,
    employeeHealth: employeeHealthContribution,
    tap: personalIncomeTax,
    netSalary,
    employerSocial: employerSocialContribution,
    employerHealth: employerHealthContribution,
    totalCost: totalEmployerCost,
    safeSickDays,
    safeSickPayPercent
  };
}

function roundAmount(amount) {
  return Math.round(amount);
}

function grossFromNetInBracket(targetNet, netRate, taxOffset, minGross, maxGross) {
  const gross = (targetNet - taxOffset) / netRate;

  if (gross > minGross && gross <= maxGross) {
    return gross;
  }

  return null;
}

function pickFirstValidGross(candidates) {
  for (const gross of candidates) {
    if (gross !== null) {
      return Math.round(gross);
    }
  }

  return 0;
}

function findGrossSalaryFromNetBefore2026(targetNet) {
  const taxFreeLimit = TAX_BRACKET_BEFORE_2026.taxFreeLimit;
  const upperMidBandLimit = TAX_BRACKET_BEFORE_2026.upperMidBandLimit;
  const midBandOffset = taxFreeLimit * 0.13;
  const highBandOffset =
    TAX_BRACKET_BEFORE_2026.highBandBaseTax - upperMidBandLimit * 0.23;

  const taxFreeGross = targetNet / NET_RETENTION_RATE;
  const candidates = [
    taxFreeGross <= taxFreeLimit ? taxFreeGross : null,
    grossFromNetInBracket(targetNet, MID_BRACKET_NET_RATE, midBandOffset, taxFreeLimit, upperMidBandLimit),
    grossFromNetInBracket(targetNet, HIGH_BRACKET_NET_RATE, highBandOffset, upperMidBandLimit, Infinity)
  ];

  return pickFirstValidGross(candidates);
}

function findGrossSalaryFromNetFrom2026(targetNet) {
  const candidates = [
    targetNet / NET_RETENTION_RATE <= 50000 ? targetNet / NET_RETENTION_RATE : null,
    grossFromNetInBracket(targetNet, MID_BRACKET_NET_RATE, 35000 * 0.13, 50000, 60000),
    grossFromNetInBracket(targetNet, MID_BRACKET_NET_RATE, 30000 * 0.13, 60000, 200000),
    grossFromNetInBracket(targetNet, HIGH_BRACKET_NET_RATE, 22100 - 200001 * 0.23, 200000, Infinity)
  ];

  return pickFirstValidGross(candidates);
}

function findGrossSalaryFromPayroll(targetNet) {
  if (activeTaxPeriod === "before") {
    return findGrossSalaryFromNetBefore2026(targetNet);
  }

  return findGrossSalaryFromNetFrom2026(targetNet);
}

function resolveGrossSalary(monthlyAmount) {
  if (activeSalaryType === "gross") {
    return monthlyAmount;
  }

  return findGrossSalaryFromPayroll(monthlyAmount);
}

function renderSalaryCalculation() {
  const monthlyAmount = Number(monthlySalaryInput.value) || 0;
  const grossSalary = resolveGrossSalary(monthlyAmount);
  const payroll = calculatePayrollFromGross(grossSalary);

  resultFields.initialGross.textContent = formatCurrency(payroll.initialGross);
  resultFields.sickDeduction.textContent = `− ${formatCurrency(payroll.sickDeduction)}`;
  resultFields.grossAfterSick.textContent = formatCurrency(payroll.grossAfterSick);
  resultFields.employeeSocial.textContent = `− ${formatCurrency(payroll.employeeSocial)}`;
  resultFields.employeeHealth.textContent = `− ${formatCurrency(payroll.employeeHealth)}`;
  resultFields.tap.textContent = `− ${formatCurrency(payroll.tap)}`;
  resultFields.netSalary.textContent = formatCurrency(payroll.netSalary);
  resultFields.employerGross.textContent = formatCurrency(payroll.grossAfterSick);
  resultFields.employerSocial.textContent = `+ ${formatCurrency(payroll.employerSocial)}`;
  resultFields.employerHealth.textContent = `+ ${formatCurrency(payroll.employerHealth)}`;
  resultFields.totalCost.textContent = formatCurrency(payroll.totalCost);

  const shouldShowSickDeduction = hasSickDays() && payroll.sickDeduction > 0;
  sickDeductionRow.classList.toggle("hidden", !shouldShowSickDeduction);
  grossAfterSickRow.classList.toggle("hidden", !shouldShowSickDeduction);

  if (hasSickDays()) {
    updateMonthlySickDayRatio();
    const unpaidDailyPayPercent = 100 - payroll.safeSickPayPercent;
    resultFields.sickFormula.textContent =
      `${payroll.safeSickDays} ditë × ${unpaidDailyPayPercent}% pagë ditore`;
  }
}

init();
