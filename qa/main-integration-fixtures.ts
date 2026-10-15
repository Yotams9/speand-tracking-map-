import { canonicalSpendscapeData as history } from '../src/data/spendscape-fixtures'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from '../src/features/capture/session-purchase-domain'
import { emptyLocalPurchases, validateLocalPurchases } from '../src/features/local-purchases/local-purchase-store'
import { validateLegacyMain } from '../src/features/capture/session-purchase-storage'
const context = { ...history, source: { adapter: 'fixture' as const, classification: 'synthetic' as const, version: history.fixtureVersion } }
const place = context.places[0]
const review = { ...blankReview(), source:'receipt' as const, provenance:'user-reviewed' as const, merchantId:place.merchantId,placeId:place.id,channel:'physical' as const,date:'2024-03-01T10:15',currency:'ILS' as const,payment:'cash' as const,category:'groceries' as const,amount:'12.40',lines:[{name:'Fictional integration package',quantity:'2',price:'6.25',unit:'item' as const}] }
const result = saveReviewedPurchase(emptySessionLedger(),'synthetic-fixture',review,context,[])
if(result.result.code !== 'saved') throw Error('fixture-invalid')
export const nativeFixture = validateLocalPurchases({ ...emptyLocalPurchases(), records:result.ledger.records,directory:result.ledger.directory,nextSequence:result.ledger.nextSequence,revision:7 },context)
const record = structuredClone(nativeFixture.records[0])
record.purchase.originalAmount=12.5
record.evidence.label = {en:'Purchase details reviewed by you · saved on this device',he:'פרטי הרכישה נבדקו על ידך · שמורים במכשיר הזה'}
export const legacyFixture = validateLegacyMain({version:1,nextSequence:2,records:[record],merchants:[],places:[]},context)
export {context as integrationContext}
