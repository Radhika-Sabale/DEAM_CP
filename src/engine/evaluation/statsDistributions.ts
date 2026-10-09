/**
 * @file statsDistributions.ts
 * Numerical methods and distribution functions for statistical inference (Stage 11B).
 *
 * Implements Student's t critical values table, Lanczos log-gamma approximation,
 * regularized incomplete beta function via modified Lentz's method, and the
 * exact Student's t two-sided p-value calculation without external dependencies.
 */

// ---------------------------------------------------------------------------
// Student's t Critical Values Table (two-sided alpha = 0.05)
// ---------------------------------------------------------------------------

/**
 * Two-tailed critical t-values for alpha = 0.05 (95% confidence) for df 1 through 60.
 * Source: NIST/SEMATECH e-Handbook of Statistical Methods.
 */
const T_CRIT_95: readonly number[] = [
  // 0-indexed: index df - 1
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, // 1..10
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, // 11..20
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042, // 21..30
  2.04, 2.037, 2.035, 2.032, 2.03, 2.028, 2.026, 2.024, 2.023, 2.021, // 31..40
  2.02, 2.018, 2.017, 2.015, 2.014, 2.013, 2.012, 2.011, 2.01, 2.009, // 41..50
  2.008, 2.007, 2.006, 2.005, 2.004, 2.003, 2.002, 2.002, 2.001, 2.0, // 51..60
];

/**
 * Returns the critical t-value for a 95% confidence interval (two-sided alpha = 0.05).
 * Uses lookup table for df in 1..60, falling back to 1.96 (normal z) above 60.
 *
 * @param df Degrees of freedom (integer >= 1)
 */
export function getTCritical95(df: number): number {
  if (df < 1) return 1.96;
  if (df <= 60) {
    return T_CRIT_95[df - 1] ?? 1.96;
  }
  return 1.96;
}

// ---------------------------------------------------------------------------
// Numerical Methods: Lanczos ln(Gamma) and Regularized Incomplete Beta
// ---------------------------------------------------------------------------

/**
 * Computes natural logarithm of Gamma function using 7-term Lanczos approximation.
 * Precision: ~1e-10 across positive real arguments.
 */
export function logGamma(z: number): number {
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.138571095857209, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // Reflection formula: Gamma(1 - z) * Gamma(z) = pi / sin(pi * z)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const t = z - 1;
  const p0 = p[0] ?? 1;
  let x = p0;
  for (let i = 1; i < p.length; i++) {
    const pi = p[i] ?? 0;
    x += pi / (t + i);
  }
  const base = t + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(base) - base + Math.log(x);
}

/**
 * Evaluates the continued fraction representation of the incomplete beta function
 * using modified Lentz's method (Abramowitz & Stegun 26.5.8).
 */
export function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3.0e-12;
  const FPMIN = 1.0e-30;

  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    // Even step
    const aaEven = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + aaEven * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aaEven / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;

    // Odd step
    const aaOdd = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + aaOdd * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aaOdd / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1.0) <= EPS) break;
  }
  return h;
}

/**
 * Computes regularized incomplete beta function I_x(a, b).
 */
export function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1.0 - x));

  // Use symmetry transformation if x > (a + 1) / (a + b + 2)
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1.0 - (bt * betacf(b, a, 1.0 - x)) / b;
}

/**
 * Computes two-sided p-value for Student's t distribution with df degrees of freedom.
 *
 * @param t Student's t statistic
 * @param df Degrees of freedom (df >= 1)
 */
export function studentTTwoSidedPValue(t: number, df: number): number {
  if (df < 1) return 1.0;
  if (Math.abs(t) < 1e-12) return 1.0;
  const x = df / (df + t * t);
  const p = incBeta(0.5 * df, 0.5, x);
  return Math.max(0, Math.min(1, p));
}
