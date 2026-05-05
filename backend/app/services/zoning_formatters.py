ZONE_NAMES = {
    "R": "Residential Zone",
    "RD": "Residential Detached Zone",
    "RS": "Residential Semi-Detached Zone",
    "RT": "Residential Townhouse Zone",
    "RM": "Residential Multiple Dwelling Zone",
    "RA": "Residential Apartment Zone",
    "CR": "Commercial Residential Zone",
    "CRE": "Commercial Residential Employment Zone",
    "CL": "Commercial Local Zone",
    "EL": "Employment Light Industrial Zone",
    "E": "Employment Industrial Zone",
    "EH": "Employment Heavy Industrial Zone",
    "I": "Institutional Zone",
    "O": "Open Space Zone",
    "ON": "Open Space Natural Zone",
    "OR": "Open Space Recreation Zone",
    "OG": "Open Space Golf Zone",
    "UT": "Utility and Transportation Zone",
    "U": "Utility Zone",
}


def clean_value(value):
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() == "nan" or text == "-1":
        return ""
    return text


def get_zone_name(zone_code):
    code = clean_value(zone_code).upper()
    return ZONE_NAMES.get(code, f"{code} Zone" if code else "")


def build_summary(main_properties, overlays):
    zone_code = clean_value(main_properties.get("zone_code"))
    zone_name = get_zone_name(zone_code) or "this zoning area"
    zone_string = clean_value(main_properties.get("zone_string"))
    parts = [f"This area is zoned {zone_name}{f' ({zone_code})' if zone_code else ''}."]

    if zone_string:
        parts.append(f"The zoning string is {zone_string}.")

    height = first_overlay_value(overlays.get("height", []), ["height_string", "height_label", "height_stories"])
    if height:
        parts.append(f"The height overlay indicates {height}.")

    lot_coverage = first_overlay_value(overlays.get("lot_coverage", []), ["lot_coverage_percent"])
    if lot_coverage:
        parts.append(f"The lot coverage overlay indicates maximum lot coverage {lot_coverage}%.")

    parts.append("Always verify official zoning details with the City of Toronto.")
    return " ".join(parts)


def first_overlay_value(rows, keys):
    for row in rows:
        for key in keys:
            value = clean_value(row.get(key))
            if value:
                return value
    return ""
