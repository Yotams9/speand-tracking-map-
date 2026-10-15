import styles from './page.module.css'
import { demoPolicy } from '../../server/demo-access'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Spendscape · Private demonstration', robots: { index: false, follow: false } }
export default async function DemoAccess({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error === 'invalid'
  const available = !!demoPolicy(process.env)
  return <main className={styles.screen}><section className={styles.panel} aria-labelledby="demo-title">
    <p className={styles.brand}>SPENDSCAPE</p><h1 id="demo-title">Your private demonstration</h1>
    <p>Enter the access code shared with you. Purchases stay in this browser. Receipt and address requests have a shared usage limit.</p>
    <p lang="he" dir="rtl">הדגמה פרטית. הזינו את קוד הגישה שקיבלתם. הקניות נשמרות בדפדפן ומספר בקשות הפענוח והכתובות מוגבל.</p>
    {error && <p role="alert">The code is invalid. Check the code shared with you and try again.</p>}
    {!available && <p role="status">This private demonstration is unavailable or has expired. Ask its owner to renew access. / ההדגמה אינה זמינה או שתוקפה פג.</p>}
    {available && <><form action="/api/demo-access" method="post"><label htmlFor="code">Access code / קוד גישה</label>
      <input id="code" name="code" type="password" autoComplete="off" required minLength={64} maxLength={64} pattern="[a-f0-9]{64}" spellCheck={false} dir="ltr" aria-describedby="code-hint" />
      <p id="code-hint">Keep this code private. Do not put it in a URL.</p><button type="submit">Open Spendscape / כניסה</button>
    </form>
    <form action="/api/demo-access" method="post"><input type="hidden" name="action" value="logout" /><button type="submit">Close private session / סיום ההפעלה הפרטית</button></form></>}
  </section></main>
}
