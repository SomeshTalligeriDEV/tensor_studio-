/** Adapted from ObsidianUI DiscoverButton. Copyright (c) 2026 ObsidianUI, MIT. */
import type {ButtonHTMLAttributes} from 'react';
import {RuneIcon} from './RuneIcon';
import './discover-button.css';
export function DiscoverButton({label,type='button',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){
 return <button {...props} type={type} className={`obsidian-discover-button ${className}`}><span className="obsidian-discover-button__fill" aria-hidden="true"/><span className="obsidian-discover-button__icon"><RuneIcon name="arrow-right" size={18}/></span><span className="obsidian-discover-button__text">{label}</span></button>;
}
