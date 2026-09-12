import React, { useRef, useState } from 'react';
import exifr from 'exifr';
import { useApp } from '@/state/AppState';

interface CameraCaptureProps {
  onLocationFound: (lat: number, lng: number, name: string) => void;
  onManualSelectionRequired: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onLocationFound, onManualSelectionRequired }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPurchase } = useApp();

  const [showMenu, setShowMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');

  const handleButtonClick = () => {
    setShowMenu(true);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const gpsData = await exifr.gps(file);

      if (gpsData && gpsData.latitude && gpsData.longitude) {
        const usePhotoLocation = window.confirm("נמצא מיקום מדויק בתמונה! האם להשתמש במיקום זה?");
        if (usePhotoLocation) {
          const storeName = window.prompt("הכנס שם/תיאור לקנייה:", "קנייה מתמונה") || "הוצאה חדשה";
          onLocationFound(gpsData.latitude, gpsData.longitude, storeName);
          return;
        }
      }

      askForLocationAlternatives();
    } catch (error) {
      console.error("שגיאה בחילוץ נתוני GPS:", error);
      askForLocationAlternatives();
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const askForLocationAlternatives = () => {
    const useDeviceGPS = window.confirm("לא זוהה מיקום מהתמונה. האם להשתמש במיקום ה-GPS הנוכחי, או לבחור ידנית?");
    if (useDeviceGPS && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const storeName = window.prompt("הכנס שם/תיאור לקנייה:", "מיקום נוכחי") || "הוצאה חדשה";
          onLocationFound(position.coords.latitude, position.coords.longitude, storeName);
        },
        () => onManualSelectionRequired()
      );
    } else {
      onManualSelectionRequired();
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptUrl) return;

    // שאלת שם הסניף לאחר ייבוא הלינק
    const branchName = window.prompt("איפה בוצעה הקנייה? (הכנס את שם הסניף, למשל: אושר עד סניף בני ברק):", "סניף חדש");
    if (!branchName) return;

    const totalStr = window.prompt("מה סכום הקבלה בשקלים?", "100");
    const total = parseFloat(totalStr || "0");

    // הוספת הרכישה למערכת
    addPurchase({
      merchantId: `mer_${Date.now()}`,
      flatTotal: total,
      source: 'upload',
      items: [{ title: `קבלה מקישור: ${receiptUrl}`, price: total, qty: 1 }]
    });

    window.alert(`הקבלה נקלטה בהצלחה עבור הסניף: ${branchName}!`);
    setShowLinkModal(false);
    setReceiptUrl('');
  };

  return (
    <div style={{ position: 'absolute', top: '100px', left: '20px', zIndex: 9999 }}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button
        onClick={handleButtonClick}
        style={{
          padding: '12px 20px',
          backgroundColor: '#0f5c57',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        📸 הוסף קבלה / צילום
      </button>

      {/* תפריט בחירה צף (צילום מול ייבוא לינק) */}
      {showMenu && (
        <div style={{
          position: 'absolute',
          top: '55px',
          left: '0',
          background: 'white',
          padding: '12px',
          borderRadius: '10px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '180px',
          color: '#0f172a',
          direction: 'rtl'
        }}>
          <button
            onClick={() => {
              setShowMenu(false);
              fileInputRef.current?.click();
            }}
            style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'right', fontWeight: 'bold' }}
          >
            📷 צלם תמונה של קבלה
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              setShowLinkModal(true);
            }}
            style={{ padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'right', fontWeight: 'bold' }}
          >
            🔗 לייבא לינק קבלה
          </button>
          <button
            onClick={() => setShowMenu(false)}
            style={{ padding: '6px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
          >
            סגור
          </button>
        </div>
      )}

      {/* חלון צף להזנת לינק הקבלה */}
      {showLinkModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <form onSubmit={handleLinkSubmit} style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            maxWidth: '400px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            direction: 'rtl',
            color: '#0f172a'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>ייבוא לינק קבלה (כמו Pairzon)</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>הדבק את קישור הקבלה הדיגיטלית שלך:</p>
            <input
              type="text"
              placeholder="https://public.pairzon.com/..."
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginBlockStart: '8px' }}>
              <button type="submit" style={{ padding: '10px 16px', background: '#0f5c57', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                המשך והגדר סניף
              </button>
              <button type="button" onClick={() => setShowLinkModal(false)} style={{ padding: '10px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};