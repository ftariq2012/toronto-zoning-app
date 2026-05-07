import React from "react";
export default function Disclaimer({ municipalityName = "the municipality" }) {
  return (
    <p className="disclaimer">
      This tool is for informational purposes only and is not legal or planning
      advice. Zoning information may be affected by exceptions, site-specific
      amendments, former by-laws, appeals, or other conditions. Always verify
      with {municipalityName} before making planning, building, or purchasing decisions.
    </p>
  );
}
