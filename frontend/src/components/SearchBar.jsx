import React, { useMemo, useState } from "react";

export default function SearchBar({
  addresses,
  status,
  onRequestAddresses,
  onSelectAddress,
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 3 || !addresses?.length) {
      return [];
    }

    return addresses
      .filter((address) => address.search_text?.includes(normalizedQuery))
      .slice(0, 10);
  }, [addresses, normalizedQuery]);

  const selectAddress = (address) => {
    setQuery(address.address_label);
    onSelectAddress(address);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (suggestions[0]) {
      selectAddress(suggestions[0]);
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <label htmlFor="address-search">Address search</label>
      <input
        id="address-search"
        type="search"
        value={query}
        onFocus={onRequestAddresses}
        onChange={(event) => {
          onRequestAddresses();
          setQuery(event.target.value);
        }}
        placeholder="Search a Toronto address"
        autoComplete="off"
      />

      {status === "idle" ? (
        <p className="search-message">Type at least 3 characters to search.</p>
      ) : null}

      {status === "missing" ? (
        <p className="search-message">
          Address search data not found. Run the data preparation scripts.
        </p>
      ) : null}

      {status === "loading" ? (
        <p className="search-message">Loading address search...</p>
      ) : null}

      {normalizedQuery.length > 0 && normalizedQuery.length < 3 ? (
        <p className="search-message">Keep typing to see address suggestions.</p>
      ) : null}

      {normalizedQuery.length >= 3 && status === "ready" && !suggestions.length ? (
        <p className="search-message">No matching addresses found.</p>
      ) : null}

      {suggestions.length ? (
        <ul className="suggestions">
          {suggestions.map((address) => (
            <li key={`${address.address_label}-${address.lat}-${address.lng}`}>
              <button type="button" onClick={() => selectAddress(address)}>
                {address.address_label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
