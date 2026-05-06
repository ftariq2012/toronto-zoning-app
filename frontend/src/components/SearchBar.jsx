import React, { useEffect, useState } from "react";

export default function SearchBar({
  status,
  onSearchAddresses,
  onSelectAddress,
  onClearSearch,
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchState, setSearchState] = useState("idle");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    let isCurrent = true;

    if (normalizedQuery.length < 3) {
      setSuggestions([]);
      setSearchState("idle");
      return () => {
        isCurrent = false;
      };
    }

    setSearchState("loading");
    const timeoutId = window.setTimeout(() => {
      onSearchAddresses(normalizedQuery)
        .then((results) => {
          if (isCurrent) {
            setSuggestions(results.slice(0, 10));
            setSearchState("ready");
          }
        })
        .catch(() => {
          if (isCurrent) {
            setSuggestions([]);
            setSearchState("error");
          }
        });
    }, 200);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [normalizedQuery, onSearchAddresses]);

  const selectAddress = (address) => {
    setQuery(address.address_label);
    setSuggestions([]);
    onSelectAddress(address);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (suggestions[0]) {
      selectAddress(suggestions[0]);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setSearchState("idle");
    onClearSearch();
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <label htmlFor="address-search">Address search</label>
      <input
        id="address-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a Toronto address"
        autoComplete="off"
      />

      {query ? (
        <button className="search-clear" type="button" onClick={clearSearch}>
          Clear search
        </button>
      ) : null}

      {normalizedQuery.length > 0 && normalizedQuery.length < 3 ? (
        <p className="search-message">Keep typing to see address suggestions.</p>
      ) : null}

      {normalizedQuery.length >= 3 && searchState === "loading" ? (
        <p className="search-message">Searching addresses...</p>
      ) : null}

      {status === "fallback" ? (
        <p className="search-message">Backend unavailable. Using local address fallback.</p>
      ) : null}

      {status === "missing" ? (
        <p className="search-message">
          Address search data not found. Load PostGIS or run the data preparation scripts.
        </p>
      ) : null}

      {normalizedQuery.length >= 3 && searchState === "ready" && !suggestions.length ? (
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
