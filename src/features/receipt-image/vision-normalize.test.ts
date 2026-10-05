import {describe,it,expect} from 'vitest'
import {normalizeVisionResponse} from './vision-normalize'
import {fictionalOcr} from './ocr-fixtures'
import {visionResponse} from './vision-fixtures'
const one=()=>visionResponse(fictionalOcr('one')) as any
const word=(r:any)=>r.responses[0].fullTextAnnotation.pages[0].blocks[0].paragraphs[0].words[0]
describe('bounded Vision normalization',()=>{
  it('preserves all mock words without exposing full text',()=>{const doc=fictionalOcr('one');expect(normalizeVisionResponse(visionResponse(doc))).toEqual(doc);expect(JSON.stringify(normalizeVisionResponse(visionResponse(doc)))).not.toContain('MUST NOT LEAK')})
  it('accepts documented omitted zero vertices',()=>{const r=one();word(r).boundingBox={vertices:[{},{x:40},{x:40,y:20},{y:20}]};expect(normalizeVisionResponse(r).words[0]).toMatchObject({x:0,y:0,width:40,height:20})})
  it('honors suffix and prefix observed breaks with symbol geometry',()=>{const r=one();word(r).symbols=[{text:'A',boundingBox:{vertices:[{x:1,y:1},{x:11,y:1},{x:11,y:11},{x:1,y:11}]},property:{detectedBreak:{type:'SPACE'}}},{text:'B',boundingBox:{vertices:[{x:20,y:1},{x:30,y:1},{x:30,y:11},{x:20,y:11}]}}];expect(normalizeVisionResponse(r).words.slice(0,2).map(w=>w.text)).toEqual(['A','B']);word(r).symbols[0].property=undefined;word(r).symbols[1].property={detectedBreak:{type:'SPACE',isPrefix:true}};expect(normalizeVisionResponse(r).words.slice(0,2).map(w=>w.text)).toEqual(['A','B'])})
  it.each(['HYPHEN','arbitrary-secret'])('fails closed on unsupported break %s',type=>{const r=one();word(r).symbols[0].property={detectedBreak:{type}};expect(()=>normalizeVisionResponse(r)).toThrow('normalization-failed')})
  it.each(['page','box','symbols','empty','error'])('rejects malformed/empty/error geometry %s',kind=>{const r=one();if(kind==='page')r.responses[0].fullTextAnnotation.pages.push({});if(kind==='box')word(r).boundingBox.vertices[0].x=-10;if(kind==='symbols')word(r).symbols=[];if(kind==='empty')delete r.responses[0].fullTextAnnotation;if(kind==='error')r.responses[0].error={message:'SECRET_RAW'};expect(()=>normalizeVisionResponse(r)).toThrow(/normalization-failed|recognition-failed|recognition-empty/)})
})
