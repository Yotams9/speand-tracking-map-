import {describe,it,expect} from 'vitest'
import {receiptPlaceSeed} from './receipt-place-seed'
describe('temporary reviewed address handoff, never location resolution',()=>{
 it('preserves name/address, suggesting explicit city/country in the narrow layout',()=>{expect(receiptPlaceSeed('Fictional store','Fictional street 16, Fictional City, Israel')).toEqual({branch:'Fictional store',address:'Fictional street 16, Fictional City, Israel',city:'Fictional City',country:'Israel'})})
 it('supports explicit Hebrew comma-separated city/country',()=>{expect(receiptPlaceSeed('חנות בדויה','רחוב בדוי 16, עיר בדויה, ישראל')).toMatchObject({city:'עיר בדויה',country:'ישראל'})})
 it.each(['רחוב בדוי 16 עיר בדויה','Fictional street 16','Fictional street 16, Fictional City','Fictional street 16, Fictional City, Unqualified Country',''])('does not infer absent country/city: %s',address=>{expect(receiptPlaceSeed('Fictional',address)).toMatchObject({city:'',country:''})})
 it.each(['Street 16, Floor 2, Israel','Street 16, Apt 2, Fictional City, Israel','Street 16, , Israel'])('keeps unsupported city structure unresolved: %s',address=>{expect(receiptPlaceSeed('Fictional',address)).toMatchObject({city:'',country:'Israel'})})
 it('never adds coordinates, place identifiers, or verification',()=>{expect(Object.keys(receiptPlaceSeed('Fictional','Street 16, Fictional City, Israel')).sort()).toEqual(['address','branch','city','country'])})
})
