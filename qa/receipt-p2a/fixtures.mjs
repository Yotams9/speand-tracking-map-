// Fictional evaluation truth only. Never imported by the application.
const line = (row, label, quantityMilli, unitMinor, discountMinor = 0, unit = 'item') => ({
  row, label, quantityMilli, unit, unitMinor, discountMinor,
  lineMinor: quantityMilli * unitMinor / 1000 - discountMinor,
});
const receipt = (id, language, lines, extra = {}) => ({
  version: 1, id, synthetic: true, language, merchant: 'DEMO ORCHARD / מטע דמו',
  date: '2026-09-20', currency: 'ILS', lines,
  totalMinor: lines.reduce((n, l) => n + l.lineMinor, 0), ...extra,
});
const mixed = [
  line(1,'חלב Milk 1L',2000,720), line(2,'לחם Bread',1000,1450),
  line(3,'אורז Rice 1kg',1000,1290,200), line(4,'ביצים Eggs',1000,2490),
  line(5,'עגבניות Tomatoes',1250,1200,0,'kg'), line(6,'מלפפון Cucumber',750,800,0,'kg'),
  line(7,'יוגורט Yogurt',3000,450), line(8,'קפה Coffee',1000,2990,500),
  line(9,'תה Tea',1000,1690), line(10,'פסטה Pasta',2000,690),
  line(11,'עדשים Lentils',1000,1190), line(12,'שיבולת שועל Oats',1000,1390),
  line(13,'טחינה Tahini',1000,2290), line(14,'שמן Olive oil',1000,3490),
  line(15,'סבון Soap',2000,890,180), line(16,'נייר Paper',1000,1990),
  line(17,'מלח Salt',1000,390), line(18,'פלפל Pepper',1000,990),
  line(19,'גבינה Cheese',1000,1790), line(20,'מים Water',2000,590),
  line(21,'חלב Milk 1L',1000,720), // Repeated label, distinct receipt occurrence.
  line(22,'תפוחים Apples',1500,1400,0,'kg'), line(23,'בננות Bananas',1000,1100,0,'kg'),
  line(24,'שוקולד Chocolate',2000,790,100), line(25,null,1000,650),
];
// Only the item name is deliberately unreadable; never guess it from totals.
export const fixtures = [
  receipt('english-6','en', [line(1,'Milk 1L',2000,720),line(2,'Bread',1000,1450),line(3,'Coffee',1000,2990,500),line(4,'Apples',1250,1200,0,'kg'),line(5,'Milk 1L',1000,720),line(6,'Tea',1000,1690)]),
  receipt('hebrew-6','he', [line(1,'חלב',2000,720),line(2,'לחם',1000,1450),line(3,'קפה',1000,2990,500),line(4,'תפוחים',1250,1200,0,'kg'),line(5,'חלב',1000,720),line(6,'תה',1000,1690)]),
  receipt('mixed-25','he-en',mixed),
  receipt('mixed-25-degraded','he-en',structuredClone(mixed),{transform:'skew-low-contrast'}),
];
export function idealResult(f) {
  return { version:1, receiptId:f.id, merchant:f.merchant, date:f.date, currency:f.currency,
    totalMinor:f.totalMinor, lines:f.lines.map(l=>({...l, uncertain:l.label===null?['label']:[]})) };
}
