"""India National AQI (CPCB) sub-index for PM2.5 / PM10."""

# (conc_lo, conc_hi, aqi_lo, aqi_hi, category)
PM25_BREAKPOINTS = [
    (0, 30, 0, 50, "Good"),
    (31, 60, 51, 100, "Satisfactory"),
    (61, 90, 101, 200, "Moderate"),
    (91, 120, 201, 300, "Poor"),
    (121, 250, 301, 400, "Very Poor"),
    (251, 500, 401, 500, "Severe"),
]

PM10_BREAKPOINTS = [
    (0, 50, 0, 50, "Good"),
    (51, 100, 51, 100, "Satisfactory"),
    (101, 250, 101, 200, "Moderate"),
    (251, 350, 201, 300, "Poor"),
    (351, 430, 301, 400, "Very Poor"),
    (431, 800, 401, 500, "Severe"),
]


def sub_index(conc: float, breakpoints=PM25_BREAKPOINTS) -> tuple[int, str]:
    """Linear interpolation inside the matching breakpoint band; capped at 500."""
    if conc is None or conc < 0:
        return 0, "Unknown"
    for c_lo, c_hi, i_lo, i_hi, cat in breakpoints:
        if conc <= c_hi:
            c_lo = min(c_lo, conc)
            aqi = i_lo + (i_hi - i_lo) * (conc - c_lo) / max(c_hi - c_lo, 1)
            return round(aqi), cat
    return 500, breakpoints[-1][4]
