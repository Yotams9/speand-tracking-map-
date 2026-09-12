import React, { useState } from 'react';

interface CitySearchProps {
  onLocationFound: (lng: number, lat: number) => void;
}

export const CitySearch: React.FC<CitySearchProps> = ({ onLocationFound }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    try {
      // פנייה ל-API חינמי שממיר שם למקום (Geocoding)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        onLocationFound(lng, lat); // שים לב לסדר - קודם אורך (lon) ואז רוחב (lat) כמו ב-MapSurface
      } else {
        alert('לא מצאנו את העיר, נסה לחפש באנגלית או לשנות את האיות.');
      }
    } catch (error) {
      console.error("שגיאה בחיפוש:", error);
      alert('אירעה שגיאה בחיפוש.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSearch} style={{ position: 'absolute', top: '150px', left: '20px', zIndex: 9999, display: 'flex', gap: '8px' }}>
      <input
        type="text"
        placeholder="חפש עיר או מדינה..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          outline: 'none'
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '10px 14px',
          backgroundColor: '#0f5c57',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        {loading ? '...' : '🔍'}
      </button>
    </form>
  );
};