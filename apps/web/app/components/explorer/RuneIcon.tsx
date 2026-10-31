import type {CSSProperties} from 'react';
/** Official Apache-2.0 Rune SVGs, served locally without React 19 dependencies. */
export function RuneIcon({name,size=20,className=''}:{name:'box'|'shield-check'|'clock'|'arrow-left-right'|'search'|'arrow-right'|'activity'|'globe'|'copy'|'sun'|'moon'|'check'|'menu';size?:number;className?:string}){
 const url=`url("/icons/rune/${name}.svg")`;
 return <span aria-hidden="true" className={`rune-icon ${className}`} style={{width:size,height:size,maskImage:url,WebkitMaskImage:url} as CSSProperties} />;
}
